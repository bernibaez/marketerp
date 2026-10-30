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

function parseCsv(text) {
  const lines = [];
  let currentLine = [];
  let currentField = '';
  let insideQuote = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (insideQuote && nextChar === '"') {
        currentField += '"';
        i++;
      } else {
        insideQuote = !insideQuote;
      }
    } else if (char === ',' && !insideQuote) {
      currentLine.push(currentField);
      currentField = '';
    } else if ((char === '\r' || char === '\n') && !insideQuote) {
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
      currentLine.push(currentField);
      lines.push(currentLine);
      currentLine = [];
      currentField = '';
    } else {
      currentField += char;
    }
  }
  if (currentField || currentLine.length > 0) {
    currentLine.push(currentField);
    lines.push(currentLine);
  }
  return lines;
}

function parseMoney(str) {
  if (!str) return 0;
  const clean = str.replace(/RD\$\s*/g, '').replace(/,/g, '').trim();
  const n = parseFloat(clean);
  return isNaN(n) ? 0 : Math.round(n * 100) / 100;
}

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
  if (!str || str.trim() === '--') return { stock: null, unit: null };
  const parts = str.trim().split(/\s+/);
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
  if (val > 0 && val < 1) return 1; // Preserve non-zero stock for items with decimal fractions
  return Math.round(val);
}

async function fetchAllSupabaseProducts() {
  let all = [];
  let page = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await supabase
      .from('productos')
      .select('*')
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

async function runSync() {
  console.log('--- STARTING PRODUCT SYNCHRONIZATION WITH SUPABASE (ROUNDED TO INT) ---');
  const t0 = Date.now();

  const dbProducts = await fetchAllSupabaseProducts();
  console.log(`Fetched ${dbProducts.length} current products from Supabase.`);

  const dbBySku = new Map();
  const dbByBarcode = new Map();
  for (const p of dbProducts) {
    if (p.sku) dbBySku.set(String(p.sku).trim(), p);
    if (p.codigo_barras) dbByBarcode.set(String(p.codigo_barras).trim(), p);
  }

  const csvPath = 'C:/Users/Owner/.gemini/antigravity/brain/af7a607e-e513-499d-9885-ea1cf81d0dcd/.user_uploaded/media_1793365161687_8b9f0cfb.csv';
  const content = fs.readFileSync(csvPath, 'utf-8');
  const rows = parseCsv(content);

  const updates = [];
  const inserts = [];
  let noChangeCount = 0;
  let outOfStockRestoredCount = 0;

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.length < 13) continue;

    const rawName = r[3]?.trim();
    const cost = parseMoney(r[5]);
    const price = parseMoney(r[6]);
    const { stock, rawStock, unit } = parseStockAndUnit(r[7]);
    const prodType = r[8]?.trim();
    const brand = r[10]?.trim();
    let sku = r[12]?.trim();

    if (prodType && !['Combo', 'Soltero'].includes(prodType)) continue;

    if (sku) {
      sku = sku.replace(/^https?:\/\/[^\/]+\//, '');
    }

    const action = r[2]?.trim() || '';
    const isInactive = action.includes('Reactivate') || rawName.endsWith(' Inactive');
    const cleanName = rawName.replace(/\s+Inactive$/i, '').trim();

    const existing = dbBySku.get(sku) || dbByBarcode.get(sku);

    if (!existing) {
      const isWeight = unit === 'Libra';
      inserts.push({
        codigo_barras: sku,
        sku: sku,
        nombre: cleanName,
        categoria: 'General',
        marca: brand || null,
        unidad: unit || 'Unidad',
        precio_costo: cost,
        precio_venta: price,
        precio_mayorista: 0,
        porcentaje_impuesto: 0,
        stock_minimo: 10,
        stock_actual: stock !== null ? stock : 0,
        es_pesado: isWeight,
        estado: isInactive ? 'inactivo' : 'activo',
        sale_type: isWeight ? 'weight' : 'unit',
        weight_unit: isWeight ? 'lb' : null,
        price_per_weight: isWeight ? price : null,
        allow_decimal: isWeight
      });
      continue;
    }

    const patch = {};
    let hasChanges = false;

    // Stock update (integer comparison)
    if (stock !== null && Number(existing.stock_actual) !== stock) {
      patch.stock_actual = stock;
      hasChanges = true;
      if (Number(existing.stock_actual) <= 0 && stock > 0) {
        outOfStockRestoredCount++;
      }
    }

    // Cost price update
    if (cost > 0 && Math.abs(Number(existing.precio_costo) - cost) > 0.009) {
      patch.precio_costo = cost;
      hasChanges = true;
    }

    // Sale price update
    if (price > 0 && Math.abs(Number(existing.precio_venta) - price) > 0.009) {
      patch.precio_venta = price;
      if (existing.es_pesado || existing.sale_type === 'weight') {
        patch.price_per_weight = price;
      }
      hasChanges = true;
    }

    // Brand update if DB is null/empty and CSV has brand
    if (brand && !existing.marca) {
      patch.marca = brand;
      hasChanges = true;
    }

    // Unit update
    if (unit && unit !== existing.unidad && !['Combo'].includes(prodType)) {
      patch.unidad = unit;
      if (unit === 'Libra') {
        patch.es_pesado = true;
        patch.sale_type = 'weight';
        patch.weight_unit = 'lb';
        patch.allow_decimal = true;
      }
      hasChanges = true;
    }

    if (hasChanges) {
      patch.actualizado_en = new Date().toISOString();
      updates.push({ id: existing.id, sku: existing.sku, nombre: existing.nombre, patch });
    } else {
      noChangeCount++;
    }
  }

  console.log(`Plans: ${updates.length} updates needed, ${inserts.length} new inserts, ${noChangeCount} unchanged.`);
  console.log(`Products previously at 0 ("Agotado") being restored: ${outOfStockRestoredCount}`);

  // 1. Process inserts (if any remain)
  if (inserts.length > 0) {
    console.log(`Inserting ${inserts.length} new products...`);
    for (const item of inserts) {
      const { data, error } = await supabase.from('productos').insert(item).select();
      if (error) {
        console.error(`Error inserting ${item.sku} - ${item.nombre}:`, error);
      } else {
        console.log(`Inserted new product: ${item.sku} - ${item.nombre}`);
      }
    }
  }

  // 2. Process updates in batches of 25 concurrent requests
  const BATCH_SIZE = 25;
  let updatedCount = 0;
  let errorCount = 0;
  const updateErrors = [];

  for (let i = 0; i < updates.length; i += BATCH_SIZE) {
    const chunk = updates.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(
      chunk.map(async ({ id, sku, nombre, patch }) => {
        const { error } = await supabase.from('productos').update(patch).eq('id', id);
        if (error) {
          return { success: false, sku, nombre, error };
        }
        return { success: true, sku, nombre };
      })
    );

    for (const res of results) {
      if (res.success) {
        updatedCount++;
      } else {
        errorCount++;
        updateErrors.push(res);
        console.error(`Error updating ${res.sku} (${res.nombre}):`, res.error);
      }
    }

    if ((i + BATCH_SIZE) % 50 < BATCH_SIZE || i + BATCH_SIZE >= updates.length) {
      console.log(`Progress: ${Math.min(i + BATCH_SIZE, updates.length)} / ${updates.length} updates processed.`);
    }
  }

  const durationSec = Math.round((Date.now() - t0) / 100) / 10;
  console.log('\n--- SYNC COMPLETED ---');
  console.log(`Duration: ${durationSec}s`);
  console.log(`Successfully updated: ${updatedCount}`);
  console.log(`Update errors: ${errorCount}`);

  // 3. Post-sync verification
  console.log('\n--- POST-SYNC VERIFICATION ---');
  const { count: finalTotal } = await supabase.from('productos').select('*', { count: 'exact', head: true });
  const { count: finalZeroStock } = await supabase.from('productos').select('*', { count: 'exact', head: true }).lte('stock_actual', 0);
  const { count: finalPositiveStock } = await supabase.from('productos').select('*', { count: 'exact', head: true }).gt('stock_actual', 0);

  console.log(`Total products in Supabase: ${finalTotal}`);
  console.log(`Products with stock > 0 (DISPONIBLES / CON STOCK): ${finalPositiveStock}`);
  console.log(`Products with stock <= 0 (AGOTADOS): ${finalZeroStock}`);
}

runSync();
