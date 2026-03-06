-- Create test user profiles
-- Run this in Supabase SQL Editor after creating auth users

-- First, let's see what users exist in auth.users
-- SELECT id, email FROM auth.users WHERE email LIKE '%@test.com';

-- Get your shop_id (replace with actual shop_id from shops table)
-- SELECT id, name FROM shops;

-- Create profiles for test users
-- Replace 'YOUR_SHOP_ID_HERE' with the actual shop_id from the shops table

-- For admin@test.com
INSERT INTO profiles (id, full_name, role, shop_id, is_active, max_discount_percent, phone)
SELECT 
  id,
  'Test Admin',
  'admin',
  (SELECT id FROM shops LIMIT 1), -- Gets the first shop, or replace with specific shop_id
  true,
  50.0,
  NULL
FROM auth.users
WHERE email = 'admin@test.com'
ON CONFLICT (id) DO UPDATE SET
  full_name = 'Test Admin',
  role = 'admin',
  shop_id = (SELECT id FROM shops LIMIT 1),
  is_active = true,
  max_discount_percent = 50.0;

-- For owner@test.com
INSERT INTO profiles (id, full_name, role, shop_id, is_active, max_discount_percent, phone)
SELECT 
  id,
  'Test Owner',
  'owner',
  (SELECT id FROM shops LIMIT 1),
  true,
  100.0,
  NULL
FROM auth.users
WHERE email = 'owner@test.com'
ON CONFLICT (id) DO UPDATE SET
  full_name = 'Test Owner',
  role = 'owner',
  shop_id = (SELECT id FROM shops LIMIT 1),
  is_active = true,
  max_discount_percent = 100.0;

-- For staff@test.com
INSERT INTO profiles (id, full_name, role, shop_id, is_active, max_discount_percent, phone)
SELECT 
  id,
  'Test Staff',
  'staff',
  (SELECT id FROM shops LIMIT 1),
  true,
  0.0,
  NULL
FROM auth.users
WHERE email = 'staff@test.com'
ON CONFLICT (id) DO UPDATE SET
  full_name = 'Test Staff',
  role = 'staff',
  shop_id = (SELECT id FROM shops LIMIT 1),
  is_active = true,
  max_discount_percent = 0.0;

-- Verify the profiles were created
SELECT 
  p.id,
  au.email,
  p.full_name,
  p.role,
  p.shop_id,
  p.is_active
FROM profiles p
JOIN auth.users au ON au.id = p.id
WHERE au.email LIKE '%@test.com';
