'use client';

/**
 * Sync Status Hook
 * 
 * Provides easy access to sync state from any component.
 * Combines offline status + pending sales into a unified view.
 */

import { useSync } from '@/context/SyncContext';
import { useOfflineStatus } from '@/hooks/useOfflineStatus';
import { useMemo } from 'react';
import type { SyncStatus } from '@/lib/offline/config';

export interface UseSyncStatusReturn {
  // Connection state
  isOnline: boolean;
  wasOffline: boolean;
  
  // Sync state
  syncing: boolean;
  status: SyncStatus;
  
  // Counts
  pendingCount: number;
  failedCount: number;
  totalPending: number;
  
  // Inventory cache state
  inventoryCaching: boolean;
  inventoryCacheCount: number;
  lastInventoryCacheTime: string | null;
  refreshInventoryCache: () => Promise<void>;
  
  // Actions
  syncNow: () => Promise<void>;
  retryFailed: () => Promise<void>;
  
  // Helpers
  hasIssues: boolean;
  needsAttention: boolean;
  statusMessage: string;
}

export function useSyncStatus(shopId?: string): UseSyncStatusReturn {
  const { isOnline, wasOffline } = useOfflineStatus();
  const { 
    syncing, 
    syncNow, 
    retryFailed, 
    getPendingCount, 
    getFailedCount,
    inventoryCaching,
    inventoryCacheCount,
    lastInventoryCacheTime,
    refreshInventoryCache,
  } = useSync();

  const pendingCount = useMemo(() => getPendingCount(shopId), [getPendingCount, shopId]);
  const failedCount = useMemo(() => getFailedCount(shopId), [getFailedCount, shopId]);
  const totalPending = pendingCount + failedCount;

  const status: SyncStatus = useMemo(() => {
    if (!isOnline) return 'offline';
    if (syncing) return 'syncing';
    if (failedCount > 0) return 'error';
    if (pendingCount > 0) return 'idle';
    return 'success';
  }, [isOnline, syncing, failedCount, pendingCount]);

  const statusMessage = useMemo(() => {
    if (!isOnline) return 'Offline - sales will sync when back online';
    if (syncing) return 'Syncing sales...';
    if (failedCount > 0) return `${failedCount} sale(s) failed to sync`;
    if (pendingCount > 0) return `${pendingCount} sale(s) waiting to sync`;
    return 'All synced';
  }, [isOnline, syncing, failedCount, pendingCount]);

  return {
    isOnline,
    wasOffline,
    syncing,
    status,
    pendingCount,
    failedCount,
    totalPending,
    inventoryCaching,
    inventoryCacheCount,
    lastInventoryCacheTime,
    refreshInventoryCache,
    syncNow,
    retryFailed,
    hasIssues: failedCount > 0,
    needsAttention: failedCount > 0 || (!isOnline && pendingCount > 0),
    statusMessage,
  };
}
