-- ============================================================
-- 032_fix_caja_apertura_cierre_seguro.sql
-- Optimización y robustez definitiva para Apertura y Cierre de Caja:
-- 1. Resuelve inconsistencias entre UUID y Código de Caja ('2' vs UUID)
-- 2. Limpieza y auto-cierre de turnos huérfanos o abandonados (>24h)
-- 3. Reconocimiento de identidad por ID, nombre o username sin bloqueos erróneos
-- 4. Cálculo exacto del cuadre de caja (Efectivo Esperado vs Físico Contado)
-- ============================================================

-- 1. Función para iniciar turno de forma segura y sin bloqueos
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
    v_caja_db_id TEXT;
    v_caja_codigo TEXT;
    v_caja_nombre TEXT;
    v_target_caja_id TEXT := p_caja_id;
    v_existente RECORD;
    v_otra_ocupada RECORD;
    v_nuevo_id UUID := gen_random_uuid();
    v_codigo TEXT;
    v_now TIMESTAMPTZ := NOW();
BEGIN
    -- 1. Buscar metadatos de la caja en la tabla 'cajas' para mapear UUID y código
    IF p_caja_id IS NOT NULL AND TRIM(p_caja_id) <> '' THEN
        SELECT id::TEXT, codigo, nombre
        INTO v_caja_db_id, v_caja_codigo, v_caja_nombre
        FROM public.cajas
        WHERE id::TEXT = p_caja_id
           OR codigo = p_caja_id
           OR LOWER(TRIM(nombre)) = LOWER(TRIM(p_caja_id))
        LIMIT 1;

        IF v_caja_db_id IS NOT NULL THEN
            v_target_caja_id := v_caja_db_id;
        END IF;
    END IF;

    -- 2. Auto-cerrar turnos huérfanos (sin cajero) o abandonados de más de 24 horas
    UPDATE public.cierres_caja
    SET estado = 'cerrada',
        cerrada_en = v_now,
        notes = COALESCE(notes, '') || ' (Cierre automático por nueva sesión)'
    WHERE estado = 'abierta'
      AND (
          (cajero_id IS NULL AND (cajero_nombre IS NULL OR TRIM(cajero_nombre) = ''))
          OR abierta_en < (v_now - INTERVAL '24 hours')
      );

    -- 3. Verificar si el usuario ya tiene un turno abierto activo en esta o cualquier caja
    IF (p_cajero_id IS NOT NULL AND TRIM(p_cajero_id) <> '') OR (p_cajero_nombre IS NOT NULL AND TRIM(p_cajero_nombre) <> '') THEN
        SELECT * INTO v_existente
        FROM public.cierres_caja
        WHERE estado = 'abierta'
          AND (
              (p_cajero_id IS NOT NULL AND TRIM(p_cajero_id) <> '' AND cajero_id = p_cajero_id)
              OR (p_cajero_nombre IS NOT NULL AND TRIM(p_cajero_nombre) <> '' AND LOWER(TRIM(cajero_nombre)) = LOWER(TRIM(p_cajero_nombre)))
          )
        ORDER BY abierta_en DESC
        LIMIT 1;

        IF v_existente.id IS NOT NULL THEN
            -- Si es la misma caja o el usuario desea continuar
            RETURN jsonb_build_object(
                'ok', true,
                'recuperada', true,
                'mensaje', 'Sesión activa existente recuperada para ' || COALESCE(p_cajero_nombre, 'el usuario'),
                'cierre', to_jsonb(v_existente)
            );
        END IF;
    END IF;

    -- 4. Verificar si la registradora ya se encuentra en uso por otro cajero ACTIVO
    SELECT * INTO v_otra_ocupada
    FROM public.cierres_caja
    WHERE estado = 'abierta'
      AND (
          caja_id = v_target_caja_id
          OR (v_caja_codigo IS NOT NULL AND caja_id = v_caja_codigo)
          OR caja_id = p_caja_id
      )
      AND (
          (p_cajero_id IS NOT NULL AND cajero_id IS NOT NULL AND cajero_id <> p_cajero_id)
          OR (p_cajero_nombre IS NOT NULL AND cajero_nombre IS NOT NULL AND LOWER(TRIM(cajero_nombre)) <> LOWER(TRIM(p_cajero_nombre)))
      )
    ORDER BY abierta_en DESC
    LIMIT 1;

    IF v_otra_ocupada.id IS NOT NULL THEN
        -- Si la sesión de la otra persona tiene más de 12 horas, cerrarla para no bloquear
        IF v_otra_ocupada.abierta_en < (v_now - INTERVAL '12 hours') THEN
            UPDATE public.cierres_caja
            SET estado = 'cerrada',
                cerrada_en = v_now,
                notes = COALESCE(notes, '') || ' (Cierre por relevo de turno)'
            WHERE id = v_otra_ocupada.id;
        ELSE
            RETURN jsonb_build_object(
                'ok', false,
                'error', 'La registradora seleccionada ya está abierta por ' || COALESCE(v_otra_ocupada.cajero_nombre, 'otro cajero')
            );
        END IF;
    END IF;

    -- 5. Crear código único y registrar la nueva sesión
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
        v_target_caja_id,
        COALESCE(p_caja_label, v_caja_nombre, 'Caja ' || p_caja_id),
        p_cajero_id,
        COALESCE(p_cajero_nombre, 'Cajero'),
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

-- 2. Función para cierre transaccional seguro con cálculo exacto
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
    v_caja_db_id TEXT;
    v_caja_codigo TEXT;
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
    -- Mapear UUID y código de caja
    IF p_caja_id IS NOT NULL AND TRIM(p_caja_id) <> '' THEN
        SELECT id::TEXT, codigo
        INTO v_caja_db_id, v_caja_codigo
        FROM public.cajas
        WHERE id::TEXT = p_caja_id
           OR codigo = p_caja_id
           OR LOWER(TRIM(nombre)) = LOWER(TRIM(p_caja_id))
        LIMIT 1;
    END IF;

    -- 1. Buscar la sesión de caja abierta por ID exacto
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

    -- 2. Si no se encontró por ID, buscar por caja y cajero
    IF v_cierre.id IS NULL AND p_caja_id IS NOT NULL THEN
        SELECT * INTO v_cierre
        FROM public.cierres_caja
        WHERE estado = 'abierta'
          AND (
              caja_id = p_caja_id
              OR (v_caja_db_id IS NOT NULL AND caja_id = v_caja_db_id)
              OR (v_caja_codigo IS NOT NULL AND caja_id = v_caja_codigo)
          )
          AND (
              p_cajero_id IS NULL
              OR cajero_id = p_cajero_id
              OR (p_cajero_nombre IS NOT NULL AND LOWER(TRIM(COALESCE(cajero_nombre, ''))) = LOWER(TRIM(p_cajero_nombre)))
          )
        ORDER BY abierta_en DESC
        LIMIT 1
        FOR UPDATE;
    END IF;

    -- 3. Si aún no se encontró, buscar la última sesión abierta del usuario
    IF v_cierre.id IS NULL AND (p_cajero_id IS NOT NULL OR p_cajero_nombre IS NOT NULL) THEN
        SELECT * INTO v_cierre
        FROM public.cierres_caja
        WHERE estado = 'abierta'
          AND (
              (p_cajero_id IS NOT NULL AND cajero_id = p_cajero_id)
              OR (p_cajero_nombre IS NOT NULL AND LOWER(TRIM(COALESCE(cajero_nombre, ''))) = LOWER(TRIM(p_cajero_nombre)))
          )
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

    -- Obtener identificadores de la caja del turno para sumar ventas
    IF v_caja_db_id IS NULL AND v_cierre.caja_id IS NOT NULL THEN
        SELECT id::TEXT, codigo
        INTO v_caja_db_id, v_caja_codigo
        FROM public.cajas
        WHERE id::TEXT = v_cierre.caja_id
           OR codigo = v_cierre.caja_id
           OR LOWER(TRIM(nombre)) = LOWER(TRIM(v_cierre.caja_id))
        LIMIT 1;
    END IF;

    -- 4. Sumar ventas reales asociadas a esta caja dentro del rango del turno
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
      AND (
          caja_id = v_cierre.caja_id
          OR (v_caja_db_id IS NOT NULL AND caja_id = v_caja_db_id)
          OR (v_caja_codigo IS NOT NULL AND caja_id = v_caja_codigo)
          OR (caja_id IS NULL AND v_cierre.cajero_id IS NOT NULL AND cajero_id = v_cierre.cajero_id)
      )
      AND creado_en >= (v_desde - INTERVAL '15 seconds');

    -- 5. Sumar movimientos de caja específicos de este turno
    SELECT
        COALESCE(SUM(CASE WHEN tipo IN ('entrada', 'aporte') THEN monto ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN tipo IN ('salida', 'retiro', 'gasto') AND LOWER(COALESCE(categoria, '')) NOT LIKE '%devoluci%' THEN monto ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN tipo IN ('salida', 'retiro') AND LOWER(COALESCE(categoria, '')) LIKE '%devoluci%' THEN monto ELSE 0 END), 0)
    INTO
        v_entradas,
        v_retiros,
        v_devoluciones
    FROM public.movimientos_caja
    WHERE (
          cierre_id = v_cierre.id::TEXT
          OR caja_id = v_cierre.caja_id
          OR (v_caja_db_id IS NOT NULL AND caja_id = v_caja_db_id)
          OR (v_caja_codigo IS NOT NULL AND caja_id = v_caja_codigo)
      )
      AND creado_en >= (v_desde - INTERVAL '15 seconds');

    -- 6. Cuadre exacto:
    -- Fondo inicial + ventas en efectivo + entradas en efectivo - retiros y gastos - devoluciones en efectivo
    v_monto_esperado := COALESCE(v_cierre.monto_apertura, 0) + v_ventas_efectivo + v_entradas - v_retiros - v_devoluciones;
    v_monto_diferencia := COALESCE(p_monto_real, 0) - v_monto_esperado;

    -- 7. Actualizar el registro a cerrado
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

