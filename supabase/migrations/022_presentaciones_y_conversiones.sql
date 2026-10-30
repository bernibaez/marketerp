-- Migration 022: Sistema de Unidades de Medida, Presentaciones Comerciales y Conversión Automática de Inventario
-- Corrige el error de "Fardo de agua agotado" y habilita ventas/compras por presentaciones (Fardo, Cartón, etc.)

-- 1. Agregar columnas a productos para enlace de unidad base y factor de conversión
ALTER TABLE productos
    ADD COLUMN IF NOT EXISTS producto_base_id UUID REFERENCES productos(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS factor_conversion NUMERIC(12, 4) DEFAULT 1,
    ADD COLUMN IF NOT EXISTS unidad_base TEXT DEFAULT 'unidad';

CREATE INDEX IF NOT EXISTS idx_productos_base_id ON productos(producto_base_id);

-- 2. Tabla de Presentaciones Comerciales de Productos
CREATE TABLE IF NOT EXISTS presentaciones_producto (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    producto_base_id UUID NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
    nombre_presentacion TEXT NOT NULL,
    codigo_barras VARCHAR(50),
    sku VARCHAR(50),
    factor_conversion NUMERIC(12, 4) NOT NULL DEFAULT 1,
    precio_venta NUMERIC(12, 2) NOT NULL,
    precio_costo NUMERIC(12, 2) DEFAULT 0,
    precio_mayorista NUMERIC(12, 2) DEFAULT 0,
    unidad_medida VARCHAR(30) DEFAULT 'unidad',
    es_principal BOOLEAN DEFAULT false,
    activo BOOLEAN DEFAULT true,
    creado_en TIMESTAMPTZ DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_presentaciones_base_id ON presentaciones_producto(producto_base_id);
CREATE INDEX IF NOT EXISTS idx_presentaciones_barcode ON presentaciones_producto(codigo_barras);
CREATE INDEX IF NOT EXISTS idx_presentaciones_sku ON presentaciones_producto(sku);

-- RLS permisivo
ALTER TABLE presentaciones_producto ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS presentaciones_all ON presentaciones_producto;
CREATE POLICY presentaciones_all ON presentaciones_producto
    FOR ALL TO public
    USING (TRUE)
    WITH CHECK (TRUE);

-- 3. Vinculación de Productos Existentes (Fardos de agua y Cartones de huevos)
-- Fardo De Agua Pureza Sana (factor 20x sobre Botella De Agua Pureza Sana)
UPDATE productos
SET producto_base_id = '81e6bc06-de76-4ff5-8ada-50fa961ef542',
    factor_conversion = 20,
    unidad = 'Fardo (20 unidades)',
    unidad_base = 'Botella'
WHERE id = '41c371f0-399c-41f6-a640-ad832facc387';

UPDATE productos
SET unidad = 'Botella',
    unidad_base = 'Botella'
WHERE id = '81e6bc06-de76-4ff5-8ada-50fa961ef542';

-- Huevos 1 Cartón (factor 2x sobre Medio Cartón)
UPDATE productos
SET producto_base_id = '08fa89bf-4252-41ee-9bb4-4261eb856a15',
    factor_conversion = 2,
    unidad = 'Cartón (2 medios cartones)',
    unidad_base = 'Medio cartón'
WHERE id = 'e87529e3-fca5-4b3c-bc7c-05cd5407b38d';

UPDATE productos
SET unidad = 'Medio cartón',
    unidad_base = 'Medio cartón'
WHERE id = '08fa89bf-4252-41ee-9bb4-4261eb856a15';

-- Huevo 1 carton (0875) sobre Huevo Medio Carton (0874)
UPDATE productos
SET producto_base_id = '05241bcd-43a5-4c4c-821d-acabdb827566',
    factor_conversion = 2,
    unidad = 'Cartón (2 medios cartones)',
    unidad_base = 'Medio cartón'
WHERE id = '36b5a271-dbcc-40b4-b6c7-e5c4c192de1a';

UPDATE productos
SET unidad = 'Medio cartón',
    unidad_base = 'Medio cartón'
WHERE id = '05241bcd-43a5-4c4c-821d-acabdb827566';

-- Sembrar registros en presentaciones_producto
INSERT INTO presentaciones_producto (
    id, producto_base_id, nombre_presentacion, codigo_barras, sku, factor_conversion, precio_venta, precio_costo, unidad_medida, es_principal
) VALUES
(
    'a0000001-0000-0000-0000-000000000001',
    '81e6bc06-de76-4ff5-8ada-50fa961ef542',
    'Fardo De Agua Pureza Sana',
    '23653',
    '23653',
    20,
    125.00,
    107.14,
    'Fardo',
    false
),
(
    'a0000001-0000-0000-0000-000000000002',
    '08fa89bf-4252-41ee-9bb4-4261eb856a15',
    'HUEVOS 1 CARTON',
    '0686',
    '0686',
    2,
    205.00,
    170.00,
    'Cartón',
    false
),
(
    'a0000001-0000-0000-0000-000000000003',
    '05241bcd-43a5-4c4c-821d-acabdb827566',
    'Huevo 1 carton',
    '0875',
    '0875',
    2,
    210.00,
    175.00,
    'Cartón',
    false
)
ON CONFLICT (id) DO NOTHING;

-- 4. Actualizar procesar_venta_pos para descontar automáticamente del producto base
CREATE OR REPLACE FUNCTION procesar_venta_pos(p_payload JSONB)
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
    v_target_prod_id UUID;
    v_factor NUMERIC;
    v_descuento_stock NUMERIC;
    v_cant NUMERIC;
BEGIN
    v_tipo_ncf := p_payload->>'tipo_ncf';

    -- Generar NCF si corresponde
    IF v_tipo_ncf IS NOT NULL AND v_tipo_ncf <> '' THEN
        SELECT id, secuencia_actual + 1, serie || lpad((secuencia_actual + 1)::TEXT, 8, '0')
        INTO v_rango_id, v_ncf, v_ncf
        FROM rangos_ncf
        WHERE tipo_ncf = v_tipo_ncf AND activo = TRUE AND fecha_vencimiento >= CURRENT_DATE
        FOR UPDATE;

        IF v_rango_id IS NOT NULL THEN
            UPDATE rangos_ncf SET secuencia_actual = secuencia_actual + 1 WHERE id = v_rango_id;
            SELECT serie || lpad(secuencia_actual::TEXT, 8, '0') INTO v_ncf FROM rangos_ncf WHERE id = v_rango_id;
        END IF;
    END IF;

    -- Número de factura interno
    v_numero_factura := COALESCE(
        p_payload->>'numero_factura',
        'FAC-' || to_char(NOW(), 'YYYYMMDD') || '-' || upper(substring(replace(v_venta_id::TEXT, '-', '') from 1 for 8))
    );

    -- Insertar venta
    INSERT INTO ventas (
        id,
        numero_factura,
        ncf,
        tipo_ncf,
        sucursal_id,
        cajero_id,
        cliente_id,
        metodo_pago,
        subtotal,
        monto_impuesto,
        monto_descuento,
        monto_total,
        costo_total,
        estado,
        creado_en
    ) VALUES (
        v_venta_id,
        v_numero_factura,
        v_ncf,
        v_tipo_ncf,
        (p_payload->>'sucursal_id')::UUID,
        (p_payload->>'cajero_id')::UUID,
        (p_payload->>'cliente_id')::UUID,
        COALESCE(p_payload->>'metodo_pago', 'efectivo'),
        (p_payload->>'subtotal')::NUMERIC,
        (p_payload->>'monto_impuesto')::NUMERIC,
        COALESCE((p_payload->>'monto_descuento')::NUMERIC, 0),
        (p_payload->>'monto_total')::NUMERIC,
        COALESCE((p_payload->>'costo_total')::NUMERIC, 0),
        'completada',
        NOW()
    );

    -- Procesar cada ítem del carrito
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_payload->'items')
    LOOP
        v_prod_id := NULL;
        IF (v_item->>'producto_id') IS NOT NULL AND (v_item->>'producto_id') ~ '^[0-9a-fA-F-]{36}$' THEN
            v_prod_id := (v_item->>'producto_id')::UUID;
        END IF;

        v_cant := (v_item->>'cantidad')::NUMERIC;

        -- Registrar detalle en la factura con el nombre y precio de la presentación vendida
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
            NULL,
            COALESCE(v_item->>'tipo_item', 'producto'),
            v_item->>'nombre_item',
            (v_item->>'precio_unitario')::NUMERIC,
            COALESCE((v_item->>'costo_unitario')::NUMERIC, 0),
            v_cant,
            COALESCE((v_item->>'porcentaje_impuesto')::NUMERIC, 18),
            (v_item->>'subtotal')::NUMERIC
        );

        -- Descontar inventario considerando presentación y unidad base
        IF v_prod_id IS NOT NULL AND COALESCE(v_item->>'tipo_item', 'producto') = 'producto' THEN
            SELECT id, producto_base_id, factor_conversion
            INTO v_prod
            FROM productos
            WHERE id = v_prod_id;

            IF v_prod.producto_base_id IS NOT NULL AND v_prod.factor_conversion > 1 THEN
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
    END LOOP;

    RETURN jsonb_build_object(
        'venta_id', v_venta_id,
        'numero_factura', v_numero_factura,
        'ncf', v_ncf,
        'monto_total', p_payload->>'monto_total'
    );
END;
$$;

GRANT EXECUTE ON FUNCTION procesar_venta_pos(JSONB) TO anon, authenticated;
