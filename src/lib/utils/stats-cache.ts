/**
 * Lightweight localStorage cache for dashboard stats.
 *
 * When the user navigates to a page while offline, React mounts the component
 * with default zeroes. Without a cache, those zeroes are displayed even though
 * we successfully fetched stats seconds ago on a different page.
 *
 * This utility lets each page:
 *   1. Initialise state from the last-known good values (instead of zeroes).
 *   2. Write back to the cache whenever a fresh fetch succeeds.
 *
 * Values are stored per-key under a common prefix so they're easy to find /
 * clear during logout or cache-busting.
 */

const PREFIX = 'stats_cache_';

/** Read last-known stats from localStorage, falling back to `defaultValue`. */
export function getCachedStats<T>(key: string, defaultValue: T): T {
  if (typeof window === 'undefined') return defaultValue;
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (raw) return JSON.parse(raw) as T;
  } catch {
    // Corrupted entry — ignore and return default
  }
  return defaultValue;
}

/** Persist stats so the next mount (even offline) starts with real data. */
export function setCachedStats<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // localStorage full or unavailable — non-critical, ignore
  }
}

/** Clear all cached stats (useful on logout). */
export function clearAllCachedStats(): void {
  if (typeof window === 'undefined') return;
  try {
    const keys = Object.keys(localStorage).filter(k => k.startsWith(PREFIX));
    keys.forEach(k => localStorage.removeItem(k));
  } catch {
    // Ignore
  }
}
