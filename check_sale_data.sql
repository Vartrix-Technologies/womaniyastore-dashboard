-- Check if sale data is being saved correctly
SELECT 
  sale_items.id,
  sale_items.sold_on_sale,
  sale_items.sale_type,
  sale_items.final_price,
  sales.bill_number,
  sales.created_at
FROM sale_items 
JOIN sales ON sale_items.sale_id = sales.id 
ORDER BY sales.created_at DESC 
LIMIT 10;

-- Check schema of sale_items table
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'sale_items'
AND column_name IN ('sold_on_sale', 'sale_type')
ORDER BY column_name;
