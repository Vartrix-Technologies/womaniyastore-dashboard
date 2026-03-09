-- Update bill_number column to BIGINT to support timestamp-based format (YYYYMMDDHHMMSS)
-- Timestamp format will generate 14-digit numbers like 20260101143045

-- Update the sales table bill_number column to BIGINT
ALTER TABLE sales 
ALTER COLUMN bill_number TYPE BIGINT;

-- Add comment explaining the new format
COMMENT ON COLUMN sales.bill_number IS 
'Bill number in timestamp format YYYYMMDDHHMMSS (e.g., 20260101143045 for Jan 1, 2026 14:30:45). Uses BIGINT to support 14-digit numbers.';

-- The generate_bill_number function is no longer used (bill numbers are generated in the edge function)
-- but we'll keep it for backward compatibility
