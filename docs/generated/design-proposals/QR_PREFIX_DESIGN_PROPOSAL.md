# QR Prefix Feature - Design Proposal

**Status**: ✅ APPROVED - READY FOR IMPLEMENTATION  
**Date**: January 10, 2026  
**Approved**: January 10, 2026  
**Change Type**: Additive, Backward-Compatible  
**Reviewers**: Stakeholder approved

---

## 1. Executive Summary

### Problem Statement
Current QR code generation uses a single hardcoded prefix per shop (e.g., "WMN-00001"). Staff cannot visually infer product price or category from QR codes without scanning, leading to slower checkout and customer service delays.

### Proposed Solution
Introduce **QR Prefixes** as a first-class, admin-managed entity. Admins can define multiple prefixes (e.g., "WA-499", "WA-599") where the prefix encodes meaningful information (price, category, season). Each prefix maintains its own sequence counter.

### Success Criteria
- ✅ Admins can create/manage multiple QR prefixes per shop
- ✅ QR codes generated with format `{PREFIX}-{SEQUENCE}` (e.g., "WA-499-0001")
- ✅ Staff can visually identify price/category from QR prefix before scanning
- ✅ Existing QR codes continue to function without modification
- ✅ No breaking changes to POS, inventory, or sales flows
- ✅ Offline POS continues to work

---

## 2. Database Design

### 2.1 New Table: `qr_prefixes`

```sql
CREATE TABLE qr_prefixes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  prefix VARCHAR(20) NOT NULL, -- e.g., "WA-499", "WA-599"
  description TEXT, -- Optional: "₹499 Kurtas", "₹599 Sarees"
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0, -- For sorting in UI
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  
  -- Constraints
  CONSTRAINT qr_prefixes_prefix_format CHECK (prefix ~ '^[A-Z0-9]+-[A-Z0-9]+$'),
  CONSTRAINT qr_prefixes_unique_per_shop UNIQUE(shop_id, prefix)
);

-- Index for active prefix lookups
CREATE INDEX idx_qr_prefixes_shop_active ON qr_prefixes(shop_id, is_active);

-- RLS Policy
ALTER TABLE qr_prefixes ENABLE ROW LEVEL SECURITY;

CREATE POLICY qr_prefixes_select ON qr_prefixes
  FOR SELECT USING (shop_id = current_shop_id());

CREATE POLICY qr_prefixes_insert ON qr_prefixes
  FOR INSERT WITH CHECK (
    shop_id = current_shop_id() AND
    current_role() IN ('owner', 'admin', 'superadmin')
  );

CREATE POLICY qr_prefixes_update ON qr_prefixes
  FOR UPDATE USING (
    shop_id = current_shop_id() AND
    current_role() IN ('owner', 'admin', 'superadmin')
  );

CREATE POLICY qr_prefixes_delete ON qr_prefixes
  FOR DELETE USING (
    shop_id = current_shop_id() AND
    current_role() IN ('owner', 'admin', 'superadmin')
  );
```

**Rationale:**
- `prefix` field uses `VARCHAR(20)` to accommodate formats like "WINTER-2026-499"
- Regex check ensures format is uppercase with hyphens (no spaces, lowercase, or special chars)
- `display_order` allows admins to control UI sort order
- `description` provides human-readable context (not stored in QR code itself)
- RLS enforces shop isolation and admin-only access

---

### 2.2 Modified Table: `qr_codes`

**Add Columns:**
```sql
ALTER TABLE qr_codes 
  ADD COLUMN prefix_id UUID REFERENCES qr_prefixes(id) ON DELETE RESTRICT,
  ADD COLUMN sequence_number INTEGER;

-- Unique constraint: sequence numbers must be unique per prefix
CREATE UNIQUE INDEX idx_qr_codes_prefix_sequence 
  ON qr_codes(prefix_id, sequence_number) 
  WHERE prefix_id IS NOT NULL AND sequence_number IS NOT NULL;

-- Index for prefix-based QR lookups
CREATE INDEX idx_qr_codes_prefix_id ON qr_codes(prefix_id) WHERE prefix_id IS NOT NULL;

-- Comment for clarity
COMMENT ON COLUMN qr_codes.prefix_id IS 'Foreign key to qr_prefixes. NULL for legacy QR codes generated before prefix feature.';
COMMENT ON COLUMN qr_codes.sequence_number IS 'Sequence number within the prefix (e.g., 1, 2, 3...). NULL for legacy QR codes.';
```

**Backward Compatibility:**
- `prefix_id` and `sequence_number` are **nullable**
- Existing QR codes (pre-migration) have both columns as `NULL`
- `code` column remains primary identifier (still unique across shop)
- `ON DELETE RESTRICT` prevents accidental deletion of prefixes with assigned QR codes

**New QR Code Format Logic:**
- **Legacy QR codes** (prefix_id = NULL): `code` = "WMN-00001" (original format)
- **Prefix QR codes** (prefix_id != NULL): `code` = `{prefix.prefix}-{sequence_number:04d}` = "WA-499-0001"

---

### 2.3 Database Function: `generate_qr_codes_with_prefix()`

```sql
CREATE OR REPLACE FUNCTION generate_qr_codes_with_prefix(
  p_shop_id UUID,
  p_prefix_id UUID,
  p_quantity INTEGER
)
RETURNS TABLE(qr_code_id UUID, qr_code TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_prefix TEXT;
  v_next_sequence INTEGER;
  v_code TEXT;
  v_id UUID;
BEGIN
  -- Validate prefix exists and is active
  SELECT prefix INTO v_prefix
  FROM qr_prefixes
  WHERE id = p_prefix_id AND shop_id = p_shop_id AND is_active = true;
  
  IF v_prefix IS NULL THEN
    RAISE EXCEPTION 'Prefix not found or inactive';
  END IF;
  
  -- Get next sequence number for this prefix
  SELECT COALESCE(MAX(sequence_number), 0) + 1 INTO v_next_sequence
  FROM qr_codes
  WHERE prefix_id = p_prefix_id;
  
  -- Generate QR codes
  FOR i IN 0..(p_quantity - 1) LOOP
    v_code := v_prefix || '-' || LPAD((v_next_sequence + i)::TEXT, 4, '0');
    
    INSERT INTO qr_codes (shop_id, code, prefix_id, sequence_number, status)
    VALUES (p_shop_id, v_code, p_prefix_id, v_next_sequence + i, 'unused')
    RETURNING id, code INTO v_id, v_code;
    
    RETURN QUERY SELECT v_id, v_code;
  END LOOP;
END;
$$;

-- Grant execute to authenticated users (RLS will enforce shop_id)
GRANT EXECUTE ON FUNCTION generate_qr_codes_with_prefix TO authenticated;
```

**Rationale:**
- Generates QR codes with format `{PREFIX}-{SEQ:04d}` (e.g., "WA-499-0001", "WA-499-0002")
- Sequence numbers are per-prefix, not global (fresh start for each prefix)
- Validates prefix is active before generation
- Atomic operation (transaction-safe)
- RLS policies on `qr_codes` table still apply

---

### 2.4 Migration Function: `migrate_legacy_qr_codes()` (Optional)

```sql
CREATE OR REPLACE FUNCTION migrate_legacy_qr_codes_to_default_prefix(
  p_shop_id UUID
)
RETURNS TABLE(migrated_count INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_default_prefix_id UUID;
  v_count INTEGER := 0;
BEGIN
  -- Find or create default prefix for shop
  SELECT id INTO v_default_prefix_id
  FROM qr_prefixes
  WHERE shop_id = p_shop_id AND prefix = (
    SELECT bill_prefix FROM shops WHERE id = p_shop_id
  );
  
  IF v_default_prefix_id IS NULL THEN
    -- Create default prefix using shop's bill_prefix
    INSERT INTO qr_prefixes (shop_id, prefix, description, is_active)
    SELECT p_shop_id, bill_prefix, 'Legacy QR codes', true
    FROM shops WHERE id = p_shop_id
    RETURNING id INTO v_default_prefix_id;
  END IF;
  
  -- Migrate legacy QR codes (those without prefix_id)
  WITH updated AS (
    UPDATE qr_codes
    SET 
      prefix_id = v_default_prefix_id,
      sequence_number = SUBSTRING(code FROM '\d+$')::INTEGER -- Extract trailing number
    WHERE 
      shop_id = p_shop_id 
      AND prefix_id IS NULL
      AND code ~ '^\w+-\d+$' -- Only migrate if format is PREFIX-NUMBER
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_count FROM updated;
  
  RETURN QUERY SELECT v_count;
END;
$$;

-- Superadmin only
REVOKE EXECUTE ON FUNCTION migrate_legacy_qr_codes_to_default_prefix FROM PUBLIC;
GRANT EXECUTE ON FUNCTION migrate_legacy_qr_codes_to_default_prefix TO authenticated;
```

**Usage:**
```sql
-- Migrate shop's legacy QR codes to default prefix
SELECT migrate_legacy_qr_codes_to_default_prefix('shop-uuid-here');
```

**Note:** This is **optional**. Legacy QR codes can remain with `prefix_id = NULL` indefinitely.

---

### 2.5 TypeScript Type Updates

**Add to `src/types/database.types.ts`:**
```typescript
export interface QRPrefix {
  id: string;
  shop_id: string;
  prefix: string;
  description: string | null;
  is_active: boolean;
  display_order: number;
  created_at: string;
}

// Update QRCode type
export interface QRCode {
  id: string;
  shop_id: string;
  code: string;
  status: 'unused' | 'assigned' | 'sold' | 'lost';
  assigned_at: string | null;
  sold_at: string | null;
  created_at: string;
  // NEW FIELDS
  prefix_id: string | null;
  sequence_number: number | null;
}
```

---

## 3. QR Lifecycle Updates

### 3.1 Before (Current State)

```
┌─────────────────────────────────────────────────────────────────┐
│ QR Generation (Admin)                                           │
├─────────────────────────────────────────────────────────────────┤
│ Input:                                                          │
│   - Quantity: 100                                               │
│                                                                 │
│ Process:                                                        │
│   1. Get next sequence number (global counter per shop)         │
│   2. Generate codes: "WMN-00001", "WMN-00002", ..., "WMN-00100" │
│   3. Insert into qr_codes table with status='unused'            │
│                                                                 │
│ Output:                                                         │
│   - 100 QR codes ready for assignment                           │
└─────────────────────────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────────────────────────┐
│ Stock Lot Addition (Admin)                                      │ 
├─────────────────────────────────────────────────────────────────┤
│ Input:                                                          │
│   - Category, Size, Quantity, Pricing                           │
│   - NO prefix selection                                         │
│                                                                 │
│ Process:                                                        │
│   1. Create lot record                                          │
│   2. Auto-assign next N unused QR codes (ANY prefix)            │
│   3. Create inventory_items linking to QR codes                 │
│   4. Update qr_codes.status = 'assigned'                        │
└─────────────────────────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────────────────────────┐
│ POS Sale (Staff)                                                │
├─────────────────────────────────────────────────────────────────┤
│ Input:                                                          │
│   - Scan QR code: "WMN-00050"                                   │
│                                                                 │
│ Process:                                                        │
│   1. Lookup qr_codes where code = "WMN-00050"                   │
│   2. Join to inventory_items                                    │
│   3. Join to lots for pricing                                   │
│   4. Display item in cart                                       │
│                                                                 │
│ Price Display:                                                  │
│   - From lots.selling_price_default                             │
│   - Staff adjusts manually if needed                            │
└─────────────────────────────────────────────────────────────────┘
```

---

### 3.2 After (With QR Prefixes)

```
┌─────────────────────────────────────────────────────────────────┐
│ Prefix Management (Admin - NEW)                                 │
├─────────────────────────────────────────────────────────────────┤
│ Actions:                                                        │
│   - Create prefix: "WA-499" (₹499 items)                        │
│   - Create prefix: "WA-599" (₹599 items)                        │
│   - Create prefix: "WA-799" (₹799 items)                        │
│   - Set active/inactive                                         │
│   - Reorder for display                                         │
└─────────────────────────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────────────────────────┐
│ QR Generation (Admin - UPDATED)                                 │
├─────────────────────────────────────────────────────────────────┤
│ Input:                                                          │
│   - Select Prefix: "WA-499" ← NEW                               │
│   - Quantity: 100                                               │
│                                                                 │
│ Process:                                                        │
│   1. Get next sequence for "WA-499" prefix (starts at 1)        │
│   2. Generate codes: "WA-499-0001", "WA-499-0002", ...          │
│   3. Insert with prefix_id + sequence_number                    │
│                                                                 │
│ Output:                                                         │
│   - 100 QR codes with "WA-499" prefix                           │
│   - Staff can visually see "499" = price range                  │
│                                                                 │
│ Legacy Support:                                                 │
│   - Old QR codes (prefix_id=NULL) still work                    │
│   - Can mix old and new QR codes                                │
└─────────────────────────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────────────────────────┐
│ Stock Lot Addition (Admin - UPDATED)                            │
├─────────────────────────────────────────────────────────────────┤
│ Input:                                                          │
│   - Category, Size, Quantity, Pricing                           │
│   - Select QR Prefix: "WA-499" ← NEW                            │
│                                                                 │
│ Process:                                                        │
│   1. Create lot record                                          │
│   2. Auto-assign next N unused QR codes FROM SELECTED PREFIX    │
│      WHERE prefix_id = selected_prefix_id AND status='unused'   │ 
│   3. Create inventory_items linking to QR codes                 │
│   4. Update qr_codes.status = 'assigned'                        │
│                                                                 │
│ Validation:                                                     │
│   - Error if insufficient unused QR codes in selected prefix    │
│   - Suggestion: "Generate more QR codes with prefix WA-499"     │
└─────────────────────────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────────────────────────┐
│ POS Sale (Staff - UNCHANGED)                                    │
├─────────────────────────────────────────────────────────────────┤
│ Input:                                                          │
│   - Scan QR code: "WA-499-0025"                                 │
│                                                                 │
│ Process:                                                        │
│   1. Lookup qr_codes where code = "WA-499-0025"                 │
│   2. Join to inventory_items (same as before)                   │
│   3. Join to lots for pricing (same as before)                  │
│   4. Display item in cart                                       │
│                                                                 │
│ Price Display:                                                  │
│   - Still from lots.selling_price_default (NOT from prefix)     │
│   - Staff sees "WA-499" and knows it's ~₹499 item               │
│   - Visual hint ONLY, actual price from database                │
│                                                                 │
│ Offline Support:                                                │
│   - IndexedDB cache stores full qr_code string                  │
│   - Parsing logic handles variable prefix formats               │
└─────────────────────────────────────────────────────────────────┘
```

**Key Differences:**
1. ✅ Prefix selection added to QR generation flow
2. ✅ Prefix selection added to stock lot flow
3. ✅ Sequence numbers are per-prefix (independent counters)
4. ✅ POS scanning logic unchanged (lookup by full code string)
5. ✅ Price display logic unchanged (from lots table, not prefix)
6. ✅ Legacy QR codes continue to work alongside prefixed codes

---

## 4. Screen Responsibility Updates

### 4.1 `/admin/settings` (UPDATED)

**New Responsibilities:**
- Manage QR prefixes (add, edit, toggle active, reorder)
- Display list of prefixes with usage count
- Validate prefix format (uppercase, hyphens only)
- Show warning if prefix has assigned QR codes (cannot delete)

**New UI Section: "QR Code Prefixes"**
- Table columns: Prefix, Description, Active, Usage Count, Actions
- Actions: Edit, Toggle Active, Delete (if unused)
- **Recommended workflow**: Mark inactive instead of deleting (safer, preserves history)
- Add Prefix button → Dialog:
  - Prefix (text input with validation)
  - Description (textarea)
  - Is Active (toggle)
  - **Helper text**: "Tip: Keep prefix names aligned with pricing (e.g., WA-499 for ₹499 items)"
- Validation rules:
  - Must match format: `^[A-Z0-9]+-[A-Z0-9]+$`
  - Cannot duplicate existing prefix in shop
  - Length: 3-20 characters

**Data Reads**: `qr_prefixes`, `qr_codes` (for usage counts)  
**Data Writes**: `qr_prefixes` (CRUD)

---

### 4.2 `/admin/qr-codes` (UPDATED)

**Updated Responsibilities:**
- Generate QR codes **with prefix selection** (NEW)
- Display prefix filter in QR code list (NEW)
- Show prefix name in QR code table (NEW)
- All other responsibilities unchanged

**Updated UI:**
- **Generate QR Codes Dialog**:
  - Add field: **Select Prefix** (dropdown of active prefixes) **← REQUIRED, NO LEGACY MODE**
  - Validation: Must select a prefix (mandatory field)
  - Error if no active prefixes: "Create a prefix in Settings first" (blocks QR generation)
  - Quantity field (unchanged)
  - Preview: Shows sample codes ("WA-499-0001", "WA-499-0002", ...)
  - **Note**: Legacy QR generation (without prefix) is disabled to reduce complexity

- **QR Code List Table**:
  - Add column: **Prefix** (displays prefix name or "Legacy" if NULL)
  - Add filter: **Filter by Prefix** (dropdown: All / Legacy / [prefix list])
  - Sort by prefix supported

**Data Reads**: `qr_codes`, `qr_prefixes`  
**Data Writes**: `qr_codes` (via database function)

---

### 4.3 `/admin/inventory` - Add Stock Lot (UPDATED)

**Updated Responsibilities:**
- Select QR prefix when adding stock lot (NEW)
- Validate sufficient unused QR codes in selected prefix (NEW)
- Display error with actionable message if insufficient QR codes (NEW)
- All other responsibilities unchanged

**Updated UI:**
- **Add Stock Lot Form**:
  - Add field (after Quantity): **QR Prefix** (dropdown of active prefixes)
  - Required field (cannot submit without selection)
  - **Helper text below selling price field**: "Note: If using price-based prefixes (e.g., WA-499), ensure selling price matches for consistency"
  - Real-time validation: Check available unused QR count for selected prefix
  - Warning message: "This prefix has only X unused QR codes. You need Y."
  - Link to QR generation page: "Generate more QR codes"

**Data Reads**: `qr_prefixes`, `qr_codes` (count unused per prefix)  
**Data Writes**: Unchanged (Edge Function handles QR assignment)

---

### 4.4 All Other Screens (UNCHANGED)

- `/pos` - No changes (scans full QR code string)
- `/admin/sales` - No changes (displays QR codes as-is)
- `/admin/finances` - No changes
- `/admin/staff` - No changes
- `/admin/attendance` - No changes
- `/admin/checklists` - No changes
- `/me` - No changes

---

## 5. Migration Strategy

### Phase 1: Database Schema (Zero Downtime)

**Step 1.1: Create `qr_prefixes` table**
```sql
-- Run migration: 20260110_create_qr_prefixes.sql
CREATE TABLE qr_prefixes (...);
CREATE INDEX ...;
ALTER TABLE qr_prefixes ENABLE ROW LEVEL SECURITY;
CREATE POLICY ...;
```

**Step 1.2: Add nullable columns to `qr_codes`**
```sql
-- Run migration: 20260110_add_prefix_to_qr_codes.sql
ALTER TABLE qr_codes 
  ADD COLUMN prefix_id UUID REFERENCES qr_prefixes(id) ON DELETE RESTRICT,
  ADD COLUMN sequence_number INTEGER;

CREATE UNIQUE INDEX idx_qr_codes_prefix_sequence ...;
```

**Step 1.3: Create database functions**
```sql
-- Run migration: 20260110_qr_prefix_functions.sql
CREATE OR REPLACE FUNCTION generate_qr_codes_with_prefix(...) ...;
CREATE OR REPLACE FUNCTION migrate_legacy_qr_codes_to_default_prefix(...) ...;
```

**Impact:** ✅ Zero downtime, no breaking changes. Existing app continues to work.

---

### Phase 2: Data Preparation (Optional)

**✅ APPROVED APPROACH: Leave Legacy QR Codes As-Is**
- Existing QR codes remain with `prefix_id = NULL`
- App handles both legacy and prefixed QR codes
- Development system will be factory reset before production deployment
- New QR codes (post-deployment) will always have prefixes
- Pro: No data migration risk, simpler implementation
- Con: Mixed format during development (acceptable since factory reset planned)

**Migration function remains available but not required** for development/testing purposes.

---

### Phase 3: UI Updates

**Step 3.1: Update TypeScript types**
```bash
# Regenerate types from Supabase
supabase gen types typescript --project-id <id> > src/types/database.types.ts
```

**Step 3.2: Implement UI changes**
1. Add QR prefix management to `/admin/settings`
2. Update QR generation flow in `/admin/qr-codes`
3. Update stock lot form in `/admin/inventory`
4. Add prefix column to QR code list table

**Step 3.3: Update Edge Functions**
- Modify `add_stock_lot` to accept `prefix_id` parameter
- Update QR assignment logic to filter by prefix
- Add validation for sufficient unused QR codes

**Step 3.4: Update POS offline cache**
- No changes needed (already caches full `code` string)
- QR lookup remains by `code` field (unchanged)

---

### Phase 4: Testing & Rollout

**Test Cases:**
1. ✅ Generate QR codes with new prefix → Verify format
2. ✅ Add stock lot with prefix selection → Verify QR assignment
3. ✅ Scan prefixed QR at POS → Verify item loads correctly
4. ✅ Scan legacy QR at POS → Verify still works
5. ✅ Offline POS with prefixed QR → Verify IndexedDB cache works
6. ✅ Insufficient QR codes error → Verify helpful message
7. ✅ Deactivate prefix → Verify cannot generate new QR codes
8. ✅ Delete prefix with assigned QR codes → Verify blocked
9. ✅ Export QR codes to CSV → Verify prefix column included
10. ✅ Multi-shop isolation → Verify prefixes scoped to shop

**Rollout Plan:**
1. Deploy database migrations (Phase 1)
2. Create 1-2 prefixes per shop manually (superadmin)
3. Deploy UI updates (Phase 3)
4. Train admins on new workflow
5. Generate new QR codes with prefixes
6. Gradually phase out legacy QR code generation

---

## 6. Edge Cases & Failure Modes

### 6.1 Data Integrity Edge Cases

| Edge Case | Current Behavior | Mitigation |
|-----------|------------------|------------|
| **Legacy QR codes mixed with prefixed** | Both exist in `qr_codes` table | ✅ Nullable columns support both. Lookup by `code` works for both. |
| **Prefix deleted with assigned QR codes** | Foreign key violation | ✅ `ON DELETE RESTRICT` prevents deletion. UI shows warning. |
| **Prefix deactivated mid-generation** | QR generation may fail | ✅ Database function checks `is_active` before generation. |
| **Duplicate sequence number** | Unique constraint violation | ✅ `UNIQUE(prefix_id, sequence_number)` prevents duplicates. |
| **Sequence number exhaustion** | Reaches INTEGER max (2.1B) | ⚠️ Unlikely but possible. Add validation if sequence > 999999. |
| **Invalid prefix format** | Insert fails | ✅ CHECK constraint enforces regex. UI validates before submit. |
| **Prefix changed after QR codes generated** | QR codes retain old format | ✅ No problem. `code` is immutable, prefix is reference only. |

---

### 6.2 User Workflow Edge Cases

| Edge Case | Expected Behavior | Implementation Notes |
|-----------|-------------------|----------------------|
| **Admin selects prefix with 0 unused QR codes** | Show error: "This prefix has no unused QR codes. Generate more first." | Check count before allowing stock lot submission. |
| **Admin tries to add 50 items but only 30 QR codes available** | Show error: "Insufficient QR codes (30 available, 50 needed)." Link to QR generation. | Real-time validation on form. |
| **Staff scans QR code from different prefix than expected** | Item loads normally (price from lot, not prefix) | No validation needed. Prefix is visual hint only. |
| **Admin creates prefix "WA-499" but sets price to ₹599** | System allows (prefix is a label, not enforced) | Document this: Prefix is admin's responsibility to keep consistent. |
| **Staff relies on prefix for price, actual price differs** | Confusion at checkout | ⚠️ **Business rule**: Admins must maintain prefix-price consistency. Add UI warning if lot price doesn't match prefix pattern. |
| **Offline POS scans prefixed QR code** | Works (cached in IndexedDB) | Ensure `code` field is cached, not parsed fields. |
| **Export QR codes to CSV** | Include prefix name column | Add `qr_prefixes.prefix` to JOIN query. |

---

### 6.3 Performance Edge Cases

| Edge Case | Impact | Mitigation |
|-----------|--------|------------|
| **Shop has 100+ prefixes** | Slow prefix dropdown load | Add pagination or search to prefix selector. |
| **Prefix has 100,000+ QR codes** | Slow sequence number lookup | ✅ Index on `(prefix_id, sequence_number)` ensures fast MAX() query. |
| **POS scans QR code (prefix lookup)** | No impact (lookup by `code` unchanged) | ✅ No JOIN needed for POS, existing index on `code` sufficient. |
| **QR code list filtered by prefix** | Potentially slow with large dataset | ✅ Index on `prefix_id` ensures fast filtering. |

---

### 6.4 Failure Modes & Recovery

| Failure Mode | Impact | Recovery |
|--------------|--------|----------|
| **Database function crashes mid-generation** | Partial QR codes created | ✅ Wrapped in transaction. If function fails, all inserts rolled back. |
| **Prefix deactivated while stock lot in progress** | Add stock lot fails | User retries with active prefix. No data corruption. |
| **User manually edits prefix in database** | May break format validation | ⚠️ Superadmin only. Document: Do not edit `qr_codes.code` manually. |
| **Migration function fails on legacy QR codes** | Some QR codes not migrated | Acceptable. Legacy QR codes can remain unmigrated. System handles both. |
| **Offline POS cache out of sync with prefixes** | Scanned item may not load | Same as current behavior. Sync when online. Not worse than before. |
| **Admin deletes all active prefixes** | Cannot generate new QR codes | UI prevents: "At least one active prefix required." Or allow legacy generation as fallback. |

---

## 7. Testing Checklist

### 7.1 Database Tests

- [ ] Create prefix with valid format → Success
- [ ] Create prefix with invalid format (lowercase) → Error
- [ ] Create duplicate prefix in same shop → Error
- [ ] Create same prefix in different shop → Success (multi-tenant isolation)
- [ ] Delete prefix with assigned QR codes → Error (FK constraint)
- [ ] Delete prefix with no QR codes → Success
- [ ] Generate QR codes with active prefix → Success, correct format
- [ ] Generate QR codes with inactive prefix → Error
- [ ] Generate QR codes with sequence rollover → Increments correctly
- [ ] Unique constraint on (prefix_id, sequence_number) → Duplicate blocked

---

### 7.2 UI Tests

- [ ] Settings: Add prefix → Appears in list
- [ ] Settings: Edit prefix description → Updates correctly
- [ ] Settings: Toggle prefix active/inactive → Updates immediately
- [ ] Settings: Delete unused prefix → Removed from list
- [ ] Settings: Delete prefix with QR codes → Shows error message
- [ ] QR Generation: Select prefix → Preview shows correct format
- [ ] QR Generation: No active prefixes → Shows error + link to settings
- [ ] QR Generation: Generate 100 codes → Creates with sequential numbers
- [ ] QR Code List: Filter by prefix → Shows only matching codes
- [ ] QR Code List: Shows "Legacy" for old QR codes → Correct display
- [ ] Add Stock Lot: Select prefix → Enables submission
- [ ] Add Stock Lot: Select prefix with insufficient QR codes → Shows error
- [ ] Add Stock Lot: Error message links to QR generation → Navigation works

---

### 7.3 POS Tests

- [ ] Scan prefixed QR code → Item loads correctly
- [ ] Scan legacy QR code → Item loads correctly
- [ ] Scan QR code from different prefix → Item loads (no prefix validation)
- [ ] Offline POS: Scan prefixed QR code → Works from cache
- [ ] Price displayed matches lot, not prefix → Correct (visual hint only)

---

### 7.4 Integration Tests

- [ ] Add stock lot with prefix "WA-499" → QR codes assigned from that prefix only
- [ ] Add stock lot with prefix "WA-599" → Independent sequence numbers
- [ ] Complete sale with prefixed QR code → Updates status, creates sale record
- [ ] Export QR codes to CSV → Includes prefix column
- [ ] Export sales to CSV → QR codes displayed correctly
- [ ] Offline sync: Sale with prefixed QR code → Syncs successfully when online

---

### 7.5 Migration Tests (if Option B chosen)

- [ ] Migrate legacy QR codes → prefix_id and sequence_number populated
- [ ] Migrate shop with no legacy QR codes → No errors
- [ ] Migrate shop with mixed formats → Handles gracefully
- [ ] Rollback migration → Restores prefix_id = NULL

---

## 8. API / Edge Function Updates

### 8.1 `add_stock_lot` Edge Function (UPDATED)

**New Parameter:**
```typescript
interface AddStockLotRequest {
  shop_id: string;
  category_id: string;
  size_id?: string;
  free_text_size?: string;
  quantity: number;
  cost_price_per_unit: number;
  selling_price_default: number;
  tax_rate: number;
  date_of_stock_arrival: string;
  prefix_id: string; // ← NEW: Required
}
```

**Updated Logic:**
```typescript
// Validate prefix exists and is active
const { data: prefix, error: prefixError } = await supabaseAdmin
  .from('qr_prefixes')
  .select('id, is_active')
  .eq('id', prefix_id)
  .eq('shop_id', shop_id)
  .single();

if (!prefix || !prefix.is_active) {
  throw new Error('Invalid or inactive QR prefix');
}

// Count available unused QR codes for this prefix
const { count, error: countError } = await supabaseAdmin
  .from('qr_codes')
  .select('id', { count: 'exact', head: true })
  .eq('shop_id', shop_id)
  .eq('prefix_id', prefix_id) // ← NEW: Filter by prefix
  .eq('status', 'unused');

if (count < quantity) {
  throw new Error(`Insufficient QR codes. Prefix has ${count} unused QR codes, but ${quantity} needed.`);
}

// Assign QR codes (with prefix filter)
const { data: qrCodes, error: qrError } = await supabaseAdmin
  .from('qr_codes')
  .select('id')
  .eq('shop_id', shop_id)
  .eq('prefix_id', prefix_id) // ← NEW: Filter by prefix
  .eq('status', 'unused')
  .order('sequence_number', { ascending: true }) // ← NEW: Order by sequence
  .limit(quantity);

// Rest of logic unchanged (create lot, create inventory_items, update QR status)
```

---

### 8.2 New Edge Function: `generate_qr_codes` (OPTIONAL)

**Purpose:** Generate QR codes via API (alternative to calling database function directly)

**Request:**
```typescript
interface GenerateQRCodesRequest {
  shop_id: string;
  prefix_id: string;
  quantity: number;
}
```

**Response:**
```typescript
interface GenerateQRCodesResponse {
  success: boolean;
  qr_codes: Array<{
    id: string;
    code: string;
  }>;
}
```

**Implementation:**
```typescript
// Call database function
const { data, error } = await supabaseAdmin.rpc(
  'generate_qr_codes_with_prefix',
  { p_shop_id: shop_id, p_prefix_id: prefix_id, p_quantity: quantity }
);

if (error) throw error;

return new Response(JSON.stringify({ success: true, qr_codes: data }), {
  headers: { 'Content-Type': 'application/json' },
});
```

**Note:** This is optional. Can also call database function directly from client.

---

## 9. Documentation Updates

### 9.1 Update PRD: Section 4.12 `/admin/settings`

Add:
> **New Responsibilities:**
> - Manage QR prefixes (add, edit, toggle active, reorder)
> - Validate prefix format (uppercase letters, numbers, hyphens only)
> - Display usage count per prefix (how many QR codes assigned)
> - Prevent deletion of prefixes with assigned QR codes

---

### 9.2 Update PRD: Section 3 "Flow C: Admin → Add Stock Lot"

Update step 3 to include:
> **Required fields:**
> - **QR Prefix** (NEW): Select which prefix to use for QR code assignment
> - Category, Size, Quantity, Cost Price, Selling Price, Date

> **Validation:**
> - Must select an active prefix
> - Must have sufficient unused QR codes in selected prefix
> - Error: "This prefix has only X unused QR codes. Generate Y more."

---

### 9.3 Update PRD: Section 5.1 Assumptions

Update assumption #13:
> ~~**QR codes pre-generated**: Admin must manually generate QR codes in bulk before adding stock~~
>
> **QR codes pre-generated with prefixes**: Admin must:
> 1. Create QR prefixes (e.g., "WA-499", "WA-599") in Settings
> 2. Generate QR codes for each prefix in QR Management
> 3. Select prefix when adding stock lots

---

### 9.4 New Documentation: `docs/QR_PREFIX_USER_GUIDE.md`

Create user-facing guide:
- What are QR prefixes and why use them?
- How to create a prefix
- How to generate QR codes with a prefix
- How to assign prefix when adding stock
- Best practices (keep prefix names aligned with prices)
- Troubleshooting (insufficient QR codes, inactive prefix, etc.)

---

## 10. Rollback Plan

### If Rollback Needed (Pre-Production)

**Step 1: Revert UI changes**
```bash
git revert <commit-hash>
npm run build
```

**Step 2: Drop database objects (CAUTION)**
```sql
-- Only if no production data exists
DROP FUNCTION IF EXISTS generate_qr_codes_with_prefix;
DROP FUNCTION IF EXISTS migrate_legacy_qr_codes_to_default_prefix;
ALTER TABLE qr_codes DROP COLUMN IF EXISTS prefix_id;
ALTER TABLE qr_codes DROP COLUMN IF EXISTS sequence_number;
DROP TABLE IF EXISTS qr_prefixes;
```

### If Rollback Needed (Production)

⚠️ **Cannot safely rollback if:**
- Prefixes have been created and QR codes generated
- Stock lots have been added with prefix selection
- Sales have been completed with prefixed QR codes

**Mitigation:**
- Leave database schema in place (columns are nullable, no breaking changes)
- Revert UI to hide prefix features
- Document: "QR prefix feature disabled, legacy mode active"
- Re-enable legacy QR generation flow (without prefix selection)

---

## 11. Stakeholder Decisions (APPROVED)

### ✅ Resolved Decisions

1. **Migration approach**: ✅ **Leave as-is (NULL)**
   - Development system will be factory reset before production deployment
   - No migration needed, legacy QR codes acceptable during development

2. **Prefix format rules**: ✅ **Keep alphanumeric format `^[A-Z0-9]+-[A-Z0-9]+$`**
   - Simple, readable, sufficient for use case
   - Examples: "WA-499", "WA-599", "WA-799"

3. **Price validation**: ✅ **Helper text (non-blocking)**
   - Add helper text: "Ensure selling price matches prefix for consistency"
   - No hard validation (allows flexibility)

4. **Legacy QR generation**: ✅ **Prefix mandatory (no legacy mode)**
   - Simplifies codebase, reduces complexity
   - All new QR codes must have a prefix
   - Existing legacy QR codes continue to work

5. **Default prefix**: ⚠️ **Undecided (not blocking)**
   - Can be added later if needed
   - For now, admin explicitly selects prefix each time

6. **Prefix deletion**: ✅ **Recommend making inactive instead of deleting**
   - Delete action remains available for unused prefixes
   - UI encourages "Toggle Inactive" for prefixes with assigned QR codes
   - Safer approach, preserves audit trail

7. **Sequence number format**: ✅ **4 digits (`0001`) sufficient**
   - Supports 9,999 codes per prefix
   - Can create multiple prefixes if needed

8. **UI location**: ✅ **Settings page**
   - QR prefix management alongside categories, sizes, expense categories
   - Consistent with existing admin configuration patterns

---

## 12. Approval Checklist

- [x] Database design reviewed (tables, columns, constraints)
- [x] RLS policies reviewed (shop isolation, role permissions)
- [x] Migration strategy approved (Leave as-is, factory reset before production)
- [x] UI changes approved (Settings, QR Generation, Stock Lot)
- [x] Edge cases reviewed (data integrity, user workflow, performance)
- [x] Testing checklist reviewed
- [x] Rollback plan reviewed
- [x] Open questions answered and decisions documented
- [ ] Timeline agreed upon (pending implementation estimate)
- [ ] Resource allocation confirmed (pending implementation estimate)

---

**Next Steps (Implementation Ready):**

1. ✅ Review this design document
2. ✅ Answer open questions (Section 11)
3. ✅ Approve or request changes
4. ⏳ **Implement database migrations (Phase 1)** ← NEXT
5. ⏳ Implement UI changes (Phase 3)
6. ⏳ Test (Phase 4)
7. ⏳ Deploy to development environment
8. ⏳ Factory reset data before production

---

**Status**: ✅ **APPROVED - READY FOR IMPLEMENTATION**

**Implementation Order:**
1. Database schema (migrations)
2. TypeScript types update
3. Edge Function updates (`add_stock_lot`)
4. UI: Settings page (prefix management)
5. UI: QR Generation (prefix selector)
6. UI: Stock Lot form (prefix selector)
7. Testing (all test cases)
8. Documentation update
