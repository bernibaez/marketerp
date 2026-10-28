-- ============================================================
-- 017_configuracion_factura.sql
-- Agregar columna configuracion_factura (JSONB) a la tabla configuracion_empresa
-- y otorgar permisos completos para guardar y sincronizar desde POS, Ventas y Configuración
--
-- INSTRUCCIONES:
-- 1. Ve a tu panel de Supabase (https://supabase.com/dashboard)
-- 2. Entra a SQL Editor
-- 3. Pega este script completo y haz clic en "Run"
-- ============================================================

-- 1. Columna para almacenar el diseño y configuración completa de la factura (JSONB)
ALTER TABLE IF EXISTS configuracion_empresa 
ADD COLUMN IF NOT EXISTS configuracion_factura JSONB DEFAULT NULL;

-- 2. Asegurar que las políticas RLS permitan lectura y guardado a anon y authenticated
ALTER TABLE IF EXISTS configuracion_empresa ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    DROP POLICY IF EXISTS configuracion_empresa_select ON configuracion_empresa;
    DROP POLICY IF EXISTS configuracion_empresa_insert ON configuracion_empresa;
    DROP POLICY IF EXISTS configuracion_empresa_update ON configuracion_empresa;
    DROP POLICY IF EXISTS configuracion_empresa_delete ON configuracion_empresa;
    DROP POLICY IF EXISTS configuracion_empresa_select_anon ON configuracion_empresa;
    DROP POLICY IF EXISTS configuracion_empresa_all ON configuracion_empresa;

    CREATE POLICY configuracion_empresa_all ON configuracion_empresa 
        FOR ALL USING (true) WITH CHECK (true);
END $$;

GRANT ALL ON TABLE configuracion_empresa TO anon, authenticated;

-- 3. Políticas para la tabla productos para que la sincronización / importación de balanza no falle
ALTER TABLE IF EXISTS productos ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    DROP POLICY IF EXISTS productos_all ON productos;
    CREATE POLICY productos_all ON productos 
        FOR ALL USING (true) WITH CHECK (true);
END $$;

GRANT ALL ON TABLE productos TO anon, authenticated;

