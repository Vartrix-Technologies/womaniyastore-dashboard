// ============================================================================
// Attendance Time/Hours Utilities
// ============================================================================

/**
 * Calculate worked hours from clock in/out times and break minutes.
 * If clockOut is not provided, uses current time (for in-progress sessions).
 * Returns string with 1 decimal place (e.g., "7.5").
 */
export function calculateHours(
  clockIn: string | Date,
  clockOut?: string | Date | null,
  breakMinutes: number = 0
): string {
  const start = typeof clockIn === 'string' ? new Date(clockIn) : clockIn;
  const end = clockOut 
    ? (typeof clockOut === 'string' ? new Date(clockOut) : clockOut)
    : new Date();
  
  const totalMinutes = (end.getTime() - start.getTime()) / (1000 * 60);
  const netMinutes = Math.max(0, totalMinutes - breakMinutes);
  const hours = netMinutes / 60;
  
  return hours.toFixed(1);
}

/**
 * Calculate hours from time strings (HH:MM format) for same-day calculation.
 * Useful for form inputs where times are strings without dates.
 */
export function calculateHoursFromTimeStrings(
  clockIn: string,
  clockOut: string,
  breakMinutes: number = 0
): string {
  if (!clockIn || !clockOut) return '0.00';

  const [inHours, inMinutes] = clockIn.split(':').map(Number);
  const [outHours, outMinutes] = clockOut.split(':').map(Number);

  const totalMinutes = (outHours * 60 + outMinutes) - (inHours * 60 + inMinutes);
  const workMinutes = totalMinutes - breakMinutes;
  const hours = workMinutes / 60;

  return hours > 0 ? hours.toFixed(2) : '0.00';
}
