/** Tipos de base de datos Mercato (columnas en español) */

export type RolDb = 'admin' | 'super_admin' | 'cajero' | 'almacen' | 'contable' | 'vendedor' | (string & {});

export type EstadoProducto = 'activo' | 'inactivo' | 'descontinuado';
export type MetodoPago = 'efectivo' | 'tarjeta' | 'transferencia' | 'credito' | 'mixto';
export type EstadoVenta = 'completada' | 'reembolsada' | 'anulada';
export type TipoAjuste = 'entrada' | 'salida' | 'perdida';
export type TipoDescuento = 'fijo' | 'porcentaje' | 'monto';
export type TipoItemVenta = 'producto' | 'combo';
export type TipoCliente = 'final' | 'fiscal' | 'credito';
export type EstadoCaja = 'abierta' | 'cerrada';

export type SaleType = 'unit' | 'weight' | 'both';
export type WeightUnit = 'lb' | 'kg' | 'g' | 'oz';

export interface Perfil {
  id: string;
  nombre_completo: string;
  correo: string;
  telefono: string | null;
  rol: RolDb;
  sucursal_id: string | null;
  codigo_acceso: string | null;
  activo: boolean;
  creado_en?: string;
  actualizado_en?: string;
}

export interface Sucursal {
  id: string;
  codigo: string;
  nombre: string;
  direccion: string | null;
  telefono: string | null;
  rnc: string | null;
  activo: boolean;
}

export interface Producto {
  id: string;
  codigo_barras: string;
  sku: string;
  plu?: string | null;
  nombre: string;
  categoria: string;
  marca: string | null;
  unidad: string;
  proveedor_id: string | null;
  precio_costo: number;
  precio_venta: number;
  precio_mayorista: number;
  porcentaje_impuesto: number;
  stock_minimo: number;
  stock_actual: number;
  es_pesado: boolean;
  sale_type?: SaleType;
  weight_unit?: WeightUnit;
  price_per_weight?: number;
  allow_decimal?: boolean;
  min_weight?: number;
  max_weight?: number;
  generate_scale_barcode?: boolean;
  is_weight_product?: boolean;
  fecha_vencimiento: string | null;
  garantia: string | null;
  imagen_url: string | null;
  estado: EstadoProducto;
  creado_en?: string;
  actualizado_en?: string;
}

export interface Combo {
  id: string;
  codigo: string;
  codigo_barras: string | null;
  nombre: string;
  descripcion: string | null;
  categoria: string;
  precio_venta: number;
  precio_costo_total: number;
  precio_normal: number;
  tipo_descuento: TipoDescuento | null;
  valor_descuento: number;
  porcentaje_margen: number;
  activo: boolean;
  visible_en_pos: boolean;
  permitir_venta_sin_stock: boolean;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  imagen_url: string | null;
  creado_en?: string;
  actualizado_en?: string;
}

export interface ComboItem {
  id: string;
  combo_id: string;
  producto_id: string;
  cantidad: number;
  costo_unitario: number;
  precio_unitario: number;
  subtotal: number;
}

export interface Cliente {
  id: string;
  codigo: string;
  nombre: string;
  rnc_cedula: string | null;
  telefono: string | null;
  correo: string | null;
  direccion: string | null;
  tipo_cliente: TipoCliente;
  tipo_ncf?: string | null;
  grupo_id?: string | null;
  limite_credito: number;
  balance_actual: number;
  activo: boolean;
  creado_en?: string;
}

export interface Venta {
  id: string;
  numero_factura: string;
  ncf: string | null;
  tipo_ncf: string | null;
  sucursal_id: string | null;
  cajero_id: string | null;
  cliente_id: string | null;
  caja_id: string | null;
  subtotal: number;
  monto_impuesto: number;
  monto_descuento: number;
  monto_total: number;
  costo_total: number;
  metodo_pago: MetodoPago;
  monto_pagado: number;
  monto_efectivo: number;
  monto_tarjeta: number;
  monto_transferencia: number;
  monto_credito: number;
  devuelta_entregada: number;
  estado: EstadoVenta;
  creado_en: string;
}

export interface DetalleVenta {
  id: string;
  venta_id: string;
  producto_id: string | null;
  combo_id: string | null;
  tipo_item: TipoItemVenta;
  nombre_item: string;
  precio_unitario: number;
  costo_unitario: number;
  cantidad: number;
  porcentaje_impuesto: number;
  subtotal: number;
}

export interface AjusteStock {
  id: string;
  codigo: string;
  producto_id: string;
  tipo_ajuste: TipoAjuste;
  cantidad_anterior: number;
  cantidad_nueva: number;
  cantidad_variacion: number;
  motivo: string;
  responsable_id: string | null;
  creado_en: string;
  productos?: {
    id: string;
    nombre: string;
    sku: string;
    categoria?: string;
    unidad?: string;
  } | null;
}

export interface CierreCaja {
  id: string;
  codigo: string;
  caja_id: string;
  cajero_id: string | null;
  sucursal_id: string | null;
  monto_apertura: number;
  monto_esperado: number;
  monto_real: number;
  monto_diferencia: number;
  total_ventas: number;
  total_efectivo: number;
  total_tarjeta: number;
  total_transferencia: number;
  estado: EstadoCaja;
  abierta_en: string;
  cerrada_en: string | null;
}

export interface MetricasDashboard {
  periodo: string;
  desde: string;
  ventas_total: number;
  ventas_count: number;
  ticket_promedio: number;
  costo_total: number;
  ganancia_bruta: number;
  productos_stock_bajo: number;
  productos_activos: number;
}

export interface PaginacionParams {
  pagina?: number;
  limite?: number;
  busqueda?: string;
}

export const PRODUCTO_COLUMNS =
  'id, codigo_barras, sku, plu, nombre, categoria, marca, unidad, proveedor_id, precio_costo, precio_venta, precio_mayorista, porcentaje_impuesto, stock_minimo, stock_actual, es_pesado, sale_type, weight_unit, price_per_weight, allow_decimal, min_weight, max_weight, generate_scale_barcode, is_weight_product, fecha_vencimiento, garantia, imagen_url, estado, creado_en, actualizado_en' as const;

export const COMBO_COLUMNS =
  'id, codigo, codigo_barras, nombre, descripcion, categoria, precio_venta, precio_costo_total, precio_normal, tipo_descuento, valor_descuento, porcentaje_margen, activo, visible_en_pos, permitir_venta_sin_stock, fecha_inicio, fecha_fin, imagen_url, creado_en, actualizado_en' as const;

export const CLIENTE_COLUMNS =
  'id, codigo, nombre, rnc_cedula, telefono, correo, direccion, tipo_cliente, grupo_id, limite_credito, balance_actual, activo, creado_en' as const;

export const VENTA_COLUMNS =
  'id, numero_factura, ncf, tipo_ncf, sucursal_id, cajero_id, cliente_id, caja_id, subtotal, monto_impuesto, monto_descuento, monto_total, costo_total, metodo_pago, monto_pagado, monto_efectivo, monto_tarjeta, monto_transferencia, monto_credito, devuelta_entregada, estado, creado_en' as const;

export const AJUSTE_COLUMNS =
  'id, codigo, producto_id, tipo_ajuste, cantidad_anterior, cantidad_nueva, cantidad_variacion, motivo, responsable_id, creado_en' as const;

export const CIERRE_COLUMNS =
  'id, codigo, caja_id, cajero_id, sucursal_id, monto_apertura, monto_esperado, monto_real, monto_diferencia, total_ventas, total_efectivo, total_tarjeta, total_transferencia, estado, abierta_en, cerrada_en' as const;

export const PERFIL_COLUMNS =
  'id, nombre_completo, correo, telefono, rol, sucursal_id, codigo_acceso, activo, creado_en, actualizado_en' as const;

/* —— Extensiones ERP (migración 006) —— */

export type EstadoCompra = 'pendiente' | 'parcial' | 'recibida' | 'anulada';
export type EstadoDevolucion = 'pendiente' | 'aprobada' | 'rechazada';
export type EstadoCx = 'pendiente' | 'parcial' | 'vencida' | 'pagada' | 'anulada';
export type EstadoGasto = 'pendiente' | 'aprobado' | 'rechazado';
export type EstadoCotizacion = 'pendiente' | 'aprobada' | 'rechazada' | 'convertida' | 'vencida';
export type EstadoTransferencia = 'pendiente' | 'en_transito' | 'recibida' | 'anulada';
export type TipoMovimientoCaja = 'entrada' | 'salida' | 'gasto' | 'retiro' | 'aporte';

export interface Categoria {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
}

export interface GrupoCliente {
  id: string;
  codigo: string;
  nombre: string;
  porcentaje_descuento: number;
  descripcion: string | null;
  activo: boolean;
}

export interface ConfiguracionEmpresa {
  id: string;
  nombre_comercial: string;
  razon_social: string | null;
  rnc: string | null;
  telefono: string | null;
  correo: string | null;
  direccion: string | null;
  logo_url: string | null;
  moneda: string;
  itbis_porcentaje: number;
}

export interface Caja {
  id: string;
  codigo: string;
  nombre: string;
  descripcion?: string | null;
  sucursal_id?: string | null;
  es_caja_principal?: boolean;
  activa?: boolean;
  activo?: boolean;
  creado_en?: string;
  actualizado_en?: string;
}

export interface Compra {
  id: string;
  codigo: string;
  proveedor_id: string | null;
  sucursal_id: string | null;
  responsable_id: string | null;
  subtotal: number;
  monto_impuesto: number;
  monto_total: number;
  metodo_pago: string;
  estado: EstadoCompra;
  notas: string | null;
  creado_en: string;
  recibido_en: string | null;
}

export interface Devolucion {
  id: string;
  codigo: string;
  venta_id: string | null;
  numero_factura: string | null;
  cliente_id: string | null;
  cajero_id: string | null;
  monto_total: number;
  motivo: string;
  metodo_reembolso: string;
  tipo: 'parcial' | 'total';
  estado: EstadoDevolucion;
  creado_en: string;
}

export interface Cotizacion {
  id: string;
  codigo: string;
  cliente_id: string | null;
  vendedor_id: string | null;
  subtotal: number;
  monto_impuesto: number;
  monto_total: number;
  estado: EstadoCotizacion;
  valida_hasta: string | null;
  creado_en: string;
}

export interface CuentaPorCobrar {
  id: string;
  codigo: string;
  venta_id: string | null;
  numero_factura: string | null;
  cliente_id: string | null;
  monto_total: number;
  monto_pagado: number;
  saldo: number;
  fecha_emision: string;
  fecha_vencimiento: string;
  estado: EstadoCx;
  creado_en: string;
}

export interface CuentaPorPagar {
  id: string;
  codigo: string;
  compra_id: string | null;
  proveedor_id: string | null;
  monto_total: number;
  monto_pagado: number;
  saldo: number;
  fecha_emision: string;
  fecha_vencimiento: string;
  estado: EstadoCx;
  creado_en: string;
}

export interface Gasto {
  id: string;
  codigo: string;
  categoria_id: string | null;
  sucursal_id: string | null;
  descripcion: string;
  monto: number;
  responsable_id: string | null;
  tiene_recibo: boolean;
  recibo_url: string | null;
  estado: EstadoGasto;
  caja_id: string | null;
  creado_en: string;
}

export interface TransferenciaStock {
  id: string;
  codigo: string;
  sucursal_origen_id: string | null;
  sucursal_destino_id: string | null;
  responsable_id: string | null;
  estado: EstadoTransferencia;
  motivo: string | null;
  creado_en: string;
  recibido_en: string | null;
}

export interface MovimientoCaja {
  id: string;
  codigo: string;
  caja_id: string | null;
  cierre_id: string | null;
  cajero_id: string | null;
  tipo: TipoMovimientoCaja;
  monto: number;
  concepto: string;
  categoria: string | null;
  creado_en: string;
}

export interface VentaRetenida {
  id: string;
  etiqueta: string;
  cajero_id: string | null;
  caja_id: string | null;
  cliente_id: string | null;
  payload_carrito: unknown;
  descuento_global: number;
  creado_en: string;
}

export interface FacturaFiscal {
  id: string;
  venta_id: string | null;
  ncf: string;
  tipo_ncf: string;
  rnc_cliente: string | null;
  nombre_cliente: string | null;
  subtotal: number;
  itbis: number;
  monto_total: number;
  metodo_pago: string | null;
  cajero_id: string | null;
  items: unknown;
  emitida_en: string;
}

export interface Auditoria {
  id: string;
  usuario_id: string | null;
  nombre_usuario: string | null;
  rol: string | null;
  accion: string;
  modulo: string;
  detalle: string | null;
  datos_antes: unknown;
  datos_despues: unknown;
  ip: string | null;
  creado_en: string;
}

export interface AgenteComercial {
  id: string;
  perfil_id: string | null;
  nombre: string;
  correo: string | null;
  telefono: string | null;
  porcentaje_comision: number;
  activo: boolean;
  creado_en?: string;
}

export const COMPRA_COLUMNS =
  'id, codigo, proveedor_id, sucursal_id, responsable_id, subtotal, monto_impuesto, monto_total, metodo_pago, estado, notas, creado_en, recibido_en' as const;

export const DEVOLUCION_COLUMNS =
  'id, codigo, venta_id, numero_factura, cliente_id, cajero_id, monto_total, motivo, metodo_reembolso, tipo, estado, creado_en' as const;

export const CXC_COLUMNS =
  'id, codigo, venta_id, numero_factura, cliente_id, monto_total, monto_pagado, saldo, fecha_emision, fecha_vencimiento, estado, creado_en' as const;

export const CXP_COLUMNS =
  'id, codigo, compra_id, proveedor_id, monto_total, monto_pagado, saldo, fecha_emision, fecha_vencimiento, estado, creado_en' as const;

export const GASTO_COLUMNS =
  'id, codigo, categoria_id, sucursal_id, descripcion, monto, responsable_id, tiene_recibo, recibo_url, estado, caja_id, creado_en' as const;

export const AUDITORIA_COLUMNS =
  'id, usuario_id, nombre_usuario, rol, accion, modulo, detalle, datos_antes, datos_despues, ip, creado_en' as const;

export const AGENTE_COLUMNS =
  'id, perfil_id, nombre, correo, telefono, porcentaje_comision, activo, creado_en' as const;

export interface Rol {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  permisos: Record<string, Record<string, boolean>>;
  creado_en?: string;
  actualizado_en?: string;
}

export const ROL_COLUMNS =
  'id, codigo, nombre, descripcion, permisos, creado_en, actualizado_en' as const;

export const CAJA_COLUMNS =
  'id, codigo, nombre, descripcion, sucursal_id, es_caja_principal, activa, creado_en, actualizado_en' as const;

