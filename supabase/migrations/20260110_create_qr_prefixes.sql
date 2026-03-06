-- Migration: Create QR Prefixes Table
-- Date: 2026-01-10
-- Purpose: Enable admin-managed QR code prefixes for better inventory organization
-- Related: QR_PREFIX_DESIGN_PROPOSAL.md

-- ============================================================================
-- 1. CREATE QR_PREFIXES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS qr_prefixes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  prefix VARCHAR(20) NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Constraints
  CONSTRAINT qr_prefixes_prefix_format CHECK (prefix ~ '^[A-Z0-9]+(-[A-Z0-9]+)+$'),
  CONSTRAINT qr_prefixes_unique_per_shop UNIQUE(shop_id, prefix)
);

-- Add comments for documentation
COMMENT ON TABLE qr_prefixes IS 'Admin-managed QR code prefixes (e.g., WA-499, WA-TP-599) for better inventory organization';
COMMENT ON COLUMN qr_prefixes.prefix IS 'QR prefix format (e.g., WA-499, WA-TP-599). Must be uppercase alphanumeric with hyphen separators.';
COMMENT ON COLUMN qr_prefixes.description IS 'Optional human-readable description (e.g., "₹499 Kurtas")';
COMMENT ON COLUMN qr_prefixes.is_active IS 'Whether prefix can be used for new QR generation. Inactive prefixes are hidden from dropdowns.';
COMMENT ON COLUMN qr_prefixes.display_order IS 'Sort order for UI display (lower numbers appear first)';

-- ============================================================================
-- 2. CREATE INDEXES
-- ============================================================================

CREATE INDEX idx_qr_prefixes_shop_active 
  ON qr_prefixes(shop_id, is_active) 
  WHERE is_active = true;

CREATE INDEX idx_qr_prefixes_shop_order 
  ON qr_prefixes(shop_id, display_order);

-- ============================================================================
-- 3. ENABLE ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE qr_prefixes ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 4. CREATE RLS POLICIES
-- ============================================================================

-- SELECT: All authenticated users can view prefixes for their shop
CREATE POLICY qr_prefixes_select ON qr_prefixes
  FOR SELECT 
  USING (
    shop_id IN (
      SELECT shop_id FROM user_profiles WHERE user_id = auth.uid()
    )
  );

-- INSERT: Only admins/owners can create prefixes
CREATE POLICY qr_prefixes_insert ON qr_prefixes
  FOR INSERT 
  WITH CHECK (
    shop_id IN (
      SELECT shop_id FROM user_profiles 
      WHERE user_id = auth.uid() 
      AND role IN ('owner', 'admin', 'superadmin')
    )
  );

-- UPDATE: Only admins/owners can edit prefixes
CREATE POLICY qr_prefixes_update ON qr_prefixes
  FOR UPDATE 
  USING (
    shop_id IN (
      SELECT shop_id FROM user_profiles 
      WHERE user_id = auth.uid() 
      AND role IN ('owner', 'admin', 'superadmin')
    )
  )
  WITH CHECK (
    shop_id IN (
      SELECT shop_id FROM user_profiles 
      WHERE user_id = auth.uid() 
      AND role IN ('owner', 'admin', 'superadmin')
    )
  );

-- DELETE: Only admins/owners can delete prefixes (if no QR codes assigned)
CREATE POLICY qr_prefixes_delete ON qr_prefixes
  FOR DELETE 
  USING (
    shop_id IN (
      SELECT shop_id FROM user_profiles 
      WHERE user_id = auth.uid() 
      AND role IN ('owner', 'admin', 'superadmin')
    )
  );

-- ============================================================================
-- 5. GRANT PERMISSIONS
-- ============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON qr_prefixes TO authenticated;

-- ============================================================================
-- Migration Complete
-- Next: Run 20260110_alter_qr_codes_add_prefix.sql
-- ============================================================================
