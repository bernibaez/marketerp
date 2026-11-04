import xlsx from 'xlsx';

const filePath = 'C:/Users/Owner/Downloads/Productos - SUPERMERCADO REMANENTE.xlsx';
const workbook = xlsx.readFile(filePath);

console.log('Sheet names:', workbook.SheetNames);

const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];
const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });

console.log(`Total rows in sheet '${sheetName}':`, data.length);
console.log('First 5 rows:');
for (let i = 0; i < Math.min(5, data.length); i++) {
  console.log(`Row ${i}:`, JSON.stringify(data[i]));
}

