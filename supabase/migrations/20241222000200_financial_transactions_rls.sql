-- Create financial_transactions table if it doesn't exist
CREATE TABLE IF NOT EXISTS financial_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('expense', 'revenue')),
  amount DECIMAL(10, 2) NOT NULL,
  description TEXT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add category_id column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'financial_transactions' AND column_name = 'category_id'
  ) THEN
    ALTER TABLE financial_transactions ADD COLUMN category_id UUID REFERENCES expense_categories(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_financial_transactions_shop_id ON financial_transactions(shop_id);
CREATE INDEX IF NOT EXISTS idx_financial_transactions_category_id ON financial_transactions(category_id);
CREATE INDEX IF NOT EXISTS idx_financial_transactions_occurred_at ON financial_transactions(occurred_at);

-- Enable RLS
ALTER TABLE financial_transactions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view financial transactions for their shop" ON financial_transactions;
DROP POLICY IF EXISTS "Users can insert financial transactions for their shop" ON financial_transactions;
DROP POLICY IF EXISTS "Users can update financial transactions for their shop" ON financial_transactions;
DROP POLICY IF EXISTS "Users can delete financial transactions for their shop" ON financial_transactions;

-- RLS Policies
CREATE POLICY "Users can view financial transactions for their shop"
  ON financial_transactions FOR SELECT
  USING (
    shop_id IN (
      SELECT shop_id FROM user_profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert financial transactions for their shop"
  ON financial_transactions FOR INSERT
  WITH CHECK (
    shop_id IN (
      SELECT shop_id FROM user_profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update financial transactions for their shop"
  ON financial_transactions FOR UPDATE
  USING (
    shop_id IN (
      SELECT shop_id FROM user_profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete financial transactions for their shop"
  ON financial_transactions FOR DELETE
  USING (
    shop_id IN (
      SELECT shop_id FROM user_profiles WHERE user_id = auth.uid()
    )
  );

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_financial_transactions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS financial_transactions_updated_at ON financial_transactions;
CREATE TRIGGER financial_transactions_updated_at
  BEFORE UPDATE ON financial_transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_financial_transactions_updated_at();
