import React from 'react';
import { Info, RefreshCw } from 'lucide-react';
import CategoryIcon from '@/components/ui/CategoryIcon';

interface ComboGeneralInfoCardProps {
  formId: string;
  name: string;
  setName: (val: string) => void;
  category: string;
  setCategory: (val: string) => void;
  code: string;
  setCode: (val: string) => void;
  barcode: string;
  setBarcode: (val: string) => void;
  description: string;
  setDescription: (val: string) => void;
  onGenerateBarcode: () => void;
  categories: string[];
}

export const ComboGeneralInfoCard: React.FC<ComboGeneralInfoCardProps> = ({
  formId,
  name,
  setName,
  category,
  setCategory,
  code,
  setCode,
  barcode,
  setBarcode,
  description,
  setDescription,
  onGenerateBarcode,
  categories,
}) => {
  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center gap-2 border-b border-border pb-3">
        <Info size={18} className="text-primary" />
        <h3 className="font-semibold text-foreground">1. Información General</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor={`${formId}-name`} className="text-xs font-bold text-muted-foreground mb-1 block">
            Nombre del Combo *
          </label>
          <input
            id={`${formId}-name`}
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej. Combo Desayuno Familiar"
            className="input-field text-sm font-semibold"
          />
        </div>

        <div>
          <label htmlFor={`${formId}-category`} className="text-xs font-bold text-muted-foreground mb-1 block">
            Categoría
          </label>
          <select
            id={`${formId}-category`}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="input-field text-sm font-semibold"
          >
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor={`${formId}-code`} className="text-xs font-bold text-muted-foreground mb-1 block">
            Código Interno *
          </label>
          <input
            id={`${formId}-code`}
            type="text"
            required
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Ej. CMB-001"
            className="input-field text-sm font-mono font-bold"
          />
        </div>

        <div>
          <label htmlFor={`${formId}-barcode`} className="text-xs font-bold text-muted-foreground mb-1 block">
            Código de Barras
          </label>
          <div className="flex items-center gap-2">
            <input
              id={`${formId}-barcode`}
              type="text"
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              placeholder="7892000100101"
              className="input-field text-sm font-mono font-bold flex-1"
            />
            <button
              type="button"
              onClick={onGenerateBarcode}
              className="btn-secondary text-xs font-bold p-2.5 flex items-center gap-1"
              title="Generar código aleatorio"
            >
              <RefreshCw size={14} />
            </button>
          </div>
        </div>
      </div>

      <div>
        <label htmlFor={`${formId}-description`} className="text-xs font-bold text-muted-foreground mb-1 block">
          Descripción del Combo
        </label>
        <textarea
          id={`${formId}-description`}
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Breve descripción del contenido o promoción del combo..."
          className="input-field text-sm font-medium"
        />
      </div>

      <div>
        <label className="text-xs font-bold text-muted-foreground mb-1.5 block">
          Icono Representativo del Combo
        </label>
        <div className="flex items-center gap-3 p-3 bg-secondary/40 rounded-xl border border-border/60">
          <CategoryIcon category={category} name={name} isCombo size="lg" />
          <div>
            <span className="text-xs font-bold text-foreground block">Icono por categoría</span>
            <span className="text-[11px] text-muted-foreground block">Icono visual asignado a "{category || 'Combo'}"</span>
          </div>
        </div>
      </div>
    </div>
  );
};
