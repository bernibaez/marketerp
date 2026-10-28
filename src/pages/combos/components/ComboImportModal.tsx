import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Upload, FileText, CheckCircle2, AlertCircle } from 'lucide-react';
import { Combo, DEFAULT_COMBOS, saveCombos, getCombos } from '@/lib/comboStore';
import { toast } from '@/lib/toast';

interface ComboImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess: () => void;
}

export default function ComboImportModal({
  isOpen,
  onClose,
  onImportSuccess,
}: ComboImportModalProps) {
  const [jsonText, setJsonText] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);

  if (!isOpen) return null;

  const handleProcessImport = (content: string) => {
    try {
      const parsed = JSON.parse(content);
      const listToImport: Combo[] = Array.isArray(parsed) ? parsed : [parsed];

      if (listToImport.length === 0 || !listToImport[0].name) {
        toast.error('Formato de archivo inválido. Asegúrate de incluir objetos de combo válidos.');
        return;
      }

      const existing = getCombos();
      const merged = [...listToImport, ...existing];
      saveCombos(merged);

      toast.success(`¡Éxito! Se importaron ${listToImport.length} combo(s) correctamente.`);
      onImportSuccess();
      onClose();
    } catch {
      toast.error('Error al procesar el archivo JSON. Revisa la sintaxis.');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      handleProcessImport(text);
    };
    reader.readAsText(file);
  };

  const handleLoadDemoPreset = () => {
    saveCombos(DEFAULT_COMBOS);
    toast.success('Se cargaron los combos de demostración predeterminados.');
    onImportSuccess();
    onClose();
  };

  const modalContent = (
    <div className="dialog-inline-host !z-[9999]">
      <div className="bg-card w-full max-w-lg rounded-3xl border border-border/80 shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-6 border-b border-border/80 bg-secondary/30">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary/10 text-primary rounded-xl">
              <Upload size={22} />
            </div>
            <div>
              <h2 className="text-lg font-black text-foreground">Importar Combos</h2>
              <p className="text-xs text-muted-foreground">Carga combos en lote desde un archivo JSON o CSV</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Dropzone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragOver(false);
              const file = e.dataTransfer.files?.[0];
              if (file) {
                const reader = new FileReader();
                reader.onload = (ev) => handleProcessImport(ev.target?.result as string);
                reader.readAsText(file);
              }
            }}
            className={`p-8 border-2 border-dashed rounded-2xl text-center space-y-3 transition-colors ${
              isDragOver ? 'border-primary bg-primary/5' : 'border-border/80 bg-secondary/20'
            }`}
          >
            <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto">
              <FileText size={24} />
            </div>
            <div>
              <p className="text-sm font-extrabold text-foreground">Arrastra y suelta tu archivo JSON aquí</p>
              <p className="text-xs text-muted-foreground mt-0.5">o selecciona un archivo desde tu equipo</p>
            </div>
            <label className="btn-secondary text-xs font-bold inline-block cursor-pointer px-4 py-2">
              Examinar archivo...
              <input type="file" accept=".json,.csv" onChange={handleFileChange} className="hidden" />
            </label>
          </div>

          <div className="relative flex py-1 items-center">
            <div className="flex-grow border-t border-border/80"></div>
            <span className="flex-shrink mx-4 text-xs font-bold text-muted-foreground">O pegar texto JSON</span>
            <div className="flex-grow border-t border-border/80"></div>
          </div>

          <textarea
            rows={4}
            value={jsonText}
            onChange={(e) => setJsonText(e.target.value)}
            placeholder='[{"name": "Combo Demo", "code": "CMB-100", "price": 450, ...}]'
            className="input-field text-xs font-mono p-3 w-full"
          />

          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={handleLoadDemoPreset}
              className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
            >
              <CheckCircle2 size={14} /> Restaurar catálogo demo
            </button>

            <button
              type="button"
              onClick={() => handleProcessImport(jsonText)}
              disabled={!jsonText.trim()}
              className="btn-primary text-xs font-bold px-4 py-2 disabled:opacity-50"
            >
              Procesar Texto
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
}
