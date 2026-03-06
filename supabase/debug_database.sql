-- Womaniya Dashboard - Database Verification & Fix Script
-- Run this in Supabase SQL Editor to check and fix common issues

-- ==========================================
-- 1. CHECK IF PROFILES TABLE EXISTS
-- ==========================================
SELECT 
  table_name,
  table_type
FROM information_schema.tables
WHERE table_schema = 'public' 
  AND table_name = 'profiles';
-- Expected: Should return 1 row


-- ==========================================
-- 2. CHECK PROFILES TABLE STRUCTURE
-- ==========================================
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'profiles'
ORDER BY ordinal_position;
-- Expected: id, shop_id, role, email, full_name, etc.


-- ==========================================
-- 3. CHECK AUTH USERS
-- ==========================================
SELECT 
  id,
  email,
  created_at,
  email_confirmed_at
FROM auth.users
ORDER BY created_at DESC
LIMIT 5;
-- Expected: Should see your user account


-- ==========================================
-- 4. CHECK IF PROFILES EXIST FOR USERS
-- ==========================================
SELECT 
  u.id as user_id,
  u.email,
  p.id as profile_id,
  p.role,
  p.shop_id,
  CASE 
    WHEN p.id IS NULL THEN '❌ MISSING PROFILE'
    ELSE '✅ Has Profile'
  END as status
FROM auth.users u
LEFT JOIN public.profiles p ON u.id = p.id
ORDER BY u.created_at DESC
LIMIT 10;
-- Expected: All users should have profiles
-- If status shows "❌ MISSING PROFILE", that's the problem!


-- ==========================================
-- 5. CHECK RLS POLICIES ON PROFILES
-- ==========================================
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'profiles';
-- Expected: Should see at least one SELECT policy


-- ==========================================
-- 6. CHECK IF RLS IS ENABLED
-- ==========================================
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE tablename = 'profiles';
-- Expected: rowsecurity should be TRUE


-- ==========================================
-- 7. FIX: CREATE MISSING PROFILE (If needed)
-- ==========================================
-- IMPORTANT: Replace these values with YOUR actual data!
-- Get your user_id from query #3 above

/*
-- Uncomment and modify this if you need to create a profile:

INSERT INTO public.profiles (id, shop_id, role, email, full_name, max_discount_percent)
VALUES (
  'YOUR_USER_ID_FROM_AUTH_USERS',  -- Replace with actual user ID
  'YOUR_SHOP_ID',                   -- Replace with actual shop ID (or create shop first)
  'admin',                          -- or 'owner', 'staff', 'superadmin'
  'your@email.com',                 -- Your email
  'Your Full Name',                 -- Your name
  100                               -- Max discount % allowed
);
*/


-- ==========================================
-- 8. FIX: CREATE SHOP (If needed)
-- ==========================================
-- Run this first if you don't have a shop

/*
INSERT INTO public.shops (name, address, phone)
VALUES (
  'Womaniya Airoli',
  'Your Shop Address',
  'Your Phone Number'
)
RETURNING id;
-- Copy the returned ID and use it in the profile insert above
*/


-- ==========================================
-- 9. FIX: ADD RLS POLICY (If missing)
-- ==========================================
-- Run this if query #5 showed no policies

/*
-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Allow users to read their own profile
CREATE POLICY "Users can view own profile"
ON public.profiles
FOR SELECT
USING (auth.uid() = id);

-- Allow users to update their own profile
CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
USING (auth.uid() = id);
*/


-- ==========================================
-- 10. VERIFY EVERYTHING WORKS
-- ==========================================
-- This query simulates what the app does during login
-- It should return YOUR profile data

SELECT 
  p.*,
  s.name as shop_name
FROM public.profiles p
LEFT JOIN public.shops s ON p.shop_id = s.id
WHERE p.id = auth.uid();
-- Expected: Should return 1 row with your profile
-- If this returns nothing, RLS is blocking it!


-- ==========================================
-- 11. EMERGENCY: DISABLE RLS TEMPORARILY
-- ==========================================
-- ONLY use this for debugging! Re-enable after fixing!

/*
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
-- Now try logging in. If it works, the issue is RLS policies.
-- Don't forget to re-enable:
-- ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
*/


-- ==========================================
-- 12. CHECK HELPER FUNCTIONS EXIST
-- ==========================================
SELECT 
  routine_name,
  routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN (
    'current_profile',
    'current_shop_id',
    'current_role',
    'is_admin',
    'is_superadmin'
  );
-- Expected: Should return 5 rows (one for each function)


-- ==========================================
-- TROUBLESHOOTING SUMMARY
-- ==========================================
/*

COMMON ISSUES & FIXES:

1. "User has no profile"
   → Run query #7 to create profile
   → Make sure to create shop first (query #8)

2. "RLS blocks profile fetch"
   → Check if policies exist (query #5)
   → If no policies, run query #9
   → Test with query #10

3. "Profile exists but login still fails"
   → Check browser console for errors
   → Clear localStorage and try again
   → Check that profile.shop_id is valid
   → Verify helper functions exist (query #12)

4. "Can't create profile - foreign key error"
   → Shop doesn't exist
   → Run query #8 to create shop first
   → Then run query #7

5. "Everything looks good in DB but login fails"
   → Issue is in the frontend code
   → Check browser console
   → Add debug logging to AuthContext
   → Check network tab for failed requests

*/
