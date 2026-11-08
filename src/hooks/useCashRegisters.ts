import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  CASH_REGISTERS,
  doesRegisterMatchUser,
  isSameCashierName,
  type CashRegisterId,
  type CashRegisterSession,
} from '@/lib/cashRegisters';
import { getCashClosures } from '@/lib/cashClosureStore';
import { obtenerCierresCaja } from '@/services/cierresCaja.service';
import { obtenerUsuarios } from '@/services/usuarios.service';
import { obtenerCajas } from '@/services/cajas.service';
import {
  obtenerHistorialVentas,
  rememberCajeroNombre,
  calcularEfectivoNetoVenta,
} from '@/services/ventas.service';
import { ROL_DB_A_UI } from '@/services/auth.service';
import { tryGetSupabase, isSupabaseConfigured } from '@/services/clienteSupabase';
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

      const resolveSessionCashierName = (c: CierreCaja): string => {
        const matchedU = usuarios.find((u) => u.id && c.cajero_id && String(u.id) === String(c.cajero_id));
        const rawNombre = (c as CierreCaja & { cajero_nombre?: string })?.cajero_nombre;
        const localCl = localClosures.find((lc) => lc.id === c.id);
        return (
          matchedU?.nombre_completo ||
          rawNombre ||
          localCl?.userName ||
          (c.cajero_id && user?.id === c.cajero_id ? user?.name : '') ||
          ''
        ).trim();
      };

      // Limpieza única de sesiones colgadas de Keila/Keyla si ella no es quien está operando actualmente
      let abiertasRaw = cierres.filter((c) => String(c.estado).toLowerCase() === 'abierta');
      try {
        const cleanupKey = 'mercato_cleanup_keila_session_v2';
        const isCurrentUserKeila = doesRegisterMatchUser('Keila', user?.name, user?.username);
        if (!isCurrentUserKeila && typeof localStorage !== 'undefined' && !localStorage.getItem(cleanupKey)) {
          const keilaOpen = abiertasRaw.filter((c) => {
            const cName = resolveSessionCashierName(c);
            const cLabel = (c as CierreCaja & { caja_label?: string })?.caja_label || '';
            return doesRegisterMatchUser('Keila', cName) || (!cName && doesRegisterMatchUser('Keila', cLabel));
          });
          if (keilaOpen.length > 0) {
            const nowIso = new Date().toISOString();
            const sb = tryGetSupabase();
            if (sb && isSupabaseConfigured()) {
              const uuids = keilaOpen.map((k) => k.id).filter((id) => /^[0-9a-f-]{36}$/i.test(id));
              if (uuids.length > 0) {
                void sb
                  .from('cierres_caja')
                  .update({ estado: 'cerrada', cerrada_en: nowIso })
                  .in('id', uuids)
                  .eq('estado', 'abierta')
                  .then(() => {});
              }
            }
            const staleSet = new Set(keilaOpen.map((k) => k.id));
            abiertasRaw = abiertasRaw.filter((c) => !staleSet.has(c.id));
          }
          localStorage.setItem(cleanupKey, 'done');
        }
      } catch {
        // ignore
      }

      const abiertas = abiertasRaw;

      const baseCajasList = cajasDb.length > 0 ? cajasDb : CASH_REGISTERS.map((r) => ({
        id: r.id,
        codigo: r.id,
        nombre: r.label,
        es_caja_principal: r.isAdminBox ?? false,
        activa: true,
      }));

      // Determinar si una caja tiene el nombre propio de un cajero (ej: Keila, Valentina, Cheila, Eroly, Beiliz, Elizabeth)
      const KNOWN_CASHIER_BOX_NAMES = ['keila', 'keyla', 'valentina', 'cheila', 'sheila', 'eroly', 'beiliz', 'beilis', 'elizabeth', 'leanny'];
      const isBoxNamedAfterCashier = (boxName?: string | null): boolean => {
        if (!boxName) return false;
        if (usuarios.some((u) => doesRegisterMatchUser(boxName, u.nombre_completo, u.correo))) {
          return true;
        }
        return KNOWN_CASHIER_BOX_NAMES.some((n) => doesRegisterMatchUser(boxName, n));
      };

      const usedCierreIds = new Set<string>();

      const buildOpenSessionRegister = (
        sessionAbierta: CierreCaja,
        cajaId: CashRegisterId,
        ids: { dbId: string; codigo: string },
        formattedLabel: string,
        isAdminBox: boolean,
        keys: Set<string>
      ): CashRegisterSession => {
        usedCierreIds.add(sessionAbierta.id);
        const matchedUser = usuarios.find((u) => u.id === sessionAbierta.cajero_id);
        const localClosure = localClosures.find((lc) => lc.id === sessionAbierta.id);
        const rawCajeroNombre = (sessionAbierta as CierreCaja & { cajero_nombre?: string })?.cajero_nombre;

        const openTime = sessionAbierta.abierta_en
          ? new Date(sessionAbierta.abierta_en).getTime()
          : 0;

        // Verificar si hay más de un turno abierto en la misma caja
        const sameBoxOpenShifts = abiertas.filter((a) => keys.has(String(a.caja_id)));
        const multipleShiftsOnSameBox = sameBoxOpenShifts.length > 1;

        const boxCashierSuffix = isBoxNamedAfterCashier(formattedLabel)
          ? formattedLabel.split('-').slice(1).join('-').trim()
          : undefined;

        const shiftOwnerName =
          matchedUser?.nombre_completo ||
          rawCajeroNombre ||
          localClosure?.userName ||
          boxCashierSuffix ||
          '';

        const ventasTurno = ventasHoy.filter((v) => {
          const saleCajaId = String(v.caja_id ?? '').trim();
          const matchesBox = saleCajaId ? keys.has(saleCajaId) : false;

          // Regla estricta: si la venta tiene asignada otra caja distinta, NUNCA mezclarla
          if (saleCajaId && !matchesBox) {
            return false;
          }

          const matchesCashierId =
            Boolean(sessionAbierta.cajero_id) &&
            String(v.cajero_id ?? '') === String(sessionAbierta.cajero_id);
          const rowName = (v.cajero_nombre || '').trim();
          const hasSpecificRowName =
            Boolean(rowName) &&
            !['cajero', 'cajera', 'no especificado'].includes(rowName.toLowerCase());
          const matchesCashierName =
            Boolean(shiftOwnerName) &&
            hasSpecificRowName &&
            isSameCashierName(rowName, shiftOwnerName);

          if (shiftOwnerName && hasSpecificRowName && !matchesCashierName && !matchesCashierId) {
            return false;
          }
          if (multipleShiftsOnSameBox && sessionAbierta.cajero_id && v.cajero_id) {
            if (!matchesCashierId && !matchesCashierName) return false;
          } else if (!matchesBox && !matchesCashierId && !matchesCashierName) {
            return false;
          }

          if (openTime > 0 && v.creado_en) {
            const vt = new Date(v.creado_en).getTime();
            if (!isNaN(vt) && vt < openTime - 5_000) return false;
          }
          return true;
        });

        const computedSales =
          Math.round(ventasTurno.reduce((sum, v) => sum + Number(v.monto_total || 0), 0) * 100) / 100;
        const computedCash =
          Math.round(ventasTurno.reduce((sum, v) => sum + calcularEfectivoNetoVenta(v), 0) * 100) / 100;
        const computedCard =
          Math.round(ventasTurno.reduce((sum, v) => sum + Number(v.monto_tarjeta || 0), 0) * 100) / 100;
        const computedTransfer =
          Math.round(ventasTurno.reduce((sum, v) => sum + Number(v.monto_transferencia || 0), 0) * 100) / 100;

        const baseCash = Number(sessionAbierta.monto_apertura || 0);
        const salesToday =
          computedSales > 0 ? computedSales : Number(sessionAbierta.total_ventas || 0);
        const cashSales =
          computedSales > 0 ? computedCash : Number(sessionAbierta.total_efectivo || 0);
        const cardSales =
          computedSales > 0 ? computedCard : Number(sessionAbierta.total_tarjeta || 0);
        const transferSales =
          computedSales > 0 ? computedTransfer : Number(sessionAbierta.total_transferencia || 0);
        const expectedCash = Math.round((baseCash + cashSales) * 100) / 100;
        const ticketsCount = ventasTurno.length;

        const cashierName =
          matchedUser?.nombre_completo ||
          rawCajeroNombre ||
          localClosure?.userName ||
          (sessionAbierta.cajero_id && user?.id === sessionAbierta.cajero_id ? user?.name : undefined) ||
          boxCashierSuffix ||
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

        // Si la etiqueta de la caja tenía el nombre de otra cajera distinta a quien abrió el turno, mostrar el nombre real del cajero
        let effectiveLabel = formattedLabel;
        if (
          cashierName &&
          cashierName !== 'Cajero Activo' &&
          isBoxNamedAfterCashier(formattedLabel) &&
          !doesRegisterMatchUser(formattedLabel, cashierName)
        ) {
          effectiveLabel = `Caja #${ids.codigo} - ${cashierName}`;
        }

        return {
          id: cajaId,
          ...ids,
          label: effectiveLabel,
          cashier: cashierName,
          cashierId: sessionAbierta.cajero_id || undefined,
          cierreId: sessionAbierta.id,
          role: userRole,
          isAdminBox,
          open: true,
          openedAt: horaApertura,
          openedAtIso: sessionAbierta.abierta_en,
          baseCash,
          cashSales,
          cardSales,
          transferSales,
          expectedCash,
          salesToday,
          tickets: ticketsCount,
          cartItems: 0,
          currentTotal: 0,
          movements: [],
        };
      };

      const nextRegisters: CashRegisterSession[] = baseCajasList.map((caja) => {
        const dbId = String(caja.id);
        const codigo = String(caja.codigo || caja.id);
        const cajaId = codigo as CashRegisterId;
        const formattedLabel = caja.nombre?.toUpperCase().includes('CAJA')
          ? caja.nombre
          : `Caja #${codigo} - ${caja.nombre}`;
        const keys = new Set(
          [
            dbId,
            codigo,
            cajaId,
            caja.nombre,
            formattedLabel,
            `Caja #${codigo}`,
            `Caja ${codigo}`,
            `caja-${codigo}`,
          ]
            .filter(Boolean)
            .map(String)
        );
        const boxHasSpecificCashierName = isBoxNamedAfterCashier(caja.nombre);

        // 1. Primero buscar si hay una sesión abierta cuyo cajero coincida por nombre con esta caja
        let sessionAbierta = boxHasSpecificCashierName
          ? abiertas.find((c) => {
              if (usedCierreIds.has(c.id)) return false;
              const cName = resolveSessionCashierName(c);
              return Boolean(cName && doesRegisterMatchUser(caja.nombre, cName));
            })
          : undefined;

        // 2. Si no, buscar por coincidencia de caja_id (pero si la caja lleva el nombre de una cajera específica como Keila,
        //    no asignarle el turno de otra cajera distinta)
        if (!sessionAbierta) {
          sessionAbierta = abiertas.find((c) => {
            if (usedCierreIds.has(c.id)) return false;
            if (!keys.has(String(c.caja_id))) return false;
            const cName = resolveSessionCashierName(c);
            if (boxHasSpecificCashierName) {
              return !cName || doesRegisterMatchUser(caja.nombre, cName);
            }
            // Si el turno pertenece a un cajero que tiene su propia caja con su nombre en baseCajasList, reservarlo para su caja
            if (cName) {
              const hasOwnNamedBox = baseCajasList.some(
                (otherCaja) =>
                  String(otherCaja.id) !== dbId &&
                  doesRegisterMatchUser(otherCaja.nombre, cName)
              );
              if (hasOwnNamedBox) return false;
            }
            return true;
          });
        }
        const isAdminBox = Boolean(caja.es_caja_principal) && !boxHasSpecificCashierName;
        const ids = { dbId, codigo };

        if (sessionAbierta) {
          return buildOpenSessionRegister(
            sessionAbierta,
            cajaId,
            ids,
            formattedLabel,
            isAdminBox,
            keys
          );
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
            label: formattedLabel,
            cashier: user?.name || 'Administrador General',
            role: user?.role || 'Administrador General',
            isAdminBox: true,
            open: false,
            openedAt: '—',
            baseCash: 0,
            cashSales: 0,
            cardSales: 0,
            transferSales: 0,
            expectedCash: 0,
            salesToday: salesTodayClosed,
            tickets: ventasCajaHoy.length,
            cartItems: 0,
            currentTotal: 0,
            movements: [],
          };
        }

        // Si la caja está cerrada, debe figurar disponible y sin cajero asignado
        return {
          id: cajaId,
          ...ids,
          label: formattedLabel,
          cashier: 'Disponible',
          cashierId: undefined,
          role: 'Disponible',
          isAdminBox: false,
          open: false,
          openedAt: '—',
          baseCash: 0,
          cashSales: 0,
          cardSales: 0,
          transferSales: 0,
          expectedCash: 0,
          salesToday: salesTodayClosed,
          tickets: ventasCajaHoy.length,
          cartItems: 0,
          currentTotal: 0,
          movements: [],
        };
      });

      // Agregar cualquier sesión abierta adicional (ej. si múltiples cajeros abrieron turno en el mismo caja_id)
      for (const extraOpen of abiertas) {
        if (usedCierreIds.has(extraOpen.id)) continue;
        const matchedCaja = baseCajasList.find(
          (c) => String(c.id) === String(extraOpen.caja_id) || String(c.codigo) === String(extraOpen.caja_id)
        );
        const rawCode = String(matchedCaja?.codigo || extraOpen.caja_id || '1');
        const extraLabel =
          (extraOpen as CierreCaja & { caja_label?: string }).caja_label ||
          (matchedCaja?.nombre?.toUpperCase().includes('CAJA')
            ? matchedCaja.nombre
            : matchedCaja?.nombre
              ? `Caja #${rawCode} - ${matchedCaja.nombre}`
              : `Caja #${rawCode}`);
        const keys = new Set([String(extraOpen.caja_id), rawCode, extraLabel]);
        nextRegisters.push(
          buildOpenSessionRegister(
            extraOpen,
            rawCode as CashRegisterId,
            { dbId: String(matchedCaja?.id || extraOpen.caja_id), codigo: rawCode },
            extraLabel,
            false,
            keys
          )
        );
      }

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
    const handleUpdate = () => {
      void fetchDynamicRegisters();
    };
    window.addEventListener('mercato_cash_closures_updated', handleUpdate);
    return () => {
      window.removeEventListener('mercato_cash_closures_updated', handleUpdate);
    };
  }, [fetchDynamicRegisters]);

  return { registers, dbUsers, loading, refetch: fetchDynamicRegisters, markRegisterClosed };
}
