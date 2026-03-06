-- Add vendor_name column to lots table for vendor-wise reporting
-- Migration: 20250101_add_vendor_to_lots.sql

-- Add vendor_name column to lots table
ALTER TABLE lots 
ADD COLUMN IF NOT EXISTS vendor_name TEXT;

-- Add index for faster vendor-based queries
CREATE INDEX idx_lots_vendor_name ON lots(vendor_name) WHERE vendor_name IS NOT NULL;

-- Add comment
COMMENT ON COLUMN lots.vendor_name IS 'Name of the vendor/supplier from whom the stock was purchased';
