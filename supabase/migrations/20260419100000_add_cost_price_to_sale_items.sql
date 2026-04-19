-- Add cost_price column to sale_items table
-- For QR-scanned items: populated from inventory_items.cost_price at time of sale
-- For quick-add items: entered manually by staff (required field)
-- Nullable for backward compatibility with existing rows

ALTER TABLE sale_items
ADD COLUMN IF NOT EXISTS cost_price NUMERIC;

-- Backfill cost_price for existing QR-scanned sale items from inventory_items
UPDATE sale_items si
SET cost_price = ii.cost_price
FROM inventory_items ii
WHERE si.inventory_item_id = ii.id
  AND si.cost_price IS NULL;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
