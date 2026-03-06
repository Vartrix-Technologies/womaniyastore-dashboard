/**
 * Offline Sync Configuration
 * 
 * Centralized configuration for offline sync behavior.
 * Adjust these values based on network conditions and business requirements.
 */

export const OFFLINE_CONFIG = {
  // Sync timing
  SYNC_INTERVAL_MS: 30_000, // 30 seconds between auto-sync attempts
  SYNC_DEBOUNCE_MS: 2_000, // Wait 2s after coming online before syncing
  
  // Retry behavior
  MAX_RETRY_ATTEMPTS: 3,
  RETRY_BACKOFF_MS: [1000, 5000, 15000], // Exponential backoff: 1s, 5s, 15s
  
  // Cache settings
  INVENTORY_CACHE_TTL_HOURS: 24, // How long to keep cached inventory items
  MAX_CACHED_ITEMS: 5000, // Maximum items to keep in cache
  
  // Batch settings (for future enhancement)
  SYNC_BATCH_SIZE: 10, // Max sales to sync in one batch
  
  // Feature flags (for gradual rollout)
  FEATURES: {
    OFFLINE_SCANNING: true, // Enable/disable offline scan fallback
    AUTO_CACHE_ON_SCAN: true, // Auto-cache items when scanned online
    BACKGROUND_SYNC: true, // Use Service Worker background sync if available
    SHOW_SYNC_INDICATOR: true, // Show sync status in UI
  },
} as const;

// Sync status types for extensibility
export type SyncStatus = 'idle' | 'syncing' | 'success' | 'error' | 'offline';

export interface SyncEvent {
  type: 'sync_start' | 'sync_complete' | 'sync_error' | 'sale_queued' | 'sale_synced' | 'sale_failed';
  timestamp: string;
  details?: Record<string, unknown>;
}

// Event bus for sync events (allows components to subscribe)
type SyncEventListener = (event: SyncEvent) => void;
const listeners: Set<SyncEventListener> = new Set();

export const SyncEventBus = {
  subscribe: (listener: SyncEventListener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  
  emit: (event: SyncEvent) => {
    listeners.forEach(listener => listener(event));
  },
};
