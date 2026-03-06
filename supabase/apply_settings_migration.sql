-- Check and add missing columns to shops table
DO $$
BEGIN
  -- Add tax_rate if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shops' AND column_name = 'tax_rate'
  ) THEN
    ALTER TABLE shops ADD COLUMN tax_rate DECIMAL(5,2) DEFAULT 0 NOT NULL;
  END IF;

  -- Add bill_prefix if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shops' AND column_name = 'bill_prefix'
  ) THEN
    ALTER TABLE shops ADD COLUMN bill_prefix VARCHAR(10) DEFAULT 'BILL' NOT NULL;
  END IF;

  -- Rename name to shop_name if needed
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shops' AND column_name = 'name'
  ) THEN
    ALTER TABLE shops RENAME COLUMN name TO shop_name;
  END IF;
END $$;

-- Add description to categories
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'categories' AND column_name = 'description'
  ) THEN
    ALTER TABLE categories ADD COLUMN description TEXT;
  END IF;
END $$;

-- Handle sizes table
DO $$
BEGIN
  -- Rename name to size_name if needed
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'sizes' AND column_name = 'name'
  ) THEN
    ALTER TABLE sizes RENAME COLUMN name TO size_name;
  END IF;

  -- Add sort_order if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'sizes' AND column_name = 'sort_order'
  ) THEN
    ALTER TABLE sizes ADD COLUMN sort_order INT DEFAULT 0 NOT NULL;
    
    -- Update sort_order for existing sizes
    WITH ranked_sizes AS (
      SELECT id, ROW_NUMBER() OVER (PARTITION BY shop_id ORDER BY created_at) - 1 as new_order
      FROM sizes
    )
    UPDATE sizes 
    SET sort_order = ranked_sizes.new_order
    FROM ranked_sizes
    WHERE sizes.id = ranked_sizes.id;
  END IF;
END $$;
