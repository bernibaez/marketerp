-- ============================================================
-- Migración 027: Corrección de zona horaria y filtros de ventas en métricas de Dashboard
--
-- Problemas resueltos:
-- 1. Zona horaria: Supabase corre en UTC, mientras que el negocio opera en República Dominicana
--    ('America/Santo_Domingo', UTC-4). A partir de las 8:00 p.m. hora local, date_trunc('day', NOW())
--    en UTC salta al día siguiente, ignorando todas las ventas diurnas y arrojando estadísticas
--    incompletas (ej. solo una venta de 10 mil en vez de la totalidad del día).
-- 2. Parámetro opcional p_desde: Permite al cliente frontend enviar su timestamp de inicio exacto.
-- 3. Estado de ventas: Se excluyen únicamente ventas anuladas ('anulada', 'cancelled'), permitiendo
--    estados como 'completada', 'pagada' o ventas sin estado estricto.
-- 4. Normalización de montos: Suma COALESCE(NULLIF(monto_total, 0), NULLIF(subtotal + monto_impuesto - monto_descuento, 0), NULLIF(monto_pagado, 0), 0)
--    en caso de que monto_total venga en 0.
-- ============================================================

CREATE OR REPLACE FUNCTION obtener_metricas_dashboard(
    p_periodo TEXT DEFAULT 'hoy',
    p_desde TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_desde TIMESTAMPTZ;
    v_hasta TIMESTAMPTZ := NOW();
    v_ventas_total NUMERIC;
    v_ventas_count INT;
    v_ticket_promedio NUMERIC;
    v_costo_total NUMERIC;
    v_productos_bajos INT;
    v_productos_total INT;
BEGIN
    IF p_desde IS NOT NULL THEN
        v_desde := p_desde;
    ELSE
        CASE lower(COALESCE(p_periodo, 'hoy'))
            WHEN 'semana' THEN 
                v_desde := date_trunc('week', NOW() AT TIME ZONE 'America/Santo_Domingo') AT TIME ZONE 'America/Santo_Domingo';
            WHEN 'mes' THEN 
                v_desde := date_trunc('month', NOW() AT TIME ZONE 'America/Santo_Domingo') AT TIME ZONE 'America/Santo_Domingo';
            ELSE 
                -- Inicio del día en horario de República Dominicana (UTC-4)
                v_desde := date_trunc('day', NOW() AT TIME ZONE 'America/Santo_Domingo') AT TIME ZONE 'America/Santo_Domingo';
        END CASE;
    END IF;

    SELECT
        COALESCE(SUM(
            COALESCE(
                NULLIF(monto_total, 0),
                NULLIF(subtotal + monto_impuesto - monto_descuento, 0),
                NULLIF(monto_pagado, 0),
                0
            )
        ), 0),
        COUNT(*)::INT,
        COALESCE(AVG(
            COALESCE(
                NULLIF(monto_total, 0),
                NULLIF(subtotal + monto_impuesto - monto_descuento, 0),
                NULLIF(monto_pagado, 0),
                0
            )
        ), 0),
        COALESCE(SUM(costo_total), 0)
    INTO v_ventas_total, v_ventas_count, v_ticket_promedio, v_costo_total
    FROM ventas
    WHERE COALESCE(estado, '') NOT IN ('anulada', 'cancelled')
      AND creado_en >= v_desde 
      AND creado_en <= v_hasta;

    SELECT COUNT(*)::INT INTO v_productos_bajos
    FROM productos
    WHERE COALESCE(estado, 'activo') = 'activo' AND stock_actual <= stock_minimo;

    SELECT COUNT(*)::INT INTO v_productos_total
    FROM productos WHERE COALESCE(estado, 'activo') = 'activo';

    RETURN jsonb_build_object(
        'periodo', p_periodo,
        'desde', v_desde,
        'ventas_total', v_ventas_total,
        'ventas_count', v_ventas_count,
        'ticket_promedio', round(v_ticket_promedio, 2),
        'costo_total', v_costo_total,
        'ganancia_bruta', v_ventas_total - v_costo_total,
        'productos_stock_bajo', v_productos_bajos,
        'productos_activos', v_productos_total
    );
END;
$$;

GRANT EXECUTE ON FUNCTION obtener_metricas_dashboard(TEXT, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION obtener_metricas_dashboard(TEXT, TIMESTAMPTZ) TO anon;

