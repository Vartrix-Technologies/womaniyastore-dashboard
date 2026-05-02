-- Migration: Auto-reset QR code status when linked inventory item is deleted
-- This trigger enforces the invariant at the DB layer:
--   a QR code can only have status='assigned' if an inventory_items row points to it.
-- Any deletion path (app code, edge functions, direct SQL) will benefit automatically.

CREATE OR REPLACE FUNCTION reset_qr_code_on_item_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only reset if the deleted item had a QR code linked
  IF OLD.qr_code_id IS NOT NULL THEN
    UPDATE qr_codes
    SET status = 'unused',
        assigned_at = NULL
    WHERE id = OLD.qr_code_id
      AND status = 'assigned'; -- Only reset if still 'assigned'; leave 'sold'/'lost' untouched
  END IF;
  RETURN OLD;
END;
$$;

CREATE TRIGGER trg_reset_qr_on_inventory_delete
  AFTER DELETE ON inventory_items
  FOR EACH ROW
  EXECUTE FUNCTION reset_qr_code_on_item_delete();

COMMENT ON FUNCTION reset_qr_code_on_item_delete() IS
  'Resets qr_codes.status to unused when the linked inventory_items row is deleted, '
  'preventing orphaned assigned QR codes that the add-stock-lot function would skip.';
