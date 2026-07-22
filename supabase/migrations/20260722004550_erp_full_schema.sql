-- ============================================================
-- MarketERP Full Schema Migration
-- Timestamp: 20260722004550
-- ============================================================

-- ============================================================
-- 1. ENUMS / TYPES
-- ============================================================

DROP TYPE IF EXISTS public.user_role CASCADE;
CREATE TYPE public.user_role AS ENUM ('admin', 'cajero', 'vendedor', 'almacenista', 'contador', 'supervisor');

DROP TYPE IF EXISTS public.document_status CASCADE;
CREATE TYPE public.document_status AS ENUM ('borrador', 'pendiente', 'aprobado', 'rechazado', 'completado', 'cancelado', 'vencido', 'convertido');

DROP TYPE IF EXISTS public.payment_method CASCADE;
CREATE TYPE public.payment_method AS ENUM ('efectivo', 'tarjeta', 'transferencia', 'cheque', 'credito', 'mixto');

DROP TYPE IF EXISTS public.movement_type CASCADE;
CREATE TYPE public.movement_type AS ENUM ('entrada', 'salida', 'ajuste', 'transferencia', 'devolucion');

DROP TYPE IF EXISTS public.contact_type CASCADE;
CREATE TYPE public.contact_type AS ENUM ('cliente', 'proveedor', 'ambos');

DROP TYPE IF EXISTS public.expense_category CASCADE;
CREATE TYPE public.expense_category AS ENUM ('nomina', 'alquiler', 'servicios', 'suministros', 'mantenimiento', 'marketing', 'transporte', 'impuestos', 'otros');

DROP TYPE IF EXISTS public.sync_status CASCADE;
CREATE TYPE public.sync_status AS ENUM ('idle', 'syncing', 'success', 'error');

-- ============================================================
-- 2. CORE TABLES (no foreign keys)
-- ============================================================

-- User Profiles (linked to auth.users)
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL DEFAULT '',
  avatar_url TEXT,
  role public.user_role NOT NULL DEFAULT 'cajero'::public.user_role,
  phone TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  branch_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Roles & Permissions matrix
CREATE TABLE IF NOT EXISTS public.roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  color TEXT DEFAULT 'bg-primary/10 text-primary',
  is_system BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  module TEXT NOT NULL,
  can_view BOOLEAN NOT NULL DEFAULT false,
  can_create BOOLEAN NOT NULL DEFAULT false,
  can_edit BOOLEAN NOT NULL DEFAULT false,
  can_delete BOOLEAN NOT NULL DEFAULT false,
  can_export BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(role_id, module)
);

-- Branches / Locations
CREATE TABLE IF NOT EXISTS public.branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  manager_id UUID,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tax rates
CREATE TABLE IF NOT EXISTS public.tax_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  rate NUMERIC(5,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Categories
CREATE TABLE IF NOT EXISTS public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  parent_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Brands
CREATE TABLE IF NOT EXISTS public.brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  country TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Units of measure
CREATE TABLE IF NOT EXISTS public.units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  abbreviation TEXT NOT NULL,
  type TEXT DEFAULT 'unidad',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Price groups
CREATE TABLE IF NOT EXISTS public.price_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  discount_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 3. PRODUCTS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  barcode TEXT,
  name TEXT NOT NULL,
  description TEXT,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  brand_id UUID REFERENCES public.brands(id) ON DELETE SET NULL,
  unit_id UUID REFERENCES public.units(id) ON DELETE SET NULL,
  tax_rate_id UUID REFERENCES public.tax_rates(id) ON DELETE SET NULL,
  cost_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  sale_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  min_stock NUMERIC(12,3) NOT NULL DEFAULT 0,
  max_stock NUMERIC(12,3),
  current_stock NUMERIC(12,3) NOT NULL DEFAULT 0,
  image_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_service BOOLEAN NOT NULL DEFAULT false,
  expiry_date DATE,
  created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Product price group overrides
CREATE TABLE IF NOT EXISTS public.product_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  price_group_id UUID NOT NULL REFERENCES public.price_groups(id) ON DELETE CASCADE,
  price NUMERIC(12,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(product_id, price_group_id)
);

-- ============================================================
-- 4. CONTACTS (Clients & Suppliers)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type public.contact_type NOT NULL DEFAULT 'cliente'::public.contact_type,
  name TEXT NOT NULL,
  rnc TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  city TEXT,
  credit_limit NUMERIC(12,2) DEFAULT 0,
  balance NUMERIC(12,2) DEFAULT 0,
  price_group_id UUID REFERENCES public.price_groups(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 5. INVENTORY
-- ============================================================

CREATE TABLE IF NOT EXISTS public.inventory_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  movement_type public.movement_type NOT NULL,
  quantity NUMERIC(12,3) NOT NULL,
  unit_cost NUMERIC(12,2),
  reference_type TEXT,
  reference_id UUID,
  notes TEXT,
  created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.stock_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  reason TEXT NOT NULL,
  status public.document_status NOT NULL DEFAULT 'pendiente'::public.document_status,
  notes TEXT,
  created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  approved_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.stock_adjustment_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  adjustment_id UUID NOT NULL REFERENCES public.stock_adjustments(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  expected_qty NUMERIC(12,3) NOT NULL DEFAULT 0,
  actual_qty NUMERIC(12,3) NOT NULL DEFAULT 0,
  difference NUMERIC(12,3) GENERATED ALWAYS AS (actual_qty - expected_qty) STORED,
  unit_cost NUMERIC(12,2)
);

CREATE TABLE IF NOT EXISTS public.stock_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  from_branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  to_branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  status public.document_status NOT NULL DEFAULT 'pendiente'::public.document_status,
  notes TEXT,
  created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  approved_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.stock_transfer_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id UUID NOT NULL REFERENCES public.stock_transfers(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity NUMERIC(12,3) NOT NULL,
  received_qty NUMERIC(12,3) DEFAULT 0
);

-- ============================================================
-- 6. PURCHASES
-- ============================================================

CREATE TABLE IF NOT EXISTS public.purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  supplier_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  status public.document_status NOT NULL DEFAULT 'pendiente'::public.document_status,
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  payment_method public.payment_method DEFAULT 'efectivo'::public.payment_method,
  payment_status TEXT DEFAULT 'pendiente',
  notes TEXT,
  invoice_number TEXT,
  purchase_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.purchase_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id UUID NOT NULL REFERENCES public.purchases(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity NUMERIC(12,3) NOT NULL,
  unit_cost NUMERIC(12,2) NOT NULL,
  tax_rate NUMERIC(5,2) DEFAULT 0,
  discount_percent NUMERIC(5,2) DEFAULT 0,
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0
);

-- ============================================================
-- 7. SALES
-- ============================================================

CREATE TABLE IF NOT EXISTS public.sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  client_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  cashier_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  status public.document_status NOT NULL DEFAULT 'completado'::public.document_status,
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  payment_method public.payment_method DEFAULT 'efectivo'::public.payment_method,
  payment_status TEXT DEFAULT 'pagado',
  ncf TEXT,
  ncf_type TEXT DEFAULT 'B02',
  notes TEXT,
  sale_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sale_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity NUMERIC(12,3) NOT NULL,
  unit_price NUMERIC(12,2) NOT NULL,
  tax_rate NUMERIC(5,2) DEFAULT 0,
  discount_percent NUMERIC(5,2) DEFAULT 0,
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0
);

-- ============================================================
-- 8. QUOTATIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.quotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  client_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  status public.document_status NOT NULL DEFAULT 'pendiente'::public.document_status,
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  valid_until DATE,
  notes TEXT,
  terms TEXT,
  converted_to_sale_id UUID REFERENCES public.sales(id) ON DELETE SET NULL,
  created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.quotation_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id UUID NOT NULL REFERENCES public.quotations(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity NUMERIC(12,3) NOT NULL,
  unit_price NUMERIC(12,2) NOT NULL,
  tax_rate NUMERIC(5,2) DEFAULT 0,
  discount_percent NUMERIC(5,2) DEFAULT 0,
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0
);

-- ============================================================
-- 9. PRE-SALES (Preventas)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.pre_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  client_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  agent_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  status public.document_status NOT NULL DEFAULT 'pendiente'::public.document_status,
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  notes TEXT,
  converted_to_sale_id UUID REFERENCES public.sales(id) ON DELETE SET NULL,
  created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.pre_sale_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pre_sale_id UUID NOT NULL REFERENCES public.pre_sales(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity NUMERIC(12,3) NOT NULL,
  unit_price NUMERIC(12,2) NOT NULL,
  discount_percent NUMERIC(5,2) DEFAULT 0,
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0
);

-- ============================================================
-- 10. RETURNS (Devoluciones)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.returns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  return_type TEXT NOT NULL DEFAULT 'venta',
  reference_id UUID,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  status public.document_status NOT NULL DEFAULT 'pendiente'::public.document_status,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  refund_method public.payment_method DEFAULT 'efectivo'::public.payment_method,
  reason TEXT,
  notes TEXT,
  created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.return_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id UUID NOT NULL REFERENCES public.returns(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity NUMERIC(12,3) NOT NULL,
  unit_price NUMERIC(12,2) NOT NULL,
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0
);

-- ============================================================
-- 11. EXPENSES
-- ============================================================

CREATE TABLE IF NOT EXISTS public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  category public.expense_category NOT NULL DEFAULT 'otros'::public.expense_category,
  description TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  payment_method public.payment_method DEFAULT 'efectivo'::public.payment_method,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  supplier_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  receipt_url TEXT,
  notes TEXT,
  created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 12. DISCOUNTS & PROMOTIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.discounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  discount_type TEXT NOT NULL DEFAULT 'percent',
  value NUMERIC(12,2) NOT NULL,
  min_purchase NUMERIC(12,2) DEFAULT 0,
  max_uses INTEGER,
  uses_count INTEGER NOT NULL DEFAULT 0,
  valid_from DATE,
  valid_until DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 13. SHIPMENTS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.shipments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  sale_id UUID REFERENCES public.sales(id) ON DELETE SET NULL,
  client_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  carrier TEXT,
  tracking_number TEXT,
  status TEXT NOT NULL DEFAULT 'pendiente',
  estimated_delivery DATE,
  delivered_at TIMESTAMPTZ,
  address TEXT,
  notes TEXT,
  created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 14. WARRANTIES
-- ============================================================

CREATE TABLE IF NOT EXISTS public.warranties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  sale_id UUID REFERENCES public.sales(id) ON DELETE SET NULL,
  client_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  serial_number TEXT,
  warranty_months INTEGER NOT NULL DEFAULT 12,
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE,
  status TEXT NOT NULL DEFAULT 'activa',
  notes TEXT,
  created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 15. CASH REGISTER
-- ============================================================

CREATE TABLE IF NOT EXISTS public.cash_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  cashier_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  opening_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  closing_amount NUMERIC(12,2),
  expected_amount NUMERIC(12,2),
  difference NUMERIC(12,2),
  status TEXT NOT NULL DEFAULT 'abierta',
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ,
  notes TEXT
);

-- ============================================================
-- 16. SYNC CONFIGURATION
-- ============================================================

CREATE TABLE IF NOT EXISTS public.sync_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module TEXT NOT NULL UNIQUE,
  is_realtime BOOLEAN NOT NULL DEFAULT false,
  sync_interval_minutes INTEGER NOT NULL DEFAULT 5,
  last_synced_at TIMESTAMPTZ,
  sync_status public.sync_status NOT NULL DEFAULT 'idle'::public.sync_status,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 17. INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON public.user_profiles(role);
CREATE INDEX IF NOT EXISTS idx_user_profiles_branch ON public.user_profiles(branch_id);
CREATE INDEX IF NOT EXISTS idx_products_code ON public.products(code);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON public.products(barcode);
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category_id);
CREATE INDEX IF NOT EXISTS idx_contacts_type ON public.contacts(type);
CREATE INDEX IF NOT EXISTS idx_contacts_rnc ON public.contacts(rnc);
CREATE INDEX IF NOT EXISTS idx_sales_date ON public.sales(sale_date);
CREATE INDEX IF NOT EXISTS idx_sales_client ON public.sales(client_id);
CREATE INDEX IF NOT EXISTS idx_sales_cashier ON public.sales(cashier_id);
CREATE INDEX IF NOT EXISTS idx_purchases_date ON public.purchases(purchase_date);
CREATE INDEX IF NOT EXISTS idx_purchases_supplier ON public.purchases(supplier_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON public.expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_product ON public.inventory_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_type ON public.inventory_movements(movement_type);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON public.role_permissions(role_id);

-- ============================================================
-- 18. FUNCTIONS
-- ============================================================

-- Auto-create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, full_name, avatar_url, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'cajero')::public.user_role
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Check if user is admin (uses auth metadata to avoid recursion)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users au
    WHERE au.id = auth.uid()
    AND (
      au.raw_user_meta_data->>'role' = 'admin'
      OR au.raw_app_meta_data->>'role' = 'admin'
    )
  )
$$;

-- Check user role from user_profiles (for non-user tables only)
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT role::TEXT FROM public.user_profiles WHERE id = auth.uid() LIMIT 1
$$;

-- Check if user has permission for a module
CREATE OR REPLACE FUNCTION public.has_module_permission(p_module TEXT, p_action TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_role TEXT;
  v_has_perm BOOLEAN := false;
BEGIN
  SELECT role::TEXT INTO v_role FROM public.user_profiles WHERE id = auth.uid() LIMIT 1;
  IF v_role = 'admin' THEN RETURN true; END IF;
  SELECT CASE p_action
    WHEN 'view'   THEN can_view
    WHEN 'create' THEN can_create
    WHEN 'edit'   THEN can_edit
    WHEN 'delete' THEN can_delete
    WHEN 'export' THEN can_export
    ELSE false
  END INTO v_has_perm
  FROM public.role_permissions rp
  JOIN public.roles r ON r.id = rp.role_id
  WHERE r.name = v_role AND rp.module = p_module
  LIMIT 1;
  RETURN COALESCE(v_has_perm, false);
END;
$$;

-- ============================================================
-- 19. ENABLE RLS
-- ============================================================

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tax_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_adjustment_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_transfer_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotation_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pre_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pre_sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.return_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warranties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_config ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 20. RLS POLICIES
-- ============================================================

-- user_profiles: own row + admin sees all
DROP POLICY IF EXISTS "users_own_profile" ON public.user_profiles;
CREATE POLICY "users_own_profile" ON public.user_profiles
  FOR ALL TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "admin_all_profiles" ON public.user_profiles;
CREATE POLICY "admin_all_profiles" ON public.user_profiles
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- roles: authenticated read, admin write
DROP POLICY IF EXISTS "authenticated_read_roles" ON public.roles;
CREATE POLICY "authenticated_read_roles" ON public.roles
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "admin_manage_roles" ON public.roles;
CREATE POLICY "admin_manage_roles" ON public.roles
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- role_permissions: authenticated read, admin write
DROP POLICY IF EXISTS "authenticated_read_role_permissions" ON public.role_permissions;
CREATE POLICY "authenticated_read_role_permissions" ON public.role_permissions
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "admin_manage_role_permissions" ON public.role_permissions;
CREATE POLICY "admin_manage_role_permissions" ON public.role_permissions
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- branches: authenticated read, admin write
DROP POLICY IF EXISTS "authenticated_read_branches" ON public.branches;
CREATE POLICY "authenticated_read_branches" ON public.branches
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "admin_manage_branches" ON public.branches;
CREATE POLICY "admin_manage_branches" ON public.branches
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Reference tables: authenticated read, admin/supervisor write
DROP POLICY IF EXISTS "authenticated_read_tax_rates" ON public.tax_rates;
CREATE POLICY "authenticated_read_tax_rates" ON public.tax_rates
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "admin_manage_tax_rates" ON public.tax_rates;
CREATE POLICY "admin_manage_tax_rates" ON public.tax_rates
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "authenticated_read_categories" ON public.categories;
CREATE POLICY "authenticated_read_categories" ON public.categories
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "authenticated_manage_categories" ON public.categories;
CREATE POLICY "authenticated_manage_categories" ON public.categories
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_read_brands" ON public.brands;
CREATE POLICY "authenticated_read_brands" ON public.brands
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "authenticated_manage_brands" ON public.brands;
CREATE POLICY "authenticated_manage_brands" ON public.brands
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_read_units" ON public.units;
CREATE POLICY "authenticated_read_units" ON public.units
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "authenticated_manage_units" ON public.units;
CREATE POLICY "authenticated_manage_units" ON public.units
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_read_price_groups" ON public.price_groups;
CREATE POLICY "authenticated_read_price_groups" ON public.price_groups
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "authenticated_manage_price_groups" ON public.price_groups;
CREATE POLICY "authenticated_manage_price_groups" ON public.price_groups
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- products: all authenticated
DROP POLICY IF EXISTS "authenticated_manage_products" ON public.products;
CREATE POLICY "authenticated_manage_products" ON public.products
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_manage_product_prices" ON public.product_prices;
CREATE POLICY "authenticated_manage_product_prices" ON public.product_prices
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- contacts: all authenticated
DROP POLICY IF EXISTS "authenticated_manage_contacts" ON public.contacts;
CREATE POLICY "authenticated_manage_contacts" ON public.contacts
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- inventory: all authenticated
DROP POLICY IF EXISTS "authenticated_manage_inventory_movements" ON public.inventory_movements;
CREATE POLICY "authenticated_manage_inventory_movements" ON public.inventory_movements
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_manage_stock_adjustments" ON public.stock_adjustments;
CREATE POLICY "authenticated_manage_stock_adjustments" ON public.stock_adjustments
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_manage_stock_adjustment_items" ON public.stock_adjustment_items;
CREATE POLICY "authenticated_manage_stock_adjustment_items" ON public.stock_adjustment_items
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_manage_stock_transfers" ON public.stock_transfers;
CREATE POLICY "authenticated_manage_stock_transfers" ON public.stock_transfers
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_manage_stock_transfer_items" ON public.stock_transfer_items;
CREATE POLICY "authenticated_manage_stock_transfer_items" ON public.stock_transfer_items
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- purchases: all authenticated
DROP POLICY IF EXISTS "authenticated_manage_purchases" ON public.purchases;
CREATE POLICY "authenticated_manage_purchases" ON public.purchases
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_manage_purchase_items" ON public.purchase_items;
CREATE POLICY "authenticated_manage_purchase_items" ON public.purchase_items
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- sales: all authenticated
DROP POLICY IF EXISTS "authenticated_manage_sales" ON public.sales;
CREATE POLICY "authenticated_manage_sales" ON public.sales
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_manage_sale_items" ON public.sale_items;
CREATE POLICY "authenticated_manage_sale_items" ON public.sale_items
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- quotations: all authenticated
DROP POLICY IF EXISTS "authenticated_manage_quotations" ON public.quotations;
CREATE POLICY "authenticated_manage_quotations" ON public.quotations
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_manage_quotation_items" ON public.quotation_items;
CREATE POLICY "authenticated_manage_quotation_items" ON public.quotation_items
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- pre_sales: all authenticated
DROP POLICY IF EXISTS "authenticated_manage_pre_sales" ON public.pre_sales;
CREATE POLICY "authenticated_manage_pre_sales" ON public.pre_sales
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_manage_pre_sale_items" ON public.pre_sale_items;
CREATE POLICY "authenticated_manage_pre_sale_items" ON public.pre_sale_items
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- returns: all authenticated
DROP POLICY IF EXISTS "authenticated_manage_returns" ON public.returns;
CREATE POLICY "authenticated_manage_returns" ON public.returns
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_manage_return_items" ON public.return_items;
CREATE POLICY "authenticated_manage_return_items" ON public.return_items
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- expenses: all authenticated
DROP POLICY IF EXISTS "authenticated_manage_expenses" ON public.expenses;
CREATE POLICY "authenticated_manage_expenses" ON public.expenses
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- discounts: all authenticated
DROP POLICY IF EXISTS "authenticated_manage_discounts" ON public.discounts;
CREATE POLICY "authenticated_manage_discounts" ON public.discounts
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- shipments: all authenticated
DROP POLICY IF EXISTS "authenticated_manage_shipments" ON public.shipments;
CREATE POLICY "authenticated_manage_shipments" ON public.shipments
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- warranties: all authenticated
DROP POLICY IF EXISTS "authenticated_manage_warranties" ON public.warranties;
CREATE POLICY "authenticated_manage_warranties" ON public.warranties
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- cash_sessions: all authenticated
DROP POLICY IF EXISTS "authenticated_manage_cash_sessions" ON public.cash_sessions;
CREATE POLICY "authenticated_manage_cash_sessions" ON public.cash_sessions
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- sync_config: admin only
DROP POLICY IF EXISTS "admin_manage_sync_config" ON public.sync_config;
CREATE POLICY "admin_manage_sync_config" ON public.sync_config
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "authenticated_read_sync_config" ON public.sync_config;
CREATE POLICY "authenticated_read_sync_config" ON public.sync_config
  FOR SELECT TO authenticated USING (true);

-- ============================================================
-- 21. TRIGGERS
-- ============================================================

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

DROP TRIGGER IF EXISTS set_user_profiles_updated_at ON public.user_profiles;
CREATE TRIGGER set_user_profiles_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_products_updated_at ON public.products;
CREATE TRIGGER set_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_contacts_updated_at ON public.contacts;
CREATE TRIGGER set_contacts_updated_at
  BEFORE UPDATE ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_sales_updated_at ON public.sales;
CREATE TRIGGER set_sales_updated_at
  BEFORE UPDATE ON public.sales
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_purchases_updated_at ON public.purchases;
CREATE TRIGGER set_purchases_updated_at
  BEFORE UPDATE ON public.purchases
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_expenses_updated_at ON public.expenses;
CREATE TRIGGER set_expenses_updated_at
  BEFORE UPDATE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_sync_config_updated_at ON public.sync_config;
CREATE TRIGGER set_sync_config_updated_at
  BEFORE UPDATE ON public.sync_config
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 22. MOCK DATA
-- ============================================================

DO $$
DECLARE
  admin_uuid UUID := gen_random_uuid();
  cajero_uuid UUID := gen_random_uuid();
  vendedor_uuid UUID := gen_random_uuid();
  almacenista_uuid UUID := gen_random_uuid();
  contador_uuid UUID := gen_random_uuid();
  branch_uuid UUID := gen_random_uuid();
  branch2_uuid UUID := gen_random_uuid();
  role_admin_uuid UUID := gen_random_uuid();
  role_cajero_uuid UUID := gen_random_uuid();
  role_vendedor_uuid UUID := gen_random_uuid();
  role_almacenista_uuid UUID := gen_random_uuid();
  role_contador_uuid UUID := gen_random_uuid();
  tax_itbis_uuid UUID := gen_random_uuid();
  tax_exento_uuid UUID := gen_random_uuid();
  cat_alimentos_uuid UUID := gen_random_uuid();
  cat_bebidas_uuid UUID := gen_random_uuid();
  cat_limpieza_uuid UUID := gen_random_uuid();
  brand_uuid UUID := gen_random_uuid();
  unit_uuid UUID := gen_random_uuid();
  unit_lt_uuid UUID := gen_random_uuid();
  pg_mayorista_uuid UUID := gen_random_uuid();
  prod1_uuid UUID := gen_random_uuid();
  prod2_uuid UUID := gen_random_uuid();
  prod3_uuid UUID := gen_random_uuid();
  client1_uuid UUID := gen_random_uuid();
  client2_uuid UUID := gen_random_uuid();
  supplier1_uuid UUID := gen_random_uuid();
  sale1_uuid UUID := gen_random_uuid();
  purchase1_uuid UUID := gen_random_uuid();
BEGIN
  -- Auth users
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    created_at, updated_at, raw_user_meta_data, raw_app_meta_data,
    is_sso_user, is_anonymous, confirmation_token, confirmation_sent_at,
    recovery_token, recovery_sent_at, email_change_token_new, email_change,
    email_change_sent_at, email_change_token_current, email_change_confirm_status,
    reauthentication_token, reauthentication_sent_at, phone, phone_change,
    phone_change_token, phone_change_sent_at
  ) VALUES
    (admin_uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'admin@marketerp.do', crypt('Admin123!', gen_salt('bf', 10)), now(), now(), now(),
     jsonb_build_object('full_name', 'Admin General', 'role', 'admin'),
     jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[], 'role', 'admin'),
     false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null),
    (cajero_uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'cajero@marketerp.do', crypt('Cajero123!', gen_salt('bf', 10)), now(), now(), now(),
     jsonb_build_object('full_name', 'Maria Garcia', 'role', 'cajero'),
     jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
     false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null),
    (vendedor_uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'vendedor@marketerp.do', crypt('Vendedor123!', gen_salt('bf', 10)), now(), now(), now(),
     jsonb_build_object('full_name', 'Carlos Lopez', 'role', 'vendedor'),
     jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
     false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null),
    (almacenista_uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'almacen@marketerp.do', crypt('Almacen123!', gen_salt('bf', 10)), now(), now(), now(),
     jsonb_build_object('full_name', 'Ana Martinez', 'role', 'almacenista'),
     jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
     false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null),
    (contador_uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'contador@marketerp.do', crypt('Contador123!', gen_salt('bf', 10)), now(), now(), now(),
     jsonb_build_object('full_name', 'Pedro Sanchez', 'role', 'contador'),
     jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
     false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null)
  ON CONFLICT (id) DO NOTHING;

  -- Branches
  INSERT INTO public.branches (id, name, address, phone, is_active) VALUES
    (branch_uuid, 'Sucursal Principal', 'Av. 27 de Febrero #100, Santo Domingo', '809-555-0001', true),
    (branch2_uuid, 'Sucursal Norte', 'Calle del Sol #45, Santiago', '809-555-0002', true)
  ON CONFLICT (id) DO NOTHING;

  -- Roles
  INSERT INTO public.roles (id, name, description, color, is_system) VALUES
    (role_admin_uuid, 'Administrador', 'Acceso total al sistema', 'bg-danger/10 text-danger', true),
    (role_cajero_uuid, 'Cajero', 'Acceso al POS y ventas', 'bg-primary/10 text-primary', true),
    (role_vendedor_uuid, 'Vendedor', 'Ventas y cotizaciones', 'bg-success/10 text-success', true),
    (role_almacenista_uuid, 'Almacenista', 'Gestion de inventario', 'bg-warning/10 text-warning', true),
    (role_contador_uuid, 'Contador', 'Informes y finanzas', 'bg-info/10 text-info', true)
  ON CONFLICT (id) DO NOTHING;

  -- Role permissions
  INSERT INTO public.role_permissions (role_id, module, can_view, can_create, can_edit, can_delete, can_export) VALUES
    -- Admin: all
    (role_admin_uuid, 'Dashboard', true, true, true, true, true),
    (role_admin_uuid, 'Ventas', true, true, true, true, true),
    (role_admin_uuid, 'Compras', true, true, true, true, true),
    (role_admin_uuid, 'Productos', true, true, true, true, true),
    (role_admin_uuid, 'Inventario', true, true, true, true, true),
    (role_admin_uuid, 'Contactos', true, true, true, true, true),
    (role_admin_uuid, 'Gastos', true, true, true, true, true),
    (role_admin_uuid, 'Usuarios', true, true, true, true, true),
    (role_admin_uuid, 'Reportes', true, true, true, true, true),
    (role_admin_uuid, 'Configuracion', true, true, true, true, true),
    -- Cajero
    (role_cajero_uuid, 'Dashboard', true, false, false, false, false),
    (role_cajero_uuid, 'Ventas', true, true, true, false, true),
    (role_cajero_uuid, 'Compras', false, false, false, false, false),
    (role_cajero_uuid, 'Productos', true, false, false, false, false),
    (role_cajero_uuid, 'Inventario', true, false, false, false, false),
    (role_cajero_uuid, 'Contactos', true, true, true, false, false),
    (role_cajero_uuid, 'Gastos', false, false, false, false, false),
    (role_cajero_uuid, 'Usuarios', false, false, false, false, false),
    (role_cajero_uuid, 'Reportes', false, false, false, false, false),
    (role_cajero_uuid, 'Configuracion', false, false, false, false, false),
    -- Vendedor
    (role_vendedor_uuid, 'Dashboard', true, false, false, false, false),
    (role_vendedor_uuid, 'Ventas', true, true, true, false, true),
    (role_vendedor_uuid, 'Compras', false, false, false, false, false),
    (role_vendedor_uuid, 'Productos', true, false, false, false, true),
    (role_vendedor_uuid, 'Inventario', true, false, false, false, false),
    (role_vendedor_uuid, 'Contactos', true, true, true, false, true),
    (role_vendedor_uuid, 'Gastos', false, false, false, false, false),
    (role_vendedor_uuid, 'Usuarios', false, false, false, false, false),
    (role_vendedor_uuid, 'Reportes', true, false, false, false, true),
    (role_vendedor_uuid, 'Configuracion', false, false, false, false, false),
    -- Almacenista
    (role_almacenista_uuid, 'Dashboard', true, false, false, false, false),
    (role_almacenista_uuid, 'Ventas', false, false, false, false, false),
    (role_almacenista_uuid, 'Compras', true, true, true, false, true),
    (role_almacenista_uuid, 'Productos', true, true, true, false, true),
    (role_almacenista_uuid, 'Inventario', true, true, true, false, true),
    (role_almacenista_uuid, 'Contactos', true, false, false, false, false),
    (role_almacenista_uuid, 'Gastos', false, false, false, false, false),
    (role_almacenista_uuid, 'Usuarios', false, false, false, false, false),
    (role_almacenista_uuid, 'Reportes', true, false, false, false, true),
    (role_almacenista_uuid, 'Configuracion', false, false, false, false, false),
    -- Contador
    (role_contador_uuid, 'Dashboard', true, false, false, false, true),
    (role_contador_uuid, 'Ventas', true, false, false, false, true),
    (role_contador_uuid, 'Compras', true, false, false, false, true),
    (role_contador_uuid, 'Productos', true, false, false, false, true),
    (role_contador_uuid, 'Inventario', true, false, false, false, true),
    (role_contador_uuid, 'Contactos', true, false, false, false, true),
    (role_contador_uuid, 'Gastos', true, true, true, false, true),
    (role_contador_uuid, 'Usuarios', false, false, false, false, false),
    (role_contador_uuid, 'Reportes', true, false, false, false, true),
    (role_contador_uuid, 'Configuracion', false, false, false, false, false)
  ON CONFLICT (role_id, module) DO NOTHING;

  -- Tax rates
  INSERT INTO public.tax_rates (id, name, rate, is_active) VALUES
    (tax_itbis_uuid, 'ITBIS 18%', 18.00, true),
    (tax_exento_uuid, 'Exento', 0.00, true),
    (gen_random_uuid(), 'ITBIS 16%', 16.00, true),
    (gen_random_uuid(), 'ISC Bebidas 10%', 10.00, true)
  ON CONFLICT (id) DO NOTHING;

  -- Categories
  INSERT INTO public.categories (id, name, description) VALUES
    (cat_alimentos_uuid, 'Alimentos', 'Productos alimenticios'),
    (cat_bebidas_uuid, 'Bebidas', 'Bebidas y refrescos'),
    (cat_limpieza_uuid, 'Limpieza', 'Productos de limpieza y hogar')
  ON CONFLICT (id) DO NOTHING;

  -- Brands
  INSERT INTO public.brands (id, name, country) VALUES
    (brand_uuid, 'Marca Propia', 'República Dominicana'),
    (gen_random_uuid(), 'Nestlé', 'Suiza'),
    (gen_random_uuid(), 'Colgate', 'Estados Unidos')
  ON CONFLICT (id) DO NOTHING;

  -- Units
  INSERT INTO public.units (id, name, abbreviation, type) VALUES
    (unit_uuid, 'Unidad', 'und', 'unidad'),
    (unit_lt_uuid, 'Litro', 'lt', 'volumen'),
    (gen_random_uuid(), 'Kilogramo', 'kg', 'peso'),
    (gen_random_uuid(), 'Caja', 'cja', 'unidad')
  ON CONFLICT (id) DO NOTHING;

  -- Price groups
  INSERT INTO public.price_groups (id, name, description, discount_percent, is_active) VALUES
    (pg_mayorista_uuid, 'Mayorista', 'Precios para clientes mayoristas', 10.00, true),
    (gen_random_uuid(), 'Minorista', 'Precio de venta al detalle', 0.00, true),
    (gen_random_uuid(), 'VIP', 'Clientes especiales', 15.00, true)
  ON CONFLICT (id) DO NOTHING;

  -- Products
  INSERT INTO public.products (id, code, barcode, name, category_id, brand_id, unit_id, tax_rate_id, cost_price, sale_price, min_stock, current_stock, is_active) VALUES
    (prod1_uuid, 'PRD-001', '7501234567890', 'Arroz Blanco 5lb', cat_alimentos_uuid, brand_uuid, unit_uuid, tax_exento_uuid, 120.00, 165.00, 10, 85, true),
    (prod2_uuid, 'PRD-002', '7501234567891', 'Aceite Vegetal 1lt', cat_alimentos_uuid, brand_uuid, unit_lt_uuid, tax_itbis_uuid, 95.00, 145.00, 5, 42, true),
    (prod3_uuid, 'PRD-003', '7501234567892', 'Detergente 1kg', cat_limpieza_uuid, brand_uuid, unit_uuid, tax_itbis_uuid, 75.00, 110.00, 8, 3, true)
  ON CONFLICT (id) DO NOTHING;

  -- Contacts
  INSERT INTO public.contacts (id, type, name, rnc, email, phone, address, credit_limit, is_active) VALUES
    (client1_uuid, 'cliente'::public.contact_type, 'Supermercado El Buen Precio', '131-00001-1', 'compras@buenprecio.do', '809-555-1001', 'Av. Independencia #50', 50000.00, true),
    (client2_uuid, 'cliente'::public.contact_type, 'Colmado La Esquina', null, null, '809-555-1002', 'Calle 5 #12', 0.00, true),
    (supplier1_uuid, 'proveedor'::public.contact_type, 'Distribuidora Nacional SA', '131-00002-2', 'ventas@disnacional.do', '809-555-2001', 'Zona Industrial, Santo Domingo', 0.00, true)
  ON CONFLICT (id) DO NOTHING;

  -- Sample sale
  INSERT INTO public.sales (id, code, client_id, branch_id, cashier_id, status, subtotal, tax_amount, total, payment_method, payment_status, ncf, ncf_type, sale_date, created_by) VALUES
    (sale1_uuid, 'VTA-0001', client1_uuid, branch_uuid, admin_uuid, 'completado'::public.document_status, 1271.19, 228.81, 1500.00, 'efectivo'::public.payment_method, 'pagado', 'B0200000001', 'B02', CURRENT_DATE, admin_uuid)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.sale_items (sale_id, product_id, quantity, unit_price, tax_rate, subtotal) VALUES
    (sale1_uuid, prod1_uuid, 5, 165.00, 0, 825.00),
    (sale1_uuid, prod2_uuid, 3, 145.00, 18, 435.00),
    (sale1_uuid, prod3_uuid, 2, 110.00, 18, 220.00)
  ON CONFLICT (id) DO NOTHING;

  -- Sample purchase
  INSERT INTO public.purchases (id, code, supplier_id, branch_id, status, subtotal, tax_amount, total, payment_method, payment_status, purchase_date, created_by) VALUES
    (purchase1_uuid, 'CMP-0001', supplier1_uuid, branch_uuid, 'completado'::public.document_status, 8474.58, 1525.42, 10000.00, 'transferencia'::public.payment_method, 'pagado', CURRENT_DATE, admin_uuid)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.purchase_items (purchase_id, product_id, quantity, unit_cost, tax_rate, subtotal) VALUES
    (purchase1_uuid, prod1_uuid, 50, 120.00, 0, 6000.00),
    (purchase1_uuid, prod2_uuid, 20, 95.00, 18, 1900.00),
    (purchase1_uuid, prod3_uuid, 10, 75.00, 18, 750.00)
  ON CONFLICT (id) DO NOTHING;

  -- Sample expense
  INSERT INTO public.expenses (code, category, description, amount, payment_method, branch_id, expense_date, created_by) VALUES
    ('GAS-0001', 'alquiler'::public.expense_category, 'Alquiler local mes de enero', 25000.00, 'transferencia'::public.payment_method, branch_uuid, CURRENT_DATE, admin_uuid),
    ('GAS-0002', 'servicios'::public.expense_category, 'Factura de electricidad', 8500.00, 'efectivo'::public.payment_method, branch_uuid, CURRENT_DATE, admin_uuid)
  ON CONFLICT (code) DO NOTHING;

  -- Sync config defaults
  INSERT INTO public.sync_config (module, is_realtime, sync_interval_minutes, sync_status) VALUES
    ('Ventas', true, 1, 'idle'::public.sync_status),
    ('Inventario', true, 1, 'idle'::public.sync_status),
    ('Compras', false, 5, 'idle'::public.sync_status),
    ('Contactos', false, 10, 'idle'::public.sync_status),
    ('Productos', false, 5, 'idle'::public.sync_status),
    ('Gastos', false, 15, 'idle'::public.sync_status),
    ('Usuarios', false, 30, 'idle'::public.sync_status),
    ('Reportes', false, 60, 'idle'::public.sync_status)
  ON CONFLICT (module) DO NOTHING;

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Mock data error: %', SQLERRM;
END $$;
