// Complete Sale Edge Function
// Handles both online and offline sale completion with idempotency

// @ts-ignore: Deno types
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { corsHeaders } from '../_shared/cors.ts'

interface SaleItem {
  qr_code: string
  original_price: number
  final_price: number
  discount_reason?: string
  sold_on_sale?: boolean // NEW: was this a sale item
  sale_type?: string // NEW: 'festival' | 'clearance' | 'promotion'
}

interface CompleteSaleRequest {
  client_sale_id: string
  items: SaleItem[]
  payment_method: string
  customer_name?: string
  customer_phone?: string
  occurred_at: string
}

interface ErrorResponse {
  error: string
  code?: string
  details?: any
}

// @ts-ignore: Deno global
Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client with service role for auth verification
    const authHeader = req.headers.get('Authorization')!
    
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseAdmin = createClient(
      // @ts-ignore: Deno global
      Deno.env.get('SUPABASE_URL') ?? '',
      // @ts-ignore: Deno global
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    // Verify JWT and get user
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized', details: authError?.message }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Use service role client for database operations (bypasses RLS)
    const supabase = supabaseAdmin

    // Old auth check - removed
    if (false) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse request body
    const body: CompleteSaleRequest = await req.json()
    const { client_sale_id, items, payment_method, customer_name, customer_phone, occurred_at } = body

    // Validate request
    if (!client_sale_id || !items || items.length === 0 || !payment_method || !occurred_at) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields', code: 'VALIDATION_ERROR' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get user profile and shop_id
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, shop_id, role, max_discount_percent')
      .eq('id', user.id)
      .single()

    if (profileError || !profile || !profile.shop_id) {
      return new Response(
        JSON.stringify({ error: 'Profile not found or not assigned to a shop', code: 'PROFILE_ERROR' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get shop details for bill_prefix
    const { data: shop, error: shopError } = await supabase
      .from('shops')
      .select('bill_prefix')
      .eq('id', profile.shop_id)
      .single()

    if (shopError || !shop) {
      return new Response(
        JSON.stringify({ error: 'Shop not found', code: 'SHOP_ERROR' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check user role (staff, admin, or owner)
    if (!['staff', 'admin', 'owner', 'superadmin'].includes(profile.role)) {
      return new Response(
        JSON.stringify({ error: 'Insufficient permissions', code: 'PERMISSION_DENIED' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check for idempotency - if sale already exists with this client_sale_id, return it
    const { data: existingSale, error: existingSaleError } = await supabase
      .from('sales')
      .select(`
        id,
        bill_number,
        total_amount,
        sale_items (
          id,
          inventory_item_id,
          original_price,
          final_price,
          inventory_items (
            qr_code_id,
            qr_codes (code)
          )
        )
      `)
      .eq('client_sale_id', client_sale_id)
      .single()

    if (existingSale) {
      console.log(`Sale with client_sale_id ${client_sale_id} already exists, returning existing sale`)
      return new Response(
        JSON.stringify({
          sale: {
            id: existingSale.id,
            bill_number: existingSale.bill_number,
            bill_prefix: shop.bill_prefix,
            total_amount: existingSale.total_amount,
          },
          items: existingSale.sale_items.map((si: any) => ({
            qr_code: si.inventory_items.qr_codes.code,
            inventory_item_id: si.inventory_item_id,
            original_price: si.original_price,
            final_price: si.final_price,
          })),
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate discounts against user's max_discount_percent
    for (const item of items) {
      const discountAmount = item.original_price - item.final_price
      const discountPercent = (discountAmount / item.original_price) * 100

      if (discountPercent > profile.max_discount_percent) {
        return new Response(
          JSON.stringify({
            error: `Discount ${discountPercent.toFixed(1)}% exceeds user limit ${profile.max_discount_percent}%`,
            code: 'DISCOUNT_EXCEEDS_LIMIT',
            details: { discount: discountPercent, limit: profile.max_discount_percent },
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // Begin transaction-like operations
    // 1. Fetch and validate all QR codes and inventory items
    const inventoryData: any[] = []

    for (const item of items) {
      // Fetch QR code (case-insensitive)
      const { data: qrCode, error: qrError } = await supabase
        .from('qr_codes')
        .select('id, code, status, shop_id')
        .ilike('code', item.qr_code)
        .eq('shop_id', profile.shop_id)
        .single()

      if (qrError || !qrCode) {
        console.error(`QR code lookup failed for ${item.qr_code}:`, {
          error: qrError,
          shop_id: profile.shop_id,
          qr_code: item.qr_code
        })
        return new Response(
          JSON.stringify({
            error: `QR code ${item.qr_code} not found in shop`,
            code: 'ITEM_NOT_FOUND',
            details: { 
              qr_code: item.qr_code, 
              shop_id: profile.shop_id,
              db_error: qrError?.message || qrError?.code
            },
          }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Fetch inventory item
      const { data: inventoryItem, error: invError } = await supabase
        .from('inventory_items')
        .select(`
          id,
          status,
          sold_at,
          lot_id,
          selling_price,
          cost_price,
          tax_rate
        `)
        .eq('qr_code_id', qrCode.id)
        .eq('shop_id', profile.shop_id)
        .single()

      if (invError || !inventoryItem) {
        return new Response(
          JSON.stringify({
            error: `Inventory item for QR ${item.qr_code} not found`,
            code: 'ITEM_NOT_FOUND',
            details: { qr_code: item.qr_code },
          }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Check if item is available
      if (inventoryItem.status === 'sold') {
        return new Response(
          JSON.stringify({
            error: `Item ${item.qr_code} already sold at ${inventoryItem.sold_at}`,
            code: 'ITEM_ALREADY_SOLD',
            details: { qr_code: item.qr_code, sold_at: inventoryItem.sold_at },
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      if (inventoryItem.status !== 'available') {
        return new Response(
          JSON.stringify({
            error: `Item ${item.qr_code} is not available (status: ${inventoryItem.status})`,
            code: 'ITEM_NOT_AVAILABLE',
            details: { qr_code: item.qr_code, status: inventoryItem.status },
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      inventoryData.push({
        qr_code: qrCode,
        inventory_item: inventoryItem,
        sale_item: item,
        tax_rate: inventoryItem.tax_rate || 0,
      })
    }

    // 2. Calculate totals
    let subtotal_amount = 0
    let total_amount = 0
    let total_tax = 0

    for (const data of inventoryData) {
      subtotal_amount += data.sale_item.original_price
      total_amount += data.sale_item.final_price

      // Calculate tax on final price
      const itemTax = (data.sale_item.final_price * data.tax_rate) / 100
      total_tax += itemTax
    }

    const total_discount = subtotal_amount - total_amount

    // 3. Generate bill_number (timestamp-based: YYYYMMDDHHMMSS)
    // Adjust to IST (UTC+5:30) for India timezone
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000; // 5 hours 30 minutes in milliseconds
    const istTime = new Date(now.getTime() + istOffset);
    
    const bill_number = parseInt(
      istTime.getUTCFullYear().toString() +
      String(istTime.getUTCMonth() + 1).padStart(2, '0') +
      String(istTime.getUTCDate()).padStart(2, '0') +
      String(istTime.getUTCHours()).padStart(2, '0') +
      String(istTime.getUTCMinutes()).padStart(2, '0') +
      String(istTime.getUTCSeconds()).padStart(2, '0')
    );

    // 4. Insert sale
    const { data: sale, error: saleError } = await supabase
      .from('sales')
      .insert({
        shop_id: profile.shop_id,
        bill_number,
        client_sale_id,
        customer_name: customer_name || null,
        customer_phone: customer_phone || null,
        subtotal_amount,
        total_discount,
        total_tax,
        total_amount,
        payment_method,
        created_by: user.id,
        created_at: occurred_at,
      })
      .select()
      .single()

    if (saleError) {
      console.error('Error creating sale:', saleError)
      return new Response(
        JSON.stringify({ error: 'Failed to create sale', code: 'SALE_CREATE_ERROR', details: saleError }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 5. Insert sale items and update inventory
    const saleItems: any[] = []

    for (const data of inventoryData) {
      const itemTax = (data.sale_item.final_price * data.tax_rate) / 100

      // If this inventory item was previously sold & returned, a stale sale_item
      // row still exists (returns only flip status back to 'available').
      // Delete it so the unique constraint on inventory_item_id doesn't block re-sale.
      const { data: staleSaleItem } = await supabase
        .from('sale_items')
        .select('id')
        .eq('inventory_item_id', data.inventory_item.id)
        .maybeSingle()

      if (staleSaleItem) {
        console.log(`Deleting stale sale_item ${staleSaleItem.id} for re-sold inventory item ${data.inventory_item.id}`)
        await supabase
          .from('sale_items')
          .delete()
          .eq('id', staleSaleItem.id)
      }

      // Insert sale_item
      const { data: saleItem, error: saleItemError } = await supabase
        .from('sale_items')
        .insert({
          shop_id: profile.shop_id,
          sale_id: sale.id,
          inventory_item_id: data.inventory_item.id,
          original_price: data.sale_item.original_price,
          final_price: data.sale_item.final_price,
          tax_amount: itemTax,
          discount_reason: data.sale_item.discount_reason || null,
          sold_on_sale: data.sale_item.sold_on_sale || false, // NEW
          sale_type: data.sale_item.sale_type || null, // NEW
        })
        .select()
        .single()

      if (saleItemError) {
        console.error('Error creating sale item:', saleItemError)
        // Rollback not possible in this flow - log error
        return new Response(
          JSON.stringify({ error: 'Failed to create sale items', code: 'SALE_ITEM_ERROR', details: saleItemError }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Update inventory_item
      const { error: invUpdateError } = await supabase
        .from('inventory_items')
        .update({
          status: 'sold',
          sold_at: occurred_at,
          sale_item_id: saleItem.id,
        })
        .eq('id', data.inventory_item.id)

      if (invUpdateError) {
        console.error('Error updating inventory item:', invUpdateError)
      }

      // Update qr_code
      const { error: qrUpdateError } = await supabase
        .from('qr_codes')
        .update({
          status: 'sold',
          sold_at: occurred_at,
        })
        .eq('id', data.qr_code.id)

      if (qrUpdateError) {
        console.error('Error updating QR code:', qrUpdateError)
      }

      saleItems.push({
        qr_code: data.qr_code.code,
        inventory_item_id: data.inventory_item.id,
        original_price: data.sale_item.original_price,
        final_price: data.sale_item.final_price,
      })
    }

    // 6. Insert financial transaction
    const { error: txError } = await supabase.from('financial_transactions').insert({
      shop_id: profile.shop_id,
      type: 'sale',
      related_sale_id: sale.id,
      amount: total_amount,
      payment_method,
      occurred_at,
      created_by: user.id,
    })

    if (txError) {
      console.error('Error creating financial transaction:', txError)
    }

    // Return success
    return new Response(
      JSON.stringify({
        sale: {
          id: sale.id,
          bill_number: sale.bill_number,
          bill_prefix: shop.bill_prefix,
          total_amount: sale.total_amount,
        },
        items: saleItems,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: (error as any)?.message || String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
