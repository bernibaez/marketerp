import xlsx from 'xlsx';

const excelPath = 'data/Productos - SUPERMERCADO REMANENTE.xlsx';
const wb = xlsx.readFile(excelPath);
const sheet = wb.Sheets[wb.SheetNames[0]];
const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 });

let negCount = 0;
for (let i = 2; i < rows.length; i++) {
  const r = rows[i];
  const stockStr = r[7];
  if (stockStr && typeof stockStr === 'string' && stockStr.includes('-') && stockStr.trim() !== '--') {
    console.log('Negative stock found:', r[3], stockStr, r[12]);
    negCount++;
  }
}
console.log('Total negative stock rows:', negCount);

