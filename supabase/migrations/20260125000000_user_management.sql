-- Migration: User Management - Password Change on First Login
-- Date: 2025-01-25
-- Description: Adds columns for superadmin-only user creation with mandatory password change

-- Add columns to profiles table for user management
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);

-- Comment on columns for documentation
COMMENT ON COLUMN public.profiles.must_change_password IS 'Flag indicating user must change password on next login. Set to true when superadmin creates user with temp password.';
COMMENT ON COLUMN public.profiles.password_changed_at IS 'Timestamp of when user last changed their password.';
COMMENT ON COLUMN public.profiles.created_by IS 'UUID of the superadmin who created this user account.';

-- Index for efficient lookup of users needing password change
CREATE INDEX IF NOT EXISTS idx_profiles_must_change_password 
ON public.profiles(must_change_password) 
WHERE must_change_password = true;

-- RLS policy: Allow users to update their own must_change_password flag (to clear it after changing password)
CREATE POLICY "Users can clear their own must_change_password flag"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id 
  AND (
    -- Allow clearing the flag (setting to false)
    must_change_password = false 
    OR 
    -- Or allow other profile updates (existing behavior)
    must_change_password IS NOT DISTINCT FROM (SELECT must_change_password FROM public.profiles WHERE id = auth.uid())
  )
);

-- RLS policy: Superadmin can set must_change_password for any user
-- Note: This uses service role in edge function, but we add this for completeness
CREATE POLICY "Superadmin can manage user password flags"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'superadmin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'superadmin'
  )
);

-- Function to mark password as changed (can be called after password update)
CREATE OR REPLACE FUNCTION public.mark_password_changed()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.profiles
  SET 
    must_change_password = false,
    password_changed_at = NOW()
  WHERE id = auth.uid();
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.mark_password_changed() TO authenticated;
