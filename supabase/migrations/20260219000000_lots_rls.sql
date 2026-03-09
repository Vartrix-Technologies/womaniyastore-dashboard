-- RLS policies for lots table
-- This allows authenticated users to manage lots in their own shop
-- Previously, lots had RLS enabled but no UPDATE/DELETE policies,
-- causing silent failures when editing lots from the client side.

-- Enable RLS (if not already enabled)
ALTER TABLE lots ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Users can view lots for their shop" ON lots;
DROP POLICY IF EXISTS "Users can insert lots for their shop" ON lots;
DROP POLICY IF EXISTS "Users can update lots for their shop" ON lots;
DROP POLICY IF EXISTS "Users can delete lots for their shop" ON lots;

-- RLS Policies

-- SELECT: Users can view lots for their shop
CREATE POLICY "Users can view lots for their shop"
  ON lots FOR SELECT
  USING (
    shop_id IN (
      SELECT shop_id FROM user_profiles WHERE user_id = auth.uid()
    )
  );

-- INSERT: Users can create lots for their shop
CREATE POLICY "Users can insert lots for their shop"
  ON lots FOR INSERT
  WITH CHECK (
    shop_id IN (
      SELECT shop_id FROM user_profiles WHERE user_id = auth.uid()
    )
  );

-- UPDATE: Users can update lots for their shop (needed for editing lot details)
CREATE POLICY "Users can update lots for their shop"
  ON lots FOR UPDATE
  USING (
    shop_id IN (
      SELECT shop_id FROM user_profiles WHERE user_id = auth.uid()
    )
  );

-- DELETE: Users can delete lots for their shop
CREATE POLICY "Users can delete lots for their shop"
  ON lots FOR DELETE
  USING (
    shop_id IN (
      SELECT shop_id FROM user_profiles WHERE user_id = auth.uid()
    )
  );
