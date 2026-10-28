import { useState, useEffect } from 'react';
import { toast } from '@/lib/toast';
import { obtenerClientes } from '@/services/clientes.service';
import { obtenerProductos } from '@/services/productos.service';
import { obtenerDetalleCotizacion, type CotizacionConDetalle } from '@/services/cotizaciones.service';
import type { Cliente, Producto, MetodoPago, EstadoVenta } from '@/types/database';
import type { VentaConDetalle } from '@/services/ventas.service';

interface UseSalesModalsOptions {
  canEditSales: boolean;
  canDeleteSales: boolean;
  obtenerDetalle: (id: string) => Promise<VentaConDetalle | null>;
  anular: (id: string, motivo: string) => Promise<void>;
  actualizar: (id: string, data: {
    cliente_id: string | null;
    metodo_pago: MetodoPago;
    tipo_ncf: string | null;
    ncf: string | null;
    monto_descuento: number;
    monto_total?: number;
    estado: EstadoVenta;
  }) => Promise<void>;
  convertirAVenta: (id: string, metodoPago: MetodoPago) => Promise<{ numero_factura: string }>;
}

export function useSalesModals({
  canEditSales,
  canDeleteSales,
  obtenerDetalle,
  anular,
  actualizar,
  convertirAVenta,
}: UseSalesModalsOptions) {
  // DB Data for creation modals
  const [dbClientes, setDbClientes] = useState<Cliente[]>([]);
  const [dbProductos, setDbProductos] = useState<Producto[]>([]);

  useEffect(() => {
    let active = true;
    obtenerClientes({ limite: 100 }).then((res) => {
      if (active) setDbClientes(res.datos);
    });
    obtenerProductos({ limite: 100 }).then((res) => {
      if (active) setDbProductos(res.datos);
    });
    return () => {
      active = false;
    };
  }, []);

  // Creation views
  const [showAddSaleForm, setShowAddSaleForm] = useState(false);
  const [showAddQuoteForm, setShowAddQuoteForm] = useState(false);

  // Sale detail
  const [viewingSale, setViewingSale] = useState<VentaConDetalle | null>(null);
  const [loadingSaleDetail, setLoadingSaleDetail] = useState(false);

  const handleOpenSaleDetail = async (v: VentaConDetalle) => {
    setViewingSale(v);
    setLoadingSaleDetail(true);
    try {
      const full = await obtenerDetalle(v.id);
      if (full) setViewingSale(full);
    } catch {
      // Keep initial summary
    } finally {
      setLoadingSaleDetail(false);
    }
  };

  // Sale anular
  const [anulandoSale, setAnulandoSale] = useState<VentaConDetalle | null>(null);
  const [anularMotivo, setAnularMotivo] = useState('Anulación por error de facturación');

  const handleConfirmAnular = async () => {
    if (!anulandoSale) return;
    if (!canDeleteSales) {
      toast.error('Solo un administrador puede anular o eliminar facturas');
      return;
    }
    try {
      await anular(anulandoSale.id, anularMotivo);
      toast.success(`Factura ${anulandoSale.numero_factura} anulada exitosamente`);
      setAnulandoSale(null);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error al anular la venta');
    }
  };

  // Sale edit
  const [editingSale, setEditingSale] = useState<VentaConDetalle | null>(null);

  const handleSaveEditSale = async (data: {
    cliente_id: string | null;
    metodo_pago: MetodoPago;
    tipo_ncf: string | null;
    ncf: string | null;
    monto_descuento: number;
    monto_total?: number;
    estado: string;
  }) => {
    if (!editingSale) return;
    if (!canEditSales) {
      toast.error('Solo un administrador puede editar facturas');
      return;
    }
    try {
      await actualizar(editingSale.id, {
        cliente_id: data.cliente_id,
        metodo_pago: data.metodo_pago,
        tipo_ncf: data.tipo_ncf,
        ncf: data.ncf,
        monto_descuento: data.monto_descuento,
        monto_total: data.monto_total,
        estado: data.estado as EstadoVenta,
      });
      toast.success(`Factura ${editingSale.numero_factura} actualizada exitosamente`);
      setEditingSale(null);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error al actualizar la factura');
    }
  };

  // Sale print
  const [printingSale, setPrintingSale] = useState<VentaConDetalle | null>(null);
  const [loadingPrintDetail, setLoadingPrintDetail] = useState(false);

  const handleOpenPrintSale = async (s: VentaConDetalle) => {
    setPrintingSale(s);
    setLoadingPrintDetail(true);
    try {
      const full = await obtenerDetalle(s.id);
      if (full) setPrintingSale(full);
    } catch {
      // Keep summary
    } finally {
      setLoadingPrintDetail(false);
    }
  };

  // Quote detail & conversion
  const [viewingQuote, setViewingQuote] = useState<CotizacionConDetalle | null>(null);
  const [loadingQuoteDetail, setLoadingQuoteDetail] = useState(false);
  const [convertQuote, setConvertQuote] = useState<CotizacionConDetalle | null>(null);

  const handleOpenQuoteDetail = async (q: CotizacionConDetalle) => {
    setViewingQuote(q);
    setLoadingQuoteDetail(true);
    try {
      const full = await obtenerDetalleCotizacion(q.id);
      if (full) setViewingQuote(full);
    } catch {
      // Keep list summary
    } finally {
      setLoadingQuoteDetail(false);
    }
  };

  const handleConfirmConvertQuote = async (paymentMethod: MetodoPago) => {
    if (!convertQuote) return;
    try {
      const res = await convertirAVenta(convertQuote.id, paymentMethod);
      toast.success(`Cotización convertida a factura: ${res.numero_factura}`);
      setConvertQuote(null);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error al convertir la cotización');
    }
  };

  // Returns
  const [creatingReturn, setCreatingReturn] = useState(false);
  const [returnSale, setReturnSale] = useState<VentaConDetalle | null>(null);

  return {
    dbClientes,
    dbProductos,
    showAddSaleForm,
    setShowAddSaleForm,
    showAddQuoteForm,
    setShowAddQuoteForm,
    viewingSale,
    setViewingSale,
    loadingSaleDetail,
    handleOpenSaleDetail,
    anulandoSale,
    setAnulandoSale,
    anularMotivo,
    setAnularMotivo,
    handleConfirmAnular,
    editingSale,
    setEditingSale,
    handleSaveEditSale,
    printingSale,
    setPrintingSale,
    loadingPrintDetail,
    handleOpenPrintSale,
    viewingQuote,
    setViewingQuote,
    loadingQuoteDetail,
    handleOpenQuoteDetail,
    convertQuote,
    setConvertQuote,
    handleConfirmConvertQuote,
    creatingReturn,
    setCreatingReturn,
    returnSale,
    setReturnSale,
  };
}
