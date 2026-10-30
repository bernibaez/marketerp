import React, { useEffect, useMemo, useState } from 'react';
import {
  Package,
  TrendingUp,
  DollarSign,
  ArrowLeft,
  Search,
  Download,
  FileSpreadsheet,
  FileText,
  Printer,
  Sliders,
  ShoppingCart,
  ShoppingBag,
  RotateCcw,
  History,
  X,
  Filter,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Layers,
  ArrowDownRight,
  ArrowUpRight,
} from 'lucide-react';
import { formatRD, ReportLoading, ReportError, type ReportPeriodProps } from './shared';
import {
  obtenerInformeStockGeneral,
  obtenerHistorialMovimientosProducto,
  exportarStockGeneralAExcel,
  exportarKardexAExcel,
  exportarACSV,
  type ResumenStockGeneral,
  type StockGeneralItem,
  type HistorialMovimientosProductoResult,
  type MovimientoStockItem,
} from '@/services/informes/informesStockMovimientos.service';
import { toast } from '@/lib/toast';

export default function StockDetailReport({ dateFrom: _dateFrom, dateTo: _dateTo }: ReportPeriodProps) {
  // Estado de vista: null = Vista General de Stock (Imagen 1), string = ID del producto seleccionado para Kardex (Imagen 2)
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);

  // Datos Vista General
  const [generalData, setGeneralData] = useState<ResumenStockGeneral | null>(null);
  const [loadingGeneral, setLoadingGeneral] = useState(true);
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);

  // Filtros Vista General
  const [searchGeneral, setSearchGeneral] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'ok' | 'low' | 'out'>('all');
  const [pageSize, setPageSize] = useState<number>(25);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Datos Vista Detallada (Kardex del producto)
  const [kardexData, setKardexData] = useState<HistorialMovimientosProductoResult | null>(null);
  const [loadingKardex, setLoadingKardex] = useState(false);
  const [errorKardex, setErrorKardex] = useState<string | null>(null);

  // Filtros Vista Kardex
  const [kardexSearch, setKardexSearch] = useState('');
  const [kardexTypeFilter, setKardexTypeFilter] = useState<string>('all');
  const [kardexDateFrom, setKardexDateFrom] = useState('');
  const [kardexDateTo, setKardexDateTo] = useState('');
  const [kardexPageSize, setKardexPageSize] = useState<number>(25);
  const [kardexCurrentPage, setKardexCurrentPage] = useState<number>(1);

  // Búsqueda rápida de producto en el selector de Kardex
  const [productQuickSearch, setProductQuickSearch] = useState('');
  const [isQuickSearchOpen, setIsQuickSearchOpen] = useState(false);

  // 1. Cargar Vista General
  const loadGeneralStock = async () => {
    setLoadingGeneral(true);
    setErrorGeneral(null);
    try {
      const data = await obtenerInformeStockGeneral();
      setGeneralData(data);
    } catch (err) {
      setErrorGeneral(err instanceof Error ? err.message : 'Error al cargar informe de stock');
    } finally {
      setLoadingGeneral(false);
    }
  };

  useEffect(() => {
    loadGeneralStock();
  }, []);

  // 2. Cargar Kardex cuando se selecciona un producto
  const loadKardexForProduct = async (id: string) => {
    setLoadingKardex(true);
    setErrorKardex(null);
    try {
      const data = await obtenerHistorialMovimientosProducto(id);
      setKardexData(data);
    } catch (err) {
      setErrorKardex(err instanceof Error ? err.message : 'Error al cargar historial de movimientos');
    } finally {
      setLoadingKardex(false);
    }
  };

  useEffect(() => {
    if (selectedProductId) {
      loadKardexForProduct(selectedProductId);
      setKardexSearch('');
      setKardexTypeFilter('all');
      setKardexCurrentPage(1);
    } else {
      setKardexData(null);
    }
  }, [selectedProductId]);

  // Lista de categorías únicas
  const categories = useMemo(() => {
    if (!generalData) return [];
    const set = new Set(generalData.items.map((i) => i.categoria).filter(Boolean));
    return Array.from(set).sort();
  }, [generalData]);

  // Filtrado de la tabla general
  const filteredGeneralItems = useMemo(() => {
    if (!generalData) return [];
    let list = generalData.items;

    // Filtro por búsqueda
    if (searchGeneral.trim()) {
      const q = searchGeneral.toLowerCase().trim();
      list = list.filter(
        (i) =>
          i.nombre.toLowerCase().includes(q) ||
          i.sku.toLowerCase().includes(q) ||
          i.codigo_barras.toLowerCase().includes(q) ||
          i.categoria.toLowerCase().includes(q)
      );
    }

    // Filtro por categoría
    if (categoryFilter !== 'all') {
      list = list.filter((i) => i.categoria === categoryFilter);
    }

    // Filtro por estado
    if (statusFilter === 'ok') list = list.filter((i) => i.estado === 'OK');
    else if (statusFilter === 'low') list = list.filter((i) => i.estado === 'Bajo');
    else if (statusFilter === 'out') list = list.filter((i) => i.estado === 'Agotado');

    return list;
  }, [generalData, searchGeneral, categoryFilter, statusFilter]);

  // Paginación tabla general
  const paginatedGeneralItems = useMemo(() => {
    if (pageSize === -1) return filteredGeneralItems;
    const start = (currentPage - 1) * pageSize;
    return filteredGeneralItems.slice(start, start + pageSize);
  }, [filteredGeneralItems, currentPage, pageSize]);

  const totalPagesGeneral = pageSize === -1 ? 1 : Math.ceil(filteredGeneralItems.length / pageSize) || 1;

  // Filtrado del Kardex del producto
  const filteredKardexMovements = useMemo(() => {
    if (!kardexData) return [];
    let list = kardexData.movimientos;

    // Filtro por texto
    if (kardexSearch.trim()) {
      const q = kardexSearch.toLowerCase().trim();
      list = list.filter(
        (m) =>
          m.numero_referencia.toLowerCase().includes(q) ||
          m.cliente_proveedor_info.toLowerCase().includes(q) ||
          m.tipo.toLowerCase().includes(q)
      );
    }

    // Filtro por tipo
    if (kardexTypeFilter !== 'all') {
      list = list.filter((m) => m.tipo === kardexTypeFilter);
    }

    // Filtro por fecha desde
    if (kardexDateFrom) {
      list = list.filter((m) => m.fecha.slice(0, 10) >= kardexDateFrom);
    }

    // Filtro por fecha hasta
    if (kardexDateTo) {
      list = list.filter((m) => m.fecha.slice(0, 10) <= kardexDateTo);
    }

    return list;
  }, [kardexData, kardexSearch, kardexTypeFilter, kardexDateFrom, kardexDateTo]);

  // Paginación Kardex
  const paginatedKardexMovements = useMemo(() => {
    if (kardexPageSize === -1) return filteredKardexMovements;
    const start = (kardexCurrentPage - 1) * kardexPageSize;
    return filteredKardexMovements.slice(start, start + kardexPageSize);
  }, [filteredKardexMovements, kardexCurrentPage, kardexPageSize]);

  const totalPagesKardex = kardexPageSize === -1 ? 1 : Math.ceil(filteredKardexMovements.length / kardexPageSize) || 1;

  // Productos para el selector rápido de Kardex
  const quickSearchProducts = useMemo(() => {
    if (!generalData) return [];
    const q = productQuickSearch.trim().toLowerCase();
    if (!q) return generalData.items.slice(0, 20);
    return generalData.items
      .filter((p) => p.nombre.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q))
      .slice(0, 30);
  }, [generalData, productQuickSearch]);

  // Exportaciones Vista General
  const handleExportGeneralExcel = async () => {
    if (!filteredGeneralItems.length) {
      toast.warning('No hay datos para exportar');
      return;
    }
    try {
      await exportarStockGeneralAExcel(filteredGeneralItems, `informe-stock-${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast.success('Archivo Excel generado correctamente');
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
      'Ubicación',
      'Precio Venta (RD$)',
      'Precio Compra (RD$)',
      'Stock Actual',
      'Unidad',
      'Valor Compra (RD$)',
      'Valor Venta (RD$)',
      'Estado',
    ];
    const rows = filteredGeneralItems.map((p) => [
      p.sku,
      p.nombre,
      p.categoria,
      p.ubicacion,
      p.precio_venta,
      p.precio_costo,
      p.stock_actual,
      p.unidad,
      p.valor_compra,
      p.valor_venta,
      p.estado,
    ]);
    exportarACSV(`informe-stock-${new Date().toISOString().slice(0, 10)}`, headers, rows);
    toast.success('Archivo CSV descargado correctamente');
  };

  // Exportaciones Vista Kardex
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
      'Cambio de Cantidad',
      'Nueva Cantidad (Saldo)',
      'Fecha',
      'Número de Referencia / NCF',
      'Cliente / Proveedor / Responsable',
      'Notas',
    ];
    const rows = filteredKardexMovements.map((m) => [
      m.tipo,
      m.cambio_cantidad,
      m.nueva_cantidad,
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

  // Si está cargando la vista general
  if (loadingGeneral && !generalData) return <ReportLoading />;
  if (errorGeneral && !generalData) return <ReportError error={errorGeneral} />;

  // =========================================================================
  // VISTA 2: HISTORIAL DE EXISTENCIAS DE UN PRODUCTO (KARDEX - IMAGEN 2)
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
      <div className="space-y-5 animate-fadeIn">
        {/* Barra superior de navegación y selector rápido */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-secondary/15 p-3 rounded-xl border border-border">
          <button
            type="button"
            onClick={() => setSelectedProductId(null)}
            className="btn-secondary flex items-center gap-2 text-xs font-semibold self-start"
          >
            <ArrowLeft size={15} /> Volver a Informe de Stock
          </button>

          {/* Selector de Producto tipo Combobox con autocompletado */}
          <div className="relative sm:w-96">
            <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
              Producto en pantalla:
            </label>
            <div className="relative">
              <input
                type="text"
                className="input-field text-xs pl-8 pr-7 w-full font-medium"
                placeholder="Escribe para cambiar de producto..."
                value={isQuickSearchOpen ? productQuickSearch : `${prod?.nombre} (${prod?.sku})`}
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
                >
                  <X size={13} />
                </button>
              )}
            </div>

            {isQuickSearchOpen && (
              <div className="absolute z-30 left-0 right-0 mt-1 max-h-56 overflow-y-auto bg-card border border-border rounded-xl shadow-2xl divide-y divide-border/50 animate-fadeIn">
                {quickSearchProducts.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setSelectedProductId(p.id);
                      setIsQuickSearchOpen(false);
                      setProductQuickSearch('');
                    }}
                    className="w-full text-left p-2 hover:bg-secondary/40 transition-colors text-xs flex items-center justify-between group"
                  >
                    <div className="min-w-0 pr-2">
                      <div className="font-semibold text-foreground group-hover:text-primary truncate">
                        {p.nombre}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        SKU: {p.sku} • Stock: {p.stock_actual} {p.unidad}
                      </div>
                    </div>
                    <span className="text-[11px] text-primary font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                      Ver →
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Card de Encabezado y Resumen del Producto (Diseño idéntico a Imagen 2) */}
        <div className="card p-5 space-y-4 border border-border/80 shadow-sm">
          <div>
            <h2 className="text-xl font-bold text-foreground uppercase tracking-tight flex items-center gap-2">
              <Package size={22} className="text-primary" />
              {prod?.nombre} ({prod?.sku})
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Ubicación: <strong className="text-foreground">{prod?.ubicacion}</strong> • Unidad: <strong className="text-foreground">{prod?.unidad}</strong>
              {prod?.producto_base_id && (
                <span className="ml-2 inline-flex items-center gap-1 bg-info/10 text-info px-2 py-0.5 rounded text-[11px] font-semibold">
                  <Layers size={11} /> Presentación vinculada ({prod.factor_conversion}x)
                </span>
              )}
            </p>
          </div>

          {/* Grid de 3 Columnas: Cantidades en, Cantidades fuera y Totales */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-3 border-t border-border">
            {/* Columna 1: Cantidades en (Entradas) */}
            <div className="space-y-2 bg-success/5 p-3.5 rounded-xl border border-success/20">
              <div className="flex items-center gap-1.5 text-xs font-bold text-success uppercase tracking-wider">
                <ArrowDownRight size={15} /> Cantidades en (Entradas)
              </div>
              <div className="text-xs space-y-1.5 pt-1">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Compra total:</span>
                  <span className="font-bold text-foreground font-mono">
                    {res?.cantidades_en.compra_total.toFixed(2)} {prod?.unidad}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Stock de apertura:</span>
                  <span className="font-bold text-foreground font-mono">
                    {res?.cantidades_en.stock_apertura.toFixed(2)} {prod?.unidad}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Total de devolución de venta:</span>
                  <span className="font-bold text-foreground font-mono">
                    {res?.cantidades_en.total_devolucion_venta.toFixed(2)} {prod?.unidad}
                  </span>
                </div>
                <div className="flex justify-between items-center text-muted-foreground/80">
                  <span>Transferencias de stock (En):</span>
                  <span className="font-mono">0.00 {prod?.unidad}</span>
                </div>
              </div>
            </div>

            {/* Columna 2: Cantidades fuera (Salidas) */}
            <div className="space-y-2 bg-danger/5 p-3.5 rounded-xl border border-danger/20">
              <div className="flex items-center gap-1.5 text-xs font-bold text-danger uppercase tracking-wider">
                <ArrowUpRight size={15} /> Cantidades fuera (Salidas)
              </div>
              <div className="text-xs space-y-1.5 pt-1">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Total vendido:</span>
                  <span className="font-bold text-danger font-mono">
                    {res?.cantidades_fuera.total_vendido.toFixed(2)} {prod?.unidad}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Ajuste total de stock:</span>
                  <span className="font-bold text-foreground font-mono">
                    {res?.cantidades_fuera.ajuste_total.toFixed(2)} {prod?.unidad}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Total de devolución de compra:</span>
                  <span className="font-bold text-foreground font-mono">
                    {res?.cantidades_fuera.total_devolucion_compra.toFixed(2)} {prod?.unidad}
                  </span>
                </div>
                <div className="flex justify-between items-center text-muted-foreground/80">
                  <span>Transferencias de stock (Afuera):</span>
                  <span className="font-mono">0.00 {prod?.unidad}</span>
                </div>
              </div>
            </div>

            {/* Columna 3: Totales */}
            <div className="space-y-2 bg-primary/5 p-3.5 rounded-xl border border-primary/25 flex flex-col justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold text-primary uppercase tracking-wider">
                <Package size={15} /> Totales
              </div>
              <div className="my-auto py-2">
                <div className="text-xs text-muted-foreground font-medium">Stock actual disponible:</div>
                <div className="text-3xl font-extrabold text-primary font-mono mt-1">
                  {res?.totales.stock_actual.toFixed(2)}{' '}
                  <span className="text-sm font-semibold text-muted-foreground">{prod?.unidad}</span>
                </div>
                <div className="text-[11px] text-muted-foreground mt-1">
                  Valorización: <strong className="text-foreground">{formatRD(prod?.valor_venta || 0)}</strong> a precio de venta
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Toolbar de Filtros y Exportación de Kardex */}
        <div className="card p-4 space-y-3">
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 flex-wrap">
            {/* Controles de entradas y búsqueda */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span>Mostrar</span>
                <select
                  value={kardexPageSize}
                  onChange={(e) => {
                    setKardexPageSize(Number(e.target.value));
                    setKardexCurrentPage(1);
                  }}
                  className="input-field py-1 px-2 text-xs w-20"
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={-1}>Todos</option>
                </select>
                <span>entradas</span>
              </div>

              {/* Botones de Exportación */}
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

            {/* Filtros de Tipo y Búsqueda */}
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
                <option value="Ajuste de Stock">Ajustes de Stock</option>
                <option value="Devolución de Venta">Devoluciones Venta</option>
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

        {/* Tabla de Movimientos de Kardex (Imagen 2) */}
        <div className="card overflow-hidden border border-border shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-secondary/50 text-left text-muted-foreground font-semibold">
                  <th className="px-4 py-3">Tipo</th>
                  <th className="px-4 py-3 text-right">Cambio de cantidad</th>
                  <th className="px-4 py-3 text-right">Nueva cantidad (Saldo)</th>
                  <th className="px-4 py-3">Fecha y Hora</th>
                  <th className="px-4 py-3">Número de referencia o NCF</th>
                  <th className="px-4 py-3">Customer / Supplier information</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {paginatedKardexMovements.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                      <History size={32} className="mx-auto mb-2 opacity-30" />
                      <p className="font-semibold text-foreground">No hay movimientos registrados</p>
                      <p className="text-[11px] mt-0.5">
                        Las ventas, compras y ajustes de este producto se reflejarán automáticamente en este Kardex.
                      </p>
                    </td>
                  </tr>
                ) : (
                  paginatedKardexMovements.map((m) => {
                    const isNegative = m.cambio_cantidad < 0;
                    return (
                      <tr key={m.id} className="hover:bg-secondary/25 transition-colors">
                        {/* Tipo de Movimiento */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          {m.tipo === 'Ventas' && (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold bg-info/10 text-info">
                              <ShoppingCart size={12} /> Ventas
                            </span>
                          )}
                          {m.tipo === 'Compras' && (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold bg-success/10 text-success">
                              <ShoppingBag size={12} /> Compras
                            </span>
                          )}
                          {m.tipo === 'Ajuste de Stock' && (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold bg-warning/10 text-warning">
                              <Sliders size={12} /> Ajuste de Stock
                            </span>
                          )}
                          {m.tipo === 'Devolución de Venta' && (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold bg-purple-500/10 text-purple-600 dark:text-purple-400">
                              <RotateCcw size={12} /> Devolución Venta
                            </span>
                          )}
                          {m.tipo === 'Devolución de Compra' && (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold bg-danger/10 text-danger">
                              <RotateCcw size={12} /> Devolución Compra
                            </span>
                          )}
                        </td>

                        {/* Cambio de Cantidad */}
                        <td
                          className={`px-4 py-3 text-right font-mono font-bold whitespace-nowrap ${
                            isNegative ? 'text-danger' : 'text-success'
                          }`}
                        >
                          {isNegative ? '' : '+'}
                          {m.cambio_cantidad.toFixed(2)}
                        </td>

                        {/* Nueva Cantidad (Saldo acumulado) */}
                        <td className="px-4 py-3 text-right font-mono font-bold text-foreground whitespace-nowrap">
                          {m.nueva_cantidad.toFixed(2)}
                        </td>

                        {/* Fecha */}
                        <td className="px-4 py-3 whitespace-nowrap text-muted-foreground font-mono">
                          {m.fecha_formateada}
                        </td>

                        {/* Número de Referencia o NCF */}
                        <td className="px-4 py-3 whitespace-nowrap font-mono font-bold text-primary">
                          {m.numero_referencia}
                        </td>

                        {/* Cliente / Proveedor / Info */}
                        <td className="px-4 py-3 text-foreground font-medium max-w-xs truncate">
                          {m.cliente_proveedor_info}
                          {m.notas && (
                            <span className="block text-[11px] text-muted-foreground italic truncate">
                              {m.notas}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Paginación Kardex */}
          {filteredKardexMovements.length > 0 && (
            <div className="flex items-center justify-between p-3 border-t border-border bg-secondary/10 text-xs">
              <span className="text-muted-foreground">
                Mostrando {Math.min((kardexCurrentPage - 1) * kardexPageSize + 1, filteredKardexMovements.length)} a{' '}
                {kardexPageSize === -1
                  ? filteredKardexMovements.length
                  : Math.min(kardexCurrentPage * kardexPageSize, filteredKardexMovements.length)}{' '}
                de {filteredKardexMovements.length} movimientos
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
  // VISTA 1: INFORME DE STOCK GENERAL (IMAGEN 1)
  // =========================================================================
  const general = generalData;

  return (
    <div className="space-y-5 animate-fadeIn">
      {/* 4 Cards Superiores (Exactos a Imagen 1) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Stock de cierre (Por precio de compra) */}
        <div className="card p-4 space-y-1 border border-border shadow-sm">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-tight">
            Stock de cierre (Por precio de compra)
          </p>
          <p className="text-2xl font-extrabold text-foreground font-mono mt-1">
            {formatRD(general?.stock_cierre_compra || 0)}
          </p>
          <p className="text-[11px] text-muted-foreground">Valor total del inventario a costo</p>
        </div>

        {/* Card 2: Stock de cierre (Por precio de venta) */}
        <div className="card p-4 space-y-1 border border-border shadow-sm">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-tight">
            Stock de cierre (Por precio de venta)
          </p>
          <p className="text-2xl font-extrabold text-primary font-mono mt-1">
            {formatRD(general?.stock_cierre_venta || 0)}
          </p>
          <p className="text-[11px] text-muted-foreground">Valor total estimado de venta</p>
        </div>

        {/* Card 3: Beneficio potencial */}
        <div className="card p-4 space-y-1 border border-border shadow-sm">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-tight">
            Beneficio potencial
          </p>
          <p className="text-2xl font-extrabold text-success font-mono mt-1">
            {formatRD(general?.beneficio_potencial || 0)}
          </p>
          <p className="text-[11px] text-muted-foreground">Ganancia proyectada en inventario</p>
        </div>

        {/* Card 4: Profit Margin % */}
        <div className="card p-4 space-y-1 border border-border shadow-sm">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-tight">
            Profit Margin %
          </p>
          <p className="text-2xl font-extrabold text-warning font-mono mt-1">
            {general?.profit_margin_pct?.toFixed(2) || '0.00'}%
          </p>
          <p className="text-[11px] text-muted-foreground">Margen de rentabilidad global</p>
        </div>
      </div>

      {/* Toolbar y Acciones (Imagen 1) */}
      <div className="card p-4 space-y-3">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 flex-wrap">
          {/* Selector de entradas y botones de exportación */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span>Espectáculo</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="input-field py-1 px-2 text-xs w-20"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={-1}>Todas</option>
              </select>
              <span>entradas</span>
            </div>

            <div className="flex items-center gap-1.5 pl-2 border-l border-border flex-wrap">
              <button
                type="button"
                onClick={handleExportGeneralCsv}
                className="btn-secondary text-xs flex items-center gap-1 py-1 px-2.5"
                title="Exportar tabla a formato CSV"
              >
                <FileText size={13} /> Exportar a CSV
              </button>
              <button
                type="button"
                onClick={handleExportGeneralExcel}
                className="btn-secondary text-xs flex items-center gap-1 py-1 px-2.5"
                title="Exportar tabla a formato Excel"
              >
                <FileSpreadsheet size={13} /> Exportar a Excel
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="btn-secondary text-xs flex items-center gap-1 py-1 px-2.5"
                title="Imprimir informe actual"
              >
                <Printer size={13} /> Impresión
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
                className="input-field py-1 px-2.5 text-xs w-36"
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
              className="input-field py-1 px-2.5 text-xs w-32"
            >
              <option value="all">Todos los stocks</option>
              <option value="ok">Con Stock (OK)</option>
              <option value="low">Stock Bajo</option>
              <option value="out">Agotados</option>
            </select>

            <div className="relative w-64">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Buscar por SKU, producto..."
                value={searchGeneral}
                onChange={(e) => {
                  setSearchGeneral(e.target.value);
                  setCurrentPage(1);
                }}
                className="input-field pl-8 pr-7 py-1 text-xs w-full"
              />
              {searchGeneral && (
                <button
                  type="button"
                  onClick={() => setSearchGeneral('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabla Principal de Stock (Imagen 1) */}
      <div className="card overflow-hidden border border-border shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-secondary/50 text-left text-muted-foreground font-semibold">
                <th className="px-4 py-3 text-center">Acción</th>
                <th className="px-4 py-3">SKU</th>
                <th className="px-4 py-3">Producto</th>
                <th className="px-4 py-3">Variación</th>
                <th className="px-4 py-3">Categoría</th>
                <th className="px-4 py-3">Ubicación</th>
                <th className="px-4 py-3 text-right">Precio venta unitario</th>
                <th className="px-4 py-3 text-right">Stock actual</th>
                <th className="px-4 py-3 text-right">Valor actual (Por compra)</th>
                <th className="px-4 py-3 text-right">Valor actual (Por venta)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {paginatedGeneralItems.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-muted-foreground">
                    <Package size={32} className="mx-auto mb-2 opacity-30" />
                    <p className="font-semibold text-foreground">No se encontraron productos</p>
                    <p className="text-[11px] mt-0.5">Intenta cambiar los filtros de búsqueda.</p>
                  </td>
                </tr>
              ) : (
                paginatedGeneralItems.map((p) => {
                  return (
                    <tr key={p.id} className="hover:bg-secondary/25 transition-colors">
                      {/* Botón Acción: Historial de existencias de productos (exacto a Imagen 1) */}
                      <td className="px-3 py-2.5 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setSelectedProductId(p.id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-primary/30 bg-primary/5 hover:bg-primary hover:text-white text-primary text-[11px] font-bold transition-all shadow-sm"
                          title={`Ver historial de existencias y movimientos para ${p.nombre}`}
                        >
                          <History size={13} />
                          <span>Historial de existencias</span>
                        </button>
                      </td>

                      {/* SKU */}
                      <td className="px-4 py-3 font-mono font-bold text-primary whitespace-nowrap">
                        {p.sku}
                      </td>

                      {/* Producto */}
                      <td className="px-4 py-3 font-bold text-foreground">
                        <div className="max-w-xs truncate">{p.nombre}</div>
                        {p.codigo_barras && p.codigo_barras !== p.sku && (
                          <span className="text-[10px] text-muted-foreground font-mono">
                            CB: {p.codigo_barras}
                          </span>
                        )}
                      </td>

                      {/* Variación */}
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                        {p.producto_base_id ? (
                          <span className="inline-flex items-center gap-1 text-[11px] text-info bg-info/10 px-2 py-0.5 rounded font-medium">
                            <Layers size={11} /> {p.unidad} ({p.factor_conversion}x)
                          </span>
                        ) : p.es_pesado ? (
                          <span className="inline-flex items-center gap-1 text-[11px] text-warning bg-warning/10 px-2 py-0.5 rounded font-medium">
                            Pesado ({p.unidad})
                          </span>
                        ) : (
                          <span className="text-[11px] text-muted-foreground">Estándar ({p.unidad})</span>
                        )}
                      </td>

                      {/* Categoría */}
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                        {p.categoria}
                      </td>

                      {/* Ubicación */}
                      <td className="px-4 py-3 text-muted-foreground font-medium text-[11px] whitespace-nowrap uppercase">
                        {p.ubicacion}
                      </td>

                      {/* Precio de venta unitario */}
                      <td className="px-4 py-3 text-right font-mono font-bold text-foreground whitespace-nowrap">
                        {formatRD(p.precio_venta)}
                      </td>

                      {/* Stock actual con unidad y badge */}
                      <td className="px-4 py-3 text-right whitespace-nowrap font-mono font-bold">
                        <span
                          className={
                            p.estado === 'Agotado'
                              ? 'text-danger'
                              : p.estado === 'Bajo'
                              ? 'text-warning font-semibold'
                              : 'text-foreground'
                          }
                        >
                          {p.stock_actual.toLocaleString('es-DO', { minimumFractionDigits: p.es_pesado ? 2 : 0 })}{' '}
                          <span className="text-[10px] uppercase font-semibold text-muted-foreground">
                            {p.unidad}
                          </span>
                        </span>
                      </td>

                      {/* Valor actual de las acciones (Por precio de compra) */}
                      <td className="px-4 py-3 text-right font-mono text-muted-foreground whitespace-nowrap">
                        {formatRD(p.valor_compra)}
                      </td>

                      {/* Valor actual de las acciones (Por precio de venta) */}
                      <td className="px-4 py-3 text-right font-mono font-bold text-primary whitespace-nowrap">
                        {formatRD(p.valor_venta)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Paginación Tabla General */}
        {filteredGeneralItems.length > 0 && (
          <div className="flex items-center justify-between p-3 border-t border-border bg-secondary/10 text-xs">
            <span className="text-muted-foreground">
              Mostrando {Math.min((currentPage - 1) * pageSize + 1, filteredGeneralItems.length)} a{' '}
              {pageSize === -1
                ? filteredGeneralItems.length
                : Math.min(currentPage * pageSize, filteredGeneralItems.length)}{' '}
              de {filteredGeneralItems.length} entradas
            </span>
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
          </div>
        )}
      </div>
    </div>
  );
}
