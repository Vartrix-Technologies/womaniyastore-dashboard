// Formatting utilities for the application
import { ensureTimezoneOffset } from '@/lib/utils/timezone';

const IST_TIMEZONE = 'Asia/Kolkata';

/**
 * Format a number as Indian Rupees
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Format a date to Indian locale (IST)
 */
export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(ensureTimezoneOffset(date)) : date;
  return new Intl.DateTimeFormat('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: IST_TIMEZONE,
  }).format(d);
}

/**
 * Format a date with time (IST)
 */
export function formatDateTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(ensureTimezoneOffset(date)) : date;
  return new Intl.DateTimeFormat('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: IST_TIMEZONE,
  }).format(d);
}

/**
 * Format only time (HH:MM AM/PM) in IST
 */
export function formatTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(ensureTimezoneOffset(date)) : date;
  return new Intl.DateTimeFormat('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: IST_TIMEZONE,
  }).format(d);
}

/**
 * Format a time duration (in minutes) to hours and minutes
 */
export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  
  if (hours === 0) return `m`;
  if (mins === 0) return `h`;
  return `h m`;
}

/**
 * Format phone number (Indian format)
 */
export function formatPhone(phone: string | null): string {
  if (!phone) return '-';
  // Remove all non-digits
  const cleaned = phone.replace(/\D/g, '');
  
  // Format as +91 XXXXX XXXXX for 10 digit numbers
  if (cleaned.length === 10) {
    return `+91  `;
  }
  
  return phone;
}

/**
 * Format percentage
 */
export function formatPercent(value: number, decimals: number = 1): string {
  return `%`;
}

/**
 * Truncate long text
 */
export function truncate(text: string, maxLength: number = 50): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}
