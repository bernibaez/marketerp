-- ============================================================
-- 029_habilitar_compras_y_ajustes_stock.sql
-- Habilitar permisos RLS completos para compras, detalle_compras,
-- y ajustes_stock (anon y authenticated) y actualizar procesar_ajuste_stock_bloque
-- con soporte para cantidades decimales y tolerancia a fallos.
-- ============================================================

-- 1. Políticas RLS para compras y detalle_compras
ALTER TABLE IF EXISTS compras ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS detalle_compras ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    DROP POLICY IF EXISTS compras_select ON compras;
    DROP POLICY IF EXISTS compras_insert ON compras;
    DROP POLICY IF EXISTS compras_update ON compras;
    DROP POLICY IF EXISTS compras_delete ON compras;

    CREATE POLICY compras_select ON compras FOR SELECT USING (true);
    CREATE POLICY compras_insert ON compras FOR INSERT WITH CHECK (true);
    CREATE POLICY compras_update ON compras FOR UPDATE USING (true) WITH CHECK (true);
    CREATE POLICY compras_delete ON compras FOR DELETE USING (true);

    DROP POLICY IF EXISTS detalle_compras_select ON detalle_compras;
    DROP POLICY IF EXISTS detalle_compras_insert ON detalle_compras;
    DROP POLICY IF EXISTS detalle_compras_update ON detalle_compras;
    DROP POLICY IF EXISTS detalle_compras_delete ON detalle_compras;

    CREATE POLICY detalle_compras_select ON detalle_compras FOR SELECT USING (true);
    CREATE POLICY detalle_compras_insert ON detalle_compras FOR INSERT WITH CHECK (true);
    CREATE POLICY detalle_compras_update ON detalle_compras FOR UPDATE USING (true) WITH CHECK (true);
    CREATE POLICY detalle_compras_delete ON detalle_compras FOR DELETE USING (true);
END $$;

GRANT ALL ON TABLE compras TO anon, authenticated;
GRANT ALL ON TABLE detalle_compras TO anon, authenticated;

-- 2. Políticas RLS para ajustes_stock
ALTER TABLE IF EXISTS ajustes_stock ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    DROP POLICY IF EXISTS ajustes_stock_select ON ajustes_stock;
    DROP POLICY IF EXISTS ajustes_stock_insert ON ajustes_stock;
    DROP POLICY IF EXISTS ajustes_stock_update ON ajustes_stock;
    DROP POLICY IF EXISTS ajustes_stock_delete ON ajustes_stock;

    CREATE POLICY ajustes_stock_select ON ajustes_stock FOR SELECT USING (true);
    CREATE POLICY ajustes_stock_insert ON ajustes_stock FOR INSERT WITH CHECK (true);
    CREATE POLICY ajustes_stock_update ON ajustes_stock FOR UPDATE USING (true) WITH CHECK (true);
    CREATE POLICY ajustes_stock_delete ON ajustes_stock FOR DELETE USING (true);
END $$;

GRANT ALL ON TABLE ajustes_stock TO anon, authenticated;

-- 3. Actualizar función procesar_ajuste_stock_bloque con soporte para cantidades decimales
CREATE OR REPLACE FUNCTION procesar_ajuste_stock_bloque(p_items JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_item JSONB;
    v_prod_id UUID;
    v_tipo TEXT;
    v_nueva NUMERIC(12, 3);
    v_anterior NUMERIC(12, 3);
    v_codigo TEXT;
    v_count INT := 0;
    v_ids UUID[] := ARRAY[]::UUID[];
    v_ajuste_id UUID;
BEGIN
    FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_items, '[]'::jsonb))
    LOOP
        BEGIN
            v_prod_id := (v_item->>'producto_id')::UUID;
            v_tipo := COALESCE(v_item->>'tipo_ajuste', 'salida');

            SELECT stock_actual INTO v_anterior FROM productos WHERE id = v_prod_id FOR UPDATE;
            IF v_anterior IS NULL THEN
                -- Si no se encuentra en Supabase, continuar con los demás sin abortar
                CONTINUE;
            END IF;

            IF v_item ? 'cantidad_nueva' THEN
                v_nueva := (v_item->>'cantidad_nueva')::NUMERIC(12, 3);
            ELSIF v_tipo = 'entrada' THEN
                v_nueva := v_anterior + COALESCE((v_item->>'cantidad_variacion')::NUMERIC(12, 3), 0);
            ELSIF v_tipo IN ('salida', 'perdida') THEN
                v_nueva := GREATEST(0, v_anterior - ABS(COALESCE((v_item->>'cantidad_variacion')::NUMERIC(12, 3), 0)));
            ELSE
                v_nueva := v_anterior;
            END IF;

            UPDATE productos
            SET stock_actual = v_nueva, actualizado_en = NOW()
            WHERE id = v_prod_id;

            v_ajuste_id := gen_random_uuid();
            v_codigo := COALESCE(
                v_item->>'codigo',
                'AJ-' || to_char(NOW(), 'YYYYMMDD') || '-' || substr(v_ajuste_id::text, 1, 6)
            );

            INSERT INTO ajustes_stock (
                id, codigo, producto_id, tipo_ajuste,
                cantidad_anterior, cantidad_nueva, cantidad_variacion,
                motivo, responsable_id, creado_en
            ) VALUES (
                v_ajuste_id,
                v_codigo,
                v_prod_id,
                v_tipo,
                v_anterior,
                v_nueva,
                v_nueva - v_anterior,
                COALESCE(v_item->>'motivo', 'Ajuste de inventario'),
                CASE WHEN (v_item->>'responsable_id') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' 
                     THEN (v_item->>'responsable_id')::UUID 
                     ELSE NULL 
                END,
                NOW()
            );

            v_count := v_count + 1;
            v_ids := array_append(v_ids, v_ajuste_id);
        EXCEPTION WHEN OTHERS THEN
            -- Ignorar error individual para no abortar el lote
            CONTINUE;
        END;
    END LOOP;

    RETURN jsonb_build_object('ajustes', v_count, 'ids', v_ids);
END;
$$;

GRANT EXECUTE ON FUNCTION procesar_ajuste_stock_bloque TO anon, authenticated;

