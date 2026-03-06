# Quick Start Commands

## Initial Setup (Run Once)

```powershell
# 1. Install Supabase CLI
npm install -g supabase

# 2. Login to Supabase
supabase login

# 3. Link to your project (replace with your project ref)
supabase link --project-ref your-project-ref

# 4. Install project dependencies
npm install

# 5. Create environment file
# Copy .env.example to .env.local and fill in your values
```

## Deploy to Supabase

```powershell
# Deploy Edge Functions
supabase functions deploy complete-sale
supabase functions deploy add-stock-lot

# Push database migrations (if needed)
supabase db push
```

## Development

```powershell
# Start development server
npm run dev

# Open http://localhost:3000
```

## Testing Edge Functions Locally

```powershell
# Start Supabase locally
supabase start

# Serve functions locally
supabase functions serve

# Test complete-sale
curl -i --location --request POST 'http://localhost:54321/functions/v1/complete-sale' \
  --header 'Authorization: Bearer YOUR_ANON_KEY' \
  --header 'Content-Type: application/json' \
  --data '{"client_sale_id":"test-123","items":[{"qr_code":"WA-0001","original_price":500,"final_price":500}],"payment_method":"cash","occurred_at":"2025-11-30T12:00:00Z"}'
```

## Useful SQL Queries

```sql
-- Check your shop ID
SELECT id, name FROM public.shops;

-- Check your user profile
SELECT id, email FROM auth.users WHERE email = 'your-email@example.com';
SELECT * FROM public.profiles WHERE id = 'your-user-id';

-- View all inventory items
SELECT 
  i.id,
  i.status,
  q.code as qr_code,
  c.name as category,
  l.selling_price_default
FROM inventory_items i
JOIN qr_codes q ON i.qr_code_id = q.id
JOIN lots l ON i.lot_id = l.id
LEFT JOIN categories c ON l.category_id = c.id
WHERE i.shop_id = 'YOUR_SHOP_ID'
ORDER BY i.created_at DESC
LIMIT 20;

-- View recent sales
SELECT 
  s.bill_number,
  s.total_amount,
  s.created_at,
  p.full_name as created_by
FROM sales s
LEFT JOIN profiles p ON s.created_by = p.id
WHERE s.shop_id = 'YOUR_SHOP_ID'
ORDER BY s.created_at DESC
LIMIT 10;
```

## Production Deployment

```powershell
# Build for production
npm run build

# The output will be in the 'out' folder
# Deploy to Firebase Hosting or any static host

# Deploy to Firebase Hosting
firebase deploy --only hosting
```
