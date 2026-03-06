'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { useOfflineStatus } from '@/hooks/useOfflineStatus';
import { useAuth } from '@/context/AuthContext';
import {
  getPendingSalesByStatus,
  updatePendingSale,
  deletePendingSale,
} from '@/lib/offline/db';
import { preCacheShopInventory, cleanupCache } from '@/lib/offline/inventory-cache';
import { completeSale } from '@/lib/api/sales';
import type { PendingSale } from '@/types/pos.types';
import { toast } from 'sonner';

interface SyncContextType {
  pendingSales: PendingSale[];
  syncing: boolean;
  syncNow: () => Promise<void>;
  retryFailed: () => Promise<void>;
  refreshPendingSales: () => Promise<void>;
  getPendingCount: (shopId?: string) => number;
  getFailedCount: (shopId?: string) => number;
  // Inventory cache state
  inventoryCaching: boolean;
  inventoryCacheCount: number;
  lastInventoryCacheTime: string | null;
  refreshInventoryCache: () => Promise<void>;
}

const SyncContext = createContext<SyncContextType | undefined>(undefined);

const SYNC_INTERVAL = 30000; // 30 seconds
const MAX_RETRY_ATTEMPTS = 3;
const INVENTORY_CACHE_INTERVAL = 15 * 60 * 1000; // 15 minutes

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const [pendingSales, setPendingSales] = useState<PendingSale[]>([]);
  const [syncing, setSyncing] = useState(false);
  const { isOnline } = useOfflineStatus();
  const { profile } = useAuth();

  // Inventory cache state
  const [inventoryCaching, setInventoryCaching] = useState(false);
  const [inventoryCacheCount, setInventoryCacheCount] = useState(0);
  const [lastInventoryCacheTime, setLastInventoryCacheTime] = useState<string | null>(null);
  const inventoryCacheRunning = useRef(false);

  // Load pending sales from IndexedDB
  const loadPendingSales = useCallback(async () => {
    const sales = await getPendingSalesByStatus('pending');
    const failed = await getPendingSalesByStatus('failed');
    setPendingSales([...sales, ...failed]);
  }, []);

  // Sync a single sale
  const syncSale = async (sale: PendingSale): Promise<boolean> => {
    try {
      // Mark as syncing
      await updatePendingSale(sale.id, { status: 'syncing' });

      // Call the complete_sale Edge Function
      const result = await completeSale({
        client_sale_id: sale.id,
        items: sale.items.map(item => ({
          qr_code: item.qrCode,
          original_price: item.originalPrice,
          final_price: item.finalPrice,
          discount_reason: item.discountReason,
        })),
        payment_method: sale.paymentMethod,
        customer_name: sale.customerName,
        customer_phone: sale.customerPhone,
        occurred_at: sale.occurredAt,
      });

      // Success - delete from IndexedDB
      await deletePendingSale(sale.id);
      return true;
    } catch (error) {
      console.error('Failed to sync sale:', error);

      // Update retry count
      const retryCount = (sale.retryCount || 0) + 1;
      
      if (retryCount >= MAX_RETRY_ATTEMPTS) {
        // Max retries reached - mark as failed
        await updatePendingSale(sale.id, {
          status: 'failed',
          lastError: error instanceof Error ? error.message : 'Unknown error',
          retryCount,
        });
      } else {
        // Mark back as pending for next retry
        await updatePendingSale(sale.id, {
          status: 'pending',
          lastError: error instanceof Error ? error.message : 'Unknown error',
          retryCount,
        });
      }

      return false;
    }
  };

  // Sync all pending sales
  const syncNow = useCallback(async () => {
    if (!isOnline || syncing) return;

    setSyncing(true);
    let successCount = 0;
    let failCount = 0;

    try {
      const sales = await getPendingSalesByStatus('pending');

      for (const sale of sales) {
        const success = await syncSale(sale);
        if (success) {
          successCount++;
        } else {
          failCount++;
        }
      }

      // Reload pending sales
      await loadPendingSales();

      if (successCount > 0) {
        toast.success(`Synced ${successCount} sale(s) successfully`);
      }
      
      if (failCount > 0) {
        toast.error(`Failed to sync ${failCount} sale(s)`);
      }
    } catch (error) {
      console.error('Sync error:', error);
      toast.error('Sync failed. Will retry automatically.');
    } finally {
      setSyncing(false);
    }
  }, [isOnline, syncing, loadPendingSales]);

  // Retry failed sales
  const retryFailed = useCallback(async () => {
    if (!isOnline) {
      toast.error('Cannot retry while offline');
      return;
    }

    setSyncing(true);
    
    try {
      const failedSales = await getPendingSalesByStatus('failed');

      // Reset failed sales to pending
      for (const sale of failedSales) {
        await updatePendingSale(sale.id, {
          status: 'pending',
          retryCount: 0,
          lastError: undefined,
        });
      }

      // Trigger sync
      await syncNow();
    } catch (error) {
      console.error('Retry failed:', error);
      toast.error('Failed to retry syncing');
    } finally {
      setSyncing(false);
    }
  }, [isOnline, syncNow]);

  // Get pending and failed counts
  const getPendingCount = useCallback((shopId?: string) => {
    const filtered = shopId 
      ? pendingSales.filter(s => s.saleData?.shop_id === shopId)
      : pendingSales;
    return filtered.filter(s => s.status === 'pending' || s.status === 'syncing').length;
  }, [pendingSales]);

  const getFailedCount = useCallback((shopId?: string) => {
    const filtered = shopId 
      ? pendingSales.filter(s => s.saleData?.shop_id === shopId)
      : pendingSales;
    return filtered.filter(s => s.status === 'failed').length;
  }, [pendingSales]);

  // Auto-sync when coming online
  useEffect(() => {
    if (isOnline && pendingSales.length > 0) {
      syncNow();
    }
  }, [isOnline]); // Only trigger on online status change

  // Periodic sync when online
  useEffect(() => {
    if (!isOnline) return;

    const interval = setInterval(() => {
      if (pendingSales.length > 0) {
        syncNow();
      }
    }, SYNC_INTERVAL);

    return () => clearInterval(interval);
  }, [isOnline, pendingSales.length, syncNow]);

  // Load pending sales on mount
  useEffect(() => {
    loadPendingSales();
  }, [loadPendingSales]);

  // ── Inventory Pre-Caching ─────────────────────────────────────────
  const cacheInventory = useCallback(async (showToast = false) => {
    if (!profile?.shop_id || !isOnline || inventoryCacheRunning.current) return;
    inventoryCacheRunning.current = true;
    setInventoryCaching(true);

    try {
      const result = await preCacheShopInventory(profile.shop_id, (cached, total) => {
        setInventoryCacheCount(cached);
      });

      if (result.skipped) {
        // Cache is fresh enough, no need to update
        setInventoryCaching(false);
        inventoryCacheRunning.current = false;
        return;
      }

      setInventoryCacheCount(result.success);
      setLastInventoryCacheTime(new Date().toISOString());

      if (showToast && result.total > 0) {
        toast.success(`Cached ${result.success} item${result.success !== 1 ? 's' : ''} for offline use`);
      }

      // Cleanup expired entries
      await cleanupCache();
    } catch (error) {
      console.error('Inventory pre-cache failed:', error);
      // Non-critical — don't toast errors for background sync
    } finally {
      setInventoryCaching(false);
      inventoryCacheRunning.current = false;
    }
  }, [profile?.shop_id, isOnline]);

  // Pre-cache on first load when profile is available
  useEffect(() => {
    if (profile?.shop_id && isOnline) {
      // Small delay to let the main UI render first
      const timer = setTimeout(() => cacheInventory(true), 2000);
      return () => clearTimeout(timer);
    }
  }, [profile?.shop_id]); // Only on initial profile load

  // Periodic delta sync every 15 minutes
  useEffect(() => {
    if (!isOnline || !profile?.shop_id) return;

    const interval = setInterval(() => {
      cacheInventory(false); // Silent delta sync
    }, INVENTORY_CACHE_INTERVAL);

    return () => clearInterval(interval);
  }, [isOnline, profile?.shop_id, cacheInventory]);

  // Re-cache when coming back online
  useEffect(() => {
    if (isOnline && profile?.shop_id) {
      cacheInventory(false);
    }
  }, [isOnline]); // Only trigger on online status change

  const value: SyncContextType = {
    pendingSales,
    syncing,
    syncNow,
    retryFailed,
    refreshPendingSales: loadPendingSales,
    getPendingCount,
    getFailedCount,
    // Inventory cache
    inventoryCaching,
    inventoryCacheCount,
    lastInventoryCacheTime,
    refreshInventoryCache: () => cacheInventory(true),
  };

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

export function useSync() {
  const context = useContext(SyncContext);
  if (context === undefined) {
    throw new Error('useSync must be used within a SyncProvider');
  }
  return context;
}
