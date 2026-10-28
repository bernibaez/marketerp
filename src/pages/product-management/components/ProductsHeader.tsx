import React, { useState, useRef, useEffect } from 'react';
import { Package, Download, Plus, FileText, Tag, Award, MoreHorizontal, ChevronDown } from 'lucide-react';

interface ProductsHeaderProps {
  onAdd: () => void;
  onExport: () => void;
  onImport?: () => void;
  onManageCategories?: () => void;
  onManageBrands?: () => void;
  totalProducts: number;
  activeProducts: number;
  lowStockCount: number;
}

export default function ProductsHeader({
  onAdd,
  onExport,
  onImport,
  onManageCategories,
  onManageBrands,
}: ProductsHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <h1 className="text-2xl font-black text-foreground tracking-tight flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <Package size={20} />
          </div>
          <span>Productos e Inventario</span>
        </h1>
        <p className="text-xs text-muted-foreground mt-1">
          Catálogo de productos, existencias, precios y códigos de barras
        </p>
      </div>

      <div className="flex items-center gap-2 self-start sm:self-center">
        {/* Dropdown de herramientas secundarias */}
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="btn-secondary !h-10 px-3.5 flex items-center gap-2 text-xs font-semibold cursor-pointer"
            title="Categorías, marcas y utilidades"
          >
            <MoreHorizontal size={16} />
            <span>Opciones</span>
            <ChevronDown size={14} className={`text-muted-foreground transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
          </button>

          {menuOpen && (
            <div className="absolute right-0 mt-2 w-56 bg-card border border-border rounded-2xl shadow-xl p-1.5 z-40 animate-in fade-in zoom-in-95 duration-150 space-y-0.5">
              {onManageCategories && (
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onManageCategories();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-foreground hover:bg-secondary/70 transition-colors text-left cursor-pointer"
                >
                  <Tag size={15} className="text-emerald-600 dark:text-emerald-400" />
                  <span>Gestionar Categorías</span>
                </button>
              )}

              {onManageBrands && (
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onManageBrands();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-foreground hover:bg-secondary/70 transition-colors text-left cursor-pointer"
                >
                  <Award size={15} className="text-emerald-600 dark:text-emerald-400" />
                  <span>Gestionar Marcas</span>
                </button>
              )}

              {onImport && (
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onImport();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-foreground hover:bg-secondary/70 transition-colors text-left cursor-pointer"
                >
                  <FileText size={15} className="text-muted-foreground" />
                  <span>Importar / Balanza</span>
                </button>
              )}

              <div className="my-1 border-t border-border/60" />

              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onExport();
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-foreground hover:bg-secondary/70 transition-colors text-left cursor-pointer"
              >
                <Download size={15} className="text-muted-foreground" />
                <span>Exportar Catálogo (PDF)</span>
              </button>
            </div>
          )}
        </div>

        {/* Botón Principal Hero */}
        <button
          type="button"
          onClick={onAdd}
          className="btn-primary !h-10 px-4 text-xs font-bold flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20 cursor-pointer"
        >
          <Plus size={16} />
          <span>Nuevo Producto</span>
        </button>
      </div>
    </div>
  );
}
