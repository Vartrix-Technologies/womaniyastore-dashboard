-- Migration: Consolidate profiles RLS policies + fix missing FK index
-- Date: 2026-03-03
--
-- Fixes:
-- 1. multiple_permissive_policies (WARN): Consolidates 3 SELECT and 3 UPDATE
--    policies on profiles into 1 each, using OR logic.
-- 2. unindexed_foreign_keys (INFO): Adds back completed_by index on
--    checklist_item_completions (dropped in previous migration as "unused",
--    but still needed for FK constraint enforcement).
--
-- NOTE on "unused index" warnings for newly created indexes:
--   The ~30 indexes created in 20260302_optimize_indexes.sql correctly show
--   0 scans in pg_stat_user_indexes because they were JUST created.
--   These are FK indexes needed for CASCADE operations and RLS policy checks.
--   They will accumulate usage stats as the app processes queries.
--   Do NOT remove them — the linter will stop flagging them after some usage.


-- ============================================================================
-- STEP 1: Consolidate profiles SELECT policies into one
-- ============================================================================
-- Before: 3 separate permissive SELECT policies (user/admin/superadmin)
-- After:  1 combined policy with OR logic (same effective access)

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view shop profiles" ON public.profiles;
DROP POLICY IF EXISTS "Superadmins can view all profiles" ON public.profiles;

CREATE POLICY "profiles_select" ON public.profiles
FOR SELECT
TO authenticated
USING (
  -- Users can always view their own profile
  (select auth.uid()) = id
  -- Admins/owners can view all profiles in their shop
  OR (
    shop_id = public.get_my_shop_id()
    AND public.get_my_role() IN ('admin', 'owner')
  )
  -- Superadmins can view all profiles globally
  OR public.get_my_role() = 'superadmin'
);


-- ============================================================================
-- STEP 2: Consolidate profiles UPDATE policies into one
-- ============================================================================
-- Before: 3 separate permissive UPDATE policies
-- After:  1 combined policy with OR logic (same effective access)

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update shop staff" ON public.profiles;
DROP POLICY IF EXISTS "Superadmin can manage user password flags" ON public.profiles;

CREATE POLICY "profiles_update" ON public.profiles
FOR UPDATE
TO authenticated
USING (
  -- Users can update their own profile
  (select auth.uid()) = id
  -- Admins/owners/superadmins can update profiles in their shop
  OR shop_id IN (
    SELECT shop_id FROM profiles
    WHERE id = (select auth.uid())
    AND role IN ('admin', 'owner', 'superadmin')
  )
  -- Superadmins can update any profile globally
  OR EXISTS (
    SELECT 1 FROM profiles
    WHERE id = (select auth.uid()) AND role = 'superadmin'
  )
)
WITH CHECK (
  (select auth.uid()) = id
  OR shop_id IN (
    SELECT shop_id FROM profiles
    WHERE id = (select auth.uid())
    AND role IN ('admin', 'owner', 'superadmin')
  )
  OR EXISTS (
    SELECT 1 FROM profiles
    WHERE id = (select auth.uid()) AND role = 'superadmin'
  )
);


-- ============================================================================
-- STEP 3: Add back completed_by FK index
-- ============================================================================
-- This was dropped in 20260302 as "unused" by pg_stat, but the FK constraint
-- checklist_item_completions_completed_by_fkey still needs it for efficient
-- CASCADE checks when a profile is updated/deleted.

CREATE INDEX IF NOT EXISTS idx_checklist_item_completions_completed_by
  ON public.checklist_item_completions (completed_by);
