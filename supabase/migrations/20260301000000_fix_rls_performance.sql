-- Migration: Fix RLS Performance Issues
-- Date: 2026-03-01
-- 
-- Fixes:
-- 1. auth_rls_initplan (WARN): Wraps all bare auth.uid() calls with (select auth.uid())
--    so PostgreSQL evaluates it once per query instead of per-row.
-- 2. multiple_permissive_policies (WARN): Drops duplicate dashboard-created policies
--    and removes clearly redundant policies.
--
-- Affected tables (14 flagged by linter + 2 additional for consistency):
--   profiles, expense_categories, financial_transactions, qr_codes, 
--   checklists, checklist_items, checklist_instances, checklist_item_completions,
--   attendance_logs, sale_returns, inventory_items, lots, qr_prefixes, sales
--
-- IMPORTANT: This migration drops ALL existing RLS policies on the listed tables
-- and recreates them with the performance fix applied. This ensures no stale
-- dashboard-created duplicate policies remain.

-- ============================================================================
-- STEP 1: Drop ALL existing policies on affected tables
-- ============================================================================
-- Uses a DO block to dynamically drop all policies, including any created
-- via the Supabase Dashboard that aren't tracked in migration files.

DO $$
DECLARE
  pol RECORD;
  tables TEXT[] := ARRAY[
    'profiles', 'expense_categories', 'financial_transactions',
    'qr_codes', 'checklists', 'checklist_items', 'checklist_instances',
    'checklist_item_completions', 'attendance_logs', 'sale_returns',
    'inventory_items', 'lots', 'qr_prefixes', 'sales'
  ];
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY tables
  LOOP
    FOR pol IN
      SELECT policyname
      FROM pg_policies
      WHERE tablename = tbl AND schemaname = 'public'
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, tbl);
    END LOOP;
  END LOOP;
END $$;


-- ============================================================================
-- STEP 2: Recreate all policies with (select auth.uid()) optimization
-- ============================================================================
-- Key change: Every occurrence of  auth.uid()  is now  (select auth.uid())
-- This tells PostgreSQL to evaluate it as a constant subquery (initplan),
-- computing the value once and reusing it for all row checks.


-- ============================================================================
-- 2A. PROFILES TABLE
-- ============================================================================
-- Uses TO authenticated explicitly (matching original migration).
-- Helper functions get_my_shop_id() / get_my_role() don't use bare auth.uid()
-- in the policy expression, so those policies don't need the fix but are
-- recreated here for completeness.

-- SELECT: User can view their own profile
CREATE POLICY "Users can view own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING ((select auth.uid()) = id);

-- SELECT: Admins/owners can view all profiles in their shop
-- Uses SECURITY DEFINER helper functions to avoid infinite recursion
CREATE POLICY "Admins can view shop profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  shop_id = public.get_my_shop_id()
  AND public.get_my_role() IN ('admin', 'owner')
);

-- SELECT: Superadmins can view all profiles globally
CREATE POLICY "Superadmins can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  public.get_my_role() = 'superadmin'
);

-- UPDATE: User can update their own profile
CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING ((select auth.uid()) = id)
WITH CHECK ((select auth.uid()) = id);

-- UPDATE: Admins/owners/superadmins can update profiles in their shop
CREATE POLICY "Admins can update shop staff"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  shop_id IN (
    SELECT shop_id 
    FROM profiles 
    WHERE id = (select auth.uid()) 
    AND role IN ('admin', 'owner', 'superadmin')
  )
)
WITH CHECK (
  shop_id IN (
    SELECT shop_id 
    FROM profiles 
    WHERE id = (select auth.uid()) 
    AND role IN ('admin', 'owner', 'superadmin')
  )
);

-- UPDATE: Superadmins can manage password flags for any user
CREATE POLICY "Superadmin can manage user password flags"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = (select auth.uid()) AND role = 'superadmin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = (select auth.uid()) AND role = 'superadmin'
  )
);

-- NOTE: "Users can clear their own must_change_password flag" policy was removed.
-- It was redundant because "Users can update own profile" already allows
-- users to update any field in their own row (USING auth.uid() = id).
-- Since both were PERMISSIVE, the more restrictive WITH CHECK on the
-- must_change_password policy had no effect.


-- ============================================================================
-- 2B. EXPENSE_CATEGORIES TABLE
-- ============================================================================

CREATE POLICY "Users can view expense categories for their shop"
  ON public.expense_categories FOR SELECT
  USING (
    shop_id IN (
      SELECT shop_id FROM user_profiles WHERE user_id = (select auth.uid())
    )
  );

CREATE POLICY "Users can insert expense categories for their shop"
  ON public.expense_categories FOR INSERT
  WITH CHECK (
    shop_id IN (
      SELECT shop_id FROM user_profiles WHERE user_id = (select auth.uid())
    )
  );

CREATE POLICY "Users can update expense categories for their shop"
  ON public.expense_categories FOR UPDATE
  USING (
    shop_id IN (
      SELECT shop_id FROM user_profiles WHERE user_id = (select auth.uid())
    )
  );

CREATE POLICY "Users can delete expense categories for their shop"
  ON public.expense_categories FOR DELETE
  USING (
    shop_id IN (
      SELECT shop_id FROM user_profiles WHERE user_id = (select auth.uid())
    )
  );


-- ============================================================================
-- 2C. FINANCIAL_TRANSACTIONS TABLE
-- ============================================================================

CREATE POLICY "Users can view financial transactions for their shop"
  ON public.financial_transactions FOR SELECT
  USING (
    shop_id IN (
      SELECT shop_id FROM user_profiles WHERE user_id = (select auth.uid())
    )
  );

CREATE POLICY "Users can insert financial transactions for their shop"
  ON public.financial_transactions FOR INSERT
  WITH CHECK (
    shop_id IN (
      SELECT shop_id FROM user_profiles WHERE user_id = (select auth.uid())
    )
  );

CREATE POLICY "Users can update financial transactions for their shop"
  ON public.financial_transactions FOR UPDATE
  USING (
    shop_id IN (
      SELECT shop_id FROM user_profiles WHERE user_id = (select auth.uid())
    )
  );

CREATE POLICY "Users can delete financial transactions for their shop"
  ON public.financial_transactions FOR DELETE
  USING (
    shop_id IN (
      SELECT shop_id FROM user_profiles WHERE user_id = (select auth.uid())
    )
  );


-- ============================================================================
-- 2D. QR_CODES TABLE
-- ============================================================================

CREATE POLICY "Users can view QR codes for their shop"
  ON public.qr_codes FOR SELECT
  USING (
    shop_id IN (
      SELECT shop_id FROM user_profiles WHERE user_id = (select auth.uid())
    )
  );

CREATE POLICY "Users can insert QR codes for their shop"
  ON public.qr_codes FOR INSERT
  WITH CHECK (
    shop_id IN (
      SELECT shop_id FROM user_profiles WHERE user_id = (select auth.uid())
    )
  );

CREATE POLICY "Users can update QR codes for their shop"
  ON public.qr_codes FOR UPDATE
  USING (
    shop_id IN (
      SELECT shop_id FROM user_profiles WHERE user_id = (select auth.uid())
    )
  );

CREATE POLICY "Users can delete QR codes for their shop"
  ON public.qr_codes FOR DELETE
  USING (
    shop_id IN (
      SELECT shop_id FROM user_profiles WHERE user_id = (select auth.uid())
    )
  );


-- ============================================================================
-- 2E. CHECKLISTS TABLE
-- ============================================================================

-- All users in shop can view checklists
CREATE POLICY "Users can view checklists for their shop"
  ON public.checklists FOR SELECT
  USING (
    shop_id IN (
      SELECT shop_id FROM user_profiles WHERE user_id = (select auth.uid())
    )
  );

-- Only admins and owners can create checklists
CREATE POLICY "Admins can insert checklists for their shop"
  ON public.checklists FOR INSERT
  WITH CHECK (
    shop_id IN (
      SELECT shop_id FROM user_profiles 
      WHERE user_id = (select auth.uid()) 
      AND role IN ('owner', 'admin')
    )
  );

-- Only admins and owners can update checklists
CREATE POLICY "Admins can update checklists for their shop"
  ON public.checklists FOR UPDATE
  USING (
    shop_id IN (
      SELECT shop_id FROM user_profiles 
      WHERE user_id = (select auth.uid()) 
      AND role IN ('owner', 'admin')
    )
  );

-- Only admins and owners can delete checklists
CREATE POLICY "Admins can delete checklists for their shop"
  ON public.checklists FOR DELETE
  USING (
    shop_id IN (
      SELECT shop_id FROM user_profiles 
      WHERE user_id = (select auth.uid()) 
      AND role IN ('owner', 'admin')
    )
  );


-- ============================================================================
-- 2F. CHECKLIST_ITEMS TABLE
-- ============================================================================

-- All users in shop can view items (via parent checklist's shop_id)
CREATE POLICY "Users can view checklist items"
  ON public.checklist_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM checklists 
      WHERE checklists.id = checklist_items.checklist_id
      AND checklists.shop_id IN (
        SELECT shop_id FROM user_profiles WHERE user_id = (select auth.uid())
      )
    )
  );

-- Only admins can insert items
CREATE POLICY "Admins can insert checklist items"
  ON public.checklist_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM checklists 
      WHERE checklists.id = checklist_items.checklist_id
      AND checklists.shop_id IN (
        SELECT shop_id FROM user_profiles 
        WHERE user_id = (select auth.uid()) 
        AND role IN ('owner', 'admin')
      )
    )
  );

-- Only admins can update items
CREATE POLICY "Admins can update checklist items"
  ON public.checklist_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM checklists 
      WHERE checklists.id = checklist_items.checklist_id
      AND checklists.shop_id IN (
        SELECT shop_id FROM user_profiles 
        WHERE user_id = (select auth.uid()) 
        AND role IN ('owner', 'admin')
      )
    )
  );

-- Only admins can delete items
CREATE POLICY "Admins can delete checklist items"
  ON public.checklist_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM checklists 
      WHERE checklists.id = checklist_items.checklist_id
      AND checklists.shop_id IN (
        SELECT shop_id FROM user_profiles 
        WHERE user_id = (select auth.uid()) 
        AND role IN ('owner', 'admin')
      )
    )
  );


-- ============================================================================
-- 2G. CHECKLIST_INSTANCES TABLE
-- ============================================================================

-- All users in shop can view instances
CREATE POLICY "Users can view checklist instances for their shop"
  ON public.checklist_instances FOR SELECT
  USING (
    shop_id IN (
      SELECT shop_id FROM user_profiles WHERE user_id = (select auth.uid())
    )
  );

-- Users can create instances (for auto-creation)
CREATE POLICY "System can create checklist instances"
  ON public.checklist_instances FOR INSERT
  WITH CHECK (
    shop_id IN (
      SELECT shop_id FROM user_profiles 
      WHERE user_id = (select auth.uid())
    )
  );

-- Users can update instances (progress tracking)
CREATE POLICY "System can update checklist instances"
  ON public.checklist_instances FOR UPDATE
  USING (
    shop_id IN (
      SELECT shop_id FROM user_profiles WHERE user_id = (select auth.uid())
    )
  );


-- ============================================================================
-- 2H. CHECKLIST_ITEM_COMPLETIONS TABLE
-- ============================================================================

-- All users can view completions for their shop (via parent instance)
CREATE POLICY "Users can view completions for their shop"
  ON public.checklist_item_completions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM checklist_instances 
      WHERE checklist_instances.id = checklist_item_completions.instance_id
      AND checklist_instances.shop_id IN (
        SELECT shop_id FROM user_profiles WHERE user_id = (select auth.uid())
      )
    )
  );

-- Staff can mark items complete (must be own completion + in own shop)
CREATE POLICY "Staff can mark items complete"
  ON public.checklist_item_completions FOR INSERT
  WITH CHECK (
    completed_by = (select auth.uid())
    AND EXISTS (
      SELECT 1 FROM checklist_instances 
      WHERE checklist_instances.id = checklist_item_completions.instance_id
      AND checklist_instances.shop_id IN (
        SELECT shop_id FROM user_profiles WHERE user_id = (select auth.uid())
      )
    )
  );

-- Staff can update their own completions (add notes, etc.)
CREATE POLICY "Staff can update their own completions"
  ON public.checklist_item_completions FOR UPDATE
  USING (
    completed_by = (select auth.uid())
  );


-- ============================================================================
-- 2I. ATTENDANCE_LOGS TABLE
-- ============================================================================
-- Consolidated from 5 policies (3 migration + 2 dashboard-created) to 3:
--   - Removed duplicate "attendance_insert" (dashboard) → kept "attendance_insert"
--   - Removed redundant "attendance_delete" (FOR UPDATE, subset of "attendance_update")
--   - Added proper SELECT policy (was only dashboard-created before)

-- SELECT: Users can view attendance records for their shop
CREATE POLICY "attendance_select" ON public.attendance_logs
  FOR SELECT
  USING (
    shop_id = (SELECT shop_id FROM profiles WHERE id = (select auth.uid()))
  );

-- INSERT: Admins can create entries, staff can create their own
CREATE POLICY "attendance_insert" ON public.attendance_logs
  FOR INSERT
  WITH CHECK (
    shop_id = (SELECT shop_id FROM profiles WHERE id = (select auth.uid()))
    AND (
      (SELECT role FROM profiles WHERE id = (select auth.uid())) IN ('owner', 'admin')
      OR staff_id = (select auth.uid())
    )
  );

-- UPDATE: Admins can update any record, staff can update their own ongoing attendance
CREATE POLICY "attendance_update" ON public.attendance_logs
  FOR UPDATE
  USING (
    shop_id = (SELECT shop_id FROM profiles WHERE id = (select auth.uid()))
    AND (
      (SELECT role FROM profiles WHERE id = (select auth.uid())) IN ('owner', 'admin')
      OR staff_id = (select auth.uid())
    )
  )
  WITH CHECK (
    shop_id = (SELECT shop_id FROM profiles WHERE id = (select auth.uid()))
  );


-- ============================================================================
-- 2J. SALE_RETURNS TABLE
-- ============================================================================

CREATE POLICY "Users can view sale returns for their shop"
  ON public.sale_returns FOR SELECT
  USING (
    shop_id IN (
      SELECT shop_id FROM user_profiles WHERE user_id = (select auth.uid())
    )
  );

CREATE POLICY "Users can insert sale returns for their shop"
  ON public.sale_returns FOR INSERT
  WITH CHECK (
    shop_id IN (
      SELECT shop_id FROM user_profiles WHERE user_id = (select auth.uid())
    )
  );

CREATE POLICY "Users can update sale returns for their shop"
  ON public.sale_returns FOR UPDATE
  USING (
    shop_id IN (
      SELECT shop_id FROM user_profiles WHERE user_id = (select auth.uid())
    )
  );

CREATE POLICY "Users can delete sale returns for their shop"
  ON public.sale_returns FOR DELETE
  USING (
    shop_id IN (
      SELECT shop_id FROM user_profiles WHERE user_id = (select auth.uid())
    )
  );


-- ============================================================================
-- 2K. INVENTORY_ITEMS TABLE
-- ============================================================================

CREATE POLICY "Users can view inventory items for their shop"
  ON public.inventory_items FOR SELECT
  USING (
    shop_id IN (
      SELECT shop_id FROM user_profiles WHERE user_id = (select auth.uid())
    )
  );

CREATE POLICY "Users can insert inventory items for their shop"
  ON public.inventory_items FOR INSERT
  WITH CHECK (
    shop_id IN (
      SELECT shop_id FROM user_profiles WHERE user_id = (select auth.uid())
    )
  );

CREATE POLICY "Users can update inventory items for their shop"
  ON public.inventory_items FOR UPDATE
  USING (
    shop_id IN (
      SELECT shop_id FROM user_profiles WHERE user_id = (select auth.uid())
    )
  );

CREATE POLICY "Users can delete inventory items for their shop"
  ON public.inventory_items FOR DELETE
  USING (
    shop_id IN (
      SELECT shop_id FROM user_profiles WHERE user_id = (select auth.uid())
    )
  );


-- ============================================================================
-- 2L. LOTS TABLE
-- ============================================================================

CREATE POLICY "Users can view lots for their shop"
  ON public.lots FOR SELECT
  USING (
    shop_id IN (
      SELECT shop_id FROM user_profiles WHERE user_id = (select auth.uid())
    )
  );

CREATE POLICY "Users can insert lots for their shop"
  ON public.lots FOR INSERT
  WITH CHECK (
    shop_id IN (
      SELECT shop_id FROM user_profiles WHERE user_id = (select auth.uid())
    )
  );

CREATE POLICY "Users can update lots for their shop"
  ON public.lots FOR UPDATE
  USING (
    shop_id IN (
      SELECT shop_id FROM user_profiles WHERE user_id = (select auth.uid())
    )
  );

CREATE POLICY "Users can delete lots for their shop"
  ON public.lots FOR DELETE
  USING (
    shop_id IN (
      SELECT shop_id FROM user_profiles WHERE user_id = (select auth.uid())
    )
  );


-- ============================================================================
-- 2M. QR_PREFIXES TABLE
-- ============================================================================

-- All authenticated users can view prefixes for their shop
CREATE POLICY "qr_prefixes_select" ON public.qr_prefixes
  FOR SELECT 
  USING (
    shop_id IN (
      SELECT shop_id FROM user_profiles WHERE user_id = (select auth.uid())
    )
  );

-- Only admins/owners can create prefixes
CREATE POLICY "qr_prefixes_insert" ON public.qr_prefixes
  FOR INSERT 
  WITH CHECK (
    shop_id IN (
      SELECT shop_id FROM user_profiles 
      WHERE user_id = (select auth.uid()) 
      AND role IN ('owner', 'admin', 'superadmin')
    )
  );

-- Only admins/owners can edit prefixes
CREATE POLICY "qr_prefixes_update" ON public.qr_prefixes
  FOR UPDATE 
  USING (
    shop_id IN (
      SELECT shop_id FROM user_profiles 
      WHERE user_id = (select auth.uid()) 
      AND role IN ('owner', 'admin', 'superadmin')
    )
  )
  WITH CHECK (
    shop_id IN (
      SELECT shop_id FROM user_profiles 
      WHERE user_id = (select auth.uid()) 
      AND role IN ('owner', 'admin', 'superadmin')
    )
  );

-- Only admins/owners can delete prefixes
CREATE POLICY "qr_prefixes_delete" ON public.qr_prefixes
  FOR DELETE 
  USING (
    shop_id IN (
      SELECT shop_id FROM user_profiles 
      WHERE user_id = (select auth.uid()) 
      AND role IN ('owner', 'admin', 'superadmin')
    )
  );


-- ============================================================================
-- 2N. SALES TABLE
-- ============================================================================
-- NOTE: No RLS policies existed in migration files for this table — they were
-- created via the Supabase Dashboard. This migration creates proper tracked
-- policies following the standard shop_id pattern used by all other tables.

-- Ensure RLS is enabled
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view sales for their shop"
  ON public.sales FOR SELECT
  USING (
    shop_id IN (
      SELECT shop_id FROM user_profiles WHERE user_id = (select auth.uid())
    )
  );

CREATE POLICY "Users can insert sales for their shop"
  ON public.sales FOR INSERT
  WITH CHECK (
    shop_id IN (
      SELECT shop_id FROM user_profiles WHERE user_id = (select auth.uid())
    )
  );

CREATE POLICY "Users can update sales for their shop"
  ON public.sales FOR UPDATE
  USING (
    shop_id IN (
      SELECT shop_id FROM user_profiles WHERE user_id = (select auth.uid())
    )
  );

CREATE POLICY "Users can delete sales for their shop"
  ON public.sales FOR DELETE
  USING (
    shop_id IN (
      SELECT shop_id FROM user_profiles WHERE user_id = (select auth.uid())
    )
  );


-- ============================================================================
-- STEP 3: Update helper functions to also use (select auth.uid())
-- ============================================================================
-- While not strictly flagged by the linter (they're functions, not policy
-- expressions), optimizing these provides consistent performance since
-- they're called from RLS policy evaluations.

CREATE OR REPLACE FUNCTION public.get_my_shop_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT shop_id FROM public.profiles WHERE id = (select auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role::text FROM public.profiles WHERE id = (select auth.uid());
$$;
