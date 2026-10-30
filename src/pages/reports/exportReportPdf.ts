import { exportTableToPdf, formatMoneyPdf } from '@/lib/exportPdf';
import {
  informeVentas,
  informeGananciasPerdidas,
  informeCompras,
  informeInventario,
  informeStockDetalle,
  informeAjustes,
  informeGastos,
  informeClientes,
  informeProveedores,
  informeAgentes,
  informeFiscal,
  informeCaja,
  informeGananciasProducto,
  informeCombos,
  obtenerInformeStockGeneral,
} from '@/services/informes.service';

type ReportId =
  | 'profit-loss'
  | 'product-profit'
  | 'combos'
  | 'sales'
  | 'purchases'
  | 'stock'
  | 'stock-detail'
  | 'adjustments'
  | 'expenses'
  | 'customers'
  | 'suppliers'
  | 'agents'
  | 'fiscal'
  | 'cashier';

function stockEstado(stock: number, min: number) {
  if (stock <= 0) return 'Agotado';
  if (stock <= min) return 'Bajo';
  return 'OK';
}

export async function exportReportPdf(
  reportId: ReportId,
  label: string,
  dateFrom: string,
  dateTo: string
) {
  const subtitle = `Periodo: ${dateFrom} — ${dateTo}`;
  const periodo = { desde: dateFrom, hasta: dateTo };

  switch (reportId) {
    case 'profit-loss': {
      const d = await informeGananciasPerdidas(periodo);
      exportTableToPdf({
        title: label,
        subtitle,
        filename: `informe-ganancias-${dateFrom}-${dateTo}`,
        headers: ['Concepto', 'Monto'],
        rows: [
          ['Ventas', formatMoneyPdf(d.ventas)],
          ['Costo', formatMoneyPdf(d.costo)],
          ['Ganancia bruta', formatMoneyPdf(d.gananciaBruta)],
          ['ITBIS', formatMoneyPdf(d.itbis)],
          ['Ganancia neta', formatMoneyPdf(d.gananciaNeta)],
          ['Unidades vendidas', String(d.qtySold)],
          ['Productos distintos', String(d.prodsSold)],
          ['Clientes', String(d.customers)],
        ],
      });
      break;
    }
    case 'sales': {
      const d = await informeVentas(periodo);
      exportTableToPdf({
        title: label,
        subtitle,
        filename: `informe-ventas-${dateFrom}-${dateTo}`,
        headers: ['Factura', 'Fecha', 'Cliente', 'Ítems', 'Pago', 'Agente', 'Total'],
        rows: d.rows.map((r) => r.map(String)),
        landscape: true,
      });
      break;
    }
    case 'purchases': {
      const d = await informeCompras(periodo);
      exportTableToPdf({
        title: label,
        subtitle,
        filename: `informe-compras-${dateFrom}-${dateTo}`,
        headers: ['Orden', 'Fecha', 'Proveedor', 'Estado', 'Ítems', 'Total'],
        rows: d.rows.map((r) => r.map(String)),
      });
      break;
    }
    case 'stock': {
      const d = await informeInventario();
      exportTableToPdf({
        title: label,
        subtitle,
        filename: `informe-inventario-${dateFrom}-${dateTo}`,
        headers: ['SKU', 'Producto', 'Categoría', 'Stock', 'Mín.', 'Valor', 'Estado'],
        rows: d.rows.map((r) => r.map(String)),
      });
      break;
    }
    case 'stock-detail': {
      const d = await obtenerInformeStockGeneral();
      exportTableToPdf({
        title: 'Informe de Stock y Valoración',
        subtitle: `Stock Cierre (Compra): ${formatMoneyPdf(d.stock_cierre_compra)} | Venta: ${formatMoneyPdf(d.stock_cierre_venta)} | Margen: ${d.profit_margin_pct.toFixed(2)}%`,
        filename: `informe-stock-general-${dateFrom}-${dateTo}`,
        headers: ['SKU', 'Producto', 'Categoría', 'Ubicación', 'Precio Venta', 'Stock Actual', 'Valor Compra', 'Valor Venta'],
        rows: d.items.map((p) => [
          p.sku || '-',
          p.nombre,
          p.categoria,
          p.ubicacion,
          formatMoneyPdf(p.precio_venta),
          `${p.stock_actual.toFixed(2)} ${p.unidad}`,
          formatMoneyPdf(p.valor_compra),
          formatMoneyPdf(p.valor_venta),
        ]),
        landscape: true,
      });
      break;
    }
    case 'adjustments': {
      const d = await informeAjustes(periodo);
      exportTableToPdf({
        title: label,
        subtitle,
        filename: `informe-ajustes-${dateFrom}-${dateTo}`,
        headers: ['Código', 'Fecha', 'Producto', 'SKU', 'Anterior', 'Nueva', 'Dif.', 'Motivo'],
        rows: d.rows.map((a) => {
          const diff = a.newQty - a.previousQty;
          return [
            a.code,
            a.date,
            a.productName,
            a.sku,
            String(a.previousQty),
            String(a.newQty),
            diff >= 0 ? `+${diff}` : String(diff),
            a.reason,
          ];
        }),
        landscape: true,
      });
      break;
    }
    case 'expenses': {
      const d = await informeGastos(periodo);
      exportTableToPdf({
        title: label,
        subtitle,
        filename: `informe-gastos-${dateFrom}-${dateTo}`,
        headers: ['Código', 'Fecha', 'Categoría', 'Descripción', 'Monto', 'Estado'],
        rows: d.rows.map((r) => r.map(String)),
        landscape: true,
      });
      break;
    }
    case 'customers': {
      const d = await informeClientes(periodo);
      exportTableToPdf({
        title: label,
        subtitle,
        filename: `informe-clientes-${dateFrom}-${dateTo}`,
        headers: ['Código', 'Cliente', 'Teléfono', 'Saldo', 'Total periodo'],
        rows: d.rows.map((r) => r.map(String)),
        landscape: true,
      });
      break;
    }
    case 'suppliers': {
      const d = await informeProveedores(periodo);
      exportTableToPdf({
        title: label,
        subtitle,
        filename: `informe-proveedores-${dateFrom}-${dateTo}`,
        headers: ['Código', 'Proveedor', 'Teléfono', 'Estado'],
        rows: d.rows.map((r) => r.map(String)),
        landscape: true,
      });
      break;
    }
    case 'agents': {
      const d = await informeAgentes();
      exportTableToPdf({
        title: label,
        subtitle,
        filename: `informe-agentes-${dateFrom}-${dateTo}`,
        headers: ['Agente', 'Correo', 'Teléfono', 'Comisión %', 'Estado'],
        rows: d.rows.map((r) => r.map(String)),
      });
      break;
    }
    case 'fiscal': {
      const d = await informeFiscal(periodo);
      exportTableToPdf({
        title: label,
        subtitle,
        filename: `informe-fiscal-dgii-${dateFrom}-${dateTo}`,
        headers: ['NCF', 'Tipo', 'Fecha', 'Cliente', 'RNC', 'Monto'],
        rows: d.ncfRows.map((r) => r.map(String)),
      });
      break;
    }
    case 'cashier': {
      const d = await informeCaja(periodo);
      exportTableToPdf({
        title: label,
        subtitle,
        filename: `informe-caja-${dateFrom}-${dateTo}`,
        headers: ['Sesión', 'Apertura', 'Caja', 'Ventas', 'Efectivo', 'Esperado', 'Contado', 'Dif.'],
        rows: d.sessions.map((r) => r.map(String)),
        landscape: true,
      });
      break;
    }
    case 'product-profit': {
      const items = await informeGananciasProducto(periodo);
      exportTableToPdf({
        title: label,
        subtitle,
        filename: `informe-ganancias-producto-${dateFrom}-${dateTo}`,
        headers: ['SKU', 'Producto', 'Categoría', 'Cant.', 'Costo', 'Venta', 'Ganancia', 'Margen %'],
        rows: items.map((p) => [
          p.sku,
          p.name,
          p.category,
          String(p.qty),
          formatMoneyPdf(p.totalCost),
          formatMoneyPdf(p.totalSales),
          formatMoneyPdf(p.profit),
          `${p.margin.toFixed(1)}%`,
        ]),
        landscape: true,
      });
      break;
    }
    case 'combos': {
      const d = await informeCombos(periodo);
      exportTableToPdf({
        title: label,
        subtitle,
        filename: `informe-combos-${dateFrom}-${dateTo}`,
        headers: ['Código', 'Nombre', 'Estado', 'Vendidos', 'Precio', 'Ingreso'],
        rows: d.rows.map((r) => r.map(String)),
      });
      break;
    }
    default:
      exportTableToPdf({
        title: label,
        subtitle,
        filename: `informe-${dateFrom}-${dateTo}`,
        headers: ['Concepto', 'Valor'],
        rows: [['Sin datos específicos', '—']],
      });
  }
}
