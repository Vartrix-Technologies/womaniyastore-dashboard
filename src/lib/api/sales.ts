// API functions for sales operations
import { supabase } from '@/lib/supabase';

export interface CompleteSaleRequest {
  client_sale_id?: string;
  items: Array<{
    qr_code: string;
    original_price: number;
    final_price: number;
    discount_reason?: string;
    sold_on_sale?: boolean;
    sale_type?: string;
    // Manual entry (Quick Sale) fields
    is_manual?: boolean;
    category_name?: string;
    size_name?: string;
    tax_rate?: number;
    manual_note?: string;
  }>;
  payment_method: string;
  customer_name?: string;
  customer_phone?: string;
  occurred_at?: string;
}

export interface CompleteSaleResponse {
  sale: {
    id: string;
    bill_number: number;
    bill_prefix: string;
    total_amount: number;
    created_at: string;
  };
  items: Array<{
    qr_code: string;
    inventory_item_id: string;
    original_price: number;
    final_price: number;
  }>;
}

export interface CompleteSaleError {
  error: string;
  code?: string;
  details?: any;
}

/**
 * Thrown when the server responded with an error (non-2xx).
 * This means the request REACHED the server — never save offline.
 */
export class SaleApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SaleApiError';
  }
}

/**
 * Complete a sale via Supabase Edge Function
 * This handles both online and offline sync scenarios with idempotency
 */
export async function completeSale(
  request: CompleteSaleRequest
): Promise<CompleteSaleResponse> {
  const { data, error } = await supabase.functions.invoke('complete-sale', {
    body: request,
  });

  if (error) {
    console.error('Complete sale error:', error);

    // If data contains a server error message, use it
    if (data?.error) {
      const errorMsg = data.error;
      console.error('Sale error details:', { code: data.code, message: errorMsg, details: data.details });
      throw new SaleApiError(errorMsg);
    }

    // Only treat as network failure if the device is genuinely offline
    // or the error is a fetch-level failure (request never reached server)
    const isFetchError = error.name === 'FunctionsFetchError' || error instanceof TypeError;
    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;

    if (isFetchError || isOffline) {
      throw new Error(error.message || 'Network error — failed to reach server');
    }

    // Everything else = server saw the request but something went wrong
    // NEVER save offline — throw SaleApiError
    throw new SaleApiError(error.message || 'Something went wrong. Please try again later.');
  }

  if (data.error) {
    console.error('Complete sale business error:', data);
    throw new SaleApiError(data.error);
  }

  return data as CompleteSaleResponse;
}

/**
 * Fetch sales history with optional filters
 */
export async function fetchSales(filters?: {
  shop_id?: string;
  from_date?: string;
  to_date?: string;
  limit?: number;
  offset?: number;
}) {
  let query = supabase
    .from('sales')
    .select(`
      *,
      sale_items (
        id,
        sale_id,
        inventory_item_id,
        original_price,
        final_price,
        discount_reason,
        tax_amount,
        inventory_items!sale_items_inventory_item_id_fkey (
          id,
          qr_code_id,
          lot_id,
          status,
          lots (
            id,
            selling_price_default,
            cost_price_per_unit,
            categories(id, name),
            sizes(id, size_name)
          ),
          qr_codes(id, code)
        )
      ),
      profiles!sales_created_by_fkey(id, full_name)
    `)
    .order('created_at', { ascending: false });

  if (filters?.shop_id) {
    query = query.eq('shop_id', filters.shop_id);
  }

  if (filters?.from_date) {
    query = query.gte('created_at', filters.from_date);
  }

  if (filters?.to_date) {
    query = query.lte('created_at', filters.to_date);
  }

  if (filters?.limit) {
    query = query.limit(filters.limit);
  }

  if (filters?.offset) {
    query = query.range(
      filters.offset,
      filters.offset + (filters.limit || 50) - 1
    );
  }

  const { data, error } = await query;

  if (error) {
    console.error('Fetch sales error:', error);
    throw new Error(error.message);
  }

  return data;
}

/**
 * Fetch a single sale by ID
 */
export async function fetchSaleById(saleId: string) {
  const { data, error } = await supabase
    .from('sales')
    .select(`
      *,
      sale_items (
        *,
        inventory_item:inventory_items (
          *,
          lot:lots (
            *,
            category:categories(*),
            size:sizes(*)
          ),
          qr_code:qr_codes(*)
        )
      ),
      created_by_profile:profiles!sales_created_by_fkey(*)
    `)
    .eq('id', saleId)
    .single();

  if (error) {
    console.error('Fetch sale error:', error);
    throw new Error(error.message);
  }

  return data;
}

export interface SalesStatsFilters {
  shopId: string;
  startDate?: string;
  searchTerm?: string;
  saleTypeFilter?: string;
}

export interface SalesStats {
  totalSales: number;
  totalRevenue: number;
  totalDiscount: number;
  avgSale: number;
}

/**
 * Fetch sales statistics with proper filtering
 * This queries the FULL dataset (not paginated) to get accurate stats
 */
export async function getSalesStats(filters: SalesStatsFilters): Promise<SalesStats> {
  const { shopId, startDate, searchTerm, saleTypeFilter } = filters;

  let query = supabase
    .from('sales')
    .select('id, total_amount, total_discount, sale_items(sold_on_sale, sale_type)')
    .eq('shop_id', shopId);

  // Apply date filter
  if (startDate) {
    query = query.gte('created_at', startDate);
  }

  // Apply search filter (customer name, phone, or bill number)
  if (searchTerm) {
    const searchLower = searchTerm.toLowerCase().trim();
    const isNumericSearch = /^\d+$/.test(searchLower);
    
    if (isNumericSearch && searchLower.length >= 4) {
      // For numeric searches (min 4 digits), search bill_number prefix OR name/phone
      const paddedMin = searchLower.padEnd(14, '0');
      const paddedMax = searchLower.padEnd(14, '9');
      query = query.or(
        `customer_name.ilike.%${searchLower}%,customer_phone.ilike.%${searchLower}%,and(bill_number.gte.${paddedMin},bill_number.lte.${paddedMax})`
      );
    } else {
      query = query.or(`customer_name.ilike.%${searchLower}%,customer_phone.ilike.%${searchLower}%`);
    }
  }

  const { data, error } = await query;

  if (error) {
    console.error('Fetch sales stats error:', error);
    throw new Error(error.message);
  }

  if (!data || data.length === 0) {
    return { totalSales: 0, totalRevenue: 0, totalDiscount: 0, avgSale: 0 };
  }

  // Apply sale type filter client-side (required for items filtering)
  let filteredData = data;
  if (saleTypeFilter && saleTypeFilter !== 'all') {
    filteredData = data.filter((sale: any) => {
      const items = sale.sale_items || [];
      if (saleTypeFilter === 'regular') {
        return items.every((item: any) => !item.sold_on_sale);
      } else if (saleTypeFilter === 'mixed') {
        const hasSaleItems = items.some((item: any) => item.sold_on_sale);
        const hasRegularItems = items.some((item: any) => !item.sold_on_sale);
        return hasSaleItems && hasRegularItems;
      } else {
        return items.some((item: any) => item.sold_on_sale && item.sale_type === saleTypeFilter);
      }
    });
  }

  const totalRevenue = filteredData.reduce((sum: number, s: any) => sum + (s.total_amount || 0), 0);
  const totalDiscount = filteredData.reduce((sum: number, s: any) => sum + (s.total_discount || 0), 0);

  return {
    totalSales: filteredData.length,
    totalRevenue,
    totalDiscount,
    avgSale: filteredData.length > 0 ? totalRevenue / filteredData.length : 0,
  };
}
