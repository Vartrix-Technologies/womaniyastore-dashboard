-- =============================================================================
-- Fix SECURITY DEFINER Function Permissions
-- Resolves Supabase Security Advisor warnings:
--   - "Public Can Execute SECURITY DEFINER Function"
--   - "Signed-In Users Can Execute SECURITY DEFINER Function" (where unintentional)
-- =============================================================================

-- =============================================================================
-- GROUP 1: REVOKE from ALL roles (public, anon, authenticated)
--
-- These functions are only called by:
--   - pg_cron (runs as postgres superuser — bypasses EXECUTE checks entirely)
--   - PostgreSQL trigger machinery (user performing DELETE doesn't need EXECUTE)
--   - One-time admin utilities (run directly in SQL editor as postgres/service_role)
--
-- No end-user or frontend should ever invoke these via /rest/v1/rpc/
-- =============================================================================

-- run_nightly_tasks() — called only by pg_cron schedule
REVOKE EXECUTE ON FUNCTION public.run_nightly_tasks() FROM PUBLIC, anon, authenticated;

-- auto_close_stale_attendance() — called internally by run_nightly_tasks()
REVOKE EXECUTE ON FUNCTION public.auto_close_stale_attendance() FROM PUBLIC, anon, authenticated;

-- invoke_auto_close_attendance() — called internally by run_nightly_tasks() via pg_net
REVOKE EXECUTE ON FUNCTION public.invoke_auto_close_attendance() FROM PUBLIC, anon, authenticated;

-- invoke_create_daily_checklists() — called internally by run_nightly_tasks() via pg_net
REVOKE EXECUTE ON FUNCTION public.invoke_create_daily_checklists() FROM PUBLIC, anon, authenticated;

-- reset_qr_code_on_item_delete() — trigger function, called by PostgreSQL trigger machinery
REVOKE EXECUTE ON FUNCTION public.reset_qr_code_on_item_delete() FROM PUBLIC, anon, authenticated;

-- migrate_legacy_qr_codes_to_default_prefix() — one-time migration utility
-- Revoke the previously granted authenticated access; run directly as postgres when needed
REVOKE EXECUTE ON FUNCTION public.migrate_legacy_qr_codes_to_default_prefix(uuid) FROM PUBLIC, anon, authenticated;

-- generate_bill_number() — only called by complete-sale edge function (service_role)
-- No frontend .rpc() call exists; revoke authenticated, keep service_role implicit access
REVOKE EXECUTE ON FUNCTION public.generate_bill_number(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.generate_bill_number(uuid) TO service_role;


-- =============================================================================
-- GROUP 2: REVOKE from anon/public, KEEP authenticated
--
-- These functions must remain callable by authenticated (logged-in) users because:
--   a) RLS helper functions — PostgreSQL evaluates these in the session of the
--      authenticated user when checking row-level security policies
--   b) Self-service functions called via .rpc() from the frontend
--   c) Admin UI functions explicitly intended for logged-in admin users
-- =============================================================================

-- --- RLS Helper functions (a) ---
-- These are called by RLS policies in the authenticated user's session context.
-- Revoking from authenticated would break all RLS policies that use them.

REVOKE EXECUTE ON FUNCTION public.current_profile() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_profile() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.current_role() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_role() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.current_shop_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_shop_id() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.is_staff_or_higher() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_staff_or_higher() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.is_superadmin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_superadmin() TO authenticated;

-- --- Self-service functions called from frontend (b) ---

-- mark_password_changed() — called from frontend after forced password change
REVOKE EXECUTE ON FUNCTION public.mark_password_changed() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_password_changed() TO authenticated;

-- create_daily_checklist_instances() — called via .rpc() in src/lib/api/checklists-v2.ts
REVOKE EXECUTE ON FUNCTION public.create_daily_checklist_instances(uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_daily_checklist_instances(uuid, date) TO authenticated;

-- --- Admin UI functions (c) ---

-- generate_qr_codes_with_prefix() — called from admin QR management UI
REVOKE EXECUTE ON FUNCTION public.generate_qr_codes_with_prefix(uuid, uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generate_qr_codes_with_prefix(uuid, uuid, integer) TO authenticated;

-- get_prefix_qr_stats() — called from admin QR management UI
REVOKE EXECUTE ON FUNCTION public.get_prefix_qr_stats(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_prefix_qr_stats(uuid, uuid) TO authenticated;


-- =============================================================================
-- GROUP 3: Already correct — no changes needed
--
-- get_my_role() and get_my_shop_id() already have correct permissions from
-- migration 20260208000100_fix_user_profiles_security_definer.sql:
--   REVOKE EXECUTE FROM public, anon
--   GRANT EXECUTE TO authenticated
-- =============================================================================
