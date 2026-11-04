import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import xlsx from 'xlsx';

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

async function checkNotFound() {
  const excelPath = 'C:/Users/Owner/Downloads/Productos - SUPERMERCADO REMANENTE.xlsx';
  const wb = xlsx.readFile(excelPath);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 });

  // fetch all DB
  let all = [];
  let page = 0;
  const pageSize = 1000;
  while (true) {
    const { data } = await supabase.from('productos').select('id, sku, codigo_barras, nombre, stock_actual').range(page * pageSize, (page + 1) * pageSize - 1);
    all = all.concat(data);
    if (data.length < pageSize) break;
    page++;
  }

  const dbBySku = new Map();
  const dbByName = new Map();
  for (const p of all) {
    if (p.sku) dbBySku.set(String(p.sku).trim().toLowerCase(), p);
    if (p.codigo_barras) dbBySku.set(String(p.codigo_barras).trim().toLowerCase(), p);
    if (p.nombre) dbByName.set(p.nombre.trim().toLowerCase(), p);
  }

  const notFoundList = [];

  for (let i = 2; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.length < 13) continue;
    const rawName = r[3]?.toString().trim() || '';
    const cleanName = rawName.replace(/\s+Inactive$/i, '').trim().toLowerCase();
    const prodType = r[8]?.toString().trim();
    let sku = r[12]?.toString().trim();
    if (sku) sku = sku.replace(/^https?:\/\/[^\/]+\//, '');
    if (prodType === 'Combo' && (!r[7] || String(r[7]).trim() === '--')) continue;

    const matchedSku = sku ? dbBySku.get(sku.toLowerCase()) : null;
    const matchedName = dbByName.get(cleanName) || dbByName.get(rawName.toLowerCase());

    if (!matchedSku) {
      notFoundList.push({
        row: i + 1,
        rawName,
        sku,
        stock: r[7],
        foundByName: matchedName ? { id: matchedName.id, sku: matchedName.sku, nombre: matchedName.nombre } : null
      });
    }
  }

  console.log(`Total not found by SKU: ${notFoundList.length}`);
  console.log(JSON.stringify(notFoundList, null, 2));
}

checkNotFound();

