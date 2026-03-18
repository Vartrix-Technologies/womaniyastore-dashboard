-- Migration: Support Quick Sale (manual) items without inventory linkage
-- Manual items are sold without QR codes/inventory tracking but still generate
-- proper bills and financial records.

-- 1. Make inventory_item_id nullable on sale_items
-- This allows manual/Quick Sale items that are not linked to inventory
ALTER TABLE sale_items
  ALTER COLUMN inventory_item_id DROP NOT NULL;

-- 2. Add category_name and size_name for manual items
-- These store descriptive info since there's no inventory/lot linkage
ALTER TABLE sale_items
  ADD COLUMN IF NOT EXISTS category_name text,
  ADD COLUMN IF NOT EXISTS size_name text;

-- 3. Drop the unique constraint on inventory_item_id
-- NULL values are distinct in unique constraints (Postgres), but dropping the
-- unique index allows for cleaner semantics and avoids confusion.
-- First find and drop the unique index/constraint if it exists.
DO $$
BEGIN
  -- Drop unique constraint if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'sale_items'
      AND constraint_type = 'UNIQUE'
      AND constraint_name LIKE '%inventory_item_id%'
  ) THEN
    EXECUTE format(
      'ALTER TABLE sale_items DROP CONSTRAINT %I',
      (SELECT constraint_name FROM information_schema.table_constraints
       WHERE table_name = 'sale_items'
         AND constraint_type = 'UNIQUE'
         AND constraint_name LIKE '%inventory_item_id%'
       LIMIT 1)
    );
  END IF;
END $$;

-- Re-add a partial unique constraint that only enforces uniqueness for non-null values
-- This ensures tracked items still have one-to-one mapping with inventory
CREATE UNIQUE INDEX IF NOT EXISTS sale_items_inventory_item_id_unique
  ON sale_items (inventory_item_id)
  WHERE inventory_item_id IS NOT NULL;

-- 4. Add an index for looking up manual items (useful for reports)
CREATE INDEX IF NOT EXISTS idx_sale_items_manual
  ON sale_items (sale_id)
  WHERE inventory_item_id IS NULL;
