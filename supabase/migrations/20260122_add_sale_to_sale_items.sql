-- Migration: Add sale columns to sale_items table
-- Purpose: Record actual sale type at transaction level (ground truth)
-- Date: 2026-01-22

-- Add sold_on_sale boolean flag
ALTER TABLE sale_items
ADD COLUMN IF NOT EXISTS sold_on_sale BOOLEAN NOT NULL DEFAULT false;

-- Add sale_type column (includes clearance, decided at POS)
ALTER TABLE sale_items
ADD COLUMN IF NOT EXISTS sale_type VARCHAR(20);

-- Add CHECK constraint if it doesn't already exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sale_items_sale_type_check') THEN
    ALTER TABLE sale_items ADD CONSTRAINT sale_items_sale_type_check CHECK (sale_type IN ('festival', 'clearance', 'promotion'));
  END IF;
END $$;

-- Add comments for documentation
COMMENT ON COLUMN sale_items.sold_on_sale IS 'TRUE if this item was sold as part of a sale (festival/clearance/promo). Used for revenue segmentation in reports.';
COMMENT ON COLUMN sale_items.sale_type IS 'Actual sale type at transaction time: festival, clearance, or promotion. NULL if sold_on_sale=false. Clearance is marked here (not at lot level).';

-- Create indexes for reporting queries
CREATE INDEX IF NOT EXISTS idx_sale_items_sold_on_sale ON sale_items(sold_on_sale) WHERE sold_on_sale = true;
CREATE INDEX IF NOT EXISTS idx_sale_items_sale_type ON sale_items(sale_type) WHERE sale_type IS NOT NULL;

-- Add constraint to ensure sale_type is set when sold_on_sale is true
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_sale_type_when_on_sale') THEN
    ALTER TABLE sale_items
    ADD CONSTRAINT check_sale_type_when_on_sale 
    CHECK (
      (sold_on_sale = false AND sale_type IS NULL) OR 
      (sold_on_sale = true AND sale_type IS NOT NULL)
    );
  END IF;
END $$;
