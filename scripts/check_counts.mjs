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

async function checkCounts() {
  const { count: prodCount, error: pErr } = await supabase.from('productos').select('*', { count: 'exact', head: true });
  const { count: comboCount, error: cErr } = await supabase.from('combos').select('*', { count: 'exact', head: true });
  console.log('Productos count:', prodCount, pErr);
  console.log('Combos count:', comboCount, cErr);
}

checkCounts();

