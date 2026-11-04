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

function toDbStock(val) {
  if (val === null || val === undefined) return null;
  if (val <= 0) return 0;
  if (val > 0 && val < 1) return 1;
  return Math.round(val);
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
  console.log('====================================================');
  console.log('   ACTUALIZACIÓN DE STOCK Y CATÁLOGO DESDE EXCEL    ');
  console.log('====================================================');
  const t0 = Date.now();

  const dbProducts = await fetchAllSupabaseProducts();
  console.log(`Productos cargados desde Supabase: ${dbProducts.length}`);

  const dbBySku = new Map();
  const dbByBarcode = new Map();
  for (const p of dbProducts) {
    if (p.sku) dbBySku.set(String(p.sku).trim().toLowerCase(), p);
    if (p.codigo_barras) dbByBarcode.set(String(p.codigo_barras).trim().toLowerCase(), p);
  }

  const excelPath = 'data/Productos - SUPERMERCADO REMANENTE.xlsx';
  const wb = xlsx.readFile(excelPath);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 });
  console.log(`Filas leídas de Excel: ${rows.length}`);

  const updates = [];
  const inserts = [];
  let noChangeCount = 0;
  let stockUpdatedCount = 0;
  let restoredFromZeroCount = 0;
  let depletedToZeroCount = 0;

  for (let i = 2; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.length < 13) continue;

    const rawName = r[3]?.toString().trim() || '';
    if (!rawName || rawName.startsWith('Add to location')) continue;

    const action = r[2]?.toString().trim() || '';
    const isInactive = action.includes('Reactivate') || rawName.endsWith(' Inactive');
    const cleanName = rawName.replace(/\s+Inactive$/i, '').trim();

    const cost = parseMoney(r[5]);
    const price = parseMoney(r[6]);
    const { stock, rawStock, unit } = parseStockAndUnit(r[7]);
    const prodType = r[8]?.toString().trim();
    const brand = r[10]?.toString().trim();
    let sku = r[12]?.toString().trim();

    if (sku) {
      sku = sku.replace(/^https?:\/\/[^\/]+\//, '');
    }

    if (!sku) continue;

    // Combos without inventory tracking
    if (prodType === 'Combo' && stock === null) continue;

    const existing = dbBySku.get(sku.toLowerCase()) || dbByBarcode.get(sku.toLowerCase());

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

    // 1. Stock update
    if (stock !== null && Number(existing.stock_actual) !== stock) {
      patch.stock_actual = stock;
      hasChanges = true;
      stockUpdatedCount++;
      if (Number(existing.stock_actual) <= 0 && stock > 0) {
        restoredFromZeroCount++;
      } else if (Number(existing.stock_actual) > 0 && stock <= 0) {
        depletedToZeroCount++;
      }
    }

    // 2. Cost price update
    if (cost > 0 && Math.abs(Number(existing.precio_costo) - cost) > 0.009) {
      patch.precio_costo = cost;
      hasChanges = true;
    }

    // 3. Sale price update
    if (price > 0 && Math.abs(Number(existing.precio_venta) - price) > 0.009) {
      patch.precio_venta = price;
      if (existing.es_pesado || existing.sale_type === 'weight') {
        patch.price_per_weight = price;
      }
      hasChanges = true;
    }

    // 4. Brand update if missing in DB
    if (brand && !existing.marca) {
      patch.marca = brand;
      hasChanges = true;
    }

    // 5. Unit update
    if (unit && unit !== existing.unidad && prodType !== 'Combo') {
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
      updates.push({
        id: existing.id,
        sku: existing.sku,
        nombre: existing.nombre,
        oldStock: Number(existing.stock_actual),
        newStock: stock !== null ? stock : Number(existing.stock_actual),
        patch
      });
    } else {
      noChangeCount++;
    }
  }

  console.log(`\n--- RESUMEN DEL PLAN DE SINCRONIZACIÓN ---`);
  console.log(`Total productos a actualizar en DB: ${updates.length}`);
  console.log(` - Con cambio de stock: ${stockUpdatedCount}`);
  console.log(` - Reactivados con stock (estaban en 0): ${restoredFromZeroCount}`);
  console.log(` - Ahora agotados (pasaron a 0): ${depletedToZeroCount}`);
  console.log(`Nuevos productos a insertar: ${inserts.length}`);
  console.log(`Productos sin cambios necesarios: ${noChangeCount}`);

  // 1. Process inserts
  let insertedCount = 0;
  if (inserts.length > 0) {
    console.log(`\nInsertando ${inserts.length} nuevos productos...`);
    for (const item of inserts) {
      const { data, error } = await supabase.from('productos').insert(item).select();
      if (error) {
        console.error(`Error al insertar ${item.sku} - ${item.nombre}:`, error.message);
      } else {
        insertedCount++;
        console.log(`  ✓ Insertado: SKU ${item.sku} | ${item.nombre} | Stock inicial: ${item.stock_actual}`);
      }
    }
  }

  // 2. Process updates in batches of 25
  const BATCH_SIZE = 25;
  let updatedSuccessCount = 0;
  let updateErrorCount = 0;
  const errors = [];

  console.log(`\nProcesando actualizaciones en lotes de ${BATCH_SIZE}...`);
  for (let i = 0; i < updates.length; i += BATCH_SIZE) {
    const chunk = updates.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(
      chunk.map(async ({ id, sku, nombre, patch }) => {
        const { error } = await supabase.from('productos').update(patch).eq('id', id);
        if (error) {
          return { success: false, sku, nombre, error: error.message };
        }
        return { success: true, sku, nombre };
      })
    );

    for (const res of results) {
      if (res.success) {
        updatedSuccessCount++;
      } else {
        updateErrorCount++;
        errors.push(res);
        console.error(`  ✗ Error al actualizar SKU ${res.sku} (${res.nombre}):`, res.error);
      }
    }

    const processed = Math.min(i + BATCH_SIZE, updates.length);
    if (processed % 100 === 0 || processed === updates.length) {
      console.log(`  Progreso: ${processed} / ${updates.length} procesados (${Math.round((processed / updates.length) * 100)}%)`);
    }
  }

  const durationSec = ((Date.now() - t0) / 1000).toFixed(1);
  console.log('\n====================================================');
  console.log('             SINCRONIZACIÓN COMPLETADA              ');
  console.log('====================================================');
  console.log(`Tiempo total: ${durationSec}s`);
  console.log(`Productos actualizados exitosamente: ${updatedSuccessCount}`);
  console.log(`Productos nuevos insertados: ${insertedCount}`);
  console.log(`Errores de actualización: ${updateErrorCount}`);

  // 3. Post-sync verification
  console.log('\n--- VERIFICACIÓN FINAL EN SUPABASE ---');
  const { count: finalTotal } = await supabase.from('productos').select('*', { count: 'exact', head: true });
  const { count: finalZeroStock } = await supabase.from('productos').select('*', { count: 'exact', head: true }).lte('stock_actual', 0);
  const { count: finalPositiveStock } = await supabase.from('productos').select('*', { count: 'exact', head: true }).gt('stock_actual', 0);

  console.log(`Total productos en la base de datos: ${finalTotal}`);
  console.log(`Productos con stock disponible (> 0): ${finalPositiveStock}`);
  console.log(`Productos agotados (<= 0): ${finalZeroStock}`);
}

runSync().catch(err => {
  console.error('Fatal error running sync:', err);
  process.exit(1);
});

