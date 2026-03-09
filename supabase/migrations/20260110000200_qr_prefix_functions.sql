-- Migration: QR Prefix Database Functions
-- Date: 2026-01-10
-- Purpose: Functions for generating QR codes with prefixes
-- Related: QR_PREFIX_DESIGN_PROPOSAL.md

-- ============================================================================
-- 1. FUNCTION: generate_qr_codes_with_prefix
-- ============================================================================

CREATE OR REPLACE FUNCTION generate_qr_codes_with_prefix(
  p_shop_id UUID,
  p_prefix_id UUID,
  p_quantity INTEGER
)
RETURNS TABLE(qr_code_id UUID, qr_code TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prefix TEXT;
  v_next_sequence INTEGER;
  v_code TEXT;
  v_id UUID;
BEGIN
  -- Validate input
  IF p_quantity <= 0 OR p_quantity > 10000 THEN
    RAISE EXCEPTION 'Quantity must be between 1 and 10000';
  END IF;

  -- Validate prefix exists, is active, and belongs to shop
  SELECT prefix INTO v_prefix
  FROM qr_prefixes
  WHERE id = p_prefix_id 
    AND shop_id = p_shop_id 
    AND is_active = true;
  
  IF v_prefix IS NULL THEN
    RAISE EXCEPTION 'Prefix not found, inactive, or does not belong to this shop';
  END IF;
  
  -- Get next sequence number for this prefix
  SELECT COALESCE(MAX(sequence_number), 0) + 1 INTO v_next_sequence
  FROM qr_codes
  WHERE prefix_id = p_prefix_id;
  
  -- Validate sequence won't exceed 9999 (4-digit limit)
  IF v_next_sequence + p_quantity - 1 > 9999 THEN
    RAISE EXCEPTION 'Sequence number would exceed 9999. Maximum QR codes per prefix is 9999.';
  END IF;
  
  -- Generate QR codes
  FOR i IN 0..(p_quantity - 1) LOOP
    -- Format: {PREFIX}-{SEQUENCE:04d} (e.g., WA-499-0001)
    v_code := v_prefix || '-' || LPAD((v_next_sequence + i)::TEXT, 4, '0');
    
    -- Insert QR code
    INSERT INTO qr_codes (shop_id, code, prefix_id, sequence_number, status)
    VALUES (p_shop_id, v_code, p_prefix_id, v_next_sequence + i, 'unused')
    RETURNING id, code INTO v_id, v_code;
    
    RETURN QUERY SELECT v_id, v_code;
  END LOOP;
END;
$$;

-- Add comment
COMMENT ON FUNCTION generate_qr_codes_with_prefix IS 'Generates QR codes with specified prefix and sequential numbers. Returns table of (id, code) pairs.';

-- Grant execute permission
GRANT EXECUTE ON FUNCTION generate_qr_codes_with_prefix TO authenticated;

-- ============================================================================
-- 2. FUNCTION: get_prefix_qr_stats (Helper for UI)
-- ============================================================================

CREATE OR REPLACE FUNCTION get_prefix_qr_stats(
  p_shop_id UUID,
  p_prefix_id UUID
)
RETURNS TABLE(
  total_qr_codes BIGINT,
  unused_qr_codes BIGINT,
  assigned_qr_codes BIGINT,
  sold_qr_codes BIGINT,
  lost_qr_codes BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*) AS total_qr_codes,
    COUNT(*) FILTER (WHERE status = 'unused') AS unused_qr_codes,
    COUNT(*) FILTER (WHERE status = 'assigned') AS assigned_qr_codes,
    COUNT(*) FILTER (WHERE status = 'sold') AS sold_qr_codes,
    COUNT(*) FILTER (WHERE status = 'lost') AS lost_qr_codes
  FROM qr_codes
  WHERE shop_id = p_shop_id 
    AND prefix_id = p_prefix_id;
END;
$$;

-- Add comment
COMMENT ON FUNCTION get_prefix_qr_stats IS 'Returns QR code statistics for a specific prefix (total, unused, assigned, sold, lost counts).';

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_prefix_qr_stats TO authenticated;

-- ============================================================================
-- 3. FUNCTION: migrate_legacy_qr_codes_to_default_prefix (Optional)
-- ============================================================================

CREATE OR REPLACE FUNCTION migrate_legacy_qr_codes_to_default_prefix(
  p_shop_id UUID
)
RETURNS TABLE(migrated_count INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_default_prefix_id UUID;
  v_count INTEGER := 0;
  v_bill_prefix TEXT;
BEGIN
  -- Get shop's bill prefix
  SELECT bill_prefix INTO v_bill_prefix
  FROM shops
  WHERE id = p_shop_id;
  
  IF v_bill_prefix IS NULL THEN
    RAISE EXCEPTION 'Shop not found';
  END IF;

  -- Find or create default prefix for shop
  SELECT id INTO v_default_prefix_id
  FROM qr_prefixes
  WHERE shop_id = p_shop_id AND prefix = v_bill_prefix;
  
  IF v_default_prefix_id IS NULL THEN
    -- Create default prefix using shop's bill_prefix
    INSERT INTO qr_prefixes (shop_id, prefix, description, is_active, display_order)
    VALUES (p_shop_id, v_bill_prefix, 'Legacy QR codes (migrated)', false, 9999)
    RETURNING id INTO v_default_prefix_id;
  END IF;
  
  -- Migrate legacy QR codes (those without prefix_id)
  -- Only migrate if format matches PREFIX-NUMBER pattern
  WITH updated AS (
    UPDATE qr_codes
    SET 
      prefix_id = v_default_prefix_id,
      sequence_number = NULLIF(REGEXP_REPLACE(code, '^\w+-', ''), '')::INTEGER
    WHERE 
      shop_id = p_shop_id 
      AND prefix_id IS NULL
      AND code ~ '^\w+-\d+$' -- Only migrate if format is PREFIX-NUMBER
      AND NULLIF(REGEXP_REPLACE(code, '^\w+-', ''), '') ~ '^\d+$' -- Ensure number is valid
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_count FROM updated;
  
  RETURN QUERY SELECT v_count;
END;
$$;

-- Add comment
COMMENT ON FUNCTION migrate_legacy_qr_codes_to_default_prefix IS 'Optional migration function to convert legacy QR codes to use default prefix. Creates prefix if not exists.';

-- Grant execute permission (superadmin only via RLS)
GRANT EXECUTE ON FUNCTION migrate_legacy_qr_codes_to_default_prefix TO authenticated;

-- ============================================================================
-- Migration Complete
-- Ready for TypeScript type generation and Edge Function updates
-- ============================================================================
