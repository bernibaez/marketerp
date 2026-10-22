import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import AppLayout from '@/components/AppLayout';
import { ShoppingBag, RotateCcw, Plus, Search, Filter, Download, Eye, Edit2, Trash2, X, PackagePlus, Check, CheckCircle2, ShoppingCart, Minus, Package, Loader2 } from 'lucide-react';
import { exportTableToPdf, formatMoneyPdf } from '@/lib/exportPdf';
import type { ProductItem } from '@/lib/productStore';
import { useProveedores } from '@/hooks/useProveedores';
import { crearProducto, uiAProductoInsert, obtenerProductos, productoAUi } from '@/services/productos.service';
import { isAbortError } from '@/lib/isAbortError';
import { crearCompra, obtenerCompras, obtenerDetalleCompra, anularCompra, type CompraDetalle } from '@/services/compras.service';
import { toast } from '@/lib/toast';
import ModalShell from '@/components/ui/ModalShell';

interface Purchase {
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

interface ReturnItem {
  id: number;
  code: string;
  purchaseCode: string;
  supplier: string;
  date: string;
  total: number;
  reason: string;
  status: 'approved' | 'pending';
}

export interface PurchaseLineItem {
  id: string;
  productId: string;
  name: string;
  sku: string;
  qty: number;
  price: number; // Cost Price
  salePrice: number; // Sale Price
  taxPercent: number;
}

type Tab = 'list' | 'returns';

const statusMap: Record<string, { label: string; cls: string }> = {
  received: { label: 'Recibido', cls: 'badge-success' },
  pending: { label: 'Pendiente', cls: 'badge-warning' },
  partial: { label: 'Parcial', cls: 'badge-info' },
  approved: { label: 'Aprobado', cls: 'badge-success' },
  anulada: { label: 'Anulada', cls: 'badge-danger' },
};

function mapEstadoUi(estado: string): Purchase['status'] {
  if (estado === 'recibida') return 'received';
  if (estado === 'parcial') return 'partial';
  if (estado === 'anulada') return 'anulada';
  return 'pending';
}

function nextPurchaseInvoice() {
  const seq = String(Date.now()).slice(-3);
  return `FAC-COMP-${seq}`;
}

export default function PurchasesPage() {
  const [tab, setTab] = useState<Tab>('list');
  const [purchasesList, setPurchasesList] = useState<Purchase[]>([]);
  const [returnsList] = useState<ReturnItem[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [invoiceNumber, setInvoiceNumber] = useState(() => nextPurchaseInvoice());
  const [supplierId, setSupplierId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Transferencia');
  const [purchaseDate, setPurchaseDate] = useState(() => new Date().toISOString().split('T')[0]);
  const { proveedores } = useProveedores();

  const [purchaseItems, setPurchaseItems] = useState<PurchaseLineItem[]>([]);

  const [showProductModal, setShowProductModal] = useState(false);
  const [modalTab, setModalTab] = useState<'catalog' | 'new'>('catalog');
  const [modalSearch, setModalSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [catalogProducts, setCatalogProducts] = useState<ProductItem[]>([]);
  const [catalogTotal, setCatalogTotal] = useState(0);
  const [catalogPage, setCatalogPage] = useState(1);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const abortControllerRef = React.useRef<AbortController | null>(null);

  const [selectedProduct, setSelectedProduct] = useState<ProductItem | null>(null);
  const [modalQty, setModalQty] = useState<number>(1);
  const [modalPrice, setModalPrice] = useState<number>(0);
  const [modalSalePrice, setModalSalePrice] = useState<number>(0);
  const [lastAddedNotice, setLastAddedNotice] = useState<string | null>(null);
  const [viewingPurchase, setViewingPurchase] = useState<CompraDetalle | null>(null);
  const [loadingPurchaseDetail, setLoadingPurchaseDetail] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [anulando, setAnulando] = useState(false);

  const [newName, setNewName] = useState('');
  const [newSku, setNewSku] = useState('');
  const [newBarcode, setNewBarcode] = useState('');
  const [newCategory, setNewCategory] = useState('General');
  const [newUnit, setNewUnit] = useState('Unidad');
  const [newTax, setNewTax] = useState(18);

  // Quick Inline Search for Products directly in Purchase Table
  const [inlineSearch, setInlineSearch] = useState('');
  const [inlineResults, setInlineResults] = useState<ProductItem[]>([]);
  const [inlineLoading, setInlineLoading] = useState(false);
  const [inlineOpen, setInlineOpen] = useState(false);
  const [inlineHighlightIndex, setInlineHighlightIndex] = useState(0);
  const inlineSearchRef = React.useRef<HTMLInputElement | null>(null);
  const inlineAbortRef = React.useRef<AbortController | null>(null);
  const inlineDropdownRef = React.useRef<HTMLDivElement | null>(null);

  // Debounce search input by 300ms to avoid unnecessary DB requests
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(modalSearch.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [modalSearch]);

  // Búsqueda inline rápida bajo demanda (200ms debounce)
  useEffect(() => {
    const q = inlineSearch.trim();
    if (!q) {
      setInlineResults([]);
      setInlineOpen(false);
      setInlineLoading(false);
      return;
    }

    if (inlineAbortRef.current) {
      inlineAbortRef.current.abort();
    }
    const controller = new AbortController();
    inlineAbortRef.current = controller;
    setInlineLoading(true);

    const timer = setTimeout(async () => {
      try {
        const res = await obtenerProductos({
          pagina: 1,
          limite: 50,
          busqueda: q,
          estado: 'todos',
          signal: controller.signal,
        });
        const items = (res.datos || []).map(productoAUi) as ProductItem[];
        setInlineResults(items);
        setInlineHighlightIndex(0);
        setInlineOpen(true);
      } catch (err) {
        if (!isAbortError(err)) {
          console.error('Error buscando productos inline:', err);
        }
      } finally {
        setInlineLoading(false);
      }
    }, 200);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [inlineSearch]);

  // Cerrar dropdown inline al hacer clic fuera
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (
        inlineDropdownRef.current &&
        !inlineDropdownRef.current.contains(e.target as Node) &&
        inlineSearchRef.current &&
        !inlineSearchRef.current.contains(e.target as Node)
      ) {
        setInlineOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Consulta bajo demanda a la base de datos (PostgreSQL/Supabase)
  const fetchCatalog = React.useCallback(async (query: string, page = 1, append = false) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    if (append) {
      setLoadingMore(true);
    } else {
      setCatalogLoading(true);
    }

    try {
      const res = await obtenerProductos({
        pagina: page,
        limite: query ? 50 : 20,
        busqueda: query,
        estado: 'todos',
        signal: controller.signal,
      });

      const uiItems = (res.datos || []).map(productoAUi) as ProductItem[];
      setCatalogTotal(res.total ?? 0);
      setCatalogPage(page);

      if (append) {
        setCatalogProducts((prev) => {
          const existingIds = new Set(prev.map((p) => p.id));
          const newItems = uiItems.filter((p) => !existingIds.has(p.id));
          return [...prev, ...newItems];
        });
      } else {
        setCatalogProducts(uiItems);
      }
    } catch (err) {
      if (!isAbortError(err)) {
        console.error('Error al consultar productos en BD:', err);
      }
    } finally {
      setCatalogLoading(false);
      setLoadingMore(false);
    }
  }, []);

  // Solo consulta la base de datos cuando el modal está abierto
  useEffect(() => {
    if (!showProductModal || modalTab !== 'catalog') return;
    void fetchCatalog(debouncedSearch, 1, false);
  }, [showProductModal, modalTab, debouncedSearch, fetchCatalog]);

  const categories = useMemo(() => {
    const defaultCategories = [
      'General',
      'Abarrotes',
      'Bebidas',
      'Lácteos',
      'Carnes y Embutidos',
      'Frutas y Verduras',
      'Panadería y Repostería',
      'Snacks y Dulces',
      'Limpieza y Hogar',
      'Cuidado Personal',
      'Congelados',
    ];
    const fromLoaded = catalogProducts.map((p) => p.category).filter(Boolean);
    return Array.from(new Set([...defaultCategories, ...fromLoaded])).sort();
  }, [catalogProducts]);

  const reloadPurchases = async () => {
    setLoadingList(true);
    try {
      const rows = await obtenerCompras();
      setPurchasesList(
        rows.map((r) => ({
          id: r.id,
          code: r.codigo,
          supplier: r.proveedor,
          date: r.fecha,
          items: r.items,
          subtotal: r.subtotal,
          tax: r.impuesto,
          total: r.total,
          status: mapEstadoUi(r.estado),
          payment: r.metodo_pago,
        }))
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al cargar compras');
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoadingList(true);
      try {
        const rows = await obtenerCompras();
        if (!alive) return;
        setPurchasesList(
          rows.map((r) => ({
            id: r.id,
            code: r.codigo,
            supplier: r.proveedor,
            date: r.fecha,
            items: r.items,
            subtotal: r.subtotal,
            tax: r.impuesto,
            total: r.total,
            status: mapEstadoUi(r.estado),
            payment: r.metodo_pago,
          }))
        );
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Error al cargar compras');
      } finally {
        if (alive) setLoadingList(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const handleViewPurchase = async (id: string) => {
    setLoadingPurchaseDetail(true);
    setViewingPurchase(null);
    try {
      const detail = await obtenerDetalleCompra(id);
      if (!detail) {
        toast.error('No se encontró el detalle de la compra');
        return;
      }
      setViewingPurchase(detail);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al cargar detalle');
    } finally {
      setLoadingPurchaseDetail(false);
    }
  };

  const handleConfirmAnular = async () => {
    if (!confirmDeleteId) return;
    setAnulando(true);
    try {
      await anularCompra(confirmDeleteId);
      toast.success('Compra anulada');
      setConfirmDeleteId(null);
      await reloadPurchases();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo anular la compra');
    } finally {
      setAnulando(false);
    }
  };

  const filteredPurchases = purchasesList.filter(p =>
    p.code.toLowerCase().includes(search.toLowerCase()) ||
    p.supplier.toLowerCase().includes(search.toLowerCase())
  );

  // Calculations for current Purchase Form
  const subtotal = purchaseItems.reduce((sum, item) => sum + item.qty * item.price, 0);
  const taxTotal = purchaseItems.reduce((sum, item) => {
    if (item.taxPercent > 0) {
      return sum + (item.qty * item.price * (item.taxPercent / 100));
    }
    return sum;
  }, 0);
  const grandTotal = subtotal + taxTotal;

  // Handlers for Line Items
  const handleUpdateLineQty = (id: string, qty: number) => {
    setPurchaseItems(prev => prev.map(item => item.id === id ? { ...item, qty: Math.max(1, qty) } : item));
  };

  const handleUpdateLinePrice = (id: string, price: number) => {
    setPurchaseItems(prev => prev.map(item => item.id === id ? { ...item, price: Math.max(0, price) } : item));
  };

  const handleUpdateLineSalePrice = (id: string, salePrice: number) => {
    setPurchaseItems(prev => prev.map(item => item.id === id ? { ...item, salePrice: Math.max(0, salePrice) } : item));
  };

  const handleRemoveLine = (id: string) => {
    setPurchaseItems(prev => prev.filter(item => item.id !== id));
    toast.info('Producto removido de la orden');
  };

  const resetModalForm = () => {
    setSelectedProduct(null);
    setModalQty(1);
    setModalPrice(0);
    setModalSalePrice(0);
    setModalSearch('');
    setDebouncedSearch('');
    setNewName('');
    setNewSku('');
    setNewBarcode('');
    setNewCategory('General');
    setNewUnit('Unidad');
    setNewTax(18);
  };

  useEffect(() => {
    if (!showProductModal) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowProductModal(false);
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [showProductModal]);

  const addProductDirectlyToPurchase = (
    product: ProductItem,
    qty = 1,
    customPrice?: number,
    customSalePrice?: number,
    customTax?: number
  ) => {
    const costPrice = customPrice !== undefined && customPrice > 0 ? customPrice : (product.costPrice || 0);
    const salePrice = customSalePrice !== undefined && customSalePrice > 0 ? customSalePrice : (product.salePrice || 0);
    const taxPercent = customTax !== undefined ? customTax : (product.tax ?? 18);

    setPurchaseItems((prev) => {
      const existingIdx = prev.findIndex((i) => i.productId === product.id || (product.sku && i.sku === product.sku));
      if (existingIdx >= 0) {
        const copy = [...prev];
        const newQty = copy[existingIdx].qty + qty;
        copy[existingIdx] = {
          ...copy[existingIdx],
          qty: newQty,
          price: costPrice > 0 ? costPrice : copy[existingIdx].price,
          salePrice: salePrice > 0 ? salePrice : copy[existingIdx].salePrice,
          taxPercent,
        };
        toast.success(`+${qty} "${product.name}" (Total en orden: ${newQty})`);
        return copy;
      }

      const newItem: PurchaseLineItem = {
        id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        productId: product.id,
        name: product.name,
        sku: product.sku,
        qty,
        price: costPrice,
        salePrice: salePrice,
        taxPercent,
      };
      toast.success(`"${product.name}" agregado a la compra`);
      return [...prev, newItem];
    });
  };

  const handleSelectInlineProduct = (p: ProductItem) => {
    addProductDirectlyToPurchase(p, 1);
    setInlineSearch('');
    setInlineResults([]);
    setInlineOpen(false);
    inlineSearchRef.current?.focus();
  };

  const handleInlineKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (inlineResults.length > 0) {
        setInlineOpen(true);
        setInlineHighlightIndex((prev) => (prev + 1) % inlineResults.length);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (inlineResults.length > 0) {
        setInlineOpen(true);
        setInlineHighlightIndex((prev) => (prev - 1 + inlineResults.length) % inlineResults.length);
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (inlineResults.length > 0) {
        const target = inlineResults[inlineHighlightIndex] || inlineResults[0];
        handleSelectInlineProduct(target);
      }
    } else if (e.key === 'Escape') {
      setInlineOpen(false);
    }
  };

  const handleAddProductToPurchase = async (shouldCloseModal = false) => {
    if (modalQty <= 0) {
      toast.error('Ingresa una cantidad válida mayor a 0');
      return;
    }

    let product: ProductItem | null = selectedProduct;
    let createdNew = false;

    if (modalTab === 'new') {
      if (!newName.trim()) {
        toast.error('Escribe el nombre del producto');
        return;
      }
      if (!newSku.trim()) {
        toast.error('Escribe un SKU para el producto');
        return;
      }
      if (modalPrice <= 0) {
        toast.error('Ingresa el precio de compra (costo)');
        return;
      }
      if (modalSalePrice <= 0) {
        toast.error('Ingresa el precio de venta');
        return;
      }
      const skuExists = catalogProducts.some(
        (p) => p.sku.toLowerCase() === newSku.trim().toLowerCase()
      );
      if (skuExists) {
        toast.error('Ya existe un producto con ese SKU en el listado cargado');
        return;
      }

      const supplierName = proveedores.find((p) => p.id === supplierId)?.nombre ?? '';
      try {
        const created = await crearProducto(
          uiAProductoInsert({
            name: newName.trim(),
            sku: newSku.trim().toUpperCase(),
            barcode: newBarcode.trim() || `GEN-${Date.now().toString().slice(-8)}`,
            category: newCategory.trim() || 'General',
            brand: '',
            unit: newUnit.trim() || 'Unidad',
            supplier: supplierName,
            costPrice: modalPrice,
            salePrice: modalSalePrice,
            wholesalePrice: modalSalePrice,
            tax: newTax,
            minStock: 10,
            currentStock: 0,
            image: '',
            expiryDate: null,
            warranty: 'N/A',
            status: 'active',
          })
        );
        const createdUi = productoAUi(created) as ProductItem;
        product = createdUi;
        createdNew = true;
        setCatalogProducts((prev) => [createdUi, ...prev]);
        setCatalogTotal((t) => t + 1);
        setSelectedProduct(createdUi);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'No se pudo crear el producto');
        return;
      }
    }

    if (!product) {
      toast.error('Selecciona un producto del catálogo o crea uno nuevo');
      return;
    }

    const itemCostPrice = modalPrice > 0 ? modalPrice : product.costPrice || 0;
    const itemSalePrice = modalSalePrice > 0 ? modalSalePrice : product.salePrice || 0;

    if (itemCostPrice <= 0) {
      toast.error('Ingresa el precio de compra (costo)');
      return;
    }
    if (itemSalePrice <= 0) {
      toast.error('Ingresa el precio de venta');
      return;
    }

    const newItem: PurchaseLineItem = {
      id: `item-${Date.now()}`,
      productId: product.id,
      name: product.name,
      sku: product.sku,
      qty: modalQty,
      price: itemCostPrice,
      salePrice: itemSalePrice,
      taxPercent: product.tax ?? newTax,
    };

    setPurchaseItems((prev) => [...prev, newItem]);

    const noticeText = `${createdNew ? 'Creado y añadido' : 'Añadido'}: ${product.name} (${modalQty} und) — Compra: RD$ ${itemCostPrice.toLocaleString('es-DO')} | Venta: RD$ ${itemSalePrice.toLocaleString('es-DO')}`;
    setLastAddedNotice(noticeText);
    toast.success(
      createdNew
        ? `Producto nuevo "${product.name}" creado y añadido a la compra`
        : `Añadido: ${product.name} (${modalQty} und)`
    );

    resetModalForm();
    if (createdNew) setModalTab('catalog');

    if (shouldCloseModal) {
      setShowProductModal(false);
    }
  };

  const handleSavePurchase = async () => {
    if (purchaseItems.length === 0) {
      toast.error('Agrega al menos un producto a la compra');
      return;
    }
    if (!supplierId) {
      toast.error('Selecciona un proveedor');
      return;
    }

    setSaving(true);
    try {
      const created = await crearCompra({
        codigo: invoiceNumber,
        proveedor_id: supplierId,
        metodo_pago: paymentMethod,
        estado: 'recibida',
        lineas: purchaseItems.map((item) => ({
          producto_id: item.productId || null,
          nombre: item.name,
          cantidad: item.qty,
          precio_costo: item.price,
          precio_venta: item.salePrice,
          porcentaje_impuesto: item.taxPercent,
        })),
      });

      setPurchasesList((prev) => [
        {
          id: created.id,
          code: created.codigo,
          supplier: created.proveedor,
          date: created.fecha || purchaseDate,
          items: created.items,
          subtotal: created.subtotal,
          tax: created.impuesto,
          total: created.total,
          status: mapEstadoUi(created.estado),
          payment: paymentMethod,
        },
        ...prev,
      ]);
      toast.success('Compra guardada en Supabase. Stock y precios actualizados.');
      setShowAddForm(false);
      setPurchaseItems([]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al guardar la compra');
    } finally {
      setSaving(false);
    }
  };

  const handleExportPdf = () => {
    if (tab === 'list') {
      exportTableToPdf({
        title: 'Órdenes de Compra',
        filename: 'compras',
        headers: ['Orden', 'Fecha', 'Proveedor', 'Ítems', 'Subtotal', 'ITBIS', 'Total', 'Pago', 'Estado'],
        rows: filteredPurchases.map((p) => [
          p.code,
          p.date,
          p.supplier,
          p.items,
          formatMoneyPdf(p.subtotal),
          formatMoneyPdf(p.tax),
          formatMoneyPdf(p.total),
          p.payment,
          statusMap[p.status]?.label ?? p.status,
        ]),
        landscape: true,
      });
      return;
    }
    exportTableToPdf({
      title: 'Devoluciones de Compra',
      filename: 'devoluciones-compra',
      headers: ['Código', 'Orden', 'Proveedor', 'Fecha', 'Total', 'Motivo', 'Estado'],
      rows: returnsList.map((r) => [
        r.code,
        r.purchaseCode,
        r.supplier,
        r.date,
        formatMoneyPdf(r.total),
        r.reason,
        statusMap[r.status]?.label ?? r.status,
      ]),
    });
  };

  if (viewingPurchase || loadingPurchaseDetail) {
    return (
      <AppLayout>
        <div className="space-y-6 slide-up">
          {/* Header with back button */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-bold">
                <ShoppingBag size={26} />
              </div>
              <div>
                <div className="flex items-center gap-3 flex-wrap">
                  <h1 className="text-2xl font-black text-foreground tracking-tight">
                    Detalle de Compra {viewingPurchase?.codigo || ''}
                  </h1>
                  {viewingPurchase && (
                    <span className={statusMap[mapEstadoUi(viewingPurchase.estado)]?.cls ?? 'badge-neutral'}>
                      {statusMap[mapEstadoUi(viewingPurchase.estado)]?.label ?? viewingPurchase.estado}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Vista detallada y desglose fiscal de la orden de compra registrada
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setViewingPurchase(null);
                setLoadingPurchaseDetail(false);
              }}
              className="btn-secondary text-xs font-bold py-2.5 px-4 flex items-center gap-2 self-start sm:self-auto shadow-xs"
            >
              ← Volver a Compras
            </button>
          </div>

          {loadingPurchaseDetail && !viewingPurchase ? (
            <div className="card p-12 text-center text-sm text-muted-foreground">
              Cargando detalle de la compra…
            </div>
          ) : viewingPurchase ? (
            <div className="space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="card p-4 space-y-1">
                  <span className="text-xs text-muted-foreground font-semibold">Proveedor</span>
                  <p className="text-lg font-black text-foreground truncate">{viewingPurchase.proveedor}</p>
                </div>
                <div className="card p-4 space-y-1">
                  <span className="text-xs text-muted-foreground font-semibold">Fecha de Orden</span>
                  <p className="text-lg font-bold font-mono text-foreground">{viewingPurchase.fecha}</p>
                </div>
                <div className="card p-4 space-y-1">
                  <span className="text-xs text-muted-foreground font-semibold">Método de Pago</span>
                  <p className="text-lg font-bold text-foreground">{viewingPurchase.metodo_pago || 'Contado'}</p>
                </div>
                <div className="card p-4 space-y-1 bg-primary/5 border-primary/20">
                  <span className="text-xs text-muted-foreground font-semibold">Monto Total Compra</span>
                  <p className="text-xl font-black text-primary font-mono">
                    RD$ {viewingPurchase.total.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>

              {viewingPurchase.notas && (
                <div className="card p-4 bg-secondary/30 text-xs">
                  <span className="font-bold text-muted-foreground block mb-1">Notas u Observaciones:</span>
                  <p className="text-foreground">{viewingPurchase.notas}</p>
                </div>
              )}

              {/* Items Table */}
              <div className="card overflow-hidden">
                <div className="p-4 border-b border-border bg-secondary/40 flex justify-between items-center">
                  <h3 className="font-bold text-foreground text-sm uppercase tracking-wider">
                    Productos de la Orden ({viewingPurchase.lineas.length})
                  </h3>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-secondary/50 border-b border-border">
                      <tr>
                        <th className="text-left px-4 py-3 font-semibold text-muted-foreground">#</th>
                        <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Producto / Descripción</th>
                        <th className="text-center px-4 py-3 font-semibold text-muted-foreground">Cantidad</th>
                        <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Costo Unit.</th>
                        <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {viewingPurchase.lineas.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="p-6 text-center text-muted-foreground">
                            No hay productos registrados en esta compra
                          </td>
                        </tr>
                      ) : (
                        viewingPurchase.lineas.map((line, idx) => (
                          <tr key={line.id || idx} className="hover:bg-secondary/20 transition-colors">
                            <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{idx + 1}</td>
                            <td className="px-4 py-3 font-semibold text-foreground">{line.nombre}</td>
                            <td className="px-4 py-3 text-center font-mono font-bold">{line.cantidad}</td>
                            <td className="px-4 py-3 text-right font-mono tabular-nums text-muted-foreground">
                              RD$ {line.precio_costo.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="px-4 py-3 text-right font-mono tabular-nums font-bold text-foreground">
                              RD$ {line.subtotal.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Fiscal Totals Footer */}
                <div className="p-4 border-t border-border bg-secondary/20 flex flex-col sm:flex-row justify-between items-end sm:items-center gap-4">
                  <button
                    type="button"
                    onClick={() => {
                      exportTableToPdf({
                        title: `ORDEN DE COMPRA - ${viewingPurchase.codigo}`,
                        subtitle: `Proveedor: ${viewingPurchase.proveedor} | Fecha: ${viewingPurchase.fecha}`,
                        filename: `compra-${viewingPurchase.codigo}`,
                        headers: ['#', 'Producto', 'Cant.', 'Precio Costo', 'Subtotal'],
                        rows: viewingPurchase.lineas.map((line, idx) => [
                          idx + 1,
                          line.nombre,
                          line.cantidad,
                          formatMoneyPdf(line.precio_costo),
                          formatMoneyPdf(line.subtotal),
                        ]),
                      });
                    }}
                    className="btn-secondary text-xs py-2 px-3 font-semibold flex items-center gap-1.5"
                  >
                    <Download size={14} /> Exportar PDF
                  </button>

                  <div className="w-full sm:w-72 space-y-1.5 text-xs">
                    <div className="flex justify-between text-muted-foreground">
                      <span>Subtotal Neto:</span>
                      <span className="font-mono font-medium">
                        RD$ {viewingPurchase.subtotal.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex justify-between text-amber-600 dark:text-amber-400 font-semibold">
                      <span>ITBIS (Impuesto):</span>
                      <span className="font-mono">
                        RD$ {viewingPurchase.impuesto.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex justify-between border-t border-border pt-2 text-base font-black text-foreground">
                      <span>Total General:</span>
                      <span className="text-primary font-mono">
                        RD$ {viewingPurchase.total.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Actions */}
              <div className="flex justify-start">
                <button
                  type="button"
                  onClick={() => {
                    setViewingPurchase(null);
                    setLoadingPurchaseDetail(false);
                  }}
                  className="btn-secondary text-xs font-bold py-2.5 px-5"
                >
                  ← Volver a Compras
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </AppLayout>
    );
  }

  if (showAddForm) {
    return (
      <AppLayout>
        <div className="space-y-6 slide-up">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Nueva Compra</h1>
              <p className="text-sm text-muted-foreground mt-1">Registrar orden de compra y actualizar existencias</p>
            </div>
            <button onClick={() => setShowAddForm(false)} className="btn-secondary">← Volver a Compras</button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              {/* Purchase General Info Header */}
              <div className="card p-5 space-y-4">
                <h3 className="font-semibold text-foreground">Información de la Compra</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Proveedor *</label>
                    <select
                      value={supplierId}
                      onChange={(e) => setSupplierId(e.target.value)}
                      className="input-field"
                    >
                      <option value="">Seleccionar proveedor…</option>
                      {proveedores.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nombre}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Fecha de Compra *</label>
                    <input
                      type="date"
                      className="input-field"
                      value={purchaseDate}
                      onChange={(e) => setPurchaseDate(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Método de Pago</label>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="input-field"
                    >
                      <option value="Transferencia">Transferencia</option>
                      <option value="Efectivo">Efectivo</option>
                      <option value="Cheque">Cheque</option>
                      <option value="Crédito">Crédito</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">No. Factura / Comprobante Proveedor</label>
                    <input
                      className="input-field font-mono"
                      value={invoiceNumber}
                      onChange={(e) => setInvoiceNumber(e.target.value)}
                      placeholder="FAC-COMP-XXX"
                    />
                  </div>
                </div>
              </div>

              {/* Products Table Card */}
              <div className="card p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-foreground text-base">Productos en la Compra</h3>
                    <p className="text-xs text-muted-foreground">Escribe o escanea para agregar directamente a la lista sin abrir modales</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setLastAddedNotice(null);
                      resetModalForm();
                      setModalTab('catalog');
                      setShowProductModal(true);
                    }}
                    className="btn-primary flex items-center gap-2 text-xs py-2 px-3.5 shadow-md self-start sm:self-auto bg-[#007052] hover:bg-[#005c43] text-white font-bold cursor-pointer transition"
                  >
                    <Plus size={16} />
                    Agregar producto
                  </button>
                </div>

                {/* Buscador Rápido Inline con sugerencias flotantes */}
                <div className="relative" ref={inlineDropdownRef}>
                  <div className="relative flex items-center">
                    <Search
                      size={18}
                      className={`absolute left-3.5 transition-colors ${
                        inlineLoading ? 'text-[#007052] animate-pulse' : 'text-slate-400'
                      }`}
                    />
                    <input
                      ref={inlineSearchRef}
                      type="text"
                      value={inlineSearch}
                      onChange={(e) => setInlineSearch(e.target.value)}
                      onFocus={() => {
                        if (inlineResults.length > 0) setInlineOpen(true);
                      }}
                      onKeyDown={handleInlineKeyDown}
                      placeholder="Escribe el nombre, código de barras o SKU para agregar directamente... (Enter para añadir)"
                      className="input-field !pl-10 !pr-10 h-11 text-sm bg-slate-50/70 dark:bg-slate-900/60 border-slate-200 dark:border-slate-700 focus:bg-white dark:focus:bg-slate-900 transition-all font-medium rounded-xl w-full shadow-2xs"
                    />
                    {inlineLoading ? (
                      <Loader2 size={16} className="absolute right-3.5 text-[#007052] animate-spin" />
                    ) : inlineSearch ? (
                      <button
                        type="button"
                        onClick={() => {
                          setInlineSearch('');
                          setInlineResults([]);
                          setInlineOpen(false);
                          inlineSearchRef.current?.focus();
                        }}
                        className="absolute right-3 p-1 text-slate-400 hover:text-slate-600 rounded-md transition cursor-pointer"
                        title="Limpiar"
                      >
                        <X size={15} />
                      </button>
                    ) : null}
                  </div>

                  {/* Sugerencias flotantes */}
                  {inlineOpen && (
                    <div className="absolute left-0 right-0 top-full mt-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl z-40 max-h-72 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 animate-in fade-in zoom-in-95 duration-150">
                      {inlineResults.length === 0 ? (
                        <div className="p-4 text-center text-xs text-muted-foreground space-y-2">
                          <p>
                            No se encontraron productos en la base de datos para &quot;{inlineSearch}&quot;
                          </p>
                          <button
                            type="button"
                            onClick={() => {
                              setInlineOpen(false);
                              setModalSearch('');
                              setNewName(inlineSearch.trim());
                              setModalTab('new');
                              setShowProductModal(true);
                            }}
                            className="px-3 py-1.5 rounded-lg bg-[#007052] text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-xs hover:bg-[#005c43] transition cursor-pointer"
                          >
                            <Plus size={13} />
                            Crear &quot;{inlineSearch}&quot; como nuevo producto
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="px-3.5 py-1.5 bg-slate-50 dark:bg-slate-800/60 text-[11px] font-semibold text-slate-500 flex justify-between items-center border-b border-slate-100 dark:border-slate-800">
                            <span>Sugerencias ({inlineResults.length}) · Haz clic o presiona Enter para agregar</span>
                            <span className="text-[10px] text-muted-foreground">↑↓ para seleccionar</span>
                          </div>
                          {inlineResults.map((p, idx) => {
                            const isHighlighted = idx === inlineHighlightIndex;
                            const alreadyInCart = purchaseItems.some((i) => i.productId === p.id);

                            return (
                              <div
                                key={p.id}
                                onClick={() => handleSelectInlineProduct(p)}
                                onMouseEnter={() => setInlineHighlightIndex(idx)}
                                className={`px-4 py-2.5 flex items-center justify-between cursor-pointer transition-colors gap-3 ${
                                  isHighlighted
                                    ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-l-4 border-[#007052]'
                                    : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                                }`}
                              >
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2">
                                    <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                                      {p.name}
                                    </p>
                                    {alreadyInCart && (
                                      <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-300 px-1.5 py-0.5 rounded border border-emerald-300 dark:border-emerald-800">
                                        En la orden
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[11px] font-mono text-slate-500 mt-0.5">
                                    SKU: <strong className="text-slate-700 dark:text-slate-300">{p.sku}</strong>
                                    {p.barcode && <span> · Barra: {p.barcode}</span>}
                                    <span> · Stock: {p.currentStock} {p.unit}</span>
                                  </p>
                                </div>
                                <div className="text-right flex-shrink-0 flex items-center gap-3">
                                  <div className="text-right">
                                    <p className="text-xs font-bold font-mono text-slate-900 dark:text-white">
                                      Costo: RD$ {(p.costPrice || 0).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                                    </p>
                                    <p className="text-[10px] text-emerald-600 font-semibold font-mono">
                                      Venta: RD$ {(p.salePrice || 0).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                                    </p>
                                  </div>
                                  <button
                                    type="button"
                                    className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-[#007052] dark:text-emerald-300 hover:bg-[#007052] hover:text-white transition shadow-2xs"
                                    title="Agregar a la compra"
                                  >
                                    <Plus size={14} />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </>
                      )}
                    </div>
                  )}
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-secondary/30">
                        <th className="text-left py-2.5 px-3 text-muted-foreground font-semibold">Producto</th>
                        <th className="text-center py-2.5 px-3 text-muted-foreground font-semibold">Cantidad</th>
                        <th className="text-right py-2.5 px-3 text-muted-foreground font-semibold">
                          Precio compra
                          <span className="block text-[10px] font-normal normal-case">editable</span>
                        </th>
                        <th className="text-right py-2.5 px-3 text-muted-foreground font-semibold">
                          Precio venta
                          <span className="block text-[10px] font-normal normal-case text-emerald-600">editable</span>
                        </th>
                        <th className="text-center py-2.5 px-3 text-muted-foreground font-semibold">Margen</th>
                        <th className="text-right py-2.5 px-3 text-muted-foreground font-semibold">Subtotal</th>
                        <th className="text-center py-2.5 px-3"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {purchaseItems.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="text-center py-8 text-muted-foreground">
                            No has agregado ningún producto a esta compra. Escribe en el buscador superior o haz clic en <strong>Agregar producto</strong>.
                          </td>
                        </tr>
                      ) : (
                        purchaseItems.map((item) => {
                          const marginAmt = item.salePrice - item.price;
                          const marginPct = item.price > 0 ? ((marginAmt / item.price) * 100) : 0;

                          return (
                            <tr key={item.id} className="hover:bg-secondary/20 transition-colors">
                              <td className="py-2.5 px-3">
                                <p className="font-bold text-foreground">{item.name}</p>
                                <p className="text-xs font-mono text-muted-foreground">{item.sku}</p>
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                <input
                                  type="number"
                                  min={0.001}
                                  step="0.001"
                                  value={item.qty}
                                  onChange={(e) => handleUpdateLineQty(item.id, parseFloat(e.target.value) || 0)}
                                  className="input-field w-24 text-center py-1 font-bold"
                                />
                              </td>
                              <td className="py-2.5 px-3 text-right">
                                <div className="inline-flex items-center gap-1 justify-end">
                                  <span className="text-[10px] text-muted-foreground font-semibold">RD$</span>
                                  <input
                                    type="number"
                                    min={0}
                                    step="0.01"
                                    value={item.price}
                                    onChange={(e) => handleUpdateLinePrice(item.id, Number(e.target.value))}
                                    className="input-field w-28 text-right py-1.5 font-bold tabular-nums"
                                    title="Precio de compra / costo"
                                  />
                                </div>
                              </td>
                              <td className="py-2.5 px-3 text-right">
                                <div className="inline-flex items-center gap-1 justify-end">
                                  <span className="text-[10px] text-emerald-600 font-semibold">RD$</span>
                                  <input
                                    type="number"
                                    min={0}
                                    step="0.01"
                                    value={item.salePrice}
                                    onChange={(e) => handleUpdateLineSalePrice(item.id, Number(e.target.value))}
                                    className="input-field w-28 text-right py-1.5 font-bold tabular-nums text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                                    title="Precio de venta"
                                  />
                                </div>
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-extrabold tabular-nums ${
                                  marginAmt >= 0
                                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                                    : 'bg-danger-bg text-danger border border-danger/20'
                                }`}>
                                  {marginPct >= 0 ? `+${marginPct.toFixed(0)}%` : `${marginPct.toFixed(0)}%`}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-right font-black text-foreground tabular-nums">
                                RD$ {(item.qty * item.price).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveLine(item.id)}
                                  className="p-1.5 text-muted-foreground hover:text-danger hover:bg-danger-bg rounded-lg transition-colors"
                                  title="Eliminar ítem"
                                >
                                  <Trash2 size={15} />
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
            </div>

            {/* Summary Column */}
            <div className="space-y-4">
              <div className="card p-5 space-y-3 bg-card border border-border shadow-sm">
                <h3 className="font-semibold text-foreground border-b border-border pb-2">Resumen de la Compra</h3>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Ítems Totales</span>
                  <span className="font-bold text-foreground">{purchaseItems.reduce((s, i) => s + i.qty, 0)} unidades</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-bold tabular-nums">RD$ {subtotal.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">ITBIS Estimado (18%)</span>
                  <span className="font-bold tabular-nums">RD$ {taxTotal.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="border-t border-border pt-3 flex justify-between font-black text-lg text-foreground">
                  <span>Total Final</span>
                  <span className="text-primary tabular-nums">RD$ {grandTotal.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>

              <div className="card p-5 space-y-2">
                <h3 className="font-semibold text-foreground text-sm">Observaciones / Notas</h3>
                <textarea className="input-field text-xs" rows={3} placeholder="Instrucciones de entrega, detalles del proveedor..." />
              </div>

              <button
                type="button"
                onClick={() => void handleSavePurchase()}
                disabled={saving || purchaseItems.length === 0}
                className="btn-primary w-full py-3 text-base font-bold shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Check size={18} />
                {saving ? 'Guardando…' : 'Guardar Compra'}
              </button>
            </div>
          </div>
        </div>

        {/* Modal flotante centrado con overlay y portal al body */}
        {showProductModal &&
          createPortal(
            <div
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 overflow-y-auto animate-in fade-in duration-200"
              onClick={() => setShowProductModal(false)}
            >
              <div
                className="w-full max-w-3xl bg-card rounded-2xl border border-border shadow-2xl overflow-hidden flex flex-col max-h-[90vh] modal-panel my-auto animate-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
              >
              {/* Modal Header with Added Counter */}
              <div className="px-6 py-5 border-b border-border flex items-center justify-between gap-4 bg-primary/5">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-11 h-11 rounded-xl bg-primary/15 text-primary flex items-center justify-center font-bold flex-shrink-0">
                    <PackagePlus size={22} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-extrabold text-foreground text-xl">Agregar Productos a la Compra</h3>
                    <p className="text-sm text-muted-foreground mt-0.5">Actualiza el costo y precio de venta al registrar la entrada</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 flex-shrink-0">
                  <div className="flex items-center gap-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-3.5 py-2 rounded-xl text-sm font-black border border-emerald-500/20">
                    <ShoppingCart size={16} />
                    <span>{purchaseItems.length} en orden</span>
                  </div>
                  <button type="button" onClick={() => setShowProductModal(false)} className="text-muted-foreground hover:text-foreground p-2 rounded-lg hover:bg-secondary">
                    <X size={22} />
                  </button>
                </div>
              </div>

              {/* Toast/Notice Banner inside modal */}
              {lastAddedNotice && (
                <div className="bg-emerald-500/15 border-b border-emerald-500/30 px-5 py-3 flex items-center justify-between text-sm text-emerald-700 dark:text-emerald-300 font-bold animate-in fade-in">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={18} className="text-emerald-600 flex-shrink-0" />
                    <span>{lastAddedNotice}</span>
                  </div>
                  <button type="button" onClick={() => setLastAddedNotice(null)} className="text-emerald-700 hover:text-emerald-900 font-black p-1 flex items-center justify-center">
                    <X size={16} />
                  </button>
                </div>
              )}

              <div className="p-6 space-y-5 overflow-y-auto flex-1 scrollbar-thin">
                {/* Tabs: Catálogo / Nuevo */}
                <div className="flex gap-1.5 p-1.5 bg-secondary rounded-xl w-fit">
                  <button
                    type="button"
                    onClick={() => {
                      setModalTab('catalog');
                      setSelectedProduct(null);
                    }}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold transition-all ${
                      modalTab === 'catalog'
                        ? 'bg-card text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Search size={16} />
                    Catálogo
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setModalTab('new');
                      setSelectedProduct(null);
                      setModalSearch('');
                    }}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold transition-all ${
                      modalTab === 'new'
                        ? 'bg-card text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Package size={16} />
                    Producto nuevo
                  </button>
                </div>

                {modalTab === 'catalog' && (
                  <>
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-sm font-bold text-muted-foreground">
                          Buscar en base de datos
                        </label>
                        {catalogLoading && (
                          <span className="text-xs text-primary font-semibold flex items-center gap-1.5 animate-pulse">
                            <Loader2 size={13} className="animate-spin" /> Buscando en base de datos…
                          </span>
                        )}
                      </div>
                      <div className="relative">
                        {catalogLoading ? (
                          <Loader2 size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-primary animate-spin" />
                        ) : (
                          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-primary" />
                        )}
                        <input
                          type="text"
                          placeholder="Escribe el nombre, SKU, código de barras o PLU…"
                          value={modalSearch}
                          onChange={(e) => setModalSearch(e.target.value)}
                          className="input-field !pl-11 !pr-10 h-12 text-base font-medium"
                          autoFocus
                        />
                        {modalSearch && (
                          <button
                            type="button"
                            onClick={() => {
                              setModalSearch('');
                              setDebouncedSearch('');
                            }}
                            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-secondary transition"
                            title="Limpiar búsqueda"
                          >
                            <X size={16} />
                          </button>
                        )}
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground mt-1.5 px-0.5">
                        <span>
                          {debouncedSearch
                            ? `Coincidencias en base de datos para "${debouncedSearch}"`
                            : 'Catálogo de productos (carga optimizada bajo demanda)'}
                        </span>
                        {catalogTotal > 0 && (
                          <span className="font-mono font-bold text-foreground">
                            {catalogProducts.length} de {catalogTotal} productos
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                          {debouncedSearch ? 'Resultados' : 'Productos'} ({catalogTotal})
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            setModalTab('new');
                            if (modalSearch.trim()) setNewName(modalSearch.trim());
                          }}
                          className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
                        >
                          <Plus size={13} /> + Crear producto nuevo
                        </button>
                      </div>

                      <div className="max-h-60 overflow-y-auto border border-border rounded-xl divide-y divide-border/60 bg-secondary/10 scrollbar-thin">
                        {catalogLoading && catalogProducts.length === 0 ? (
                          <div className="p-8 text-center text-sm text-muted-foreground space-y-2">
                            <Loader2 size={24} className="animate-spin text-primary mx-auto" />
                            <p className="font-medium">Consultando productos en la base de datos…</p>
                          </div>
                        ) : catalogProducts.length === 0 ? (
                          <div className="p-6 text-center text-sm text-muted-foreground space-y-3">
                            <p className="text-foreground font-semibold">
                              {debouncedSearch
                                ? `No se encontró ningún producto con "${debouncedSearch}"`
                                : 'No hay productos disponibles en la base de datos'}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Puedes registrarlo de inmediato para añadirlo a esta compra
                            </p>
                            <button
                              type="button"
                              onClick={() => {
                                setModalTab('new');
                                if (modalSearch.trim()) setNewName(modalSearch.trim());
                              }}
                              className="px-4 py-2 bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition cursor-pointer"
                            >
                              <Plus size={14} />
                              Crear “{modalSearch.trim() || 'nuevo producto'}”
                            </button>
                          </div>
                        ) : (
                          <>
                            {catalogProducts.map((p) => {
                              const isSelected = selectedProduct?.id === p.id;
                              return (
                                <div
                                  key={p.id}
                                  onClick={() => {
                                    setSelectedProduct(p);
                                    setModalPrice(p.costPrice || 0);
                                    setModalSalePrice(p.salePrice || 0);
                                  }}
                                  className={`px-4 py-3 flex items-center justify-between cursor-pointer transition-all gap-3 ${
                                    isSelected
                                      ? 'bg-primary/15 border-l-4 border-primary text-foreground'
                                      : 'hover:bg-secondary/60'
                                  }`}
                                >
                                  <div className="min-w-0 flex-1 pr-2">
                                    <div className="flex items-center gap-2">
                                      <p className="text-sm font-extrabold truncate">{p.name}</p>
                                      {isSelected && (
                                        <span className="text-[10px] font-black uppercase bg-primary text-white px-1.5 py-0.5 rounded">
                                          Seleccionado
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-xs font-mono text-muted-foreground mt-0.5">
                                      SKU: <strong className="text-foreground">{p.sku}</strong>
                                      {p.barcode && <span> · Barra: {p.barcode}</span>}
                                      <span> · Stock: <strong>{p.currentStock}</strong> {p.unit}</span>
                                    </p>
                                  </div>
                                  <div className="text-right flex-shrink-0 space-y-0.5">
                                    <p className="text-xs font-black tabular-nums text-foreground">
                                      Costo: RD$ {(p.costPrice || 0).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                                    </p>
                                    <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold tabular-nums">
                                      Venta: RD$ {(p.salePrice || 0).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                                    </p>
                                  </div>
                                </div>
                              );
                            })}

                            {/* Paginación bajo demanda: Cargar más productos */}
                            {catalogProducts.length < catalogTotal && (
                              <div className="p-3 bg-secondary/30 text-center">
                                <button
                                  type="button"
                                  onClick={() => fetchCatalog(debouncedSearch, catalogPage + 1, true)}
                                  disabled={loadingMore}
                                  className="text-xs font-bold text-primary hover:text-primary/80 py-2 px-4 rounded-xl bg-card border border-border shadow-2xs hover:bg-secondary transition flex items-center justify-center gap-2 mx-auto disabled:opacity-50 cursor-pointer"
                                >
                                  {loadingMore ? (
                                    <>
                                      <Loader2 size={13} className="animate-spin" /> Cargando más productos…
                                    </>
                                  ) : (
                                    <>
                                      <Plus size={13} />
                                      Cargar más productos ({catalogProducts.length} de {catalogTotal})
                                    </>
                                  )}
                                </button>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </>
                )}

                {modalTab === 'new' && (
                  <div className="space-y-4 rounded-2xl border border-border bg-secondary/20 p-5">
                    <div className="flex items-center gap-2 text-base font-bold text-foreground">
                      <Package size={18} className="text-primary" />
                      Registrar producto nuevo en catálogo
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="sm:col-span-2">
                        <label className="block text-sm font-bold text-muted-foreground mb-1.5">
                          Nombre <span className="text-danger">*</span>
                        </label>
                        <input
                          className="input-field h-12 text-base"
                          placeholder="Ej. Leche Evaporada 410g"
                          value={newName}
                          onChange={(e) => setNewName(e.target.value)}
                          autoFocus
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-muted-foreground mb-1.5">
                          SKU <span className="text-danger">*</span>
                        </label>
                        <input
                          className="input-field h-12 text-base font-mono uppercase"
                          placeholder="Ej. LEC-EVA-410"
                          value={newSku}
                          onChange={(e) => setNewSku(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-muted-foreground mb-1.5">
                          Código de barras
                        </label>
                        <input
                          className="input-field h-12 text-base font-mono"
                          placeholder="Opcional"
                          value={newBarcode}
                          onChange={(e) => setNewBarcode(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-muted-foreground mb-1.5">Categoría</label>
                        <input
                          className="input-field h-12 text-base"
                          list="purchase-categories"
                          value={newCategory}
                          onChange={(e) => setNewCategory(e.target.value)}
                        />
                        <datalist id="purchase-categories">
                          {categories.map((c) => (
                            <option key={c} value={c} />
                          ))}
                        </datalist>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-bold text-muted-foreground mb-1.5">Unidad</label>
                          <select
                            className="input-field h-12 text-base"
                            value={newUnit}
                            onChange={(e) => setNewUnit(e.target.value)}
                          >
                            {['Unidad', 'Libra', 'Kg', 'Caja', 'Paquete', 'Galón', 'Litro'].map((u) => (
                              <option key={u} value={u}>
                                {u}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-bold text-muted-foreground mb-1.5">ITBIS %</label>
                          <select
                            className="input-field h-12 text-base"
                            value={newTax}
                            onChange={(e) => setNewTax(Number(e.target.value))}
                          >
                            <option value={0}>0%</option>
                            <option value={16}>16%</option>
                            <option value={18}>18%</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Quantity & editable prices */}
                <div className="bg-secondary/30 p-5 rounded-2xl border border-border space-y-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Cantidad y precios (editables)
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-foreground mb-1.5">
                        Cantidad <span className="text-danger">*</span>
                      </label>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setModalQty((q) => Math.max(1, q - 1))}
                          className="w-11 h-12 rounded-xl bg-secondary hover:bg-border flex items-center justify-center font-bold"
                        >
                          <Minus size={16} />
                        </button>
                        <input
                          type="number"
                          min={0.001}
                          step="0.001"
                          value={modalQty}
                          onChange={(e) => setModalQty(parseFloat(e.target.value) || 0)}
                          className="input-field text-lg font-black text-center h-12 flex-1 tabular-nums"
                        />
                        <button
                          type="button"
                          onClick={() => setModalQty((q) => q + 1)}
                          className="w-11 h-12 rounded-xl bg-secondary hover:bg-border flex items-center justify-center font-bold"
                        >
                          <Plus size={16} />
                        </button>
                      </div>
                      <div className="flex items-center gap-1.5 mt-2.5">
                        {[1, 5, 10, 24, 50, 100].map((preset) => (
                          <button
                            key={`preset-${preset}`}
                            type="button"
                            onClick={() => setModalQty(preset)}
                            className="flex-1 py-2 text-xs font-bold bg-card border border-border hover:bg-primary/10 hover:text-primary rounded-lg tabular-nums"
                          >
                            {preset}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-bold text-foreground mb-1.5">
                        Precio de compra / costo <span className="text-danger">*</span>
                      </label>
                      <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">
                          RD$
                        </span>
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={modalPrice || ''}
                          onChange={(e) => setModalPrice(Number(e.target.value))}
                          placeholder="0.00"
                          className="input-field text-base font-black text-right h-12 tabular-nums pl-14"
                        />
                      </div>
                      {selectedProduct && (
                        <span className="text-xs text-muted-foreground mt-1.5 block text-right">
                          Catálogo: RD$ {(selectedProduct.costPrice || 0).toLocaleString('es-DO')}
                        </span>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-bold text-emerald-600 dark:text-emerald-400 mb-1.5">
                        Precio de venta <span className="text-danger">*</span>
                      </label>
                      <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-emerald-600/70">
                          RD$
                        </span>
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={modalSalePrice || ''}
                          onChange={(e) => setModalSalePrice(Number(e.target.value))}
                          placeholder="0.00"
                          className="input-field text-base font-black text-right h-12 tabular-nums pl-14 border-emerald-500/40 text-emerald-600 dark:text-emerald-400"
                        />
                      </div>
                      {selectedProduct && (
                        <span className="text-xs text-muted-foreground mt-1.5 block text-right">
                          Catálogo: RD$ {(selectedProduct.salePrice || 0).toLocaleString('es-DO')}
                        </span>
                      )}
                    </div>
                  </div>

                  {modalPrice > 0 && (
                    <div className="bg-card p-4 rounded-xl border border-border space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                        <span className="font-bold text-muted-foreground">Sugerir venta por margen:</span>
                        <div className="flex items-center gap-1.5">
                          {[20, 30, 35, 40, 50].map((pct) => (
                            <button
                              key={`margin-${pct}`}
                              type="button"
                              onClick={() => setModalSalePrice(Math.round(modalPrice * (1 + pct / 100)))}
                              className="px-2.5 py-1.5 text-xs font-extrabold bg-secondary hover:bg-emerald-500/15 hover:text-emerald-600 rounded-lg border border-border tabular-nums"
                            >
                              +{pct}%
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="pt-2 border-t border-border/50 flex items-center justify-between text-sm">
                        <span className="text-muted-foreground font-medium">
                          Ganancia/und:{' '}
                          <strong
                            className={
                              modalSalePrice - modalPrice >= 0
                                ? 'text-emerald-600'
                                : 'text-danger'
                            }
                          >
                            RD$ {(modalSalePrice - modalPrice).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                          </strong>
                        </span>
                        <span
                          className={`px-2.5 py-1 rounded-lg text-sm font-black tabular-nums ${
                            modalSalePrice - modalPrice >= 0
                              ? 'bg-emerald-500/15 text-emerald-600 border border-emerald-500/30'
                              : 'bg-danger-bg text-danger border border-danger/30'
                          }`}
                        >
                          {modalPrice > 0
                            ? (((modalSalePrice - modalPrice) / modalPrice) * 100).toFixed(1)
                            : 0}
                          %
                        </span>
                      </div>
                    </div>
                  )}

                  {(selectedProduct || (modalTab === 'new' && newName.trim())) && modalPrice > 0 && (
                    <div className="bg-primary/10 border border-primary/20 rounded-xl p-4 flex justify-between items-center text-sm">
                      <span className="font-bold text-foreground">Total línea (cantidad × costo):</span>
                      <span className="font-black text-lg text-primary tabular-nums">
                        RD$ {(modalQty * modalPrice).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="p-5 border-t border-border flex flex-wrap items-center justify-end gap-3 bg-secondary/20">
                <button
                  type="button"
                  onClick={() => setShowProductModal(false)}
                  className="btn-secondary text-sm px-5 py-3 font-bold flex items-center gap-1.5"
                >
                  <CheckCircle2 size={16} className="text-emerald-600" />
                  <span>Listo / Finalizar</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleAddProductToPurchase(false)}
                  disabled={
                    modalTab === 'catalog'
                      ? !selectedProduct
                      : !newName.trim() || !newSku.trim() || modalPrice <= 0 || modalSalePrice <= 0
                  }
                  className="btn-primary text-sm px-5 py-3 font-black flex items-center gap-2 shadow-md disabled:opacity-50"
                >
                  <Plus size={16} />
                  {modalTab === 'new' ? 'Crear y añadir a la compra' : 'Añadir y seguir agregando'}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6 slide-up">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Compras</h1>
            <p className="text-sm text-muted-foreground mt-1">Gestiona órdenes de compra y devoluciones</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setInvoiceNumber(nextPurchaseInvoice());
              setPurchaseItems([]);
              setSupplierId('');
              setShowAddForm(true);
            }}
            className="btn-primary flex items-center gap-2 w-fit shadow-md"
          >
            <Plus size={16} />Nueva Compra
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="card p-4"><p className="text-xs text-muted-foreground">Total compras</p><p className="text-2xl font-bold text-foreground mt-1">RD$ {purchasesList.reduce((s, p) => s + p.total, 0).toLocaleString('es-DO')}</p></div>
          <div className="card p-4"><p className="text-xs text-muted-foreground">Órdenes totales</p><p className="text-2xl font-bold text-info mt-1">{loadingList ? '…' : purchasesList.length}</p></div>
          <div className="card p-4"><p className="text-xs text-muted-foreground">Pendientes</p><p className="text-2xl font-bold text-warning mt-1">{purchasesList.filter((p) => p.status === 'pending').length}</p></div>
          <div className="card p-4"><p className="text-xs text-muted-foreground">Devoluciones</p><p className="text-2xl font-bold text-danger mt-1">2</p></div>
        </div>

        <div className="flex gap-1 bg-secondary rounded-xl p-1 w-fit">
          {[{ id: 'list' as Tab, label: 'Lista de Compras', icon: <ShoppingBag size={16} /> }, { id: 'returns' as Tab, label: 'Devoluciones', icon: <RotateCcw size={16} /> }].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === t.id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
              {t.icon}{t.label}
            </button>
          ))}
        </div>

        <div className="card p-4 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input className="input-field pl-9" placeholder="Buscar por código o proveedor..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <button className="btn-secondary flex items-center gap-2"><Filter size={16} />Filtrar</button>
            <button type="button" onClick={handleExportPdf} className="btn-secondary flex items-center gap-2"><Download size={16} />Exportar PDF</button>
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
                    <tr key={p.id} className={`border-b border-border hover:bg-secondary/30 transition-colors ${i % 2 === 0 ? '' : 'bg-secondary/10'}`}>
                      <td className="px-4 py-3 font-mono text-primary font-medium">{p.code}</td>
                      <td className="px-4 py-3 font-medium text-foreground">{p.supplier}</td>
                      <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{p.date}</td>
                      <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">{p.items} items</td>
                      <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">RD$ {p.tax.toLocaleString()}</td>
                      <td className="px-4 py-3 font-bold text-foreground">RD$ {p.total.toLocaleString()}</td>
                      <td className="px-4 py-3 hidden md:table-cell"><span className={statusMap[p.status].cls}>{statusMap[p.status].label}</span></td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                            title="Ver detalle"
                            onClick={() => void handleViewPurchase(p.id)}
                          >
                            <Eye size={14} />
                          </button>
                          <button
                            type="button"
                            className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                            title="Editar"
                            onClick={() =>
                              toast.info(
                                'Las compras recibidas no se editan; anula y crea otra'
                              )
                            }
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            type="button"
                            className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-danger transition-colors"
                            title="Anular compra"
                            disabled={p.status === 'anulada'}
                            onClick={() => setConfirmDeleteId(p.id)}
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
              <span>Mostrando {filteredPurchases.length} de {purchasesList.length} compras</span>
              <div className="flex gap-1">
                <button className="px-3 py-1 rounded-lg hover:bg-secondary transition-colors">Anterior</button>
                <button className="px-3 py-1 rounded-lg bg-primary text-primary-foreground">1</button>
                <button className="px-3 py-1 rounded-lg hover:bg-secondary transition-colors">Siguiente</button>
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
                      <td colSpan={7} className="py-8 text-center text-muted-foreground text-sm">
                        No hay devoluciones registradas en Supabase
                      </td>
                    </tr>
                  )}
                  {returnsList.map((r, i) => (
                    <tr key={r.id} className={`border-b border-border hover:bg-secondary/30 transition-colors ${i % 2 === 0 ? '' : 'bg-secondary/10'}`}>
                      <td className="px-4 py-3 font-mono text-danger font-medium">{r.code}</td>
                      <td className="px-4 py-3 font-mono text-primary">{r.purchaseCode}</td>
                      <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{r.supplier}</td>
                      <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{r.date}</td>
                      <td className="px-4 py-3 font-bold text-foreground">RD$ {r.total.toLocaleString()}</td>
                      <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">{r.reason}</td>
                      <td className="px-4 py-3"><span className={statusMap[r.status].cls}>{statusMap[r.status].label}</span></td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"><Eye size={14} /></button>
                          <button className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-danger transition-colors"><Trash2 size={14} /></button>
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



      <ModalShell
        open={!!confirmDeleteId}
        onClose={() => !anulando && setConfirmDeleteId(null)}
        size="sm"
        busy={anulando}
        busyLabel="Anulando…"
        className="p-6 space-y-4"
      >
        <div className="flex items-center gap-2">
          <Trash2 className="text-danger" size={20} />
          <h3 className="font-bold text-foreground text-lg">Anular compra</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          ¿Anular esta compra? Esta acción marca el documento como anulado. Para corregir,
          anula y crea otra compra.
        </p>
        <div className="flex gap-3 pt-2">
          <button
            type="button"
            className="btn-secondary flex-1"
            disabled={anulando}
            onClick={() => setConfirmDeleteId(null)}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="btn-primary flex-1 bg-rose-600 hover:bg-rose-700 text-white"
            disabled={anulando}
            onClick={() => void handleConfirmAnular()}
          >
            Confirmar anulación
          </button>
        </div>
      </ModalShell>
    </AppLayout>
  );
}
