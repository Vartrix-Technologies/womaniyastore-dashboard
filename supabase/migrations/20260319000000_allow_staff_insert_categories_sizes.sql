-- Migration: Allow staff to INSERT categories and sizes
-- Staff need to create new categories/sizes from the Quick Add dialog in POS.
-- UPDATE and DELETE remain admin/owner/superadmin only.

-- ============================================================================
-- STEP 1: Replace categories INSERT policy to include 'staff' role
-- ============================================================================
DROP POLICY IF EXISTS "categories_insert" ON public.categories;

CREATE POLICY "categories_insert"
  ON public.categories
  FOR INSERT
  TO authenticated
  WITH CHECK (
    shop_id IN (
      SELECT shop_id FROM public.profiles
      WHERE id = (select auth.uid())
        AND role IN ('admin', 'owner', 'superadmin', 'staff')
    )
  );

-- ============================================================================
-- STEP 2: Replace sizes INSERT policy to include 'staff' role
-- ============================================================================
DROP POLICY IF EXISTS "sizes_insert" ON public.sizes;

CREATE POLICY "sizes_insert"
  ON public.sizes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    shop_id IN (
      SELECT shop_id FROM public.profiles
      WHERE id = (select auth.uid())
        AND role IN ('admin', 'owner', 'superadmin', 'staff')
    )
  );
