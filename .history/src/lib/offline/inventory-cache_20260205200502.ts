/**
 * Inventory Cache Service
 * 
 * Manages caching of inventory items for offline scanning.
 * Uses IndexedDB for persistent storage.
 */

import { 
  cacheInventoryItem, 
  getCachedInventoryItem, 
  clearOldInventoryCache 
} from './db';
import { OFFLINE_CONFIG } from './config';

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
      price: scanResult.lot.selling_price,
      category: scanResult.category?.name || 'Unknown',
      size: scanResult.size?.size_name || scanResult.lot.free_text_size || 'One Size',
      taxRate: scanResult.lot.tax_rate || 0,
      lastUpdated: new Date().toISOString(),
      lotSaleType: scanResult.lot.sale_type,
      lotMinMargin: scanResult.lot.min_margin_percent,
      lotCostPrice: scanResult.lot.cost_price,
      shopId: scanResult.lot.shop_id,
    };

    await cacheInventoryItem(cacheItem);
  } catch (error) {
    console.warn('Failed to cache inventory item:', error);
    // Non-critical - don't throw
  }
}

/**
 * Get a cached item for offline scanning
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
 * Pre-cache items for a specific shop (for future enhancement)
 * Can be called during initial app load or on a schedule
 */
export async function preCacheShopInventory(
  shopId: string, 
  items: CachedInventoryItem[]
): Promise<{ success: number; failed: number }> {
  let success = 0;
  let failed = 0;

  for (const item of items) {
    try {
      await cacheInventoryItem({ 
        qrCode: item.qrCode,
        itemId: item.itemId,
        lotId: item.lotId,
        price: item.price,
        category: item.category,
        size: item.size,
        taxRate: item.taxRate,
        lastUpdated: new Date().toISOString(),
      });
      success++;
    } catch {
      failed++;
    }
  }

  return { success, failed };
}
