-- Migration: Fix SECURITY DEFINER on user_profiles view
-- Date: 2026-02-08
-- Description: Resolves Supabase Security Advisor warning about the user_profiles 
-- view running with the view owner's (privileged) permissions, which bypasses RLS 
-- on the underlying profiles table.
--
-- Root cause: The view was created by a privileged role (postgres/supabase_admin).
-- By default, PostgreSQL views execute with the OWNER's permissions. Since the owner
-- has elevated privileges, RLS on profiles is bypassed for anyone querying the view.
--
-- Impact: Any authenticated user could potentially read ALL user profiles
-- (user_id, shop_id, role) through this view, regardless of RLS policies.
--
-- Fix:
--   1. Ensure profiles table has proper SELECT RLS policies
--   2. Recreate user_profiles view with security_invoker = true (PostgreSQL 15+)
--      so it respects the calling user's RLS permissions
--
-- The ~45+ RLS policies on other tables that use subqueries like
--   SELECT shop_id FROM user_profiles WHERE user_id = auth.uid()
-- will continue to work because each user can read their own profile row.

-- =====================================================
-- STEP 1A: Create SECURITY DEFINER helper functions
-- =====================================================
-- These are minimal, safe helpers that return ONLY the calling user's
-- own shop_id and role. They bypass RLS (SECURITY DEFINER) but are safe 
-- because they only ever query for auth.uid(). 
-- We need these to avoid infinite recursion when profiles RLS policies 
-- need to check the current user's role/shop.

CREATE OR REPLACE FUNCTION public.get_my_shop_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT shop_id FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role::text FROM public.profiles WHERE id = auth.uid();
$$;

-- Restrict execution to authenticated users only
REVOKE EXECUTE ON FUNCTION public.get_my_shop_id() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_my_shop_id() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_my_role() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated;

-- =====================================================
-- STEP 1B: Ensure profiles table has SELECT RLS policies
-- =====================================================
-- These use the SECURITY DEFINER helpers above to avoid infinite 
-- recursion (policies on profiles cannot query profiles directly).

-- Ensure RLS is enabled on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Policy: Authenticated users can read their own profile
-- This is the critical policy that enables all RLS subqueries using 
-- user_profiles (they all filter by user_id = auth.uid())
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- Policy: Admins/owners can view all profiles in their shop
-- Required for the admin staff management page which does:
--   .from('profiles').eq('shop_id', profile.shop_id)
-- Uses get_my_shop_id() and get_my_role() helpers to avoid recursion.
DROP POLICY IF EXISTS "Admins can view shop profiles" ON public.profiles;
CREATE POLICY "Admins can view shop profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  shop_id = public.get_my_shop_id()
  AND public.get_my_role() IN ('admin', 'owner')
);

-- Policy: Superadmins can view all profiles
-- Required for the superadmin management page
-- Uses get_my_role() helper to avoid recursion.
DROP POLICY IF EXISTS "Superadmins can view all profiles" ON public.profiles;
CREATE POLICY "Superadmins can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  public.get_my_role() = 'superadmin'
);

-- =====================================================
-- STEP 2: Set security_invoker on existing user_profiles view
-- =====================================================
-- security_invoker = true makes the view execute with the CALLING USER's 
-- permissions instead of the view owner's. This ensures RLS on the 
-- underlying profiles table is enforced.
--
-- We use ALTER VIEW instead of DROP/CREATE because ~25 RLS policies
-- on other tables depend on this view and DROP would cascade-fail.

ALTER VIEW public.user_profiles SET (security_invoker = on);

-- =====================================================
-- STEP 3: Documentation
-- =====================================================
COMMENT ON VIEW public.user_profiles IS 
'Helper view for RLS policies. Uses security_invoker = true to ensure 
the calling user''s RLS permissions on profiles are respected. 
Fixed 2026-02-08 per Supabase Security Advisor recommendation.';
