-- Migration: Rename category_id → expense_category_id on financial_transactions
-- The column was originally created as "category_id" but all application code,
-- generated types, and FK hints reference "expense_category_id".

-- Step 1: Rename the column (if old name still exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'financial_transactions'
      AND column_name = 'category_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'financial_transactions'
      AND column_name = 'expense_category_id'
  ) THEN
    ALTER TABLE public.financial_transactions
      RENAME COLUMN category_id TO expense_category_id;
    RAISE NOTICE 'Renamed category_id → expense_category_id';
  ELSE
    RAISE NOTICE 'Column already named expense_category_id or category_id not found — skipping rename';
  END IF;
END $$;

-- Step 2: Fix the foreign key constraint name so PostgREST can resolve the
-- hint "financial_transactions_expense_category_id_fkey"
DO $$
DECLARE
  _old_fk TEXT;
BEGIN
  -- Find the existing FK on expense_category_id (or category_id) → expense_categories
  SELECT tc.constraint_name INTO _old_fk
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
   AND tc.table_schema   = kcu.table_schema
  WHERE tc.table_schema   = 'public'
    AND tc.table_name     = 'financial_transactions'
    AND tc.constraint_type = 'FOREIGN KEY'
    AND kcu.column_name   IN ('category_id', 'expense_category_id')
  LIMIT 1;

  IF _old_fk IS NOT NULL AND _old_fk <> 'financial_transactions_expense_category_id_fkey' THEN
    EXECUTE format('ALTER TABLE public.financial_transactions DROP CONSTRAINT %I', _old_fk);
    ALTER TABLE public.financial_transactions
      ADD CONSTRAINT financial_transactions_expense_category_id_fkey
      FOREIGN KEY (expense_category_id)
      REFERENCES public.expense_categories(id)
      ON DELETE SET NULL;
    RAISE NOTICE 'Renamed FK % → financial_transactions_expense_category_id_fkey', _old_fk;
  ELSIF _old_fk IS NULL THEN
    -- No FK exists at all — create it
    ALTER TABLE public.financial_transactions
      ADD CONSTRAINT financial_transactions_expense_category_id_fkey
      FOREIGN KEY (expense_category_id)
      REFERENCES public.expense_categories(id)
      ON DELETE SET NULL;
    RAISE NOTICE 'Created missing FK financial_transactions_expense_category_id_fkey';
  ELSE
    RAISE NOTICE 'FK already correctly named — skipping';
  END IF;
END $$;

-- Step 3: Ensure proper index exists on the renamed column
DROP INDEX IF EXISTS idx_financial_transactions_category_id;
CREATE INDEX IF NOT EXISTS idx_financial_transactions_expense_category_id
  ON public.financial_transactions (expense_category_id);
