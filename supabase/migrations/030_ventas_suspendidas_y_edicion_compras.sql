-- ============================================================
-- 030_ventas_suspendidas_y_edicion_compras.sql
-- 1. Tabla ventas_suspendidas para sincronización multi-cajero y panel de administración
-- 2. Función RPC editar_compra_transaccional para revertir/aplicar inventario y registrar auditoría
-- ============================================================

-- 1. Tabla de ventas suspendidas
CREATE TABLE IF NOT EXISTS ventas_suspendidas (
    id TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    cart JSONB NOT NULL DEFAULT '[]'::jsonb,
    customer JSONB,
    global_discount NUMERIC(10, 2) DEFAULT 0,
    saved_at TIMESTAMPTZ DEFAULT NOW(),
    cashier_id UUID REFERENCES perfiles(id) ON DELETE SET NULL,
    cashier_name TEXT,
    caja_id TEXT,
    caja_label TEXT,
    total NUMERIC(12, 2) DEFAULT 0,
    creado_en TIMESTAMPTZ DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE IF EXISTS ventas_suspendidas ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    DROP POLICY IF EXISTS ventas_suspendidas_all ON ventas_suspendidas;
    CREATE POLICY ventas_suspendidas_all ON ventas_suspendidas
        FOR ALL TO public
        USING (TRUE)
        WITH CHECK (TRUE);
END $$;

GRANT ALL ON TABLE ventas_suspendidas TO anon, authenticated;

-- 2. Función Transaccional para Editar Facturas de Compra Registradas
CREATE OR REPLACE FUNCTION editar_compra_transaccional(
    p_compra_id UUID,
    p_payload JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_compra RECORD;
    v_old_item RECORD;
    v_new_item JSONB;
    v_new_items JSONB;
    v_item_prod_id UUID;
    v_new_qty NUMERIC(12, 3);
    v_costo NUMERIC(12, 2);
    v_venta NUMERIC(12, 2);
    v_subtotal NUMERIC(12, 2);
    v_impuesto NUMERIC(12, 2);
    v_total NUMERIC(12, 2);
    v_prov_id UUID := NULL;
    v_metodo_pago TEXT;
    v_notas TEXT;
    v_usuario_id UUID := NULL;
    v_usuario_nombre TEXT;
    v_audit_antes JSONB;
    v_audit_despues JSONB;
BEGIN
    -- A. Bloquear y verificar la compra
    SELECT * INTO v_compra FROM compras WHERE id = p_compra_id FOR UPDATE;
    IF v_compra.id IS NULL THEN
        RAISE EXCEPTION 'Compra no encontrada con ID %', p_compra_id;
    END IF;

    IF v_compra.estado = 'anulada' THEN
        RAISE EXCEPTION 'No se puede editar una compra anulada';
    END IF;

    v_new_items := COALESCE(p_payload->'lineas', '[]'::jsonb);
    IF jsonb_array_length(v_new_items) = 0 THEN
        RAISE EXCEPTION 'La compra debe contener al menos un renglón de producto';
    END IF;

    v_subtotal := COALESCE((p_payload->>'subtotal')::NUMERIC, 0);
    v_impuesto := COALESCE((p_payload->>'monto_impuesto')::NUMERIC, 0);
    v_total := COALESCE((p_payload->>'monto_total')::NUMERIC, v_subtotal + v_impuesto);
    v_metodo_pago := COALESCE(p_payload->>'metodo_pago', v_compra.metodo_pago);
    v_notas := p_payload->>'notas';

    IF (p_payload->>'proveedor_id') IS NOT NULL AND (p_payload->>'proveedor_id') ~ '^[0-9a-fA-F-]{36}$' THEN
        v_prov_id := (p_payload->>'proveedor_id')::UUID;
    END IF;

    IF (p_payload->>'usuario_modificador_id') IS NOT NULL AND (p_payload->>'usuario_modificador_id') ~ '^[0-9a-fA-F-]{36}$' THEN
        v_usuario_id := (p_payload->>'usuario_modificador_id')::UUID;
    END IF;
    v_usuario_nombre := COALESCE(p_payload->>'usuario_modificador_nombre', 'Administrador');

    -- Guardar estado previo para auditoría
    v_audit_antes := jsonb_build_object(
        'compra_id', v_compra.id,
        'codigo', v_compra.codigo,
        'proveedor_id', v_compra.proveedor_id,
        'subtotal', v_compra.subtotal,
        'monto_impuesto', v_compra.monto_impuesto,
        'monto_total', v_compra.monto_total,
        'metodo_pago', v_compra.metodo_pago
    );

    -- B. Revertir existencias de las líneas de compra originales
    FOR v_old_item IN SELECT * FROM detalle_compras WHERE compra_id = p_compra_id
    LOOP
        IF v_old_item.producto_id IS NOT NULL THEN
            UPDATE productos
            SET stock_actual = GREATEST(0, stock_actual - COALESCE(v_old_item.cantidad, 0)),
                actualizado_en = NOW()
            WHERE id = v_old_item.producto_id;
        END IF;
    END LOOP;

    -- C. Eliminar detalle previo de la compra
    DELETE FROM detalle_compras WHERE compra_id = p_compra_id;

    -- D. Insertar nuevos renglones y aplicar existencias y costos
    FOR v_new_item IN SELECT * FROM jsonb_array_elements(v_new_items)
    LOOP
        v_item_prod_id := NULL;
        IF (v_new_item->>'producto_id') IS NOT NULL AND (v_new_item->>'producto_id') ~ '^[0-9a-fA-F-]{36}$' THEN
            v_item_prod_id := (v_new_item->>'producto_id')::UUID;
        END IF;

        v_new_qty := COALESCE((v_new_item->>'cantidad')::NUMERIC, 0);
        v_costo := COALESCE((v_new_item->>'precio_costo')::NUMERIC, 0);
        v_venta := COALESCE((v_new_item->>'precio_venta')::NUMERIC, 0);

        INSERT INTO detalle_compras (
            id,
            compra_id,
            producto_id,
            nombre_item,
            cantidad,
            cantidad_recibida,
            precio_costo,
            precio_venta,
            porcentaje_impuesto,
            subtotal
        ) VALUES (
            gen_random_uuid(),
            p_compra_id,
            v_item_prod_id,
            COALESCE(v_new_item->>'nombre', 'Producto'),
            v_new_qty,
            v_new_qty,
            v_costo,
            v_venta,
            COALESCE((v_new_item->>'porcentaje_impuesto')::NUMERIC, 0),
            COALESCE((v_new_item->>'subtotal')::NUMERIC, v_new_qty * v_costo)
        );

        -- Aplicar nuevo stock y actualizar costo/venta si producto_id existe
        IF v_item_prod_id IS NOT NULL THEN
            UPDATE productos
            SET stock_actual = stock_actual + v_new_qty,
                precio_costo = CASE WHEN v_costo > 0 THEN v_costo ELSE precio_costo END,
                precio_venta = CASE WHEN v_venta > 0 THEN v_venta ELSE precio_venta END,
                actualizado_en = NOW()
            WHERE id = v_item_prod_id;
        END IF;
    END LOOP;

    -- E. Actualizar cabecera de compra
    UPDATE compras
    SET subtotal = v_subtotal,
        monto_impuesto = v_impuesto,
        monto_total = v_total,
        proveedor_id = COALESCE(v_prov_id, v_compra.proveedor_id),
        metodo_pago = v_metodo_pago,
        notas = COALESCE(v_notas, v_compra.notas),
        actualizado_en = NOW()
    WHERE id = p_compra_id;

    -- F. Registro de Auditoría
    v_audit_despues := jsonb_build_object(
        'compra_id', p_compra_id,
        'codigo', v_compra.codigo,
        'proveedor_id', COALESCE(v_prov_id, v_compra.proveedor_id),
        'subtotal', v_subtotal,
        'monto_impuesto', v_impuesto,
        'monto_total', v_total,
        'metodo_pago', v_metodo_pago,
        'total_lineas', jsonb_array_length(v_new_items)
    );

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
            'Edición de compra',
            'Compras',
            'Factura de compra ' || v_compra.codigo || ' modificada por ' || v_usuario_nombre,
            v_audit_antes,
            v_audit_despues,
            NOW()
        );
    EXCEPTION
        WHEN OTHERS THEN
            NULL;
    END;

    RETURN jsonb_build_object(
        'ok', true,
        'id', p_compra_id,
        'codigo', v_compra.codigo,
        'subtotal', v_subtotal,
        'monto_impuesto', v_impuesto,
        'monto_total', v_total,
        'lineas', jsonb_array_length(v_new_items)
    );
END;
$$;

