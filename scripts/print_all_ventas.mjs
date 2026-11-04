import xlsx from 'xlsx';

const excelPath = 'data/Todas las ventas - SUPERMERCADO REMANENTE.xlsx';
const wb = xlsx.readFile(excelPath);
const sheet = wb.Sheets[wb.SheetNames[0]];
const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 });

console.log('Total sales rows:', rows.length - 2);
for (let i = 2; i < rows.length; i++) {
  const r = rows[i];
  console.log(`Venta ${i - 1}: Factura=${r[2]}, Fecha=${r[1]}, Cliente=${r[3]}, Total=${r[8]}, Metodo=${r[7]}, Cajero=${r[14]}, Items=${r[13]}`);
}

