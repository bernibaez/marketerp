'use client';
import React, { useState } from 'react';
import AppLayout from '@/components/AppLayout';
import { usePathname } from 'next/navigation';
import { Upload, Download, FileText, Package, AlertCircle, CheckCircle, X, RefreshCw } from 'lucide-react';

type ImportType = 'products' | 'stock';

interface ImportLog {
  id: number;
  type: string;
  filename: string;
  date: string;
  total: number;
  success: number;
  errors: number;
  status: 'completed' | 'partial' | 'failed';
}

const mockLogs: ImportLog[] = [
  { id: 1, type: 'Productos', filename: 'productos_enero.xlsx', date: '2024-01-15 10:30', total: 250, success: 248, errors: 2, status: 'partial' },
  { id: 2, type: 'Stock Inicial', filename: 'stock_inicial.csv', date: '2024-01-10 09:15', total: 180, success: 180, errors: 0, status: 'completed' },
  { id: 3, type: 'Productos', filename: 'catalogo_2024.xlsx', date: '2024-01-05 14:00', total: 500, success: 495, errors: 5, status: 'partial' },
  { id: 4, type: 'Stock Inicial', filename: 'inventario_inicial.csv', date: '2023-12-28 11:00', total: 320, success: 320, errors: 0, status: 'completed' },
];

const productFields = ['Código de Barras', 'SKU', 'Nombre', 'Categoría', 'Marca', 'Unidad', 'Proveedor', 'Precio Compra', 'Precio Venta', 'Precio Mayorista', 'ITBIS', 'Stock Mínimo', 'Imagen URL', 'Fecha Vencimiento'];
const stockFields = ['Código de Barras', 'SKU', 'Nombre Producto', 'Cantidad', 'Costo Unitario', 'Ubicación', 'Lote', 'Fecha Vencimiento'];

export default function ImportarPage() {
  const pathname = usePathname();
  const [importType, setImportType] = useState<ImportType>('products');
  const [dragOver, setDragOver] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<string | null>(null);
  const [previewData] = useState([
    { barcode: '7891234567890', sku: 'ARR-001', name: 'Arroz Selecto 5lb', category: 'Alimentos', price: 280, stock: 150 },
    { barcode: '7891234567891', sku: 'ACE-001', name: 'Aceite Vegetal 1L', category: 'Alimentos', price: 350, stock: 80 },
    { barcode: '7891234567892', sku: 'AZU-001', name: 'Azúcar Blanca 2lb', category: 'Alimentos', price: 200, stock: 200 },
  ]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) setUploadedFile(file.name);
  };

  const statusMap = {
    completed: { label: 'Completado', cls: 'badge-success' },
    partial: { label: 'Parcial', cls: 'badge-warning' },
    failed: { label: 'Fallido', cls: 'badge-danger' },
  };

  return (
    <AppLayout currentPath={pathname}>
      <div className="space-y-6 slide-up">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Importar Datos</h1>
            <p className="text-sm text-muted-foreground mt-1">Importar productos y stock inicial desde archivos Excel o CSV</p>
          </div>
        </div>

        {/* Type selector */}
        <div className="flex gap-2">
          <button
            onClick={() => setImportType('products')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${importType === 'products' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'}`}
          >
            <Package size={16} />Importar Productos
          </button>
          <button
            onClick={() => setImportType('stock')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${importType === 'stock' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'}`}
          >
            <RefreshCw size={16} />Importar Stock Inicial
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            {/* Upload area */}
            <div className="card p-6">
              <h3 className="font-semibold text-foreground mb-4">
                {importType === 'products' ? 'Cargar Archivo de Productos' : 'Cargar Archivo de Stock Inicial'}
              </h3>

              <div
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-xl p-10 text-center transition-all cursor-pointer ${dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-secondary/30'}`}
                onClick={() => setUploadedFile('archivo_ejemplo.xlsx')}
              >
                {uploadedFile ? (
                  <div className="space-y-2">
                    <div className="w-12 h-12 bg-success/10 rounded-full flex items-center justify-center mx-auto">
                      <CheckCircle size={24} className="text-success" />
                    </div>
                    <p className="font-medium text-foreground">{uploadedFile}</p>
                    <p className="text-sm text-muted-foreground">Archivo cargado correctamente</p>
                    <button onClick={e => { e.stopPropagation(); setUploadedFile(null); }} className="text-xs text-danger hover:underline flex items-center gap-1 mx-auto">
                      <X size={12} />Remover archivo
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                      <Upload size={28} className="text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">Arrastra tu archivo aquí</p>
                      <p className="text-sm text-muted-foreground mt-1">o haz clic para seleccionar</p>
                    </div>
                    <p className="text-xs text-muted-foreground">Formatos soportados: .xlsx, .xls, .csv — Máx. 10MB</p>
                  </div>
                )}
              </div>

              {uploadedFile && (
                <div className="mt-4 space-y-3">
                  <div className="flex items-center gap-2 p-3 bg-info/10 rounded-lg text-sm text-info">
                    <AlertCircle size={16} />
                    <span>Se encontraron <strong>3 registros</strong> en el archivo. Revisa la vista previa antes de importar.</span>
                  </div>

                  {/* Preview table */}
                  <div className="overflow-x-auto border border-border rounded-lg">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-secondary/50 border-b border-border">
                          <th className="text-left px-3 py-2 text-muted-foreground font-medium">Código Barras</th>
                          <th className="text-left px-3 py-2 text-muted-foreground font-medium">SKU</th>
                          <th className="text-left px-3 py-2 text-muted-foreground font-medium">Nombre</th>
                          <th className="text-left px-3 py-2 text-muted-foreground font-medium">Categoría</th>
                          <th className="text-right px-3 py-2 text-muted-foreground font-medium">Precio</th>
                          <th className="text-right px-3 py-2 text-muted-foreground font-medium">Stock</th>
                          <th className="text-center px-3 py-2 text-muted-foreground font-medium">Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {previewData.map((row, i) => (
                          <tr key={i} className="border-b border-border/50 hover:bg-secondary/20">
                            <td className="px-3 py-2 font-mono text-muted-foreground">{row.barcode}</td>
                            <td className="px-3 py-2 text-muted-foreground">{row.sku}</td>
                            <td className="px-3 py-2 text-foreground font-medium">{row.name}</td>
                            <td className="px-3 py-2 text-muted-foreground">{row.category}</td>
                            <td className="px-3 py-2 text-right text-foreground">RD${row.price}</td>
                            <td className="px-3 py-2 text-right text-foreground">{row.stock}</td>
                            <td className="px-3 py-2 text-center">
                              <span className="badge badge-success text-xs">Válido</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex gap-3">
                    <button className="btn-primary flex items-center gap-2 flex-1">
                      <Upload size={16} />Importar {previewData.length} Registros
                    </button>
                    <button onClick={() => setUploadedFile(null)} className="btn-secondary">Cancelar</button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right panel */}
          <div className="space-y-4">
            {/* Download template */}
            <div className="card p-5 space-y-3">
              <h3 className="font-semibold text-foreground">Plantilla de Importación</h3>
              <p className="text-sm text-muted-foreground">Descarga la plantilla con el formato correcto para importar datos.</p>
              <button className="btn-secondary w-full flex items-center justify-center gap-2">
                <Download size={16} />Descargar Plantilla Excel
              </button>
              <button className="btn-secondary w-full flex items-center justify-center gap-2">
                <FileText size={16} />Descargar Plantilla CSV
              </button>
            </div>

            {/* Required fields */}
            <div className="card p-5 space-y-3">
              <h3 className="font-semibold text-foreground">Campos Requeridos</h3>
              <div className="space-y-1.5">
                {(importType === 'products' ? productFields : stockFields).map((field, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <div className={`w-1.5 h-1.5 rounded-full ${i < 3 ? 'bg-danger' : 'bg-muted-foreground'}`} />
                    <span className={i < 3 ? 'text-foreground font-medium' : 'text-muted-foreground'}>{field}</span>
                    {i < 3 && <span className="text-xs text-danger ml-auto">*</span>}
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">* Campos obligatorios</p>
            </div>
          </div>
        </div>

        {/* Import history */}
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h3 className="font-semibold text-foreground">Historial de Importaciones</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/30">
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium">Tipo</th>
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium">Archivo</th>
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium">Fecha</th>
                  <th className="text-center px-4 py-3 text-muted-foreground font-medium">Total</th>
                  <th className="text-center px-4 py-3 text-muted-foreground font-medium">Exitosos</th>
                  <th className="text-center px-4 py-3 text-muted-foreground font-medium">Errores</th>
                  <th className="text-center px-4 py-3 text-muted-foreground font-medium">Estado</th>
                </tr>
              </thead>
              <tbody>
                {mockLogs.map(log => (
                  <tr key={log.id} className="border-b border-border/50 hover:bg-secondary/20 transition-colors">
                    <td className="px-4 py-3 text-foreground font-medium">{log.type}</td>
                    <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{log.filename}</td>
                    <td className="px-4 py-3 text-muted-foreground">{log.date}</td>
                    <td className="px-4 py-3 text-center text-foreground">{log.total}</td>
                    <td className="px-4 py-3 text-center text-success font-medium">{log.success}</td>
                    <td className="px-4 py-3 text-center text-danger font-medium">{log.errors}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`badge ${statusMap[log.status].cls}`}>{statusMap[log.status].label}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
