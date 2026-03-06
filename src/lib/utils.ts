import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { toast } from "sonner"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ============================================================================
// Date Range Utilities
// ============================================================================

export type DateFilterType = 'today' | 'week' | 'month' | 'all' | 'custom';

export interface DateRange {
  startDate: Date | null;
  endDate: Date;
}

/** Shape used for custom calendar date range (matches react-day-picker) */
export interface CustomDateRange {
  from?: Date;
  to?: Date;
}

/**
 * Calculate date range based on filter type.
 * Returns startDate as null for 'all' filter (truly unlimited).
 * For 'custom', pass the custom from/to dates explicitly.
 */
export function calculateDateRange(
  filter: DateFilterType,
  customFrom?: Date | null,
  customTo?: Date | null,
): DateRange {
  const now = new Date();

  if (filter === 'custom') {
    return {
      startDate: customFrom ?? null,
      // End of day for the custom "to" date so the full day is included
      endDate: customTo
        ? new Date(customTo.getFullYear(), customTo.getMonth(), customTo.getDate(), 23, 59, 59, 999)
        : now,
    };
  }

  let startDate: Date | null = null;

  switch (filter) {
    case 'today':
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case 'week':
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case 'month':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case 'all':
    default:
      startDate = null;
      break;
  }

  return { startDate, endDate: now };
}

// ============================================================================
// Pagination Utilities
// ============================================================================

export interface PaginationRange {
  from: number;
  to: number;
}

export interface PaginationInfo extends PaginationRange {
  totalPages: number;
  startItem: number;
  endItem: number;
}

/**
 * Calculate Supabase pagination range (0-indexed, inclusive).
 */
export function buildPaginationRange(currentPage: number, itemsPerPage: number): PaginationRange {
  const from = (currentPage - 1) * itemsPerPage;
  const to = from + itemsPerPage - 1;
  return { from, to };
}

/**
 * Calculate full pagination info for UI display.
 */
export function getPaginationInfo(
  currentPage: number,
  itemsPerPage: number,
  totalCount: number
): PaginationInfo {
  const { from, to } = buildPaginationRange(currentPage, itemsPerPage);
  const totalPages = Math.ceil(totalCount / itemsPerPage);
  const startItem = totalCount === 0 ? 0 : from + 1;
  const endItem = Math.min(to + 1, totalCount);

  return { from, to, totalPages, startItem, endItem };
}

// ============================================================================
// Time/Hours Utilities — Re-exported from @/lib/utils/attendance
// ============================================================================
export { calculateHours, calculateHoursFromTimeStrings } from '@/lib/utils/attendance';

// ============================================================================
// CSV Export Utilities
// ============================================================================

export interface ExportOptions {
  filename: string;
  headers?: string[];
  dateFormat?: boolean;
}

/**
 * Export data array to CSV and trigger download.
 * Handles escaping of commas and quotes.
 */
export function exportToCSV<T extends Record<string, unknown>>(
  data: T[],
  options: ExportOptions
): boolean {
  if (!data || data.length === 0) {
    toast.error('No data to export');
    return false;
  }

  const { filename, headers } = options;

  // Use provided headers or extract from first row
  const csvHeaders = headers || Object.keys(data[0]);
  
  const rows = data.map((row) =>
    csvHeaders.map((key) => {
      const val = row[key];
      const stringVal = String(val ?? '');
      // Escape quotes and wrap in quotes if contains comma, quote, or newline
      return stringVal.includes(',') || stringVal.includes('"') || stringVal.includes('\n')
        ? `"${stringVal.replace(/"/g, '""')}"`
        : stringVal;
    }).join(',')
  );

  const csv = [csvHeaders.join(','), ...rows].join('\n');

  // Create and trigger download
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  const dateStr = new Date().toISOString().split('T')[0];
  
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}-${dateStr}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  return true;
}

// ============================================================================
// Error Handling Utilities
// ============================================================================

/**
 * Standard API error handler with toast notification.
 * Returns a user-friendly message.
 */
export function handleApiError(
  error: unknown,
  fallbackMessage: string = 'An error occurred'
): string {
  console.error(fallbackMessage, error);

  let message = fallbackMessage;

  if (error instanceof Error) {
    message = error.message;
  } else if (typeof error === 'object' && error !== null) {
    // Handle Supabase error shape
    const err = error as { message?: string; error?: string; details?: string };
    message = err.message || err.error || err.details || fallbackMessage;
  } else if (typeof error === 'string') {
    message = error;
  }

  toast.error(message);
  return message;
}

/**
 * Wrap an async function with standard error handling.
 */
export async function withErrorHandling<T>(
  fn: () => Promise<T>,
  fallbackMessage: string = 'Operation failed'
): Promise<T | null> {
  try {
    return await fn();
  } catch (error) {
    handleApiError(error, fallbackMessage);
    return null;
  }
}
