/**
 * Inventory Cache Service
 * 
 * Manages caching of inventory items for offline scanning and search.
 * Uses IndexedDB for persistent storage.
 * 
 * Key features:
 * - Auto-cache items on scan (online → cache for offline fallback)
 * - Bulk pre-cache all available inventory on login/schedule
 * - Offline search across cached items (by QR code, category, size)
 * - TTL-based cache expiration
 */

import { 
  cacheInventoryItem, 
  getCachedInventoryItem, 
  getAllCachedInventoryItems,
  clearOldInventoryCache 
} from './db';
import { OFFLINE_CONFIG } from './config';
import { supabase } from '@/lib/supabase';
import { appConfig } from '@/lib/config/app.config';

export interface CachedInventoryItem {
  qrCode: string;
  itemId: string;
  lotId: string;
  price: number;
  category: string;
  size: string;
  taxRate: number;
  lastUpdated: string;
  // Extended fields for offline use
  lotSaleType?: string | null;
  lotMinMargin?: number | null;
  lotCostPrice?: number | null;
  shopId?: string;
}

// Track last full cache time to enable delta sync
const LAST_CACHE_KEY = appConfig.internal.inventoryCacheTimestampKey;

function getLastCacheTimestamp(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(LAST_CACHE_KEY);
}

function setLastCacheTimestamp(ts: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LAST_CACHE_KEY, ts);
}

/**
 * Cache an inventory item from a successful scan
 */
export async function cacheScannedItem(scanResult: {
  inventoryItem: any;
  qrCode: any;
  lot: any;
  category?: any;
  size?: any;
}): Promise<void> {
  if (!OFFLINE_CONFIG.FEATURES.AUTO_CACHE_ON_SCAN) return;

  try {
    const cacheItem: CachedInventoryItem = {
      qrCode: scanResult.qrCode.code,
      itemId: scanResult.inventoryItem.id,
      lotId: scanResult.lot.id,
      price: scanResult.inventoryItem.selling_price ?? scanResult.lot.selling_price_default,
      category: scanResult.category?.name || 'Unknown',
      size: scanResult.size?.size_name || scanResult.lot.free_text_size || 'One Size',
      taxRate: scanResult.inventoryItem.tax_rate ?? scanResult.lot.tax_rate ?? 0,
      lastUpdated: new Date().toISOString(),
      lotSaleType: scanResult.inventoryItem.sale_type ?? scanResult.lot.sale_type,
      lotMinMargin: scanResult.lot.min_margin_percent,
      lotCostPrice: scanResult.inventoryItem.cost_price ?? scanResult.lot.cost_price_per_unit,
      shopId: scanResult.lot.shop_id,
    };

    await cacheInventoryItem(cacheItem);
  } catch (error) {
    console.warn('Failed to cache inventory item:', error);
    // Non-critical - don't throw
  }
}

/**
 * Get a cached item for offline scanning (with TTL check)
 */
export async function getCachedItem(qrCode: string): Promise<CachedInventoryItem | null> {
  if (!OFFLINE_CONFIG.FEATURES.OFFLINE_SCANNING) return null;

  try {
    const cached = await getCachedInventoryItem(qrCode);
    if (!cached) return null;

    // Check if cache is still valid
    const cacheAge = Date.now() - new Date(cached.lastUpdated).getTime();
    const maxAge = OFFLINE_CONFIG.INVENTORY_CACHE_TTL_HOURS * 60 * 60 * 1000;
    
    if (cacheAge > maxAge) {
      return null; // Cache expired
    }

    return cached as CachedInventoryItem;
  } catch (error) {
    console.warn('Failed to get cached item:', error);
    return null;
  }
}

/**
 * Search cached inventory items offline.
 * Supports searching by QR code, category name, and size.
 * Returns items matching the query (case-insensitive).
 */
export async function searchCachedInventory(
  query: string,
  filters?: {
    category?: string;
    size?: string;
    minPrice?: number;
    maxPrice?: number;
  }
): Promise<CachedInventoryItem[]> {
  try {
    const allItems = await getAllCachedInventoryItems();
    const maxAge = OFFLINE_CONFIG.INVENTORY_CACHE_TTL_HOURS * 60 * 60 * 1000;
    const now = Date.now();
    const queryLower = query.toLowerCase().trim();

    return (allItems as CachedInventoryItem[]).filter(item => {
      // TTL check
      const cacheAge = now - new Date(item.lastUpdated).getTime();
      if (cacheAge > maxAge) return false;

      // Text search across QR code, category, size
      if (queryLower) {
        const matchesQR = item.qrCode.toLowerCase().includes(queryLower);
        const matchesCategory = item.category.toLowerCase().includes(queryLower);
        const matchesSize = item.size.toLowerCase().includes(queryLower);
        if (!matchesQR && !matchesCategory && !matchesSize) return false;
      }

      // Apply filters
      if (filters?.category && filters.category !== 'all') {
        if (item.category !== filters.category) return false;
      }
      if (filters?.size && filters.size !== 'all') {
        if (item.size !== filters.size) return false;
      }
      if (filters?.minPrice != null && !isNaN(filters.minPrice)) {
        if (item.price < filters.minPrice) return false;
      }
      if (filters?.maxPrice != null && !isNaN(filters.maxPrice)) {
        if (item.price > filters.maxPrice) return false;
      }

      return true;
    });
  } catch (error) {
    console.warn('Failed to search cached inventory:', error);
    return [];
  }
}

/**
 * Get all valid cached items (for filter option extraction, etc.)
 */
export async function getAllValidCachedItems(): Promise<CachedInventoryItem[]> {
  try {
    const allItems = await getAllCachedInventoryItems();
    const maxAge = OFFLINE_CONFIG.INVENTORY_CACHE_TTL_HOURS * 60 * 60 * 1000;
    const now = Date.now();

    return (allItems as CachedInventoryItem[]).filter(item => {
      const cacheAge = now - new Date(item.lastUpdated).getTime();
      return cacheAge <= maxAge;
    });
  } catch (error) {
    console.warn('Failed to get cached items:', error);
    return [];
  }
}

/**
 * Cleanup old cache entries
 */
export async function cleanupCache(): Promise<void> {
  try {
    await clearOldInventoryCache(OFFLINE_CONFIG.INVENTORY_CACHE_TTL_HOURS);
  } catch (error) {
    console.warn('Failed to cleanup cache:', error);
  }
}

/**
 * Fetch all available inventory from Supabase for caching.
 * Fetches all available items (no delta support since inventory_items lacks updated_at).
 * Returns items in CachedInventoryItem format ready for storage.
 */
export async function fetchInventoryForCache(
  shopId: string
): Promise<CachedInventoryItem[]> {
  const items: CachedInventoryItem[] = [];
  const PAGE_SIZE = 500;
  let from = 0;
  let hasMore = true;

  while (hasMore) {
    const query = supabase
      .from('inventory_items')
      .select(`
        id, status, selling_price, cost_price, tax_rate, sale_type,
        lot:lots!inner (
          id, selling_price_default, tax_rate, sale_type,
          min_margin_percent, cost_price_per_unit, shop_id,
          category:categories(name),
          size:sizes(size_name),
          free_text_size
        ),
        qr_code:qr_codes!inner(code)
      `)
      .eq('status', 'available')
      .eq('shop_id', shopId)
      .is('sold_at', null)
      .range(from, from + PAGE_SIZE - 1);

    const { data, error } = await query;

    if (error) {
      console.error('Failed to fetch inventory for cache:', error);
      throw new Error(`Cache fetch failed: ${error.message}`);
    }

    if (!data || data.length === 0) {
      hasMore = false;
      break;
    }

    for (const item of data) {
      const lot = item.lot as any;
      const qrCode = item.qr_code as any;

      if (!lot || !qrCode?.code) continue;

      items.push({
        qrCode: qrCode.code,
        itemId: item.id,
        lotId: lot.id,
        price: (item as any).selling_price ?? lot.selling_price_default ?? 0,
        category: lot.category?.name || 'Unknown',
        size: lot.size?.size_name || lot.free_text_size || 'One Size',
        taxRate: (item as any).tax_rate ?? lot.tax_rate ?? 0,
        lastUpdated: new Date().toISOString(),
        lotSaleType: (item as any).sale_type ?? lot.sale_type,
        lotMinMargin: lot.min_margin_percent,
        lotCostPrice: (item as any).cost_price ?? lot.cost_price_per_unit,
        shopId: lot.shop_id,
      });
    }

    if (data.length < PAGE_SIZE) {
      hasMore = false;
    } else {
      from += PAGE_SIZE;
    }
  }

  return items;
}

/**
 * Pre-cache all available inventory for a shop.
 * Fetches all available items and caches them in IndexedDB.
 * Uses a timestamp to avoid redundant re-caches within short intervals.
 * 
 * @param shopId - The shop ID to cache inventory for
 * @param onProgress - Optional callback for progress updates (cached, total)
 * @returns Summary of the cache operation
 */
export async function preCacheShopInventory(
  shopId: string,
  onProgress?: (cached: number, total: number) => void
): Promise<{ success: number; failed: number; total: number; skipped: boolean }> {
  const lastSync = getLastCacheTimestamp();
  
  // Skip if last sync was less than 5 minutes ago (avoid hammering the DB)
  if (lastSync) {
    const elapsed = Date.now() - new Date(lastSync).getTime();
    if (elapsed < 5 * 60 * 1000) {
      return { success: 0, failed: 0, total: 0, skipped: true };
    }
  }

  // Fetch items from Supabase
  const items = await fetchInventoryForCache(shopId);
  const total = items.length;

  let success = 0;
  let failed = 0;

  // Write to IndexedDB
  for (let i = 0; i < items.length; i++) {
    try {
      await cacheInventoryItem(items[i]);
      success++;
    } catch {
      failed++;
    }
    
    // Report progress every 50 items
    if (onProgress && (i + 1) % 50 === 0) {
      onProgress(i + 1, total);
    }
  }

  // Final progress callback
  if (onProgress && total > 0) {
    onProgress(total, total);
  }

  // Update last sync timestamp
  setLastCacheTimestamp(new Date().toISOString());

  return { success, failed, total, skipped: false };
}
