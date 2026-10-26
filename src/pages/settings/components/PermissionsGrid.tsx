import React from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import {
  PERMISSION_ACTIONS,
  PERMISSION_GROUPS,
  type PermissionAction,
  type PermissionModule,
  type RolePermissionMap,
} from '@/lib/permissionsCatalog';
import { countModuleEnabled } from '@/lib/permissionsStore';
import { PermissionToggle } from './PermissionToggle';

interface PermissionsGridProps {
  filteredModules: PermissionModule[];
  roleMap: RolePermissionMap;
  isSuperAdmin: boolean;
  collapsedGroups: Record<string, boolean>;
  setCollapsedGroups: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  toggleModuleAccess: (moduleId: string, actions: PermissionAction[], enable: boolean) => void;
  setAction: (moduleId: string, action: PermissionAction, enabled: boolean) => void;
  search: string;
}

export function PermissionsGrid({
  filteredModules,
  roleMap,
  isSuperAdmin,
  collapsedGroups,
  setCollapsedGroups,
  toggleModuleAccess,
  setAction,
  search,
}: PermissionsGridProps) {
  return (
    <div className="space-y-2">
      {PERMISSION_GROUPS.map((group) => {
        const modules = filteredModules.filter((m) => m.group === group);
        if (modules.length === 0) return null;
        const collapsed = !!collapsedGroups[group];

        return (
          <div key={group} className="rounded-2xl border border-border overflow-hidden">
            <button
              type="button"
              onClick={() =>
                setCollapsedGroups((prev) => ({ ...prev, [group]: !prev[group] }))
              }
              className="w-full flex items-center justify-between px-3.5 py-2.5 bg-secondary/50 hover:bg-secondary/70 transition-colors cursor-pointer"
            >
              <span className="text-sm font-bold text-foreground">{group}</span>
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                {modules.length} {modules.length === 1 ? 'módulo' : 'módulos'}
                {collapsed ? <ChevronRight size={15} /> : <ChevronDown size={15} />}
              </span>
            </button>

            {!collapsed && (
              <div className="divide-y divide-border bg-card">
                {modules.map((mod) => {
                  const enabledInMod = countModuleEnabled(roleMap, mod.id);
                  const allOn = enabledInMod === mod.actions.length;
                  const canEnter = !!roleMap[mod.id]?.ver;

                  return (
                    <div key={mod.id} className="px-3.5 py-3 hover:bg-secondary/15 transition-colors">
                      <div className="md:grid md:grid-cols-[minmax(0,1.5fr)_repeat(6,minmax(0,0.5fr))] md:gap-1 md:items-center">
                        <div className="flex items-start justify-between gap-2 mb-2 md:mb-0">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-semibold text-sm text-foreground">{mod.label}</p>
                              <span
                                className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                                  canEnter
                                    ? 'bg-primary/15 text-primary'
                                    : 'bg-secondary text-muted-foreground'
                                }`}
                              >
                                {canEnter ? 'Puede entrar' : 'Sin acceso'}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">{mod.description}</p>
                          </div>
                          {!isSuperAdmin && (
                            <button
                              type="button"
                              onClick={() => toggleModuleAccess(mod.id, mod.actions, !allOn)}
                              className="text-[11px] font-bold text-primary hover:underline flex-shrink-0 md:hidden cursor-pointer"
                            >
                              {allOn ? 'Quitar' : 'Dar acceso'}
                            </button>
                          )}
                        </div>

                        {/* Mobile action buttons */}
                        <div className="flex flex-wrap gap-1.5 md:hidden">
                          {PERMISSION_ACTIONS.map((action) => {
                            if (!mod.actions.includes(action.id)) return null;
                            const on = !!roleMap[mod.id]?.[action.id];
                            return (
                              <button
                                key={action.id}
                                type="button"
                                disabled={isSuperAdmin}
                                onClick={() => setAction(mod.id, action.id, !on)}
                                className={`
                                  px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all cursor-pointer
                                  ${
                                    on
                                      ? 'bg-primary/15 border-primary/30 text-primary'
                                      : 'bg-card border-border text-muted-foreground'
                                  }
                                  disabled:opacity-50 disabled:cursor-not-allowed
                                `}
                              >
                                {action.label}
                              </button>
                            );
                          })}
                        </div>

                        {/* Desktop toggles */}
                        {PERMISSION_ACTIONS.map((action) => {
                          if (!mod.actions.includes(action.id)) {
                            return (
                              <div key={action.id} className="hidden md:flex justify-center">
                                <span className="text-muted-foreground/25 text-xs">—</span>
                              </div>
                            );
                          }
                          const on = !!roleMap[mod.id]?.[action.id];
                          return (
                            <div key={action.id} className="hidden md:flex justify-center">
                              <PermissionToggle
                                checked={on}
                                disabled={isSuperAdmin}
                                label={`${mod.label} · ${action.label}`}
                                onChange={() => setAction(mod.id, action.id, !on)}
                              />
                            </div>
                          );
                        })}
                      </div>

                      {!isSuperAdmin && (
                        <div className="hidden md:flex justify-end mt-1">
                          <button
                            type="button"
                            onClick={() => toggleModuleAccess(mod.id, mod.actions, !allOn)}
                            className="text-[11px] font-bold text-primary hover:underline cursor-pointer"
                          >
                            {allOn ? 'Quitar acceso al área' : 'Dar acceso completo al área'}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {filteredModules.length === 0 && (
        <p className="text-center text-sm text-muted-foreground py-8">
          No hay módulos que coincidan con “{search}”.
        </p>
      )}
    </div>
  );
}
