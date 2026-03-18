-- Migration: Item-Level Pricing
-- 
-- Adds selling_price, cost_price, and tax_rate columns to inventory_items.
-- These are copied from the lot at creation time. After creation, the item
-- owns its own price — lot edits update available items, not sold ones.
--
-- The lots table retains its existing columns as the "stock entry template"
-- (original batch values for audit/history). No lots columns are removed.

-- 1. Add new columns with defaults so existing rows get values
ALTER TABLE inventory_items
  ADD COLUMN IF NOT EXISTS selling_price NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cost_price    NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_rate      NUMERIC NOT NULL DEFAULT 0;

-- 2. Backfill existing items from their lot
UPDATE inventory_items
SET
  selling_price = lots.selling_price_default,
  cost_price    = lots.cost_price_per_unit,
  tax_rate      = lots.tax_rate
FROM lots
WHERE inventory_items.lot_id = lots.id;

-- 3. Remove the DEFAULT 0 now that backfill is done (new rows will always
--    be inserted with explicit values from the edge function)
ALTER TABLE inventory_items
  ALTER COLUMN selling_price DROP DEFAULT,
  ALTER COLUMN cost_price    DROP DEFAULT,
  ALTER COLUMN tax_rate      DROP DEFAULT;

-- 4. Add a comment for documentation
COMMENT ON COLUMN inventory_items.selling_price IS 'Item selling price — copied from lot at stock entry, editable per-item afterwards';
COMMENT ON COLUMN inventory_items.cost_price    IS 'Item cost price — copied from lot at stock entry';
COMMENT ON COLUMN inventory_items.tax_rate      IS 'Item tax rate (GST %) — copied from lot at stock entry';
