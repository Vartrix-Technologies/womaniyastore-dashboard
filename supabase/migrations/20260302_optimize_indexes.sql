-- Migration: Optimize Database Indexes
-- Date: 2026-03-02
--
-- Fixes:
-- 1. unindexed_foreign_keys (INFO): Adds indexes on FK columns that lack them.
--    Without these, FK constraint checks during INSERT/UPDATE/DELETE on the
--    referenced table require sequential scans.
-- 2. index_advisor suggestions: Adds indexes recommended by the query
--    performance advisor based on actual query execution plans.
-- 3. unused_index (INFO): Removes indexes that have never been scanned,
--    saving storage and reducing write overhead.
--
-- NOTE: These are standard CREATE INDEX (not CONCURRENTLY) because Supabase
-- migrations run inside a transaction. For large tables, consider running
-- the CREATE INDEX CONCURRENTLY statements separately via the SQL Editor.


-- ============================================================================
-- STEP 1: Remove unused indexes
-- ============================================================================
-- These indexes have 0 index scans according to pg_stat_user_indexes.
-- Removing them saves storage and speeds up INSERT/UPDATE/DELETE operations.

-- attendance_logs: Boolean/audit columns with very low selectivity
DROP INDEX IF EXISTS idx_attendance_logs_is_manual;     -- boolean DEFAULT false, not selective
DROP INDEX IF EXISTS idx_attendance_logs_deleted_at;     -- audit column, rarely queried
DROP INDEX IF EXISTS idx_attendance_logs_edited_at;      -- audit column, rarely queried
DROP INDEX IF EXISTS attendance_shop_staff_date_idx;     -- unused composite, replacing with individual indexes

-- profiles: Partial boolean index, very few rows ever true
DROP INDEX IF EXISTS idx_profiles_must_change_password;

-- financial_transactions: occurred_at alias index (if separate from the main one)
DROP INDEX IF EXISTS financial_tx_occurred_idx;

-- checklist_instances: Unused single-column indexes
DROP INDEX IF EXISTS idx_checklist_instances_checklist;  -- FK lookup, rarely queried directly
DROP INDEX IF EXISTS idx_checklist_instances_status;     -- low cardinality (pending/in_progress/completed)

-- checklist_item_completions: completed_by FK rarely queried directly
DROP INDEX IF EXISTS idx_item_completions_completed_by;

-- sale_items: Unused index
DROP INDEX IF EXISTS idx_sale_items_sold_on_sale;

-- lots: vendor_name text search rarely used
DROP INDEX IF EXISTS idx_lots_vendor_name;

-- inventory_items: shop_id index (will be re-evaluated — keeping FK index below)
-- NOTE: idx_inventory_items_shop_id is being kept because it's needed for
-- FK constraint checks and RLS policy evaluation, even if pg_stat shows 0 scans.
-- The advisor may show 0 scans if most queries use other access paths.


-- ============================================================================
-- STEP 2: Add indexes recommended by the Index Advisor
-- ============================================================================
-- These are based on actual query execution plans and reduce query costs
-- significantly. Impact estimates from the advisor are included.

-- inventory_items(created_at) — Highest impact: reduces cost from 2001.17 to 418.61
CREATE INDEX IF NOT EXISTS idx_inventory_items_created_at 
  ON public.inventory_items (created_at);

-- qr_codes(shop_id) — High impact: needed for RLS policy checks
CREATE INDEX IF NOT EXISTS idx_qr_codes_shop_id 
  ON public.qr_codes (shop_id);

-- qr_codes(code) — For lookup queries by QR code value
CREATE INDEX IF NOT EXISTS idx_qr_codes_code 
  ON public.qr_codes (code);

-- sales(shop_id) — High impact: needed for RLS policy checks
CREATE INDEX IF NOT EXISTS idx_sales_shop_id 
  ON public.sales (shop_id);

-- sales(created_at) — For date-range queries on sales
CREATE INDEX IF NOT EXISTS idx_sales_created_at 
  ON public.sales (created_at);

-- sale_items(sale_id) — Critical for JOIN performance (sales <-> sale_items)
CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id 
  ON public.sale_items (sale_id);


-- ============================================================================
-- STEP 3: Add indexes for unindexed foreign keys
-- ============================================================================
-- Foreign key columns without indexes cause sequential scans when the
-- referenced row is updated or deleted (to check FK constraints).

-- attendance_logs FK indexes
CREATE INDEX IF NOT EXISTS idx_attendance_logs_shop_id 
  ON public.attendance_logs (shop_id);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_staff_id 
  ON public.attendance_logs (staff_id);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_deleted_by 
  ON public.attendance_logs (deleted_by);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_edited_by 
  ON public.attendance_logs (edited_by);

-- lots FK indexes
CREATE INDEX IF NOT EXISTS idx_lots_shop_id 
  ON public.lots (shop_id);
CREATE INDEX IF NOT EXISTS idx_lots_category_id 
  ON public.lots (category_id);
CREATE INDEX IF NOT EXISTS idx_lots_created_by 
  ON public.lots (created_by);
CREATE INDEX IF NOT EXISTS idx_lots_size_id 
  ON public.lots (size_id);

-- profiles FK indexes
CREATE INDEX IF NOT EXISTS idx_profiles_shop_id 
  ON public.profiles (shop_id);
CREATE INDEX IF NOT EXISTS idx_profiles_created_by 
  ON public.profiles (created_by);

-- inventory_items FK indexes
CREATE INDEX IF NOT EXISTS idx_inventory_items_lot_id 
  ON public.inventory_items (lot_id);
CREATE INDEX IF NOT EXISTS idx_inventory_items_sale_item_id 
  ON public.inventory_items (sale_item_id);

-- sale_items FK indexes
CREATE INDEX IF NOT EXISTS idx_sale_items_shop_id 
  ON public.sale_items (shop_id);

-- sales FK indexes
CREATE INDEX IF NOT EXISTS idx_sales_created_by 
  ON public.sales (created_by);

-- financial_transactions FK indexes
CREATE INDEX IF NOT EXISTS idx_financial_transactions_created_by 
  ON public.financial_transactions (created_by);
CREATE INDEX IF NOT EXISTS idx_financial_transactions_expense_category_id 
  ON public.financial_transactions (expense_category_id);
CREATE INDEX IF NOT EXISTS idx_financial_transactions_related_sale_id 
  ON public.financial_transactions (related_sale_id);

-- sale_returns FK indexes
CREATE INDEX IF NOT EXISTS idx_sale_returns_processed_by 
  ON public.sale_returns (processed_by);
CREATE INDEX IF NOT EXISTS idx_sale_returns_return_sale_id 
  ON public.sale_returns (return_sale_id);

-- checklists FK indexes
CREATE INDEX IF NOT EXISTS idx_checklists_created_by 
  ON public.checklists (created_by);

-- checklist_item_completions FK indexes
CREATE INDEX IF NOT EXISTS idx_checklist_item_completions_checklist_item_id 
  ON public.checklist_item_completions (checklist_item_id);

-- inventory_adjustments FK indexes (if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'inventory_adjustments' AND table_schema = 'public') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_inventory_adjustments_adjusted_by ON public.inventory_adjustments (adjusted_by)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_inventory_adjustments_inventory_item_id ON public.inventory_adjustments (inventory_item_id)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_inventory_adjustments_shop_id ON public.inventory_adjustments (shop_id)';
  END IF;
END $$;

-- expense_categories FK indexes (created_by may have been added via dashboard)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'expense_categories' AND column_name = 'created_by' AND table_schema = 'public'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_expense_categories_created_by ON public.expense_categories (created_by)';
  END IF;
END $$;
