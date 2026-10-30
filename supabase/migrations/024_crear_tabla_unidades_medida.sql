-- ============================================================
-- 024_crear_tabla_unidades_medida.sql
-- Tabla para gestión dinámica de unidades de medida (cartón, combo, libra, kilogramos, unidad, etc.)
-- ============================================================

CREATE TABLE IF NOT EXISTS unidades_medida (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo VARCHAR(30) UNIQUE NOT NULL,
    nombre TEXT NOT NULL,
    abreviatura VARCHAR(15),
    tipo VARCHAR(20) DEFAULT 'unidad', -- 'unidad', 'peso', 'volumen', 'empaque'
    descripcion TEXT,
    activo BOOLEAN DEFAULT TRUE,
    creado_en TIMESTAMPTZ DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_unidades_medida_nombre ON unidades_medida(nombre);
CREATE INDEX IF NOT EXISTS idx_unidades_medida_tipo ON unidades_medida(tipo);

ALTER TABLE unidades_medida ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    DROP POLICY IF EXISTS unidades_medida_select ON unidades_medida;
    DROP POLICY IF EXISTS unidades_medida_insert ON unidades_medida;
    DROP POLICY IF EXISTS unidades_medida_update ON unidades_medida;
    DROP POLICY IF EXISTS unidades_medida_delete ON unidades_medida;

    CREATE POLICY unidades_medida_select ON unidades_medida FOR SELECT USING (true);
    CREATE POLICY unidades_medida_insert ON unidades_medida FOR INSERT WITH CHECK (true);
    CREATE POLICY unidades_medida_update ON unidades_medida FOR UPDATE USING (true) WITH CHECK (true);
    CREATE POLICY unidades_medida_delete ON unidades_medida FOR DELETE USING (true);
END $$;

-- Datos iniciales predeterminados
INSERT INTO unidades_medida (codigo, nombre, abreviatura, tipo, descripcion)
VALUES
    ('UNI-UND', 'Unidad', 'ud', 'unidad', 'Unidad simple o individual'),
    ('UNI-CTN', 'Cartón', 'ctn', 'empaque', 'Cartón de empaque (ej. huevos, enlatados)'),
    ('UNI-MED-CTN', 'Medio cartón', '1/2 ctn', 'empaque', 'Medio cartón (ej. 15 huevos)'),
    ('UNI-CMB', 'Combo', 'cmb', 'unidad', 'Paquete o combo especial'),
    ('UNI-LBR', 'Libra', 'lb', 'peso', 'Libra estándar (16 onzas)'),
    ('UNI-KGM', 'Kilogramo', 'kg', 'peso', 'Kilogramo métrico (1,000 g)'),
    ('UNI-GRM', 'Gramo', 'g', 'peso', 'Gramo métrico'),
    ('UNI-FDO', 'Fardo', 'fdo', 'empaque', 'Fardo de productos (ej. agua, refrescos)'),
    ('UNI-PAQ', 'Paquete', 'paq', 'empaque', 'Paquete o bulto de unidades'),
    ('UNI-CJA', 'Caja', 'cja', 'empaque', 'Caja corrugada o empaque cerrado'),
    ('UNI-BLS', 'Bolsa', 'bls', 'empaque', 'Bolsa sellada o paquete'),
    ('UNI-BOT', 'Botella', 'bot', 'unidad', 'Envase o botella individual'),
    ('UNI-LTR', 'Litro', 'lt', 'volumen', 'Litro de líquido'),
    ('UNI-GAL', 'Galón', 'gal', 'volumen', 'Galón estadounidense (3.785 L)')
ON CONFLICT (codigo) DO NOTHING;

