import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import type { ProductItem } from '@/lib/productStore';
import { obtenerProductos, productoAUi, crearProducto, uiAProductoInsert } from '@/services/productos.service';
import { isAbortError } from '@/lib/isAbortError';
import { toast } from '@/lib/toast';

interface UsePurchaseCatalogOptions {
  onAddProductDirectly: (
    product: ProductItem,
    qty?: number,
    customPrice?: number,
    customSalePrice?: number,
    customTax?: number,
    customWholesalePrice?: number
  ) => void;
}

export function usePurchaseCatalog({ onAddProductDirectly }: UsePurchaseCatalogOptions) {
  // Modal State
  const [showProductModal, setShowProductModal] = useState(false);
  const [modalTab, setModalTab] = useState<'catalog' | 'new'>('catalog');
  const [modalSearch, setModalSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [catalogProducts, setCatalogProducts] = useState<ProductItem[]>([]);
  const [catalogTotal, setCatalogTotal] = useState(0);
  const [catalogPage, setCatalogPage] = useState(1);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const [selectedProduct, setSelectedProduct] = useState<ProductItem | null>(null);
  const [modalQty, setModalQty] = useState<number>(1);
  const [modalPrice, setModalPrice] = useState<number>(0);
  const [modalSalePrice, setModalSalePrice] = useState<number>(0);
  const [modalWholesalePrice, setModalWholesalePrice] = useState<number>(0);
  const [lastAddedNotice, setLastAddedNotice] = useState<string | null>(null);

  // New Product Form State
  const [newName, setNewName] = useState('');
  const [newSku, setNewSku] = useState('');
  const [newBarcode, setNewBarcode] = useState('');
  const [newCategory, setNewCategory] = useState('General');
  const [newUnit, setNewUnit] = useState('Unidad');
  const [newTax, setNewTax] = useState(18);

  // Quick Inline Search
  const [inlineSearch, setInlineSearch] = useState('');
  const [inlineResults, setInlineResults] = useState<ProductItem[]>([]);
  const [inlineLoading, setInlineLoading] = useState(false);
  const [inlineOpen, setInlineOpen] = useState(false);
  const [inlineHighlightIndex, setInlineHighlightIndex] = useState(0);
  const inlineSearchRef = useRef<HTMLInputElement | null>(null);
  const inlineAbortRef = useRef<AbortController | null>(null);
  const inlineDropdownRef = useRef<HTMLDivElement | null>(null);

  // Debounced search for catalog modal
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(modalSearch.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [modalSearch]);

  // Inline Search Debounce & Fetch
  useEffect(() => {
    const q = inlineSearch.trim();
    if (!q) {
      setInlineResults([]);
      setInlineOpen(false);
      setInlineLoading(false);
      return;
    }

    if (inlineAbortRef.current) {
      inlineAbortRef.current.abort();
    }
    const controller = new AbortController();
    inlineAbortRef.current = controller;
    setInlineLoading(true);

    const timer = setTimeout(async () => {
      try {
        const res = await obtenerProductos({
          pagina: 1,
          limite: 5000,
          busqueda: q,
          estado: 'todos',
          signal: controller.signal,
        });
        const items = (res.datos || []).map(productoAUi) as ProductItem[];
        setInlineResults(items);
        setInlineHighlightIndex(0);
        setInlineOpen(true);
      } catch (err) {
        if (!isAbortError(err)) {
          console.error('Error buscando productos inline:', err);
        }
      } finally {
        setInlineLoading(false);
      }
    }, 200);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [inlineSearch]);

  // Handle outside clicks for inline search dropdown
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (
        inlineDropdownRef.current &&
        !inlineDropdownRef.current.contains(e.target as Node) &&
        inlineSearchRef.current &&
        !inlineSearchRef.current.contains(e.target as Node)
      ) {
        setInlineOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Fetch catalog products
  const fetchCatalog = useCallback(async (query: string, page = 1, append = false) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    if (append) {
      setLoadingMore(true);
    } else {
      setCatalogLoading(true);
    }

    try {
      const res = await obtenerProductos({
        pagina: page,
        limite: 5000,
        busqueda: query,
        estado: 'todos',
        signal: controller.signal,
      });

      const uiItems = (res.datos || []).map(productoAUi) as ProductItem[];
      setCatalogTotal(res.total ?? 0);
      setCatalogPage(page);

      if (append) {
        setCatalogProducts((prev) => {
          const existingIds = new Set(prev.map((p) => p.id));
          const newItems = uiItems.filter((p) => !existingIds.has(p.id));
          return [...prev, ...newItems];
        });
      } else {
        setCatalogProducts(uiItems);
      }
    } catch (err) {
      if (!isAbortError(err)) {
        console.error('Error al consultar productos en BD:', err);
      }
    } finally {
      setCatalogLoading(false);
      setLoadingMore(false);
    }
  }, []);

  // Trigger catalog fetch when modal opens or debounced search changes
  useEffect(() => {
    if (!showProductModal || modalTab !== 'catalog') return;
    void fetchCatalog(debouncedSearch, 1, false);
  }, [showProductModal, modalTab, debouncedSearch, fetchCatalog]);

  // Escape key handler for modal
  useEffect(() => {
    if (!showProductModal) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowProductModal(false);
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [showProductModal]);

  const categories = useMemo(() => {
    const defaultCategories = [
      'General',
      'Abarrotes',
      'Bebidas',
      'Lácteos',
      'Carnes y Embutidos',
      'Frutas y Verduras',
      'Panadería y Repostería',
      'Snacks y Dulces',
      'Limpieza y Hogar',
      'Cuidado Personal',
      'Congelados',
    ];
    const fromLoaded = catalogProducts.map((p) => p.category).filter(Boolean);
    return Array.from(new Set([...defaultCategories, ...fromLoaded])).sort();
  }, [catalogProducts]);

  const resetModalForm = () => {
    setSelectedProduct(null);
    setModalQty(1);
    setModalPrice(0);
    setModalSalePrice(0);
    setModalWholesalePrice(0);
    setModalSearch('');
    setDebouncedSearch('');
    setNewName('');
    setNewSku('');
    setNewBarcode('');
    setNewCategory('General');
    setNewUnit('Unidad');
    setNewTax(18);
  };

  const handleSelectInlineProduct = (p: ProductItem) => {
    onAddProductDirectly(p, 1);
    setInlineSearch('');
    setInlineResults([]);
    setInlineOpen(false);
    inlineSearchRef.current?.focus();
  };

  const handleInlineKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (inlineResults.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setInlineHighlightIndex((prev) => (prev + 1) % inlineResults.length);
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setInlineHighlightIndex((prev) => (prev - 1 + inlineResults.length) % inlineResults.length);
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      const chosen = inlineResults[inlineHighlightIndex] || inlineResults[0];
      if (chosen) {
        handleSelectInlineProduct(chosen);
      }
      return;
    }

    if (e.key === 'Escape') {
      setInlineOpen(false);
    }
  };

  const handleAddProductToPurchase = async (closeModal = false) => {
    if (modalTab === 'catalog') {
      if (!selectedProduct) {
        toast.error('Selecciona un producto del catálogo');
        return;
      }
      onAddProductDirectly(
        selectedProduct,
        modalQty,
        modalPrice,
        modalSalePrice,
        undefined,
        modalWholesalePrice > 0 ? modalWholesalePrice : (selectedProduct.wholesalePrice || modalSalePrice)
      );
      setLastAddedNotice(`¡"${selectedProduct.name}" añadido exitosamente!`);
      setSelectedProduct(null);
      setModalQty(1);
      setModalPrice(0);
      setModalSalePrice(0);
      setModalWholesalePrice(0);

      if (closeModal) {
        setShowProductModal(false);
      }
      return;
    }

    if (!newName.trim() || !newSku.trim()) {
      toast.error('El nombre y SKU son obligatorios');
      return;
    }
    if (modalPrice <= 0) {
      toast.error('Ingresa un costo de compra válido');
      return;
    }
    if (modalSalePrice <= 0) {
      toast.error('Ingresa un precio de venta');
      return;
    }

    try {
      const wholesaleFinal = modalWholesalePrice > 0 ? modalWholesalePrice : modalSalePrice;
      const nuevoProductoInsert = uiAProductoInsert({
        name: newName.trim(),
        sku: newSku.trim().toUpperCase(),
        barcode: newBarcode.trim() || '',
        category: newCategory,
        brand: '',
        unit: newUnit,
        supplier: '',
        costPrice: modalPrice,
        salePrice: modalSalePrice,
        wholesalePrice: wholesaleFinal,
        tax: newTax,
        currentStock: 0,
        minStock: 5,
        image: '',
        expiryDate: null,
        warranty: 'N/A',
        status: 'active',
        saleType: 'unit',
      });

      const pCreado = await crearProducto(nuevoProductoInsert);
      const uiProduct = productoAUi(pCreado) as ProductItem;

      onAddProductDirectly(uiProduct, modalQty, modalPrice, modalSalePrice, newTax, wholesaleFinal);
      setLastAddedNotice(`¡"${uiProduct.name}" registrado en catálogo y añadido a la compra!`);
      toast.success(`Producto "${uiProduct.name}" creado en catálogo y agregado a la orden`);

      resetModalForm();
      if (closeModal) {
        setShowProductModal(false);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error creando producto nuevo');
    }
  };

  return {
    showProductModal,
    setShowProductModal,
    modalTab,
    setModalTab,
    modalSearch,
    setModalSearch,
    debouncedSearch,
    setDebouncedSearch,
    catalogProducts,
    catalogTotal,
    catalogPage,
    catalogLoading,
    loadingMore,
    fetchCatalog,
    selectedProduct,
    setSelectedProduct,
    modalQty,
    setModalQty,
    modalPrice,
    setModalPrice,
    modalSalePrice,
    setModalSalePrice,
    modalWholesalePrice,
    setModalWholesalePrice,
    lastAddedNotice,
    setLastAddedNotice,
    newName,
    setNewName,
    newSku,
    setNewSku,
    newBarcode,
    setNewBarcode,
    newCategory,
    setNewCategory,
    newUnit,
    setNewUnit,
    newTax,
    setNewTax,
    categories,
    resetModalForm,
    inlineSearch,
    setInlineSearch,
    inlineResults,
    inlineLoading,
    inlineOpen,
    setInlineOpen,
    inlineHighlightIndex,
    setInlineHighlightIndex,
    inlineSearchRef,
    inlineDropdownRef,
    handleInlineKeyDown,
    handleSelectInlineProduct,
    handleAddProductToPurchase,
  };
}
