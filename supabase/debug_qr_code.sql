-- Debug QR Code wa-0006
-- Run this in Supabase SQL Editor to check the actual data

-- 1a. Check EXACT match (case-sensitive)
SELECT 
    id,
    code,
    status,
    shop_id,
    created_at,
    length(code) as code_length
FROM qr_codes 
WHERE code = 'wa-0006';

-- 1b. Check case-insensitive match
SELECT 
    id,
    code,
    status,
    shop_id,
    created_at
FROM qr_codes 
WHERE LOWER(code) = LOWER('wa-0006');

-- 1c. Check for any codes containing '0006'
SELECT 
    id,
    code,
    status,
    shop_id,
    created_at
FROM qr_codes 
WHERE code LIKE '%0006%';

-- 1d. Show first 20 QR codes to see what format they're in
SELECT 
    id,
    code,
    status,
    shop_id,
    created_at
FROM qr_codes 
ORDER BY created_at DESC
LIMIT 20;

-- 2. Check the inventory item linked to this QR code (case-insensitive)
SELECT 
    i.id,
    i.status as inventory_status,
    i.shop_id as inventory_shop_id,
    i.qr_code_id,
    q.code as qr_code,
    q.status as qr_status,
    q.shop_id as qr_shop_id
FROM inventory_items i
LEFT JOIN qr_codes q ON i.qr_code_id = q.id
WHERE LOWER(q.code) = LOWER('wa-0006');

-- 3. Check if shop_id matches your expected shop (case-insensitive)
SELECT 
    q.code,
    q.shop_id as qr_shop_id,
    s.shop_name,
    CASE 
        WHEN q.shop_id = '9455b247-9845-41a7-a345-a45b57939d10' THEN 'MATCHES'
        ELSE 'MISMATCH'
    END as shop_match
FROM qr_codes q
LEFT JOIN shops s ON q.shop_id = s.id
WHERE LOWER(q.code) = LOWER('wa-0006');

-- 4. Check your user profile's shop_id
SELECT 
    id,
    email,
    role,
    shop_id
FROM profiles
LIMIT 5;

-- Expected Results:
-- If QR code exists but shop_id doesn't match '9455b247-9845-41a7-a345-a45b57939d10',
-- then that's the issue - the QR code belongs to a different shop.
--
-- If shop_id matches but query #2 returns nothing, then there's no inventory_item
-- linked to this QR code.
