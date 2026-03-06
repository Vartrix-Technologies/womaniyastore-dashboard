-- Extract Complete Supabase Schema
-- Run this in Supabase SQL Editor to get your full schema details

-- ==========================================
-- 1. GET ALL TABLES
-- ==========================================
SELECT 
  table_name,
  table_type
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;


-- ==========================================
-- 2. GET ALL COLUMNS FOR EACH TABLE
-- ==========================================
SELECT 
  table_name,
  column_name,
  data_type,
  udt_name,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
ORDER BY table_name, ordinal_position;


-- ==========================================
-- 3. GET ALL ENUMS (USER-DEFINED TYPES)
-- ==========================================
SELECT 
  t.typname as enum_name,
  e.enumlabel as enum_value,
  e.enumsortorder as sort_order
FROM pg_type t 
JOIN pg_enum e ON t.oid = e.enumtypid  
WHERE t.typnamespace = (
  SELECT oid FROM pg_namespace WHERE nspname = 'public'
)
ORDER BY t.typname, e.enumsortorder;


-- ==========================================
-- 4. GET FOREIGN KEY RELATIONSHIPS
-- ==========================================
SELECT
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' 
  AND tc.table_schema = 'public'
ORDER BY tc.table_name;


-- ==========================================
-- 5. GET ALL RLS POLICIES
-- ==========================================
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd as operation,
  qual as using_expression,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;


-- ==========================================
-- 6. CHECK RLS STATUS ON ALL TABLES
-- ==========================================
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;


-- ==========================================
-- 7. GET ALL FUNCTIONS
-- ==========================================
SELECT 
  routine_name,
  routine_type,
  data_type as return_type
FROM information_schema.routines
WHERE routine_schema = 'public'
ORDER BY routine_name;


-- ==========================================
-- 8. GET PROFILES TABLE DETAILS (Specific)
-- ==========================================
SELECT 
  column_name,
  data_type,
  udt_name,
  is_nullable,
  column_default,
  character_maximum_length
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'profiles'
ORDER BY ordinal_position;


-- ==========================================
-- 9. GET YOUR CURRENT PROFILE DATA
-- ==========================================
SELECT 
  id,
  full_name,
  phone,
  role,
  shop_id,
  is_active,
  max_discount_percent,
  created_at
FROM profiles
WHERE id = auth.uid();


-- ==========================================
-- 10. GET ALL PROFILES (FOR ADMIN)
-- ==========================================
SELECT 
  p.id,
  p.full_name,
  p.role,
  p.shop_id,
  s.name as shop_name,
  p.is_active,
  p.max_discount_percent,
  p.created_at,
  u.email
FROM profiles p
LEFT JOIN shops s ON p.shop_id = s.id
LEFT JOIN auth.users u ON p.id = u.id
ORDER BY p.created_at DESC;


-- ==========================================
-- EXPORT COMPLETE SCHEMA AS CREATE STATEMENTS
-- ==========================================
-- To get the full schema with CREATE TABLE statements,
-- you can also use pg_dump or export from Supabase Studio:
-- 1. Go to Database → Backups
-- 2. Create a backup
-- 3. Download the SQL file

-- Or use this query to generate CREATE TABLE statements:
SELECT 
  'CREATE TABLE ' || table_name || ' (' || 
  string_agg(
    column_name || ' ' || 
    CASE 
      WHEN data_type = 'USER-DEFINED' THEN udt_name
      WHEN data_type = 'character varying' THEN 'varchar(' || character_maximum_length || ')'
      ELSE data_type 
    END ||
    CASE WHEN is_nullable = 'NO' THEN ' NOT NULL' ELSE '' END ||
    CASE WHEN column_default IS NOT NULL THEN ' DEFAULT ' || column_default ELSE '' END,
    ', '
  ) || ');' as create_statement
FROM information_schema.columns
WHERE table_schema = 'public'
GROUP BY table_name
ORDER BY table_name;
