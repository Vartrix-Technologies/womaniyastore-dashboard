-- ============================================================================
-- Migration: Attendance auto-close & max-shift guardrails
-- ============================================================================
-- 1. Database function to auto-close stale open sessions (callable from cron)
-- 2. Enhanced validate_clock_times trigger with max shift duration check
-- ============================================================================

-- 1. Server-side auto-close function
-- Can be invoked via: SELECT auto_close_stale_attendance();
-- Or scheduled via pg_cron / Supabase Edge Function cron
CREATE OR REPLACE FUNCTION auto_close_stale_attendance()
RETURNS TABLE(closed_id uuid, closed_date date) AS $$
DECLARE
  max_shift_hours CONSTANT integer := 16;
  today_ist date;
  stale RECORD;
  auto_clock_out timestamptz;
  max_from_clock_in timestamptz;
BEGIN
  -- Get today in IST
  today_ist := (NOW() AT TIME ZONE 'Asia/Kolkata')::date;

  FOR stale IN
    SELECT id, date, clock_in
    FROM attendance_logs
    WHERE status = 'open'
      AND deleted_at IS NULL
      AND date < today_ist
  LOOP
    -- Midnight IST (end of shift day = 00:00 next day)
    auto_clock_out := ((stale.date + INTERVAL '1 day') AT TIME ZONE 'Asia/Kolkata');
    -- Cap at max_shift_hours from clock_in
    max_from_clock_in := stale.clock_in + (max_shift_hours * INTERVAL '1 hour');

    IF auto_clock_out > max_from_clock_in THEN
      auto_clock_out := max_from_clock_in;
    END IF;

    -- Safety: if clock_out still <= clock_in (e.g. clock_in was after midnight
    -- but date was previous day), fall back to clock_in + 1 minute
    IF auto_clock_out <= stale.clock_in THEN
      auto_clock_out := stale.clock_in + INTERVAL '1 minute';
    END IF;

    UPDATE attendance_logs
    SET clock_out = auto_clock_out,
        status = 'closed',
        edit_reason = 'Auto-closed: staff did not clock out (system)'
    WHERE attendance_logs.id = stale.id;

    closed_id := stale.id;
    closed_date := stale.date;
    RETURN NEXT;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

COMMENT ON FUNCTION auto_close_stale_attendance() IS
  'Auto-closes all open attendance sessions from previous days. '
  'Clock-out is set to midnight IST (end of shift day), capped at 16 hours from clock_in.';


-- 2. Enhanced clock time validation with max shift duration
-- Replaces the existing validate_clock_times trigger function
CREATE OR REPLACE FUNCTION validate_clock_times()
RETURNS TRIGGER AS $$
DECLARE
  max_shift_hours CONSTANT integer := 16;
  shift_duration interval;
BEGIN
  -- If clock_out exists, ensure it's after clock_in
  -- For auto-closed records, fix silently instead of rejecting
  IF NEW.clock_out IS NOT NULL AND NEW.clock_out <= NEW.clock_in THEN
    IF NEW.edit_reason LIKE 'Auto-closed:%' THEN
      NEW.clock_out := NEW.clock_in + INTERVAL '1 minute';
    ELSE
      RAISE EXCEPTION 'Clock out time must be after clock in time';
    END IF;
  END IF;

  -- Validate break time isn't too long
  IF NEW.total_break_minutes IS NOT NULL AND NEW.total_break_minutes > 480 THEN
    RAISE EXCEPTION 'Break time cannot exceed 8 hours';
  END IF;

  -- Validate max shift duration (only when clock_out is set)
  IF NEW.clock_out IS NOT NULL THEN
    shift_duration := NEW.clock_out - NEW.clock_in;
    IF shift_duration > (max_shift_hours * INTERVAL '1 hour') THEN
      -- For auto-closed records, cap silently instead of rejecting
      IF NEW.edit_reason LIKE 'Auto-closed:%' THEN
        NEW.clock_out := NEW.clock_in + (max_shift_hours * INTERVAL '1 hour');
      ELSE
        RAISE EXCEPTION 'Shift duration cannot exceed % hours. Got % hours.',
          max_shift_hours,
          ROUND(EXTRACT(EPOCH FROM shift_duration) / 3600, 1);
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public;

-- Trigger already exists from previous migration; this CREATE OR REPLACE updates the function body.
-- No need to recreate the trigger itself.
