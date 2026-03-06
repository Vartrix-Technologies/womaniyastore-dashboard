-- Create function to generate sequential bill numbers per shop
-- This ensures atomic, sequential bill number generation

-- Drop existing function if it exists with different signature
DROP FUNCTION IF EXISTS generate_bill_number(UUID);

CREATE OR REPLACE FUNCTION generate_bill_number(p_shop_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_bill_number INTEGER;
BEGIN
  -- Get the next bill number for this shop (atomic operation)
  SELECT COALESCE(MAX(bill_number), 0) + 1
  INTO v_bill_number
  FROM sales
  WHERE shop_id = p_shop_id
  FOR UPDATE;  -- Lock to ensure atomicity
  
  RETURN v_bill_number;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION generate_bill_number(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION generate_bill_number(UUID) TO service_role;

-- Add helpful comment
COMMENT ON FUNCTION generate_bill_number(UUID) IS 
'Generates the next sequential bill number for a given shop. Thread-safe and atomic.';
