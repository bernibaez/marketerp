import React from 'react';
import ModalShell from '@/components/ui/ModalShell';
import { X, Package, Scale, Edit, Printer, Calendar, CheckCircle } from 'lucide-react';
import type { Product } from '@/lib/initialProducts';

interface ProductDetailModalProps {
  product: Product | null;
  onClose: () => void;
  onEdit: (product: Product) => void;
  onPrintLabel: (product: Product) => void;
}

export const ProductDetailModal: React.FC<ProductDetailModalProps> = ({
  product,
  onClose,
  onEdit,
  onPrintLabel,
}) => {
  if (!product) return null;

  const marginVal = product.salePrice - product.costPrice;
  const marginPct = product.salePrice > 0 ? ((marginVal / product.salePrice) * 100).toFixed(1) : '0';

  const getExpiryTag = (dateStr: string | null | undefined) => {
    if (!dateStr) return { text: 'Sin fecha', badge: false, color: 'text-slate-400' };
    const parts = dateStr.split('-');
    if (parts.length !== 3) return { text: dateStr, badge: false, color: 'text-slate-600' };
    const [yr, mo, day] = parts;
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const expiry = new Date(parseInt(yr), parseInt(mo) - 1, parseInt(day));
    const today = new Date();
    const diffDays = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    const formatted = `${day} ${months[parseInt(mo) - 1]} ${yr}`;
    if (diffDays < 0) {
      return {
        text: `${formatted} (Vencido hace ${Math.abs(diffDays)}d)`,
        badge: true,
        color: 'text-rose-600 bg-rose-50 border-rose-200 dark:bg-rose-950/40 dark:border-rose-800',
      };
    }
    if (diffDays <= 7) {
      return {
        text: `${formatted} (Vence en ${diffDays}d)`,
        badge: true,
        color: 'text-rose-600 bg-rose-50 border-rose-200 dark:bg-rose-950/40 dark:border-rose-800',
      };
    }
    if (diffDays <= 30) {
      return {
        text: `${formatted} (Vence en ${diffDays}d)`,
        badge: true,
        color: 'text-amber-700 bg-amber-50 border-amber-200 dark:bg-amber-950/40 dark:border-amber-800',
      };
    }
    return { text: formatted, badge: false, color: 'text-slate-700 dark:text-slate-300' };
  };

  const expiryTag = getExpiryTag(product.expiryDate);

  return (
    <ModalShell
      open={Boolean(product)}
      onClose={onClose}
      size="2xl"
      className="p-6 max-h-[90vh] overflow-y-auto"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center font-bold">
            <Package size={20} />
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-900 dark:text-white leading-tight">
              Vista Previa del Producto
            </h2>
            <p className="text-xs text-slate-500 font-medium">Especificaciones completas y datos técnicos</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <X size={18} />
        </button>
      </div>

      <div className="space-y-4">
        {/* Main Product Card */}
        <div className="p-4 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-200/80 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <span className="text-[11px] font-bold text-slate-400 block uppercase tracking-wider mb-0.5">
              {product.category}
            </span>
            <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
              {product.name}
            </h3>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <span className="font-mono text-xs text-slate-500 font-semibold">SKU: {product.sku}</span>
              {product.brand && product.brand !== 'Genérico' && product.brand !== '—' && (
                <span className="text-xs text-slate-500 font-medium">• Marca: {product.brand}</span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border ${
                product.status === 'active'
                  ? 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800'
                  : 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
              }`}
            >
              {product.status === 'active' ? <CheckCircle size={13} /> : <X size={13} />}
              <span className="capitalize">{product.status === 'active' ? 'Activo' : 'Inactivo'}</span>
            </span>

            {(product.isWeightProduct || product.saleType === 'weight' || product.saleType === 'both') && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-extrabold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                <Scale size={13} />
                <span>Balanza ({product.weightUnit || 'lb'})</span>
              </span>
            )}

            {product.plu && (
              <span className="px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800">
                PLU {product.plu}
              </span>
            )}
          </div>
        </div>

        {/* Sección 1: Precios y Rentabilidad */}
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
            Precios y Rentabilidad
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
            <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800">
              <span className="text-[10.5px] text-slate-400 font-bold block uppercase mb-0.5">Precio Venta</span>
              <span className="text-sm sm:text-base font-black text-slate-900 dark:text-white tabular-nums">
                RD$ {product.salePrice.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
              </span>
            </div>

            <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800">
              <span className="text-[10.5px] text-slate-400 font-bold block uppercase mb-0.5">Precio Costo</span>
              <span className="text-sm sm:text-base font-bold text-slate-600 dark:text-slate-300 tabular-nums">
                RD$ {product.costPrice.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
              </span>
            </div>

            <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800">
              <span className="text-[10.5px] text-slate-400 font-bold block uppercase mb-0.5">Margen Bruto</span>
              <span className="text-xs sm:text-sm font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
                {marginPct}% (RD$ {marginVal.toFixed(2)})
              </span>
            </div>

            <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800">
              <span className="text-[10.5px] text-slate-400 font-bold block uppercase mb-0.5">Al por Mayor</span>
              <span className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200 tabular-nums">
                {product.wholesalePrice > 0
                  ? `RD$ ${product.wholesalePrice.toLocaleString('es-DO', { minimumFractionDigits: 2 })}`
                  : '—'}
              </span>
            </div>
          </div>
        </div>

        {/* Sección 2: Inventario y Control */}
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
            Inventario y Control
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
            <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800">
              <span className="text-[10.5px] text-slate-400 font-bold block uppercase mb-0.5">Stock Actual</span>
              <span className="text-sm font-black text-slate-900 dark:text-white tabular-nums">
                {product.currentStock} {product.unit || 'unidades'}
              </span>
            </div>

            <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800">
              <span className="text-[10.5px] text-slate-400 font-bold block uppercase mb-0.5">Stock Mínimo</span>
              <span className="text-sm font-bold text-slate-700 dark:text-slate-300 tabular-nums">
                {product.minStock} {product.unit || 'unidades'}
              </span>
            </div>

            <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 col-span-2 sm:col-span-1">
              <span className="text-[10.5px] text-slate-400 font-bold block uppercase mb-0.5">Vencimiento</span>
              {expiryTag.badge ? (
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-bold border text-xs ${expiryTag.color}`}>
                  <Calendar size={12} />
                  {expiryTag.text}
                </span>
              ) : (
                <span className={`text-xs font-medium ${expiryTag.color}`}>{expiryTag.text}</span>
              )}
            </div>
          </div>
        </div>

        {/* Sección 3: Códigos y Clasificación */}
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
            Identificación & Códigos
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
            <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800">
              <span className="text-[10.5px] text-slate-400 font-bold block uppercase mb-0.5">Código de Barras</span>
              <span className="font-mono text-emerald-700 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-200/60 inline-block text-[11px]">
                {product.barcode || 'Sin Código'}
              </span>
            </div>

            <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800">
              <span className="text-[10.5px] text-slate-400 font-bold block uppercase mb-0.5">PLU Balanza</span>
              <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                {product.plu || '—'}
              </span>
            </div>

            <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800">
              <span className="text-[10.5px] text-slate-400 font-bold block uppercase mb-0.5">Proveedor</span>
              <span className="font-medium text-slate-700 dark:text-slate-300 truncate block">
                {product.supplier || '—'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Acciones del Modal */}
      <div className="flex items-center justify-end gap-2.5 mt-6 pt-4 border-t border-slate-100 dark:border-slate-800">
        <button
          type="button"
          className="btn-secondary text-xs font-semibold px-4 py-2 cursor-pointer"
          onClick={onClose}
        >
          Cerrar
        </button>
        <button
          type="button"
          onClick={() => onPrintLabel(product)}
          className="btn-secondary text-xs font-semibold px-4 py-2 flex items-center gap-1.5 cursor-pointer"
        >
          <Printer size={14} className="text-purple-600" />
          <span>Imprimir Etiqueta</span>
        </button>
        <button
          type="button"
          onClick={() => onEdit(product)}
          className="btn-primary text-xs font-bold px-4 py-2 flex items-center gap-1.5 cursor-pointer shadow-xs"
        >
          <Edit size={14} />
          <span>Editar Producto</span>
        </button>
      </div>
    </ModalShell>
  );
};
