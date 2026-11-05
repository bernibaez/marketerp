-- ============================================================
-- 031_fix_cajas_sesiones_y_movimientos.sql
-- Auditoría técnica y corrección de aperturas, cierres y movimientos de caja:
-- 1. Políticas RLS completas (anon y authenticated) para cierres_caja y movimientos_caja
-- 2. Flexibilización de columnas de identificación para evitar bloqueos por UUID
-- 3. Funciones transaccionales para aperturas, cierres seguros y recuperación de turnos activos
-- ============================================================

-- 1. Flexibilizar columnas y constraints en cierres_caja
ALTER TABLE IF EXISTS public.cierres_caja DROP CONSTRAINT IF EXISTS cierres_caja_cajero_id_fkey;
ALTER TABLE IF EXISTS public.cierres_caja ALTER COLUMN caja_id TYPE VARCHAR(100);
ALTER TABLE IF EXISTS public.cierres_caja ALTER COLUMN cajero_id TYPE VARCHAR(100);
ALTER TABLE IF EXISTS public.cierres_caja ADD COLUMN IF NOT EXISTS cajero_nombre TEXT;
ALTER TABLE IF EXISTS public.cierres_caja ADD COLUMN IF NOT EXISTS cajero_username TEXT;
ALTER TABLE IF EXISTS public.cierres_caja ADD COLUMN IF NOT EXISTS caja_label TEXT;
ALTER TABLE IF EXISTS public.cierres_caja ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE IF EXISTS public.cierres_caja ADD COLUMN IF NOT EXISTS total_otros NUMERIC(12, 2) DEFAULT 0.00;
ALTER TABLE IF EXISTS public.cierres_caja ADD COLUMN IF NOT EXISTS total_entradas NUMERIC(12, 2) DEFAULT 0.00;
ALTER TABLE IF EXISTS public.cierres_caja ADD COLUMN IF NOT EXISTS total_retiros NUMERIC(12, 2) DEFAULT 0.00;
ALTER TABLE IF EXISTS public.cierres_caja ADD COLUMN IF NOT EXISTS total_devoluciones NUMERIC(12, 2) DEFAULT 0.00;

-- 2. Flexibilizar columnas y constraints en movimientos_caja
ALTER TABLE IF EXISTS public.movimientos_caja DROP CONSTRAINT IF EXISTS movimientos_caja_caja_id_fkey;
ALTER TABLE IF EXISTS public.movimientos_caja DROP CONSTRAINT IF EXISTS movimientos_caja_cierre_id_fkey;
ALTER TABLE IF EXISTS public.movimientos_caja DROP CONSTRAINT IF EXISTS movimientos_caja_cajero_id_fkey;
ALTER TABLE IF EXISTS public.movimientos_caja ALTER COLUMN caja_id TYPE VARCHAR(100);
ALTER TABLE IF EXISTS public.movimientos_caja ALTER COLUMN cierre_id TYPE VARCHAR(100);
ALTER TABLE IF EXISTS public.movimientos_caja ALTER COLUMN cajero_id TYPE VARCHAR(100);
ALTER TABLE IF EXISTS public.movimientos_caja ADD COLUMN IF NOT EXISTS cajero_nombre TEXT;

-- 3. Habilitar RLS permisivo en cierres_caja y movimientos_caja
ALTER TABLE IF EXISTS public.cierres_caja ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.movimientos_caja ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    DROP POLICY IF EXISTS cierres_select ON public.cierres_caja;
    DROP POLICY IF EXISTS cierres_write ON public.cierres_caja;
    DROP POLICY IF EXISTS cierres_caja_all ON public.cierres_caja;

    CREATE POLICY cierres_caja_all ON public.cierres_caja
        FOR ALL TO public
        USING (TRUE)
        WITH CHECK (TRUE);

    DROP POLICY IF EXISTS movimientos_caja_select ON public.movimientos_caja;
    DROP POLICY IF EXISTS movimientos_caja_write ON public.movimientos_caja;
    DROP POLICY IF EXISTS movimientos_caja_all ON public.movimientos_caja;

    CREATE POLICY movimientos_caja_all ON public.movimientos_caja
        FOR ALL TO public
        USING (TRUE)
        WITH CHECK (TRUE);
END $$;

GRANT ALL ON TABLE public.cierres_caja TO anon, authenticated;
GRANT ALL ON TABLE public.movimientos_caja TO anon, authenticated;

-- 4. Función Transaccional para Apertura Segura de Caja
CREATE OR REPLACE FUNCTION public.iniciar_caja_transaccional(
    p_caja_id VARCHAR(100),
    p_caja_label TEXT,
    p_cajero_id VARCHAR(100),
    p_cajero_nombre TEXT,
    p_cajero_username TEXT,
    p_monto_apertura NUMERIC(12, 2),
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_existente RECORD;
    v_otra_ocupada RECORD;
    v_nuevo_id UUID := gen_random_uuid();
    v_codigo TEXT;
    v_now TIMESTAMPTZ := NOW();
BEGIN
    -- A. Verificar si el usuario ya tiene un turno abierto activo
    IF p_cajero_id IS NOT NULL AND TRIM(p_cajero_id) <> '' THEN
        SELECT * INTO v_existente
        FROM public.cierres_caja
        WHERE estado = 'abierta'
          AND (cajero_id = p_cajero_id OR (p_cajero_nombre IS NOT NULL AND cajero_nombre = p_cajero_nombre))
        ORDER BY abierta_en DESC
        LIMIT 1;

        IF v_existente.id IS NOT NULL THEN
            -- Retornar la sesión existente para no duplicar ni perder ventas en curso
            RETURN jsonb_build_object(
                'ok', true,
                'recuperada', true,
                'mensaje', 'Sesión activa existente recuperada',
                'cierre', to_jsonb(v_existente)
            );
        END IF;
    END IF;

    -- B. Verificar si la registradora ya se encuentra en uso por otro cajero
    SELECT * INTO v_otra_ocupada
    FROM public.cierres_caja
    WHERE estado = 'abierta'
      AND caja_id = p_caja_id
      AND (cajero_id IS NULL OR p_cajero_id IS NULL OR cajero_id <> p_cajero_id)
    ORDER BY abierta_en DESC
    LIMIT 1;

    IF v_otra_ocupada.id IS NOT NULL THEN
        RETURN jsonb_build_object(
            'ok', false,
            'error', 'La registradora seleccionada ya está abierta por ' || COALESCE(v_otra_ocupada.cajero_nombre, 'otro cajero')
        );
    END IF;

    -- C. Crear código único y registrar la nueva sesión
    v_codigo := 'AP-' || to_char(v_now, 'YYYYMMDD') || '-' || upper(substring(replace(v_nuevo_id::TEXT, '-', '') from 1 for 6));

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
        abierta_en,
        cerrada_en
    ) VALUES (
        v_nuevo_id,
        v_codigo,
        p_caja_id,
        p_caja_label,
        p_cajero_id,
        p_cajero_nombre,
        p_cajero_username,
        COALESCE(p_monto_apertura, 0),
        COALESCE(p_monto_apertura, 0),
        COALESCE(p_monto_apertura, 0),
        0,
        0, 0, 0, 0, 0, 0, 0, 0,
        'abierta',
        p_notes,
        v_now,
        NULL
    );

    SELECT * INTO v_existente FROM public.cierres_caja WHERE id = v_nuevo_id;

    RETURN jsonb_build_object(
        'ok', true,
        'recuperada', false,
        'mensaje', 'Turno de caja iniciado exitosamente',
        'cierre', to_jsonb(v_existente)
    );
END;
$$;

-- 5. Función Transaccional para Cierre Seguro de Turno
CREATE OR REPLACE FUNCTION public.cerrar_caja_transaccional(
    p_cierre_id TEXT,
    p_caja_id VARCHAR(100),
    p_cajero_id VARCHAR(100),
    p_cajero_nombre TEXT,
    p_monto_real NUMERIC(12, 2),
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_cierre RECORD;
    v_now TIMESTAMPTZ := NOW();
    v_desde TIMESTAMPTZ;
    v_ventas_efectivo NUMERIC(12, 2) := 0;
    v_ventas_tarjeta NUMERIC(12, 2) := 0;
    v_ventas_transferencia NUMERIC(12, 2) := 0;
    v_ventas_credito NUMERIC(12, 2) := 0;
    v_ventas_total NUMERIC(12, 2) := 0;
    v_entradas NUMERIC(12, 2) := 0;
    v_retiros NUMERIC(12, 2) := 0;
    v_devoluciones NUMERIC(12, 2) := 0;
    v_monto_esperado NUMERIC(12, 2) := 0;
    v_monto_diferencia NUMERIC(12, 2) := 0;
BEGIN
    -- 1. Buscar la sesión de caja abierta
    IF p_cierre_id IS NOT NULL AND TRIM(p_cierre_id) <> '' THEN
        BEGIN
            SELECT * INTO v_cierre
            FROM public.cierres_caja
            WHERE id = p_cierre_id::UUID
            FOR UPDATE;
        EXCEPTION WHEN OTHERS THEN
            SELECT * INTO v_cierre
            FROM public.cierres_caja
            WHERE codigo = p_cierre_id
            FOR UPDATE;
        END;
    END IF;

    IF v_cierre.id IS NULL AND p_caja_id IS NOT NULL THEN
        SELECT * INTO v_cierre
        FROM public.cierres_caja
        WHERE caja_id = p_caja_id
          AND estado = 'abierta'
          AND (p_cajero_id IS NULL OR cajero_id = p_cajero_id OR (p_cajero_nombre IS NOT NULL AND cajero_nombre = p_cajero_nombre))
        ORDER BY abierta_en DESC
        LIMIT 1
        FOR UPDATE;
    END IF;

    IF v_cierre.id IS NULL THEN
        RETURN jsonb_build_object(
            'ok', false,
            'error', 'No se encontró un turno abierto activo para cerrar.'
        );
    END IF;

    IF v_cierre.estado = 'cerrada' THEN
        RETURN jsonb_build_object(
            'ok', false,
            'error', 'Este turno de caja ya fue cerrado previamente.',
            'cierre', to_jsonb(v_cierre)
        );
    END IF;

    v_desde := v_cierre.abierta_en;

    -- 2. Sumar ventas reales asociadas a esta caja dentro del rango del turno
    SELECT
        COALESCE(SUM(COALESCE(monto_efectivo, 0)), 0),
        COALESCE(SUM(COALESCE(monto_tarjeta, 0)), 0),
        COALESCE(SUM(COALESCE(monto_transferencia, 0)), 0),
        COALESCE(SUM(COALESCE(monto_credito, 0)), 0),
        COALESCE(SUM(COALESCE(monto_total, 0)), 0)
    INTO
        v_ventas_efectivo,
        v_ventas_tarjeta,
        v_ventas_transferencia,
        v_ventas_credito,
        v_ventas_total
    FROM public.ventas
    WHERE estado <> 'anulada'
      AND caja_id = v_cierre.caja_id
      AND creado_en >= (v_desde - INTERVAL '10 seconds');

    -- 3. Sumar movimientos de caja específicos de este turno
    SELECT
        COALESCE(SUM(CASE WHEN tipo IN ('entrada', 'aporte') THEN monto ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN tipo IN ('salida', 'retiro', 'gasto') AND LOWER(COALESCE(categoria, '')) NOT LIKE '%devoluci%' THEN monto ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN tipo IN ('salida', 'retiro') AND LOWER(COALESCE(categoria, '')) LIKE '%devoluci%' THEN monto ELSE 0 END), 0)
    INTO
        v_entradas,
        v_retiros,
        v_devoluciones
    FROM public.movimientos_caja
    WHERE caja_id = v_cierre.caja_id
      AND (cierre_id = v_cierre.id::TEXT OR creado_en >= (v_desde - INTERVAL '10 seconds'));

    -- 4. Cálculo exacto del efectivo esperado según regla de negocio:
    -- Fondo inicial + ventas en efectivo + entradas en efectivo - retiros y gastos - devoluciones en efectivo
    v_monto_esperado := COALESCE(v_cierre.monto_apertura, 0) + v_ventas_efectivo + v_entradas - v_retiros - v_devoluciones;
    v_monto_diferencia := COALESCE(p_monto_real, 0) - v_monto_esperado;

    -- 5. Actualizar el registro a cerrado de forma atómica
    UPDATE public.cierres_caja
    SET
        estado = 'cerrada',
        monto_esperado = v_monto_esperado,
        monto_real = COALESCE(p_monto_real, 0),
        monto_diferencia = v_monto_diferencia,
        total_ventas = v_ventas_total,
        total_efectivo = v_ventas_efectivo,
        total_tarjeta = v_ventas_tarjeta,
        total_transferencia = v_ventas_transferencia,
        total_otros = v_ventas_credito,
        total_entradas = v_entradas,
        total_retiros = v_retiros,
        total_devoluciones = v_devoluciones,
        cerrada_en = v_now,
        notes = COALESCE(p_notes, v_cierre.notes)
    WHERE id = v_cierre.id;

    SELECT * INTO v_cierre FROM public.cierres_caja WHERE id = v_cierre.id;

    RETURN jsonb_build_object(
        'ok', true,
        'mensaje', 'Turno de caja cerrado exitosamente con cuadre exacto',
        'cierre', to_jsonb(v_cierre)
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.iniciar_caja_transaccional(VARCHAR, TEXT, VARCHAR, TEXT, TEXT, NUMERIC, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cerrar_caja_transaccional(TEXT, VARCHAR, VARCHAR, TEXT, NUMERIC, TEXT) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';

