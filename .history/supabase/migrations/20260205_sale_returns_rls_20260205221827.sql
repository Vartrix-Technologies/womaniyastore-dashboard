-- RLS policies for sale_returns table
-- This allows users to manage returns for their shop

-- Enable RLS (if not already enabled)
ALTER TABLE sale_returns ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view sale returns for their shop" ON sale_returns;
DROP POLICY IF EXISTS "Users can insert sale returns for their shop" ON sale_returns;
DROP POLICY IF EXISTS "Users can update sale returns for their shop" ON sale_returns;
DROP POLICY IF EXISTS "Users can delete sale returns for their shop" ON sale_returns;

-- RLS Policies

-- SELECT: Users can view returns for their shop
CREATE POLICY "Users can view sale returns for their shop"
  ON sale_returns FOR SELECT
  USING (
    shop_id IN (
      SELECT shop_id FROM user_profiles WHERE user_id = auth.uid()
    )
  );

-- INSERT: Users can create returns for their shop
CREATE POLICY "Users can insert sale returns for their shop"
  ON sale_returns FOR INSERT
  WITH CHECK (
    shop_id IN (
      SELECT shop_id FROM user_profiles WHERE user_id = auth.uid()
    )
  );

-- UPDATE: Users can update returns for their shop
CREATE POLICY "Users can update sale returns for their shop"
  ON sale_returns FOR UPDATE
  USING (
    shop_id IN (
      SELECT shop_id FROM user_profiles WHERE user_id = auth.uid()
    )
  );

-- DELETE: Users can delete returns for their shop (admins only typically)
CREATE POLICY "Users can delete sale returns for their shop"
  ON sale_returns FOR DELETE
  USING (
    shop_id IN (
      SELECT shop_id FROM user_profiles WHERE user_id = auth.uid()
    )
  );

-- Create index for faster RLS checks
CREATE INDEX IF NOT EXISTS idx_sale_returns_shop_id ON sale_returns(shop_id);
CREATE INDEX IF NOT EXISTS idx_sale_returns_original_sale_id ON sale_returns(original_sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_returns_created_at ON sale_returns(created_at);
