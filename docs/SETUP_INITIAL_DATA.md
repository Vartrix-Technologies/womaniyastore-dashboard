# Quick Setup - Supabase Initial Data

**Run these queries in Supabase SQL Editor**

---

## 🔍 Step 1: Check What Exists (No Auth Required)

```sql
-- See all profiles (admin view, no auth filter)
SELECT 
  id,
  full_name,
  role,
  shop_id,
  is_active,
  max_discount_percent,
  created_at
FROM profiles
ORDER BY created_at DESC;
```

**Expected:** You should see 1 profile with role `superadmin`

---

## 🔍 Step 2: Check All Shops

```sql
SELECT 
  id,
  name,
  address,
  phone,
  created_at
FROM shops
ORDER BY created_at DESC;
```

**Expected:** You should see 1 shop

---

## 🔍 Step 3: Get Your Auth User ID

```sql
-- See all auth users
SELECT 
  id,
  email,
  created_at,
  email_confirmed_at,
  last_sign_in_at
FROM auth.users
ORDER BY created_at DESC;
```

**Copy your user ID from the results** (the UUID in the `id` column)
ff63360b-230f-429b-8213-9706e76d23db
---

## 🔧 Step 4: Link Profile to Shop

```sql
-- First, get the shop ID
SELECT id, name FROM shops LIMIT 1;
9455b247-9845-41a7-a345-a45b57939d10
-- Then, update your profile (replace the UUIDs with actual values)
UPDATE profiles
SET shop_id = 'PASTE_SHOP_ID_HERE'
WHERE id = 'PASTE_YOUR_USER_ID_HERE';

-- Verify it worked
SELECT 
  p.id,
  p.full_name,
  p.role,
  p.shop_id,
  s.name as shop_name
FROM profiles p
LEFT JOIN shops s ON p.shop_id = s.id
WHERE p.id = 'PASTE_YOUR_USER_ID_HERE';
```

---

## 📊 Step 5: Check Summary

```sql
-- Overview of your data
SELECT 
  'Shops' as table_name,
  COUNT(*)::text as count
FROM shops
UNION ALL
SELECT 'Profiles', COUNT(*)::text FROM profiles
UNION ALL
SELECT 'Categories', COUNT(*)::text FROM categories
UNION ALL
SELECT 'Sizes', COUNT(*)::text FROM sizes
UNION ALL
SELECT 'QR Codes', COUNT(*)::text FROM qr_codes
UNION ALL
SELECT 'Lots', COUNT(*)::text FROM lots
UNION ALL
SELECT 'Inventory Items', COUNT(*)::text FROM inventory_items
UNION ALL
SELECT 'Sales', COUNT(*)::text FROM sales;
```

---

## 🎯 Step 6: Add Categories (If Needed)

```sql
-- Check if categories exist
SELECT * FROM categories;

-- If empty, add categories (replace SHOP_ID)
INSERT INTO categories (shop_id, name, description)
VALUES 
  ('YOUR_SHOP_ID', 'Saree', 'Traditional and designer sarees'),
  ('YOUR_SHOP_ID', 'Kurti', 'Kurtis and kurta sets'),
  ('YOUR_SHOP_ID', 'Dupatta', 'Dupattas and scarves'),
  ('YOUR_SHOP_ID', 'Lehenga', 'Lehengas and sets'),
  ('YOUR_SHOP_ID', 'Dress Material', 'Unstitched dress materials'),
  ('YOUR_SHOP_ID', 'Salwar Suit', 'Ready-made salwar suits'),
  ('YOUR_SHOP_ID', 'Palazzo', 'Palazzos and pants'),
  ('YOUR_SHOP_ID', 'Accessories', 'Jewelry and accessories')
RETURNING id, name;
```

---

## 🎯 Step 7: Add Sizes (If Needed)

```sql
-- Check if sizes exist
SELECT * FROM sizes ORDER BY sort_order;

-- If empty, add sizes (replace SHOP_ID)
INSERT INTO sizes (shop_id, name, sort_order)
VALUES 
  ('YOUR_SHOP_ID', 'S', 1),
  ('YOUR_SHOP_ID', 'M', 2),
  ('YOUR_SHOP_ID', 'L', 3),
  ('YOUR_SHOP_ID', 'XL', 4),
  ('YOUR_SHOP_ID', 'XXL', 5),
  ('YOUR_SHOP_ID', 'Free Size', 10)
RETURNING id, name;
```

---

## 🎯 Step 8: Generate QR Codes (If Needed)

```sql
-- Check QR codes
SELECT status, COUNT(*) 
FROM qr_codes 
GROUP BY status;

-- If you need QR codes, generate them (replace SHOP_ID)
-- This creates 500 QR codes: WOM-00001 to WOM-00500
INSERT INTO qr_codes (shop_id, code, status)
SELECT 
  'YOUR_SHOP_ID',
  'WOM-' || LPAD(generate_series::text, 5, '0'),
  'unused'
FROM generate_series(1, 500);

-- Verify
SELECT status, COUNT(*) 
FROM qr_codes 
GROUP BY status;
```

---

## ✅ Verification Query

```sql
-- Run this to see everything is ready
SELECT 
  'Shop' as item,
  (SELECT name FROM shops LIMIT 1) as value
UNION ALL
SELECT 
  'Your Email',
  (SELECT email FROM auth.users ORDER BY created_at DESC LIMIT 1)
UNION ALL
SELECT 
  'Your Role',
  (SELECT role::text FROM profiles ORDER BY created_at DESC LIMIT 1)
UNION ALL
SELECT 
  'Profile Linked to Shop',
  CASE 
    WHEN (SELECT shop_id FROM profiles LIMIT 1) IS NOT NULL 
    THEN 'YES ✅' 
    ELSE 'NO ❌ - Run Step 4!' 
  END
UNION ALL
SELECT 
  'Categories',
  (SELECT COUNT(*)::text FROM categories)
UNION ALL
SELECT 
  'Sizes',
  (SELECT COUNT(*)::text FROM sizes)
UNION ALL
SELECT 
  'QR Codes',
  (SELECT COUNT(*)::text FROM qr_codes WHERE status = 'unused');
```

---

## 🚨 Important Notes

### Why `auth.uid()` Returns NULL in SQL Editor

When you run queries in **Supabase SQL Editor**, you're executing them as a **database administrator**, not as an authenticated app user. This means:

- `auth.uid()` = `NULL` (no user context)
- RLS policies may not apply the same way
- You can see all data regardless of RLS

### Why This Matters

In your **app** (when users login):
- `auth.uid()` = their actual user ID
- RLS policies filter data automatically
- Each user sees only their data

### How to Test RLS

To test RLS policies as a user would see them:
1. Use the app (login as that user)
2. Or use Supabase API with auth token
3. SQL Editor is for admin operations only

---

## 📝 Action Checklist

Run these in order:

- [ ] Step 1: Check profiles (note your user ID)
- [ ] Step 2: Check shops (note shop ID)
- [ ] Step 3: Get auth user ID
- [ ] Step 4: Link your profile to shop
- [ ] Step 5: Check summary
- [ ] Step 6: Add categories (if needed)
- [ ] Step 7: Add sizes (if needed)
- [ ] Step 8: Generate QR codes (if needed)
- [ ] Run verification query

---

**Once done, try logging into your app again!** Everything should work smoothly.
