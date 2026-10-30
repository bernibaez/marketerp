-- ============================================================
-- 019_habilitar_gastos_completo.sql
-- Habilita columnas faltantes (metodo_pago, fecha), ajusta políticas RLS
-- para permitir registrar gastos y crea las categorías de gasto iniciales.
--
-- Instrucciones para ejecutar en Supabase:
-- 1. Ve a Supabase Dashboard → SQL Editor
-- 2. Pega este contenido y presiona "Run"
-- ============================================================

-- 1. Asegurar columnas metodo_pago y fecha en tabla gastos
ALTER TABLE gastos
    ADD COLUMN IF NOT EXISTS metodo_pago VARCHAR(30) DEFAULT 'efectivo',
    ADD COLUMN IF NOT EXISTS fecha DATE DEFAULT CURRENT_DATE,
    ADD COLUMN IF NOT EXISTS responsable_nombre TEXT;

-- 2. Configurar RLS permisivo en categorias_gasto y gastos
ALTER TABLE categorias_gasto ENABLE ROW LEVEL SECURITY;
ALTER TABLE gastos ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    -- Politicas para categorias_gasto
    DROP POLICY IF EXISTS categorias_gasto_select ON categorias_gasto;
    DROP POLICY IF EXISTS categorias_gasto_insert ON categorias_gasto;
    DROP POLICY IF EXISTS categorias_gasto_update ON categorias_gasto;
    DROP POLICY IF EXISTS categorias_gasto_delete ON categorias_gasto;

    CREATE POLICY categorias_gasto_select ON categorias_gasto FOR SELECT USING (true);
    CREATE POLICY categorias_gasto_insert ON categorias_gasto FOR INSERT WITH CHECK (true);
    CREATE POLICY categorias_gasto_update ON categorias_gasto FOR UPDATE USING (true) WITH CHECK (true);
    CREATE POLICY categorias_gasto_delete ON categorias_gasto FOR DELETE USING (true);

    -- Politicas para gastos
    DROP POLICY IF EXISTS gastos_select ON gastos;
    DROP POLICY IF EXISTS gastos_insert ON gastos;
    DROP POLICY IF EXISTS gastos_update ON gastos;
    DROP POLICY IF EXISTS gastos_delete ON gastos;

    CREATE POLICY gastos_select ON gastos FOR SELECT USING (true);
    CREATE POLICY gastos_insert ON gastos FOR INSERT WITH CHECK (true);
    CREATE POLICY gastos_update ON gastos FOR UPDATE USING (true) WITH CHECK (true);
    CREATE POLICY gastos_delete ON gastos FOR DELETE USING (true);
END $$;

GRANT ALL ON TABLE categorias_gasto TO anon, authenticated;
GRANT ALL ON TABLE gastos TO anon, authenticated;

-- 3. Sembrar categorías iniciales de gasto operativo
INSERT INTO categorias_gasto (codigo, nombre, descripcion, presupuesto_mensual, activo) VALUES
    ('CAT-001', 'Servicios Públicos (Luz, Agua, Internet)', 'Pago de electricidad, agua potable y telecomunicaciones', 15000.00, true),
    ('CAT-002', 'Nómina y Salarios', 'Sueldos de empleados, horas extras y propinas', 80000.00, true),
    ('CAT-003', 'Mantenimiento y Reparaciones', 'Reparación de equipos, pintura y arreglos del local', 10000.00, true),
    ('CAT-004', 'Suministros y Empaques', 'Bolsas plásticas, papel térmico para tickets y limpieza', 8000.00, true),
    ('CAT-005', 'Alquiler de Local', 'Pago mensual por concepto de arrendamiento comercial', 35000.00, true),
    ('CAT-006', 'Transporte y Combustible', 'Combustible de reparto, fletes y viáticos', 12000.00, true),
    ('CAT-007', 'Impuestos y Tasas', 'Arbitrios municipales, tasas bancarias y tributos', 5000.00, true),
    ('CAT-008', 'Otros Gastos Operativos', 'Gastos imprevistos y caja chica', 5000.00, true)
ON CONFLICT (codigo) DO UPDATE SET
    nombre = EXCLUDED.nombre,
    descripcion = EXCLUDED.descripcion,
    activo = true;
