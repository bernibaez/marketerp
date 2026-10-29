import React from 'react';
import { Search, Upload, Clock } from 'lucide-react';
import type { VentaConDetalle } from '@/services/ventas.service';

interface PosReturnLookupCardProps {
  searchCode: string;
  setSearchCode: (code: string) => void;
  onLookup: () => void;
  lookingUp: boolean;
  recentSales: VentaConDetalle[];
  loadingRecent: boolean;
  loadedSaleId?: string;
  onSelectSale: (sale: VentaConDetalle) => void;
}

export const PosReturnLookupCard: React.FC<PosReturnLookupCardProps> = ({
  searchCode,
  setSearchCode,
  onLookup,
  lookingUp,
  recentSales,
  loadingRecent,
  loadedSaleId,
  onSelectSale,
}) => {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-2xs space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-bold text-slate-900 text-base">Buscar Factura Original</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Introduce el número de factura de venta (VEN-...), comprobante POS (FAC-...) o NCF fiscal impreso
          </p>
        </div>
        <span className="px-3 py-1 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200/70 whitespace-nowrap">
          Factura POS · Venta · NCF
        </span>
      </div>

      {/* Search Input Row */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-xs text-slate-800 placeholder:text-slate-400 focus:bg-white focus:border-[#007052] focus:ring-1 focus:ring-[#007052] outline-none font-mono transition"
            placeholder="No. factura POS (FAC-...), venta (VEN-...) o NCF (B02...)"
            value={searchCode}
            onChange={(e) => setSearchCode(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void onLookup();
            }}
          />
        </div>
        <button
          type="button"
          onClick={onLookup}
          disabled={lookingUp}
          className="bg-[#007052] hover:bg-[#005c43] active:bg-[#004733] text-white px-5 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 shadow-xs transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
        >
          <Upload size={15} />
          <span>{lookingUp ? 'Buscando…' : 'Cargar Factura'}</span>
        </button>
      </div>

      {/* Recent Sales Section */}
      <div className="pt-2">
        <div className="flex items-center justify-between pb-2.5">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            <Clock size={13} className="text-slate-400" />
            <span>O SELECCIONA UNA VENTA RECIENTE</span>
          </div>
          <span className="text-[11px] text-slate-400 font-medium">Últimas 24 horas</span>
        </div>

        {/* 6 Recent Sales Grid (2 cols x 3 rows) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {recentSales.slice(0, 6).map((vs) => {
            const isCurrent = loadedSaleId === vs.id;
            return (
              <div
                key={vs.id}
                onClick={() => onSelectSale(vs)}
                className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between group ${
                  isCurrent
                    ? 'border-[#007052] bg-emerald-50/40 ring-1 ring-[#007052]'
                    : 'border-slate-200/90 bg-white hover:border-[#007052]/60 hover:shadow-xs'
                }`}
              >
                <div className="min-w-0 mr-2">
                  <p className="font-mono font-bold text-xs text-slate-800 group-hover:text-[#007052] truncate transition-colors">
                    {vs.numero_factura}
                  </p>
                  <p className="text-[11px] text-slate-500 truncate mt-0.5">
                    {vs.cliente_nombre || 'Cliente general'}
                    {vs.ncf ? ` · ${vs.ncf}` : ''}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="font-mono font-bold text-xs text-slate-900">
                    RD$ {vs.monto_total.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                  <span className="text-[11px] font-bold text-[#007052] flex items-center justify-end gap-0.5 mt-0.5 group-hover:translate-x-0.5 transition-transform">
                    Cargar →
                  </span>
                </div>
              </div>
            );
          })}

          {recentSales.length === 0 && !loadingRecent && (
            <div className="col-span-2 text-center py-4 text-xs text-slate-400">
              No hay ventas registradas recientemente
            </div>
          )}
          {loadingRecent && recentSales.length === 0 && (
            <div className="col-span-2 text-center py-4 text-xs text-slate-400">
              Cargando ventas recientes…
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
