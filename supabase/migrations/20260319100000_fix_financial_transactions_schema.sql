-- ============================================================================
-- FIX: Align financial_transactions table with application code
-- ============================================================================
-- The live DB has drifted from what the app expects:
--   1. Column is named category_id → should be expense_category_id
--   2. Missing columns: created_by, payment_method, related_sale_id
--   3. Type column uses TEXT + CHECK('expense','revenue') → should use
--      financial_tx_type enum ('sale','expense','adjustment')
-- ============================================================================

-- STEP 1: Rename category_id → expense_category_id
ALTER TABLE public.financial_transactions
  RENAME COLUMN category_id TO expense_category_id;

-- STEP 2: Add missing columns
ALTER TABLE public.financial_transactions
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS payment_method TEXT,
  ADD COLUMN IF NOT EXISTS related_sale_id UUID REFERENCES public.sales(id);

-- STEP 3: Fix the type column
-- 3a. Drop the old CHECK constraint that only allows ('expense','revenue')
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE rel.relname = 'financial_transactions'
      AND nsp.nspname = 'public'
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) LIKE '%type%'
  LOOP
    EXECUTE format('ALTER TABLE public.financial_transactions DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

-- 3b. Map any existing 'revenue' rows to 'sale' (valid enum value)
UPDATE public.financial_transactions SET type = 'sale' WHERE type = 'revenue';

-- 3c. Convert type column from TEXT to the enum
ALTER TABLE public.financial_transactions
  ALTER COLUMN type TYPE public.financial_tx_type
  USING type::public.financial_tx_type;

-- STEP 4: Create indexes on new columns for query performance
CREATE INDEX IF NOT EXISTS idx_financial_transactions_expense_category_id
  ON public.financial_transactions(expense_category_id);
CREATE INDEX IF NOT EXISTS idx_financial_transactions_related_sale_id
  ON public.financial_transactions(related_sale_id);
CREATE INDEX IF NOT EXISTS idx_financial_transactions_created_by
  ON public.financial_transactions(created_by);
