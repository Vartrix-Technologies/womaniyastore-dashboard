# Data Flow & Ownership

> Documentation of how data moves from UI to backend and back, where validation occurs, and how errors propagate.

---

## Overview

Data in Womaniya Dashboard flows through three primary paths:
1. **Direct Supabase Queries** - Simple CRUD via Supabase JS client
2. **Edge Functions** - Complex transactions with business logic
3. **Offline Queue** - Deferred operations stored in IndexedDB

---

## Data Flow Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT (Browser)                               │
│                                                                             │
│  ┌─────────────┐    ┌─────────────────┐    ┌───────────────────────────┐   │
│  │   React     │───▶│  API Wrapper    │───▶│  Supabase JS Client       │   │
│  │   Component │    │  (src/lib/api/) │    │  (supabase.from(),        │   │
│  │   State     │    │                 │    │   supabase.functions)     │   │
│  └─────────────┘    └─────────────────┘    └─────────────┬─────────────┘   │
│        ▲                                                  │                 │
│        │                    ┌──────────────────────────────┘                 │
│        │                    │                                               │
│        │            ┌───────▼───────┐                                       │
│        │            │   Offline?    │                                       │
│        │            └───────┬───────┘                                       │
│        │                    │                                               │
│        │            YES ────┼──── NO                                        │
│        │                    │                                               │
│        │            ┌───────▼───────────────────────────────────┐           │
│        │            │  IndexedDB (pendingSales, inventoryCache) │           │
│        │            └───────────────────────────────────────────┘           │
│        │                    │                                               │
│        └────────────────────┘                                               │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     │ HTTPS (JWT in Authorization header)
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              SUPABASE (Backend)                             │
│                                                                             │
│  ┌───────────────────┐    ┌───────────────────┐    ┌────────────────────┐  │
│  │ PostgREST API     │    │ Edge Functions    │    │ PostgreSQL + RLS   │  │
│  │ (Direct queries)  │    │ (Deno Runtime)    │    │ (Data storage)     │  │
│  └─────────┬─────────┘    └─────────┬─────────┘    └──────────┬─────────┘  │
│            │                        │                         │             │
│            │              ┌─────────▼─────────┐               │             │
│            │              │ Service Role Key  │               │             │
│            │              │ (Bypasses RLS)    │               │             │
│            │              └─────────┬─────────┘               │             │
│            │                        │                         │             │
│            └────────────────────────┼─────────────────────────┘             │
│                                     │                                       │
│                            ┌────────▼────────┐                              │
│                            │   PostgreSQL    │                              │
│                            │   (Tables +     │                              │
│                            │    Functions)   │                              │
│                            └─────────────────┘                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Data Flow Patterns

### Pattern 1: Direct Query (Read-Heavy Operations)

Used for: Fetching lists, dashboard stats, search

```
Component → supabase.from('table').select() → PostgREST → PostgreSQL + RLS
    ▲                                                           │
    └───────────────────── JSON Response ──────────────────────┘
```

**Example:** Fetching inventory items

```typescript
// src/lib/api/inventory.ts
export async function fetchAvailableInventory(filters) {
  const { data, error } = await supabase
    .from('inventory_items')
    .select(`
      *,
      lot:lots (*),
      qr_code:qr_codes (*)
    `)
    .eq('status', 'available');

  if (error) throw new Error(error.message);
  return data;
}

// Component usage
const { data: inventory, isLoading, error } = useQuery({
  queryKey: ['inventory', 'available'],
  queryFn: fetchAvailableInventory,
});
```

**Validation:** RLS policies enforce shop_id scoping

---

### Pattern 2: Edge Function (Critical Transactions)

Used for: Sale completion, stock addition (atomic multi-table operations)

```
Component → API Wrapper → supabase.functions.invoke() → Edge Function
    ▲                                                        │
    │                               ┌────────────────────────┘
    │                               ▼
    │                   ┌───────────────────────┐
    │                   │ 1. Verify JWT         │
    │                   │ 2. Lookup profile     │
    │                   │ 3. Business validation│
    │                   │ 4. Multi-table write  │
    │                   │ 5. Return result      │
    │                   └───────────────────────┘
    │                               │
    └────────── JSON Response ──────┘
```

**Example:** Complete Sale

```typescript
// src/lib/api/sales.ts
export async function completeSale(request: CompleteSaleRequest) {
  const { data, error } = await supabase.functions.invoke('complete-sale', {
    body: request,
  });

  // Network/invocation error
  if (error) {
    throw {
      error: error.message,
      code: 'NETWORK_ERROR',
    };
  }

  // Business error (returned in response body)
  if (data?.error) {
    throw {
      error: data.error,
      code: data.code,
    };
  }

  return data as CompleteSaleResponse;
}
```

**Edge Function Flow (complete-sale):**

```typescript
// supabase/functions/complete-sale/index.ts
Deno.serve(async (req) => {
  // 1. CORS handling
  if (req.method === 'OPTIONS') return corsResponse;

  // 2. JWT Verification
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error) return unauthorizedResponse;

  // 3. Profile Lookup
  const profile = await getProfile(user.id);
  if (!profile?.shop_id) return forbiddenResponse;

  // 4. Idempotency Check
  const existingSale = await checkClientSaleId(body.client_sale_id);
  if (existingSale) return { existing: true, sale: existingSale };

  // 5. Business Validation
  for (const item of body.items) {
    const inventory = await getInventoryItem(item.qr_code);
    if (inventory.status !== 'available') {
      return { error: 'Item not available', code: 'ITEM_UNAVAILABLE' };
    }
  }

  // 6. Atomic Transaction (using service role)
  const sale = await createSaleWithItems(body, profile);

  // 7. Return Success
  return { success: true, sale };
});
```

---

### Pattern 3: Offline Queue (Deferred Sync)

Used for: POS sales when offline

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           ONLINE FLOW                                       │
│                                                                             │
│  Checkout → completeSale() → Edge Function → Success → Clear Cart           │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                           OFFLINE FLOW                                      │
│                                                                             │
│  Checkout → !isOnline → addPendingSale(IndexedDB) → Show "Queued" Toast    │
│                                        │                                    │
│                                        ▼                                    │
│                              SyncContext monitors                           │
│                                        │                                    │
│                              When online detected:                          │
│                                        │                                    │
│                                        ▼                                    │
│                              syncSale() → Edge Function                     │
│                                        │                                    │
│                              Success? → deletePendingSale()                 │
│                              Failure? → Mark status='failed', retryCount++  │
└─────────────────────────────────────────────────────────────────────────────┘
```

**IndexedDB Stores:**

| Store | Purpose | Key |
|-------|---------|-----|
| `pendingSales` | Queued sales awaiting sync | `client_sale_id` (string) |
| `inventoryCache` | Cached product info for offline lookup | `qrCode` (string) |
| `failedSales` | Permanently failed transactions | `id` (auto-increment) |

---

## Validation Ownership

### Layer Responsibilities

| Layer | Validation Type | Examples |
|-------|-----------------|----------|
| **UI Components** | User input, UX constraints | Required fields, format hints |
| **API Wrappers** | Request shape, type coercion | TypeScript interfaces |
| **Edge Functions** | Business rules, authorization | Role checks, inventory status |
| **Database (RLS)** | Data access, row-level security | shop_id scoping |
| **Database (Constraints)** | Data integrity | Foreign keys, enums, NOT NULL |

### Validation Examples

**1. UI Level (Component)**
```tsx
// CheckoutDialog.tsx
const handleCheckout = () => {
  if (cart.length === 0) {
    toast.error('Cart is empty');
    return;
  }
  if (!paymentMethod) {
    toast.error('Select payment method');
    return;
  }
  // Proceed to API call
};
```

**2. API Wrapper Level**
```typescript
// src/lib/api/sales.ts
export interface CompleteSaleRequest {
  client_sale_id: string;      // Required
  items: SaleItem[];           // Non-empty array
  payment_method: string;      // Required
  customer_name?: string;      // Optional
}

// TypeScript enforces shape at compile time
```

**3. Edge Function Level**
```typescript
// supabase/functions/complete-sale/index.ts

// Authorization
if (!['admin', 'owner', 'staff'].includes(profile.role)) {
  return { error: 'Unauthorized', code: 'FORBIDDEN' };
}

// Business validation
if (body.items.length === 0) {
  return { error: 'No items in sale', code: 'VALIDATION_ERROR' };
}

// State validation
for (const item of body.items) {
  const inv = await getInventory(item.inventory_item_id);
  if (inv.status !== 'available') {
    return { 
      error: `Item ${item.qr_code} is ${inv.status}`,
      code: 'ITEM_NOT_AVAILABLE'
    };
  }
}
```

**4. Database Level**
```sql
-- RLS Policy
CREATE POLICY "Users can only see their shop's sales"
ON sales FOR SELECT
USING (shop_id = current_shop_id());

-- Constraint
ALTER TABLE inventory_items
ADD CONSTRAINT valid_status
CHECK (status IN ('available', 'reserved', 'sold', 'damaged', 'returned'));
```

---

## Error Propagation

### Error Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          ERROR PROPAGATION                                  │
│                                                                             │
│  Database Error (Constraint)                                                │
│       │                                                                     │
│       ▼                                                                     │
│  Edge Function catches → Returns { error, code, details }                   │
│       │                                                                     │
│       ▼                                                                     │
│  API Wrapper detects error → Throws structured error                        │
│       │                                                                     │
│       ▼                                                                     │
│  Component catches → Shows toast / Updates UI state                         │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Error Categories

| Category | Code Pattern | User-Facing Message | Action |
|----------|--------------|---------------------|--------|
| Network | `NETWORK_ERROR` | "Connection failed" | Retry or queue |
| Auth | `UNAUTHORIZED`, `FORBIDDEN` | "Please log in again" | Redirect to login |
| Validation | `VALIDATION_ERROR` | "Please check your input" | Show field errors |
| Business | `ITEM_NOT_AVAILABLE`, etc. | Context-specific | Show specific message |
| Server | `INTERNAL_ERROR` | "Something went wrong" | Log and report |

### Error Handling Example

```typescript
// Component
const handleCheckout = async () => {
  try {
    await completeSale(saleData);
    toast.success('Sale completed!');
    clearCart();
  } catch (error: any) {
    if (error.code === 'ITEM_NOT_AVAILABLE') {
      toast.error(`Item no longer available: ${error.details}`);
      // Remove unavailable item from cart
      removeItemFromCart(error.details.qr_code);
    } else if (error.code === 'NETWORK_ERROR') {
      // Queue for offline sync
      await addPendingSale(saleData);
      toast.info('Sale queued for sync');
      clearCart();
    } else {
      toast.error(error.error || 'Sale failed');
    }
  }
};
```

---

## Data Ownership by Domain

### Inventory Domain

```
Owner: Admin/Owner
Tables: lots, inventory_items, qr_codes, categories, sizes
Write Path: add-stock-lot Edge Function
Read Path: Direct Supabase queries with RLS

Key Invariant: qr_code ↔ inventory_item is 1:1
```

### Sales Domain

```
Owner: Staff (create), Admin (view all)
Tables: sales, sale_items, financial_transactions
Write Path: complete-sale Edge Function
Read Path: Direct queries, TanStack Query caching

Key Invariant: client_sale_id is unique (idempotency)
```

### Staff Domain

```
Owner: Staff (self), Admin (team)
Tables: profiles, attendance_logs, staff_checklist_assignments
Write Path: Direct mutations (attendance), Edge Function (complex)
Read Path: Direct queries with shop_id filter

Key Invariant: Staff can only modify own attendance
```

---

## Caching Strategy

### Client-Side Caching

**TanStack Query:**
```typescript
const { data } = useQuery({
  queryKey: ['inventory', shopId, 'available'],
  queryFn: () => fetchAvailableInventory(),
  staleTime: 30_000,        // Consider fresh for 30s
  gcTime: 5 * 60_000,       // Keep in cache for 5min
});
```

**IndexedDB (Offline):**
```typescript
// Cache inventory for offline lookup
await cacheInventoryItem({
  qrCode: item.qr_code.code,
  itemId: item.id,
  lotId: item.lot_id,
  price: item.lot.selling_price_default,
  category: item.lot.category?.name,
  size: item.lot.size?.size_name,
  taxRate: item.lot.tax_rate,
});
```

### Server-Side Caching

- No explicit caching layer (PostgREST direct to PostgreSQL)
- Database indexes for common query patterns
- Edge Function responses are not cached

---

## Data Mutations Checklist

When adding a new mutation:

- [ ] Define TypeScript interfaces for request/response
- [ ] Add UI-level validation in component
- [ ] Create API wrapper function in `src/lib/api/`
- [ ] For simple CRUD: Use direct Supabase mutations
- [ ] For complex transactions: Create Edge Function
- [ ] Handle errors with user-friendly messages
- [ ] Consider offline behavior (queue or block?)
- [ ] Invalidate TanStack Query cache on success
- [ ] Test with RLS policies (different roles)

---

## Quick Reference

| Operation | Pattern | Validation Layers | Offline Support |
|-----------|---------|-------------------|-----------------|
| Fetch inventory | Direct query | RLS | Read from cache |
| Complete sale | Edge Function | UI → Edge → DB | Queued |
| Add stock | Edge Function | UI → Edge → DB | Blocked |
| Update attendance | Direct mutation | UI → RLS | Blocked |
| Fetch dashboard stats | Direct query | RLS | N/A (online only) |
