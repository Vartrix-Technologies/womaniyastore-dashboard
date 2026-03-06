// API functions for inventory operations
import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database.types';

type InventoryStatus = Database['public']['Enums']['inventory_status'];

export interface AddStockLotRequest {
  category_id?: string;
  size_id?: string;
  free_text_size?: string;
  vendor_name?: string;
  date_of_stock_arrival: string;
  cost_price_per_unit: number;
  selling_price_default: number;
  tax_rate?: number;
  quantity: number;
}

export interface AddStockLotResponse {
  lot: {
    id: string;
    quantity: number;
  };
  items: Array<{
    inventory_item_id: string;
    qr_code: string;
  }>;
}

/**
 * Add a new stock lot via Supabase Edge Function
 * This automatically assigns QR codes to inventory items
 */
export async function addStockLot(
  request: AddStockLotRequest
): Promise<AddStockLotResponse> {
  try {
    const { data, error } = await supabase.functions.invoke('add-stock-lot', {
      body: request,
    });

    if (error) {
      console.error('Add stock lot error:', error);
      throw {
        error: error.message || 'Failed to add stock lot',
        code: 'EDGE_FUNCTION_ERROR',
        details: error,
      };
    }

    if (data?.error) {
      console.error('Add stock lot business error:', data);
      throw {
        error: data.error,
        code: data.code || 'BUSINESS_ERROR',
        details: data.details,
      };
    }

    return data as AddStockLotResponse;
  } catch (err: any) {
    console.error('Add stock lot exception:', err);
    throw err;
  }
}

/**
 * Fetch available inventory items
 */
export async function fetchAvailableInventory(filters?: {
  category_id?: string;
  status?: InventoryStatus;
  limit?: number;
}) {
  let query = supabase
    .from('inventory_items')
    .select(`
      *,
      lot:lots (
        *,
        category:categories(*),
        size:sizes(*)
      ),
      qr_code:qr_codes(*)
    `)
    .order('created_at', { ascending: false });

  if (filters?.status) {
    query = query.eq('status', filters.status);
  } else {
    query = query.eq('status', 'available');
  }

  if (filters?.category_id) {
    query = query.eq('lots.category_id', filters.category_id);
  }

  if (filters?.limit) {
    query = query.limit(filters.limit);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Fetch inventory error:', error);
    throw new Error(error.message);
  }

  return data;
}

/**
 * Search inventory by QR code
 */
export async function searchInventoryByQRCode(qrCode: string) {
  // Normalize QR code to uppercase for consistent searching
  const normalizedCode = qrCode.toUpperCase();
  
  const { data: qrData, error: qrError } = await supabase
    .from('qr_codes')
    .select('*')
    .ilike('code', normalizedCode)
    .single();

  if (qrError || !qrData) {
    console.error('QR code not found:', qrError);
    throw new Error(`QR code "${qrCode}" does not exist in the system`);
  }

  if (qrData.status === 'unused') {
    throw new Error(`QR code "${qrCode}" is not assigned to any product yet. Please add inventory first.`);
  }

  const { data, error } = await supabase
    .from('inventory_items')
    .select(`
      *,
      lot:lots (
        *,
        category:categories(*),
        size:sizes(*)
      ),
      qr_code:qr_codes(*)
    `)
    .eq('qr_code_id', qrData.id)
    .single();

  if (error || !data) {
    console.error('Inventory item not found:', error);
    throw new Error(`No inventory item found for QR code "${qrCode}"`);
  }

  // Check if item is already sold
  if (data.sold_at || data.sale_item_id) {
    const soldDate = data.sold_at ? new Date(data.sold_at).toLocaleDateString() : 'unknown date';
    throw new Error(`This item was already sold on ${soldDate}`);
  }

  return data;
}

/**
 * Adjust inventory item status (damage, loss, etc.)
 */
export async function adjustInventoryStatus(
  inventoryItemId: string,
  newStatus: string,
  reason: string
) {
  const { data, error } = await supabase.functions.invoke('adjust-inventory', {
    body: {
      inventory_item_id: inventoryItemId,
      new_status: newStatus,
      reason,
    },
  });

  if (error) {
    console.error('Adjust inventory error:', error);
    throw new Error(error.message || 'Failed to adjust inventory');
  }

  return data;
}

/**
 * Fetch categories
 */
export async function fetchCategories() {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('name');

  if (error) {
    console.error('Fetch categories error:', error);
    throw new Error(error.message);
  }

  return data;
}

/**
 * Fetch sizes
 */
export async function fetchSizes() {
  const { data, error } = await supabase
    .from('sizes')
    .select('*')
    .order('name');

  if (error) {
    console.error('Fetch sizes error:', error);
    throw new Error(error.message);
  }

  return data;
}
