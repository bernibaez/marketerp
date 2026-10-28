-- ============================================================
-- 015_crear_tabla_marcas.sql
-- Tabla para gestión de marcas de productos
-- ============================================================

CREATE TABLE IF NOT EXISTS marcas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo VARCHAR(30) UNIQUE NOT NULL,
    nombre TEXT NOT NULL,
    descripcion TEXT,
    activo BOOLEAN DEFAULT TRUE,
    creado_en TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_marcas_nombre ON marcas(nombre);

ALTER TABLE marcas ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    DROP POLICY IF EXISTS marcas_select ON marcas;
    DROP POLICY IF EXISTS marcas_insert ON marcas;
    DROP POLICY IF EXISTS marcas_update ON marcas;
    DROP POLICY IF EXISTS marcas_delete ON marcas;

    CREATE POLICY marcas_select ON marcas FOR SELECT USING (true);
    CREATE POLICY marcas_insert ON marcas FOR INSERT WITH CHECK (true);
    CREATE POLICY marcas_update ON marcas FOR UPDATE USING (true) WITH CHECK (true);
    CREATE POLICY marcas_delete ON marcas FOR DELETE USING (true);
END $$;
