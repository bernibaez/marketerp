-- ============================================================
-- 033_limpiar_iniciar_caja_sin_bloqueos.sql
-- Optimización definitiva de apertura de caja sin bloqueos ni errores
-- Permite que cualquier usuario inicie caja limpiamente con su monto deseado
-- ============================================================

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
    v_nuevo_id UUID := gen_random_uuid();
    v_codigo TEXT;
    v_now TIMESTAMPTZ := NOW();
    v_cierre RECORD;
BEGIN
    -- 1. Mapear UUID y código de caja desde public.cajas
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

    -- 2. Cerrar limpiamente turnos anteriores abiertos de esta caja o de este cajero para permitir inicio inmediato sin bloqueos
    UPDATE public.cierres_caja
    SET estado = 'cerrada',
        cerrada_en = v_now,
        notes = COALESCE(notes, '') || ' (Cierre por nuevo turno)'
    WHERE estado = 'abierta'
      AND (
          caja_id = v_target_caja_id
          OR (v_caja_codigo IS NOT NULL AND caja_id = v_caja_codigo)
          OR caja_id = p_caja_id
          OR (p_cajero_id IS NOT NULL AND TRIM(p_cajero_id) <> '' AND cajero_id = p_cajero_id)
          OR (p_cajero_nombre IS NOT NULL AND TRIM(p_cajero_nombre) <> '' AND LOWER(TRIM(cajero_nombre)) = LOWER(TRIM(p_cajero_nombre)))
      );

    -- 3. Generar código de apertura único
    v_codigo := 'AP-' || TO_CHAR(v_now, 'YYYYMMDD') || '-' || UPPER(SUBSTRING(v_nuevo_id::TEXT, 1, 6));

    -- 4. Insertar nuevo turno limpio con el monto exacto ingresado
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
        abierta_en,
        notes
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
        0.00,
        0.00,
        0.00,
        0.00,
        0.00,
        0.00,
        0.00,
        0.00,
        0.00,
        'abierta',
        v_now,
        p_notes
    )
    RETURNING * INTO v_cierre;

    RETURN jsonb_build_object(
        'ok', true,
        'mensaje', 'Turno de caja iniciado exitosamente',
        'cierre', to_jsonb(v_cierre)
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.iniciar_caja_transaccional(VARCHAR, TEXT, VARCHAR, TEXT, TEXT, NUMERIC, TEXT) TO anon, authenticated;
NOTIFY pgrst, 'reload schema';

