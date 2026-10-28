-- ============================================================================
-- MIGRACIÓN 018: Corrección de visibilidad de cajero y exactitud de montos en ventas
-- ============================================================================

-- 1. Ampliar es_admin() para reconocer todos los alias de rol administrativo
CREATE OR REPLACE FUNCTION public.es_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.perfiles
    WHERE id = auth.uid()
      AND activo = TRUE
      AND LOWER(TRIM(rol)) IN ('admin', 'super_admin', 'superadmin', 'administrador', 'super administrador')
  );
$$;

-- 2. Permitir lectura de perfiles a usuarios autenticados para que el JOIN
--    perfiles!cajero_id(nombre_completo) en ventas siempre devuelva el nombre exacto del cajero
DROP POLICY IF EXISTS "perfiles_select_own_or_admin" ON public.perfiles;
DROP POLICY IF EXISTS "perfiles_select_authenticated" ON public.perfiles;
CREATE POLICY "perfiles_select_authenticated" ON public.perfiles
  FOR SELECT TO authenticated
  USING (true);

-- 3. Corregir convertir_cotizacion_pos (pasaba p_cotizacion_id en metodo_pago y costo_total = 0)
CREATE OR REPLACE FUNCTION public.convertir_cotizacion_pos(
  p_cotizacion_id uuid,
  p_metodo_pago text DEFAULT 'efectivo',
  p_tipo_ncf text DEFAULT 'B02'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cot public.cotizaciones%ROWTYPE;
  v_items jsonb;
  v_costo_total numeric(14,2) := 0;
  v_payload jsonb;
  v_result jsonb;
BEGIN
  SELECT * INTO v_cot FROM public.cotizaciones WHERE id = p_cotizacion_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cotización no encontrada';
  END IF;

  IF v_cot.estado = 'convertida' THEN
    RAISE EXCEPTION 'Esta cotización ya fue convertida en venta';
  END IF;

  SELECT
    COALESCE(jsonb_agg(
      jsonb_build_object(
        'producto_id', dc.producto_id,
        'tipo_item', 'producto',
        'nombre_item', dc.nombre_item,
        'precio_unitario', dc.precio_unitario,
        'costo_unitario', COALESCE(p.precio_costo, 0),
        'cantidad', dc.cantidad,
        'porcentaje_impuesto', COALESCE(p.porcentaje_impuesto, 18),
        'subtotal', dc.subtotal
      )
    ), '[]'::jsonb),
    COALESCE(SUM(COALESCE(p.precio_costo, 0) * dc.cantidad), 0)
  INTO v_items, v_costo_total
  FROM public.detalle_cotizaciones dc
  LEFT JOIN public.productos p ON p.id = dc.producto_id
  WHERE dc.cotizacion_id = p_cotizacion_id;

  v_payload := jsonb_build_object(
    'cliente_id', v_cot.cliente_id,
    'cajero_id', COALESCE(auth.uid(), v_cot.vendedor_id),
    'tipo_ncf', p_tipo_ncf,
    'subtotal', v_cot.subtotal,
    'monto_impuesto', v_cot.monto_impuesto,
    'monto_descuento', 0,
    'monto_total', v_cot.monto_total,
    'costo_total', v_costo_total,
    'metodo_pago', p_metodo_pago,
    'monto_pagado', v_cot.monto_total,
    'devuelta_entregada', 0,
    'items', v_items
  );

  v_result := public.procesar_venta_pos(v_payload);

  UPDATE public.cotizaciones
  SET estado = 'convertida'
  WHERE id = p_cotizacion_id;

  RETURN v_result;
END;
$$;

