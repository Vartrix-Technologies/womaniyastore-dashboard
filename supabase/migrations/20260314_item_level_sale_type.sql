-- ============================================================
-- Migration: Item-Level Sale Type
-- Same denormalization pattern as item-level pricing.
-- Adds sale_type and sale_reason directly on inventory_items
-- so each item can be reclassified independently of its lot.
-- ============================================================

-- 1. Add columns (nullable, no default needed)
ALTER TABLE inventory_items
  ADD COLUMN IF NOT EXISTS sale_type text,
  ADD COLUMN IF NOT EXISTS sale_reason text;

-- 2. Backfill from lots
UPDATE inventory_items
SET
  sale_type   = lots.sale_type,
  sale_reason = lots.sale_reason
FROM lots
WHERE inventory_items.lot_id = lots.id;

-- 3. Index for filtering by sale_type (used on inventory page)
CREATE INDEX IF NOT EXISTS idx_inventory_items_sale_type
  ON inventory_items (sale_type)
  WHERE sale_type IS NOT NULL;
