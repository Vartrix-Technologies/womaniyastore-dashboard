# Supabase Setup Guide for Womaniya Dashboard

## Prerequisites
- Node.js installed (v18 or higher)
- A Supabase account (free tier works fine)
- Supabase CLI installed

## Step 1: Install Supabase CLI

### Option A: Using Scoop (Recommended for Windows)

```powershell
# Install Scoop if you don't have it
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
Invoke-RestMethod -Uri https://get.scoop.sh | Invoke-Expression

# Install Supabase CLI
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase

# Verify installation
supabase --version
```

### Option B: Direct Download (Alternative)

1. Download the latest Windows binary from: https://github.com/supabase/cli/releases
2. Look for `supabase_windows_amd64.zip` or `supabase_windows_arm64.zip`
3. Extract to a folder (e.g., `C:\supabase`)
4. Add the folder to your PATH environment variable
5. Restart PowerShell and verify: `supabase --version`

### Option C: Using npx (No Installation Required)

```powershell
# Use npx for one-time commands (no installation needed)
npx supabase --version
npx supabase login
npx supabase link --project-ref your-project-ref

# Note: You'll need to prefix all commands with 'npx'
```

## Step 2: Create Supabase Project

1. Go to https://supabase.com/dashboard
2. Click "New Project"
3. Fill in:
   - **Name**: Womaniya Dashboard
   - **Database Password**: Choose a strong password (save this!)
   - **Region**: Choose closest to your location (e.g., Mumbai, Singapore)
4. Wait 2-3 minutes for project creation

## Step 3: Get Your Project Credentials

1. In your Supabase project dashboard, go to **Settings** → **API**
2. Copy these values:
   - **Project URL** (looks like: https://xxxxxxxxxxxxx.supabase.co)
   - **anon public** key (long string starting with "eyJ...")

## Step 4: Create Environment File

Create a `.env.local` file in your project root:

```env
NEXT_PUBLIC_SUPABASE_URL=your_project_url_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
```

**Example:**
```env
NEXT_PUBLIC_SUPABASE_URL=https://abcdefghijk.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiY2RlZmdoaWprIiwicm9sZSI6ImFub24iLCJpYXQiOjE2OTg4NTQ0MDAsImV4cCI6MjAxNDQzMDQwMH0...
```

## Step 5: Link Your Local Project to Supabase (Optional but Recommended)

**Note:** If using npx, add `npx` before each `supabase` command.

```powershell
# Navigate to your project directory
cd "d:\Projects\Freelancing\Womaniya\Code\Custom Dashboard PWA Code\Using NextJs\womaniya-dashboard"

# Login to Supabase CLI (use npx if you didn't install via Scoop)
supabase login
# OR: npx supabase login

# Link to your project
supabase link --project-ref your-project-ref
# OR: npx supabase link --project-ref your-project-ref
#nyrorjhhpvnwxfpnxgxv https://nyrorjhhpvnwxfpnxgxv.supabase.co
# Your project-ref is the part after https:// and before .supabase.co
# For example, if URL is https://abcdefghijk.supabase.co
# Then project-ref is: abcdefghijk
```

## Step 6: Run Database Migrations

### Option A: Using Supabase Dashboard (Easiest)

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor** (left sidebar)
3. Click **New Query**
4. Copy and paste the contents of `supabase/migrations/20241130_initial_schema.sql`
5. Click **Run** (or press Ctrl+Enter)
6. Wait for completion (should take ~30 seconds)
7. Repeat for `supabase/migrations/20241130_bill_number_function.sql`

### Option B: Using Supabase CLI

**Note:** Add `npx` before `supabase` if you're using npx method.

```powershell
# Push all migrations
supabase db push
# OR: npx supabase db push

# Or apply specific migration
supabase db push --include-all
# OR: npx supabase db push --include-all
```

## Step 7: Verify Database Setup

1. In Supabase Dashboard, go to **Table Editor**
2. You should see all tables:
   - shops
   - profiles
   - categories
   - sizes
   - qr_codes
   - lots
   - inventory_items
   - sales
   - sale_items
   - expense_categories
   - financial_transactions
   - attendance_logs
   - checklists
   - checklist_items
   - staff_checklist_assignments
   - staff_checklist_item_status
   - inventory_adjustments
   - sale_returns
   - tax_settings

## Step 8: Create Your First User & Shop

Run this SQL in the **SQL Editor**:

```sql
-- 1. Create a shop
INSERT INTO public.shops (name, address, phone)
VALUES ('Womaniya Airoli', 'Airoli, Navi Mumbai', '+91-XXXXXXXXXX')
RETURNING id;

-- Copy the shop ID from the result above, then:

-- 2. Create a superadmin user (use your email)
-- First, sign up via the Supabase Auth UI or use the dashboard
-- Then update the profile:

UPDATE public.profiles
SET role = 'superadmin',
    shop_id = 'YOUR_SHOP_ID_HERE',
    max_discount_percent = 100
WHERE id = (SELECT id FROM auth.users WHERE email = 'your-email@example.com');
```

**Alternative: Use Supabase Auth Dashboard**
1. Go to **Authentication** → **Users**
2. Click **Invite User**
3. Enter your email
4. After user is created, run the UPDATE query above

## Step 9: Add Sample Categories and Sizes

```sql
-- Add categories
INSERT INTO public.categories (shop_id, name)
VALUES 
  ('YOUR_SHOP_ID', 'Sarees'),
  ('YOUR_SHOP_ID', 'Kurtis'),
  ('YOUR_SHOP_ID', 'Lehengas'),
  ('YOUR_SHOP_ID', 'Salwar Suits');

-- Add sizes
INSERT INTO public.sizes (shop_id, name)
VALUES 
  ('YOUR_SHOP_ID', 'XS'),
  ('YOUR_SHOP_ID', 'S'),
  ('YOUR_SHOP_ID', 'M'),
  ('YOUR_SHOP_ID', 'L'),
  ('YOUR_SHOP_ID', 'XL'),
  ('YOUR_SHOP_ID', 'XXL'),
  ('YOUR_SHOP_ID', 'Free Size');
```

## Step 10: Generate Sample QR Codes

```sql
-- Generate 100 sample QR codes
-- Pattern: WA-0001, WA-0002, etc.
INSERT INTO public.qr_codes (shop_id, code)
SELECT 
  'YOUR_SHOP_ID',
  'WA-' || LPAD(generate_series::text, 4, '0')
FROM generate_series(1, 100);
```

## Step 11: Deploy Edge Functions

**Note:** Add `npx` before `supabase` if you're using npx method.

```powershell
# Deploy complete-sale function
supabase functions deploy complete-sale
# OR: npx supabase functions deploy complete-sale

# Deploy add-stock-lot function
supabase functions deploy add-stock-lot
# OR: npx supabase functions deploy add-stock-lot

# Verify deployment
supabase functions list
# OR: npx supabase functions list
```

### If you get errors about missing SUPABASE_URL or ANON_KEY:
The functions automatically use your project's environment variables when deployed.

## Step 12: Test Your Setup

```powershell
# Start the development server
npm run dev

# Open http://localhost:3000
```

1. Navigate to `/login`
2. Sign in with the email you created
3. You should be redirected to the dashboard
4. Try accessing `/admin` - you should see the admin dashboard
5. Try `/admin/inventory/add-lot` to test adding inventory

## Step 13: Configure RLS Policies (Verify)

Your RLS policies should already be set from the migration. Verify by:

1. Go to **Database** → **Policies** in Supabase Dashboard
2. Each table should have policies enabled
3. If any are missing, run the policies section from the migration again

## Step 14: Set Up Tax Settings (Optional)

```sql
INSERT INTO public.tax_settings (shop_id, gst_number, is_tax_inclusive, default_tax_rate)
VALUES ('YOUR_SHOP_ID', 'YOUR_GST_NUMBER', true, 18.00);
```

## Troubleshooting

### Error: "Missing Supabase environment variables"
- Make sure `.env.local` exists in your project root
- Restart your dev server after creating `.env.local`

### Error: "Cannot find profiles table"
- Run the migrations in the SQL Editor
- Check that all tables are created in Table Editor

### Error: "Unauthorized" when calling Edge Functions
- Make sure you're logged in
- Check that your auth token is being sent in the Authorization header

### Edge Function deployment fails
- Make sure you're logged in: `supabase login`
- Make sure you're linked: `supabase link --project-ref your-ref`
- Check function logs: `supabase functions logs complete-sale`

## Quick Reference

### Important URLs
- **Supabase Dashboard**: https://supabase.com/dashboard
- **Your Project**: https://supabase.com/dashboard/project/YOUR_PROJECT_REF
- **SQL Editor**: https://supabase.com/dashboard/project/YOUR_PROJECT_REF/sql
- **Table Editor**: https://supabase.com/dashboard/project/YOUR_PROJECT_REF/editor

### Common CLI Commands
```powershell
# View logs
supabase functions logs complete-sale

# Test edge function locally
supabase functions serve

# Generate TypeScript types
supabase gen types typescript --project-id YOUR_PROJECT_REF > src/types/database.types.ts

# Reset database (DANGER!)
supabase db reset
```

## Next Steps After Setup

1. **Add more QR codes** if you need more than 100
2. **Add inventory** via `/admin/inventory/add-lot`
3. **Test POS flow** by scanning items and completing a sale
4. **Create staff users** with appropriate roles and discount limits
5. **Configure offline sync** by testing the POS in offline mode

---

## Security Checklist

- ✅ RLS policies enabled on all tables
- ✅ Auth required for all protected routes
- ✅ Role-based access control implemented
- ✅ Discount limits enforced server-side
- ✅ Environment variables not committed to git (add `.env.local` to `.gitignore`)

**Your Womaniya Dashboard is now ready to use! 🚀**
