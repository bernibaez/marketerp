import React, { useState } from 'react';
import AppLayout from '@/components/AppLayout';
import { Plus, Download, Monitor, Star, Search, ShieldCheck, X, Lock, User } from 'lucide-react';
import { toast } from '@/lib/toast';
import { useCajas } from '@/hooks/useCajas';
import { useCashRegisters } from '@/hooks/useCashRegisters';
import type { CashRegisterSession } from '@/lib/cashRegisters';
import { sugerirSiguienteCodigoCaja } from '@/services/cajas.service';
import { exportTableToPdf } from '@/lib/exportPdf';
import type { Caja } from '@/types/database';
import PosCashCloseModal from '@/pages/point-of-sale-pos/components/PosCashCloseModal';
import { CajaFormCard, type CajaFormData } from './cajas/components/CajaFormCard';
import { CajasTable } from './cajas/components/CajasTable';

const emptyForm: CajaFormData = {
  codigo: '',
  nombre: '',
  descripcion: '',
  es_caja_principal: false,
  activa: true,
};

export default function CajasPage() {
  const [busqueda, setBusqueda] = useState('');
  const { cajas, loading, crearCaja, actualizarCaja, eliminarCaja, alternarActivaCaja } = useCajas({
    busqueda,
  });
  const { registers, refetch: refetchRegisters } = useCashRegisters();

  const [showForm, setShowForm] = useState(false);
  const [editingCaja, setEditingCaja] = useState<Caja | null>(null);
  const [form, setForm] = useState<CajaFormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [closingSession, setClosingSession] = useState<CashRegisterSession | null>(null);

  const isActiva = (c: Caja) => c.activa ?? c.activo ?? true;
  const isPrincipal = (c: Caja) => c.es_caja_principal ?? false;
  const openRegisters = registers.filter((r) => r.open);

  const openCreate = async () => {
    setEditingCaja(null);
    try {
      const nextCode = await sugerirSiguienteCodigoCaja();
      setForm({
        codigo: nextCode,
        nombre: `Caja #${nextCode} - `,
        descripcion: '',
        es_caja_principal: cajas.length === 0,
        activa: true,
      });
    } catch {
      const usados = new Set(cajas.map((c) => c.codigo.trim()));
      let nextNum = 1;
      while (usados.has(String(nextNum))) nextNum += 1;
      setForm({
        codigo: String(nextNum),
        nombre: `Caja #${nextNum} - `,
        descripcion: '',
        es_caja_principal: cajas.length === 0,
        activa: true,
      });
    }
    setShowForm(true);
  };

  const openEdit = (caja: Caja) => {
    setEditingCaja(caja);
    setForm({
      codigo: caja.codigo,
      nombre: caja.nombre,
      descripcion: caja.descripcion || '',
      es_caja_principal: caja.es_caja_principal ?? false,
      activa: caja.activa ?? caja.activo ?? true,
    });
    setShowForm(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.codigo.trim() || !form.nombre.trim()) {
      toast.error('Ingresa el código y el nombre de la caja registradora');
      return;
    }

    setSaving(true);
    try {
      if (editingCaja) {
        await actualizarCaja(editingCaja.id, {
          codigo: form.codigo.trim(),
          nombre: form.nombre.trim(),
          descripcion: form.descripcion.trim() || null,
          es_caja_principal: form.es_caja_principal,
          activa: form.activa,
        });
        toast.success('Caja registradora actualizada exitosamente');
      } else {
        await crearCaja({
          codigo: form.codigo.trim(),
          nombre: form.nombre.trim(),
          descripcion: form.descripcion.trim() || null,
          es_caja_principal: form.es_caja_principal,
          activa: form.activa,
        });
        toast.success('Nueva caja registradora agregada exitosamente');
      }
      setShowForm(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al guardar caja');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (caja: Caja) => {
    try {
      const activeState = isActiva(caja);
      await alternarActivaCaja(caja.id, !activeState);
      toast.success(`Caja ${caja.nombre} ${!activeState ? 'activada' : 'desactivada'}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al cambiar estado');
    }
  };

  const handleDelete = async (caja: Caja) => {
    if (!confirm(`¿Eliminar la caja "${caja.nombre}"?`)) return;
    try {
      await eliminarCaja(caja.id);
      toast.success('Caja eliminada');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al eliminar');
    }
  };

  const handleExportPdf = () => {
    exportTableToPdf({
      title: 'Gestión de Cajas Registradoras',
      filename: 'cajas_registradoras',
      headers: ['Código', 'Nombre', 'Cajero en Turno', 'Principal', 'Estado'],
      rows: cajas.map((c) => {
        const openReg = registers.find(
          (r) =>
            r.open &&
            (String(r.dbId) === String(c.id) ||
              String(r.id) === String(c.codigo) ||
              String(r.codigo) === String(c.codigo))
        );
        return [
          c.codigo,
          c.nombre,
          openReg ? `En Turno: ${openReg.cashier}` : 'Cerrada / Disponible',
          isPrincipal(c) ? 'Sí' : 'No',
          isActiva(c) ? 'Activa' : 'Inactiva',
        ];
      }),
    });
  };

  return (
    <AppLayout>
      <div className="space-y-6 slide-up">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2.5">
              <Monitor size={26} className="text-primary" />
              <span>Gestión de Cajas Registradoras</span>
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Supervisa cajeros con turno activo, cierra cajas abiertas y administra las terminales POS
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleExportPdf}
              className="btn-secondary flex items-center gap-2"
            >
              <Download size={16} />
              Exportar PDF
            </button>
            <button
              type="button"
              onClick={() => {
                if (showForm) {
                  setShowForm(false);
                } else {
                  void openCreate();
                }
              }}
              className="btn-primary flex items-center gap-2 shadow-xs"
            >
              {showForm ? <X size={16} /> : <Plus size={16} />}
              <span>{showForm ? 'Cerrar Formulario' : 'Nueva Caja'}</span>
            </button>
          </div>
        </div>

        {/* Formulario */}
        {showForm && (
          <CajaFormCard
            editingCaja={editingCaja}
            form={form}
            setForm={setForm}
            saving={saving}
            onSave={handleSave}
            onClose={() => setShowForm(false)}
          />
        )}

        {/* Metrics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="card p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
              <Monitor size={20} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Total Cajas Registradas</p>
              <p className="text-2xl font-black text-foreground">{cajas.length}</p>
            </div>
          </div>

          <div className="card p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold">
              <User size={20} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Cajas Abiertas (En Turno)</p>
              <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                {openRegisters.length}
              </p>
            </div>
          </div>

          <div className="card p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center font-bold">
              <ShieldCheck size={20} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Cajas Habilitadas</p>
              <p className="text-2xl font-black text-indigo-600 dark:text-indigo-400">
                {cajas.filter(isActiva).length}
              </p>
            </div>
          </div>

          <div className="card p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold">
              <Star size={20} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Caja Principal</p>
              <p className="text-sm font-bold text-foreground truncate">
                {cajas.find(isPrincipal)?.nombre || 'Sin asignar'}
              </p>
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <div className="card p-4">
          <div className="relative">
            <Search
              size={18}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por código o nombre de caja registradora..."
              className="input-field pl-10"
            />
          </div>
        </div>

        {/* Cajas Table */}
        <CajasTable
          cajas={cajas}
          registers={registers}
          loading={loading}
          onToggle={handleToggle}
          onEdit={openEdit}
          onDelete={handleDelete}
          onCloseRegister={(reg) => setClosingSession(reg)}
        />

        {closingSession && (
          <PosCashCloseModal
            initialCajaId={closingSession.dbId || closingSession.id}
            initialCierreId={closingSession.cierreId}
            onSuccess={() => {
              void refetchRegisters();
              setClosingSession(null);
            }}
            onClose={() => setClosingSession(null)}
          />
        )}
      </div>
    </AppLayout>
  );
}
