-- Migration: Add Prefix Support to QR Codes
-- Date: 2026-01-10
-- Purpose: Add prefix_id and sequence_number columns to qr_codes table
-- Related: QR_PREFIX_DESIGN_PROPOSAL.md

-- ============================================================================
-- 1. ALTER QR_CODES TABLE - ADD COLUMNS
-- ============================================================================

-- Add prefix_id column (nullable for backward compatibility)
ALTER TABLE qr_codes 
  ADD COLUMN IF NOT EXISTS prefix_id UUID REFERENCES qr_prefixes(id) ON DELETE RESTRICT;

-- Ensure FK constraint exists even if column was pre-created without it
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'qr_codes_prefix_id_fkey'
  ) THEN
    ALTER TABLE qr_codes
      ADD CONSTRAINT qr_codes_prefix_id_fkey
        FOREIGN KEY (prefix_id) REFERENCES qr_prefixes(id) ON DELETE RESTRICT;
  END IF;
END $$;

-- Add sequence_number column (nullable for backward compatibility)
ALTER TABLE qr_codes 
  ADD COLUMN IF NOT EXISTS sequence_number INTEGER;

-- Add comments for documentation
COMMENT ON COLUMN qr_codes.prefix_id IS 'Foreign key to qr_prefixes. NULL for legacy QR codes generated before prefix feature.';
COMMENT ON COLUMN qr_codes.sequence_number IS 'Sequence number within the prefix (e.g., 1, 2, 3...). NULL for legacy QR codes. Unique per prefix.';

-- ============================================================================
-- 2. CREATE INDEXES
-- ============================================================================

-- Unique constraint: sequence numbers must be unique per prefix
CREATE UNIQUE INDEX IF NOT EXISTS idx_qr_codes_prefix_sequence 
  ON qr_codes(prefix_id, sequence_number) 
  WHERE prefix_id IS NOT NULL AND sequence_number IS NOT NULL;

-- Index for prefix-based QR lookups
CREATE INDEX IF NOT EXISTS idx_qr_codes_prefix_id 
  ON qr_codes(prefix_id) 
  WHERE prefix_id IS NOT NULL;

-- Index for filtering unused QR codes by prefix (critical for stock lot addition)
CREATE INDEX IF NOT EXISTS idx_qr_codes_prefix_status 
  ON qr_codes(prefix_id, status) 
  WHERE prefix_id IS NOT NULL;

-- ============================================================================
-- 3. VERIFY EXISTING DATA
-- ============================================================================

-- Legacy QR codes should have NULL prefix_id and sequence_number
-- This is expected and correct - no action needed

-- ============================================================================
-- Migration Complete
-- Next: Run 20260110_qr_prefix_functions.sql
-- ============================================================================
