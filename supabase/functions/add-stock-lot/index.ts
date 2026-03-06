// Add Stock Lot Edge Function
// Bulk inventory creation with QR code assignment

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { corsHeaders } from '../_shared/cors.ts'

interface AddStockLotRequest {
  category_id: string
  size_id?: string
  free_text_size?: string
  vendor_name?: string
  date_of_stock_arrival: string
  cost_price_per_unit: number
  selling_price_default: number
  tax_rate?: number
  quantity: number
  prefix_id: string // NEW: Required - QR prefix to use for this lot
  sale_type?: string // NEW: 'festival' | 'promotion' | null
  min_margin_percent?: number // NEW: Minimum margin % for festival sales
  sale_reason?: string // NEW: Description of the sale
}

Deno.serve(async (req) => {
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
      Deno.env.get('SUPABASE_URL') ?? '',
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

    // Parse request body
    const body: AddStockLotRequest = await req.json()
    const {
      category_id,
      size_id,
      free_text_size,
      vendor_name,
      date_of_stock_arrival,
      cost_price_per_unit,
      selling_price_default,
      tax_rate,
      quantity,
      prefix_id, // NEW
      sale_type, // NEW: festival/promotion sale marking
      min_margin_percent, // NEW: margin protection for festival
      sale_reason, // NEW: sale description
    } = body

    // Validate request
    if (
      !category_id ||
      !date_of_stock_arrival ||
      cost_price_per_unit === undefined ||
      selling_price_default === undefined ||
      !quantity ||
      quantity <= 0 ||
      !prefix_id // NEW: prefix_id is required
    ) {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid required fields (including prefix_id)', code: 'VALIDATION_ERROR' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get user profile and verify role
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, shop_id, role')
      .eq('id', user.id)
      .single()

    if (profileError || !profile || !profile.shop_id) {
      return new Response(
        JSON.stringify({ error: 'Profile not found or not assigned to a shop', code: 'PROFILE_ERROR' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check user role (only admin or owner can add stock)
    if (!['admin', 'owner', 'superadmin'].includes(profile.role)) {
      return new Response(
        JSON.stringify({ error: 'Insufficient permissions - admin or owner role required', code: 'PERMISSION_DENIED' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // NEW: Validate prefix exists, is active, and belongs to shop
    const { data: prefix, error: prefixError } = await supabase
      .from('qr_prefixes')
      .select('id, prefix, is_active')
      .eq('id', prefix_id)
      .eq('shop_id', profile.shop_id)
      .single()

    if (prefixError || !prefix) {
      return new Response(
        JSON.stringify({ 
          error: 'QR prefix not found or does not belong to your shop', 
          code: 'INVALID_PREFIX',
          details: prefixError 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!prefix.is_active) {
      return new Response(
        JSON.stringify({ 
          error: `QR prefix "${prefix.prefix}" is inactive. Please activate it in Settings or select a different prefix.`, 
          code: 'INACTIVE_PREFIX' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 1. Create lot
    const { data: lot, error: lotError } = await supabase
      .from('lots')
      .insert({
        shop_id: profile.shop_id,
        category_id,
        size_id: size_id || null,
        free_text_size: free_text_size || null,
        vendor_name: vendor_name || null,
        date_of_stock_arrival,
        cost_price_per_unit,
        selling_price_default,
        tax_rate: tax_rate || 0,
        quantity,
        created_by: user.id,
        sale_type: sale_type || null, // NEW: festival/promotion
        min_margin_percent: min_margin_percent || null, // NEW: margin protection
        sale_reason: sale_reason || null, // NEW: sale description
      })
      .select()
      .single()

    if (lotError) {
      console.error('Error creating lot:', lotError)
      return new Response(
        JSON.stringify({ error: 'Failed to create lot', code: 'LOT_CREATE_ERROR', details: lotError }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 2. Fetch available unused QR codes FROM SELECTED PREFIX
    const { data: qrCodes, error: qrError } = await supabase
      .from('qr_codes')
      .select('id, code')
      .eq('shop_id', profile.shop_id)
      .eq('prefix_id', prefix_id) // NEW: Filter by prefix
      .eq('status', 'unused')
      .order('sequence_number', { ascending: true }) // NEW: Order by sequence for proper ordering
      .limit(quantity)

    if (qrError) {
      console.error('Error fetching QR codes:', qrError)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch QR codes', code: 'QR_FETCH_ERROR', details: qrError }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if we have enough QR codes IN THIS PREFIX
    if (!qrCodes || qrCodes.length < quantity) {
      return new Response(
        JSON.stringify({
          error: `Insufficient QR codes for prefix "${prefix.prefix}". Requested: ${quantity}, Available: ${qrCodes?.length || 0}`,
          code: 'INSUFFICIENT_QR_CODES',
          details: { 
            prefix: prefix.prefix, 
            requested: quantity, 
            available: qrCodes?.length || 0 
          },
          suggestion: `Generate more QR codes with prefix "${prefix.prefix}" in QR Code Management`,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 3. Update QR codes to 'assigned' status
    const qrIds = qrCodes.map((qr) => qr.id)
    const { error: qrUpdateError } = await supabase
      .from('qr_codes')
      .update({
        status: 'assigned',
        assigned_at: new Date().toISOString(),
      })
      .in('id', qrIds)

    if (qrUpdateError) {
      console.error('Error updating QR codes:', qrUpdateError)
      return new Response(
        JSON.stringify({ error: 'Failed to assign QR codes', code: 'QR_UPDATE_ERROR', details: qrUpdateError }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 4. Create inventory items
    const inventoryItems = qrCodes.map((qr) => ({
      shop_id: profile.shop_id,
      lot_id: lot.id,
      qr_code_id: qr.id,
      status: 'available',
    }))

    const { data: createdItems, error: itemsError } = await supabase
      .from('inventory_items')
      .insert(inventoryItems)
      .select(`
        id,
        qr_code_id,
        qr_codes (code)
      `)

    if (itemsError) {
      console.error('Error creating inventory items:', itemsError)
      return new Response(
        JSON.stringify({ error: 'Failed to create inventory items', code: 'ITEMS_CREATE_ERROR', details: itemsError }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Return success
    return new Response(
      JSON.stringify({
        lot: {
          id: lot.id,
          category_id: lot.category_id,
          quantity: lot.quantity,
          selling_price_default: lot.selling_price_default,
        },
        items: createdItems.map((item: any) => ({
          inventory_item_id: item.id,
          qr_code: item.qr_codes.code,
        })),
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
