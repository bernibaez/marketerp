import React from 'react';
import {
  ShoppingBag,
  RotateCcw,
  Plus,
  Search,
  Filter,
  Download,
  Eye,
  Edit2,
  Trash2,
} from 'lucide-react';
import { toast } from '@/lib/toast';

export interface Purchase {
  id: string;
  code: string;
  supplier: string;
  date: string;
  items: number;
  subtotal: number;
  tax: number;
  total: number;
  status: 'received' | 'pending' | 'partial' | 'anulada';
  payment: string;
}

export interface ReturnItem {
  id: number;
  code: string;
  purchaseCode: string;
  supplier: string;
  date: string;
  total: number;
  reason: string;
  status: 'approved' | 'pending';
}

const statusMap: Record<string, { label: string; cls: string }> = {
  received: { label: 'Recibido', cls: 'badge-success' },
  pending: { label: 'Pendiente', cls: 'badge-warning' },
  partial: { label: 'Parcial', cls: 'badge-info' },
  approved: { label: 'Aprobado', cls: 'badge-success' },
  anulada: { label: 'Anulada', cls: 'badge-danger' },
};

interface PurchasesListViewProps {
  tab: 'list' | 'returns';
  setTab: (t: 'list' | 'returns') => void;
  purchasesList: Purchase[];
  returnsList: ReturnItem[];
  loadingList: boolean;
  search: string;
  setSearch: (v: string) => void;
  filteredPurchases: Purchase[];
  onNewPurchase: () => void;
  onViewPurchase: (id: string) => void;
  onAnularClick: (id: string) => void;
  onExportPdf: () => void;
}

export function PurchasesListView({
  tab,
  setTab,
  purchasesList,
  returnsList,
  loadingList,
  search,
  setSearch,
  filteredPurchases,
  onNewPurchase,
  onViewPurchase,
  onAnularClick,
  onExportPdf,
}: PurchasesListViewProps) {
  return (
    <div className="space-y-6 slide-up">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Compras</h1>
          <p className="text-sm text-muted-foreground mt-1">Gestiona órdenes de compra y devoluciones</p>
        </div>
        <button
          type="button"
          onClick={onNewPurchase}
          className="btn-primary flex items-center gap-2 w-fit shadow-md cursor-pointer"
        >
          <Plus size={16} />
          Nueva Compra
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-4">
          <p className="text-xs text-muted-foreground">Total compras</p>
          <p className="text-2xl font-bold text-foreground mt-1">
            RD$ {purchasesList.reduce((s, p) => s + p.total, 0).toLocaleString('es-DO')}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-muted-foreground">Órdenes totales</p>
          <p className="text-2xl font-bold text-info mt-1">{loadingList ? '…' : purchasesList.length}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-muted-foreground">Pendientes</p>
          <p className="text-2xl font-bold text-warning mt-1">
            {purchasesList.filter((p) => p.status === 'pending').length}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-muted-foreground">Devoluciones</p>
          <p className="text-2xl font-bold text-danger mt-1">2</p>
        </div>
      </div>

      <div className="flex gap-1 bg-secondary rounded-xl p-1 w-fit">
        {[
          { id: 'list' as const, label: 'Lista de Compras', icon: <ShoppingBag size={16} /> },
          { id: 'returns' as const, label: 'Devoluciones', icon: <RotateCcw size={16} /> },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${
              tab === t.id
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      <div className="card p-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            className="input-field pl-9"
            placeholder="Buscar por código o proveedor..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn-secondary flex items-center gap-2 cursor-pointer">
            <Filter size={16} />
            Filtrar
          </button>
          <button
            type="button"
            onClick={onExportPdf}
            className="btn-secondary flex items-center gap-2 cursor-pointer"
          >
            <Download size={16} />
            Exportar PDF
          </button>
        </div>
      </div>

      {tab === 'list' && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/50">
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Código</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Proveedor</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground hidden md:table-cell">Fecha</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground hidden lg:table-cell">Productos</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground hidden lg:table-cell">ITBIS</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Total</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground hidden md:table-cell">Estado</th>
                  <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredPurchases.map((p, i) => (
                  <tr
                    key={p.id}
                    className={`border-b border-border hover:bg-secondary/30 transition-colors ${
                      i % 2 === 0 ? '' : 'bg-secondary/10'
                    }`}
                  >
                    <td className="px-4 py-3 font-mono text-primary font-medium">{p.code}</td>
                    <td className="px-4 py-3 font-medium text-foreground">{p.supplier}</td>
                    <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{p.date}</td>
                    <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">{p.items} items</td>
                    <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">
                      RD$ {p.tax.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 font-bold text-foreground">RD$ {p.total.toLocaleString()}</td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className={statusMap[p.status].cls}>{statusMap[p.status].label}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                          title="Ver detalle"
                          onClick={() => void onViewPurchase(p.id)}
                        >
                          <Eye size={14} />
                        </button>
                        <button
                          type="button"
                          className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                          title="Editar"
                          onClick={() =>
                            toast.info('Las compras recibidas no se editan; anula y crea otra')
                          }
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          type="button"
                          className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-danger transition-colors disabled:opacity-40 cursor-pointer"
                          title="Anular compra"
                          disabled={p.status === 'anulada'}
                          onClick={() => onAnularClick(p.id)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-border flex items-center justify-between text-sm text-muted-foreground">
            <span>
              Mostrando {filteredPurchases.length} de {purchasesList.length} compras
            </span>
            <div className="flex gap-1">
              <button type="button" className="px-3 py-1 rounded-lg hover:bg-secondary transition-colors cursor-pointer">
                Anterior
              </button>
              <button type="button" className="px-3 py-1 rounded-lg bg-primary text-primary-foreground">
                1
              </button>
              <button type="button" className="px-3 py-1 rounded-lg hover:bg-secondary transition-colors cursor-pointer">
                Siguiente
              </button>
            </div>
          </div>
        </div>
      )}

      {tab === 'returns' && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/50">
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Código</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Compra Ref.</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground hidden md:table-cell">Proveedor</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground hidden md:table-cell">Fecha</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Total</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground hidden lg:table-cell">Motivo</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Estado</th>
                  <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {returnsList.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-muted-foreground text-sm">
                      No hay devoluciones registradas en Supabase
                    </td>
                  </tr>
                )}
                {returnsList.map((r, i) => (
                  <tr
                    key={r.id}
                    className={`border-b border-border hover:bg-secondary/30 transition-colors ${
                      i % 2 === 0 ? '' : 'bg-secondary/10'
                    }`}
                  >
                    <td className="px-4 py-3 font-mono text-danger font-medium">{r.code}</td>
                    <td className="px-4 py-3 font-mono text-primary">{r.purchaseCode}</td>
                    <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{r.supplier}</td>
                    <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{r.date}</td>
                    <td className="px-4 py-3 font-bold text-foreground">RD$ {r.total.toLocaleString()}</td>
                    <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">{r.reason}</td>
                    <td className="px-4 py-3">
                      <span className={statusMap[r.status].cls}>{statusMap[r.status].label}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                        >
                          <Eye size={14} />
                        </button>
                        <button
                          type="button"
                          className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-danger transition-colors cursor-pointer"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
