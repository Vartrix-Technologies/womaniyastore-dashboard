/**
 * Offline Sync Module - Public API
 * 
 * Clean export interface for the offline sync system.
 * Import from '@/lib/offline' for all offline functionality.
 */

// Core database operations
export {
  getDB,
  addPendingSale,
  getPendingSales,
  getPendingSalesByStatus,
  updatePendingSale,
  deletePendingSale,
  clearAllData,
  getFailedSales,
  addFailedSale,
  removeFailedSale,
} from './db';

// Inventory cache
export {
  cacheScannedItem,
  getCachedItem,
  cleanupCache,
  preCacheShopInventory,
  type CachedInventoryItem,
} from './inventory-cache';

// Configuration
export {
  OFFLINE_CONFIG,
  SyncEventBus,
  type SyncStatus,
  type SyncEvent,
} from './config';
