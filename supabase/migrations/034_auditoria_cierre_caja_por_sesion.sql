-- ============================================================================
-- MIGRACIÓN 034: Auditoría Integral y Aislamiento Transaccional de Cierre de Caja
-- ============================================================================
-- Objetivo:
--   1. Vincular ventas, gastos y devoluciones con cada sesión mediante cierre_id.
--   2. Garantizar una única fuente de cálculo transaccional en PostgreSQL
--      (cerrar_caja_transaccional) filtrada exclusivamente por cierre_id (UUID)
--      y serializada con bloqueos FOR UPDATE para evitar cierres duplicados o
--      condiciones de carrera en solicitudes simultáneas.
--   3. Corregir iniciar_caja_transaccional para que NUNCA cierre sesiones
--      activas de otros cajeros ni sesiones del mismo cajero en otras cajas.
--   4. Preservar al 100% los registros históricos existentes (aditiva, idempotente,
--      sin borrar ni modificar importes de cierres o ventas previos).
--
-- Reversibilidad / Rollback (no destructivo):
--   -- DROP INDEX IF EXISTS public.idx_ventas_cierre_id;
--   -- DROP INDEX IF EXISTS public.idx_ventas_caja_creado;
--   -- DROP INDEX IF EXISTS public.idx_movimientos_caja_cierre_id;
--   -- DROP INDEX IF EXISTS public.idx_cierres_caja_abierta_lookup;
--   -- ALTER TABLE IF EXISTS public.ventas DROP COLUMN IF EXISTS cierre_id;
--   -- ALTER TABLE IF EXISTS public.gastos DROP COLUMN IF EXISTS cierre_id;
--   -- ALTER TABLE IF EXISTS public.devoluciones DROP COLUMN IF EXISTS cierre_id;
--   -- ALTER TABLE IF EXISTS public.devoluciones DROP COLUMN IF EXISTS caja_id;
--   -- ALTER TABLE IF EXISTS public.cierres_caja DROP COLUMN IF EXISTS usuario_cierre_id;
--   -- ALTER TABLE IF EXISTS public.cierres_caja DROP COLUMN IF EXISTS usuario_cierre_nombre;
--   -- Y restaurar las funciones de 033/032/025 si fuese necesario.
-- ============================================================================

-- 1. Columnas aditivas para trazabilidad estricta por sesión (cierre_id)
ALTER TABLE IF EXISTS public.ventas
    ADD COLUMN IF NOT EXISTS cierre_id VARCHAR(100);

ALTER TABLE IF EXISTS public.gastos
    ADD COLUMN IF NOT EXISTS cierre_id VARCHAR(100);

-- Flexibilizar caja_id en gastos si aún tenía FK rígida hacia cajas UUID
ALTER TABLE IF EXISTS public.gastos
    DROP CONSTRAINT IF EXISTS gastos_caja_id_fkey;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'gastos'
          AND column_name = 'caja_id'
          AND data_type = 'uuid'
    ) THEN
        ALTER TABLE public.gastos ALTER COLUMN caja_id TYPE VARCHAR(100) USING caja_id::TEXT;
    END IF;
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

ALTER TABLE IF EXISTS public.devoluciones
    ADD COLUMN IF NOT EXISTS caja_id VARCHAR(100);

ALTER TABLE IF EXISTS public.devoluciones
    ADD COLUMN IF NOT EXISTS cierre_id VARCHAR(100);

ALTER TABLE IF EXISTS public.cierres_caja
    ADD COLUMN IF NOT EXISTS usuario_cierre_id VARCHAR(100);

ALTER TABLE IF EXISTS public.cierres_caja
    ADD COLUMN IF NOT EXISTS usuario_cierre_nombre TEXT;

-- 2. Índices de rendimiento y unicidad no destructiva para consultas por sesión
CREATE INDEX IF NOT EXISTS idx_ventas_cierre_id
    ON public.ventas(cierre_id);

CREATE INDEX IF NOT EXISTS idx_ventas_caja_creado
    ON public.ventas(caja_id, creado_en DESC);

CREATE INDEX IF NOT EXISTS idx_movimientos_caja_cierre_id
    ON public.movimientos_caja(cierre_id);

CREATE INDEX IF NOT EXISTS idx_cierres_caja_abierta_lookup
    ON public.cierres_caja(caja_id, abierta_en DESC)
    WHERE estado = 'abierta';

-- 3. Actualizar procesar_venta_pos para persistir cierre_id vinculando cada venta al turno
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
    v_stock_prev NUMERIC;
    v_caja_id TEXT;
    v_cajero_id UUID;
    v_cierre_id TEXT;
BEGIN
    v_tipo_ncf := NULLIF(TRIM(p_payload->>'tipo_ncf'), '');
    v_caja_id := NULLIF(TRIM(p_payload->>'caja_id'), '');
    v_cajero_id := CASE
        WHEN NULLIF(TRIM(p_payload->>'cajero_id'), '') ~* '^[0-9a-f-]{36}$'
        THEN TRIM(p_payload->>'cajero_id')::UUID
        ELSE auth.uid()
    END;
    v_cierre_id := NULLIF(TRIM(p_payload->>'cierre_id'), '');

    -- Respaldo seguro en rollout gradual: si el cliente POS envió caja_id sin cierre_id,
    -- vincular únicamente con la sesión actualmente abierta de ESA misma caja.
    IF v_cierre_id IS NULL AND v_caja_id IS NOT NULL THEN
        SELECT id::TEXT
        INTO v_cierre_id
        FROM public.cierres_caja
        WHERE estado = 'abierta'
          AND (
              caja_id = v_caja_id
              OR caja_id IN (
                  SELECT id::TEXT FROM public.cajas WHERE id::TEXT = v_caja_id OR codigo = v_caja_id
              )
          )
          AND (
              v_cajero_id IS NULL
              OR cajero_id IS NULL
              OR cajero_id = v_cajero_id::TEXT
          )
        ORDER BY abierta_en DESC
        LIMIT 1;
    END IF;

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

    -- Insertar venta con cierre_id
    INSERT INTO ventas (
        id,
        numero_factura,
        ncf,
        tipo_ncf,
        sucursal_id,
        cajero_id,
        cliente_id,
        caja_id,
        cierre_id,
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
        v_cajero_id,
        NULLIF(p_payload->>'cliente_id', '')::UUID,
        v_caja_id,
        v_cierre_id,
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

        IF v_prod_id IS NOT NULL AND COALESCE(v_item->>'tipo_item', 'producto') = 'producto' THEN
            SELECT id, producto_base_id, factor_conversion, stock_actual, es_pesado, sale_type, nombre
            INTO v_prod
            FROM productos
            WHERE id = v_prod_id;

            IF FOUND THEN
                v_stock_prev := COALESCE(v_prod.stock_actual, 0);

                IF v_prod.es_pesado = TRUE OR v_prod.sale_type = 'weight' THEN
                    IF v_prod.producto_base_id IS NOT NULL THEN
                        v_target_prod_id := v_prod.producto_base_id;
                        SELECT stock_actual INTO v_stock_prev FROM productos WHERE id = v_target_prod_id;
                    ELSE
                        v_target_prod_id := v_prod_id;
                    END IF;
                    v_descuento_stock := v_cant;
                ELSIF v_prod.producto_base_id IS NOT NULL AND COALESCE(v_prod.factor_conversion, 1) > 1 THEN
                    v_target_prod_id := v_prod.producto_base_id;
                    v_descuento_stock := v_cant * v_prod.factor_conversion;
                    SELECT stock_actual INTO v_stock_prev FROM productos WHERE id = v_target_prod_id;
                ELSE
                    v_target_prod_id := v_prod_id;
                    v_descuento_stock := v_cant;
                END IF;

                UPDATE productos
                SET stock_actual = stock_actual - v_descuento_stock,
                    actualizado_en = NOW()
                WHERE id = v_target_prod_id;

                INSERT INTO movimientos_inventario (
                    producto_id,
                    tipo_movimiento,
                    cantidad_entrada,
                    cantidad_salida,
                    stock_anterior,
                    stock_resultante,
                    documento_referencia,
                    motivo,
                    creado_en
                ) VALUES (
                    v_target_prod_id,
                    'Venta',
                    0,
                    v_descuento_stock,
                    v_stock_prev,
                    v_stock_prev - v_descuento_stock,
                    v_numero_factura,
                    'Venta POS ' || v_numero_factura,
                    NOW()
                );
            END IF;
        ELSIF v_combo_id IS NOT NULL AND COALESCE(v_item->>'tipo_item', '') = 'combo' THEN
            BEGIN
                FOR v_combo_item IN
                    SELECT product_id, qty FROM combo_items WHERE combo_id = v_combo_id
                LOOP
                    SELECT stock_actual INTO v_stock_prev FROM productos WHERE id = v_combo_item.product_id;
                    v_descuento_stock := v_combo_item.qty * v_cant;

                    UPDATE productos
                    SET stock_actual = stock_actual - v_descuento_stock,
                        actualizado_en = NOW()
                    WHERE id = v_combo_item.product_id;

                    INSERT INTO movimientos_inventario (
                        producto_id,
                        tipo_movimiento,
                        cantidad_entrada,
                        cantidad_salida,
                        stock_anterior,
                        stock_resultante,
                        documento_referencia,
                        motivo,
                        creado_en
                    ) VALUES (
                        v_combo_item.product_id,
                        'Venta',
                        0,
                        v_descuento_stock,
                        COALESCE(v_stock_prev, 0),
                        COALESCE(v_stock_prev, 0) - v_descuento_stock,
                        v_numero_factura,
                        'Componente combo en Factura ' || v_numero_factura,
                        NOW()
                    );
                END LOOP;
            EXCEPTION WHEN undefined_table THEN
                NULL;
            END;
        END IF;
    END LOOP;

    RETURN jsonb_build_object(
        'venta_id', v_venta_id,
        'cierre_id', v_cierre_id,
        'numero_factura', v_numero_factura,
        'ncf', v_ncf,
        'monto_total', COALESCE((p_payload->>'monto_total')::NUMERIC, 0)
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.procesar_venta_pos(JSONB) TO anon, authenticated;

-- 4. Corregir iniciar_caja_transaccional:
--    - Nunca cierra sesiones abiertas de otras cajas del mismo cajero.
--    - Nunca cierra sesiones abiertas de otros cajeros en la misma caja.
--    - Serializa aperturas por caja con bloqueo transaccional.
CREATE OR REPLACE FUNCTION public.iniciar_caja_transaccional(
    p_caja_id VARCHAR(100),
    p_caja_label TEXT,
    p_cajero_id VARCHAR(100),
    p_cajero_nombre TEXT,
    p_cajero_username TEXT,
    p_monto_apertura NUMERIC,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caja_canon TEXT;
    v_caja_codigo TEXT;
    v_caja_nombre TEXT;
    v_search_ids TEXT[];
    v_existente RECORD;
    v_es_mismo_usuario BOOLEAN := FALSE;
    v_codigo TEXT;
    v_nuevo_id UUID;
    v_now TIMESTAMPTZ := NOW();
BEGIN
    v_caja_canon := COALESCE(NULLIF(TRIM(p_caja_id), ''), '1');

    -- Resolver alias de caja en public.cajas (id / codigo / nombre) sin cruzar cajas distintas
    SELECT id::TEXT, codigo, nombre
    INTO v_caja_canon, v_caja_codigo, v_caja_nombre
    FROM public.cajas
    WHERE id::TEXT = v_caja_canon
       OR codigo = v_caja_canon
       OR LOWER(TRIM(nombre)) = LOWER(TRIM(v_caja_canon))
    LIMIT 1;

    v_caja_canon := COALESCE(v_caja_canon, NULLIF(TRIM(p_caja_id), ''), '1');
    v_search_ids := ARRAY[v_caja_canon];
    IF p_caja_id IS NOT NULL AND TRIM(p_caja_id) <> '' AND NOT (TRIM(p_caja_id) = ANY(v_search_ids)) THEN
        v_search_ids := array_append(v_search_ids, TRIM(p_caja_id));
    END IF;
    IF v_caja_codigo IS NOT NULL AND NOT (v_caja_codigo = ANY(v_search_ids)) THEN
        v_search_ids := array_append(v_search_ids, v_caja_codigo);
    END IF;

    -- Lock transaccional exclusivamente para ESTA caja registradora
    PERFORM pg_advisory_xact_lock(hashtext('mercato_caja_lock:' || v_caja_canon));

    -- Buscar si existe un turno abierto activo en ESTA caja específica
    SELECT *
    INTO v_existente
    FROM public.cierres_caja
    WHERE estado = 'abierta'
      AND caja_id = ANY(v_search_ids)
    ORDER BY abierta_en DESC
    LIMIT 1
    FOR UPDATE;

    IF FOUND THEN
        v_es_mismo_usuario := (
            v_existente.cajero_id IS NOT NULL
            AND TRIM(COALESCE(p_cajero_id, '')) <> ''
            AND TRIM(v_existente.cajero_id) = TRIM(p_cajero_id)
        ) OR (
            (v_existente.cajero_id IS NULL OR TRIM(v_existente.cajero_id) = '' OR TRIM(COALESCE(p_cajero_id, '')) = '')
            AND TRIM(COALESCE(v_existente.cajero_nombre, '')) <> ''
            AND LOWER(TRIM(v_existente.cajero_nombre)) = LOWER(TRIM(COALESCE(p_cajero_nombre, '')))
        );

        IF NOT v_es_mismo_usuario THEN
            RETURN jsonb_build_object(
                'ok', false,
                'error', format(
                    'Esta caja ya se encuentra en uso por %s. Debe cerrar el turno actual antes de iniciar uno nuevo.',
                    COALESCE(NULLIF(TRIM(v_existente.cajero_nombre), ''), 'otro cajero')
                ),
                'cierre', to_jsonb(v_existente)
            );
        END IF;

        -- Si ya pertenece al mismo usuario en esta misma caja, devolver la sesión abierta activa
        -- sin alterar su monto de apertura ni crear sesiones duplicadas.
        RETURN jsonb_build_object(
            'ok', true,
            'reused', true,
            'cierre', to_jsonb(v_existente)
        );
    END IF;

    -- Crear nueva sesión abierta limpia exclusivamente para esta caja y usuario
    v_nuevo_id := gen_random_uuid();
    v_codigo := 'CC-' || to_char(v_now, 'YYMMDD') || '-' || upper(substring(replace(v_nuevo_id::TEXT, '-', '') from 1 for 6));

    INSERT INTO public.cierres_caja (
        id,
        codigo,
        caja_id,
        caja_label,
        cajero_id,
        cajero_nombre,
        cajero_username,
        monto_apertura,
        monto_esperado,
        monto_real,
        monto_diferencia,
        total_ventas,
        total_efectivo,
        total_tarjeta,
        total_transferencia,
        total_otros,
        total_entradas,
        total_retiros,
        total_devoluciones,
        estado,
        notes,
        abierta_en
    ) VALUES (
        v_nuevo_id,
        v_codigo,
        v_caja_canon,
        COALESCE(NULLIF(TRIM(p_caja_label), ''), v_caja_nombre, 'Caja #' || v_caja_canon),
        NULLIF(TRIM(p_cajero_id), ''),
        NULLIF(TRIM(p_cajero_nombre), ''),
        NULLIF(TRIM(p_cajero_username), ''),
        ROUND(COALESCE(p_monto_apertura, 0)::numeric, 2),
        ROUND(COALESCE(p_monto_apertura, 0)::numeric, 2),
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        'abierta',
        p_notes,
        v_now
    );

    SELECT * INTO v_existente FROM public.cierres_caja WHERE id = v_nuevo_id;

    RETURN jsonb_build_object(
        'ok', true,
        'reused', false,
        'cierre', to_jsonb(v_existente)
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.iniciar_caja_transaccional(VARCHAR, TEXT, VARCHAR, TEXT, TEXT, NUMERIC, TEXT) TO anon, authenticated;

-- 5. Único cálculo y cierre transaccional en PostgreSQL (estricto por cierre_id):
--    - Nunca busca por coincidencia de nombre de cajero ni en otras cajas.
--    - Bloquea la fila con FOR UPDATE para impedir cierres concurrentes o repetidos.
--    - Calcula totales exclusivamente sobre ventas no anuladas y movimientos de ESTE cierre_id.
--    - Fórmula de efectivo esperado:
--        monto_apertura + ventas netas efectivo + entradas - retiros/gastos efectivo - devoluciones efectivo
CREATE OR REPLACE FUNCTION public.cerrar_caja_transaccional(
    p_cierre_id TEXT,
    p_caja_id VARCHAR(100),
    p_cajero_id VARCHAR(100) DEFAULT NULL,
    p_cajero_nombre TEXT DEFAULT NULL,
    p_monto_real NUMERIC DEFAULT 0,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_cierre RECORD;
    v_cierre_uuid UUID;
    v_ventas_efectivo NUMERIC(12, 2) := 0;
    v_ventas_tarjeta NUMERIC(12, 2) := 0;
    v_ventas_transferencia NUMERIC(12, 2) := 0;
    v_ventas_credito NUMERIC(12, 2) := 0;
    v_ventas_total NUMERIC(12, 2) := 0;
    v_entradas NUMERIC(12, 2) := 0;
    v_retiros NUMERIC(12, 2) := 0;
    v_devoluciones NUMERIC(12, 2) := 0;
    v_monto_esperado NUMERIC(12, 2) := 0;
    v_monto_real NUMERIC(12, 2) := 0;
    v_monto_diferencia NUMERIC(12, 2) := 0;
    v_now TIMESTAMPTZ := NOW();
BEGIN
    IF p_cierre_id IS NULL OR TRIM(p_cierre_id) = '' OR TRIM(p_cierre_id) !~* '^[0-9a-f-]{36}$' THEN
        RETURN jsonb_build_object(
            'ok', false,
            'error', 'Se requiere un identificador único (cierre_id) válido para cerrar el turno de caja.'
        );
    END IF;

    v_cierre_uuid := TRIM(p_cierre_id)::UUID;

    -- Bloqueo exclusivo de fila sobre la sesión exacta identificada por su UUID
    SELECT *
    INTO v_cierre
    FROM public.cierres_caja
    WHERE id = v_cierre_uuid
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'ok', false,
            'error', 'No se encontró la sesión de caja solicitada.'
        );
    END IF;

    IF LOWER(COALESCE(v_cierre.estado, '')) = 'cerrada' THEN
        RETURN jsonb_build_object(
            'ok', false,
            'error', 'Este turno de caja ya fue cerrado previamente.',
            'cierre', to_jsonb(v_cierre)
        );
    END IF;

    -- 1. Sumar ventas no anuladas vinculadas estrictamente a esta sesión (cierre_id).
    --    Compatibilidad legacy: solo si la venta aún tiene cierre_id IS NULL (anterior a migración 034),
    --    exige coincidencia exacta de caja_id, fecha >= abierta_en (sin ventana retroactiva)
    --    y no pertenecer a otro turno posterior de esa caja.
    --    Efectivo neto descuenta exceso/devuelta solo si monto_efectivo viniera bruto sobre total.
    SELECT
        COALESCE(ROUND(SUM(
            GREATEST(
                0,
                COALESCE(monto_efectivo, 0) - LEAST(
                    GREATEST(0, COALESCE(devuelta_entregada, 0)),
                    GREATEST(
                        0,
                        (COALESCE(monto_efectivo, 0) + COALESCE(monto_tarjeta, 0) + COALESCE(monto_transferencia, 0) + COALESCE(monto_credito, 0))
                        - COALESCE(monto_total, 0)
                    )
                )
            )
        )::numeric, 2), 0),
        COALESCE(ROUND(SUM(COALESCE(monto_tarjeta, 0))::numeric, 2), 0),
        COALESCE(ROUND(SUM(COALESCE(monto_transferencia, 0))::numeric, 2), 0),
        COALESCE(ROUND(SUM(COALESCE(monto_credito, 0))::numeric, 2), 0),
        COALESCE(ROUND(SUM(COALESCE(monto_total, 0))::numeric, 2), 0)
    INTO
        v_ventas_efectivo,
        v_ventas_tarjeta,
        v_ventas_transferencia,
        v_ventas_credito,
        v_ventas_total
    FROM public.ventas v
    WHERE LOWER(COALESCE(v.estado, '')) <> 'anulada'
      AND (
          v.cierre_id = v_cierre.id::TEXT
          OR (
              v.cierre_id IS NULL
              AND v_cierre.caja_id IS NOT NULL
              AND v.caja_id = v_cierre.caja_id
              AND (v_cierre.cajero_id IS NULL OR v.cajero_id IS NULL OR v.cajero_id::TEXT = v_cierre.cajero_id)
              AND v.creado_en >= v_cierre.abierta_en
              AND NOT EXISTS (
                  SELECT 1
                  FROM public.cierres_caja otro
                  WHERE otro.id <> v_cierre.id
                    AND otro.caja_id = v_cierre.caja_id
                    AND otro.abierta_en > v_cierre.abierta_en
                    AND otro.abierta_en <= v.creado_en
              )
          )
      );

    -- 2. Sumar movimientos de caja exclusivos de esta sesión (cierre_id)
    SELECT
        COALESCE(ROUND(SUM(CASE WHEN tipo IN ('entrada', 'aporte') THEN COALESCE(monto, 0) ELSE 0 END)::numeric, 2), 0),
        COALESCE(ROUND(SUM(
            CASE WHEN tipo IN ('salida', 'retiro', 'gasto')
                  AND NOT (
                      tipo IN ('salida', 'retiro')
                      AND (
                          LOWER(COALESCE(categoria, '')) LIKE '%devoluci%'
                          OR LOWER(COALESCE(concepto, '')) LIKE '%devoluci%'
                      )
                  )
            THEN COALESCE(monto, 0) ELSE 0 END
        )::numeric, 2), 0),
        COALESCE(ROUND(SUM(
            CASE WHEN tipo IN ('salida', 'retiro')
                  AND (
                      LOWER(COALESCE(categoria, '')) LIKE '%devoluci%'
                      OR LOWER(COALESCE(concepto, '')) LIKE '%devoluci%'
                  )
            THEN COALESCE(monto, 0) ELSE 0 END
        )::numeric, 2), 0)
    INTO
        v_entradas,
        v_retiros,
        v_devoluciones
    FROM public.movimientos_caja m
    WHERE m.cierre_id = v_cierre.id::TEXT
       OR (
           m.cierre_id IS NULL
           AND v_cierre.caja_id IS NOT NULL
           AND m.caja_id = v_cierre.caja_id
           AND (v_cierre.cajero_id IS NULL OR m.cajero_id IS NULL OR m.cajero_id = v_cierre.cajero_id)
           AND m.creado_en >= v_cierre.abierta_en
           AND NOT EXISTS (
               SELECT 1
               FROM public.cierres_caja otro
               WHERE otro.id <> v_cierre.id
                 AND otro.caja_id = v_cierre.caja_id
                 AND otro.abierta_en > v_cierre.abierta_en
                 AND otro.abierta_en <= m.creado_en
           )
       );

    -- 3. Fórmula contable única en servidor:
    --    Fondo inicial + ventas netas en efectivo + entradas - retiros/gastos en efectivo - devoluciones en efectivo
    v_monto_esperado := ROUND(
        (COALESCE(v_cierre.monto_apertura, 0) + v_ventas_efectivo + v_entradas - v_retiros - v_devoluciones)::numeric,
        2
    );
    v_monto_real := ROUND(COALESCE(p_monto_real, 0)::numeric, 2);
    v_monto_diferencia := ROUND((v_monto_real - v_monto_esperado)::numeric, 2);

    -- 4. Persistir cierre definitivo exclusivamente sobre este v_cierre.id
    UPDATE public.cierres_caja
    SET
        estado = 'cerrada',
        monto_esperado = v_monto_esperado,
        monto_real = v_monto_real,
        monto_diferencia = v_monto_diferencia,
        total_ventas = v_ventas_total,
        total_efectivo = v_ventas_efectivo,
        total_tarjeta = v_ventas_tarjeta,
        total_transferencia = v_ventas_transferencia,
        total_otros = v_ventas_credito,
        total_entradas = v_entradas,
        total_retiros = v_retiros,
        total_devoluciones = v_devoluciones,
        usuario_cierre_id = COALESCE(NULLIF(TRIM(p_cajero_id), ''), usuario_cierre_id),
        usuario_cierre_nombre = COALESCE(NULLIF(TRIM(p_cajero_nombre), ''), usuario_cierre_nombre),
        notes = COALESCE(NULLIF(TRIM(p_notes), ''), notes),
        cerrada_en = v_now
    WHERE id = v_cierre.id
      AND estado = 'abierta';

    SELECT * INTO v_cierre FROM public.cierres_caja WHERE id = v_cierre.id;

    RETURN jsonb_build_object(
        'ok', true,
        'cierre', to_jsonb(v_cierre)
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.cerrar_caja_transaccional(TEXT, VARCHAR, VARCHAR, TEXT, NUMERIC, TEXT) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
