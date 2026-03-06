// API functions for QR Prefix operations
import { supabase } from '@/lib/supabase';
import type { QrPrefix } from '@/types';

export interface QrPrefixStats {
  total: number;
  unused: number;
  assigned: number;
  sold: number;
  lost: number;
}

/**
 * Fetch all QR prefixes for current shop
 */
export async function fetchQrPrefixes(shopId: string) {
  const { data, error } = await supabase
    .from('qr_prefixes')
    .select('*')
    .eq('shop_id', shopId)
    .order('display_order', { ascending: true });

  if (error) throw error;
  return data as QrPrefix[];
}

/**
 * Fetch active QR prefixes (for dropdowns)
 */
export async function fetchActiveQrPrefixes(shopId: string) {
  const { data, error } = await supabase
    .from('qr_prefixes')
    .select('*')
    .eq('shop_id', shopId)
    .eq('is_active', true)
    .order('display_order', { ascending: true });

  if (error) throw error;
  return data as QrPrefix[];
}

/**
 * Create a new QR prefix
 */
export async function createQrPrefix(prefix: {
  shop_id: string;
  prefix: string;
  description?: string;
  display_order?: number;
}) {
  const { data, error } = await supabase
    .from('qr_prefixes')
    .insert({
      ...prefix,
      is_active: true,
    })
    .select()
    .single();

  if (error) throw error;
  return data as QrPrefix;
}

/**
 * Update an existing QR prefix
 */
export async function updateQrPrefix(id: string, updates: {
  prefix?: string;
  description?: string;
  is_active?: boolean;
  display_order?: number;
}) {
  const { data, error } = await supabase
    .from('qr_prefixes')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as QrPrefix;
}

/**
 * Delete a QR prefix (will fail if QR codes are assigned)
 */
export async function deleteQrPrefix(id: string) {
  const { error } = await supabase
    .from('qr_prefixes')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

/**
 * Get statistics for a QR prefix
 */
export async function getQrPrefixStats(shopId: string, prefixId: string): Promise<QrPrefixStats> {
  // Query counts directly since DB function types aren't regenerated yet
  const { data, error } = await supabase
    .from('qr_codes')
    .select('status')
    .eq('shop_id', shopId)
    .eq('prefix_id', prefixId);

  if (error) throw error;

  const stats: QrPrefixStats = {
    total: data?.length || 0,
    unused: data?.filter(qr => qr.status === 'unused').length || 0,
    assigned: data?.filter(qr => qr.status === 'assigned').length || 0,
    sold: data?.filter(qr => qr.status === 'sold').length || 0,
    lost: data?.filter(qr => qr.status === 'lost').length || 0,
  };

  return stats;
}

/**
 * Generate QR codes with a specific prefix
 * Note: This calls the database function. If types aren't regenerated, it will show TS error but work at runtime.
 */
export async function generateQrCodesWithPrefix(
  shopId: string,
  prefixId: string,
  quantity: number
): Promise<Array<{ id: string; code: string }>> {
  // Use the Edge Function invoke instead to avoid type issues
  const { data, error } = await supabase.functions.invoke('generate-qr-codes', {
    body: {
      shop_id: shopId,
      prefix_id: prefixId,
      quantity: quantity,
    },
  });

  if (error) throw error;
  return data;
}

/**
 * Get count of unused QR codes for a prefix
 */
export async function getUnusedQrCodeCount(shopId: string, prefixId: string): Promise<number> {
  const { count, error } = await supabase
    .from('qr_codes')
    .select('*', { count: 'exact', head: true })
    .eq('shop_id', shopId)
    .eq('prefix_id', prefixId)
    .eq('status', 'unused');

  if (error) throw error;
  return count || 0;
}
