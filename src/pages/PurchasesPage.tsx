import React, { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import AppLayout from '@/components/AppLayout';
import { Trash2 } from 'lucide-react';
import { exportTableToPdf, formatMoneyPdf } from '@/lib/exportPdf';
import type { ProductItem } from '@/lib/productStore';
import { useProveedores } from '@/hooks/useProveedores';
import { crearProducto, uiAProductoInsert, obtenerProductos, productoAUi } from '@/services/productos.service';
import { isAbortError } from '@/lib/isAbortError';
import { crearCompra, obtenerCompras, obtenerDetalleCompra, anularCompra, type CompraDetalle } from '@/services/compras.service';
import { toast } from '@/lib/toast';
import ModalShell from '@/components/ui/ModalShell';
import { PurchaseDetailView } from './purchases/components/PurchaseDetailView';
import { PurchaseProductModal } from './purchases/components/PurchaseProductModal';
import { PurchaseCreateView, type PurchaseLineItem } from './purchases/components/PurchaseCreateView';
import { PurchasesListView, type Purchase, type ReturnItem } from './purchases/components/PurchasesListView';

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
  const abortControllerRef = useRef<AbortController | null>(null);

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
  const inlineSearchRef = useRef<HTMLInputElement | null>(null);
  const inlineAbortRef = useRef<AbortController | null>(null);
  const inlineDropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(modalSearch.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [modalSearch]);

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

  const fetchCatalog = useCallback(async (query: string, page = 1, append = false) => {
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

  const filteredPurchases = purchasesList.filter(
    (p) =>
      p.code.toLowerCase().includes(search.toLowerCase()) ||
      p.supplier.toLowerCase().includes(search.toLowerCase())
  );

  const subtotal = purchaseItems.reduce((sum, item) => sum + item.qty * item.price, 0);
  const taxTotal = purchaseItems.reduce((sum, item) => {
    if (item.taxPercent > 0) {
      return sum + item.qty * item.price * (item.taxPercent / 100);
    }
    return sum;
  }, 0);
  const grandTotal = subtotal + taxTotal;

  const handleUpdateLineQty = (id: string, qty: number) => {
    setPurchaseItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, qty: Math.max(1, qty) } : item))
    );
  };

  const handleUpdateLinePrice = (id: string, price: number) => {
    setPurchaseItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, price: Math.max(0, price) } : item))
    );
  };

  const handleUpdateLineSalePrice = (id: string, salePrice: number) => {
    setPurchaseItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, salePrice: Math.max(0, salePrice) } : item))
    );
  };

  const handleRemoveLine = (id: string) => {
    setPurchaseItems((prev) => prev.filter((item) => item.id !== id));
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
    const costPrice = customPrice !== undefined && customPrice > 0 ? customPrice : product.costPrice || 0;
    const salePrice = customSalePrice !== undefined && customSalePrice > 0 ? customSalePrice : product.salePrice || 0;
    const taxPercent = customTax !== undefined ? customTax : product.tax ?? 18;

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
    if (inlineResults.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setInlineHighlightIndex((prev) => (prev + 1) % inlineResults.length);
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setInlineHighlightIndex((prev) => (prev - 1 + inlineResults.length) % inlineResults.length);
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      const chosen = inlineResults[inlineHighlightIndex] || inlineResults[0];
      if (chosen) {
        handleSelectInlineProduct(chosen);
      }
      return;
    }

    if (e.key === 'Escape') {
      setInlineOpen(false);
    }
  };

  const handleAddProductToPurchase = async (closeModal = false) => {
    if (modalTab === 'catalog') {
      if (!selectedProduct) {
        toast.error('Selecciona un producto del catálogo');
        return;
      }
      addProductDirectlyToPurchase(selectedProduct, modalQty, modalPrice, modalSalePrice);
      setLastAddedNotice(`¡"${selectedProduct.name}" añadido exitosamente!`);
      setSelectedProduct(null);
      setModalQty(1);
      setModalPrice(0);
      setModalSalePrice(0);

      if (closeModal) {
        setShowProductModal(false);
      }
      return;
    }

    if (!newName.trim() || !newSku.trim()) {
      toast.error('El nombre y SKU son obligatorios');
      return;
    }
    if (modalPrice <= 0) {
      toast.error('Ingresa un costo de compra válido');
      return;
    }
    if (modalSalePrice <= 0) {
      toast.error('Ingresa un precio de venta');
      return;
    }

    try {
      const nuevoProductoInsert = uiAProductoInsert({
        name: newName.trim(),
        sku: newSku.trim().toUpperCase(),
        barcode: newBarcode.trim() || '',
        category: newCategory,
        brand: '',
        unit: newUnit,
        supplier: '',
        costPrice: modalPrice,
        salePrice: modalSalePrice,
        wholesalePrice: modalSalePrice,
        tax: newTax,
        currentStock: 0,
        minStock: 5,
        image: '',
        expiryDate: null,
        warranty: 'N/A',
        status: 'active',
        saleType: 'unit',
      });

      const pCreado = await crearProducto(nuevoProductoInsert);
      const uiProduct = productoAUi(pCreado) as ProductItem;

      addProductDirectlyToPurchase(uiProduct, modalQty, modalPrice, modalSalePrice, newTax);
      setLastAddedNotice(`¡"${uiProduct.name}" registrado en catálogo y añadido a la compra!`);
      toast.success(`Producto "${uiProduct.name}" creado en catálogo y agregado a la orden`);

      resetModalForm();
      if (closeModal) {
        setShowProductModal(false);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error creando producto nuevo');
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
      <PurchaseDetailView
        viewingPurchase={viewingPurchase}
        loadingPurchaseDetail={loadingPurchaseDetail}
        onBack={() => {
          setViewingPurchase(null);
          setLoadingPurchaseDetail(false);
        }}
      />
    );
  }

  if (showAddForm) {
    return (
      <>
        <PurchaseCreateView
          supplierId={supplierId}
          setSupplierId={setSupplierId}
          proveedores={proveedores}
          purchaseDate={purchaseDate}
          setPurchaseDate={setPurchaseDate}
          paymentMethod={paymentMethod}
          setPaymentMethod={setPaymentMethod}
          invoiceNumber={invoiceNumber}
          setInvoiceNumber={setInvoiceNumber}
          purchaseItems={purchaseItems}
          onOpenProductModal={() => {
            setLastAddedNotice(null);
            resetModalForm();
            setModalTab('catalog');
            setShowProductModal(true);
          }}
          onBack={() => setShowAddForm(false)}
          inlineSearch={inlineSearch}
          setInlineSearch={setInlineSearch}
          inlineResults={inlineResults}
          inlineLoading={inlineLoading}
          inlineOpen={inlineOpen}
          setInlineOpen={setInlineOpen}
          inlineHighlightIndex={inlineHighlightIndex}
          setInlineHighlightIndex={setInlineHighlightIndex}
          inlineSearchRef={inlineSearchRef}
          inlineDropdownRef={inlineDropdownRef}
          onInlineKeyDown={handleInlineKeyDown}
          onSelectInlineProduct={handleSelectInlineProduct}
          onUpdateLineQty={handleUpdateLineQty}
          onUpdateLinePrice={handleUpdateLinePrice}
          onUpdateLineSalePrice={handleUpdateLineSalePrice}
          onRemoveLine={handleRemoveLine}
          onSavePurchase={handleSavePurchase}
          saving={saving}
          subtotal={subtotal}
          taxTotal={taxTotal}
          grandTotal={grandTotal}
          onOpenNewProductModal={(name) => {
            setModalSearch('');
            setNewName(name);
            setModalTab('new');
            setShowProductModal(true);
          }}
        />

        <PurchaseProductModal
          open={showProductModal}
          onClose={() => setShowProductModal(false)}
          purchaseItemsCount={purchaseItems.length}
          lastAddedNotice={lastAddedNotice}
          onClearNotice={() => setLastAddedNotice(null)}
          modalTab={modalTab}
          setModalTab={setModalTab}
          modalSearch={modalSearch}
          setModalSearch={setModalSearch}
          debouncedSearch={debouncedSearch}
          setDebouncedSearch={setDebouncedSearch}
          catalogProducts={catalogProducts}
          catalogTotal={catalogTotal}
          catalogLoading={catalogLoading}
          loadingMore={loadingMore}
          catalogPage={catalogPage}
          fetchCatalog={fetchCatalog}
          selectedProduct={selectedProduct}
          setSelectedProduct={setSelectedProduct}
          modalQty={modalQty}
          setModalQty={setModalQty}
          modalPrice={modalPrice}
          setModalPrice={setModalPrice}
          modalSalePrice={modalSalePrice}
          setModalSalePrice={setModalSalePrice}
          newName={newName}
          setNewName={setNewName}
          newSku={newSku}
          setNewSku={setNewSku}
          newBarcode={newBarcode}
          setNewBarcode={setNewBarcode}
          newCategory={newCategory}
          setNewCategory={setNewCategory}
          newUnit={newUnit}
          setNewUnit={setNewUnit}
          newTax={newTax}
          setNewTax={setNewTax}
          categories={categories}
          onAddProduct={handleAddProductToPurchase}
        />
      </>
    );
  }

  return (
    <AppLayout>
      <PurchasesListView
        tab={tab}
        setTab={setTab}
        purchasesList={purchasesList}
        returnsList={returnsList}
        loadingList={loadingList}
        search={search}
        setSearch={setSearch}
        filteredPurchases={filteredPurchases}
        onNewPurchase={() => {
          setInvoiceNumber(nextPurchaseInvoice());
          setPurchaseItems([]);
          setSupplierId('');
          setShowAddForm(true);
        }}
        onViewPurchase={(id) => void handleViewPurchase(id)}
        onAnularClick={(id) => setConfirmDeleteId(id)}
        onExportPdf={handleExportPdf}
      />

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
            className="btn-secondary flex-1 cursor-pointer"
            disabled={anulando}
            onClick={() => setConfirmDeleteId(null)}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="btn-primary flex-1 bg-rose-600 hover:bg-rose-700 text-white cursor-pointer"
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
