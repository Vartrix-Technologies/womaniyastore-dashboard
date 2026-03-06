-- Migration: Fix infinite recursion on profiles UPDATE policy
-- Date: 2026-03-06
--
-- Root cause: The "profiles_update" policy (created in 20260303) contains
-- direct subqueries on the `profiles` table:
--
--   shop_id IN (SELECT shop_id FROM profiles WHERE id = auth.uid() AND role IN (...))
--   EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'superadmin')
--
-- When PostgreSQL evaluates this UPDATE policy, the embedded SELECT on
-- `profiles` triggers the profiles_select RLS policy, which is already
-- being evaluated → infinite recursion.
--
-- Fix: Replace direct `profiles` subqueries with the existing SECURITY DEFINER
-- helper functions get_my_shop_id() and get_my_role(), which bypass RLS.
-- This matches the pattern already used successfully in profiles_select.


-- ============================================================================
-- STEP 1: Drop the broken UPDATE policy
-- ============================================================================
DROP POLICY IF EXISTS "profiles_update" ON public.profiles;


-- ============================================================================
-- STEP 2: Recreate UPDATE policy using SECURITY DEFINER helpers (no recursion)
-- ============================================================================
CREATE POLICY "profiles_update" ON public.profiles
FOR UPDATE
TO authenticated
USING (
  -- Users can update their own profile
  (select auth.uid()) = id
  -- Admins/owners can update profiles in their shop
  OR (
    shop_id = public.get_my_shop_id()
    AND public.get_my_role() IN ('admin', 'owner')
  )
  -- Superadmins can update any profile globally
  OR public.get_my_role() = 'superadmin'
)
WITH CHECK (
  -- Same logic for WITH CHECK
  (select auth.uid()) = id
  OR (
    shop_id = public.get_my_shop_id()
    AND public.get_my_role() IN ('admin', 'owner')
  )
  OR public.get_my_role() = 'superadmin'
);
