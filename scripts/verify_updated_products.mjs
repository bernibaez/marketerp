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

const sampleSkus = [
  '42',             // Ace Detallado
  '2343',           // Bandeja De Aluminio Mediana
  '6469',           // Bizcocho De Pasas
  '61',             // CHORIZO (LONGANIZA PARRILLERA)
  '728028418651',   // PAN DE HAMBURGUESA
  '7467266060064',  // PAN INTEGRAL PQ PEROZO
  '790330082011',   // LECHE RICA POLVO 125G
  '7533880000240',  // Alcaparras La Sevillana 14oz (new)
  '7468572200069',  // Envase Plastifar 4onz 50und (new)
  '00021000644216', // Kraft Dressing Italian 8oz
  '7460193700096'   // Aceite Crisol 16oz
];

async function verify() {
  const { data, error } = await supabase
    .from('productos')
    .select('sku, nombre, unidad, precio_costo, precio_venta, stock_actual, estado, es_pesado')
    .in('sku', sampleSkus);

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('--- VERIFICATION OF SAMPLE PRODUCTS IN SUPABASE ---');
  for (const p of data) {
    const isAgotado = p.stock_actual <= 0;
    console.log(`SKU: ${p.sku.padEnd(14)} | Stock: ${String(p.stock_actual).padEnd(5)} | Estado: ${p.estado} | ${isAgotado ? '❌ AGOTADO' : '✅ DISPONIBLE'} | ${p.nombre}`);
  }
}

verify();

