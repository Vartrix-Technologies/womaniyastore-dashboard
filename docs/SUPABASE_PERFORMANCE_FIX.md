# Supabase Performance Fix — Verification Guide

## Overview

Two migrations were created to fix all Supabase Performance Advisor warnings:

1. **`20260301_fix_rls_performance.sql`** — Fixes RLS policy performance
2. **`20260302_optimize_indexes.sql`** — Optimizes database indexes

---

## Pre-Migration Checklist

### 1. Verify Dashboard-Created Policies (IMPORTANT)

Before applying, run this query in the Supabase SQL Editor to document any
dashboard-created policies that will be dropped:

```sql
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'profiles', 'expense_categories', 'financial_transactions',
    'qr_codes', 'checklists', 'checklist_items', 'checklist_instances',
    'checklist_item_completions', 'attendance_logs', 'sale_returns',
    'inventory_items', 'lots', 'qr_prefixes', 'sales',
    'staff_checklist_assignments', 'staff_checklist_item_status'
  )
ORDER BY tablename, cmd, policyname;
```

**Save this output!** It serves as a backup of all current policies. If the
migration needs to be rolled back, you can recreate the original policies.

### 2. Count Current Policies

```sql
SELECT tablename, count(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'profiles', 'expense_categories', 'financial_transactions',
    'qr_codes', 'checklists', 'checklist_items', 'checklist_instances',
    'checklist_item_completions', 'attendance_logs', 'sale_returns',
    'inventory_items', 'lots', 'qr_prefixes', 'sales',
    'staff_checklist_assignments', 'staff_checklist_item_status'
  )
GROUP BY tablename
ORDER BY tablename;
```

### 3. Count Current Indexes

```sql
SELECT tablename, count(*) as index_count
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN (
    'attendance_logs', 'lots', 'profiles', 'inventory_items',
    'sale_items', 'sales', 'financial_transactions', 'sale_returns',
    'checklists', 'checklist_item_completions', 'qr_codes',
    'expense_categories', 'inventory_adjustments'
  )
GROUP BY tablename
ORDER BY tablename;
```

---

## Applying the Migrations

### Option A: Via Supabase CLI

```bash
supabase db push
```

### Option B: Via SQL Editor (Recommended for first time)

1. Copy the contents of `20260301_fix_rls_performance.sql`
2. Paste into the Supabase SQL Editor
3. Review and execute
4. If successful, copy and execute `20260302_optimize_indexes.sql`

**Apply them in order.** Migration 1 must complete before Migration 2.

---

## Post-Migration Verification

### 1. Verify `auth.uid()` Wrapping (auth_rls_initplan fix)

```sql
-- Should return 0 rows after the fix
-- This checks for bare auth.uid() in policy expressions
SELECT tablename, policyname, qual, with_check
FROM pg_policies 
WHERE schemaname = 'public'
  AND (
    qual LIKE '%auth.uid()%' 
    OR with_check LIKE '%auth.uid()%'
  )
  AND NOT (
    qual LIKE '%(select auth.uid())%' 
    OR qual IS NULL
  )
ORDER BY tablename;
```

### 2. Verify No Duplicate Policies (multiple_permissive_policies fix)

```sql
-- Should return 0 rows (no duplicate cmd+role combos per table)
SELECT tablename, cmd, roles, count(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public'
  AND permissive = 'PERMISSIVE'
GROUP BY tablename, cmd, roles
HAVING count(*) > 1
ORDER BY tablename;
```

**Note:** The `profiles` table will still show multiple SELECT and UPDATE
policies — this is intentional because they serve different user roles
(user/admin/superadmin). The Supabase linter may still flag these.

### 3. Verify Expected Policy Count

```sql
-- Expected counts after migration:
-- profiles: 6 (3 SELECT + 3 UPDATE)
-- expense_categories, financial_transactions, qr_codes,
--   sale_returns, inventory_items, lots, sales: 4 each (CRUD)
-- checklists: 4 (SELECT + admin INSERT/UPDATE/DELETE)
-- checklist_items: 4 (SELECT + admin INSERT/UPDATE/DELETE)
-- checklist_instances: 3 (SELECT + INSERT + UPDATE, no DELETE)
-- checklist_item_completions: 3 (SELECT + INSERT + UPDATE)
-- attendance_logs: 3 (SELECT + INSERT + UPDATE)
-- qr_prefixes: 4 (SELECT + admin INSERT/UPDATE/DELETE)
-- staff_checklist_assignments: 4 (SELECT + admin INSERT/UPDATE/DELETE)
-- staff_checklist_item_status: 3 (SELECT + UPDATE + INSERT)

SELECT tablename, count(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;
```

### 4. Verify New Indexes Exist

```sql
SELECT tablename, indexname
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;
```

### 5. Verify Removed Indexes Are Gone

```sql
-- All of these should return 0 rows
SELECT indexname FROM pg_indexes 
WHERE indexname IN (
  'idx_attendance_logs_is_manual',
  'idx_attendance_logs_deleted_at',
  'idx_attendance_logs_edited_at',
  'attendance_shop_staff_date_idx',
  'idx_profiles_must_change_password',
  'financial_tx_occurred_idx',
  'idx_checklist_instances_checklist',
  'idx_checklist_instances_status',
  'idx_item_completions_completed_by',
  'idx_sale_items_sold_on_sale',
  'idx_lots_vendor_name'
);
```

---

## Regression Testing

### Critical Flows to Test

After applying the migrations, test these flows in the app:

#### 1. Authentication & Profiles
- [ ] Login as **staff** user → should see own profile data
- [ ] Login as **admin/owner** → should see all shop staff profiles
- [ ] Login as **superadmin** → should see all profiles across shops
- [ ] Update own profile (e.g., max discount) → should save
- [ ] Admin update staff profile → should save
- [ ] Change password flow → `must_change_password` flag should clear

#### 2. Attendance
- [ ] Staff clock in/out → should create attendance record
- [ ] Admin create manual attendance entry → should save
- [ ] Admin edit attendance record → should save
- [ ] View attendance list → should show shop records only

#### 3. Sales & Returns
- [ ] Create a new sale → should save
- [ ] View sales list → should show shop sales only
- [ ] Process a return → should save
- [ ] View sale items → should load correctly

#### 4. Inventory & Lots
- [ ] View inventory items → should show shop items
- [ ] Create a new lot → should save
- [ ] Update a lot → should save
- [ ] View lot details → should load

#### 5. Financial Transactions
- [ ] Create an expense → should save
- [ ] View transactions list → should show shop transactions
- [ ] Create/edit expense categories → should work

#### 6. QR Codes & Prefixes
- [ ] View QR codes → should show shop QR codes
- [ ] Generate new QR codes → should save
- [ ] Admin manage QR prefixes → should work (create/edit/delete)

#### 7. Checklists
- [ ] View checklists → should show shop checklists
- [ ] Admin create checklist → should save
- [ ] Staff complete checklist items → should save
- [ ] View checklist progress → should load

---

## Rollback Plan

If issues are discovered, you can rollback by running the pre-migration policy
backup (from Step 1 of Pre-Migration Checklist) to recreate the original policies.

For a quick rollback of the RLS changes:

```sql
-- 1. Drop all policies created by the migration
DO $$
DECLARE
  pol RECORD;
  tables TEXT[] := ARRAY[
    'profiles', 'expense_categories', 'financial_transactions',
    'qr_codes', 'checklists', 'checklist_items', 'checklist_instances',
    'checklist_item_completions', 'attendance_logs', 'sale_returns',
    'inventory_items', 'lots', 'qr_prefixes', 'sales',
    'staff_checklist_assignments', 'staff_checklist_item_status'
  ];
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY tables
  LOOP
    FOR pol IN
      SELECT policyname FROM pg_policies
      WHERE tablename = tbl AND schemaname = 'public'
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, tbl);
    END LOOP;
  END LOOP;
END $$;

-- 2. Then re-run the original migration files in order:
--    20241222_expense_categories.sql (policies section)
--    20241222_financial_transactions_rls.sql (policies section)
--    20241222_qr_codes_rls.sql
--    20241231_checklists_rls.sql
--    20241231_checklist_shared_pool.sql (policies section)
--    20250101_attendance_crud_audit.sql (policies section)
--    20260101_profiles_update_policy.sql
--    20260110_create_qr_prefixes.sql (policies section)
--    20260125_user_management.sql (policies section)
--    20260205_inventory_items_rls.sql
--    20260205_sale_returns_rls.sql
--    20260208_fix_user_profiles_security_definer.sql (policies + functions)
--    20260219_lots_rls.sql
```

For index rollback, recreate dropped indexes:

```sql
CREATE INDEX IF NOT EXISTS idx_attendance_logs_is_manual ON attendance_logs(is_manual_entry);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_deleted_at ON attendance_logs(deleted_at);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_edited_at ON attendance_logs(edited_at);
CREATE INDEX IF NOT EXISTS attendance_shop_staff_date_idx ON attendance_logs(shop_id, staff_id, date);
CREATE INDEX IF NOT EXISTS idx_profiles_must_change_password ON profiles(must_change_password) WHERE must_change_password = true;
CREATE INDEX IF NOT EXISTS idx_checklist_instances_checklist ON checklist_instances(checklist_id);
CREATE INDEX IF NOT EXISTS idx_checklist_instances_status ON checklist_instances(status);
CREATE INDEX IF NOT EXISTS idx_item_completions_completed_by ON checklist_item_completions(completed_by);
CREATE INDEX IF NOT EXISTS idx_sale_items_sold_on_sale ON sale_items(sold_on_sale);
CREATE INDEX IF NOT EXISTS idx_lots_vendor_name ON lots(vendor_name);
```

---

## What Was Changed

### Summary of Changes

| Category | Before | After |
|---|---|---|
| `auth.uid()` in policies | ~45 bare calls | All wrapped as `(select auth.uid())` |
| Duplicate policies | ~12 dashboard duplicates | All removed |
| Redundant policies | 2 (`attendance_delete`, `must_change_password`) | Removed |
| Missing indexes | ~25 unindexed FKs + advisor suggestions | All added |
| Unused indexes | 11 unused indexes | Removed |
| `sales` table policies | Dashboard-only (untracked) | Proper migration-tracked policies |

### Policies Removed (Intentional)

1. **`"Users can clear their own must_change_password flag"`** on `profiles`
   - Redundant: "Users can update own profile" already allows users to update
     any field in their own row. Since both were PERMISSIVE, the restrictive
     WITH CHECK had no effect.

2. **`attendance_delete`** on `attendance_logs` (FOR UPDATE, despite name)
   - Redundant: `attendance_update` already covers admin access to update any
     attendance record in the shop. `attendance_delete` was a strict subset.

3. **All `*_select` dashboard policies** (e.g., `checklist_items_select`,
   `checklists_select`, `financial_tx_select`, etc.)
   - These were duplicates of the migration-defined SELECT policies.

4. **`profiles_select`**, **`profiles_update`**, **`attendance_select`**,
   **`attendance_insert`**, **`sales_insert`** (dashboard-created)
   - Replaced by properly tracked migration policies.
