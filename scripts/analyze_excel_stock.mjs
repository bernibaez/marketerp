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

function normalizeUnit(raw) {
  if (!raw) return 'Unidad';
  const u = raw.toUpperCase();
  if (u.includes('LIBRA') || u === 'LB') return 'Libra';
  if (u.includes('UNIDAD') || u.includes('PIECES') || u.includes('UND')) return 'Unidad';
  if (u.includes('PAQUETE') || u.includes('PQ')) return 'Paquete';
  if (u.includes('CARTON') || u.includes('CARTÓN')) return 'Cartón';
  if (u.includes('FUNDA')) return 'Funda';
  if (u.includes('CAJA')) return 'Caja';
  if (u.includes('SACO')) return 'Saco';
  if (u.includes('SAQUITO')) return 'Saquito';
  if (u.includes('SOBRE')) return 'Sobre';
  if (u.includes('FARDO')) return 'Fardo';
  return raw;
}

function parseStockAndUnit(str) {
  if (!str || String(str).trim() === '--') return { stock: null, rawStock: null, unit: null };
  const s = String(str).trim();
  const parts = s.split(/\s+/);
  const num = parseFloat(parts[0].replace(/,/g, ''));
  const rawUnit = parts.slice(1).join(' ').trim();
  return {
    stock: isNaN(num) ? null : toDbStock(num),
    rawStock: isNaN(num) ? null : num,
    unit: normalizeUnit(rawUnit)
  };
}

function toDbStock(val) {
  if (val === null || val === undefined) return null;
  if (val <= 0) return 0;
  if (val > 0 && val < 1) return 1;
  return Math.round(val);
}

function parseMoney(str) {
  if (str === null || str === undefined) return 0;
  if (typeof str === 'number') return Math.round(str * 100) / 100;
  const clean = String(str).replace(/RD\$\s*/g, '').replace(/,/g, '').trim();
  const n = parseFloat(clean);
  return isNaN(n) ? 0 : Math.round(n * 100) / 100;
}

async function fetchAllSupabaseProducts() {
  let all = [];
  let page = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await supabase
      .from('productos')
      .select('id, sku, codigo_barras, nombre, precio_costo, precio_venta, stock_actual, unidad, estado, es_pesado')
      .range(page * pageSize, (page + 1) * pageSize - 1);
    if (error) {
      console.error('Error fetching page', page, error);
      break;
    }
    all = all.concat(data);
    if (data.length < pageSize) break;
    page++;
  }
  return all;
}

async function analyze() {
  const dbProducts = await fetchAllSupabaseProducts();
  console.log(`DB products loaded: ${dbProducts.length}`);

  const dbBySku = new Map();
  const dbByBarcode = new Map();
  for (const p of dbProducts) {
    if (p.sku) dbBySku.set(String(p.sku).trim(), p);
    if (p.codigo_barras) dbByBarcode.set(String(p.codigo_barras).trim(), p);
  }

  const excelPath = 'C:/Users/Owner/Downloads/Productos - SUPERMERCADO REMANENTE.xlsx';
  const wb = xlsx.readFile(excelPath);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 });

  console.log(`Excel total rows: ${rows.length}`);

  let matched = 0;
  let notFound = [];
  let stockDiffs = [];
  let combosIgnored = 0;

  for (let i = 2; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.length < 13) continue;

    const rawName = r[3]?.toString().trim() || '';
    const cost = parseMoney(r[5]);
    const price = parseMoney(r[6]);
    const { stock, rawStock, unit } = parseStockAndUnit(r[7]);
    const prodType = r[8]?.toString().trim();
    let sku = r[12]?.toString().trim();

    if (sku) {
      sku = sku.replace(/^https?:\/\/[^\/]+\//, '');
    }

    if (prodType === 'Combo' && stock === null) {
      combosIgnored++;
      continue;
    }

    const existing = dbBySku.get(sku) || dbByBarcode.get(sku);
    if (!existing) {
      notFound.push({ row: i + 1, sku, name: rawName, stock, price, cost });
    } else {
      matched++;
      const currentDbStock = Number(existing.stock_actual);
      if (stock !== null && currentDbStock !== stock) {
        stockDiffs.push({
          id: existing.id,
          sku,
          name: existing.nombre,
          excelName: rawName,
          oldStock: currentDbStock,
          newStock: stock,
          rawStock,
          unit: existing.unidad
        });
      }
    }
  }

  console.log(`Matched products: ${matched}`);
  console.log(`Combos without stock: ${combosIgnored}`);
  console.log(`Not found in DB: ${notFound.length}`);
  console.log(`Products with stock differences: ${stockDiffs.length}`);

  if (notFound.length > 0) {
    console.log('First 5 not found:', notFound.slice(0, 5));
  }

  console.log('Sample stock diffs (first 10):');
  console.log(stockDiffs.slice(0, 10));
}

analyze();

