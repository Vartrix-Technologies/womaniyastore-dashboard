-- RLS Policies for Checklists and related tables
-- Date: 2024-12-31

-- ==========================================
-- 1. CHECKLISTS TABLE
-- ==========================================

-- Enable RLS (if not already enabled)
ALTER TABLE checklists ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view checklists for their shop" ON checklists;
DROP POLICY IF EXISTS "Admins can insert checklists for their shop" ON checklists;
DROP POLICY IF EXISTS "Admins can update checklists for their shop" ON checklists;
DROP POLICY IF EXISTS "Admins can delete checklists for their shop" ON checklists;

-- Create view for user profiles (helper)
CREATE OR REPLACE VIEW user_profiles AS
SELECT id AS user_id, shop_id, role
FROM profiles;

-- RLS Policies for checklists
-- All users in shop can view checklists
CREATE POLICY "Users can view checklists for their shop"
  ON checklists FOR SELECT
  USING (
    shop_id IN (
      SELECT shop_id FROM user_profiles WHERE user_id = auth.uid()
    )
  );

-- Only admins and owners can create checklists
CREATE POLICY "Admins can insert checklists for their shop"
  ON checklists FOR INSERT
  WITH CHECK (
    shop_id IN (
      SELECT shop_id FROM user_profiles 
      WHERE user_id = auth.uid() 
      AND role IN ('owner', 'admin')
    )
  );

-- Only admins and owners can update checklists
CREATE POLICY "Admins can update checklists for their shop"
  ON checklists FOR UPDATE
  USING (
    shop_id IN (
      SELECT shop_id FROM user_profiles 
      WHERE user_id = auth.uid() 
      AND role IN ('owner', 'admin')
    )
  );

-- Only admins and owners can delete checklists
CREATE POLICY "Admins can delete checklists for their shop"
  ON checklists FOR DELETE
  USING (
    shop_id IN (
      SELECT shop_id FROM user_profiles 
      WHERE user_id = auth.uid() 
      AND role IN ('owner', 'admin')
    )
  );

-- ==========================================
-- 2. CHECKLIST_ITEMS TABLE
-- ==========================================

-- Enable RLS (if not already enabled)
ALTER TABLE checklist_items ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view checklist items" ON checklist_items;
DROP POLICY IF EXISTS "Admins can insert checklist items" ON checklist_items;
DROP POLICY IF EXISTS "Admins can update checklist items" ON checklist_items;
DROP POLICY IF EXISTS "Admins can delete checklist items" ON checklist_items;

-- RLS Policies for checklist_items
-- All users in shop can view items (if they can see the checklist)
CREATE POLICY "Users can view checklist items"
  ON checklist_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM checklists 
      WHERE checklists.id = checklist_items.checklist_id
      AND checklists.shop_id IN (
        SELECT shop_id FROM user_profiles WHERE user_id = auth.uid()
      )
    )
  );

-- Only admins can insert items
CREATE POLICY "Admins can insert checklist items"
  ON checklist_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM checklists 
      WHERE checklists.id = checklist_items.checklist_id
      AND checklists.shop_id IN (
        SELECT shop_id FROM user_profiles 
        WHERE user_id = auth.uid() 
        AND role IN ('owner', 'admin')
      )
    )
  );

-- Only admins can update items
CREATE POLICY "Admins can update checklist items"
  ON checklist_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM checklists 
      WHERE checklists.id = checklist_items.checklist_id
      AND checklists.shop_id IN (
        SELECT shop_id FROM user_profiles 
        WHERE user_id = auth.uid() 
        AND role IN ('owner', 'admin')
      )
    )
  );

-- Only admins can delete items
CREATE POLICY "Admins can delete checklist items"
  ON checklist_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM checklists 
      WHERE checklists.id = checklist_items.checklist_id
      AND checklists.shop_id IN (
        SELECT shop_id FROM user_profiles 
        WHERE user_id = auth.uid() 
        AND role IN ('owner', 'admin')
      )
    )
  );

-- NOTE: Sections 3 & 4 (staff_checklist_assignments, staff_checklist_item_status)
-- removed — those tables were replaced by checklist_instances and
-- checklist_item_completions in 20241231000100_checklist_shared_pool.sql.

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_checklists_shop_id ON checklists(shop_id);
CREATE INDEX IF NOT EXISTS idx_checklist_items_checklist_id ON checklist_items(checklist_id);
