// IndexedDB wrapper for offline storage
import { openDB, DBSchema, IDBPDatabase } from 'idb';
import type { PendingSale } from '@/types/pos.types';
import { appConfig } from '@/lib/config';

interface FailedSale {
  id?: number;
  clientSaleId: string;
  data: any;
  error: string;
  timestamp: number;
  retryCount: number;
}

interface WomaniyaDB extends DBSchema {
  pendingSales: {
    key: string;
    value: PendingSale;
    indexes: { 'by-status': string; 'by-created': string };
  };
  inventoryCache: {
    key: string;
    value: {
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
    };
  };
  failedSales: {
    key: number;
    value: FailedSale;
    indexes: { 'by-timestamp': number };
  };
}

const DB_NAME = appConfig.internal.idbName;
const DB_VERSION = 3;

let dbInstance: IDBPDatabase<WomaniyaDB> | null = null;

/**
 * Initialize and open the IndexedDB database
 */
export async function getDB(): Promise<IDBPDatabase<WomaniyaDB>> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB<WomaniyaDB>(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion, newVersion, transaction) {
      // Pending sales store
      if (!db.objectStoreNames.contains('pendingSales')) {
        const pendingSalesStore = db.createObjectStore('pendingSales', {
          keyPath: 'id',
        });
        pendingSalesStore.createIndex('by-status', 'status');
        pendingSalesStore.createIndex('by-created', 'createdAt');
      }

      // Inventory cache store
      if (!db.objectStoreNames.contains('inventoryCache')) {
        db.createObjectStore('inventoryCache', {
          keyPath: 'qrCode',
        });
      }

      // Failed sales store
      if (!db.objectStoreNames.contains('failedSales')) {
        const failedSalesStore = db.createObjectStore('failedSales', {
          keyPath: 'id',
          autoIncrement: true,
        });
        failedSalesStore.createIndex('by-timestamp', 'timestamp');
      }
    },
  });

  return dbInstance;
}

/**
 * Add a pending sale to IndexedDB
 */
export async function addPendingSale(sale: PendingSale): Promise<void> {
  const db = await getDB();
  await db.put('pendingSales', sale);
}

/**
 * Get all pending sales
 */
export async function getPendingSales(): Promise<PendingSale[]> {
  const db = await getDB();
  return await db.getAll('pendingSales');
}

/**
 * Get pending sales by status
 */
export async function getPendingSalesByStatus(
  status: PendingSale['status']
): Promise<PendingSale[]> {
  const db = await getDB();
  return await db.getAllFromIndex('pendingSales', 'by-status', status);
}

/**
 * Update a pending sale
 */
export async function updatePendingSale(
  id: string,
  updates: Partial<PendingSale>
): Promise<void> {
  const db = await getDB();
  const sale = await db.get('pendingSales', id);
  if (!sale) throw new Error(`Pending sale ${id} not found`);
  
  await db.put('pendingSales', { ...sale, ...updates });
}

/**
 * Delete a pending sale
 */
export async function deletePendingSale(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('pendingSales', id);
}

/**
 * Cache inventory item for offline use
 */
export async function cacheInventoryItem(item: WomaniyaDB['inventoryCache']['value']): Promise<void> {
  const db = await getDB();
  await db.put('inventoryCache', { ...item, lastUpdated: new Date().toISOString() });
}

/**
 * Get cached inventory item by QR code
 */
export async function getCachedInventoryItem(
  qrCode: string
): Promise<WomaniyaDB['inventoryCache']['value'] | undefined> {
  const db = await getDB();
  return await db.get('inventoryCache', qrCode);
}

/**
 * Get all cached inventory items (for offline search)
 */
export async function getAllCachedInventoryItems(): Promise<WomaniyaDB['inventoryCache']['value'][]> {
  const db = await getDB();
  return await db.getAll('inventoryCache');
}

/**
 * Clear old inventory cache (older than specified hours)
 */
export async function clearOldInventoryCache(hoursOld: number = 24): Promise<void> {
  const db = await getDB();
  const cutoffDate = new Date();
  cutoffDate.setHours(cutoffDate.getHours() - hoursOld);
  
  const allItems = await db.getAll('inventoryCache');
  const tx = db.transaction('inventoryCache', 'readwrite');
  
  for (const item of allItems) {
    if (new Date(item.lastUpdated) < cutoffDate) {
      await tx.store.delete(item.qrCode);
    }
  }
  
  await tx.done;
}

/**
 * Clear all data (use with caution!)
 */
export async function clearAllData(): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(['pendingSales', 'inventoryCache', 'failedSales'], 'readwrite');
  await Promise.all([
    tx.objectStore('pendingSales').clear(),
    tx.objectStore('inventoryCache').clear(),
    tx.objectStore('failedSales').clear(),
  ]);
  await tx.done;
}

/**
 * Failed Sales Management
 */
export async function getFailedSales(): Promise<FailedSale[]> {
  const db = await getDB();
  return await db.getAll('failedSales');
}

export async function addFailedSale(sale: Omit<FailedSale, 'id'>): Promise<number> {
  const db = await getDB();
  return await db.add('failedSales', sale as FailedSale);
}

export async function removeFailedSale(id: number): Promise<void> {
  const db = await getDB();
  await db.delete('failedSales', id);
}

export async function updateFailedSale(id: number, updates: Partial<FailedSale>): Promise<void> {
  const db = await getDB();
  const sale = await db.get('failedSales', id);
  if (sale) {
    await db.put('failedSales', { ...sale, ...updates });
  }
}

// Export singleton instance for direct usage
export const db = {
  getFailedSales,
  addFailedSale,
  removeFailedSale,
  updateFailedSale,
  clearAllData,
};
