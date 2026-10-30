-- ============================================================================
-- MIGRACIÓN 023: Corrección definitiva de procesar_venta_pos y constraints en ventas
-- ============================================================================
-- Resuelve el error 23502: "null value in column 'monto_pagado' of relation 'ventas' violates not-null constraint"
-- Garantiza que el INSERT en ventas guarde todos los detalles de pago, caja y cajero,
-- manteniendo la lógica de conversión automática de stock para presentaciones comerciales (fardo, cartón, etc.).

-- 1. Establecer valores por defecto seguros en la tabla ventas para evitar fallos por campos nulos
ALTER TABLE public.ventas ALTER COLUMN monto_pagado SET DEFAULT 0.00;
ALTER TABLE public.ventas ALTER COLUMN monto_efectivo SET DEFAULT 0.00;
ALTER TABLE public.ventas ALTER COLUMN monto_tarjeta SET DEFAULT 0.00;
ALTER TABLE public.ventas ALTER COLUMN monto_transferencia SET DEFAULT 0.00;
ALTER TABLE public.ventas ALTER COLUMN monto_credito SET DEFAULT 0.00;
ALTER TABLE public.ventas ALTER COLUMN devuelta_entregada SET DEFAULT 0.00;
ALTER TABLE public.ventas ALTER COLUMN monto_impuesto SET DEFAULT 0.00;
ALTER TABLE public.ventas ALTER COLUMN monto_descuento SET DEFAULT 0.00;
ALTER TABLE public.ventas ALTER COLUMN costo_total SET DEFAULT 0.00;

-- 2. Reemplazar procesar_venta_pos con inserción completa y descuento correcto de stock
CREATE OR REPLACE FUNCTION public.procesar_venta_pos(p_payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_venta_id UUID := gen_random_uuid();
    v_numero_factura TEXT;
    v_ncf TEXT := NULL;
    v_tipo_ncf TEXT;
    v_rango_id UUID;
    v_item JSONB;
    v_prod RECORD;
    v_prod_id UUID;
    v_combo_id UUID;
    v_combo_item RECORD;
    v_target_prod_id UUID;
    v_descuento_stock NUMERIC;
    v_cant NUMERIC;
BEGIN
    v_tipo_ncf := NULLIF(TRIM(p_payload->>'tipo_ncf'), '');

    -- Generar NCF si corresponde y no viene ya asignado
    IF v_tipo_ncf IS NOT NULL THEN
        SELECT id, serie || lpad((secuencia_actual + 1)::TEXT, 8, '0')
        INTO v_rango_id, v_ncf
        FROM rangos_ncf
        WHERE tipo_ncf = v_tipo_ncf AND activo = TRUE AND (fecha_vencimiento IS NULL OR fecha_vencimiento >= CURRENT_DATE)
        FOR UPDATE;

        IF v_rango_id IS NOT NULL THEN
            UPDATE rangos_ncf SET secuencia_actual = secuencia_actual + 1 WHERE id = v_rango_id;
        ELSE
            v_ncf := NULLIF(TRIM(p_payload->>'ncf'), '');
        END IF;
    ELSE
        v_ncf := NULLIF(TRIM(p_payload->>'ncf'), '');
    END IF;

    -- Número de factura interno
    v_numero_factura := COALESCE(
        NULLIF(TRIM(p_payload->>'numero_factura'), ''),
        'FAC-' || to_char(NOW(), 'YYYYMMDD') || '-' || upper(substring(replace(v_venta_id::TEXT, '-', '') from 1 for 8))
    );

    -- Insertar venta con TODOS los campos de montos, pago, caja y cajero
    INSERT INTO ventas (
        id,
        numero_factura,
        ncf,
        tipo_ncf,
        sucursal_id,
        cajero_id,
        cliente_id,
        caja_id,
        subtotal,
        monto_impuesto,
        monto_descuento,
        monto_total,
        costo_total,
        metodo_pago,
        monto_pagado,
        monto_efectivo,
        monto_tarjeta,
        monto_transferencia,
        monto_credito,
        devuelta_entregada,
        estado,
        creado_en
    ) VALUES (
        v_venta_id,
        v_numero_factura,
        v_ncf,
        v_tipo_ncf,
        NULLIF(p_payload->>'sucursal_id', '')::UUID,
        COALESCE(NULLIF(p_payload->>'cajero_id', '')::UUID, auth.uid()),
        NULLIF(p_payload->>'cliente_id', '')::UUID,
        NULLIF(p_payload->>'caja_id', ''),
        COALESCE((p_payload->>'subtotal')::NUMERIC, 0),
        COALESCE((p_payload->>'monto_impuesto')::NUMERIC, 0),
        COALESCE((p_payload->>'monto_descuento')::NUMERIC, 0),
        COALESCE((p_payload->>'monto_total')::NUMERIC, 0),
        COALESCE((p_payload->>'costo_total')::NUMERIC, 0),
        COALESCE(p_payload->>'metodo_pago', 'efectivo'),
        COALESCE((p_payload->>'monto_pagado')::NUMERIC, (p_payload->>'monto_total')::NUMERIC, 0),
        COALESCE((p_payload->>'monto_efectivo')::NUMERIC, 0),
        COALESCE((p_payload->>'monto_tarjeta')::NUMERIC, 0),
        COALESCE((p_payload->>'monto_transferencia')::NUMERIC, 0),
        COALESCE((p_payload->>'monto_credito')::NUMERIC, 0),
        COALESCE((p_payload->>'devuelta_entregada')::NUMERIC, 0),
        'completada',
        NOW()
    );

    -- Procesar cada ítem del carrito
    FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_payload->'items', '[]'::jsonb))
    LOOP
        v_prod_id := NULL;
        IF (v_item->>'producto_id') IS NOT NULL AND (v_item->>'producto_id') ~ '^[0-9a-fA-F-]{36}$' THEN
            v_prod_id := (v_item->>'producto_id')::UUID;
        END IF;

        v_combo_id := NULL;
        IF (v_item->>'combo_id') IS NOT NULL AND (v_item->>'combo_id') ~ '^[0-9a-fA-F-]{36}$' THEN
            v_combo_id := (v_item->>'combo_id')::UUID;
        END IF;

        v_cant := COALESCE((v_item->>'cantidad')::NUMERIC, 1);

        -- Registrar detalle en la factura con el nombre y precio del ítem vendido
        INSERT INTO detalle_ventas (
            id,
            venta_id,
            producto_id,
            combo_id,
            tipo_item,
            nombre_item,
            precio_unitario,
            costo_unitario,
            cantidad,
            porcentaje_impuesto,
            subtotal
        ) VALUES (
            gen_random_uuid(),
            v_venta_id,
            v_prod_id,
            v_combo_id,
            COALESCE(v_item->>'tipo_item', 'producto'),
            COALESCE(v_item->>'nombre_item', 'Artículo'),
            COALESCE((v_item->>'precio_unitario')::NUMERIC, 0),
            COALESCE((v_item->>'costo_unitario')::NUMERIC, 0),
            v_cant,
            COALESCE((v_item->>'porcentaje_impuesto')::NUMERIC, 0),
            COALESCE((v_item->>'subtotal')::NUMERIC, 0)
        );

        -- Descontar inventario considerando presentación comercial y unidad base
        IF v_prod_id IS NOT NULL AND COALESCE(v_item->>'tipo_item', 'producto') = 'producto' THEN
            SELECT id, producto_base_id, factor_conversion
            INTO v_prod
            FROM productos
            WHERE id = v_prod_id;

            IF FOUND THEN
                IF v_prod.producto_base_id IS NOT NULL AND COALESCE(v_prod.factor_conversion, 1) > 1 THEN
                    -- Es una presentación comercial: se descuenta del producto base multiplicado por el factor
                    v_target_prod_id := v_prod.producto_base_id;
                    v_descuento_stock := v_cant * v_prod.factor_conversion;
                ELSE
                    v_target_prod_id := v_prod_id;
                    v_descuento_stock := v_cant;
                END IF;

                UPDATE productos
                SET stock_actual = stock_actual - v_descuento_stock,
                    actualizado_en = NOW()
                WHERE id = v_target_prod_id;
            END IF;
        ELSIF v_combo_id IS NOT NULL AND COALESCE(v_item->>'tipo_item', '') = 'combo' THEN
            -- Descontar componentes de combo si existe tabla de detalle de combos
            BEGIN
                FOR v_combo_item IN
                    SELECT producto_id, cantidad FROM detalle_combos WHERE combo_id = v_combo_id
                LOOP
                    UPDATE productos
                    SET stock_actual = stock_actual - (v_combo_item.cantidad * v_cant),
                        actualizado_en = NOW()
                    WHERE id = v_combo_item.producto_id;
                END LOOP;
            EXCEPTION WHEN undefined_table THEN
                NULL;
            END;
        END IF;
    END LOOP;

    RETURN jsonb_build_object(
        'venta_id', v_venta_id,
        'numero_factura', v_numero_factura,
        'ncf', v_ncf,
        'monto_total', COALESCE((p_payload->>'monto_total')::NUMERIC, 0)
    );
END;
$$;

-- Permisos de ejecución
GRANT EXECUTE ON FUNCTION public.procesar_venta_pos(JSONB) TO anon, authenticated;

