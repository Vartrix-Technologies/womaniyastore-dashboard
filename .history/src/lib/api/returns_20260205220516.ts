// API functions for sale returns operations
import { supabase } from '@/lib/supabase';
import type { SaleReturn } from '@/types';

export interface ReturnedItem {
  sale_item_id: string;
  inventory_item_id: string;
  qr_code: string;
  original_price: number;
  final_price: number;
  category?: string;
  size?: string;
}

export interface CreateReturnRequest {
  original_sale_id: string;
  returned_items: ReturnedItem[];
  return_reason: string;
  refund_amount: number;
  shop_id: string;
  processed_by: string;
}

export interface ReturnWithDetails extends SaleReturn {
  original_sale?: {
    id: string;
    bill_number: number;
    bill_prefix?: string;
    customer_name?: string;
    customer_phone?: string;
    total_amount: number;
    created_at: string;
  };
  processed_by_profile?: {
    id: string;
    full_name: string;
  };
}

/**
 * Fetch sale returns with optional filters
 */
export async function fetchReturns(filters?: {
  shop_id?: string;
  from_date?: string;
  to_date?: string;
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<{ data: ReturnWithDetails[]; count: number }> {
  let query = supabase
    .from('sale_returns')
    .select(`
      *,
      original_sale:sales!sale_returns_original_sale_id_fkey (
        id,
        bill_number,
        bill_prefix,
        customer_name,
        customer_phone,
        total_amount,
        created_at
      ),
      processed_by_profile:profiles!sale_returns_processed_by_fkey (
        id,
        full_name
      )
    `, { count: 'exact' });

  if (filters?.shop_id) {
    query = query.eq('shop_id', filters.shop_id);
  }

  if (filters?.from_date) {
    query = query.gte('created_at', filters.from_date);
  }

  if (filters?.to_date) {
    query = query.lte('created_at', filters.to_date);
  }

  // Order by most recent first
  query = query.order('created_at', { ascending: false });

  if (filters?.limit) {
    query = query.limit(filters.limit);
  }

  if (filters?.offset) {
    query = query.range(filters.offset, filters.offset + (filters.limit || 10) - 1);
  }

  const { data, error, count } = await query;

  if (error) {
    console.error('Error fetching returns:', error);
    throw new Error(error.message);
  }

  return { data: (data || []) as unknown as ReturnWithDetails[], count: count || 0 };
}

/**
 * Get a single return by ID with full details
 */
export async function getReturnById(returnId: string): Promise<ReturnWithDetails | null> {
  const { data, error } = await supabase
    .from('sale_returns')
    .select(`
      *,
      original_sale:sales!sale_returns_original_sale_id_fkey (
        id,
        bill_number,
        bill_prefix,
        customer_name,
        customer_phone,
        total_amount,
        created_at
      ),
      processed_by_profile:profiles!sale_returns_processed_by_fkey (
        id,
        full_name
      )
    `)
    .eq('id', returnId)
    .single();

  if (error) {
    console.error('Error fetching return:', error);
    throw new Error(error.message);
  }

  return data as unknown as ReturnWithDetails;
}

/**
 * Get a sale with its items for return processing
 */
export async function getSaleForReturn(saleId: string) {
  const { data, error } = await supabase
    .from('sales')
    .select(`
      id,
      bill_number,
      bill_prefix,
      customer_name,
      customer_phone,
      total_amount,
      created_at,
      shop_id,
      sale_items (
        id,
        inventory_item_id,
        original_price,
        final_price,
        discount_reason,
        inventory_items!sale_items_inventory_item_id_fkey (
          id,
          status,
          qr_codes (
            code
          ),
          lots (
            categories (
              name
            ),
            sizes (
              size_name
            ),
            free_text_size
          )
        )
      )
    `)
    .eq('id', saleId)
    .single();

  if (error) {
    console.error('Error fetching sale for return:', error);
    throw new Error(error.message);
  }

  return data;
}

/**
 * Find a sale by bill number for return processing
 */
export async function findSaleByBillNumber(billNumber: string, shopId: string) {
  // Try exact match first (just the number)
  const numericBill = parseInt(billNumber, 10);
  
  let query = supabase
    .from('sales')
    .select(`
      id,
      bill_number,
      bill_prefix,
      customer_name,
      customer_phone,
      total_amount,
      created_at,
      shop_id,
      sale_items (
        id,
        inventory_item_id,
        original_price,
        final_price,
        discount_reason,
        inventory_items!sale_items_inventory_item_id_fkey (
          id,
          status,
          qr_codes (
            code
          ),
          lots (
            categories (
              name
            ),
            sizes (
              size_name
            ),
            free_text_size
          )
        )
      )
    `)
    .eq('shop_id', shopId);

  if (!isNaN(numericBill)) {
    query = query.eq('bill_number', numericBill);
  }

  const { data, error } = await query.limit(10);

  if (error) {
    console.error('Error finding sale:', error);
    throw new Error(error.message);
  }

  return data || [];
}

/**
 * Check if any items from a sale have already been returned
 */
export async function getExistingReturnsForSale(saleId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('sale_returns')
    .select('returned_items')
    .eq('original_sale_id', saleId);

  if (error) {
    console.error('Error checking existing returns:', error);
    throw new Error(error.message);
  }

  // Extract all inventory_item_ids that have been returned
  const returnedItemIds: string[] = [];
  data?.forEach((returnRecord) => {
    const items = returnRecord.returned_items as ReturnedItem[];
    if (Array.isArray(items)) {
      items.forEach((item) => {
        if (item.inventory_item_id) {
          returnedItemIds.push(item.inventory_item_id);
        }
      });
    }
  });

  return returnedItemIds;
}

/**
 * Create a new return record and update inventory status
 */
export async function createReturn(request: CreateReturnRequest): Promise<SaleReturn> {
  // Start transaction: Create return record and update inventory items
  
  // 1. Create the return record
  const { data: returnData, error: returnError } = await supabase
    .from('sale_returns')
    .insert({
      original_sale_id: request.original_sale_id,
      returned_items: request.returned_items,
      return_reason: request.return_reason,
      refund_amount: request.refund_amount,
      shop_id: request.shop_id,
      processed_by: request.processed_by,
    })
    .select()
    .single();

  if (returnError) {
    console.error('Error creating return:', returnError);
    throw new Error(returnError.message);
  }

  // 2. Update inventory items status back to 'available' or 'returned'
  const inventoryItemIds = request.returned_items.map((item) => item.inventory_item_id);
  
  const { error: inventoryError } = await supabase
    .from('inventory_items')
    .update({ status: 'available' })
    .in('id', inventoryItemIds);

  if (inventoryError) {
    console.error('Error updating inventory status:', inventoryError);
    // Note: Return was created, but inventory update failed
    // In production, consider using database transactions
    throw new Error('Return created but failed to update inventory: ' + inventoryError.message);
  }

  return returnData as SaleReturn;
}

/**
 * Get return statistics for a shop
 */
export async function getReturnStats(shopId: string, fromDate?: string) {
  let query = supabase
    .from('sale_returns')
    .select('refund_amount, returned_items, created_at')
    .eq('shop_id', shopId);

  if (fromDate) {
    query = query.gte('created_at', fromDate);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching return stats:', error);
    throw new Error(error.message);
  }

  const totalReturns = data?.length || 0;
  const totalRefundAmount = data?.reduce((sum, r) => sum + (r.refund_amount || 0), 0) || 0;
  const totalItemsReturned = data?.reduce((sum, r) => {
    const items = r.returned_items as ReturnedItem[];
    return sum + (Array.isArray(items) ? items.length : 0);
  }, 0) || 0;

  return {
    totalReturns,
    totalRefundAmount,
    totalItemsReturned,
    averageRefund: totalReturns > 0 ? totalRefundAmount / totalReturns : 0,
  };
}
