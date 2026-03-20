import { supabase } from '../supabase';
import { Database } from '@/types/database.types';
import { getISTDateString, getNowISO, buildISTTimestamp, getNextDayDateString } from '@/lib/utils/timezone';

type AttendanceLog = Database['public']['Tables']['attendance_logs']['Row'];
type AttendanceInsert = Database['public']['Tables']['attendance_logs']['Insert'];
type AttendanceStatus = Database['public']['Enums']['attendance_status'];

// Maximum allowed shift duration in hours. Shifts auto-closed by cron or
// client-side logic will be capped at this duration from clock_in.
const MAX_SHIFT_HOURS = 16;
const MAX_SHIFT_MS = MAX_SHIFT_HOURS * 60 * 60 * 1000;

export interface AutoClosedSession {
  id: string;
  date: string;
}

export interface TodayAttendance {
  id: string;
  clock_in: string;
  clock_out: string | null;
  status: AttendanceStatus;
  total_break_minutes: number;
  date: string;
}

export interface MonthlyAttendanceRecord extends AttendanceLog {
  hours_worked?: number;
}

export interface AttendanceStats {
  total_days_present: number;
  total_days_in_month: number;
  average_hours_per_day: number;
  total_hours_worked: number;
  earliest_clock_in: string | null;
  latest_clock_out: string | null;
}

/**
 * Auto-close stale open attendance sessions from previous days.
 * Sets clock_out to midnight IST (end of shift day), capped at MAX_SHIFT_HOURS from clock_in.
 * Returns the list of auto-closed sessions for UI notifications.
 */
export async function autoCloseStaleAttendance(staffId: string): Promise<AutoClosedSession[]> {
  const today = getISTDateString();
  const closed: AutoClosedSession[] = [];

  const { data: staleRecords } = await supabase
    .from('attendance_logs')
    .select('id, date, clock_in')
    .eq('staff_id', staffId)
    .eq('status', 'open')
    .is('deleted_at', null)
    .neq('date', today);

  if (!staleRecords || staleRecords.length === 0) return closed;

  for (const stale of staleRecords) {
    // Midnight IST (end of shift day = 00:00 next day)
    const autoCloseAt = new Date(buildISTTimestamp(getNextDayDateString(stale.date), '00:00'));
    // Cap at MAX_SHIFT_HOURS from clock_in
    const clockInMs = new Date(stale.clock_in).getTime();
    const maxFromClockIn = new Date(clockInMs + MAX_SHIFT_MS);
    let cappedClockOut = autoCloseAt < maxFromClockIn ? autoCloseAt : maxFromClockIn;
    // Safety: ensure clock_out > clock_in (e.g. clock_in was after midnight)
    if (cappedClockOut.getTime() <= clockInMs) {
      cappedClockOut = new Date(clockInMs + 60_000); // +1 minute
    }

    await supabase
      .from('attendance_logs')
      .update({
        clock_out: cappedClockOut.toISOString(),
        status: 'closed' as AttendanceStatus,
        edit_reason: 'Auto-closed: staff did not clock out',
      })
      .eq('id', stale.id);

    closed.push({ id: stale.id, date: stale.date });
  }

  return closed;
}

/**
 * Clock in for today.
 * Automatically closes any stale open sessions from previous days first.
 */
export async function clockIn(staffId: string, shopId: string): Promise<{ data: AttendanceLog | null; error: any; autoClosedSessions: AutoClosedSession[] }> {
  const today = getISTDateString();
  const now = getNowISO();

  // Auto-close any stale open sessions from previous days
  const autoClosedSessions = await autoCloseStaleAttendance(staffId);

  // Check if already clocked in today
  const { data: existing } = await supabase
    .from('attendance_logs')
    .select('*')
    .eq('staff_id', staffId)
    .eq('date', today)
    .is('deleted_at', null)
    .single();

  if (existing) {
    return { 
      data: null, 
      error: { message: 'Already clocked in today' },
      autoClosedSessions,
    };
  }

  const insertData: AttendanceInsert = {
    staff_id: staffId,
    shop_id: shopId,
    date: today,
    clock_in: now,
    status: 'open',
    total_break_minutes: 0,
  };

  const { data, error } = await supabase
    .from('attendance_logs')
    .insert(insertData)
    .select()
    .single();

  return { data, error, autoClosedSessions };
}

/**
 * Clock out for today
 */
export async function clockOut(attendanceId: string): Promise<{ data: AttendanceLog | null; error: any }> {
  const now = getNowISO();

  const { data, error } = await supabase
    .from('attendance_logs')
    .update({ 
      clock_out: now, 
      status: 'closed' 
    })
    .eq('id', attendanceId)
    .select()
    .single();

  return { data, error };
}

/**
 * Get today's attendance record.
 * Auto-closes any stale open sessions from previous days first,
 * so the staff member is never blocked from clocking in today.
 */
export async function getTodayAttendance(staffId: string): Promise<{ data: TodayAttendance | null; error: any; autoClosedSessions: AutoClosedSession[] }> {
  // Auto-close stale sessions (previous days left open)
  const autoClosedSessions = await autoCloseStaleAttendance(staffId);

  const today = getISTDateString();

  // Check for today's open session first
  const { data: openRecord, error: openError } = await supabase
    .from('attendance_logs')
    .select('id, clock_in, clock_out, status, total_break_minutes, date')
    .eq('staff_id', staffId)
    .eq('status', 'open')
    .eq('date', today)
    .is('deleted_at', null)
    .maybeSingle();

  if (!openError && openRecord) {
    return { data: openRecord, error: null, autoClosedSessions };
  }

  // Fall back to today's closed record
  const { data, error } = await supabase
    .from('attendance_logs')
    .select('id, clock_in, clock_out, status, total_break_minutes, date')
    .eq('staff_id', staffId)
    .eq('date', today)
    .is('deleted_at', null)
    .maybeSingle();

  return { data, error, autoClosedSessions };
}

/**
 * Get monthly attendance records
 */
export async function getMonthlyAttendance(
  staffId: string,
  year: number,
  month: number
): Promise<{ data: MonthlyAttendanceRecord[]; error: any }> {
  // Month is 1-indexed (1=Jan, 12=Dec)
  // Use UTC to avoid timezone shifts
  const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate(); // Get last day number
  const endDate = `${year}-${month.toString().padStart(2, '0')}-${lastDay.toString().padStart(2, '0')}`;

  const { data, error } = await supabase
    .from('attendance_logs')
    .select('*')
    .eq('staff_id', staffId)
    .gte('date', startDate)
    .lte('date', endDate)
    .is('deleted_at', null)
    .order('date', { ascending: true });

  if (error) {
    return { data: [], error };
  }

  // Calculate hours worked for each record
  const recordsWithHours = (data || []).map((record) => {
    let hours_worked = 0;
    if (record.clock_in && record.clock_out) {
      const clockIn = new Date(record.clock_in);
      const clockOut = new Date(record.clock_out);
      const diffMs = clockOut.getTime() - clockIn.getTime();
      const diffMinutes = diffMs / (1000 * 60);
      hours_worked = (diffMinutes - record.total_break_minutes) / 60;
    }
    return { ...record, hours_worked };
  });

  return { data: recordsWithHours, error: null };
}

/**
 * Calculate attendance statistics for a month
 */
export async function getAttendanceStats(
  staffId: string,
  year: number,
  month: number
): Promise<{ data: AttendanceStats | null; error: any }> {
  const { data: records, error } = await getMonthlyAttendance(staffId, year, month);

  if (error) {
    return { data: null, error };
  }

  // Calculate total days in month (month is 1-indexed, so subtract 1 for Date constructor, then add 1 and use 0 to get last day)
  const daysInMonth = new Date(year, month - 1 + 1, 0).getDate();
  const totalDaysPresent = records.length;

  // Calculate total hours and average
  let totalHours = 0;
  let earliestClockIn: Date | null = null;
  let latestClockOut: Date | null = null;

  records.forEach((record) => {
    if (record.hours_worked) {
      totalHours += record.hours_worked;
    }

    if (record.clock_in) {
      const clockIn = new Date(record.clock_in);
      if (earliestClockIn === null || clockIn < earliestClockIn) {
        earliestClockIn = clockIn;
      }
    }

    if (record.clock_out) {
      const clockOut = new Date(record.clock_out);
      if (latestClockOut === null || clockOut > latestClockOut) {
        latestClockOut = clockOut;
      }
    }
  });

  const averageHoursPerDay = totalDaysPresent > 0 ? totalHours / totalDaysPresent : 0;

  // Convert dates to ISO strings
  const earliestClockInStr = (earliestClockIn as Date | null)?.toISOString() ?? null;
  const latestClockOutStr = (latestClockOut as Date | null)?.toISOString() ?? null;

  const stats: AttendanceStats = {
    total_days_present: totalDaysPresent,
    total_days_in_month: daysInMonth,
    average_hours_per_day: Math.round(averageHoursPerDay * 100) / 100,
    total_hours_worked: Math.round(totalHours * 100) / 100,
    earliest_clock_in: earliestClockInStr,
    latest_clock_out: latestClockOutStr,
  };

  return { data: stats, error: null };
}

/**
 * Update break minutes (for future use)
 */
export async function updateBreakMinutes(
  attendanceId: string,
  breakMinutes: number
): Promise<{ data: AttendanceLog | null; error: any }> {
  const { data, error } = await supabase
    .from('attendance_logs')
    .update({ total_break_minutes: breakMinutes })
    .eq('id', attendanceId)
    .select()
    .single();

  return { data, error };
}

// ============================================
// CRUD OPERATIONS FOR ADMIN
// ============================================

export interface CreateAttendanceData {
  staff_id: string;
  shop_id: string;
  date: string;
  clock_in: string;
  clock_out?: string | null;
  total_break_minutes?: number;
  manual_entry_reason: string;
}

export interface UpdateAttendanceData {
  clock_in?: string;
  clock_out?: string | null;
  total_break_minutes?: number;
  edit_reason: string;
}

/**
 * Create manual attendance entry (Admin only)
 */
export async function createManualAttendance(
  data: CreateAttendanceData,
  createdBy: string
): Promise<{ data: AttendanceLog | null; error: any }> {
  const insertData: AttendanceInsert = {
    staff_id: data.staff_id,
    shop_id: data.shop_id,
    date: data.date,
    clock_in: data.clock_in,
    clock_out: data.clock_out || null,
    total_break_minutes: data.total_break_minutes || 0,
    status: data.clock_out ? 'closed' : 'open',
    is_manual_entry: true,
    manual_entry_reason: data.manual_entry_reason,
  };

  const { data: result, error } = await supabase
    .from('attendance_logs')
    .insert(insertData)
    .select()
    .single();

  return { data: result, error };
}

/**
 * Update attendance record (Admin only)
 */
export async function updateAttendanceRecord(
  attendanceId: string,
  updates: UpdateAttendanceData,
  editedBy: string
): Promise<{ data: AttendanceLog | null; error: any }> {
  const updateData: any = {
    edited_by: editedBy,
    edited_at: getNowISO(),
    edit_reason: updates.edit_reason,
  };

  if (updates.clock_in) updateData.clock_in = updates.clock_in;
  if (updates.clock_out !== undefined) updateData.clock_out = updates.clock_out;
  if (updates.total_break_minutes !== undefined) {
    updateData.total_break_minutes = updates.total_break_minutes;
  }

  // Update status based on clock_out
  if (updates.clock_out !== undefined) {
    updateData.status = updates.clock_out ? 'closed' : 'open';
  }

  const { data, error } = await supabase
    .from('attendance_logs')
    .update(updateData)
    .eq('id', attendanceId)
    .select()
    .single();

  return { data, error };
}

/**
 * Soft delete attendance record (Admin only)
 */
export async function deleteAttendanceRecord(
  attendanceId: string,
  deleteReason: string,
  deletedBy: string
): Promise<{ data: AttendanceLog | null; error: any }> {
  const { data, error } = await supabase
    .from('attendance_logs')
    .update({
      deleted_at: getNowISO(),
      deleted_by: deletedBy,
      delete_reason: deleteReason,
    })
    .eq('id', attendanceId)
    .select()
    .single();

  return { data, error };
}

/**
 * Get attendance logs with filters (excluding deleted)
 */
export async function getAttendanceLogs(
  shopId: string,
  filters: {
    startDate?: string;
    endDate?: string;
    staffId?: string;
    includeDeleted?: boolean;
    includeManualOnly?: boolean;
    includeEditedOnly?: boolean;
  } = {}
): Promise<{ data: any[]; error: any }> {
  let query = supabase
    .from('attendance_logs')
    .select('*, staff:profiles!attendance_logs_staff_id_fkey(full_name, role)')
    .eq('shop_id', shopId);

  // Exclude deleted by default
  if (!filters.includeDeleted) {
    query = query.is('deleted_at', null);
  }

  if (filters.startDate) {
    query = query.gte('date', filters.startDate);
  }

  if (filters.endDate) {
    query = query.lte('date', filters.endDate);
  }

  if (filters.staffId) {
    query = query.eq('staff_id', filters.staffId);
  }

  if (filters.includeManualOnly) {
    query = query.eq('is_manual_entry', true);
  }

  if (filters.includeEditedOnly) {
    query = query.not('edited_at', 'is', null);
  }

  query = query.order('date', { ascending: false });

  const { data, error } = await query;

  return { data: data || [], error };
}
