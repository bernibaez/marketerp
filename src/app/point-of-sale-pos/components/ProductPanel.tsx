'use client';
import React, { useState, useEffect, useRef } from 'react';
import { Search, Barcode, Grid3x3, List, X } from 'lucide-react';
import type { CartItem } from './POSTerminal';
import { createClient } from '@/lib/supabase/client';

interface Product {
  id: string;
  sku: string;
  barcode: string | null;
  name: string;
  category: string;
  price: number;
  cost: number;
  stock: number;
  unit: string;
  tax: number;
  lowStock: boolean;
  outOfStock: boolean;
}

interface DBProduct {
  id: string;
  code: string;
  barcode: string | null;
  name: string;
  sale_price: number;
  cost_price: number;
  current_stock: number;
  min_stock: number;
  is_active: boolean;
  categories?: { name: string } | null;
  units?: { name: string } | null;
  tax_rates?: { rate: number } | null;
}

interface ProductPanelProps {
  onAddToCart: (product: Omit<CartItem, 'qty' | 'discount'>) => void;
}

export default function ProductPanel({ onAddToCart }: ProductPanelProps) {
  const supabase = createClient();
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<{ id: string; label: string }[]>([{ id: 'all', label: 'Todos' }]);
  const [loading, setLoading] = useState(true);
  const barcodeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchProducts = async () => {
      const { data, error } = await supabase
        .from('products')
        .select('id, code, barcode, name, sale_price, cost_price, current_stock, min_stock, categories(name), units(name), tax_rates(rate)')
        .eq('is_active', true)
        .order('name');
      if (error || !data) { setLoading(false); return; }

      const mapped: Product[] = (data as DBProduct[]).map(p => ({
        id: p.id,
        sku: p.code,
        barcode: p.barcode || '',
        name: p.name,
        category: p.categories?.name || 'Sin categoría',
        price: Number(p.sale_price),
        cost: Number(p.cost_price),
        stock: Number(p.current_stock),
        unit: p.units?.name || 'Unidad',
        tax: Number(p.tax_rates?.rate || 0),
        lowStock: Number(p.current_stock) <= Number(p.min_stock) && Number(p.current_stock) > 0,
        outOfStock: Number(p.current_stock) === 0,
      }));
      setProducts(mapped);

      const uniqueCats = Array.from(new Set(mapped.map(p => p.category)));
      setCategories([{ id: 'all', label: 'Todos' }, ...uniqueCats.map(c => ({ id: c, label: c }))]);
      setLoading(false);
    };
    fetchProducts();
  }, []);

  const filtered = products.filter((p) => {
    const matchCat = activeCategory === 'all' || p.category === activeCategory;
    const matchSearch = search === '' ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.barcode || '').includes(search) ||
      p.sku.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const handleAdd = (p: Product) => {
    if (p.outOfStock) return;
    onAddToCart({
      id: `cart-${p.id}-${Date.now()}`,
      productId: p.id,
      name: p.name,
      sku: p.sku,
      price: p.price,
      cost: p.cost,
      tax: p.tax,
      image: '',
      unit: p.unit,
    });
  };

  const getInitials = (name: string) => {
    return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
  };

  const getColor = (name: string) => {
    const colors = ['bg-primary/20 text-primary', 'bg-success/20 text-success', 'bg-info/20 text-info', 'bg-warning/20 text-warning', 'bg-danger/20 text-danger'];
    return colors[name.charCodeAt(0) % colors.length];
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2.5 border-b border-border flex items-center gap-2 flex-shrink-0">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <input ref={barcodeRef} type="text" placeholder="Buscar por nombre, SKU o código de barras..." value={search} onChange={(e) => setSearch(e.target.value)} className="input-field pl-8 h-8 text-sm" />
          {search && <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"><X size={14} /></button>}
        </div>
        <button className="flex items-center gap-1.5 px-2.5 h-8 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:bg-secondary transition-colors flex-shrink-0" onClick={() => barcodeRef.current?.focus()}>
          <Barcode size={14} /><span className="hidden sm:inline">F2</span>
        </button>
        <div className="flex border border-border rounded-lg overflow-hidden flex-shrink-0">
          <button onClick={() => setViewMode('grid')} className={`p-1.5 transition-colors ${viewMode === 'grid' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary'}`}><Grid3x3 size={14} /></button>
          <button onClick={() => setViewMode('list')} className={`p-1.5 transition-colors ${viewMode === 'list' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary'}`}><List size={14} /></button>
        </div>
      </div>

      <div className="flex gap-1 px-3 py-2 border-b border-border overflow-x-auto scrollbar-thin flex-shrink-0">
        {categories.map((cat) => (
          <button key={cat.id} onClick={() => setActiveCategory(cat.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all duration-150 flex-shrink-0 ${activeCategory === cat.id ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-border'}`}>
            {cat.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin p-3">
        {loading ? (
          <div className="flex items-center justify-center h-40"><p className="text-sm text-muted-foreground">Cargando productos...</p></div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-2">
            <Search size={32} className="text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No se encontraron productos</p>
            <button onClick={() => { setSearch(''); setActiveCategory('all'); }} className="text-xs text-primary hover:underline">Limpiar filtros</button>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-2">
            {filtered.map((p) => (
              <button key={p.id} onClick={() => handleAdd(p)} disabled={p.outOfStock}
                className={`pos-product-card relative flex flex-col bg-card border rounded-xl p-3 text-left transition-all ${p.outOfStock ? 'opacity-50 cursor-not-allowed border-border' : 'border-border hover:border-primary/40 hover:shadow-card cursor-pointer'}`}>
                <div className={`aspect-square w-full mb-2 rounded-lg flex items-center justify-center text-2xl font-bold ${getColor(p.name)}`}>
                  {getInitials(p.name)}
                </div>
                {p.lowStock && !p.outOfStock && <span className="absolute top-2 right-2 badge-warning text-xs py-0 px-1.5">Bajo</span>}
                {p.outOfStock && <span className="absolute top-2 right-2 badge-danger text-xs py-0 px-1.5">Agotado</span>}
                <p className="text-xs font-semibold text-foreground leading-tight line-clamp-2">{p.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{p.unit}</p>
                <div className="flex items-center justify-between mt-1.5">
                  <p className="text-sm font-bold tabular-nums text-primary">RD$ {p.price.toLocaleString('es-DO')}</p>
                  {p.tax > 0 && <span className="text-xs text-muted-foreground">+ITBIS</span>}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">Stock: {p.stock}</p>
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-1">
            {filtered.map((p) => (
              <button key={p.id} onClick={() => handleAdd(p)} disabled={p.outOfStock}
                className={`w-full flex items-center gap-3 p-2.5 rounded-xl border text-left transition-all ${p.outOfStock ? 'opacity-50 cursor-not-allowed border-border' : 'border-border hover:border-primary/40 hover:bg-primary/5 cursor-pointer'}`}>
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm flex-shrink-0 ${getColor(p.name)}`}>
                  {getInitials(p.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{p.name}</p>
                  <p className="text-xs text-muted-foreground font-mono">{p.sku}</p>
                </div>
                <div className="flex-shrink-0 text-right">
                  <p className="text-sm font-bold tabular-nums text-primary">RD$ {p.price.toLocaleString('es-DO')}</p>
                  <p className="text-xs text-muted-foreground">Stock: {p.stock}</p>
                </div>
                {p.lowStock && <span className="badge-warning flex-shrink-0">Bajo</span>}
                {p.outOfStock && <span className="badge-danger flex-shrink-0">Agotado</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="px-3 py-2 border-t border-border bg-secondary/30 flex items-center gap-3 flex-shrink-0">
        {[{ key: 'F2', label: 'Barcode' }, { key: 'F9', label: 'Pago' }, { key: 'F10', label: 'Limpiar' }, { key: 'Esc', label: 'Cancelar' }].map((s) => (
          <div key={`shortcut-${s.key}`} className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-card border border-border rounded text-xs font-mono font-semibold text-foreground">{s.key}</kbd>
            <span className="text-xs text-muted-foreground hidden sm:inline">{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}