-- Migration: Fix mutable search_path on all functions
-- Date: 2026-02-08
-- Description: Resolves Supabase Security Advisor warning about functions with 
-- mutable search_path. Without a pinned search_path, a malicious actor could 
-- manipulate schema resolution to hijack function behavior.
--
-- All 15 functions are recreated with SET search_path = public.
-- SECURITY DEFINER functions are highest priority (marked HIGH).

-- =====================================================
-- HIGH PRIORITY: SECURITY DEFINER functions without search_path
-- =====================================================

-- 1. mark_password_changed() — SECURITY DEFINER, no search_path
CREATE OR REPLACE FUNCTION public.mark_password_changed()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET 
    must_change_password = false,
    password_changed_at = NOW()
  WHERE id = auth.uid();
END;
$$;

-- 2. create_daily_checklist_instances() — SECURITY DEFINER, no search_path
CREATE OR REPLACE FUNCTION create_daily_checklist_instances(shop_id_param UUID, date_param DATE DEFAULT CURRENT_DATE)
RETURNS TABLE(instance_id UUID, checklist_name TEXT, items_count INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

-- 3. generate_bill_number() — SECURITY DEFINER, no search_path
CREATE OR REPLACE FUNCTION generate_bill_number(p_shop_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

-- =====================================================
-- LOWER PRIORITY: Non-SECURITY DEFINER trigger functions
-- =====================================================
-- These run with caller's privileges so risk is lower,
-- but pinning search_path is still best practice.

-- 4. update_checklist_instance_progress() — trigger function
CREATE OR REPLACE FUNCTION update_checklist_instance_progress()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
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
$$;

-- 5. update_checklists_updated_at() — trigger function
CREATE OR REPLACE FUNCTION update_checklists_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- 6. check_duplicate_attendance() — trigger function
CREATE OR REPLACE FUNCTION check_duplicate_attendance()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Check if staff already has attendance for this date (excluding deleted records)
  IF EXISTS (
    SELECT 1 FROM attendance_logs
    WHERE staff_id = NEW.staff_id
      AND date = NEW.date
      AND deleted_at IS NULL
      AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
  ) THEN
    RAISE EXCEPTION 'Staff already has attendance record for this date';
  END IF;
  
  RETURN NEW;
END;
$$;

-- 7. validate_clock_times() — trigger function
CREATE OR REPLACE FUNCTION validate_clock_times()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- If clock_out exists, ensure it's after clock_in
  IF NEW.clock_out IS NOT NULL AND NEW.clock_out <= NEW.clock_in THEN
    RAISE EXCEPTION 'Clock out time must be after clock in time';
  END IF;
  
  -- Validate break time isn't too long
  IF NEW.total_break_minutes IS NOT NULL AND NEW.total_break_minutes > 480 THEN
    RAISE EXCEPTION 'Break time cannot exceed 8 hours';
  END IF;
  
  RETURN NEW;
END;
$$;

-- 8. update_financial_transactions_updated_at() — trigger function
CREATE OR REPLACE FUNCTION update_financial_transactions_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- 9. update_expense_categories_updated_at() — trigger function
CREATE OR REPLACE FUNCTION update_expense_categories_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- =====================================================
-- AUTH HELPER FUNCTIONS (created outside migrations)
-- These exist in the DB but had no local migration file.
-- Recreating with SET search_path = public.
-- =====================================================

-- 10. current_profile() — returns current user's profile id
CREATE OR REPLACE FUNCTION public.current_profile()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.profiles WHERE id = auth.uid();
$$;

-- 11. current_role() — returns current user's role
CREATE OR REPLACE FUNCTION public.current_role()
RETURNS public.user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

-- 12. current_shop_id() — returns current user's shop_id
CREATE OR REPLACE FUNCTION public.current_shop_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT shop_id FROM public.profiles WHERE id = auth.uid();
$$;

-- 13. is_admin() — checks if current user is admin or higher
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'owner', 'superadmin')
  );
$$;

-- 14. is_staff_or_higher() — checks if current user is staff or higher
CREATE OR REPLACE FUNCTION public.is_staff_or_higher()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND role IN ('staff', 'admin', 'owner', 'superadmin')
  );
$$;

-- 15. is_superadmin() — checks if current user is superadmin
CREATE OR REPLACE FUNCTION public.is_superadmin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND role = 'superadmin'
  );
$$;
