-- Create user_profiles helper view
-- This view is referenced by RLS policies in subsequent migrations.
-- Must run BEFORE 20241222_expense_categories.sql, 20241222_financial_transactions_rls.sql, etc.

CREATE OR REPLACE VIEW user_profiles AS
SELECT id AS user_id, shop_id, role
FROM profiles;
