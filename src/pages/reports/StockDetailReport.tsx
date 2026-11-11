import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Package,
  ArrowLeft,
  Search,
  FileSpreadsheet,
  FileText,
  Sliders,
  ShoppingCart,
  ShoppingBag,
  RotateCcw,
  History,
  X,
  Edit,
  AlertCircle,
<<<<<<< HEAD
=======
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
>>>>>>> 57bbebe1c1b40ce6b28d91de9bc1ae3c21035762
  Layers,
  ArrowDownRight,
  ArrowUpRight,
} from 'lucide-react';
import { formatRD, ReportLoading, ReportError, ReportPagination, type ReportPeriodProps } from './shared';
import {
  obtenerInformeStockGeneral,
  obtenerHistorialMovimientosProducto,
  exportarStockGeneralAExcel,
  exportarKardexAExcel,
  exportarACSV,
  type ResumenStockGeneral,
  type HistorialMovimientosProductoResult,
} from '@/services/informes/informesStockMovimientos.service';
import { toast } from '@/lib/toast';

<<<<<<< HEAD
function StockEstadoBadge({ estado }: { estado: StockGeneralItem['estado'] }) {
  if (estado === 'Agotado') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-danger/10 text-danger">
        Agotado
      </span>
    );
  }
  if (estado === 'Bajo') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-warning/15 text-warning">
        Bajo
=======
function renderMovementBadge(tipo: MovimientoStockItem['tipo']) {
  if (tipo === 'Ventas') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-info/10 text-info">
        <ShoppingCart size={11} /> Venta
      </span>
    );
  }
  if (tipo === 'Compras') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-success/10 text-success">
        <ShoppingBag size={11} /> Compra
      </span>
    );
  }
  if (tipo === 'Ajuste de Stock') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-warning/10 text-warning">
        <Sliders size={11} /> Ajuste
      </span>
    );
  }
  if (tipo === 'Devolución de Venta') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-purple-500/10 text-purple-600 dark:text-purple-400">
        <RotateCcw size={11} /> Devolución
      </span>
    );
  }
  if (tipo === 'Devolución de Compra') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-danger/10 text-danger">
        <RotateCcw size={11} /> Dev. Compra
      </span>
    );
  }
  if (tipo === 'Anulación') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400">
        <AlertCircle size={11} /> Anulación
      </span>
    );
  }
  if (tipo === 'Edición de factura') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-sky-500/10 text-sky-600 dark:text-sky-400">
        <Edit size={11} /> Edición Factura
>>>>>>> 57bbebe1c1b40ce6b28d91de9bc1ae3c21035762
      </span>
    );
  }
  return (
<<<<<<< HEAD
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-success/10 text-success">
      OK
=======
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-500/10 text-slate-600">
      <Layers size={11} /> Transferencia
>>>>>>> 57bbebe1c1b40ce6b28d91de9bc1ae3c21035762
    </span>
  );
}

export default function StockDetailReport({ dateFrom: _dateFrom, dateTo: _dateTo }: ReportPeriodProps) {
<<<<<<< HEAD
=======
  // null = Vista General de Stock con todos los productos y sus movimientos, string = ID del producto para Kardex individual
>>>>>>> 57bbebe1c1b40ce6b28d91de9bc1ae3c21035762
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);

  // Datos Vista General
  const [generalData, setGeneralData] = useState<ResumenStockGeneral | null>(null);
  const [loadingGeneral, setLoadingGeneral] = useState(true);
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);

<<<<<<< HEAD
  // Filtros y paginación Vista General (10 filas por página por defecto para evitar sobrecarga)
  const [searchGeneral, setSearchGeneral] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'ok' | 'low' | 'out'>('all');
  const [pageSize, setPageSize] = useState<number>(10);
=======
  // Filtros Vista General — Por defecto mostrar TODOS los productos (-1) y mostrar los movimientos de cada uno
  const [searchGeneral, setSearchGeneral] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'ok' | 'low' | 'out' | 'with_movements'>('all');
  const [pageSize, setPageSize] = useState<number>(-1);
>>>>>>> 57bbebe1c1b40ce6b28d91de9bc1ae3c21035762
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [showAllMovementsInline, setShowAllMovementsInline] = useState<boolean>(true);
  const [expandedProductIds, setExpandedProductIds] = useState<Record<string, boolean>>({});

  // Datos Vista Detallada (Kardex del producto)
  const [kardexData, setKardexData] = useState<HistorialMovimientosProductoResult | null>(null);
  const [loadingKardex, setLoadingKardex] = useState(false);
  const [errorKardex, setErrorKardex] = useState<string | null>(null);

  // Filtros y paginación Vista Kardex
  const [kardexSearch, setKardexSearch] = useState('');
  const [kardexTypeFilter, setKardexTypeFilter] = useState<string>('all');
  const [kardexDateFrom, setKardexDateFrom] = useState('');
  const [kardexDateTo, setKardexDateTo] = useState('');
<<<<<<< HEAD
  const [kardexPageSize, setKardexPageSize] = useState<number>(10);
=======
  const [kardexPageSize, setKardexPageSize] = useState<number>(-1);
>>>>>>> 57bbebe1c1b40ce6b28d91de9bc1ae3c21035762
  const [kardexCurrentPage, setKardexCurrentPage] = useState<number>(1);

  // Búsqueda rápida de producto en el selector de Kardex
  const [productQuickSearch, setProductQuickSearch] = useState('');
  const [isQuickSearchOpen, setIsQuickSearchOpen] = useState(false);
  const quickSearchRef = useRef<HTMLDivElement | null>(null);

<<<<<<< HEAD
  useEffect(() => {
    let alive = true;
=======
  // 1. Cargar Vista General con TODOS los productos y sus movimientos
  const loadGeneralStock = async () => {
>>>>>>> 57bbebe1c1b40ce6b28d91de9bc1ae3c21035762
    setLoadingGeneral(true);
    setErrorGeneral(null);
    obtenerInformeStockGeneral()
      .then((data) => {
        if (alive) setGeneralData(data);
      })
      .catch((err) => {
        if (alive) setErrorGeneral(err instanceof Error ? err.message : 'Error al cargar informe de stock');
      })
      .finally(() => {
        if (alive) setLoadingGeneral(false);
      });
    return () => {
      alive = false;
    };
  }, []);

<<<<<<< HEAD
  useEffect(() => {
    if (!isQuickSearchOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (quickSearchRef.current && !quickSearchRef.current.contains(e.target as Node)) {
        setIsQuickSearchOpen(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsQuickSearchOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [isQuickSearchOpen]);
=======
  // 2. Cargar Kardex cuando se selecciona un producto
  const loadKardexForProduct = async (id: string) => {
    setLoadingKardex(true);
    setErrorKardex(null);
    try {
      // Si ya tenemos el producto cargado en generalData, podemos servirlo de inmediato y refrescar
      const cachedProd = generalData?.items.find((p) => p.id === id);
      if (cachedProd) {
        setKardexData({
          producto: cachedProd,
          resumen: {
            cantidades_en: {
              compra_total: cachedProd.total_comprado,
              stock_apertura: cachedProd.stock_apertura,
              total_devolucion_venta: cachedProd.total_devuelto,
              transferencias_en: cachedProd.total_ajustado_entrada,
            },
            cantidades_fuera: {
              total_vendido: cachedProd.total_vendido,
              ajuste_total: cachedProd.total_ajustado_salida,
              total_devolucion_compra: 0,
              transferencias_afuera: 0,
            },
            totales: {
              stock_actual: cachedProd.stock_actual,
            },
          },
          movimientos: cachedProd.movimientos,
        });
      } else {
        const data = await obtenerHistorialMovimientosProducto(id);
        setKardexData(data);
      }
    } catch (err) {
      setErrorKardex(err instanceof Error ? err.message : 'Error al cargar historial de movimientos');
    } finally {
      setLoadingKardex(false);
    }
  };
>>>>>>> 57bbebe1c1b40ce6b28d91de9bc1ae3c21035762

  useEffect(() => {
    if (!selectedProductId) {
      setKardexData(null);
      return;
    }

<<<<<<< HEAD
    let alive = true;
    const preloaded = generalData?.items.find((p) => p.id === selectedProductId);
    setLoadingKardex(true);
    setErrorKardex(null);
    setKardexSearch('');
    setKardexTypeFilter('all');
    setKardexDateFrom('');
    setKardexDateTo('');
    setKardexCurrentPage(1);

    obtenerHistorialMovimientosProducto(selectedProductId, preloaded)
      .then((data) => {
        if (alive) setKardexData(data);
      })
      .catch((err) => {
        if (alive) setErrorKardex(err instanceof Error ? err.message : 'Error al cargar historial de movimientos');
      })
      .finally(() => {
        if (alive) setLoadingKardex(false);
      });

    return () => {
      alive = false;
    };
  }, [selectedProductId, generalData]);

=======
  const toggleProductExpanded = (productId: string) => {
    setExpandedProductIds((prev) => {
      const current = prev[productId] !== undefined ? prev[productId] : showAllMovementsInline;
      return { ...prev, [productId]: !current };
    });
  };

  const isProductExpanded = (productId: string) => {
    if (expandedProductIds[productId] !== undefined) {
      return expandedProductIds[productId];
    }
    return showAllMovementsInline;
  };

  // Lista de categorías únicas
>>>>>>> 57bbebe1c1b40ce6b28d91de9bc1ae3c21035762
  const categories = useMemo(() => {
    if (!generalData) return [];
    const set = new Set(generalData.items.map((i) => i.categoria).filter(Boolean));
    return Array.from(set).sort();
  }, [generalData]);

  const filteredGeneralItems = useMemo(() => {
    if (!generalData) return [];
    let list = generalData.items;

    if (searchGeneral.trim()) {
      const q = searchGeneral.toLowerCase().trim();
      list = list.filter(
        (i) =>
          i.nombre.toLowerCase().includes(q) ||
          i.sku.toLowerCase().includes(q) ||
          i.codigo_barras.toLowerCase().includes(q) ||
          i.categoria.toLowerCase().includes(q) ||
          i.movimientos.some(
            (m) =>
              m.numero_referencia.toLowerCase().includes(q) ||
              m.cliente_proveedor_info.toLowerCase().includes(q)
          )
      );
    }

    if (categoryFilter !== 'all') {
      list = list.filter((i) => i.categoria === categoryFilter);
    }

    if (statusFilter === 'ok') list = list.filter((i) => i.estado === 'OK');
    else if (statusFilter === 'low') list = list.filter((i) => i.estado === 'Bajo');
    else if (statusFilter === 'out') list = list.filter((i) => i.estado === 'Agotado');
    else if (statusFilter === 'with_movements') {
      list = list.filter(
        (i) =>
          i.total_vendido > 0 ||
          i.total_comprado > 0 ||
          i.total_devuelto > 0 ||
          i.total_ajustado_salida > 0 ||
          i.total_ajustado_entrada > 0 ||
          i.movimientos.some((m) => m.numero_referencia !== 'APERTURA-INV')
      );
    }

    return list;
  }, [generalData, searchGeneral, categoryFilter, statusFilter]);

  const paginatedGeneralItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredGeneralItems.slice(start, start + pageSize);
  }, [filteredGeneralItems, currentPage, pageSize]);

  const filteredKardexMovements = useMemo(() => {
    if (!kardexData) return [];
    let list = kardexData.movimientos;

    if (kardexSearch.trim()) {
      const q = kardexSearch.toLowerCase().trim();
      list = list.filter(
        (m) =>
          m.numero_referencia.toLowerCase().includes(q) ||
          m.cliente_proveedor_info.toLowerCase().includes(q) ||
          m.tipo.toLowerCase().includes(q)
      );
    }

    if (kardexTypeFilter !== 'all') {
      list = list.filter((m) => m.tipo === kardexTypeFilter);
    }

    if (kardexDateFrom) {
      list = list.filter((m) => m.fecha.slice(0, 10) >= kardexDateFrom);
    }

    if (kardexDateTo) {
      list = list.filter((m) => m.fecha.slice(0, 10) <= kardexDateTo);
    }

    return list;
  }, [kardexData, kardexSearch, kardexTypeFilter, kardexDateFrom, kardexDateTo]);

  const paginatedKardexMovements = useMemo(() => {
    const start = (kardexCurrentPage - 1) * kardexPageSize;
    return filteredKardexMovements.slice(start, start + kardexPageSize);
  }, [filteredKardexMovements, kardexCurrentPage, kardexPageSize]);

  const quickSearchProducts = useMemo(() => {
    if (!generalData) return [];
    const q = productQuickSearch.trim().toLowerCase();
<<<<<<< HEAD
    if (!q) return generalData.items.slice(0, 15);
    return generalData.items
      .filter(
        (p) =>
          p.nombre.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          p.codigo_barras.toLowerCase().includes(q)
      )
      .slice(0, 20);
=======
    if (!q) return generalData.items.slice(0, 30);
    return generalData.items
      .filter((p) => p.nombre.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q))
      .slice(0, 40);
>>>>>>> 57bbebe1c1b40ce6b28d91de9bc1ae3c21035762
  }, [generalData, productQuickSearch]);

  const handleExportGeneralExcel = async () => {
    if (!filteredGeneralItems.length) {
      toast.warning('No hay datos para exportar');
      return;
    }
    try {
      await exportarStockGeneralAExcel(
        filteredGeneralItems,
        `informe-stock-${new Date().toISOString().slice(0, 10)}.xlsx`
      );
<<<<<<< HEAD
      toast.success('Archivo Excel generado correctamente');
=======
      toast.success('Archivo Excel con productos y movimientos generado correctamente');
>>>>>>> 57bbebe1c1b40ce6b28d91de9bc1ae3c21035762
    } catch {
      toast.error('Error al exportar a Excel');
    }
  };

  const handleExportGeneralCsv = () => {
    if (!filteredGeneralItems.length) {
      toast.warning('No hay datos para exportar');
      return;
    }
    const headers = [
      'SKU',
      'Producto',
      'Categoría',
<<<<<<< HEAD
      'Precio Venta (RD$)',
=======
>>>>>>> 57bbebe1c1b40ce6b28d91de9bc1ae3c21035762
      'Precio Compra (RD$)',
      'Precio Venta (RD$)',
      'Apertura',
      'Compras (+)',
      'Devoluciones (+)',
      'Ventas (-)',
      'Ajustes (-)',
      'Stock Actual',
      'Unidad',
      'Valor Compra (RD$)',
      'Valor Venta (RD$)',
      'Estado',
      'Cant. Movimientos',
    ];
    const rows = filteredGeneralItems.map((p) => [
      p.sku,
      p.nombre,
      p.categoria,
<<<<<<< HEAD
      p.precio_venta,
=======
>>>>>>> 57bbebe1c1b40ce6b28d91de9bc1ae3c21035762
      p.precio_costo,
      p.precio_venta,
      p.stock_apertura,
      p.total_comprado,
      p.total_devuelto,
      p.total_vendido,
      p.total_ajustado_salida,
      p.stock_actual,
      p.unidad,
      p.valor_compra,
      p.valor_venta,
      p.estado,
      p.cantidad_movimientos,
    ]);
    exportarACSV(`informe-stock-${new Date().toISOString().slice(0, 10)}`, headers, rows);
    toast.success('Archivo CSV descargado correctamente');
  };

  const handleExportKardexExcel = async () => {
    if (!kardexData || !filteredKardexMovements.length) {
      toast.warning('No hay movimientos para exportar');
      return;
    }
    try {
      await exportarKardexAExcel(
        filteredKardexMovements,
        kardexData.producto.nombre,
        `kardex-${kardexData.producto.sku}-${new Date().toISOString().slice(0, 10)}.xlsx`
      );
      toast.success('Kardex en Excel generado correctamente');
    } catch {
      toast.error('Error al exportar a Excel');
    }
  };

  const handleExportKardexCsv = () => {
    if (!kardexData || !filteredKardexMovements.length) {
      toast.warning('No hay movimientos para exportar');
      return;
    }
    const headers = [
      'Tipo de Movimiento',
      'Entrada (+)',
      'Salida (-)',
      'Stock Anterior',
      'Stock Resultante',
      'Fecha y Hora',
      'Número de Referencia / NCF',
      'Cliente / Proveedor / Responsable',
      'Notas',
    ];
    const rows = filteredKardexMovements.map((m) => [
      m.tipo,
      m.cantidad_entrada,
      m.cantidad_salida,
      m.stock_anterior,
      m.stock_resultante,
      m.fecha_formateada,
      m.numero_referencia,
      m.cliente_proveedor_info,
      m.notas || '',
    ]);
    exportarACSV(
      `kardex-${kardexData.producto.sku}-${new Date().toISOString().slice(0, 10)}`,
      headers,
      rows
    );
    toast.success('Kardex en CSV descargado correctamente');
  };

  if (loadingGeneral && !generalData) return <ReportLoading />;
  if (errorGeneral && !generalData) return <ReportError error={errorGeneral} />;

  // =========================================================================
<<<<<<< HEAD
  // VISTA 2: HISTORIAL DE EXISTENCIAS DE UN PRODUCTO (KARDEX)
=======
  // VISTA 2: HISTORIAL DE EXISTENCIAS DE UN PRODUCTO (KARDEX INDIVIDUAL)
>>>>>>> 57bbebe1c1b40ce6b28d91de9bc1ae3c21035762
  // =========================================================================
  if (selectedProductId) {
    if (loadingKardex && !kardexData) return <ReportLoading />;
    if (errorKardex && !kardexData) {
      return (
        <div className="space-y-4">
          <button
            type="button"
            onClick={() => setSelectedProductId(null)}
            className="btn-secondary flex items-center gap-1.5 text-xs"
          >
            <ArrowLeft size={14} /> Volver a Informe de Stock
          </button>
          <ReportError error={errorKardex} />
        </div>
      );
    }

    const prod = kardexData?.producto;
    const res = kardexData?.resumen;

    return (
      <div className="space-y-4 animate-fadeIn">
        {/* Barra superior de navegación y cambio rápido de producto */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-secondary/15 p-3 rounded-xl border border-border print:hidden">
          <button
            type="button"
            onClick={() => setSelectedProductId(null)}
            className="btn-secondary flex items-center gap-2 text-xs font-semibold self-start"
          >
            <ArrowLeft size={15} /> Volver a todos los productos
          </button>

          <div ref={quickSearchRef} className="relative sm:w-80">
            <div className="relative">
              <input
                type="text"
                className="input-field text-xs pl-8 pr-7 w-full font-medium"
                placeholder="Cambiar de producto..."
                value={isQuickSearchOpen ? productQuickSearch : `${prod?.nombre ?? ''} (${prod?.sku ?? ''})`}
                onFocus={() => {
                  setIsQuickSearchOpen(true);
                  setProductQuickSearch('');
                }}
                onChange={(e) => {
                  setProductQuickSearch(e.target.value);
                  if (!isQuickSearchOpen) setIsQuickSearchOpen(true);
                }}
              />
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              {isQuickSearchOpen && (
                <button
                  type="button"
                  onClick={() => setIsQuickSearchOpen(false)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5"
                  aria-label="Cerrar selector"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            {isQuickSearchOpen && (
              <div className="absolute z-30 left-0 right-0 mt-1 max-h-56 overflow-y-auto bg-card border border-border rounded-xl shadow-2xl divide-y divide-border/50">
                {quickSearchProducts.length === 0 ? (
                  <p className="p-3 text-xs text-muted-foreground text-center">Sin coincidencias</p>
                ) : (
                  quickSearchProducts.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setSelectedProductId(p.id);
                        setIsQuickSearchOpen(false);
                        setProductQuickSearch('');
                      }}
                      className="w-full text-left p-2.5 hover:bg-secondary/40 transition-colors text-xs flex items-center justify-between group"
                    >
                      <div className="min-w-0 pr-2">
                        <div className="font-semibold text-foreground group-hover:text-primary truncate">
                          {p.nombre}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          SKU: {p.sku} · Stock: {p.stock_actual} {p.unidad}
                        </div>
                      </div>
                      <span className="text-[11px] text-primary font-semibold">Ver →</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

<<<<<<< HEAD
        {/* Resumen del Producto */}
        <div className="card p-4 sm:p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                <Package size={20} className="text-primary" />
                {prod?.nombre}
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                SKU: <span className="font-mono font-semibold text-foreground">{prod?.sku}</span> · Categoría:{' '}
                <span className="text-foreground">{prod?.categoria}</span> · Unidad:{' '}
                <span className="text-foreground">{prod?.unidad}</span>
                {prod?.producto_base_id && (
                  <span className="ml-2 inline-flex items-center gap-1 bg-info/10 text-info px-2 py-0.5 rounded text-[11px] font-semibold">
                    <Layers size={11} /> {prod.factor_conversion}x
                  </span>
                )}
              </p>
            </div>
            {prod && <StockEstadoBadge estado={prod.estado} />}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-3 border-t border-border">
            <div className="space-y-1.5 bg-success/5 p-3 rounded-xl border border-success/20">
=======
        {/* Card de Encabezado y Resumen del Producto */}
        <div className="card p-5 space-y-4 border border-border/80 shadow-sm">
          <div>
            <h2 className="text-xl font-bold text-foreground uppercase tracking-tight flex items-center gap-2">
              <Package size={22} className="text-primary" />
              {prod?.nombre} ({prod?.sku})
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Categoría: <strong className="text-foreground">{prod?.categoria}</strong> • Unidad:{' '}
              <strong className="text-foreground">{prod?.unidad}</strong>
              {prod?.producto_base_id && (
                <span className="ml-2 inline-flex items-center gap-1 bg-info/10 text-info px-2 py-0.5 rounded text-[11px] font-semibold">
                  <Layers size={11} /> Presentación vinculada ({prod.factor_conversion}x)
                </span>
              )}
            </p>
          </div>

          {/* Grid de 3 Columnas: Cantidades en, Cantidades fuera y Totales */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-3 border-t border-border">
            <div className="space-y-2 bg-success/5 p-3.5 rounded-xl border border-success/20">
>>>>>>> 57bbebe1c1b40ce6b28d91de9bc1ae3c21035762
              <div className="flex items-center gap-1.5 text-xs font-bold text-success uppercase tracking-wider">
                <ArrowDownRight size={14} /> Entradas
              </div>
              <div className="text-xs space-y-1 pt-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Compras / Anulaciones:</span>
                  <span className="font-bold font-mono text-foreground">
                    {res?.cantidades_en.compra_total.toFixed(2)} {prod?.unidad}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Stock de apertura:</span>
                  <span className="font-bold font-mono text-foreground">
                    {res?.cantidades_en.stock_apertura.toFixed(2)} {prod?.unidad}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Devoluciones de venta:</span>
                  <span className="font-bold font-mono text-foreground">
                    {res?.cantidades_en.total_devolucion_venta.toFixed(2)} {prod?.unidad}
                  </span>
                </div>
<<<<<<< HEAD
              </div>
            </div>

            <div className="space-y-1.5 bg-danger/5 p-3 rounded-xl border border-danger/20">
=======
                <div className="flex justify-between items-center text-muted-foreground/80">
                  <span>Ajustes positivos (En):</span>
                  <span className="font-mono">
                    {(res?.cantidades_en.transferencias_en || 0).toFixed(2)} {prod?.unidad}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-2 bg-danger/5 p-3.5 rounded-xl border border-danger/20">
>>>>>>> 57bbebe1c1b40ce6b28d91de9bc1ae3c21035762
              <div className="flex items-center gap-1.5 text-xs font-bold text-danger uppercase tracking-wider">
                <ArrowUpRight size={14} /> Salidas
              </div>
              <div className="text-xs space-y-1 pt-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total vendido:</span>
                  <span className="font-bold font-mono text-danger">
                    {res?.cantidades_fuera.total_vendido.toFixed(2)} {prod?.unidad}
                  </span>
                </div>
<<<<<<< HEAD
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Ajustes de salida:</span>
                  <span className="font-bold font-mono text-foreground">
=======
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Ajuste / Salida de stock:</span>
                  <span className="font-bold text-foreground font-mono">
>>>>>>> 57bbebe1c1b40ce6b28d91de9bc1ae3c21035762
                    {res?.cantidades_fuera.ajuste_total.toFixed(2)} {prod?.unidad}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Devoluciones de compra:</span>
                  <span className="font-bold font-mono text-foreground">
                    {res?.cantidades_fuera.total_devolucion_compra.toFixed(2)} {prod?.unidad}
                  </span>
                </div>
              </div>
            </div>

<<<<<<< HEAD
            <div className="space-y-1 bg-primary/5 p-3 rounded-xl border border-primary/20 flex flex-col justify-center">
              <div className="text-xs font-bold text-primary uppercase tracking-wider">Stock actual</div>
              <div className="text-2xl font-extrabold text-primary font-mono">
                {res?.totales.stock_actual.toFixed(2)}{' '}
                <span className="text-xs font-semibold text-muted-foreground">{prod?.unidad}</span>
=======
            <div className="space-y-2 bg-primary/5 p-3.5 rounded-xl border border-primary/25 flex flex-col justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold text-primary uppercase tracking-wider">
                <Package size={15} /> Totales
>>>>>>> 57bbebe1c1b40ce6b28d91de9bc1ae3c21035762
              </div>
              <div className="text-[11px] text-muted-foreground">
                Valor a venta: <strong className="text-foreground">{formatRD(prod?.valor_venta || 0)}</strong>
              </div>
            </div>
          </div>
        </div>

<<<<<<< HEAD
        {/* Filtros de Kardex */}
        <div className="card p-3 flex flex-wrap items-center justify-between gap-2.5 print:hidden">
          <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
            <div className="relative w-full sm:w-56">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Buscar NCF, factura, cliente..."
                value={kardexSearch}
=======
        {/* Toolbar de Filtros y Exportación de Kardex */}
        <div className="card p-4 space-y-3">
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span>Mostrar</span>
                <select
                  value={kardexPageSize}
                  onChange={(e) => {
                    setKardexPageSize(Number(e.target.value));
                    setKardexCurrentPage(1);
                  }}
                  className="input-field py-1 px-2 text-xs w-24"
                >
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={-1}>Todos</option>
                </select>
                <span>movimientos</span>
              </div>

              <div className="flex items-center gap-1.5 pl-2 border-l border-border flex-wrap">
                <button
                  type="button"
                  onClick={handleExportKardexCsv}
                  className="btn-secondary text-xs flex items-center gap-1 py-1 px-2.5"
                  title="Exportar a CSV"
                >
                  <FileText size={13} /> CSV
                </button>
                <button
                  type="button"
                  onClick={handleExportKardexExcel}
                  className="btn-secondary text-xs flex items-center gap-1 py-1 px-2.5"
                  title="Exportar a Excel"
                >
                  <FileSpreadsheet size={13} /> Excel
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="btn-secondary text-xs flex items-center gap-1 py-1 px-2.5"
                  title="Imprimir Kardex"
                >
                  <Printer size={13} /> Imprimir
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={kardexTypeFilter}
                onChange={(e) => {
                  setKardexTypeFilter(e.target.value);
                  setKardexCurrentPage(1);
                }}
                className="input-field py-1 px-2.5 text-xs w-40"
              >
                <option value="all">Todos los tipos</option>
                <option value="Ventas">Solo Ventas</option>
                <option value="Compras">Solo Compras</option>
                <option value="Ajuste de Stock">Ajustes de inventario</option>
                <option value="Devolución de Venta">Devoluciones</option>
                <option value="Anulación">Anulaciones</option>
                <option value="Edición de factura">Edición de facturas</option>
              </select>

              <div className="relative w-64">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Buscar NCF, Factura, Cliente..."
                  value={kardexSearch}
                  onChange={(e) => {
                    setKardexSearch(e.target.value);
                    setKardexCurrentPage(1);
                  }}
                  className="input-field pl-8 pr-7 py-1 text-xs w-full"
                />
                {kardexSearch && (
                  <button
                    type="button"
                    onClick={() => setKardexSearch('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Tabla de Movimientos de Kardex */}
        <div className="card overflow-hidden border border-border shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-secondary/50 text-left text-muted-foreground font-semibold">
                  <th className="px-3.5 py-3">Fecha y Hora</th>
                  <th className="px-3.5 py-3">Tipo</th>
                  <th className="px-3.5 py-3">Doc / Motivo</th>
                  <th className="px-3.5 py-3 text-right">Entrada</th>
                  <th className="px-3.5 py-3 text-right">Salida</th>
                  <th className="px-3.5 py-3 text-right">Stock Anterior</th>
                  <th className="px-3.5 py-3 text-right font-black text-foreground">Stock Resultante</th>
                  <th className="px-3.5 py-3">Detalle / Cliente / Proveedor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {paginatedKardexMovements.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
                      <History size={32} className="mx-auto mb-2 opacity-30" />
                      <p className="font-semibold text-foreground">No hay movimientos registrados</p>
                      <p className="text-[11px] mt-0.5">
                        Las ventas, compras, ajustes, anulaciones y ediciones de este producto se reflejarán automáticamente en este Kardex.
                      </p>
                    </td>
                  </tr>
                ) : (
                  paginatedKardexMovements.map((m) => (
                    <tr key={m.id} className="hover:bg-secondary/25 transition-colors">
                      <td className="px-3.5 py-3 whitespace-nowrap text-muted-foreground font-mono">
                        {m.fecha_formateada}
                      </td>
                      <td className="px-3.5 py-3 whitespace-nowrap">{renderMovementBadge(m.tipo)}</td>
                      <td className="px-3.5 py-3 whitespace-nowrap font-mono font-bold text-primary">
                        {m.numero_referencia}
                      </td>
                      <td className="px-3.5 py-3 text-right font-mono font-bold text-success whitespace-nowrap">
                        {m.cantidad_entrada > 0 ? `+${m.cantidad_entrada.toFixed(2)}` : '—'}
                      </td>
                      <td className="px-3.5 py-3 text-right font-mono font-bold text-danger whitespace-nowrap">
                        {m.cantidad_salida > 0 ? `-${m.cantidad_salida.toFixed(2)}` : '—'}
                      </td>
                      <td className="px-3.5 py-3 text-right font-mono text-muted-foreground whitespace-nowrap">
                        {(m.stock_anterior ?? 0).toFixed(2)}
                      </td>
                      <td className="px-3.5 py-3 text-right font-mono font-extrabold text-foreground whitespace-nowrap">
                        {(m.stock_resultante ?? m.nueva_cantidad ?? 0).toFixed(2)}
                      </td>
                      <td className="px-3.5 py-3 text-foreground font-medium max-w-xs truncate">
                        {m.cliente_proveedor_info}
                        {m.notas && (
                          <span className="block text-[11px] text-muted-foreground italic truncate">
                            {m.notas}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {filteredKardexMovements.length > 0 && kardexPageSize !== -1 && (
            <div className="flex items-center justify-between p-3 border-t border-border bg-secondary/10 text-xs">
              <span className="text-muted-foreground">
                Mostrando {Math.min((kardexCurrentPage - 1) * kardexPageSize + 1, filteredKardexMovements.length)} a{' '}
                {Math.min(kardexCurrentPage * kardexPageSize, filteredKardexMovements.length)} de{' '}
                {filteredKardexMovements.length} movimientos
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={kardexCurrentPage <= 1}
                  onClick={() => setKardexCurrentPage((p) => Math.max(1, p - 1))}
                  className="btn-secondary py-1 px-2 text-xs disabled:opacity-40"
                >
                  <ChevronLeft size={14} /> Anterior
                </button>
                <span className="px-2 font-bold text-foreground font-mono">
                  {kardexCurrentPage} / {totalPagesKardex}
                </span>
                <button
                  type="button"
                  disabled={kardexCurrentPage >= totalPagesKardex}
                  onClick={() => setKardexCurrentPage((p) => Math.min(totalPagesKardex, p + 1))}
                  className="btn-secondary py-1 px-2 text-xs disabled:opacity-40"
                >
                  Siguiente <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // =========================================================================
  // VISTA 1: INFORME DE STOCK GENERAL (TODOS LOS PRODUCTOS + SUS MOVIMIENTOS)
  // =========================================================================
  const general = generalData;

  return (
    <div className="space-y-5 animate-fadeIn">
      {/* 4 Cards Superiores */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-4 space-y-1 border border-border shadow-sm">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-tight">
            Stock de cierre (Por precio de compra)
          </p>
          <p className="text-2xl font-extrabold text-foreground font-mono mt-1">
            {formatRD(general?.stock_cierre_compra || 0)}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {general?.total_productos || 0} productos en catálogo
          </p>
        </div>

        <div className="card p-4 space-y-1 border border-border shadow-sm">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-tight">
            Stock de cierre (Por precio de venta)
          </p>
          <p className="text-2xl font-extrabold text-primary font-mono mt-1">
            {formatRD(general?.stock_cierre_venta || 0)}
          </p>
          <p className="text-[11px] text-muted-foreground">Valor total estimado de venta</p>
        </div>

        <div className="card p-4 space-y-1 border border-border shadow-sm">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-tight">
            Beneficio potencial
          </p>
          <p className="text-2xl font-extrabold text-success font-mono mt-1">
            {formatRD(general?.beneficio_potencial || 0)}
          </p>
          <p className="text-[11px] text-muted-foreground">Ganancia proyectada en inventario</p>
        </div>

        <div className="card p-4 space-y-1 border border-border shadow-sm">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-tight">
            Margen de Rentabilidad %
          </p>
          <p className="text-2xl font-extrabold text-warning font-mono mt-1">
            {general?.profit_margin_pct?.toFixed(2) || '0.00'}%
          </p>
          <p className="text-[11px] text-muted-foreground">
            {general?.total_movimientos_global || 0} movimientos registrados
          </p>
        </div>
      </div>

      {/* Toolbar y Acciones */}
      <div className="card p-4 space-y-3">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 flex-wrap">
          {/* Selector de entradas, toggle de movimientos y botones de exportación */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span>Mostrar</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="input-field py-1 px-2 text-xs w-28 font-semibold"
              >
                <option value={-1}>Todos ({filteredGeneralItems.length})</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={250}>250</option>
              </select>
              <span>productos</span>
            </div>

            <button
              type="button"
              onClick={() => {
                const next = !showAllMovementsInline;
                setShowAllMovementsInline(next);
                setExpandedProductIds({});
              }}
              className={`text-xs flex items-center gap-1.5 py-1.5 px-3 rounded-lg font-bold border transition-all ${
                showAllMovementsInline
                  ? 'bg-primary text-white border-primary shadow-xs'
                  : 'bg-secondary/40 text-foreground border-border hover:bg-secondary'
              }`}
            >
              <History size={13} />
              {showAllMovementsInline ? 'Ocultar movimientos en tabla' : 'Mostrar movimientos de cada producto'}
            </button>

            <div className="flex items-center gap-1.5 pl-2 border-l border-border flex-wrap">
              <button
                type="button"
                onClick={handleExportGeneralCsv}
                className="btn-secondary text-xs flex items-center gap-1 py-1 px-2.5"
                title="Exportar tabla a formato CSV"
              >
                <FileText size={13} /> CSV
              </button>
              <button
                type="button"
                onClick={handleExportGeneralExcel}
                className="btn-secondary text-xs flex items-center gap-1 py-1 px-2.5"
                title="Exportar productos y sus movimientos a Excel"
              >
                <FileSpreadsheet size={13} /> Excel
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="btn-secondary text-xs flex items-center gap-1 py-1 px-2.5"
                title="Imprimir informe actual"
              >
                <Printer size={13} /> Imprimir
              </button>
            </div>
          </div>

          {/* Filtros de Categoría, Estado y Búsqueda */}
          <div className="flex items-center gap-2 flex-wrap">
            {categories.length > 0 && (
              <select
                value={categoryFilter}
                onChange={(e) => {
                  setCategoryFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="input-field py-1 px-2.5 text-xs w-40"
              >
                <option value="all">Todas las categorías</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            )}

            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as any);
                setCurrentPage(1);
              }}
              className="input-field py-1 px-2.5 text-xs w-44"
            >
              <option value="all">Todos los productos</option>
              <option value="with_movements">Con ventas / compras / ajustes</option>
              <option value="ok">Con Stock (OK)</option>
              <option value="low">Stock Bajo</option>
              <option value="out">Agotados</option>
            </select>

            <div className="relative w-64">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Buscar producto, SKU, factura..."
                value={searchGeneral}
>>>>>>> 57bbebe1c1b40ce6b28d91de9bc1ae3c21035762
                onChange={(e) => {
                  setKardexSearch(e.target.value);
                  setKardexCurrentPage(1);
                }}
                className="input-field pl-8 pr-7 py-1.5 text-xs w-full"
              />
              {kardexSearch && (
                <button
                  type="button"
                  onClick={() => {
                    setKardexSearch('');
                    setKardexCurrentPage(1);
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            <select
              value={kardexTypeFilter}
              onChange={(e) => {
                setKardexTypeFilter(e.target.value);
                setKardexCurrentPage(1);
              }}
              className="input-field py-1.5 px-2.5 text-xs w-40"
            >
              <option value="all">Todos los tipos</option>
              <option value="Ventas">Solo Ventas</option>
              <option value="Compras">Solo Compras</option>
              <option value="Ajuste de Stock">Ajustes</option>
              <option value="Devolución de Venta">Devoluciones</option>
              <option value="Anulación">Anulaciones</option>
              <option value="Edición de factura">Edición facturas</option>
            </select>

            <input
              type="date"
              value={kardexDateFrom}
              onChange={(e) => {
                setKardexDateFrom(e.target.value);
                setKardexCurrentPage(1);
              }}
              aria-label="Fecha desde"
              className="input-field py-1.5 px-2 text-xs w-36"
            />
            <input
              type="date"
              value={kardexDateTo}
              onChange={(e) => {
                setKardexDateTo(e.target.value);
                setKardexCurrentPage(1);
              }}
              aria-label="Fecha hasta"
              className="input-field py-1.5 px-2 text-xs w-36"
            />
            {(kardexDateFrom || kardexDateTo) && (
              <button
                type="button"
                onClick={() => {
                  setKardexDateFrom('');
                  setKardexDateTo('');
                  setKardexCurrentPage(1);
                }}
                className="text-xs text-muted-foreground hover:text-foreground underline px-1"
              >
                Limpiar fechas
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleExportKardexCsv}
              className="btn-secondary text-xs flex items-center gap-1 py-1.5 px-2.5"
            >
              <FileText size={13} /> CSV
            </button>
            <button
              type="button"
              onClick={handleExportKardexExcel}
              className="btn-secondary text-xs flex items-center gap-1 py-1.5 px-2.5"
            >
              <FileSpreadsheet size={13} /> Excel
            </button>
          </div>
        </div>

        {/* Tabla de Movimientos */}
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-secondary/50 text-left text-muted-foreground font-semibold">
                  <th className="px-3.5 py-3">Fecha y Hora</th>
                  <th className="px-3.5 py-3">Tipo</th>
                  <th className="px-3.5 py-3">Referencia</th>
                  <th className="px-3.5 py-3 text-right">Entrada</th>
                  <th className="px-3.5 py-3 text-right">Salida</th>
                  <th className="px-3.5 py-3 text-right">Anterior</th>
                  <th className="px-3.5 py-3 text-right font-bold text-foreground">Saldo</th>
                  <th className="px-3.5 py-3">Detalle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {paginatedKardexMovements.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
                      <History size={28} className="mx-auto mb-2 opacity-30" />
                      <p className="font-semibold text-foreground">No hay movimientos para mostrar</p>
                      <p className="text-[11px] mt-0.5">
                        Prueba ajustando los filtros de tipo o rango de fechas.
                      </p>
                    </td>
                  </tr>
                ) : (
                  paginatedKardexMovements.map((m) => (
                    <tr key={m.id} className="hover:bg-secondary/25 transition-colors">
                      <td className="px-3.5 py-2.5 whitespace-nowrap text-muted-foreground font-mono">
                        {m.fecha_formateada}
                      </td>
                      <td className="px-3.5 py-2.5 whitespace-nowrap">
                        {m.tipo === 'Ventas' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-info/10 text-info">
                            <ShoppingCart size={11} /> Venta
                          </span>
                        )}
                        {m.tipo === 'Compras' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-success/10 text-success">
                            <ShoppingBag size={11} /> Compra
                          </span>
                        )}
                        {m.tipo === 'Ajuste de Stock' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-warning/10 text-warning">
                            <Sliders size={11} /> Ajuste
                          </span>
                        )}
                        {m.tipo === 'Devolución de Venta' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-purple-500/10 text-purple-600 dark:text-purple-400">
                            <RotateCcw size={11} /> Devolución
                          </span>
                        )}
                        {m.tipo === 'Devolución de Compra' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-danger/10 text-danger">
                            <RotateCcw size={11} /> Dev. Compra
                          </span>
                        )}
                        {m.tipo === 'Anulación' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400">
                            <AlertCircle size={11} /> Anulación
                          </span>
                        )}
                        {m.tipo === 'Edición de factura' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-sky-500/10 text-sky-600 dark:text-sky-400">
                            <Edit size={11} /> Edición Factura
                          </span>
                        )}
                        {m.tipo === 'Transferencia' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-500/10 text-slate-600">
                            <Layers size={11} /> Transferencia
                          </span>
                        )}
                      </td>
                      <td className="px-3.5 py-2.5 whitespace-nowrap font-mono font-semibold text-primary">
                        {m.numero_referencia}
                      </td>
                      <td className="px-3.5 py-2.5 text-right font-mono font-bold text-success whitespace-nowrap">
                        {m.cantidad_entrada > 0 ? `+${m.cantidad_entrada.toFixed(2)}` : '—'}
                      </td>
                      <td className="px-3.5 py-2.5 text-right font-mono font-bold text-danger whitespace-nowrap">
                        {m.cantidad_salida > 0 ? `-${m.cantidad_salida.toFixed(2)}` : '—'}
                      </td>
                      <td className="px-3.5 py-2.5 text-right font-mono text-muted-foreground whitespace-nowrap">
                        {(m.stock_anterior ?? 0).toFixed(2)}
                      </td>
                      <td className="px-3.5 py-2.5 text-right font-mono font-bold text-foreground whitespace-nowrap">
                        {(m.stock_resultante ?? m.nueva_cantidad ?? 0).toFixed(2)}
                      </td>
                      <td className="px-3.5 py-2.5 text-foreground max-w-xs truncate">
                        {m.cliente_proveedor_info}
                        {m.notas && (
                          <span className="block text-[11px] text-muted-foreground italic truncate">
                            {m.notas}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <ReportPagination
            totalItems={filteredKardexMovements.length}
            currentPage={kardexCurrentPage}
            pageSize={kardexPageSize}
            onPageChange={setKardexCurrentPage}
            onPageSizeChange={(size) => {
              setKardexPageSize(size);
              setKardexCurrentPage(1);
            }}
            itemLabel="movimientos"
          />
        </div>
      </div>
    );
  }

  // =========================================================================
  // VISTA 1: INFORME DE STOCK GENERAL
  // =========================================================================
  const general = generalData;

  return (
    <div className="space-y-4 animate-fadeIn">
      {/* 4 Cards Resumen */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-4">
          <p className="text-xs font-medium text-muted-foreground">Valor a costo</p>
          <p className="text-xl font-bold text-foreground font-mono mt-1">
            {formatRD(general?.stock_cierre_compra || 0)}
          </p>
          <p className="text-[11px] text-muted-foreground mt-1">
            {general?.total_productos || 0} productos activos
          </p>
        </div>

        <div className="card p-4">
          <p className="text-xs font-medium text-muted-foreground">Valor a venta</p>
          <p className="text-xl font-bold text-primary font-mono mt-1">
            {formatRD(general?.stock_cierre_venta || 0)}
          </p>
          <p className="text-[11px] text-muted-foreground mt-1">Estimado a precio de venta</p>
        </div>

        <div className="card p-4">
          <p className="text-xs font-medium text-muted-foreground">Beneficio potencial</p>
          <p className="text-xl font-bold text-success font-mono mt-1">
            {formatRD(general?.beneficio_potencial || 0)}
          </p>
          <p className="text-[11px] text-muted-foreground mt-1">Ganancia proyectada</p>
        </div>

        <div className="card p-4">
          <p className="text-xs font-medium text-muted-foreground">Margen de ganancia</p>
          <p className="text-xl font-bold text-warning font-mono mt-1">
            {general?.profit_margin_pct?.toFixed(2) || '0.00'}%
          </p>
          <p className="text-[11px] text-muted-foreground mt-1">
            {general?.total_bajos || 0} bajo · {general?.total_agotados || 0} agotados
          </p>
        </div>
      </div>

<<<<<<< HEAD
      {/* Barra limpia de filtros y exportación */}
      <div className="card p-3 flex flex-wrap items-center justify-between gap-2.5 print:hidden">
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
          <div className="relative w-full sm:w-64">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar producto, SKU o código…"
              value={searchGeneral}
              onChange={(e) => {
                setSearchGeneral(e.target.value);
                setCurrentPage(1);
              }}
              className="input-field pl-8 pr-7 py-1.5 text-xs w-full"
            />
            {searchGeneral && (
              <button
                type="button"
                onClick={() => {
                  setSearchGeneral('');
                  setCurrentPage(1);
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Limpiar búsqueda"
              >
                <X size={12} />
              </button>
            )}
          </div>

          {categories.length > 0 && (
            <select
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="input-field py-1.5 px-2.5 text-xs w-44"
            >
              <option value="all">Todas las categorías</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          )}

          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as 'all' | 'ok' | 'low' | 'out');
              setCurrentPage(1);
            }}
            className="input-field py-1.5 px-2.5 text-xs w-36"
          >
            <option value="all">Todos los estados</option>
            <option value="ok">Con Stock (OK)</option>
            <option value="low">Stock Bajo</option>
            <option value="out">Agotados</option>
          </select>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleExportGeneralCsv}
            className="btn-secondary text-xs flex items-center gap-1 py-1.5 px-2.5"
            title="Exportar tabla filtrada a CSV"
          >
            <FileText size={13} /> CSV
          </button>
          <button
            type="button"
            onClick={handleExportGeneralExcel}
            className="btn-secondary text-xs flex items-center gap-1 py-1.5 px-2.5"
            title="Exportar tabla filtrada a Excel"
          >
            <FileSpreadsheet size={13} /> Excel
          </button>
        </div>
      </div>

      {/* Tabla compacta (7 columnas claras y paginadas de 10 en 10 por defecto) */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-secondary/40 text-left text-muted-foreground font-semibold uppercase tracking-wider">
                <th className="px-4 py-3">Producto</th>
                <th className="px-3 py-3">Categoría</th>
                <th className="px-3 py-3 text-right">Stock</th>
                <th className="px-3 py-3 text-right">P. Venta</th>
                <th className="px-3 py-3 text-right">Valor Costo</th>
                <th className="px-3 py-3 text-right">Valor Venta</th>
                <th className="px-3 py-3 text-center print:hidden">Kardex</th>
=======
      {/* Tabla Principal de Stock con Movimientos Desplegables por Producto */}
      <div className="card overflow-hidden border border-border shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-secondary/50 text-left text-muted-foreground font-semibold">
                <th className="px-3 py-3 text-center">Movimientos / Kardex</th>
                <th className="px-3 py-3">SKU</th>
                <th className="px-3 py-3">Producto</th>
                <th className="px-3 py-3">Categoría</th>
                <th className="px-3 py-3 text-right">Precio Venta</th>
                <th className="px-3 py-3 text-right text-success">Entradas (+)</th>
                <th className="px-3 py-3 text-right text-danger">Salidas (-)</th>
                <th className="px-3 py-3 text-right">Stock Actual</th>
                <th className="px-3 py-3 text-right">Valor Compra</th>
                <th className="px-3 py-3 text-right">Valor Venta</th>
>>>>>>> 57bbebe1c1b40ce6b28d91de9bc1ae3c21035762
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {paginatedGeneralItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                    <Package size={28} className="mx-auto mb-2 opacity-30" />
                    <p className="font-semibold text-foreground">No se encontraron productos</p>
                    <p className="text-[11px] mt-0.5">Prueba cambiando los filtros de búsqueda.</p>
                  </td>
                </tr>
              ) : (
<<<<<<< HEAD
                paginatedGeneralItems.map((p) => (
                  <tr key={p.id} className="hover:bg-secondary/25 transition-colors">
                    <td className="px-4 py-2.5">
                      <div className="font-semibold text-foreground max-w-xs truncate">{p.nombre}</div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[11px] font-mono text-primary font-semibold">{p.sku}</span>
                        {p.producto_base_id && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] text-info bg-info/10 px-1.5 py-0.5 rounded font-medium">
                            <Layers size={10} /> {p.factor_conversion}x
                          </span>
                        )}
                        {p.es_pesado && (
                          <span className="inline-flex items-center text-[10px] text-warning bg-warning/10 px-1.5 py-0.5 rounded font-medium">
                            Pesado
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">
                      {p.categoria}
                    </td>

                    <td className="px-3 py-2.5 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-2 justify-end">
                        <span
                          className={`font-mono font-bold ${
                            p.estado === 'Agotado'
                              ? 'text-danger'
                              : p.estado === 'Bajo'
                              ? 'text-warning'
                              : 'text-foreground'
                          }`}
                        >
                          {p.stock_actual.toLocaleString('es-DO', {
                            minimumFractionDigits: p.es_pesado ? 2 : 0,
                          })}{' '}
                          <span className="text-[10px] uppercase font-semibold text-muted-foreground">
                            {p.unidad}
                          </span>
                        </span>
                        <StockEstadoBadge estado={p.estado} />
                      </div>
                    </td>

                    <td className="px-3 py-2.5 text-right font-mono text-foreground whitespace-nowrap">
                      {formatRD(p.precio_venta)}
                    </td>

                    <td className="px-3 py-2.5 text-right font-mono text-muted-foreground whitespace-nowrap">
                      {formatRD(p.valor_compra)}
                    </td>

                    <td className="px-3 py-2.5 text-right font-mono font-bold text-primary whitespace-nowrap">
                      {formatRD(p.valor_venta)}
                    </td>

                    <td className="px-3 py-2.5 text-center whitespace-nowrap print:hidden">
                      <button
                        type="button"
                        onClick={() => setSelectedProductId(p.id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-primary/30 bg-primary/5 hover:bg-primary hover:text-white text-primary text-[11px] font-semibold transition-colors"
                        title={`Ver historial de movimientos para ${p.nombre}`}
                      >
                        <History size={12} />
                        <span>Historial</span>
                      </button>
                    </td>
                  </tr>
                ))
=======
                paginatedGeneralItems.map((p) => {
                  const expanded = isProductExpanded(p.id);
                  const entriesWithoutOpening = p.total_comprado + p.total_devuelto + p.total_ajustado_entrada;

                  return (
                    <React.Fragment key={p.id}>
                      <tr className="hover:bg-secondary/25 transition-colors">
                        {/* Botones de Acción: Ver movimientos en fila + Abrir Kardex individual */}
                        <td className="px-3 py-2.5 text-center whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => toggleProductExpanded(p.id)}
                              className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-[11px] font-bold transition-all ${
                                expanded
                                  ? 'border-primary bg-primary/10 text-primary'
                                  : 'border-border bg-secondary/40 text-foreground hover:bg-secondary'
                              }`}
                              title="Desplegar u ocultar los movimientos de este producto"
                            >
                              {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                              <span>Movimientos ({p.cantidad_movimientos})</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setSelectedProductId(p.id)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-primary/30 bg-primary/5 hover:bg-primary hover:text-white text-primary text-[11px] font-bold transition-all shadow-2xs"
                              title={`Abrir vista detallada de Kardex para ${p.nombre}`}
                            >
                              <History size={13} />
                              <span>Kardex</span>
                            </button>
                          </div>
                        </td>

                        {/* SKU */}
                        <td className="px-3 py-3 font-mono font-bold text-primary whitespace-nowrap">
                          {p.sku}
                        </td>

                        {/* Producto */}
                        <td className="px-3 py-3 font-bold text-foreground">
                          <div className="max-w-xs truncate">{p.nombre}</div>
                          <div className="flex items-center gap-2 mt-0.5">
                            {p.codigo_barras && p.codigo_barras !== p.sku && (
                              <span className="text-[10px] text-muted-foreground font-mono">
                                CB: {p.codigo_barras}
                              </span>
                            )}
                            {p.producto_base_id && (
                              <span className="inline-flex items-center gap-0.5 text-[10px] text-info bg-info/10 px-1.5 py-0.2 rounded font-medium">
                                <Layers size={10} /> {p.unidad} ({p.factor_conversion}x)
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Categoría */}
                        <td className="px-3 py-3 text-muted-foreground whitespace-nowrap">
                          {p.categoria}
                        </td>

                        {/* Precio de venta unitario */}
                        <td className="px-3 py-3 text-right font-mono font-bold text-foreground whitespace-nowrap">
                          {formatRD(p.precio_venta)}
                        </td>

                        {/* Entradas (+) */}
                        <td className="px-3 py-3 text-right font-mono whitespace-nowrap">
                          {entriesWithoutOpening > 0 ? (
                            <div>
                              <span className="font-bold text-success">+{entriesWithoutOpening.toFixed(2)}</span>
                              <span className="block text-[10px] text-muted-foreground">
                                Apertura: {p.stock_apertura.toFixed(0)}
                              </span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground" title="Stock de apertura">
                              {p.stock_apertura > 0 ? `Ap: ${p.stock_apertura.toFixed(0)}` : '0'}
                            </span>
                          )}
                        </td>

                        {/* Salidas (-) */}
                        <td className="px-3 py-3 text-right font-mono whitespace-nowrap">
                          {p.total_salidas > 0 ? (
                            <div>
                              <span className="font-bold text-danger">-{p.total_salidas.toFixed(2)}</span>
                              {p.total_vendido > 0 && (
                                <span className="block text-[10px] text-muted-foreground">
                                  Vend: {p.total_vendido.toFixed(2)}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">0</span>
                          )}
                        </td>

                        {/* Stock actual */}
                        <td className="px-3 py-3 text-right whitespace-nowrap font-mono font-bold">
                          <span
                            className={
                              p.estado === 'Agotado'
                                ? 'text-danger'
                                : p.estado === 'Bajo'
                                ? 'text-warning font-semibold'
                                : 'text-foreground'
                            }
                          >
                            {p.stock_actual.toLocaleString('es-DO', {
                              minimumFractionDigits: p.es_pesado ? 2 : 0,
                            })}{' '}
                            <span className="text-[10px] uppercase font-semibold text-muted-foreground">
                              {p.unidad}
                            </span>
                          </span>
                        </td>

                        {/* Valor Compra */}
                        <td className="px-3 py-3 text-right font-mono text-muted-foreground whitespace-nowrap">
                          {formatRD(p.valor_compra)}
                        </td>

                        {/* Valor Venta */}
                        <td className="px-3 py-3 text-right font-mono font-bold text-primary whitespace-nowrap">
                          {formatRD(p.valor_venta)}
                        </td>
                      </tr>

                      {/* Sub-tabla con los movimientos del producto */}
                      {expanded && (
                        <tr className="bg-secondary/10">
                          <td colSpan={10} className="px-4 py-3 border-t border-border/60">
                            <div className="rounded-xl border border-border/80 bg-card overflow-hidden shadow-2xs">
                              <div className="px-3.5 py-2 bg-secondary/30 border-b border-border/60 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                                <div className="font-bold text-foreground flex items-center gap-1.5">
                                  <History size={13} className="text-primary" />
                                  <span>
                                    Movimientos de {p.nombre} ({p.sku})
                                  </span>
                                </div>
                                <div className="flex items-center gap-3 text-muted-foreground font-mono">
                                  <span>
                                    Apertura: <strong className="text-foreground">{p.stock_apertura.toFixed(2)}</strong>
                                  </span>
                                  <span>
                                    Compras: <strong className="text-success">+{p.total_comprado.toFixed(2)}</strong>
                                  </span>
                                  {p.total_devuelto > 0 && (
                                    <span>
                                      Devoluciones: <strong className="text-success">+{p.total_devuelto.toFixed(2)}</strong>
                                    </span>
                                  )}
                                  <span>
                                    Ventas: <strong className="text-danger">-{p.total_vendido.toFixed(2)}</strong>
                                  </span>
                                  {p.total_ajustado_salida > 0 && (
                                    <span>
                                      Ajustes: <strong className="text-warning">-{p.total_ajustado_salida.toFixed(2)}</strong>
                                    </span>
                                  )}
                                  <span>
                                    Stock Actual: <strong className="text-primary">{p.stock_actual.toFixed(2)} {p.unidad}</strong>
                                  </span>
                                </div>
                              </div>

                              {p.movimientos.length === 0 ? (
                                <div className="px-4 py-3 text-center text-[11px] text-muted-foreground">
                                  Sin movimientos registrados (Stock en 0).
                                </div>
                              ) : (
                                <div className="overflow-x-auto max-h-64 overflow-y-auto">
                                  <table className="w-full text-[11px]">
                                    <thead>
                                      <tr className="border-b border-border/60 bg-secondary/20 text-left text-muted-foreground font-semibold">
                                        <th className="px-3 py-1.5">Fecha y Hora</th>
                                        <th className="px-3 py-1.5">Tipo de Movimiento</th>
                                        <th className="px-3 py-1.5">Documento / Referencia</th>
                                        <th className="px-3 py-1.5 text-right">Entrada (+)</th>
                                        <th className="px-3 py-1.5 text-right">Salida (-)</th>
                                        <th className="px-3 py-1.5 text-right">Stock Anterior</th>
                                        <th className="px-3 py-1.5 text-right font-bold text-foreground">Stock Resultante</th>
                                        <th className="px-3 py-1.5">Cliente / Proveedor / Detalle</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border/40">
                                      {p.movimientos.map((m) => (
                                        <tr key={m.id} className="hover:bg-secondary/20">
                                          <td className="px-3 py-1.5 whitespace-nowrap font-mono text-muted-foreground">
                                            {m.fecha_formateada}
                                          </td>
                                          <td className="px-3 py-1.5 whitespace-nowrap">
                                            {renderMovementBadge(m.tipo)}
                                          </td>
                                          <td className="px-3 py-1.5 whitespace-nowrap font-mono font-bold text-primary">
                                            {m.numero_referencia}
                                          </td>
                                          <td className="px-3 py-1.5 text-right font-mono font-bold text-success whitespace-nowrap">
                                            {m.cantidad_entrada > 0 ? `+${m.cantidad_entrada.toFixed(2)}` : '—'}
                                          </td>
                                          <td className="px-3 py-1.5 text-right font-mono font-bold text-danger whitespace-nowrap">
                                            {m.cantidad_salida > 0 ? `-${m.cantidad_salida.toFixed(2)}` : '—'}
                                          </td>
                                          <td className="px-3 py-1.5 text-right font-mono text-muted-foreground whitespace-nowrap">
                                            {m.stock_anterior.toFixed(2)}
                                          </td>
                                          <td className="px-3 py-1.5 text-right font-mono font-extrabold text-foreground whitespace-nowrap">
                                            {m.stock_resultante.toFixed(2)}
                                          </td>
                                          <td className="px-3 py-1.5 text-foreground truncate max-w-xs">
                                            {m.cliente_proveedor_info}
                                            {m.notas && m.notas !== m.cliente_proveedor_info && (
                                              <span className="ml-1 text-muted-foreground italic">
                                                ({m.notas})
                                              </span>
                                            )}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
>>>>>>> 57bbebe1c1b40ce6b28d91de9bc1ae3c21035762
              )}
            </tbody>
          </table>
        </div>

<<<<<<< HEAD
        <ReportPagination
          totalItems={filteredGeneralItems.length}
          currentPage={currentPage}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setCurrentPage(1);
          }}
          itemLabel="productos"
        />
=======
        {/* Paginación Tabla General */}
        {filteredGeneralItems.length > 0 && (
          <div className="flex items-center justify-between p-3 border-t border-border bg-secondary/10 text-xs">
            <span className="text-muted-foreground">
              Mostrando{' '}
              {pageSize === -1
                ? `todos los ${filteredGeneralItems.length}`
                : `${Math.min((currentPage - 1) * pageSize + 1, filteredGeneralItems.length)} a ${Math.min(
                    currentPage * pageSize,
                    filteredGeneralItems.length
                  )} de ${filteredGeneralItems.length}`}{' '}
              productos
            </span>
            {pageSize !== -1 && (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="btn-secondary py-1 px-2 text-xs disabled:opacity-40"
                >
                  <ChevronLeft size={14} /> Anterior
                </button>
                <span className="px-2 font-bold text-foreground font-mono">
                  {currentPage} / {totalPagesGeneral}
                </span>
                <button
                  type="button"
                  disabled={currentPage >= totalPagesGeneral}
                  onClick={() => setCurrentPage((p) => Math.min(totalPagesGeneral, p + 1))}
                  className="btn-secondary py-1 px-2 text-xs disabled:opacity-40"
                >
                  Siguiente <ChevronRight size={14} />
                </button>
              </div>
            )}
          </div>
        )}
>>>>>>> 57bbebe1c1b40ce6b28d91de9bc1ae3c21035762
      </div>
    </div>
  );
}
