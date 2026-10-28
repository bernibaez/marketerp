import React, { useState, useEffect, useRef, useCallback } from 'react';
import AppLayout from '@/components/AppLayout';
import {
  Search,
  Download,
  Eye,
  Sliders,
  Package,
  X,
  Check,
  RotateCcw,
  ArrowDownRight,
  ArrowUpRight,
  AlertTriangle,
  MinusCircle,
  Plus,
  Minus,
  Loader2,
  Trash2,
  Layers,
} from 'lucide-react';
import { exportTableToPdf } from '@/lib/exportPdf';
import type { ProductItem } from '@/lib/productStore';
import type { StockAdjustmentItem } from '@/lib/stockAdjustmentStore';
import { obtenerHistorialAjustes, procesarAjusteStockBloque } from '@/services/inventario.service';
import { obtenerProductos, productoAUi } from '@/services/productos.service';
import { isAbortError } from '@/lib/isAbortError';
import { toast } from '@/lib/toast';
import { useAuth } from '@/context/AuthContext';
import type { TipoAjuste } from '@/types/database';

const typeMap: Record<string, { label: string; cls: string }> = {
  entrada: { label: 'Entrada (+)', cls: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' },
  salida: { label: 'Salida (-)', cls: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' },
  perdida: { label: 'Pérdida / Daño', cls: 'bg-danger-bg text-danger border-danger/20' },
};

const MOTIVOS_SALIDA_COMUNES = [
  { label: 'Merma / Producto dañado', tipo: 'perdida' as TipoAjuste },
  { label: 'Producto vencido / Caducado', tipo: 'perdida' as TipoAjuste },
  { label: 'Consumo interno / Muestra', tipo: 'salida' as TipoAjuste },
  { label: 'Diferencia de inventario / Faltante', tipo: 'salida' as TipoAjuste },
  { label: 'Avería / Rotura en almacén', tipo: 'perdida' as TipoAjuste },
  { label: 'Salida general de inventario', tipo: 'salida' as TipoAjuste },
  { label: 'Otro motivo (especificar)', tipo: 'salida' as TipoAjuste },
];

interface PreparedExitItem {
  product: ProductItem;
  qtyToExit: number;
  reason: string;
  customReason: string;
  adjustmentType: TipoAjuste;
}

export default function StockAdjustmentsPage() {
  const { user } = useAuth();

  // Historial State
  const [adjustments, setAdjustments] = useState<StockAdjustmentItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historySearch, setHistorySearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [detailItem, setDetailItem] = useState<StockAdjustmentItem | null>(null);

  // Modal / Vista de Salida de Stock
  const [showExitModal, setShowExitModal] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [searchResults, setSearchResults] = useState<ProductItem[]>([]);
  const [searchingProducts, setSearchingProducts] = useState(false);
  const searchAbortRef = useRef<AbortController | null>(null);

  // Lista de salidas preparadas para aplicar
  const [preparedExits, setPreparedExits] = useState<PreparedExitItem[]>([]);
  const [savingExits, setSavingExits] = useState(false);

  // Cargar historial de ajustes desde la base de datos
  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const hist = await obtenerHistorialAjustes({
        pagina: 1,
        limite: 100,
        busqueda: historySearch.trim() || undefined,
        tipo: typeFilter === 'all' ? 'todos' : (typeFilter as TipoAjuste),
      });

      setAdjustments(
        hist.datos.map((a) => {
          const created = new Date(a.creado_en);
          const pNombre = a.productos?.nombre || 'Producto';
          const pSku = a.productos?.sku || '';
          const pCategoria = a.productos?.categoria || '';

          return {
            id: a.id,
            code: a.codigo,
            productId: a.producto_id,
            productName: pNombre,
            sku: pSku,
            category: pCategoria,
            type: a.tipo_ajuste,
            qty: Math.abs(a.cantidad_variacion),
            previousQty: a.cantidad_anterior,
            newQty: a.cantidad_nueva,
            reason: a.motivo,
            date: created.toISOString().slice(0, 10),
            time: created.toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit' }),
            responsible: user?.name ?? 'Sistema',
          } as StockAdjustmentItem;
        })
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al cargar historial');
    } finally {
      setLoadingHistory(false);
    }
  }, [historySearch, typeFilter, user?.name]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadHistory();
    }, 250);
    return () => clearTimeout(timer);
  }, [loadHistory]);

  // Consulta dinámica a la base de datos bajo demanda al escribir producto
  useEffect(() => {
    const query = productSearch.trim();
    if (!query) {
      setSearchResults([]);
      setSearchingProducts(false);
      return;
    }

    if (searchAbortRef.current) {
      searchAbortRef.current.abort();
    }
    const ac = new AbortController();
    searchAbortRef.current = ac;
    setSearchingProducts(true);

    const timer = setTimeout(async () => {
      try {
        const res = await obtenerProductos({
          pagina: 1,
          limite: 20,
          busqueda: query,
          estado: 'activo',
          signal: ac.signal,
        });
        if (!ac.signal.aborted) {
          const items = (res.datos || []).map(productoAUi) as ProductItem[];
          setSearchResults(items);
        }
      } catch (err) {
        if (!isAbortError(err)) {
          console.error('Error buscando productos:', err);
        }
      } finally {
        if (!ac.signal.aborted) {
          setSearchingProducts(false);
        }
      }
    }, 250);

    return () => {
      clearTimeout(timer);
      ac.abort();
    };
  }, [productSearch]);

  // Agregar un producto a la bandeja de salidas preparadas
  const handleAddProductToExitQueue = (product: ProductItem, initialQty = 1) => {
    setPreparedExits((prev) => {
      const existingIdx = prev.findIndex((item) => item.product.id === product.id);
      if (existingIdx >= 0) {
        const copy = [...prev];
        const nextQty = copy[existingIdx].qtyToExit + initialQty;
        copy[existingIdx] = {
          ...copy[existingIdx],
          qtyToExit: nextQty,
        };
        toast.info(`Cantidad de salida aumentada a ${nextQty} para "${product.name}"`);
        return copy;
      }

      toast.success(`"${product.name}" agregado para registrar salida`);
      return [
        {
          product,
          qtyToExit: Math.max(1, initialQty),
          reason: MOTIVOS_SALIDA_COMUNES[0].label,
          customReason: '',
          adjustmentType: MOTIVOS_SALIDA_COMUNES[0].tipo,
        },
        ...prev,
      ];
    });
  };

  const handleUpdateExitQty = (productId: string, qty: number) => {
    setPreparedExits((prev) =>
      prev.map((item) =>
        item.product.id === productId ? { ...item, qtyToExit: Math.max(1, qty) } : item
      )
    );
  };

  const handleUpdateExitReason = (productId: string, reasonLabel: string) => {
    const preset = MOTIVOS_SALIDA_COMUNES.find((m) => m.label === reasonLabel);
    setPreparedExits((prev) =>
      prev.map((item) =>
        item.product.id === productId
          ? {
              ...item,
              reason: reasonLabel,
              adjustmentType: preset?.tipo || 'salida',
            }
          : item
      )
    );
  };

  const handleUpdateExitCustomReason = (productId: string, text: string) => {
    setPreparedExits((prev) =>
      prev.map((item) =>
        item.product.id === productId ? { ...item, customReason: text } : item
      )
    );
  };

  const handleRemoveExitItem = (productId: string) => {
    setPreparedExits((prev) => prev.filter((item) => item.product.id !== productId));
  };

  // Confirmar y aplicar el lote de salidas al inventario
  const handleSaveStockExits = async () => {
    if (preparedExits.length === 0) {
      toast.error('Agrega al menos un producto para registrar salida');
      return;
    }

    setSavingExits(true);
    try {
      const itemsPayload = preparedExits.map((item) => {
        const finalMotivo =
          item.reason.includes('Otro') && item.customReason.trim()
            ? item.customReason.trim()
            : item.reason;

        // Si el usuario puso 1 en salida, el stock nuevo es: stockActual - 1
        const newStock = Math.max(0, item.product.currentStock - item.qtyToExit);

        return {
          producto_id: item.product.id,
          tipo_ajuste: item.adjustmentType,
          cantidad_variacion: -item.qtyToExit,
          cantidad_nueva: newStock,
          motivo: finalMotivo,
          responsable_id: user?.id ?? null,
        };
      });

      await procesarAjusteStockBloque(itemsPayload);
      toast.success(
        `Se registraron las salidas de ${preparedExits.length} producto(s) exitosamente. Existencias descontadas.`
      );
      setPreparedExits([]);
      setShowExitModal(false);
      setProductSearch('');
      setSearchResults([]);
      await loadHistory();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al registrar salidas de inventario');
    } finally {
      setSavingExits(false);
    }
  };

  const handleExportPdf = () => {
    exportTableToPdf({
      title: 'Reporte de Ajustes y Salidas de Inventario',
      filename: 'reporte-ajustes-salidas-stock',
      headers: [
        'Código',
        'Producto',
        'SKU',
        'Tipo Movimiento',
        'Stock Previo',
        'Salida / Variación',
        'Nuevo Stock',
        'Motivo',
        'Fecha',
        'Responsable',
      ],
      rows: adjustments.map((a) => [
        a.code,
        a.productName,
        a.sku,
        typeMap[a.type]?.label ?? a.type,
        a.previousQty,
        a.type === 'entrada' ? `+${a.qty}` : `-${a.qty}`,
        a.newQty,
        a.reason,
        `${a.date} ${a.time}`,
        a.responsible,
      ]),
      landscape: true,
    });
  };

  const totalEntradas = adjustments.filter((a) => a.type === 'entrada').reduce((sum, a) => sum + a.qty, 0);
  const totalSalidas = adjustments.filter((a) => a.type === 'salida').reduce((sum, a) => sum + a.qty, 0);
  const totalPerdidas = adjustments.filter((a) => a.type === 'perdida').reduce((sum, a) => sum + a.qty, 0);

  // VISTA / MODAL DE REGISTRO DE SALIDAS DE INVENTARIO
  if (showExitModal) {
    const totalUnitsToExit = preparedExits.reduce((acc, curr) => acc + curr.qtyToExit, 0);

    return (
      <AppLayout>
        <div className="space-y-6 slide-up">
          {/* Header */}
          <div className="flex items-center justify-between gap-4 flex-wrap pb-2 border-b border-border">
            <div>
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
                  <Sliders size={24} />
                </div>
                <div>
                  <h1 className="text-2xl font-black text-foreground">Registrar Ajustes de Stock</h1>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Indica las cantidades a ajustar en existencias por conteo físico, merma, daño o corrección
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowExitModal(false);
                  setProductSearch('');
                  setSearchResults([]);
                }}
                className="btn-secondary text-xs font-bold py-2.5 px-4 cursor-pointer"
              >
                ← Volver al Historial
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Columna Izquierda: Buscador de base de datos bajo demanda */}
            <div className="lg:col-span-7 space-y-4">
              <div className="card p-5 space-y-3">
                <label className="block text-xs font-black uppercase tracking-wider text-foreground">
                  Buscar Producto en Base de Datos
                </label>
                <div className="relative">
                  <Search
                    size={18}
                    className={`absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors ${
                      searchingProducts ? 'text-emerald-600 animate-pulse' : 'text-muted-foreground'
                    }`}
                  />
                  <input
                    type="text"
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    placeholder="Escribe el nombre, código de barras o SKU para consultar la BD..."
                    className="input-field pl-10 pr-10 h-12 text-sm font-semibold shadow-2xs"
                    autoFocus
                  />
                  {searchingProducts ? (
                    <Loader2 size={18} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-emerald-600 animate-spin" />
                  ) : productSearch ? (
                    <button
                      type="button"
                      onClick={() => setProductSearch('')}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1 cursor-pointer"
                    >
                      <X size={16} />
                    </button>
                  ) : null}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  💡 <strong>Optimización de base de datos:</strong> Los productos no se cargan todos de golpe. El sistema consulta a Supabase únicamente cuando escribes.
                </p>
              </div>

              {/* Resultados de búsqueda dinámica */}
              <div className="card p-5 space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  <span>
                    {productSearch.trim()
                      ? `Resultados encontrados (${searchResults.length})`
                      : 'Búsqueda de productos'}
                  </span>
                  {searchingProducts && <span className="text-emerald-600 normal-case font-medium">Buscando…</span>}
                </div>

                {!productSearch.trim() ? (
                  <div className="py-12 px-4 text-center border-2 border-dashed border-border rounded-2xl space-y-2">
                    <Package size={36} className="mx-auto text-muted-foreground/40" />
                    <p className="font-extrabold text-foreground text-sm">Comienza a escribir para buscar</p>
                    <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                      Ingresa el nombre de una fruta, bebida, vívere o código de barra para cargar su stock en tiempo real desde la base de datos.
                    </p>
                  </div>
                ) : searchingProducts && searchResults.length === 0 ? (
                  <div className="py-12 text-center space-y-2">
                    <Loader2 size={32} className="mx-auto text-emerald-600 animate-spin" />
                    <p className="text-xs text-muted-foreground font-semibold">Consultando existencias en la base de datos…</p>
                  </div>
                ) : searchResults.length === 0 ? (
                  <div className="py-12 px-4 text-center border-2 border-dashed border-border rounded-2xl space-y-2">
                    <AlertTriangle size={32} className="mx-auto text-muted-foreground/80" />
                    <p className="font-bold text-foreground text-sm">No se encontraron productos con &quot;{productSearch}&quot;</p>
                    <p className="text-xs text-muted-foreground">
                      Verifica que el nombre o código coincida con un producto registrado en el catálogo.
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-border/60 border border-border rounded-2xl overflow-hidden max-h-[460px] overflow-y-auto">
                    {searchResults.map((p) => {
                      const alreadyInQueue = preparedExits.some((item) => item.product.id === p.id);
                      const currentQueueItem = preparedExits.find((item) => item.product.id === p.id);
                      const currentExitQty = currentQueueItem?.qtyToExit || 1;
                      const resultingStock = Math.max(0, p.currentStock - currentExitQty);

                      return (
                        <div
                          key={p.id}
                          className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-secondary/30 transition-colors"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-extrabold text-foreground text-sm">{p.name}</p>
                              <span className="px-2 py-0.5 bg-secondary text-[10px] font-bold rounded text-muted-foreground">
                                {p.category}
                              </span>
                              {alreadyInQueue && (
                                <span className="px-2 py-0.5 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-[10px] font-black rounded-md">
                                  En lista para ajuste
                                </span>
                              )}
                            </div>
                            <p className="text-xs font-mono text-muted-foreground mt-0.5">
                              SKU: <strong className="text-foreground">{p.sku}</strong>
                              {p.barcode && <span> · Barra: {p.barcode}</span>}
                            </p>
                            <div className="flex items-center gap-2 mt-1.5 text-xs">
                              <span className="font-semibold text-muted-foreground">
                                Stock actual:{' '}
                                <strong className="text-foreground font-mono">
                                  {p.currentStock} {p.unit}
                                </strong>
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 self-end sm:self-center">
                            <button
                              type="button"
                              onClick={() => handleAddProductToExitQueue(p, 1)}
                              className="btn-primary text-xs font-black py-2 px-3.5 flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs cursor-pointer"
                            >
                              <Plus size={15} />
                              <span>Añadir a Ajuste</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Columna Derecha: Bandeja de Productos a Ajustar */}
            <div className="lg:col-span-5 space-y-4">
              <div className="card p-5 space-y-4 border-2 border-emerald-500/30 bg-emerald-500/5">
                <div className="flex items-center justify-between border-b border-border/80 pb-3">
                  <div>
                    <h3 className="font-black text-foreground text-base flex items-center gap-2">
                      <Layers size={18} className="text-emerald-600" />
                      Productos a Ajustar ({preparedExits.length})
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Ingresa las unidades a ajustar para cada producto
                    </p>
                  </div>
                  {preparedExits.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setPreparedExits([])}
                      className="text-xs text-danger font-bold hover:underline cursor-pointer"
                    >
                      Limpiar lista
                    </button>
                  )}
                </div>

                {preparedExits.length === 0 ? (
                  <div className="p-8 text-center border-2 border-dashed border-border/80 rounded-xl space-y-2 bg-card">
                    <Layers size={28} className="mx-auto text-emerald-500/60" />
                    <p className="font-bold text-foreground text-xs">No has seleccionado ningún producto aún</p>
                    <p className="text-[11px] text-muted-foreground">
                      Usa el buscador de la izquierda para seleccionar los productos a ajustar.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                    {preparedExits.map((item) => {
                      const stockPrevio = item.product.currentStock;
                      const salida = item.qtyToExit;
                      const stockRestante = Math.max(0, stockPrevio - salida);
                      const isOverStock = salida > stockPrevio;

                      return (
                        <div
                          key={item.product.id}
                          className="card p-3.5 space-y-3 bg-card border border-border shadow-xs"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="font-extrabold text-foreground text-sm truncate">{item.product.name}</p>
                              <p className="text-[11px] font-mono text-muted-foreground">SKU: {item.product.sku}</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemoveExitItem(item.product.id)}
                              className="text-muted-foreground hover:text-danger p-1 rounded transition-colors cursor-pointer"
                              title="Quitar producto de la lista"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>

                          {/* Controles de Cantidad de Ajuste */}
                          <div className="bg-secondary/40 p-3 rounded-xl space-y-2">
                            <div className="flex items-center justify-between text-xs font-bold">
                              <span className="text-muted-foreground">Cantidad a ajustar (-):</span>
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleUpdateExitQty(item.product.id, Math.max(1, salida - 1))}
                                  className="w-8 h-8 rounded-lg bg-card border border-border hover:bg-secondary flex items-center justify-center font-bold cursor-pointer"
                                >
                                  <Minus size={13} />
                                </button>
                                <input
                                  type="number"
                                  min={1}
                                  value={salida}
                                  onChange={(e) =>
                                    handleUpdateExitQty(item.product.id, parseInt(e.target.value, 10) || 1)
                                  }
                                  className="input-field w-20 h-8 text-center font-black text-sm tabular-nums"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleUpdateExitQty(item.product.id, salida + 1)}
                                  className="w-8 h-8 rounded-lg bg-card border border-border hover:bg-secondary flex items-center justify-center font-bold cursor-pointer"
                                >
                                  <Plus size={13} />
                                </button>
                              </div>
                            </div>

                            {/* Desglose visual de existencias */}
                            <div className="flex items-center justify-between text-xs pt-1.5 border-t border-border/60">
                              <span className="text-muted-foreground">
                                Stock actual: <strong className="text-foreground">{stockPrevio}</strong> {item.product.unit}
                              </span>
                              <div className="text-right">
                                <span className="font-bold text-muted-foreground">Quedarán: </span>
                                <span
                                  className={`font-black px-2 py-0.5 rounded text-xs tabular-nums ${
                                    isOverStock
                                      ? 'bg-danger-bg text-danger'
                                      : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                                  }`}
                                >
                                  {stockRestante} {item.product.unit}
                                </span>
                              </div>
                            </div>

                            {isOverStock && (
                              <p className="text-[11px] font-bold text-danger flex items-center gap-1">
                                <AlertTriangle size={12} />
                                La salida ({salida}) supera el stock ({stockPrevio}). El stock quedará en 0.
                              </p>
                            )}
                          </div>

                          {/* Motivo del Ajuste */}
                          <div className="space-y-1.5">
                            <label className="block text-[11px] font-bold text-muted-foreground">
                              Motivo del ajuste:
                            </label>
                            <select
                              value={item.reason}
                              onChange={(e) => handleUpdateExitReason(item.product.id, e.target.value)}
                              className="input-field h-9 text-xs font-semibold cursor-pointer"
                            >
                              {MOTIVOS_SALIDA_COMUNES.map((m) => (
                                <option key={m.label} value={m.label}>
                                  {m.label} ({m.tipo === 'perdida' ? 'Merma/Daño' : 'Salida común'})
                                </option>
                              ))}
                            </select>

                            {item.reason.includes('Otro') && (
                              <input
                                type="text"
                                placeholder="Escribe el motivo específico..."
                                value={item.customReason}
                                onChange={(e) => handleUpdateExitCustomReason(item.product.id, e.target.value)}
                                className="input-field h-8 text-xs font-medium"
                              />
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Resumen Total y Botón de Confirmación */}
                {preparedExits.length > 0 && (
                  <div className="pt-3 border-t border-border space-y-3">
                    <div className="flex justify-between items-center text-xs font-bold">
                      <span className="text-muted-foreground">Total de unidades del ajuste:</span>
                      <span className="text-base font-black text-emerald-600 dark:text-emerald-400 font-mono">
                        -{totalUnitsToExit} unidades
                      </span>
                    </div>

                    <button
                      type="button"
                      disabled={savingExits}
                      onClick={handleSaveStockExits}
                      className="btn-primary w-full py-3 text-sm font-black flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-md disabled:opacity-50 cursor-pointer"
                    >
                      {savingExits ? (
                        <>
                          <Loader2 size={16} className="animate-spin" /> Aplicando ajustes de stock…
                        </>
                      ) : (
                        <>
                          <Check size={18} />
                          Confirmar y Aplicar Ajuste de Stock ({preparedExits.length} productos)
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  // VISTA PRINCIPAL: HISTORIAL Y ACCIONES
  return (
    <AppLayout>
      <div className="space-y-6 slide-up">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-foreground tracking-tight">Ajustes de Stock</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Registra ajustes de inventario de productos por conteo físico, merma, daño o corrección de existencias.
            </p>
          </div>
          <button
            onClick={() => {
              setShowExitModal(true);
              setProductSearch('');
              setSearchResults([]);
            }}
            className="btn-primary flex items-center gap-2 w-fit shadow-md py-2.5 px-5 bg-emerald-600 hover:bg-emerald-700 text-white font-black cursor-pointer transition"
          >
            <Sliders size={19} />
            <span>Registrar Ajustes de Stock</span>
          </button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="card p-4 flex items-center gap-3 border border-emerald-500/20 bg-emerald-500/5">
            <div className="p-3 rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
              <ArrowDownRight size={22} />
            </div>
            <div>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Ajustes de Stock (-)</p>
              <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5">{totalSalidas} unidades</p>
            </div>
          </div>

          <div className="card p-4 flex items-center gap-3 border border-danger/20 bg-danger-bg/20">
            <div className="p-3 rounded-2xl bg-danger/15 text-danger">
              <AlertTriangle size={22} />
            </div>
            <div>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Mermas y Dañados</p>
              <p className="text-2xl font-black text-danger mt-0.5">{totalPerdidas} unidades</p>
            </div>
          </div>

          <div className="card p-4 flex items-center gap-3 border border-emerald-500/20 bg-emerald-500/5">
            <div className="p-3 rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
              <ArrowUpRight size={22} />
            </div>
            <div>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Entradas Ajustadas</p>
              <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5">{totalEntradas} unidades</p>
            </div>
          </div>
        </div>

        {/* Toolbar & Filters */}
        <div className="card p-4 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              className="input-field pl-10 h-10 text-sm"
              placeholder="Buscar historial por código, motivo o producto..."
              value={historySearch}
              onChange={(e) => setHistorySearch(e.target.value)}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <select
              aria-label="Filtrar por tipo de ajuste"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="input-field h-10 text-xs font-bold w-auto cursor-pointer"
            >
              <option value="all">Todos los Movimientos</option>
              <option value="salida">Salidas (-)</option>
              <option value="perdida">Mermas / Pérdidas / Dañados</option>
              <option value="entrada">Entradas (+)</option>
            </select>

            <button
              type="button"
              onClick={handleExportPdf}
              className="btn-secondary flex items-center gap-2 h-10 text-xs font-bold cursor-pointer"
            >
              <Download size={16} />
              Exportar PDF
            </button>
          </div>
        </div>

        {/* History Table */}
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/50 text-muted-foreground text-xs font-bold uppercase tracking-wider">
                  <th className="text-left px-4 py-3.5">Código</th>
                  <th className="text-left px-4 py-3.5">Producto / SKU</th>
                  <th className="text-left px-4 py-3.5">Categoría</th>
                  <th className="text-left px-4 py-3.5">Tipo Movimiento</th>
                  <th className="text-center px-4 py-3.5">Stock Previo</th>
                  <th className="text-center px-4 py-3.5">Cantidad Salida / Ajuste</th>
                  <th className="text-center px-4 py-3.5">Nuevo Stock</th>
                  <th className="text-left px-4 py-3.5 hidden lg:table-cell">Motivo</th>
                  <th className="text-left px-4 py-3.5 hidden md:table-cell">Fecha / Hora</th>
                  <th className="text-right px-4 py-3.5">Detalle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {loadingHistory ? (
                  <tr>
                    <td colSpan={10} className="text-center py-12 text-muted-foreground text-sm">
                      <Loader2 size={24} className="animate-spin mx-auto text-amber-600 mb-2" />
                      Cargando historial de ajustes…
                    </td>
                  </tr>
                ) : adjustments.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="text-center py-12 text-muted-foreground text-sm">
                      No se encontraron registros de ajustes o salidas de inventario.
                    </td>
                  </tr>
                ) : (
                  adjustments.map((a, i) => {
                    const typeConfig = typeMap[a.type] || typeMap.salida;
                    const delta = a.newQty - a.previousQty;

                    return (
                      <tr key={a.id} className={`hover:bg-secondary/30 transition-colors ${i % 2 === 0 ? '' : 'bg-secondary/10'}`}>
                        <td className="px-4 py-3.5 font-mono text-primary font-bold">{a.code}</td>
                        <td className="px-4 py-3.5">
                          <p className="font-bold text-foreground">{a.productName}</p>
                          <p className="text-xs font-mono text-muted-foreground">{a.sku}</p>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="px-2 py-0.5 rounded-md text-xs font-semibold bg-secondary text-foreground">
                            {a.category || 'General'}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className={`px-2.5 py-1 rounded-lg text-xs font-black border ${typeConfig.cls}`}>
                            {typeConfig.label}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-center font-semibold text-muted-foreground tabular-nums">
                          {a.previousQty} unds
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <span
                            className={`font-black text-xs px-2.5 py-1 rounded-md tabular-nums ${
                              delta < 0
                                ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                                : delta > 0
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                                : 'bg-secondary text-muted-foreground'
                            }`}
                          >
                            {delta < 0 ? `${delta}` : `+${delta}`} unds
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-center font-black text-foreground tabular-nums">
                          {a.newQty} unds
                        </td>
                        <td className="px-4 py-3.5 text-muted-foreground text-xs hidden lg:table-cell max-w-[200px] truncate">
                          {a.reason}
                        </td>
                        <td className="px-4 py-3.5 text-muted-foreground text-xs hidden md:table-cell">
                          {a.date} <span className="font-mono text-[11px]">{a.time}</span>
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <button
                            onClick={() => setDetailItem(a)}
                            className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                            title="Ver detalles"
                          >
                            <Eye size={16} />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal de Detalle de Ajuste */}
        {detailItem && (
          <div className="card p-5 border border-primary/30 space-y-4 slide-up">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 bg-primary/15 text-primary rounded-2xl">
                  <Sliders size={20} />
                </div>
                <div>
                  <h3 className="font-extrabold text-foreground text-base">
                    Detalle del Ajuste — <span className="font-mono text-primary">{detailItem.code}</span>
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Información completa del movimiento de inventario</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDetailItem(null)}
                className="btn-secondary text-xs px-3.5 py-1.5 font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <X size={15} />
                <span>Cerrar</span>
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div className="p-3 bg-secondary/30 rounded-xl border border-border/50">
                <span className="text-muted-foreground font-bold block mb-1">Código</span>
                <span className="font-mono font-bold text-primary text-sm">{detailItem.code}</span>
              </div>
              <div className="p-3 bg-secondary/30 rounded-xl border border-border/50">
                <span className="text-muted-foreground font-bold block mb-1">Producto</span>
                <span className="font-extrabold text-foreground text-sm">{detailItem.productName}</span>
              </div>
              <div className="p-3 bg-secondary/30 rounded-xl border border-border/50">
                <span className="text-muted-foreground font-bold block mb-1">SKU</span>
                <span className="font-mono text-muted-foreground">{detailItem.sku || '—'}</span>
              </div>
              <div className="p-3 bg-secondary/30 rounded-xl border border-border/50">
                <span className="text-muted-foreground font-bold block mb-1">Categoría</span>
                <span className="font-bold text-foreground">{detailItem.category || 'General'}</span>
              </div>
              <div className="p-3 bg-secondary/30 rounded-xl border border-border/50">
                <span className="text-muted-foreground font-bold block mb-1">Stock Previo</span>
                <span className="font-bold text-foreground text-sm">{detailItem.previousQty} unds</span>
              </div>
              <div className="p-3 bg-secondary/30 rounded-xl border border-border/50">
                <span className="text-muted-foreground font-bold block mb-1">Nuevo Stock</span>
                <span className="font-bold text-foreground text-sm">{detailItem.newQty} unds</span>
              </div>
              <div className="p-3 bg-secondary/30 rounded-xl border border-border/50">
                <span className="text-muted-foreground font-bold block mb-1">Motivo</span>
                <span className="font-medium text-foreground">{detailItem.reason}</span>
              </div>
              <div className="p-3 bg-secondary/30 rounded-xl border border-border/50">
                <span className="text-muted-foreground font-bold block mb-1">Fecha / Responsable</span>
                <span className="font-medium text-foreground">
                  {detailItem.date} {detailItem.time} — {detailItem.responsible}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
