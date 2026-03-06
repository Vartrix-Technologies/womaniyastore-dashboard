-- Create or update a superadmin user
-- Run this in Supabase SQL Editor

-- Option 1: Upgrade existing test user to superadmin
UPDATE profiles
SET role = 'superadmin',
    full_name = 'System Administrator'
WHERE id = (
  SELECT id FROM auth.users WHERE email = 'admin@test.com'
);

-- Verify the change
SELECT 
  au.email,
  p.full_name,
  p.role,
  p.shop_id
FROM profiles p
JOIN auth.users au ON au.id = p.id
WHERE au.email = 'admin@test.com';

-- Option 2: Create a new superadmin profile if you created a new auth user
-- First create the auth user via Supabase Dashboard → Authentication → Add User
-- Then run this (replace the email):

-- INSERT INTO profiles (id, full_name, role, is_active)
-- SELECT 
--   id,
--   'System Administrator',
--   'superadmin',
--   true
-- FROM auth.users
-- WHERE email = 'your-superadmin-email@example.com'
-- ON CONFLICT (id) DO UPDATE SET
--   role = 'superadmin',
--   full_name = 'System Administrator';

-- Note: Superadmin doesn't need a shop_id
-- They can access all shops (future multi-shop feature)
