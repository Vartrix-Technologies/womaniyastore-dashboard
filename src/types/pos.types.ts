// Offline & POS Types

export interface PendingSale {
  id: string; // client_sale_id
  createdAt: string;
  items: Array<{
    qrCode: string;
    originalPrice: number;
    finalPrice: number;
    discountReason?: string;
    soldOnSale?: boolean; // was this a sale item
    saleType?: string; // 'festival' | 'clearance' | 'promotion'
    isManualEntry?: boolean; // Quick Sale item
    categoryName?: string; // for manual items
    sizeName?: string; // for manual items
    taxRate?: number; // for manual items
    manualNote?: string; // for manual items
  }>;
  paymentMethod: string;
  customerName?: string;
  customerPhone?: string;
  status: 'pending' | 'syncing' | 'synced' | 'failed';
  lastError?: string;
  occurredAt: string;
  retryCount?: number;
  saleData?: { shop_id?: string; [key: string]: unknown };
}

export interface CartItem {
  id: string;
  qrCode: string;
  inventoryItemId: string;
  category: string;
  size: string;
  originalPrice: number;
  finalPrice: number;
  taxRate: number;
  discountReason?: string;
  lotId: string;
  // Sale information from lot
  lotSaleType?: string | null; // 'festival' | 'promotion' from lot
  lotMinMargin?: number | null; // min margin % from lot
  lotSaleReason?: string | null; // sale description from lot
  lotCostPrice?: number; // cost price for margin validation
  // Sale selection at checkout (ground truth)
  soldOnSale?: boolean; // final decision: is this a sale item
  saleType?: string; // final sale type: 'festival' | 'clearance' | 'promotion'
  // Manual entry (Quick Sale) — item not in inventory
  isManualEntry?: boolean;
  manualNote?: string; // optional note for manual items
}

export interface ScanResult {
  success: boolean;
  data?: {
    inventoryItem: any;
    qrCode: any;
    lot: any;
    category?: any;
    size?: any;
  };
  error?: string;
  errorCode?: 'ITEM_NOT_FOUND' | 'ITEM_ALREADY_SOLD' | 'ITEM_NOT_AVAILABLE' | 'QR_INVALID';
}
