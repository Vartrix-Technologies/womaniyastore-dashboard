-- Add RLS policy to allow staff to update their own profile
-- This enables users to update their own max_discount_percent and other fields

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

-- Create policy allowing users to update their own profile
CREATE POLICY "Users can update own profile"
ON profiles
FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Also ensure admins can update any profile in their shop
DROP POLICY IF EXISTS "Admins can update shop staff" ON profiles;

CREATE POLICY "Admins can update shop staff"
ON profiles
FOR UPDATE
USING (
  shop_id IN (
    SELECT shop_id 
    FROM profiles 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'owner', 'superadmin')
  )
)
WITH CHECK (
  shop_id IN (
    SELECT shop_id 
    FROM profiles 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'owner', 'superadmin')
  )
);
