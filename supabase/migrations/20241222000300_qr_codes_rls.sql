-- Enable RLS on qr_codes table
ALTER TABLE qr_codes ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view QR codes for their shop" ON qr_codes;
DROP POLICY IF EXISTS "Users can insert QR codes for their shop" ON qr_codes;
DROP POLICY IF EXISTS "Users can update QR codes for their shop" ON qr_codes;
DROP POLICY IF EXISTS "Users can delete QR codes for their shop" ON qr_codes;

-- RLS Policies for qr_codes
CREATE POLICY "Users can view QR codes for their shop"
  ON qr_codes FOR SELECT
  USING (
    shop_id IN (
      SELECT shop_id FROM user_profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert QR codes for their shop"
  ON qr_codes FOR INSERT
  WITH CHECK (
    shop_id IN (
      SELECT shop_id FROM user_profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update QR codes for their shop"
  ON qr_codes FOR UPDATE
  USING (
    shop_id IN (
      SELECT shop_id FROM user_profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete QR codes for their shop"
  ON qr_codes FOR DELETE
  USING (
    shop_id IN (
      SELECT shop_id FROM user_profiles WHERE user_id = auth.uid()
    )
  );
