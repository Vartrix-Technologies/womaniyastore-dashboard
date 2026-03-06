// Create User Edge Function
// Allows superadmin to create new users with temporary passwords

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { corsHeaders } from '../_shared/cors.ts'

interface CreateUserRequest {
  email: string
  password: string
  full_name: string
  phone?: string
  role: 'staff' | 'admin' | 'owner'
  shop_id: string
  max_discount_percent?: number
}

interface ResetPasswordRequest {
  user_id: string
  new_password: string
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get authorization header
    const authHeader = req.headers.get('Authorization')
    
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Initialize Supabase Admin client with service role
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    // Verify JWT and get the calling user
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized', details: authError?.message }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify caller is superadmin
    const { data: callerProfile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, role')
      .eq('id', user.id)
      .single()

    if (profileError || !callerProfile || callerProfile.role !== 'superadmin') {
      return new Response(
        JSON.stringify({ error: 'Forbidden: Only superadmin can create users', code: 'FORBIDDEN' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse request body
    const body = await req.json()
    const action = body.action || 'create'

    if (action === 'create') {
      return await handleCreateUser(supabaseAdmin, body, user.id)
    } else if (action === 'reset_password') {
      return await handleResetPassword(supabaseAdmin, body)
    } else if (action === 'list_users') {
      return await handleListUsers(supabaseAdmin, body.shop_id)
    } else if (action === 'toggle_active') {
      return await handleToggleActive(supabaseAdmin, body.user_id)
    } else {
      return new Response(
        JSON.stringify({ error: 'Invalid action', code: 'INVALID_ACTION' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
  } catch (error: any) {
    console.error('Create User Error:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error', code: 'INTERNAL_ERROR' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

// Create a new user account
async function handleCreateUser(supabaseAdmin: any, body: CreateUserRequest, creatorId: string) {
  const {
    email,
    password,
    full_name,
    phone,
    role,
    shop_id,
    max_discount_percent = 0
  } = body

  // Validate required fields
  if (!email || !password || !full_name || !role || !shop_id) {
    return new Response(
      JSON.stringify({ error: 'Missing required fields: email, password, full_name, role, shop_id', code: 'VALIDATION_ERROR' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Validate role (superadmin cannot be created via this endpoint)
  if (!['staff', 'admin', 'owner'].includes(role)) {
    return new Response(
      JSON.stringify({ error: 'Invalid role. Must be staff, admin, or owner', code: 'INVALID_ROLE' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Validate password strength (minimum 6 characters)
  if (password.length < 6) {
    return new Response(
      JSON.stringify({ error: 'Password must be at least 6 characters', code: 'WEAK_PASSWORD' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Verify shop exists
  const { data: shop, error: shopError } = await supabaseAdmin
    .from('shops')
    .select('id, shop_name')
    .eq('id', shop_id)
    .single()

  if (shopError || !shop) {
    return new Response(
      JSON.stringify({ error: 'Shop not found', code: 'SHOP_NOT_FOUND' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Create auth user using Admin API
  const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // Auto-confirm email since superadmin created it
    user_metadata: {
      full_name,
      created_by_superadmin: true
    }
  })

  if (createError) {
    console.error('Error creating auth user:', createError)
    
    // Handle specific errors
    if (createError.message.includes('already registered')) {
      return new Response(
        JSON.stringify({ error: 'A user with this email already exists', code: 'EMAIL_EXISTS' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    return new Response(
      JSON.stringify({ error: createError.message, code: 'AUTH_ERROR' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Create or update profile record with must_change_password flag
  // Using upsert to handle case where a trigger may have already created the profile
  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .upsert({
      id: newUser.user.id,
      full_name,
      phone: phone || null,
      role,
      shop_id,
      max_discount_percent,
      is_active: true,
      must_change_password: true, // Force password change on first login
      created_by: creatorId
    }, {
      onConflict: 'id'
    })
    .select()
    .single()

  if (profileError) {
    console.error('Error creating/updating profile:', profileError)
    
    // Rollback: delete the auth user if profile creation fails
    await supabaseAdmin.auth.admin.deleteUser(newUser.user.id)
    
    return new Response(
      JSON.stringify({ error: 'Failed to create user profile', code: 'PROFILE_ERROR', details: profileError.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  return new Response(
    JSON.stringify({
      success: true,
      message: 'User created successfully',
      user: {
        id: newUser.user.id,
        email: newUser.user.email,
        full_name,
        role,
        shop_id,
        shop_name: shop.shop_name,
        must_change_password: true
      }
    }),
    { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

// Reset user password (for offboarding or forgotten password)
async function handleResetPassword(supabaseAdmin: any, body: ResetPasswordRequest) {
  const { user_id, new_password } = body

  if (!user_id || !new_password) {
    return new Response(
      JSON.stringify({ error: 'Missing required fields: user_id, new_password', code: 'VALIDATION_ERROR' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Validate password strength
  if (new_password.length < 6) {
    return new Response(
      JSON.stringify({ error: 'Password must be at least 6 characters', code: 'WEAK_PASSWORD' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Check user exists and is not superadmin
  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('id, role, full_name')
    .eq('id', user_id)
    .single()

  if (profileError || !profile) {
    return new Response(
      JSON.stringify({ error: 'User not found', code: 'USER_NOT_FOUND' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  if (profile.role === 'superadmin') {
    return new Response(
      JSON.stringify({ error: 'Cannot reset superadmin password', code: 'FORBIDDEN' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Update password using Admin API
  const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(user_id, {
    password: new_password
  })

  if (updateError) {
    return new Response(
      JSON.stringify({ error: updateError.message, code: 'AUTH_ERROR' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Set must_change_password flag
  await supabaseAdmin
    .from('profiles')
    .update({ must_change_password: true })
    .eq('id', user_id)

  return new Response(
    JSON.stringify({
      success: true,
      message: `Password reset for ${profile.full_name}. They must change it on next login.`
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

// List all users for a shop
async function handleListUsers(supabaseAdmin: any, shop_id?: string) {
  let query = supabaseAdmin
    .from('profiles')
    .select(`
      id,
      full_name,
      phone,
      role,
      shop_id,
      is_active,
      must_change_password,
      created_at,
      created_by,
      shops!profiles_shop_id_fkey (
        shop_name
      )
    `)
    .neq('role', 'superadmin') // Don't list superadmins
    .order('created_at', { ascending: false })

  if (shop_id) {
    query = query.eq('shop_id', shop_id)
  }

  const { data: users, error } = await query

  if (error) {
    return new Response(
      JSON.stringify({ error: error.message, code: 'QUERY_ERROR' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Get emails from auth.users (admin only operation)
  const userIds = users.map((u: any) => u.id)
  const usersWithEmail = await Promise.all(
    users.map(async (u: any) => {
      const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(u.id)
      return {
        ...u,
        email: authUser?.user?.email || 'N/A',
        shop_name: u.shops?.shop_name || 'Unassigned'
      }
    })
  )

  return new Response(
    JSON.stringify({
      success: true,
      users: usersWithEmail
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

// Toggle user active status
async function handleToggleActive(supabaseAdmin: any, user_id: string) {
  if (!user_id) {
    return new Response(
      JSON.stringify({ error: 'Missing user_id', code: 'VALIDATION_ERROR' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Get current status
  const { data: profile, error: getError } = await supabaseAdmin
    .from('profiles')
    .select('id, is_active, role, full_name')
    .eq('id', user_id)
    .single()

  if (getError || !profile) {
    return new Response(
      JSON.stringify({ error: 'User not found', code: 'USER_NOT_FOUND' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  if (profile.role === 'superadmin') {
    return new Response(
      JSON.stringify({ error: 'Cannot deactivate superadmin', code: 'FORBIDDEN' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Toggle status
  const newStatus = !profile.is_active
  const { error: updateError } = await supabaseAdmin
    .from('profiles')
    .update({ is_active: newStatus })
    .eq('id', user_id)

  if (updateError) {
    return new Response(
      JSON.stringify({ error: updateError.message, code: 'UPDATE_ERROR' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  return new Response(
    JSON.stringify({
      success: true,
      message: `${profile.full_name} has been ${newStatus ? 'activated' : 'deactivated'}`,
      is_active: newStatus
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}
