-- ============================================================================
-- Migration: Unified nightly cron — attendance auto-close + daily checklists
-- ============================================================================
-- Runs at 12:05 AM IST (18:35 UTC) every day via pg_cron.
-- Uses pg_net to call Edge Functions from DB functions (middleman pattern).
--
-- Architecture:
--   pg_cron  →  run_nightly_tasks()  →  1. auto_close_stale_attendance()  (pure SQL)
--                                       2. invoke_create_daily_checklists() → Edge Function via pg_net
--
-- Prerequisites:
--   • pg_cron extension enabled  ✅
--   • pg_net extension enabled   ✅
--   • Edge Function "create-daily-checklists" must be deployed
--   • Vault secrets must be set (see SETUP section at bottom of file)
-- ============================================================================

-- 1. Enable required extensions (safe to run even if already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;


-- 2. Middleman function: invoke create-daily-checklists Edge Function via HTTP
--    Reads project URL and service_role_key from Supabase Vault.
CREATE OR REPLACE FUNCTION invoke_create_daily_checklists()
RETURNS void AS $$
DECLARE
  project_url text;
  svc_key text;
  edge_function_url text;
BEGIN
  -- Read secrets from Supabase Vault
  SELECT decrypted_secret INTO project_url
    FROM vault.decrypted_secrets WHERE name = 'project_url' LIMIT 1;
  SELECT decrypted_secret INTO svc_key
    FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1;

  IF project_url IS NULL OR svc_key IS NULL THEN
    RAISE WARNING '[nightly-cron] Vault secrets "project_url" or "service_role_key" not set. Skipping checklist creation. Run the SETUP SQL at the bottom of the migration.';
    RETURN;
  END IF;

  edge_function_url := rtrim(project_url, '/') || '/functions/v1/create-daily-checklists';

  -- Fire-and-forget HTTP POST via pg_net
  PERFORM net.http_post(
    url     := edge_function_url,
    body    := '{}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || svc_key
    )
  );

  RAISE LOG '[nightly-cron] Invoked create-daily-checklists edge function at %', edge_function_url;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions;


-- 3. Middleman function: invoke auto-close-attendance Edge Function via HTTP
--    (Backup — the DB function auto_close_stale_attendance() is preferred,
--     but this can be used if you want the edge function path instead.)
CREATE OR REPLACE FUNCTION invoke_auto_close_attendance()
RETURNS void AS $$
DECLARE
  project_url text;
  svc_key text;
  edge_function_url text;
BEGIN
  SELECT decrypted_secret INTO project_url
    FROM vault.decrypted_secrets WHERE name = 'project_url' LIMIT 1;
  SELECT decrypted_secret INTO svc_key
    FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1;

  IF project_url IS NULL OR svc_key IS NULL THEN
    RAISE WARNING '[nightly-cron] Vault secrets not set. Skipping attendance auto-close via edge function.';
    RETURN;
  END IF;

  edge_function_url := rtrim(project_url, '/') || '/functions/v1/auto-close-attendance';

  PERFORM net.http_post(
    url     := edge_function_url,
    body    := '{}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || svc_key
    )
  );

  RAISE LOG '[nightly-cron] Invoked auto-close-attendance edge function';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions;


-- 4. Unified nightly task runner
CREATE OR REPLACE FUNCTION run_nightly_tasks()
RETURNS void AS $$
BEGIN
  RAISE LOG '[nightly-cron] Starting nightly tasks at %', NOW() AT TIME ZONE 'Asia/Kolkata';

  -- Task 1: Auto-close stale attendance (isolated — failure won't block checklists)
  BEGIN
    PERFORM auto_close_stale_attendance();
    RAISE LOG '[nightly-cron] Attendance auto-close complete';
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[nightly-cron] Attendance auto-close FAILED: %', SQLERRM;
  END;

  -- Task 2: Create daily checklists (isolated — failure won't block other tasks)
  BEGIN
    PERFORM invoke_create_daily_checklists();
    RAISE LOG '[nightly-cron] Daily checklist creation invoked';
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[nightly-cron] Checklist creation FAILED: %', SQLERRM;
  END;

  RAISE LOG '[nightly-cron] All nightly tasks complete';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions;

COMMENT ON FUNCTION run_nightly_tasks() IS
  'Runs at 12:05 AM IST daily via pg_cron. '
  '1) Auto-closes stale attendance sessions. '
  '2) Creates daily checklist instances via Edge Function.';


-- 5. Schedule the cron job — 12:05 AM IST = 18:35 UTC
-- Unschedule any previous versions first
SELECT cron.unschedule('nightly-tasks') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'nightly-tasks'
);

SELECT cron.schedule(
  'nightly-tasks',
  '35 18 * * *',  -- 18:35 UTC = 12:05 AM IST daily
  $$SELECT run_nightly_tasks()$$
);

-- 6. Clean up old individual schedules if they exist
SELECT cron.unschedule('create-daily-checklists') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'create-daily-checklists'
);
SELECT cron.unschedule('auto-close-attendance') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'auto-close-attendance'
);


-- ============================================================================
-- SETUP: Run these ONCE manually in the Supabase SQL Editor after migration.
-- Replace the placeholder values with your actual project URL and service role key.
-- These are stored encrypted in Supabase Vault — NOT in plain text.
-- ============================================================================
--
--   SELECT vault.create_secret(
--     'https://YOUR_PROJECT_REF.supabase.co',
--     'project_url',
--     'Supabase project URL for pg_net edge function calls'
--   );
--
--   SELECT vault.create_secret(
--     'YOUR_SERVICE_ROLE_KEY_HERE',
--     'service_role_key',
--     'Service role key for authenticating edge function calls from pg_cron'
--   );
--
-- To verify secrets were stored:
--   SELECT name, description, created_at FROM vault.secrets;
--
-- To update a secret later:
--   UPDATE vault.secrets SET secret = 'new_value' WHERE name = 'project_url';
--
-- ============================================================================
