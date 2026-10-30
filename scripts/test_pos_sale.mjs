import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envText = fs.readFileSync('.env', 'utf-8');
const env = {};
envText.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = match[2] || '';
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
    env[match[1]] = value.trim();
  }
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function testSale() {
  // Get an existing product
  const { data: prod } = await supabase.from('productos').select('*').limit(1).single();
  console.log('Using product:', prod.id, prod.nombre);

  const payload = {
    cajero_id: null,
    cajero_nombre: 'Cajero Prueba',
    cliente_id: null,
    cliente_nombre: 'Cliente General',
    caja_id: '1',
    subtotal: prod.precio_venta,
    monto_impuesto: 0,
    monto_descuento: 0,
    monto_total: prod.precio_venta,
    costo_total: prod.precio_costo,
    metodo_pago: 'efectivo',
    monto_pagado: prod.precio_venta,
    monto_efectivo: prod.precio_venta,
    monto_tarjeta: 0,
    monto_transferencia: 0,
    monto_credito: 0,
    devuelta_entregada: 0,
    ncf: null,
    tipo_ncf: null,
    items: [
      {
        producto_id: prod.id,
        combo_id: null,
        tipo_item: 'producto',
        nombre_item: prod.nombre,
        sku: prod.sku,
        precio_unitario: prod.precio_venta,
        costo_unitario: prod.precio_costo,
        cantidad: 1,
        porcentaje_impuesto: 0,
        subtotal: prod.precio_venta
      }
    ]
  };

  const { data, error } = await supabase.rpc('procesar_venta_pos', { p_payload: payload });
  console.log('Result from procesar_venta_pos:');
  console.log('Error:', error);
  console.log('Data:', data);
}

testSale();

