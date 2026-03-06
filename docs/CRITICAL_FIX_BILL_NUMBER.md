# CRITICAL FIX: Missing Database Function

## Problem
The sales completion is failing with error: "Edge Function returned a non-2xx status code"

**Root Cause:** The `generate_bill_number` function is missing from the database. The Edge Function tries to call it but it doesn't exist.

## Solution

Apply the migration file to create the missing function:

### Step 1: Apply the Migration

**Option A: Using Supabase SQL Editor (Recommended)**

1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Select your project
3. Navigate to **SQL Editor** (left sidebar)
4. Click **New Query**
5. Copy the contents of `supabase/migrations/20241222_bill_number_function.sql`
6. Paste into the editor
7. Click **Run** (or press Ctrl+Enter)
8. You should see: "Success. No rows returned"

**Option B: Using Supabase CLI**

```powershell
# Navigate to project directory
cd "d:\Projects\Freelancing\Womaniya\Code\Custom Dashboard PWA Code\Using NextJs\womaniya-dashboard"

# Apply the migration
npx supabase db push

# Or if you have Supabase CLI installed:
supabase db push
```

### Step 2: Verify the Function Exists

Run this query in SQL Editor:

```sql
SELECT routine_name, routine_type 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name = 'generate_bill_number';
```

You should see one result with:
- `routine_name`: generate_bill_number
- `routine_type`: FUNCTION

### Step 3: Test the Function

```sql
-- Replace 'your-shop-id' with your actual shop ID
SELECT generate_bill_number('your-shop-id');
```

It should return `1` if you have no sales, or the next number after your highest bill_number.

### Step 4: Test Sales Completion

Go to your POS page and try completing a sale. It should now work!

## What This Function Does

- Generates sequential bill numbers (1, 2, 3, ...) for each shop
- Thread-safe: Uses `FOR UPDATE` lock to prevent duplicate numbers
- Returns the next available bill number atomically

## Troubleshooting

**If still getting errors:**

1. Check if the function was created:
   ```sql
   \df generate_bill_number
   ```

2. Check permissions:
   ```sql
   SELECT grantee, privilege_type 
   FROM information_schema.routine_privileges 
   WHERE routine_name = 'generate_bill_number';
   ```

3. Check Edge Function logs in Supabase Dashboard:
   - Go to **Edge Functions** → **complete-sale** → **Logs**
   - Look for detailed error messages

**If you see "permission denied":**

Run this to grant permissions:
```sql
GRANT EXECUTE ON FUNCTION generate_bill_number(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION generate_bill_number(UUID) TO service_role;
```

## Prevention

This function should have been created during initial setup. Make sure to run ALL migration files when setting up new environments:

1. `supabase/migrations/20241222_bill_number_function.sql` (this one)
2. Any other migration files in the migrations folder

Always check the `SUPABASE_SETUP_GUIDE.md` for complete setup instructions.
