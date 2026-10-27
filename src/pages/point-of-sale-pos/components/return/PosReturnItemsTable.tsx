import React from 'react';
import { RotateCcw, Plus, Minus } from 'lucide-react';

export interface SaleItem {
  producto_id: string | null;
  sku: string;
  name: string;
  price: number;
  cost: number;
  maxQty: number;
}

interface PosReturnItemsTableProps {
  currentItems: SaleItem[];
  invoiceCode?: string;
  qty: Record<string, number>;
  onUpdateQty: (key: string, qty: number) => void;
  onToggleAll: () => void;
  isFullReturn: boolean;
}

export const PosReturnItemsTable: React.FC<PosReturnItemsTableProps> = ({
  currentItems,
  invoiceCode,
  qty,
  onUpdateQty,
  onToggleAll,
  isFullReturn,
}) => {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-2xs space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-bold text-slate-900 text-base">Productos de la Factura</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Selecciona y ajusta las unidades exactas a devolver
          </p>
        </div>
        <span className="text-xs font-medium text-slate-400">
          {currentItems.length} {currentItems.length === 1 ? 'item cargado' : 'items cargados'}
        </span>
      </div>

      {/* Empty State vs Loaded Items */}
      {currentItems.length === 0 ? (
        <div className="py-14 text-center">
          <div className="w-14 h-14 rounded-full bg-slate-100/90 border border-slate-200/60 flex items-center justify-center mx-auto mb-3.5 text-slate-400">
            <RotateCcw size={22} className="text-slate-400" />
          </div>
          <p className="font-bold text-slate-800 text-sm mb-1">No hay factura cargada</p>
          <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
            Busca por número de factura o NCF arriba, o bien selecciona una venta reciente del listado para comenzar el proceso.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs pb-1">
            <span className="font-mono font-bold text-[#007052]">
              Factura: {invoiceCode}
            </span>
            <button
              type="button"
              onClick={onToggleAll}
              className="text-xs font-bold text-[#007052] hover:underline cursor-pointer"
            >
              {isFullReturn ? 'Desmarcar Todos' : 'Devolver Todos los Items'}
            </button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200/80">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50/90 border-b border-slate-200/80 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="py-2.5 px-3">Producto</th>
                  <th className="py-2.5 px-3 text-center">Comprados</th>
                  <th className="py-2.5 px-3 text-right">Precio Unit.</th>
                  <th className="py-2.5 px-3 text-center w-36">Cant. a Devolver</th>
                  <th className="py-2.5 px-3 text-right">Subtotal Devolución</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {currentItems.map((l, idx) => {
                  const key = `${l.sku}-${idx}`;
                  const returnQty = qty[key] ?? 0;
                  return (
                    <tr key={key} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-3">
                        <p className="font-bold text-slate-800 text-xs">{l.name}</p>
                        <p className="text-[10px] font-mono text-slate-400 mt-0.5">{l.sku}</p>
                      </td>
                      <td className="py-3 px-3 text-center font-bold text-slate-800">
                        {l.maxQty}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-medium text-slate-700">
                        RD$ {l.price.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => onUpdateQty(key, Math.max(0, returnQty - 1))}
                            className="w-6 h-6 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition cursor-pointer"
                            title="Disminuir"
                          >
                            <Minus size={12} />
                          </button>
                          <input
                            type="number"
                            min={0}
                            max={l.maxQty}
                            className="w-14 py-1 px-1 text-center font-bold text-xs rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:border-[#007052] outline-none"
                            value={returnQty}
                            onChange={(e) =>
                              onUpdateQty(
                                key,
                                Math.min(l.maxQty, Math.max(0, parseInt(e.target.value, 10) || 0))
                              )
                            }
                          />
                          <button
                            type="button"
                            onClick={() => onUpdateQty(key, Math.min(l.maxQty, returnQty + 1))}
                            className="w-6 h-6 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition cursor-pointer"
                            title="Aumentar"
                          >
                            <Plus size={12} />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              onUpdateQty(key, returnQty === l.maxQty ? 0 : l.maxQty)
                            }
                            className="text-[10px] font-bold px-2 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-600 transition cursor-pointer"
                            title="Devolver todo"
                          >
                            Todo
                          </button>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                        RD$ {(returnQty * l.price).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
