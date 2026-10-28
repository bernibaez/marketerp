import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { CASH_REGISTERS, type CashRegisterId, type CashRegisterSession } from '@/lib/cashRegisters';
import { getCashClosures } from '@/lib/cashClosureStore';
import { obtenerCierresCaja } from '@/services/cierresCaja.service';
import { obtenerUsuarios } from '@/services/usuarios.service';
import { obtenerCajas } from '@/services/cajas.service';
import { obtenerHistorialVentas, rememberCajeroNombre } from '@/services/ventas.service';
import { ROL_DB_A_UI } from '@/services/auth.service';
import type { CierreCaja, Perfil } from '@/types/database';

export function useCashRegisters() {
  const { user } = useAuth();
  const [registers, setRegisters] = useState<CashRegisterSession[]>(() =>
    CASH_REGISTERS.map((r) => ({ ...r, open: false, openedAt: '—' }))
  );
  const [dbUsers, setDbUsers] = useState<Perfil[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDynamicRegisters = useCallback(async () => {
    setLoading(true);
    try {
      const todayStr = new Date().toISOString().slice(0, 10);
      const [usuarios, cierres, cajasDb, ventasHoyRes] = await Promise.all([
        obtenerUsuarios().catch(() => []),
        obtenerCierresCaja().catch(() => []),
        obtenerCajas({ soloActivas: true }).catch(() => []),
        obtenerHistorialVentas({
          pagina: 1,
          limite: 500,
          fechaInicio: todayStr,
          excluirAnuladas: true,
        }).catch(() => ({ datos: [], total: 0 })),
      ]);

      setDbUsers(usuarios);
      for (const u of usuarios) {
        if (u.id && u.nombre_completo) {
          rememberCajeroNombre(u.id, u.nombre_completo);
        }
      }

      const ventasHoy = ventasHoyRes.datos || [];
      const localClosures = getCashClosures();
      const abiertas = cierres.filter((c) => String(c.estado).toLowerCase() === 'abierta');

      const baseCajasList = cajasDb.length > 0 ? cajasDb : CASH_REGISTERS.map((r) => ({
        id: r.id,
        codigo: r.id,
        nombre: r.label,
        es_caja_principal: r.isAdminBox ?? false,
        activa: true,
      }));

      const nextRegisters: CashRegisterSession[] = baseCajasList.map((caja) => {
        const dbId = String(caja.id);
        const codigo = String(caja.codigo || caja.id);
        const cajaId = codigo as CashRegisterId;
        const keys = new Set(
          [
            dbId,
            codigo,
            cajaId,
            caja.nombre,
            `Caja #${codigo}`,
            `Caja ${codigo}`,
            `caja-${codigo}`,
          ]
            .filter(Boolean)
            .map(String)
        );
        const sessionAbierta = abiertas.find((c) => keys.has(String(c.caja_id)));
        const isAdminBox = Boolean(caja.es_caja_principal);
        const ids = { dbId, codigo };

        if (sessionAbierta) {
          const matchedUser = usuarios.find((u) => u.id === sessionAbierta.cajero_id);
          const localClosure = localClosures.find((lc) => lc.id === sessionAbierta.id);
          const rawCajeroNombre = (sessionAbierta as CierreCaja & { cajero_nombre?: string })?.cajero_nombre;

          const openTime = sessionAbierta.abierta_en
            ? new Date(sessionAbierta.abierta_en).getTime()
            : 0;

          const ventasTurno = ventasHoy.filter((v) => {
            const matchesBox = keys.has(String(v.caja_id ?? ''));
            const matchesCashierWithoutBox =
              !v.caja_id &&
              sessionAbierta.cajero_id &&
              String(v.cajero_id ?? '') === String(sessionAbierta.cajero_id);
            if (!matchesBox && !matchesCashierWithoutBox) return false;
            if (openTime > 0 && v.creado_en) {
              const vt = new Date(v.creado_en).getTime();
              if (!isNaN(vt) && vt < openTime - 10_000) return false;
            }
            return true;
          });

          const computedSales = Math.round(
            ventasTurno.reduce((sum, v) => sum + Number(v.monto_total || 0), 0) * 100
          ) / 100;
          const salesToday =
            computedSales > 0 ? computedSales : Number(sessionAbierta.total_ventas || 0);
          const ticketsCount = ventasTurno.length;

          const ventaCajeroNombre = ventasTurno.find(
            (v) => v.cajero_nombre && v.cajero_nombre !== 'No especificado' && v.cajero_nombre !== 'Cajero'
          )?.cajero_nombre;

          const cashierName =
            matchedUser?.nombre_completo ||
            rawCajeroNombre ||
            localClosure?.userName ||
            ventaCajeroNombre ||
            (sessionAbierta.cajero_id && user?.id === sessionAbierta.cajero_id ? user?.name : undefined) ||
            'Cajero Activo';

          if (sessionAbierta.cajero_id && cashierName) {
            rememberCajeroNombre(sessionAbierta.cajero_id, cashierName);
          }

          const userRole = matchedUser
            ? ROL_DB_A_UI[matchedUser.rol] || 'Cajero'
            : sessionAbierta.cajero_id && user?.id === sessionAbierta.cajero_id
              ? user?.role || 'Cajero'
              : isAdminBox
                ? 'Administrador General'
                : 'Cajero';

          const horaApertura = sessionAbierta.abierta_en
            ? new Date(sessionAbierta.abierta_en).toLocaleTimeString('es-DO', {
                hour: '2-digit',
                minute: '2-digit',
              })
            : 'Hoy';

          return {
            id: cajaId,
            ...ids,
            label: caja.nombre,
            cashier: cashierName,
            cashierId: sessionAbierta.cajero_id || undefined,
            cierreId: sessionAbierta.id,
            role: userRole,
            isAdminBox,
            open: true,
            openedAt: horaApertura,
            salesToday,
            tickets: ticketsCount,
            cartItems: 0,
            currentTotal: 0,
            movements: [],
          };
        }

        // Para cajas cerradas, calcular también las ventas realizadas hoy en esa caja
        const ventasCajaHoy = ventasHoy.filter((v) => keys.has(String(v.caja_id ?? '')));
        const salesTodayClosed = Math.round(
          ventasCajaHoy.reduce((sum, v) => sum + Number(v.monto_total || 0), 0) * 100
        ) / 100;

        if (isAdminBox) {
          return {
            id: cajaId,
            ...ids,
            label: caja.nombre,
            cashier: user?.name || 'Administrador General',
            role: user?.role || 'Administrador General',
            isAdminBox: true,
            open: false,
            openedAt: '—',
            salesToday: salesTodayClosed,
            tickets: ventasCajaHoy.length,
            cartItems: 0,
            currentTotal: 0,
            movements: [],
          };
        }

        // Buscar el último cierre de esta caja para mostrar el último cajero real o "Sin turno activo"
        const ultimoCierre = cierres.find((c) => keys.has(String(c.caja_id)));
        const ultimoUser = ultimoCierre?.cajero_id
          ? usuarios.find((u) => u.id === ultimoCierre.cajero_id)
          : undefined;
        const ultimoLocal = ultimoCierre
          ? localClosures.find((lc) => lc.id === ultimoCierre.id)
          : undefined;
        const rawUltimoNombre = (ultimoCierre as (CierreCaja & { cajero_nombre?: string }) | undefined)
          ?.cajero_nombre;

        const lastCashierName =
          ultimoUser?.nombre_completo ||
          rawUltimoNombre ||
          ultimoLocal?.userName ||
          ventasCajaHoy[0]?.cajero_nombre ||
          'Disponible / Sin turno activo';
        const lastCashierRole = ultimoUser
          ? ROL_DB_A_UI[ultimoUser.rol] || 'Cajero'
          : ultimoCierre
            ? 'Cajero'
            : 'Sin asignar';

        return {
          id: cajaId,
          ...ids,
          label: caja.nombre,
          cashier: lastCashierName,
          cashierId: ultimoCierre?.cajero_id || undefined,
          role: lastCashierRole,
          isAdminBox: false,
          open: false,
          openedAt: '—',
          salesToday: salesTodayClosed,
          tickets: ventasCajaHoy.length,
          cartItems: 0,
          currentTotal: 0,
          movements: [],
        };
      });

      setRegisters(nextRegisters);
    } catch {
      setRegisters(CASH_REGISTERS.map((r) => ({ ...r, open: false, openedAt: '—' })));
    } finally {
      setLoading(false);
    }
  }, [user]);

  const markRegisterClosed = useCallback((cajaId?: string) => {
    setRegisters((prev) =>
      prev.map((r) =>
        !cajaId || r.id === cajaId || r.dbId === cajaId || r.codigo === cajaId
          ? { ...r, open: false, openedAt: '—', salesToday: 0 }
          : r
      )
    );
  }, []);

  useEffect(() => {
    fetchDynamicRegisters();
  }, [fetchDynamicRegisters]);

  return { registers, dbUsers, loading, refetch: fetchDynamicRegisters, markRegisterClosed };
}
