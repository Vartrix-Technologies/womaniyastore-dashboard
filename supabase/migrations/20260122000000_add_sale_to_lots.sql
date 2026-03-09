-- Migration: Add sale columns to lots table
-- Purpose: Support pre-planned sales (festival/promotion) at inventory level
-- Date: 2026-01-22

-- Add sale_type column (only pre-planned types, NOT clearance)
ALTER TABLE lots
ADD COLUMN IF NOT EXISTS sale_type VARCHAR(20);

-- Add minimum margin percentage for festival sales
ALTER TABLE lots
ADD COLUMN IF NOT EXISTS min_margin_percent DECIMAL(5,2);

-- Add reason/description for the sale
ALTER TABLE lots
ADD COLUMN IF NOT EXISTS sale_reason TEXT;

-- Add CHECK constraints if they don't already exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'lots_sale_type_check') THEN
    ALTER TABLE lots ADD CONSTRAINT lots_sale_type_check CHECK (sale_type IN ('festival', 'promotion'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'lots_min_margin_percent_check') THEN
    ALTER TABLE lots ADD CONSTRAINT lots_min_margin_percent_check CHECK (min_margin_percent >= 0 AND min_margin_percent <= 100);
  END IF;
END $$;

-- Add comments for documentation
COMMENT ON COLUMN lots.sale_type IS 'Pre-planned sale type: festival (e.g., Diwali) or promotion (limited time). NULL = not on sale. Clearance is NOT set here (discovered later).';
COMMENT ON COLUMN lots.min_margin_percent IS 'Minimum margin % to maintain for festival sales. Used for validation at POS. NULL = no margin protection.';
COMMENT ON COLUMN lots.sale_reason IS 'Description of why this lot is on sale (e.g., "Diwali Festival Sale 2026", "End of Season Promotion").';

-- Create index for filtering sale items
CREATE INDEX idx_lots_sale_type ON lots(sale_type) WHERE sale_type IS NOT NULL;
