-- RLS policies for inventory_items table updates
-- This allows users to update inventory items (including status changes for returns) in their shop

-- Enable RLS (if not already enabled)
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Users can view inventory items for their shop" ON inventory_items;
DROP POLICY IF EXISTS "Users can insert inventory items for their shop" ON inventory_items;
DROP POLICY IF EXISTS "Users can update inventory items for their shop" ON inventory_items;
DROP POLICY IF EXISTS "Users can delete inventory items for their shop" ON inventory_items;

-- RLS Policies

-- SELECT: Users can view inventory items for their shop
CREATE POLICY "Users can view inventory items for their shop"
  ON inventory_items FOR SELECT
  USING (
    shop_id IN (
      SELECT shop_id FROM user_profiles WHERE user_id = auth.uid()
    )
  );

-- INSERT: Users can create inventory items for their shop
CREATE POLICY "Users can insert inventory items for their shop"
  ON inventory_items FOR INSERT
  WITH CHECK (
    shop_id IN (
      SELECT shop_id FROM user_profiles WHERE user_id = auth.uid()
    )
  );

-- UPDATE: Users can update inventory items for their shop (needed for returns, adjustments)
CREATE POLICY "Users can update inventory items for their shop"
  ON inventory_items FOR UPDATE
  USING (
    shop_id IN (
      SELECT shop_id FROM user_profiles WHERE user_id = auth.uid()
    )
  );

-- DELETE: Users can delete inventory items for their shop
CREATE POLICY "Users can delete inventory items for their shop"
  ON inventory_items FOR DELETE
  USING (
    shop_id IN (
      SELECT shop_id FROM user_profiles WHERE user_id = auth.uid()
    )
  );

-- Create indexes for faster RLS checks
CREATE INDEX IF NOT EXISTS idx_inventory_items_shop_id ON inventory_items(shop_id);
CREATE INDEX IF NOT EXISTS idx_inventory_items_status ON inventory_items(status);
