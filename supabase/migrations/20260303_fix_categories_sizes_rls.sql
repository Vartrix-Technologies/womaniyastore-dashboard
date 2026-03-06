-- Migration: Fix RLS policies on categories and sizes tables
-- Date: 2026-03-03
--
-- Problem: UPDATE and DELETE operations on categories/sizes return 204 but
-- don't actually modify any rows — classic RLS silent filtering.
--
-- Root cause: These two tables were NOT included in the
-- 20260301_fix_rls_performance.sql bulk policy rewrite (which cleaned up
-- 14 other tables). Any stale or duplicate policies created via the
-- Supabase Dashboard were never cleared, potentially blocking mutations.
--
-- Fix: Same pattern as 20260301 — dynamically drop ALL existing policies
-- (catching Dashboard-created ones) and recreate them cleanly with the
-- (select auth.uid()) initplan optimization.

-- ============================================================================
-- STEP 1: Drop ALL existing policies on categories and sizes
-- ============================================================================
DO $$
DECLARE
  pol RECORD;
  tables TEXT[] := ARRAY['categories', 'sizes'];
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
-- STEP 2: Ensure RLS is enabled (idempotent)
-- ============================================================================
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sizes ENABLE ROW LEVEL SECURITY;


-- ============================================================================
-- STEP 3: Recreate categories policies
-- ============================================================================

-- SELECT: Any authenticated user in the same shop can view categories
CREATE POLICY "categories_select"
  ON public.categories
  FOR SELECT
  TO authenticated
  USING (
    shop_id IN (
      SELECT shop_id FROM public.profiles
      WHERE id = (select auth.uid())
    )
  );

-- INSERT: Admins+ in the same shop can create categories
CREATE POLICY "categories_insert"
  ON public.categories
  FOR INSERT
  TO authenticated
  WITH CHECK (
    shop_id IN (
      SELECT shop_id FROM public.profiles
      WHERE id = (select auth.uid())
        AND role IN ('admin', 'owner', 'superadmin')
    )
  );

-- UPDATE: Admins+ in the same shop can edit categories
CREATE POLICY "categories_update"
  ON public.categories
  FOR UPDATE
  TO authenticated
  USING (
    shop_id IN (
      SELECT shop_id FROM public.profiles
      WHERE id = (select auth.uid())
        AND role IN ('admin', 'owner', 'superadmin')
    )
  )
  WITH CHECK (
    shop_id IN (
      SELECT shop_id FROM public.profiles
      WHERE id = (select auth.uid())
        AND role IN ('admin', 'owner', 'superadmin')
    )
  );

-- DELETE: Admins+ in the same shop can delete categories
CREATE POLICY "categories_delete"
  ON public.categories
  FOR DELETE
  TO authenticated
  USING (
    shop_id IN (
      SELECT shop_id FROM public.profiles
      WHERE id = (select auth.uid())
        AND role IN ('admin', 'owner', 'superadmin')
    )
  );


-- ============================================================================
-- STEP 4: Recreate sizes policies
-- ============================================================================

-- SELECT: Any authenticated user in the same shop can view sizes
CREATE POLICY "sizes_select"
  ON public.sizes
  FOR SELECT
  TO authenticated
  USING (
    shop_id IN (
      SELECT shop_id FROM public.profiles
      WHERE id = (select auth.uid())
    )
  );

-- INSERT: Admins+ in the same shop can create sizes
CREATE POLICY "sizes_insert"
  ON public.sizes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    shop_id IN (
      SELECT shop_id FROM public.profiles
      WHERE id = (select auth.uid())
        AND role IN ('admin', 'owner', 'superadmin')
    )
  );

-- UPDATE: Admins+ in the same shop can edit sizes
CREATE POLICY "sizes_update"
  ON public.sizes
  FOR UPDATE
  TO authenticated
  USING (
    shop_id IN (
      SELECT shop_id FROM public.profiles
      WHERE id = (select auth.uid())
        AND role IN ('admin', 'owner', 'superadmin')
    )
  )
  WITH CHECK (
    shop_id IN (
      SELECT shop_id FROM public.profiles
      WHERE id = (select auth.uid())
        AND role IN ('admin', 'owner', 'superadmin')
    )
  );

-- DELETE: Admins+ in the same shop can delete sizes
CREATE POLICY "sizes_delete"
  ON public.sizes
  FOR DELETE
  TO authenticated
  USING (
    shop_id IN (
      SELECT shop_id FROM public.profiles
      WHERE id = (select auth.uid())
        AND role IN ('admin', 'owner', 'superadmin')
    )
  );
