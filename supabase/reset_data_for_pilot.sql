-- ============================================================================
-- DATA RESET SCRIPT: Clear Transactional Data, Keep Configuration
-- ============================================================================
-- Purpose: Prepare database for client pilot run
-- Preserves: shops, profiles (admin user), categories, sizes,
--            expense_categories, qr_prefixes, tax_settings
-- Clears:    sales, sale_items, sale_returns, inventory_items,
--            inventory_adjustments, qr_codes, lots, financial_transactions,
--            attendance_logs, checklists, checklist_items,
--            checklist_instances, checklist_item_completions
--
-- IMPORTANT: Run this in Supabase Dashboard → SQL Editor
-- IMPORTANT: This is IRREVERSIBLE — take a backup first!
-- ============================================================================

-- ============================================================================
-- STEP 0: PRE-FLIGHT CHECK — Review what will be deleted
-- ============================================================================
-- Run this SELECT first to see counts before clearing

SELECT 'sales' AS table_name, COUNT(*) AS row_count FROM sales
UNION ALL SELECT 'sale_items', COUNT(*) FROM sale_items
UNION ALL SELECT 'sale_returns', COUNT(*) FROM sale_returns
UNION ALL SELECT 'financial_transactions', COUNT(*) FROM financial_transactions
UNION ALL SELECT 'inventory_items', COUNT(*) FROM inventory_items
UNION ALL SELECT 'inventory_adjustments', COUNT(*) FROM inventory_adjustments
UNION ALL SELECT 'lots', COUNT(*) FROM lots
UNION ALL SELECT 'qr_codes', COUNT(*) FROM qr_codes
UNION ALL SELECT 'attendance_logs', COUNT(*) FROM attendance_logs
UNION ALL SELECT 'checklist_item_completions', COUNT(*) FROM checklist_item_completions
UNION ALL SELECT 'checklist_instances', COUNT(*) FROM checklist_instances
UNION ALL SELECT 'checklist_items', COUNT(*) FROM checklist_items
UNION ALL SELECT 'checklists', COUNT(*) FROM checklists
UNION ALL SELECT '--- KEPT ---', 0
UNION ALL SELECT 'shops (KEPT)', COUNT(*) FROM shops
UNION ALL SELECT 'profiles (KEPT)', COUNT(*) FROM profiles
UNION ALL SELECT 'categories (KEPT)', COUNT(*) FROM categories
UNION ALL SELECT 'sizes (KEPT)', COUNT(*) FROM sizes
UNION ALL SELECT 'expense_categories (KEPT)', COUNT(*) FROM expense_categories
UNION ALL SELECT 'qr_prefixes (KEPT)', COUNT(*) FROM qr_prefixes
UNION ALL SELECT 'tax_settings (KEPT)', COUNT(*) FROM tax_settings
ORDER BY table_name;


-- ============================================================================
-- STEP 1: CLEAR TRANSACTIONAL DATA
-- ============================================================================
-- Order matters due to foreign key constraints.
-- We go from leaf tables → parent tables.

-- 1a. Break the circular FK: inventory_items.sale_item_id → sale_items
--     (Without this, we can't delete from either table)
UPDATE inventory_items SET sale_item_id = NULL WHERE sale_item_id IS NOT NULL;

-- 1b. Checklist completions (leaf - depends on checklist_items, instances, profiles)
DELETE FROM checklist_item_completions;

-- 1c. Checklist instances (depends on checklists, shops)
DELETE FROM checklist_instances;

-- 1d. Checklist items (depends on checklists)
DELETE FROM checklist_items;

-- 1e. Checklists (depends on shops, profiles)
DELETE FROM checklists;

-- 1f. Attendance logs (depends on shops, profiles)
DELETE FROM attendance_logs;

-- 1g. Financial transactions (depends on expense_categories, sales, shops, profiles)
DELETE FROM financial_transactions;

-- 1h. Sale returns (depends on sales, profiles, shops)
DELETE FROM sale_returns;

-- 1i. Sale items (depends on sales, inventory_items, shops)
DELETE FROM sale_items;

-- 1j. Inventory adjustments (depends on inventory_items, shops, profiles)
DELETE FROM inventory_adjustments;

-- 1k. Inventory items (depends on lots, qr_codes, shops)
DELETE FROM inventory_items;

-- 1l. QR codes (depends on shops, qr_prefixes)
DELETE FROM qr_codes;

-- 1m. Lots (depends on shops, categories, sizes, profiles)
DELETE FROM lots;

-- 1n. Sales (depends on shops, profiles)
DELETE FROM sales;


-- ============================================================================
-- STEP 2: RESET BILL NUMBER SEQUENCE
-- ============================================================================
-- The generate_bill_number() function uses MAX(bill_number) + 1,
-- so with no sales rows, the next bill will automatically start at 1.
-- Nothing to do here — it self-resets when the sales table is empty.


-- ============================================================================
-- STEP 3: POST-CLEAR VERIFICATION
-- ============================================================================
-- Run this to confirm everything is clean

SELECT 'sales' AS table_name, COUNT(*) AS row_count FROM sales
UNION ALL SELECT 'sale_items', COUNT(*) FROM sale_items
UNION ALL SELECT 'sale_returns', COUNT(*) FROM sale_returns
UNION ALL SELECT 'financial_transactions', COUNT(*) FROM financial_transactions
UNION ALL SELECT 'inventory_items', COUNT(*) FROM inventory_items
UNION ALL SELECT 'inventory_adjustments', COUNT(*) FROM inventory_adjustments
UNION ALL SELECT 'lots', COUNT(*) FROM lots
UNION ALL SELECT 'qr_codes', COUNT(*) FROM qr_codes
UNION ALL SELECT 'attendance_logs', COUNT(*) FROM attendance_logs
UNION ALL SELECT 'checklist_item_completions', COUNT(*) FROM checklist_item_completions
UNION ALL SELECT 'checklist_instances', COUNT(*) FROM checklist_instances
UNION ALL SELECT 'checklist_items', COUNT(*) FROM checklist_items
UNION ALL SELECT 'checklists', COUNT(*) FROM checklists
UNION ALL SELECT '--- KEPT ---', 0
UNION ALL SELECT 'shops (KEPT)', COUNT(*) FROM shops
UNION ALL SELECT 'profiles (KEPT)', COUNT(*) FROM profiles
UNION ALL SELECT 'categories (KEPT)', COUNT(*) FROM categories
UNION ALL SELECT 'sizes (KEPT)', COUNT(*) FROM sizes
UNION ALL SELECT 'expense_categories (KEPT)', COUNT(*) FROM expense_categories
UNION ALL SELECT 'qr_prefixes (KEPT)', COUNT(*) FROM qr_prefixes
UNION ALL SELECT 'tax_settings (KEPT)', COUNT(*) FROM tax_settings
ORDER BY table_name;

-- All transactional tables should show 0.
-- Config tables should retain their rows.


-- ============================================================================
-- STEP 4 (OPTIONAL): CLEAN UP TEST USERS
-- ============================================================================
-- If you created test staff/admin users and want to remove them,
-- keeping only the client's superadmin:
--
-- First check who exists:
-- SELECT id, full_name, role, is_active FROM profiles;
--
-- Then delete unwanted profiles (replace the UUID):
-- DELETE FROM profiles WHERE id = '<test-user-uuid>';
--
-- Also delete from Supabase Auth (Dashboard → Authentication → Users → delete)
-- The client's superadmin should remain.


-- ============================================================================
-- STEP 5 (OPTIONAL): UPDATE SHOP DETAILS FOR CLIENT
-- ============================================================================
-- If the shop was created with test data, update it:
--
-- UPDATE shops SET
--   shop_name = 'Womaniya Store',
--   address = '<actual address>',
--   phone = '<actual phone>',
--   bill_prefix = 'WS',
--   tax_rate = 5.00
-- WHERE id = '<shop-uuid>';
