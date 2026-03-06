-- Migrate to Shared Checklist Pool System
-- Date: 2024-12-31
-- This migration transforms the checklist system from individual assignments to a shared pool model

-- ==========================================
-- 1. DROP OLD ASSIGNMENT TABLES
-- ==========================================

-- Drop old tables (these will be replaced with new shared system)
DROP TABLE IF EXISTS staff_checklist_item_status CASCADE;
DROP TABLE IF EXISTS staff_checklist_assignments CASCADE;

-- ==========================================
-- 2. ADD RECURRENCE FIELDS TO CHECKLISTS
-- ==========================================

-- Add new columns to existing checklists table (templates)
ALTER TABLE checklists 
  ADD COLUMN IF NOT EXISTS recurrence_type TEXT DEFAULT 'daily' CHECK (recurrence_type IN ('daily', 'weekly', 'once')),
  ADD COLUMN IF NOT EXISTS recurrence_days INTEGER[] DEFAULT '{1,2,3,4,5,6}', -- 0=Sunday, 1=Monday, ..., 6=Saturday
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Update existing checklists to have default recurrence (daily Mon-Sat)
UPDATE checklists 
SET recurrence_type = 'daily', 
    recurrence_days = '{1,2,3,4,5,6}' 
WHERE recurrence_type IS NULL;

-- ==========================================
-- 3. CREATE CHECKLIST_INSTANCES TABLE
-- ==========================================

-- Daily/weekly instances of checklist templates
CREATE TABLE IF NOT EXISTS checklist_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_id UUID NOT NULL REFERENCES checklists(id) ON DELETE CASCADE,
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  date DATE NOT NULL, -- Which day this instance is for
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
  total_items INTEGER DEFAULT 0,
  completed_items INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(checklist_id, date) -- One instance per checklist per day
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_checklist_instances_shop_date ON checklist_instances(shop_id, date);
CREATE INDEX IF NOT EXISTS idx_checklist_instances_checklist ON checklist_instances(checklist_id);
CREATE INDEX IF NOT EXISTS idx_checklist_instances_status ON checklist_instances(status);

-- ==========================================
-- 4. CREATE CHECKLIST_ITEM_COMPLETIONS TABLE
-- ==========================================

-- Track who completed which items
CREATE TABLE IF NOT EXISTS checklist_item_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID NOT NULL REFERENCES checklist_instances(id) ON DELETE CASCADE,
  checklist_item_id UUID NOT NULL REFERENCES checklist_items(id) ON DELETE CASCADE,
  completed_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  completed_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT,
  UNIQUE(instance_id, checklist_item_id) -- Each item can only be completed once per instance
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_item_completions_instance ON checklist_item_completions(instance_id);
CREATE INDEX IF NOT EXISTS idx_item_completions_completed_by ON checklist_item_completions(completed_by);

-- ==========================================
-- 5. RLS POLICIES FOR CHECKLIST_INSTANCES
-- ==========================================

ALTER TABLE checklist_instances ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view checklist instances for their shop" ON checklist_instances;
DROP POLICY IF EXISTS "System can create checklist instances" ON checklist_instances;
DROP POLICY IF EXISTS "System can update checklist instances" ON checklist_instances;

-- All users in shop can view instances
CREATE POLICY "Users can view checklist instances for their shop"
  ON checklist_instances FOR SELECT
  USING (
    shop_id IN (
      SELECT shop_id FROM user_profiles WHERE user_id = auth.uid()
    )
  );

-- System/admins can create instances (for auto-creation)
CREATE POLICY "System can create checklist instances"
  ON checklist_instances FOR INSERT
  WITH CHECK (
    shop_id IN (
      SELECT shop_id FROM user_profiles 
      WHERE user_id = auth.uid()
    )
  );

-- System can update instances (progress tracking)
CREATE POLICY "System can update checklist instances"
  ON checklist_instances FOR UPDATE
  USING (
    shop_id IN (
      SELECT shop_id FROM user_profiles WHERE user_id = auth.uid()
    )
  );

-- ==========================================
-- 6. RLS POLICIES FOR CHECKLIST_ITEM_COMPLETIONS
-- ==========================================

ALTER TABLE checklist_item_completions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view completions for their shop" ON checklist_item_completions;
DROP POLICY IF EXISTS "Staff can mark items complete" ON checklist_item_completions;
DROP POLICY IF EXISTS "Staff can update their own completions" ON checklist_item_completions;

-- All users can view completions for their shop
CREATE POLICY "Users can view completions for their shop"
  ON checklist_item_completions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM checklist_instances 
      WHERE checklist_instances.id = checklist_item_completions.instance_id
      AND checklist_instances.shop_id IN (
        SELECT shop_id FROM user_profiles WHERE user_id = auth.uid()
      )
    )
  );

-- All staff can mark items complete
CREATE POLICY "Staff can mark items complete"
  ON checklist_item_completions FOR INSERT
  WITH CHECK (
    completed_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM checklist_instances 
      WHERE checklist_instances.id = checklist_item_completions.instance_id
      AND checklist_instances.shop_id IN (
        SELECT shop_id FROM user_profiles WHERE user_id = auth.uid()
      )
    )
  );

-- Staff can update their own completions (add notes, etc.)
CREATE POLICY "Staff can update their own completions"
  ON checklist_item_completions FOR UPDATE
  USING (
    completed_by = auth.uid()
  );

-- ==========================================
-- 7. TRIGGERS FOR AUTO-UPDATE
-- ==========================================

-- Trigger to update instance progress when item completed
CREATE OR REPLACE FUNCTION update_checklist_instance_progress()
RETURNS TRIGGER AS $$
BEGIN
  -- Update the instance's completed count and status
  UPDATE checklist_instances
  SET 
    completed_items = (
      SELECT COUNT(*) FROM checklist_item_completions 
      WHERE instance_id = NEW.instance_id
    ),
    status = CASE 
      WHEN (SELECT COUNT(*) FROM checklist_item_completions WHERE instance_id = NEW.instance_id) = 0 
        THEN 'pending'
      WHEN (SELECT COUNT(*) FROM checklist_item_completions WHERE instance_id = NEW.instance_id) >= total_items 
        THEN 'completed'
      ELSE 'in_progress'
    END,
    updated_at = NOW()
  WHERE id = NEW.instance_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS checklist_item_completion_trigger ON checklist_item_completions;
CREATE TRIGGER checklist_item_completion_trigger
  AFTER INSERT ON checklist_item_completions
  FOR EACH ROW
  EXECUTE FUNCTION update_checklist_instance_progress();

-- Trigger to update updated_at on checklists table
CREATE OR REPLACE FUNCTION update_checklists_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS checklists_updated_at_trigger ON checklists;
CREATE TRIGGER checklists_updated_at_trigger
  BEFORE UPDATE ON checklists
  FOR EACH ROW
  EXECUTE FUNCTION update_checklists_updated_at();

-- ==========================================
-- 8. HELPER FUNCTION: CREATE DAILY INSTANCES
-- ==========================================

-- Function to create today's checklist instances for a shop
CREATE OR REPLACE FUNCTION create_daily_checklist_instances(shop_id_param UUID, date_param DATE DEFAULT CURRENT_DATE)
RETURNS TABLE(instance_id UUID, checklist_name TEXT, items_count INTEGER) AS $$
DECLARE
  checklist_record RECORD;
  new_instance_id UUID;
  day_of_week INTEGER;
BEGIN
  -- Get day of week (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
  day_of_week := EXTRACT(DOW FROM date_param);
  
  -- Loop through active checklists for this shop
  FOR checklist_record IN 
    SELECT c.id, c.name, c.recurrence_type, c.recurrence_days,
           (SELECT COUNT(*) FROM checklist_items WHERE checklist_id = c.id) as item_count
    FROM checklists c
    WHERE c.shop_id = shop_id_param 
      AND c.is_active = true
      AND (
        -- Daily checklists that include this day
        (c.recurrence_type = 'daily' AND day_of_week = ANY(c.recurrence_days))
        OR
        -- Weekly checklists that include this day
        (c.recurrence_type = 'weekly' AND day_of_week = ANY(c.recurrence_days))
        OR
        -- One-time checklists (create manually)
        c.recurrence_type = 'once'
      )
  LOOP
    -- Check if instance already exists for this date
    SELECT id INTO new_instance_id
    FROM checklist_instances
    WHERE checklist_id = checklist_record.id AND date = date_param;
    
    -- If not exists, create new instance
    IF new_instance_id IS NULL THEN
      INSERT INTO checklist_instances (checklist_id, shop_id, date, total_items)
      VALUES (checklist_record.id, shop_id_param, date_param, checklist_record.item_count)
      RETURNING id INTO new_instance_id;
      
      -- Return info about created instance
      instance_id := new_instance_id;
      checklist_name := checklist_record.name;
      items_count := checklist_record.item_count;
      RETURN NEXT;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- 9. MIGRATE EXISTING DATA (if any)
-- ==========================================

-- Note: If you had existing assignments, you would migrate them here
-- Since this is a fresh implementation, we'll skip this

-- ==========================================
-- 10. CREATE INITIAL INSTANCES FOR TODAY
-- ==========================================

-- Auto-create today's instances for all shops
-- (Run this manually after migration or set up as cron job)
/*
DO $$
DECLARE
  shop_record RECORD;
BEGIN
  FOR shop_record IN SELECT id FROM shops
  LOOP
    PERFORM create_daily_checklist_instances(shop_record.id, CURRENT_DATE);
  END LOOP;
END $$;
*/
