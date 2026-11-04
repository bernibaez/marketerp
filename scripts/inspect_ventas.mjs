import xlsx from 'xlsx';

const excelPath = 'data/Todas las ventas - SUPERMERCADO REMANENTE.xlsx';
const wb = xlsx.readFile(excelPath);
console.log('Sheets in ventas file:', wb.SheetNames);

const sheet = wb.Sheets[wb.SheetNames[0]];
const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 });

console.log('Total rows in ventas:', rows.length);
console.log('First 5 rows:');
for (let i = 0; i < Math.min(5, rows.length); i++) {
  console.log(`Row ${i}:`, JSON.stringify(rows[i]));
}

