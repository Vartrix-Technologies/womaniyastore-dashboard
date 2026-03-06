# File Review: components/pos

**Folder:** `src/components/pos/`
**Files:** 5 (CartList.tsx, CartSummary.tsx, CheckoutDialog.tsx, ProductSearchDialog.tsx, ScanQRButton.tsx)
**Total Lines:** ~1,173
**Last Updated:** 2026-01-01

---

## Folder Overview

Point-of-Sale UI components for the sales workflow. Components handle cart management, product discovery, checkout, and offline-first sale completion.

---

## 1. File Responsibilities

### CartList.tsx (149 lines)

**Primary Responsibility:** Display cart items in tabular format with inline price editing and discount management.

**Key Features:**
- Table layout with responsive horizontal scroll
- Inline price editing with discount validation
- Discount percentage calculation and display
- Discount reason input (appears when discounted)
- Per-item remove action

**Does NOT:**
- Manage cart state (receives via props)
- Calculate totals (handled by CartSummary)
- Persist changes (callbacks to parent)

### CartSummary.tsx (62 lines)

**Primary Responsibility:** Pure calculation and display of cart totals including subtotal, discount, tax, and grand total.

**Key Features:**
- Subtotal from original prices
- Total discount across all items
- Per-item tax calculation (GST)
- Optional coupon code display
- Clean separator between line items and grand total

**Does NOT:**
- Handle any user interactions
- Manage coupon validation
- Store or persist any state

### CheckoutDialog.tsx (245 lines)

**Primary Responsibility:** Complete sale transaction with online/offline support.

**Key Features:**
- Payment method selection (cash, UPI, card, other)
- Optional customer details capture
- Online sale via Edge Function
- Offline fallback to IndexedDB
- Business error detection (prevents offline queue for validation errors)

**Does NOT:**
- Manage cart (receives items via props)
- Print receipts
- Handle payment processing (just records method)

### ProductSearchDialog.tsx (404 lines)

**Primary Responsibility:** Search and add available inventory items to cart.

**Key Features:**
- Debounced auto-search (500ms)
- Client-side filtering (QR, category, size)
- Manual code entry mode
- Offline cache fallback
- Duplicate prevention (filters existing cart QR codes)

**Does NOT:**
- Display sold items
- Add items in bulk
- Show item details beyond basic info

### ScanQRButton.tsx (287 lines)

**Primary Responsibility:** QR code scanning via device camera with manual fallback.

**Key Features:**
- Html5Qrcode camera integration
- Loading overlay during processing
- Manual entry dialog as alternative
- Offline cache lookup
- Sold item detection and rejection

**Does NOT:**
- Support multiple scans without closing
- Keep scanner running in background
- Handle barcode formats (QR only)

---

## 2. Execution Flows

### CartList - Price Editing Flow

```
User edits price → handlePriceChange (local state)
  → onBlur → handlePriceBlur
    → Calculate discount percentage
    → Check against profile.max_discount_percent
    → If exceeds: toast error, reset to finalPrice
    → If valid: onUpdatePrice callback
```

### CheckoutDialog - handleComplete()

```
Validate items exist → Build saleData with client_sale_id
  → If online:
      → Try completeSale() Edge Function
      → On success: toast with bill number, onComplete()
      → On business error (not found, already sold): toast error, return
      → On network error: save to IndexedDB, toast warning
  → If offline:
      → Save to IndexedDB via addPendingSale()
      → toast success
```

**Client Sale ID Generation:**
```typescript
`sale-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
```

### ProductSearchDialog - Search Flow

```
User types → Debounce 500ms → handleSearch()
  → Query inventory_items WHERE status='available', sold_at=null
  → Client-side filter by search term (QR, category, size)
  → Filter out existingQrCodes
  → Limit to 20 results
  → Display or "No products found" message
```

### ScanQRButton - processQRCode()

```
Receive code → Check isOnline
  → Online: Try searchInventoryByQRCode API
      → On fail: Try getCachedInventoryItem
  → Offline: getCachedInventoryItem only
  → Check if sold (sold_at or sale_id exists)
  → Build CartItem from response
  → onItemScanned callback
```

---

## 3. Business Rules & Assumptions

### Explicit Business Rules

| Rule | Implementation | File |
|------|----------------|------|
| Discount cannot exceed max_discount_percent | Validation in handlePriceBlur | CartList |
| Price can be reduced, not increased | Input max={originalPrice} | CartList |
| Discount requires reason | Input appears when hasDiscount | CartList |
| Sold items rejected | Check sold_at/sale_id | ScanQRButton, ProductSearchDialog |
| Business errors not queued offline | Error message pattern matching | CheckoutDialog |
| Cart items must be unique | existingQrCodes filter | ProductSearchDialog |

### Implicit Assumptions
- `profile.max_discount_percent` exists and is a number
- Tax rate stored per item/lot (not global)
- Sale ID format: `sale-{timestamp}-{random}`
- Cart items have taxRate property
- Offline cache contains required item data

### Business Error Detection (CheckoutDialog)

```typescript
// These errors indicate data issues, not network problems
// Should not be saved for later sync
errorMessage.includes('not found') || 
errorMessage.includes('already sold') || 
errorMessage.includes('not available') ||
errorMessage.includes('exceeds limit')
```

---

## 4. Risks & Edge Cases

### High Priority

| Risk | Impact | File | Mitigation |
|------|--------|------|------------|
| Sold item in cart | Invalid sale | ScanQRButton | Check sold_at before adding |
| Offline queue for business errors | Repeated failures | CheckoutDialog | Error message pattern matching |
| Camera permission denied | Can't scan | ScanQRButton | Toast error, scanner closes |

### Medium Priority

| Risk | Impact | File | Mitigation |
|------|--------|------|------------|
| 100-item query limit | May miss results | ProductSearchDialog | Shows top matches, has manual entry |
| Stale offline cache | Wrong price/status | ScanQRButton, ProductSearch | Sync on reconnect expected |
| Rapid scanning | Duplicate processing | ScanQRButton | `if (loading) return` guard |

### Low Priority

| Risk | Impact | File | Mitigation |
|------|--------|------|------------|
| Empty cart checkout | Blocked | CheckoutDialog | `if (items.length === 0) return` |
| Negative tax | Wrong total | CartSummary | Assumes valid taxRate from DB |
| Missing customer phone format | Invalid data | CheckoutDialog | No validation (optional field) |

---

## 5. Comment Suggestions (Selective)

### CartList - Lines ~27-34
```typescript
// Enforce staff discount limits at cart level
// max_discount_percent comes from profile.max_discount_percent
// Exceeding triggers toast and resets to previous price
const discountPercent = ((item.originalPrice - newPrice) / item.originalPrice) * 100;
if (discountPercent > maxDiscount) {
  toast.error(`Discount cannot exceed ${maxDiscount}%...`);
```

### CheckoutDialog - Lines ~77-89
```typescript
// Business logic errors should NOT be saved for offline sync
// These indicate data problems that won't resolve on retry:
// - Item not found: QR code invalid
// - Already sold: Concurrent sale
// - Not available: Status changed
// - Exceeds limit: Validation failure
if (errorMessage.includes('not found') || 
    errorMessage.includes('already sold') || ...
```

### ScanQRButton - Lines ~98-120
```typescript
// Online-first with offline fallback pattern:
// 1. If online: Try API, fall back to cache on failure
// 2. If offline: Use cache only
// This ensures freshest data when possible while maintaining offline capability
```

### ProductSearchDialog - Lines ~76-84
```typescript
// Query fetches available items first, then filters client-side
// This approach handles the case where search term matches partial QR codes
// or category/size names that Supabase text search might miss
```

---

## 6. Refactor Signals

### ProductSearchDialog & ScanQRButton Duplication

Both files contain nearly identical:
- `processQRCode` / `handleManualEntry` logic
- Online/offline data fetching pattern
- CartItem construction from different data shapes

**Extract to:**
```typescript
// lib/pos/item-lookup.ts
export async function lookupInventoryItem(code: string, isOnline: boolean): Promise<CartItem>
```

### Type Safety Issues

```typescript
// ProductSearchDialog uses inline interface SearchResult
// Should import shared type from pos.types.ts

// CheckoutDialog saleData could use SaleRequest type
// CartItem construction duplicated with different property mappings
```

### State Management

Consider React Context or Zustand for cart state instead of prop drilling:
- `onAddToCart`, `onRemoveItem`, `onUpdatePrice` callbacks
- `existingQrCodes` computed from cart state
- Centralized cart clearing after checkout

### Scanner Lifecycle

```typescript
// ScanQRButton cleanup could be more robust
useEffect(() => {
  return () => {
    if (scannerRef.current) {
      scannerRef.current.stop().catch(() => {});
    }
  };
}, []);
// Consider: What if component unmounts during active scan?
```

---

## Summary Assessment

| Aspect | Rating | Notes |
|--------|--------|-------|
| Readability | ✅ Good | Clear single-responsibility components |
| Maintainability | ⚠️ Moderate | Duplication in lookup logic |
| Error Handling | ✅ Good | Business vs network error distinction |
| Offline Support | ✅ Excellent | Comprehensive fallback patterns |
| Performance | ✅ Good | Debounced search, limited results |
| Type Safety | ⚠️ Moderate | Inline types, any in some places |

---

## 7. Critic Section: Premium & Modern Assessment

### What Works Well ✅

| Component | Why It's Good |
|-----------|---------------|
| **CheckoutDialog** | Offline fallback with IndexedDB—essential for retail |
| **CartList** | Inline price editing with discount validation |
| **ScanQRButton** | Camera integration with manual fallback |
| **ProductSearchDialog** | Debounced search, filters existing cart items |

### What Feels Dated or Unpolished ❌

| Issue | Component | Premium Comparison |
|-------|-----------|-------------------|
| **No product images** | CartList | Square shows product thumbnails |
| **Text-only cart** | CartList | Shopify POS has visual product cards |
| **No sound feedback** | ScanQRButton | Retail scanners beep on scan |
| **No batch scan mode** | ScanQRButton | Scan multiple items without closing |
| **Plain payment buttons** | CheckoutDialog | Square shows colorful payment icons |
| **No customer search** | CheckoutDialog | Most POS have customer database |
| **No receipt preview** | CheckoutDialog | Show what will print/send |

### Missing Premium POS Features

1. **Visual Cart with Product Images**
   ```
   ┌────────────────────────────────────────────────────┐
   │ CART (3 items)                                     │
   │ ┌──────┐                                           │
   │ │ [img]│ Blue Kurta - Size M         ₹499        │
   │ │      │ QR: WA-499-0012                          │
   │ └──────┘ [Edit Price] [Remove]                    │
   └────────────────────────────────────────────────────┘
   ```

2. **Scan Sound Effects**
   ```typescript
   // Play beep on successful scan
   const successSound = new Audio('/sounds/scan-success.mp3');
   successSound.play();
   
   // Error sound for already-sold items
   const errorSound = new Audio('/sounds/scan-error.mp3');
   ```

3. **Continuous Scan Mode**
   - Keep scanner running between items
   - Sound feedback for each scan
   - Visual queue of scanned items

4. **Customer Database**
   - Search by phone number
   - Loyalty points display
   - Purchase history preview

### Comparison to Premium POS Apps

| App | Feature You're Missing |
|-----|----------------------|
| **Square POS** | Customer profiles, item images, tip suggestions |
| **Shopify POS** | Product images, customer notes, split payments |
| **Lightspeed** | Staff attribution, layaway, order holds |
| **Toast** | Table management, modifiers, kitchen display |

### Priority Improvements (Effort vs Impact)

| Improvement | Effort | Impact | Priority |
|-------------|--------|--------|----------|
| Extract shared lookupItem utility | Low | High | **P1** |
| Add scan success/error sounds | Low | Medium | **P2** |
| Product images in cart (if available) | Medium | Medium | **P2** |
| Continuous scan mode | Medium | Medium | **P3** |
| Customer search/select | High | Medium | **P3** |

### Key Quote for Your Team
> "These POS components have excellent offline support—the IndexedDB fallback in CheckoutDialog is genuinely well-implemented. But the visual design is utilitarian. Adding scan sounds (trivial to implement) and product images in the cart (if you have them) would make staff feel like they're using a real retail system instead of a developer tool."
