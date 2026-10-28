-- ============================================================
-- 016_politicas_categorias_proveedores.sql
-- Habilitar permisos completos de lectura y escritura para categorias,
-- marcas y proveedores (tanto para anon como para authenticated)
-- 
-- Instrucciones:
-- 1. Ve a Supabase Dashboard → SQL Editor
-- 2. Pega este contenido y presiona "Run"
-- ============================================================

-- 1. Tabla categorias
CREATE TABLE IF NOT EXISTS categorias (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo VARCHAR(30) UNIQUE NOT NULL,
    nombre TEXT NOT NULL,
    descripcion TEXT,
    activo BOOLEAN DEFAULT TRUE,
    creado_en TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_categorias_nombre ON categorias(nombre);

ALTER TABLE categorias ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    DROP POLICY IF EXISTS categorias_select ON categorias;
    DROP POLICY IF EXISTS categorias_insert ON categorias;
    DROP POLICY IF EXISTS categorias_update ON categorias;
    DROP POLICY IF EXISTS categorias_delete ON categorias;

    CREATE POLICY categorias_select ON categorias FOR SELECT USING (true);
    CREATE POLICY categorias_insert ON categorias FOR INSERT WITH CHECK (true);
    CREATE POLICY categorias_update ON categorias FOR UPDATE USING (true) WITH CHECK (true);
    CREATE POLICY categorias_delete ON categorias FOR DELETE USING (true);
END $$;

GRANT ALL ON TABLE categorias TO anon, authenticated;

-- 2. Tabla marcas
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

GRANT ALL ON TABLE marcas TO anon, authenticated;

-- 3. Tabla proveedores
CREATE TABLE IF NOT EXISTS proveedores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo VARCHAR(30) UNIQUE NOT NULL,
    nombre TEXT NOT NULL,
    telefono VARCHAR(30),
    correo TEXT,
    direccion TEXT,
    activo BOOLEAN DEFAULT TRUE,
    creado_en TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_proveedores_nombre ON proveedores(nombre);

ALTER TABLE proveedores ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    DROP POLICY IF EXISTS proveedores_select ON proveedores;
    DROP POLICY IF EXISTS proveedores_insert ON proveedores;
    DROP POLICY IF EXISTS proveedores_update ON proveedores;
    DROP POLICY IF EXISTS proveedores_delete ON proveedores;
    DROP POLICY IF EXISTS proveedores_select_anon ON proveedores;

    CREATE POLICY proveedores_select ON proveedores FOR SELECT USING (true);
    CREATE POLICY proveedores_insert ON proveedores FOR INSERT WITH CHECK (true);
    CREATE POLICY proveedores_update ON proveedores FOR UPDATE USING (true) WITH CHECK (true);
    CREATE POLICY proveedores_delete ON proveedores FOR DELETE USING (true);
END $$;

GRANT ALL ON TABLE proveedores TO anon, authenticated;

-- 4. Notificar a PostgREST para recargar el esquema
NOTIFY pgrst, 'reload schema';
