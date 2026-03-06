-- Attendance CRUD & Audit Trail Migration
-- Add columns for tracking edits, deletions, and manual entries

-- Add audit trail columns to attendance_logs
ALTER TABLE attendance_logs 
  ADD COLUMN IF NOT EXISTS edited_by UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS edited_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS edit_reason TEXT,
  ADD COLUMN IF NOT EXISTS is_manual_entry BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS manual_entry_reason TEXT,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS delete_reason TEXT;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_attendance_logs_deleted_at ON attendance_logs(deleted_at);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_edited_at ON attendance_logs(edited_at);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_is_manual ON attendance_logs(is_manual_entry);

-- Update RLS policies to allow admins to update and delete
-- Drop existing policies if they exist
DROP POLICY IF EXISTS attendance_update ON attendance_logs;
DROP POLICY IF EXISTS attendance_delete ON attendance_logs;

-- Allow admins to update attendance records (for edits)
CREATE POLICY attendance_update ON attendance_logs
  FOR UPDATE
  USING (
    shop_id = (SELECT shop_id FROM profiles WHERE id = auth.uid())
    AND (
      (SELECT role FROM profiles WHERE id = auth.uid()) IN ('owner', 'admin')
      OR staff_id = auth.uid() -- Staff can update their own ongoing attendance
    )
  )
  WITH CHECK (
    shop_id = (SELECT shop_id FROM profiles WHERE id = auth.uid())
  );

-- Allow admins to soft delete (mark as deleted)
CREATE POLICY attendance_delete ON attendance_logs
  FOR UPDATE
  USING (
    shop_id = (SELECT shop_id FROM profiles WHERE id = auth.uid())
    AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('owner', 'admin')
  );

-- Allow admins to create manual attendance entries
CREATE POLICY attendance_manual_insert ON attendance_logs
  FOR INSERT
  WITH CHECK (
    shop_id = (SELECT shop_id FROM profiles WHERE id = auth.uid())
    AND (
      (SELECT role FROM profiles WHERE id = auth.uid()) IN ('owner', 'admin')
      OR staff_id = auth.uid() -- Staff can still create their own
    )
  );

-- Function to check for duplicate attendance on same date
CREATE OR REPLACE FUNCTION check_duplicate_attendance()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if staff already has attendance for this date (excluding deleted records)
  IF EXISTS (
    SELECT 1 FROM attendance_logs
    WHERE staff_id = NEW.staff_id
      AND date = NEW.date
      AND deleted_at IS NULL
      AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
  ) THEN
    RAISE EXCEPTION 'Staff already has attendance record for this date';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to prevent duplicates
DROP TRIGGER IF EXISTS prevent_duplicate_attendance ON attendance_logs;
CREATE TRIGGER prevent_duplicate_attendance
  BEFORE INSERT OR UPDATE ON attendance_logs
  FOR EACH ROW
  EXECUTE FUNCTION check_duplicate_attendance();

-- Function to validate clock times
CREATE OR REPLACE FUNCTION validate_clock_times()
RETURNS TRIGGER AS $$
BEGIN
  -- If clock_out exists, ensure it's after clock_in
  IF NEW.clock_out IS NOT NULL AND NEW.clock_out <= NEW.clock_in THEN
    RAISE EXCEPTION 'Clock out time must be after clock in time';
  END IF;
  
  -- Validate break time isn't too long
  IF NEW.total_break_minutes IS NOT NULL AND NEW.total_break_minutes > 480 THEN
    RAISE EXCEPTION 'Break time cannot exceed 8 hours';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for time validation
DROP TRIGGER IF EXISTS validate_attendance_times ON attendance_logs;
CREATE TRIGGER validate_attendance_times
  BEFORE INSERT OR UPDATE ON attendance_logs
  FOR EACH ROW
  EXECUTE FUNCTION validate_clock_times();

-- Comments for documentation
COMMENT ON COLUMN attendance_logs.edited_by IS 'User who last edited this record';
COMMENT ON COLUMN attendance_logs.edited_at IS 'When this record was last edited';
COMMENT ON COLUMN attendance_logs.edit_reason IS 'Reason for manual edit';
COMMENT ON COLUMN attendance_logs.is_manual_entry IS 'True if this was manually created by admin';
COMMENT ON COLUMN attendance_logs.manual_entry_reason IS 'Reason for manual entry';
COMMENT ON COLUMN attendance_logs.deleted_at IS 'Soft delete timestamp';
COMMENT ON COLUMN attendance_logs.deleted_by IS 'User who deleted this record';
COMMENT ON COLUMN attendance_logs.delete_reason IS 'Reason for deletion';
