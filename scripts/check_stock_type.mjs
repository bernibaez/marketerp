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

async function checkStockType() {
  // Let's check products with decimals in stock_actual
  const { data, error } = await supabase
    .from('productos')
    .select('id, nombre, stock_actual, es_pesado, unidad')
    .gt('stock_actual', 0)
    .limit(20);
  console.log('Products with stock > 0:', data);

  // Let's test updating a test stock or checking if decimals are accepted
  // Let's find one product to see if stock_actual has decimals or can have decimals
  const { data: decData } = await supabase
    .from('productos')
    .select('id, nombre, stock_actual')
    .filter('stock_actual', 'neq', Math.round(data?.[0]?.stock_actual || 0))
    .limit(5);
  console.log('Dec data:', decData);
}

checkStockType();

