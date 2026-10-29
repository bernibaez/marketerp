import React, { useEffect, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import { Trash2 } from 'lucide-react';
import { exportTableToPdf, formatMoneyPdf } from '@/lib/exportPdf';
import { useProveedores } from '@/hooks/useProveedores';
import { crearCompra, obtenerCompras, obtenerDetalleCompra, anularCompra, type CompraDetalle } from '@/services/compras.service';
import { toast } from '@/lib/toast';
import ModalShell from '@/components/ui/ModalShell';
import { PurchaseDetailView } from './purchases/components/PurchaseDetailView';
import { PurchaseProductModal } from './purchases/components/PurchaseProductModal';
import { PurchaseCreateView } from './purchases/components/PurchaseCreateView';
import { PurchasesListView, type Purchase, type ReturnItem } from './purchases/components/PurchasesListView';
import { usePurchaseItems } from './purchases/hooks/usePurchaseItems';
import { usePurchaseCatalog } from './purchases/hooks/usePurchaseCatalog';

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
  const { proveedores, refetch: reloadProveedores } = useProveedores();

  const [viewingPurchase, setViewingPurchase] = useState<CompraDetalle | null>(null);
  const [loadingPurchaseDetail, setLoadingPurchaseDetail] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [anulando, setAnulando] = useState(false);

  // Hook for purchase line items and totals
  const {
    purchaseItems,
    setPurchaseItems,
    subtotal,
    taxTotal,
    grandTotal,
    handleUpdateLineQty,
    handleUpdateLinePrice,
    handleUpdateLineSalePrice,
    handleUpdateLineWholesalePrice,
    handleRemoveLine,
    addProductDirectlyToPurchase,
    clearItems,
  } = usePurchaseItems();

  // Hook for catalog search, debouncing, and inline lookup
  const {
    showProductModal,
    setShowProductModal,
    modalTab,
    setModalTab,
    modalSearch,
    setModalSearch,
    debouncedSearch,
    setDebouncedSearch,
    catalogProducts,
    catalogTotal,
    catalogPage,
    catalogLoading,
    loadingMore,
    fetchCatalog,
    selectedProduct,
    setSelectedProduct,
    modalQty,
    setModalQty,
    modalPrice,
    setModalPrice,
    modalSalePrice,
    setModalSalePrice,
    modalWholesalePrice,
    setModalWholesalePrice,
    lastAddedNotice,
    setLastAddedNotice,
    newName,
    setNewName,
    newSku,
    setNewSku,
    newBarcode,
    setNewBarcode,
    newCategory,
    setNewCategory,
    newUnit,
    setNewUnit,
    newTax,
    setNewTax,
    categories,
    resetModalForm,
    inlineSearch,
    setInlineSearch,
    inlineResults,
    inlineLoading,
    inlineOpen,
    setInlineOpen,
    inlineHighlightIndex,
    setInlineHighlightIndex,
    inlineSearchRef,
    inlineDropdownRef,
    handleInlineKeyDown,
    handleSelectInlineProduct,
    handleAddProductToPurchase,
  } = usePurchaseCatalog({
    onAddProductDirectly: addProductDirectlyToPurchase,
  });

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
          precio_mayorista: item.wholesalePrice,
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
      clearItems();
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
          onSupplierCreated={() => void reloadProveedores()}
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
          onUpdateLineWholesalePrice={handleUpdateLineWholesalePrice}
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
          modalWholesalePrice={modalWholesalePrice}
          setModalWholesalePrice={setModalWholesalePrice}
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
