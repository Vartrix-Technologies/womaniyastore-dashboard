# Invariants & Contracts

> Critical data invariants, API contracts, and assumptions that must never be violated.

---

## Overview

This document lists the **invariants** (conditions that must always be true) and **contracts** (agreed interfaces between components) that are essential to the system's correctness.

⚠️ **Warning:** Violating these invariants will cause data corruption, broken state, or security vulnerabilities.

---

## Data Invariants

### INV-001: QR Code Uniqueness

```
INVARIANT: Each QR code is assigned to at most ONE inventory item.

Table: inventory_items
Constraint: UNIQUE(qr_code_id)

Violation Impact: Same QR scanned could return different items, causing sale errors.
```

**Database Enforcement:**
```sql
ALTER TABLE inventory_items
ADD CONSTRAINT inventory_items_qr_code_id_key UNIQUE (qr_code_id);
```

---

### INV-002: Inventory Status Transitions

```
INVARIANT: Inventory items follow a defined status state machine.

Valid Transitions:
  available → sold (via complete-sale)
  available → damaged (via adjustment)
  available → returned (should not happen - returned means was sold first)
  sold → returned (via sale return)
  * → available (via adjustment with reason)

Invalid Transitions:
  sold → sold (already sold)
  unused → sold (must be assigned first)
```

**State Machine:**
```
        ┌─────────┐
        │ unused  │ (QR not linked)
        └────┬────┘
             │
        ┌────▼────┐
        │available│ ◄───────────────────┐
        └────┬────┘                     │
             │                          │ (adjustment)
    ┌────────┼────────┐                 │
    │        │        │                 │
    ▼        ▼        ▼                 │
┌──────┐ ┌──────┐ ┌────────┐            │
│ sold │ │damage│ │reserved│────────────┘
└──┬───┘ └──────┘ └────────┘
   │
   ▼
┌────────┐
│returned│
└────────┘
```

---

### INV-003: Client Sale ID Idempotency

```
INVARIANT: Each client_sale_id can only result in ONE sale record.

Table: sales
Constraint: UNIQUE(client_sale_id) WHERE client_sale_id IS NOT NULL

Violation Impact: Duplicate sales created during offline sync retries.
```

**Edge Function Check:**
```typescript
// complete-sale/index.ts
const { data: existingSale } = await supabase
  .from('sales')
  .select('*')
  .eq('client_sale_id', body.client_sale_id)
  .single();

if (existingSale) {
  return { existing: true, sale: existingSale };
}
```

---

### INV-004: Profile-Auth User Link

```
INVARIANT: Every profile.id MUST correspond to an auth.users.id.

Table: profiles
Constraint: profiles.id REFERENCES auth.users(id)

Violation Impact: Orphan profiles with no login, or auth users without profile data.
```

**Creation Pattern:**
```sql
-- Profiles are created after Supabase Auth user creation
-- Either via:
-- 1. Database trigger on auth.users insert
-- 2. Manual admin creation (create auth user first, then profile)
```

---

### INV-005: Shop Scoping

```
INVARIANT: All shop-specific data MUST have a valid shop_id FK.

Tables: inventory_items, sales, profiles (except superadmin), etc.
Constraint: shop_id REFERENCES shops(id)

Violation Impact: Data visible across shops, breaking multi-tenancy.
```

**RLS Policy Pattern:**
```sql
CREATE POLICY "Users see only their shop's data"
ON inventory_items FOR SELECT
USING (shop_id = (
  SELECT shop_id FROM profiles WHERE id = auth.uid()
));
```

---

### INV-006: Bill Number Sequence

```
INVARIANT: Bill numbers are sequential per shop with no gaps during normal operation.

Table: sales
Column: bill_number

Generation: Database function generate_bill_number(shop_id)

Violation Impact: Missing bill numbers raise audit/compliance questions.
```

**Database Function:**
```sql
CREATE OR REPLACE FUNCTION generate_bill_number(p_shop_id UUID)
RETURNS INTEGER AS $$
DECLARE
  next_number INTEGER;
BEGIN
  SELECT COALESCE(MAX(bill_number), 0) + 1
  INTO next_number
  FROM sales
  WHERE shop_id = p_shop_id;
  
  RETURN next_number;
END;
$$ LANGUAGE plpgsql;
```

---

### INV-007: Sale Totals Consistency

```
INVARIANT: Sale totals MUST equal sum of line items.

Tables: sales, sale_items
Formula:
  sales.subtotal_amount = SUM(sale_items.original_price)
  sales.total_discount = SUM(sale_items.original_price - sale_items.final_price)
  sales.total_tax = SUM(sale_items.tax_amount)
  sales.total_amount = subtotal - discount + tax

Violation Impact: Financial reports will be incorrect.
```

---

### INV-008: Active Session Requirement

```
INVARIANT: All protected routes require valid auth session.

Enforcement: (protected)/layout.tsx checks useAuth().user

Violation Impact: Unauthenticated access to sensitive data.
```

---

## API Contracts

### CONTRACT-001: Complete Sale Request/Response

**Endpoint:** `supabase.functions.invoke('complete-sale')`

**Request:**
```typescript
interface CompleteSaleRequest {
  client_sale_id: string;        // REQUIRED: UUID for idempotency
  items: Array<{
    qr_code: string;             // REQUIRED: QR code to look up item
    original_price: number;      // REQUIRED: Price before discount
    final_price: number;         // REQUIRED: Price after discount
    discount_reason?: string;    // OPTIONAL: If discounted
  }>;
  payment_method: string;        // REQUIRED: 'cash' | 'upi' | 'card' | 'other'
  customer_name?: string;        // OPTIONAL
  customer_phone?: string;       // OPTIONAL
  occurred_at?: string;          // OPTIONAL: ISO timestamp (default: now)
}
```

**Success Response:**
```typescript
interface CompleteSaleResponse {
  success: true;
  sale: {
    id: string;
    bill_number: number;
    total_amount: number;
    created_at: string;
  };
  existing?: boolean;            // True if idempotent duplicate
}
```

**Error Response:**
```typescript
interface CompleteSaleError {
  error: string;                 // Human-readable message
  code: string;                  // Machine-readable code
  details?: any;                 // Additional context
}
```

**Error Codes:**
| Code | Meaning |
|------|---------|
| `UNAUTHORIZED` | Missing/invalid JWT |
| `FORBIDDEN` | User lacks permission |
| `VALIDATION_ERROR` | Missing required fields |
| `ITEM_NOT_AVAILABLE` | Item already sold/damaged |
| `PROFILE_ERROR` | User has no shop assigned |

---

### CONTRACT-002: Add Stock Lot Request/Response

**Endpoint:** `supabase.functions.invoke('add-stock-lot')`

**Request:**
```typescript
interface AddStockLotRequest {
  category_id: string;           // REQUIRED
  size_id?: string;              // OPTIONAL (use free_text_size if null)
  free_text_size?: string;       // OPTIONAL
  vendor_name?: string;          // OPTIONAL
  date_of_stock_arrival: string; // REQUIRED: ISO date
  cost_price_per_unit: number;   // REQUIRED
  selling_price_default: number; // REQUIRED
  tax_rate?: number;             // OPTIONAL (default: shop tax rate)
  quantity: number;              // REQUIRED: > 0
}
```

**Success Response:**
```typescript
interface AddStockLotResponse {
  lot: {
    id: string;
    quantity: number;
  };
  items: Array<{
    inventory_item_id: string;
    qr_code: string;
  }>;
}
```

---

### CONTRACT-003: Auth Context Interface

**Provider:** `src/context/AuthContext.tsx`

**Contract:**
```typescript
interface AuthContextType {
  user: User | null;             // Supabase auth user
  profile: Profile | null;       // App profile with role
  loading: boolean;              // True during initial auth check
  
  signIn(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  
  hasRole(role: UserRole): boolean;  // Checks role hierarchy
  isAdmin(): boolean;                 // hasRole('admin')
  isStaff(): boolean;                 // hasRole('staff') - always true if logged in
  isSuperadmin(): boolean;            // role === 'superadmin'
}
```

**Guarantees:**
- `loading` is `true` until initial auth check completes
- If `user` is set, a `profile` fetch has been attempted
- `hasRole()` respects hierarchy: superadmin > owner > admin > staff

---

### CONTRACT-004: Sync Context Interface

**Provider:** `src/context/SyncContext.tsx`

**Contract:**
```typescript
interface SyncContextType {
  pendingSales: PendingSale[];   // All pending/failed sales
  syncing: boolean;              // Sync in progress
  
  syncNow(): Promise<void>;      // Trigger immediate sync
  retryFailed(): Promise<void>;  // Reset failed → pending and sync
  
  getPendingCount(shopId?: string): number;
  getFailedCount(shopId?: string): number;
}
```

**Guarantees:**
- Auto-syncs every 30 seconds when online
- Auto-syncs when coming back online
- Failed sales have `retryCount` incremented (max 3 before giving up)

---

### CONTRACT-005: IndexedDB Schema

**Database:** `womaniya-dashboard` (version 2)

**Stores:**
```typescript
interface WomaniyaDB {
  pendingSales: {
    key: string;              // client_sale_id
    value: PendingSale;
    indexes: ['by-status', 'by-created'];
  };
  
  inventoryCache: {
    key: string;              // qrCode
    value: {
      qrCode: string;
      itemId: string;
      lotId: string;
      price: number;
      category: string;
      size: string;
      taxRate: number;
      lastUpdated: string;
    };
  };
  
  failedSales: {
    key: number;              // auto-increment
    value: FailedSale;
    indexes: ['by-timestamp'];
  };
}
```

---

## Environment Assumptions

### ENV-001: Required Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL     - Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY - Supabase anon/public key
```

**Assumption:** These are set at build time and available to client.

---

### ENV-002: Supabase Edge Function Environment

Edge Functions have access to:
```
SUPABASE_URL            - Auto-injected
SUPABASE_SERVICE_ROLE_KEY - Auto-injected (⚠️ NEVER expose to client)
```

**Assumption:** Service role key bypasses RLS for admin operations.

---

### ENV-003: Browser Capabilities

**Required:**
- `localStorage` - Session persistence
- `IndexedDB` - Offline storage
- `fetch` API - Network requests
- `navigator.onLine` - Offline detection

**Optional:**
- Camera access - QR scanning
- Service Worker - PWA caching (not fully implemented)

---

## Authorization Assumptions

### AUTH-001: JWT in Authorization Header

```
All Edge Function calls include:
  Authorization: Bearer <access_token>

Verified via:
  supabase.auth.getUser(token)
```

---

### AUTH-002: Role-Based Access

```
Edge Functions check profile.role before allowing:
  - add-stock-lot: admin, owner, superadmin
  - complete-sale: staff, admin, owner, superadmin
```

---

### AUTH-003: Shop Scope Enforcement

```
Edge Functions derive shop_id from profile, not request body.

Exception: Superadmin can specify shop_id for cross-shop operations.
```

---

## Breaking Change Policy

When modifying these invariants or contracts:

1. **Database Changes**
   - Add column with default → safe
   - Remove column → breaking (migrate data first)
   - Add constraint → test existing data
   - Change FK → update all related code

2. **API Changes**
   - Add optional field → safe
   - Add required field → breaking (version API)
   - Remove field → breaking
   - Change type → breaking

3. **Context Changes**
   - Add state/method → safe
   - Remove state/method → breaking
   - Change method signature → breaking

---

## Invariant Violation Detection

### Monitoring Queries

**Check for orphan inventory items:**
```sql
SELECT * FROM inventory_items 
WHERE qr_code_id NOT IN (SELECT id FROM qr_codes);
```

**Check for duplicate client_sale_ids:**
```sql
SELECT client_sale_id, COUNT(*) 
FROM sales 
WHERE client_sale_id IS NOT NULL 
GROUP BY client_sale_id 
HAVING COUNT(*) > 1;
```

**Check for sale total mismatches:**
```sql
SELECT s.id, s.total_amount,
       SUM(si.final_price) + s.total_tax as calculated
FROM sales s
JOIN sale_items si ON si.sale_id = s.id
GROUP BY s.id
HAVING s.total_amount != SUM(si.final_price) + s.total_tax;
```

**Check for cross-shop data:**
```sql
SELECT i.id, i.shop_id as item_shop, l.shop_id as lot_shop
FROM inventory_items i
JOIN lots l ON l.id = i.lot_id
WHERE i.shop_id != l.shop_id;
```

---

## Summary Table

| ID | Type | Description | Enforcement |
|----|------|-------------|-------------|
| INV-001 | Invariant | QR code uniqueness | UNIQUE constraint |
| INV-002 | Invariant | Status transitions | Edge Function logic |
| INV-003 | Invariant | Sale idempotency | Edge Function check |
| INV-004 | Invariant | Profile-Auth link | FK constraint |
| INV-005 | Invariant | Shop scoping | FK + RLS |
| INV-006 | Invariant | Bill number sequence | DB function |
| INV-007 | Invariant | Sale totals | Edge Function calculation |
| INV-008 | Invariant | Active session | Layout check |
| CONTRACT-001 | API | Complete Sale | Edge Function |
| CONTRACT-002 | API | Add Stock Lot | Edge Function |
| CONTRACT-003 | Interface | AuthContext | TypeScript |
| CONTRACT-004 | Interface | SyncContext | TypeScript |
| CONTRACT-005 | Schema | IndexedDB | IDB schema |
