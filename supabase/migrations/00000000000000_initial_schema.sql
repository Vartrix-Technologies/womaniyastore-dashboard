-- ============================================================================
-- FOUNDATIONAL MIGRATION: Initial Schema
-- ============================================================================
-- This migration creates the base tables, enums, and views that were
-- originally created via the Supabase Dashboard and never captured in a
-- migration file. All subsequent migrations depend on these objects.
--
-- Generated from the live Supabase schema (supabase.ts type export).
-- ============================================================================

-- ============================================================================
-- STEP 1: Create custom ENUM types
-- ============================================================================

CREATE TYPE public.user_role AS ENUM ('superadmin', 'owner', 'admin', 'staff');

CREATE TYPE public.attendance_status AS ENUM ('open', 'closed');

CREATE TYPE public.checklist_item_status AS ENUM ('pending', 'done', 'na');

CREATE TYPE public.checklist_status AS ENUM ('pending', 'completed', 'partial');

CREATE TYPE public.financial_tx_type AS ENUM ('sale', 'expense', 'adjustment');

CREATE TYPE public.inventory_status AS ENUM ('available', 'reserved', 'sold', 'damaged', 'returned');

CREATE TYPE public.qr_status AS ENUM ('unused', 'assigned', 'sold', 'lost');


-- ============================================================================
-- STEP 2: Create tables (in dependency order)
-- ============================================================================

-- ── shops (root table — no FK dependencies) ──────────────────────────────────
CREATE TABLE public.shops (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_name   TEXT NOT NULL,
  address     TEXT,
  phone       TEXT,
  tax_rate    DECIMAL(5,2) NOT NULL DEFAULT 0,
  bill_prefix VARCHAR(10) NOT NULL DEFAULT 'BILL',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── profiles (depends on shops) ──────────────────────────────────────────────
CREATE TABLE public.profiles (
  id                    UUID PRIMARY KEY,           -- FK to auth.users(id)
  full_name             TEXT NOT NULL,
  phone                 TEXT,
  role                  public.user_role NOT NULL DEFAULT 'staff',
  shop_id               UUID REFERENCES public.shops(id),
  is_active             BOOLEAN NOT NULL DEFAULT true,
  max_discount_percent  DECIMAL NOT NULL DEFAULT 0,
  must_change_password  BOOLEAN DEFAULT NULL,
  password_changed_at   TIMESTAMPTZ,
  created_by            UUID,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── categories (depends on shops) ────────────────────────────────────────────
CREATE TABLE public.categories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  description TEXT,
  shop_id     UUID NOT NULL REFERENCES public.shops(id),
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── sizes (depends on shops) ─────────────────────────────────────────────────
CREATE TABLE public.sizes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  size_name   TEXT NOT NULL,
  shop_id     UUID NOT NULL REFERENCES public.shops(id),
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── lots (depends on shops, categories, sizes, profiles) ─────────────────────
CREATE TABLE public.lots (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id                 UUID NOT NULL REFERENCES public.shops(id),
  category_id             UUID REFERENCES public.categories(id),
  size_id                 UUID REFERENCES public.sizes(id),
  free_text_size          TEXT,
  vendor_name             TEXT,
  date_of_stock_arrival   DATE NOT NULL,
  cost_price_per_unit     DECIMAL NOT NULL,
  selling_price_default   DECIMAL NOT NULL,
  tax_rate                DECIMAL NOT NULL DEFAULT 0,
  quantity                INTEGER NOT NULL,
  min_margin_percent      DECIMAL,
  sale_type               TEXT,
  sale_reason             TEXT,
  created_by              UUID REFERENCES public.profiles(id),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── qr_codes (depends on shops; prefix_id FK added after qr_prefixes is created) ─
CREATE TABLE public.qr_codes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code            TEXT NOT NULL,
  shop_id         UUID NOT NULL REFERENCES public.shops(id),
  status          public.qr_status NOT NULL DEFAULT 'unused',
  assigned_at     TIMESTAMPTZ,
  sold_at         TIMESTAMPTZ,
  prefix_id       UUID,              -- FK added by 20260110 migration after qr_prefixes table exists
  sequence_number INTEGER,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── sales (depends on shops, profiles) ───────────────────────────────────────
CREATE TABLE public.sales (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id         UUID NOT NULL REFERENCES public.shops(id),
  bill_number     BIGINT,
  client_sale_id  TEXT,
  customer_name   TEXT,
  customer_phone  TEXT,
  subtotal_amount DECIMAL NOT NULL,
  total_discount  DECIMAL NOT NULL,
  total_tax       DECIMAL NOT NULL DEFAULT 0,
  total_amount    DECIMAL NOT NULL,
  payment_method  TEXT NOT NULL,
  created_by      UUID REFERENCES public.profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── inventory_items (depends on shops, lots, qr_codes) ──────────────────────
CREATE TABLE public.inventory_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id       UUID NOT NULL REFERENCES public.shops(id),
  lot_id        UUID NOT NULL REFERENCES public.lots(id),
  qr_code_id    UUID NOT NULL UNIQUE REFERENCES public.qr_codes(id),
  sale_item_id  UUID,                   -- FK added after sale_items table exists
  status        public.inventory_status NOT NULL DEFAULT 'available',
  sold_at       TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── sale_items (depends on shops, sales, inventory_items) ────────────────────
CREATE TABLE public.sale_items (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id             UUID NOT NULL REFERENCES public.shops(id),
  sale_id             UUID NOT NULL REFERENCES public.sales(id),
  inventory_item_id   UUID NOT NULL UNIQUE REFERENCES public.inventory_items(id),
  original_price      DECIMAL NOT NULL,
  final_price         DECIMAL NOT NULL,
  tax_amount          DECIMAL NOT NULL DEFAULT 0,
  discount_reason     TEXT,
  sold_on_sale        BOOLEAN NOT NULL DEFAULT false,
  sale_type           TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add FK from inventory_items.sale_item_id → sale_items.id
ALTER TABLE public.inventory_items
  ADD CONSTRAINT inventory_items_sale_item_fk
    FOREIGN KEY (sale_item_id) REFERENCES public.sale_items(id);

-- ── sale_returns (depends on shops, sales, profiles) ─────────────────────────
CREATE TABLE public.sale_returns (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id           UUID NOT NULL REFERENCES public.shops(id),
  original_sale_id  UUID NOT NULL REFERENCES public.sales(id),
  return_sale_id    UUID REFERENCES public.sales(id),
  processed_by      UUID REFERENCES public.profiles(id),
  returned_items    JSONB NOT NULL,
  refund_amount     DECIMAL,
  return_reason     TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── inventory_adjustments (depends on shops, inventory_items, profiles) ──────
CREATE TABLE public.inventory_adjustments (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id             UUID NOT NULL REFERENCES public.shops(id),
  inventory_item_id   UUID NOT NULL REFERENCES public.inventory_items(id),
  old_status          public.inventory_status NOT NULL,
  new_status          public.inventory_status NOT NULL,
  reason              TEXT NOT NULL,
  adjusted_by         UUID REFERENCES public.profiles(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── attendance_logs (depends on shops, profiles) ─────────────────────────────
CREATE TABLE public.attendance_logs (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id               UUID NOT NULL REFERENCES public.shops(id),
  staff_id              UUID NOT NULL REFERENCES public.profiles(id),
  date                  DATE NOT NULL,
  clock_in              TIMESTAMPTZ NOT NULL,
  clock_out             TIMESTAMPTZ,
  status                public.attendance_status NOT NULL DEFAULT 'open',
  total_break_minutes   INTEGER NOT NULL DEFAULT 0,
  is_manual_entry       BOOLEAN DEFAULT NULL,
  manual_entry_reason   TEXT,
  edited_by             UUID REFERENCES public.profiles(id),
  edited_at             TIMESTAMPTZ,
  edit_reason           TEXT,
  deleted_at            TIMESTAMPTZ,
  deleted_by            UUID REFERENCES public.profiles(id),
  delete_reason         TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── checklists (depends on shops, profiles) ──────────────────────────────────
CREATE TABLE public.checklists (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id         UUID NOT NULL REFERENCES public.shops(id),
  name            TEXT NOT NULL,
  description     TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  recurrence_type TEXT,
  recurrence_days INTEGER[],
  created_by      UUID REFERENCES public.profiles(id),
  updated_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── checklist_items (depends on checklists) ──────────────────────────────────
CREATE TABLE public.checklist_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_id  UUID NOT NULL REFERENCES public.checklists(id),
  label         TEXT NOT NULL,
  sort_order    INTEGER NOT NULL DEFAULT 0
);

-- ── tax_settings (depends on shops) ──────────────────────────────────────────
CREATE TABLE public.tax_settings (
  shop_id           UUID PRIMARY KEY REFERENCES public.shops(id),
  default_tax_rate  DECIMAL NOT NULL DEFAULT 0,
  gst_number        TEXT,
  is_tax_inclusive   BOOLEAN NOT NULL DEFAULT false
);


-- ============================================================================
-- STEP 3: Convenience helper functions used by RLS policies
-- ============================================================================
-- These are created here so that the subsequent migration files (which set up
-- RLS policies referencing these functions) can run without errors.
-- They are later re-created with SET search_path in 20260208 migration.

CREATE OR REPLACE FUNCTION public.current_profile()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT id FROM public.profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.current_role()
RETURNS public.user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.current_shop_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT shop_id FROM public.profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role IN ('superadmin', 'owner', 'admin')
  )
$$;

CREATE OR REPLACE FUNCTION public.is_staff_or_higher()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role IN ('superadmin', 'owner', 'admin', 'staff')
  )
$$;

CREATE OR REPLACE FUNCTION public.is_superadmin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'superadmin'
  )
$$;


-- ============================================================================
-- STEP 4: Enable RLS on all tables
-- ============================================================================
-- RLS policies are created by subsequent migration files.
-- We enable RLS here so those files don't need to worry about it.

ALTER TABLE public.shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sizes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qr_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tax_settings ENABLE ROW LEVEL SECURITY;

-- ── Basic RLS policies for tables not covered by later migrations ───────────

-- shops: all authenticated users can read their own shop
CREATE POLICY "shops_select" ON public.shops
  FOR SELECT TO authenticated
  USING (id = (SELECT current_shop_id()) OR (SELECT is_superadmin()));

-- categories: shop-scoped CRUD
CREATE POLICY "categories_select" ON public.categories
  FOR SELECT TO authenticated
  USING (shop_id = (SELECT current_shop_id()));

CREATE POLICY "categories_insert" ON public.categories
  FOR INSERT TO authenticated
  WITH CHECK (shop_id = (SELECT current_shop_id()) AND (SELECT is_admin()));

CREATE POLICY "categories_update" ON public.categories
  FOR UPDATE TO authenticated
  USING (shop_id = (SELECT current_shop_id()) AND (SELECT is_admin()));

CREATE POLICY "categories_delete" ON public.categories
  FOR DELETE TO authenticated
  USING (shop_id = (SELECT current_shop_id()) AND (SELECT is_admin()));

-- sizes: shop-scoped CRUD
CREATE POLICY "sizes_select" ON public.sizes
  FOR SELECT TO authenticated
  USING (shop_id = (SELECT current_shop_id()));

CREATE POLICY "sizes_insert" ON public.sizes
  FOR INSERT TO authenticated
  WITH CHECK (shop_id = (SELECT current_shop_id()) AND (SELECT is_admin()));

CREATE POLICY "sizes_update" ON public.sizes
  FOR UPDATE TO authenticated
  USING (shop_id = (SELECT current_shop_id()) AND (SELECT is_admin()));

CREATE POLICY "sizes_delete" ON public.sizes
  FOR DELETE TO authenticated
  USING (shop_id = (SELECT current_shop_id()) AND (SELECT is_admin()));

-- sale_items: shop-scoped read + insert (via edge function mostly)
CREATE POLICY "sale_items_select" ON public.sale_items
  FOR SELECT TO authenticated
  USING (shop_id = (SELECT current_shop_id()));

CREATE POLICY "sale_items_insert" ON public.sale_items
  FOR INSERT TO authenticated
  WITH CHECK (shop_id = (SELECT current_shop_id()));

CREATE POLICY "sale_items_update" ON public.sale_items
  FOR UPDATE TO authenticated
  USING (shop_id = (SELECT current_shop_id()));

CREATE POLICY "sale_items_delete" ON public.sale_items
  FOR DELETE TO authenticated
  USING (shop_id = (SELECT current_shop_id()) AND (SELECT is_admin()));

-- inventory_adjustments: shop-scoped
CREATE POLICY "inventory_adjustments_select" ON public.inventory_adjustments
  FOR SELECT TO authenticated
  USING (shop_id = (SELECT current_shop_id()));

CREATE POLICY "inventory_adjustments_insert" ON public.inventory_adjustments
  FOR INSERT TO authenticated
  WITH CHECK (shop_id = (SELECT current_shop_id()) AND (SELECT is_admin()));

-- tax_settings: shop-scoped
CREATE POLICY "tax_settings_select" ON public.tax_settings
  FOR SELECT TO authenticated
  USING (shop_id = (SELECT current_shop_id()));

CREATE POLICY "tax_settings_update" ON public.tax_settings
  FOR UPDATE TO authenticated
  USING (shop_id = (SELECT current_shop_id()) AND (SELECT is_admin()));

CREATE POLICY "tax_settings_insert" ON public.tax_settings
  FOR INSERT TO authenticated
  WITH CHECK (shop_id = (SELECT current_shop_id()) AND (SELECT is_admin()));


-- ============================================================================
-- STEP 5: Basic indexes on core FK columns
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_profiles_shop_id ON public.profiles(shop_id);
CREATE INDEX IF NOT EXISTS idx_categories_shop_id ON public.categories(shop_id);
CREATE INDEX IF NOT EXISTS idx_sizes_shop_id ON public.sizes(shop_id);
CREATE INDEX IF NOT EXISTS idx_lots_shop_id ON public.lots(shop_id);
CREATE INDEX IF NOT EXISTS idx_lots_category_id ON public.lots(category_id);
CREATE INDEX IF NOT EXISTS idx_qr_codes_shop_id ON public.qr_codes(shop_id);
CREATE INDEX IF NOT EXISTS idx_qr_codes_status ON public.qr_codes(status);
CREATE INDEX IF NOT EXISTS idx_sales_shop_id ON public.sales(shop_id);
CREATE INDEX IF NOT EXISTS idx_inventory_items_shop_id ON public.inventory_items(shop_id);
CREATE INDEX IF NOT EXISTS idx_inventory_items_lot_id ON public.inventory_items(lot_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON public.sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_shop_id ON public.sale_items(shop_id);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_shop_id ON public.attendance_logs(shop_id);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_staff_id ON public.attendance_logs(staff_id);
CREATE INDEX IF NOT EXISTS idx_checklists_shop_id ON public.checklists(shop_id);
CREATE INDEX IF NOT EXISTS idx_checklist_items_checklist_id ON public.checklist_items(checklist_id);
