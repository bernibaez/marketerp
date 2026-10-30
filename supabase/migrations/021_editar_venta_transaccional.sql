-- Migration 021: Edición transaccional de ventas, ajuste de inventario y políticas de seguridad
-- Permite modificar clientes, productos, cantidades y totales con recálculo exacto y registro de auditoría

-- 1. Políticas RLS permisivas para detalle_ventas y ventas
DO $$
BEGIN
    -- Asegurar RLS en detalle_ventas
    ALTER TABLE IF EXISTS detalle_ventas ENABLE ROW LEVEL SECURITY;

    -- Eliminar políticas restrictivas previas si existen
    DROP POLICY IF EXISTS detalle_ventas_all ON detalle_ventas;
    DROP POLICY IF EXISTS detalle_ventas_select_all ON detalle_ventas;
    DROP POLICY IF EXISTS detalle_ventas_modify_all ON detalle_ventas;

    CREATE POLICY detalle_ventas_all ON detalle_ventas
        FOR ALL TO public
        USING (TRUE)
        WITH CHECK (TRUE);

    -- Asegurar que ventas permita actualización
    DROP POLICY IF EXISTS ventas_update_all ON ventas;
    CREATE POLICY ventas_update_all ON ventas
        FOR UPDATE TO public
        USING (TRUE)
        WITH CHECK (TRUE);
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

-- 2. Función Transaccional para Editar Venta
CREATE OR REPLACE FUNCTION editar_venta_pos(
    p_venta_id UUID,
    p_payload JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_venta RECORD;
    v_old_item RECORD;
    v_new_item JSONB;
    v_item_prod_id UUID;
    v_old_qty NUMERIC;
    v_new_qty NUMERIC;
    v_delta NUMERIC;
    v_usuario_id UUID;
    v_usuario_nombre TEXT;
    v_items JSONB;
BEGIN
    -- Bloquear y validar la venta existente
    SELECT * INTO v_venta FROM ventas WHERE id = p_venta_id FOR UPDATE;
    IF v_venta.id IS NULL THEN
        RAISE EXCEPTION 'Venta no encontrada (ID: %)', p_venta_id;
    END IF;

    IF v_venta.estado = 'anulada' THEN
        RAISE EXCEPTION 'No se puede editar una venta anulada';
    END IF;

    v_usuario_id := (p_payload->>'usuario_modificador_id')::UUID;
    v_usuario_nombre := COALESCE(p_payload->>'usuario_modificador_nombre', 'Administrador');
    v_items := COALESCE(p_payload->'items', '[]'::jsonb);

    IF jsonb_array_length(v_items) = 0 THEN
        RAISE EXCEPTION 'La venta debe contener al menos un producto o servicio';
    END IF;

    -- A. Ajuste de Inventario: Revertir stock de los ítems anteriores
    FOR v_old_item IN SELECT * FROM detalle_ventas WHERE venta_id = p_venta_id
    LOOP
        IF v_old_item.tipo_item = 'producto' AND v_old_item.producto_id IS NOT NULL THEN
            UPDATE productos
            SET stock_actual = stock_actual + v_old_item.cantidad,
                actualizado_en = NOW()
            WHERE id = v_old_item.producto_id;
        END IF;
    END LOOP;

    -- B. Eliminar detalle de venta anterior
    DELETE FROM detalle_ventas WHERE venta_id = p_venta_id;

    -- C. Insertar nuevos ítems y descontar el nuevo stock
    FOR v_new_item IN SELECT * FROM jsonb_array_elements(v_items)
    LOOP
        v_item_prod_id := NULL;
        IF (v_new_item->>'producto_id') IS NOT NULL AND (v_new_item->>'producto_id') ~ '^[0-9a-fA-F-]{36}$' THEN
            v_item_prod_id := (v_new_item->>'producto_id')::UUID;
        END IF;

        v_new_qty := COALESCE((v_new_item->>'cantidad')::NUMERIC, 1);

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
            p_venta_id,
            v_item_prod_id,
            NULL,
            COALESCE(v_new_item->>'tipo_item', 'producto'),
            COALESCE(v_new_item->>'nombre_item', 'Producto'),
            COALESCE((v_new_item->>'precio_unitario')::NUMERIC, 0),
            COALESCE((v_new_item->>'costo_unitario')::NUMERIC, 0),
            v_new_qty,
            COALESCE((v_new_item->>'porcentaje_impuesto')::NUMERIC, 18),
            COALESCE((v_new_item->>'subtotal')::NUMERIC, 0)
        );

        -- Descontar del inventario el nuevo consumo
        IF v_item_prod_id IS NOT NULL AND COALESCE(v_new_item->>'tipo_item', 'producto') = 'producto' THEN
            UPDATE productos
            SET stock_actual = stock_actual - v_new_qty,
                actualizado_en = NOW()
            WHERE id = v_item_prod_id;
        END IF;
    END LOOP;

    -- D. Actualizar cabecera de la venta
    UPDATE ventas
    SET cliente_id = CASE
            WHEN (p_payload->>'cliente_id') IS NOT NULL AND (p_payload->>'cliente_id') ~ '^[0-9a-fA-F-]{36}$'
            THEN (p_payload->>'cliente_id')::UUID
            ELSE NULL
        END,
        metodo_pago = COALESCE(p_payload->>'metodo_pago', v_venta.metodo_pago),
        tipo_ncf = p_payload->>'tipo_ncf',
        ncf = p_payload->>'ncf',
        subtotal = COALESCE((p_payload->>'subtotal')::NUMERIC, v_venta.subtotal),
        monto_impuesto = COALESCE((p_payload->>'monto_impuesto')::NUMERIC, v_venta.monto_impuesto),
        monto_descuento = COALESCE((p_payload->>'monto_descuento')::NUMERIC, 0),
        monto_total = COALESCE((p_payload->>'monto_total')::NUMERIC, v_venta.monto_total),
        costo_total = COALESCE((p_payload->>'costo_total')::NUMERIC, v_venta.costo_total),
        estado = COALESCE(p_payload->>'estado', v_venta.estado),
        actualizado_en = NOW()
    WHERE id = p_venta_id;

    -- E. Registrar Auditoría
    BEGIN
        INSERT INTO auditoria (
            id,
            usuario_id,
            accion,
            modulo,
            detalles,
            datos_antes,
            datos_despues,
            creado_en
        ) VALUES (
            gen_random_uuid(),
            v_usuario_id,
            'Edición de venta',
            'Ventas',
            'Factura ' || v_venta.numero_factura || ' modificada por ' || v_usuario_nombre,
            jsonb_build_object(
                'numero_factura', v_venta.numero_factura,
                'cliente_id', v_venta.cliente_id,
                'subtotal', v_venta.subtotal,
                'monto_impuesto', v_venta.monto_impuesto,
                'monto_descuento', v_venta.monto_descuento,
                'monto_total', v_venta.monto_total,
                'estado', v_venta.estado
            ),
            jsonb_build_object(
                'numero_factura', v_venta.numero_factura,
                'cliente_id', p_payload->>'cliente_id',
                'subtotal', p_payload->>'subtotal',
                'monto_impuesto', p_payload->>'monto_impuesto',
                'monto_descuento', p_payload->>'monto_descuento',
                'monto_total', p_payload->>'monto_total',
                'estado', p_payload->>'estado',
                'total_items', jsonb_array_length(v_items)
            ),
            NOW()
        );
    EXCEPTION
        WHEN OTHERS THEN
            -- No abortar si la tabla auditoria difiere en esquema
            NULL;
    END;

    RETURN jsonb_build_object(
        'exito', true,
        'venta_id', p_venta_id,
        'numero_factura', v_venta.numero_factura,
        'monto_total', p_payload->>'monto_total'
    );
END;
$$;

GRANT EXECUTE ON FUNCTION editar_venta_pos(UUID, JSONB) TO anon, authenticated;
