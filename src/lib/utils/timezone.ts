// ============================================================================
// IST (India Standard Time) Timezone Utilities
// ============================================================================
// All attendance and business times in this app should be displayed in IST
// (Asia/Kolkata, UTC+5:30). These utilities ensure consistent timezone handling.

const IST_TIMEZONE = 'Asia/Kolkata';

/**
 * Get the current date in IST as YYYY-MM-DD string.
 * 
 * IMPORTANT: Do NOT use `new Date().toISOString().split('T')[0]` for date calculations!
 * That gives the UTC date, which is wrong between 00:00–05:30 IST (still previous day in UTC).
 * 
 * Example: At 1:00 AM IST on Feb 11 → UTC is 7:30 PM Feb 10 → toISOString gives "2026-02-10" (WRONG)
 * This function correctly returns "2026-02-11" in that case.
 */
export function getISTDateString(date?: Date): string {
  const d = date || new Date();
  // en-CA locale formats dates as YYYY-MM-DD
  return d.toLocaleDateString('en-CA', { timeZone: IST_TIMEZONE });
}

/**
 * Get the current timestamp as an ISO string (UTC).
 * This is the correct format for storing in timestamptz columns.
 */
export function getNowISO(): string {
  return new Date().toISOString();
}

/**
 * Ensure a timestamp string has timezone information.
 * 
 * Supabase may return timestamps in different formats depending on column type:
 * - timestamptz: "2026-02-10T04:30:00+00:00" (has offset)
 * - timestamp:   "2026-02-10T04:30:00" (no offset)
 * 
 * If no timezone info is present, assumes UTC (appends Z).
 * This prevents browsers from interpreting bare timestamps as local time.
 */
export function ensureTimezoneOffset(timestamp: string): string {
  if (!timestamp) return timestamp;
  // Already has Z or +/-HH:MM offset
  if (/[Zz]$/.test(timestamp) || /[+-]\d{2}(:\d{2})?$/.test(timestamp)) {
    return timestamp;
  }
  // No timezone info — assume UTC
  return timestamp + 'Z';
}

/**
 * Format a timestamp string to display time in IST.
 * Always uses Asia/Kolkata timezone regardless of browser timezone.
 * 
 * @returns Time string like "10:00 am" or "--:--" if null
 */
export function formatTimeIST(isoString: string | null | undefined): string {
  if (!isoString) return '--:--';
  try {
    const date = new Date(ensureTimezoneOffset(isoString));
    if (isNaN(date.getTime())) return '--:--';
    return date.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: IST_TIMEZONE,
    });
  } catch {
    return '--:--';
  }
}

/**
 * Format a timestamp to display date in IST.
 */
export function formatDateIST(isoString: string | Date): string {
  const str = typeof isoString === 'string' ? ensureTimezoneOffset(isoString) : isoString;
  const date = typeof str === 'string' ? new Date(str) : str;
  return new Intl.DateTimeFormat('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: IST_TIMEZONE,
  }).format(date);
}

/**
 * Format a timestamp to display date + time in IST.
 */
export function formatDateTimeIST(isoString: string | Date): string {
  const str = typeof isoString === 'string' ? ensureTimezoneOffset(isoString) : isoString;
  const date = typeof str === 'string' ? new Date(str) : str;
  return new Intl.DateTimeFormat('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: IST_TIMEZONE,
  }).format(date);
}

/**
 * Extract HH:MM time string in IST from an ISO/timestamp string.
 * Useful for populating <input type="time"> fields in edit/create forms.
 * 
 * Example: "2026-02-10T04:30:00+00:00" → "10:00" (IST)
 */
export function extractISTTime(isoString: string | null | undefined): string {
  if (!isoString) return '';
  try {
    const date = new Date(ensureTimezoneOffset(isoString));
    if (isNaN(date.getTime())) return '';
    
    const parts = new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: IST_TIMEZONE,
    }).formatToParts(date);

    const hour = parts.find(p => p.type === 'hour')?.value || '00';
    const minute = parts.find(p => p.type === 'minute')?.value || '00';
    return `${hour}:${minute}`;
  } catch {
    return '';
  }
}

/**
 * Combine a date string (YYYY-MM-DD) and time string (HH:MM) in IST
 * into an ISO timestamp string suitable for database storage.
 * 
 * Since IST is UTC+5:30, this creates a timestamp with the +05:30 offset,
 * which the database will correctly store as a UTC moment.
 * 
 * Example: ("2026-02-10", "10:00") → "2026-02-10T10:00:00+05:30"
 * The DB stores this as 2026-02-10T04:30:00 UTC internally.
 */
export function buildISTTimestamp(dateStr: string, timeStr: string): string {
  return `${dateStr}T${timeStr}:00+05:30`;
}

/**
 * Get the next day's date string (YYYY-MM-DD) from a given date string.
 */
export function getNextDayDateString(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(year, month - 1, day + 1);
  return d.toLocaleDateString('en-CA'); // en-CA → YYYY-MM-DD
}

/**
 * Check if a date string (YYYY-MM-DD) is before today in IST.
 */
export function isBeforeToday(dateStr: string): boolean {
  const today = getISTDateString();
  return dateStr < today;
}

export { IST_TIMEZONE };
