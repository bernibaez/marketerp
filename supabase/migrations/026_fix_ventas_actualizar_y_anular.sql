-- Migration 026: Corrección y robustecimiento para edición, anulación y stock de ventas
-- Asegura que la tabla ventas cuente con actualizado_en y que las funciones y políticas permitan actualizar sin errores

-- 1. Asegurar columna actualizado_en en ventas si aún no existe
ALTER TABLE IF EXISTS public.ventas ADD COLUMN IF NOT EXISTS actualizado_en TIMESTAMPTZ DEFAULT NOW();

-- 2. Asegurar que detalle_ventas permita operaciones
DO $$
BEGIN
    ALTER TABLE IF EXISTS detalle_ventas ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS detalle_ventas_all ON detalle_ventas;
    CREATE POLICY detalle_ventas_all ON detalle_ventas
        FOR ALL TO public
        USING (TRUE)
        WITH CHECK (TRUE);

    DROP POLICY IF EXISTS ventas_update_all ON ventas;
    CREATE POLICY ventas_update_all ON ventas
        FOR UPDATE TO public
        USING (TRUE)
        WITH CHECK (TRUE);
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

-- 3. Otorgar permisos de ejecución a las funciones de venta para anon y authenticated
DO $$
BEGIN
    GRANT EXECUTE ON FUNCTION editar_venta_pos(UUID, JSONB) TO anon, authenticated;
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
    GRANT EXECUTE ON FUNCTION anular_venta_pos(UUID, TEXT) TO anon, authenticated;
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

