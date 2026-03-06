import { appConfig } from './config';

export const APP_NAME = appConfig.brand.fullName;
export const APP_VERSION = '1.0.0';

export const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'upi', label: 'UPI' },
  { value: 'card', label: 'Card' },
  { value: 'other', label: 'Other' },
] as const;

export const USER_ROLES = {
  SUPERADMIN: 'superadmin',
  OWNER: 'owner',
  ADMIN: 'admin',
  STAFF: 'staff',
} as const;

export const SYNC_RETRY_LIMIT = 3;
export const SYNC_RETRY_DELAY = 2000; // ms
export const SYNC_BATCH_SIZE = 5;

export const DEFAULT_MAX_DISCOUNT_PERCENT = 10;
export const DEFAULT_TAX_RATE = 0; // Can be set per shop

// IndexedDB constants
export const IDB_NAME = 'womaniya_db';
export const IDB_VERSION = 1;
export const IDB_STORES = {
  PENDING_SALES: 'pending_sales',
  CACHED_INVENTORY: 'cached_inventory',
} as const;
