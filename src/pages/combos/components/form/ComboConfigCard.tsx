import React from 'react';
import { Store, CheckSquare } from 'lucide-react';

interface ComboConfigCardProps {
  active: boolean;
  setActive: (val: boolean) => void;
  visibleInPos: boolean;
  setVisibleInPos: (val: boolean) => void;
  allowSaleWithoutStock: boolean;
  setAllowSaleWithoutStock: (val: boolean) => void;
  applyTax: boolean;
  setApplyTax: (val: boolean) => void;
  allBranches: boolean;
  setAllBranches: (val: boolean) => void;
  selectedBranches: string[];
  setSelectedBranches: React.Dispatch<React.SetStateAction<string[]>>;
  branchesList: string[];
}

export const ComboConfigCard: React.FC<ComboConfigCardProps> = ({
  active,
  setActive,
  visibleInPos,
  setVisibleInPos,
  allowSaleWithoutStock,
  setAllowSaleWithoutStock,
  applyTax,
  setApplyTax,
  allBranches,
  setAllBranches,
  selectedBranches,
  setSelectedBranches,
  branchesList,
}) => {
  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center gap-2 border-b border-border pb-3">
        <Store size={18} className="text-primary" />
        <h3 className="font-semibold text-foreground">4. Configuración & Sucursales</h3>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <label className="flex items-center justify-between p-3 rounded-xl bg-secondary/30 border border-border/60 cursor-pointer">
          <div>
            <span className="text-xs font-extrabold text-foreground flex items-center gap-1">
              <CheckSquare size={14} className="text-emerald-600 dark:text-emerald-400" /> Activo
            </span>
            <span className="text-[11px] text-muted-foreground">Habilitar combo en el sistema</span>
          </div>
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
            className="w-5 h-5 accent-primary rounded cursor-pointer"
          />
        </label>

        <label className="flex items-center justify-between p-3 rounded-xl bg-secondary/30 border border-border/60 cursor-pointer">
          <div>
            <span className="text-xs font-extrabold text-foreground flex items-center gap-1">
              <CheckSquare size={14} className="text-emerald-600 dark:text-emerald-400" /> Visible en POS
            </span>
            <span className="text-[11px] text-muted-foreground">Mostrar botón en Terminal POS</span>
          </div>
          <input
            type="checkbox"
            checked={visibleInPos}
            onChange={(e) => setVisibleInPos(e.target.checked)}
            className="w-5 h-5 accent-primary rounded cursor-pointer"
          />
        </label>

        <label className="flex items-center justify-between p-3 rounded-xl bg-secondary/30 border border-border/60 cursor-pointer">
          <div>
            <span className="text-xs font-extrabold text-foreground flex items-center gap-1">
              <CheckSquare size={14} className="text-emerald-600 dark:text-emerald-400" /> Permitir venta sin stock
            </span>
            <span className="text-[11px] text-muted-foreground">Permitir vender aun sin existencias</span>
          </div>
          <input
            type="checkbox"
            checked={allowSaleWithoutStock}
            onChange={(e) => setAllowSaleWithoutStock(e.target.checked)}
            className="w-5 h-5 accent-primary rounded cursor-pointer"
          />
        </label>

        <label className="flex items-center justify-between p-3 rounded-xl bg-secondary/30 border border-border/60 cursor-pointer">
          <div>
            <span className="text-xs font-extrabold text-foreground flex items-center gap-1">
              <CheckSquare size={14} className="text-emerald-600 dark:text-emerald-400" /> Aplicar ITBIS / Impuestos
            </span>
            <span className="text-[11px] text-muted-foreground">Calcular impuesto en la venta</span>
          </div>
          <input
            type="checkbox"
            checked={applyTax}
            onChange={(e) => setApplyTax(e.target.checked)}
            className="w-5 h-5 accent-primary rounded cursor-pointer"
          />
        </label>
      </div>

      {/* Branches Configuration */}
      <div className="space-y-3 pt-2">
        <label className="flex items-center justify-between p-3 rounded-xl bg-secondary/30 border border-border/60 cursor-pointer">
          <div>
            <span className="text-xs font-extrabold text-foreground flex items-center gap-1">
              <CheckSquare size={14} className="text-emerald-600 dark:text-emerald-400" /> Disponible en todas las sucursales
            </span>
            <span className="text-[11px] text-muted-foreground">Habilita este combo universalmente</span>
          </div>
          <input
            type="checkbox"
            checked={allBranches}
            onChange={(e) => setAllBranches(e.target.checked)}
            className="w-5 h-5 accent-primary rounded cursor-pointer"
          />
        </label>

        {!allBranches && (
          <div className="p-3 bg-secondary/20 rounded-xl border border-border/60 space-y-2">
            <span className="text-xs font-bold text-muted-foreground block">Seleccionar Sucursales:</span>
            <div className="grid grid-cols-2 gap-2">
              {branchesList.map((b) => (
                <label key={b} className="flex items-center gap-2 text-xs font-semibold text-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedBranches.includes(b)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedBranches((prev) => [...prev, b]);
                      } else {
                        setSelectedBranches((prev) => prev.filter((item) => item !== b));
                      }
                    }}
                    className="w-4 h-4 accent-primary rounded"
                  />
                  {b}
                </label>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
