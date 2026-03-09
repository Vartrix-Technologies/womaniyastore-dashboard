-- ============================================================================
-- Add missing UPDATE RLS policy for shops table
-- ============================================================================
-- Bug: Shop details and tax rate changes were silently blocked by RLS
-- because only a SELECT policy existed. Updates returned 0 rows affected
-- with no error, then onRefresh() re-fetched the old data.
-- ============================================================================

-- Allow admins (admin/owner/superadmin) to update their own shop
CREATE POLICY "shops_update" ON public.shops
  FOR UPDATE TO authenticated
  USING (id = (SELECT current_shop_id()) AND (SELECT is_admin()));
