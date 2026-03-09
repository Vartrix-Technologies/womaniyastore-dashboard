-- Add sort_order column to categories for custom ordering (drag-and-drop)
ALTER TABLE categories ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

-- Initialize sort_order based on current alphabetical name order per shop
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY shop_id ORDER BY name) - 1 AS rn
  FROM categories
)
UPDATE categories SET sort_order = ranked.rn
FROM ranked WHERE categories.id = ranked.id;
