import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, UserPlus, Building2, Check, FileText } from 'lucide-react';
import { toast } from '@/lib/toast';
import { crearCliente } from '@/services/clientes.service';
import { validateRNC, type NCFType } from '@/lib/ncfStore';
import type { Customer } from './POSTerminal';

interface Props {
  onClose: () => void;
  onCreated: (customer: Customer) => void;
  defaultNcfType?: NCFType;
}

export default function PosAddCustomerModal({
  onClose,
  onCreated,
  defaultNcfType = 'B02',
}: Props) {
  const [name, setName] = useState('');
  const [rncCedula, setRncCedula] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [credit, setCredit] = useState('0');
  const [ncfType, setNcfType] = useState<NCFType>(defaultNcfType);
  const [saving, setSaving] = useState(false);

  // Auto-switch to B01 if user enters a 9 or 11 digit RNC
  const handleRncChange = (val: string) => {
    setRncCedula(val);
    const clean = val.replace(/\D/g, '');
    if (clean.length === 9 || clean.length === 11) {
      if (ncfType === 'B02') {
        setNcfType('B01');
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Ingresa el nombre o razón social del cliente');
      return;
    }

    const cleanRnc = rncCedula.trim().replace(/\D/g, '');
    if (ncfType === 'B01') {
      if (!cleanRnc) {
        toast.error('Para Factura con Crédito Fiscal (B01), se requiere el RNC o Cédula');
        return;
      }
      const val = validateRNC(cleanRnc);
      if (!val.valid) {
        toast.error(`RNC/Cédula no válido: ${val.message}`);
        return;
      }
    }

    setSaving(true);
    try {
      const created = await crearCliente({
        nombre: name.trim(),
        rnc_cedula: cleanRnc || rncCedula.trim() || undefined,
        telefono: phone.trim() || undefined,
        direccion: address.trim() || undefined,
        limite_credito: Number(credit) || 0,
        tipo_cliente: Number(credit) > 0 ? 'credito' : ncfType === 'B01' ? 'fiscal' : 'final',
      });

      const customer: Customer = {
        id: created.id,
        name: created.nombre,
        phone: created.telefono ?? '',
        credit: Number(created.limite_credito ?? 0),
        rnc_cedula: created.rnc_cedula ?? cleanRnc ?? null,
        direccion: created.direccion ?? address.trim() ?? null,
        tipo_cliente: created.tipo_cliente ?? 'final',
        tipo_ncf: ncfType,
      };

      toast.success(
        `Cliente "${customer.name}" registrado correctamente (${ncfType === 'B01' ? 'Crédito Fiscal B01' : 'Consumidor Final B02'})`
      );
      onCreated(customer);
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo crear el cliente');
    } finally {
      setSaving(false);
    }
  };

  const modalContent = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="card w-full max-w-lg p-6 sm:p-7 space-y-4 modal-panel shadow-2xl max-h-[95vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-border/80 pb-3">
          <div>
            <h3 className="font-extrabold text-foreground text-xl flex items-center gap-2">
              <UserPlus size={22} className="text-primary" />
              Nuevo Cliente POS
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Crea clientes para Facturas con Crédito Fiscal o Consumidor Final
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-secondary cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Tipo de Facturación / Comprobante */}
          <div>
            <label className="text-xs font-bold text-muted-foreground mb-1.5 block">
              Tipo de Factura / Comprobante Fiscal
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setNcfType('B02')}
                className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  ncfType === 'B02'
                    ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                    : 'bg-secondary/40 text-muted-foreground border-border hover:bg-secondary'
                }`}
              >
                <FileText size={15} />
                <span>Consumidor Final (B02)</span>
              </button>
              <button
                type="button"
                onClick={() => setNcfType('B01')}
                className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  ncfType === 'B01'
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                    : 'bg-secondary/40 text-muted-foreground border-border hover:bg-secondary'
                }`}
              >
                <Building2 size={15} />
                <span>Crédito Fiscal (B01)</span>
              </button>
            </div>
            {ncfType === 'B01' && (
              <p className="text-[11px] text-indigo-600 dark:text-indigo-400 mt-1 font-semibold flex items-center gap-1">
                <span>* Válido para crédito fiscal de ISR e ITBIS (Requiere RNC o Cédula)</span>
              </p>
            )}
          </div>

          {/* Nombre / Razón Social */}
          <div>
            <label className="text-xs font-bold text-muted-foreground mb-1 block">
              Nombre o Razón Social *
            </label>
            <input
              className="input-field h-10 text-sm"
              placeholder="Ej: Farmacia Los Prados o Juan Pérez"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>

          {/* RNC / Cédula */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-bold text-muted-foreground">
                RNC o Cédula {ncfType === 'B01' ? '*' : '(Opcional)'}
              </label>
              <span className="text-[10px] text-muted-foreground">RNC (9 dígitos) / Cédula (11 dígitos)</span>
            </div>
            <input
              className="input-field h-10 text-sm font-mono"
              placeholder="Ej: 131-45678-9 o 001-1234567-8"
              value={rncCedula}
              onChange={(e) => handleRncChange(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Teléfono */}
            <div>
              <label className="text-xs font-bold text-muted-foreground mb-1 block">Teléfono</label>
              <input
                className="input-field h-10 text-sm"
                placeholder="809-555-0100"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>

            {/* Límite de Crédito */}
            <div>
              <label className="text-xs font-bold text-muted-foreground mb-1 block">
                Límite de crédito (RD$)
              </label>
              <input
                className="input-field h-10 text-sm font-mono"
                type="number"
                min={0}
                value={credit}
                onChange={(e) => setCredit(e.target.value)}
              />
            </div>
          </div>

          {/* Dirección */}
          <div>
            <label className="text-xs font-bold text-muted-foreground mb-1 block">Dirección Fiscal / Ubicación</label>
            <input
              className="input-field h-10 text-sm"
              placeholder="Calle, número, sector o ciudad"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </div>

          <div className="pt-2 border-t border-border flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary text-xs py-2 px-4 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="btn-primary text-xs py-2 px-5 font-bold cursor-pointer"
              disabled={saving}
            >
              {saving ? 'Guardando…' : 'Crear y Seleccionar Cliente'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
}
