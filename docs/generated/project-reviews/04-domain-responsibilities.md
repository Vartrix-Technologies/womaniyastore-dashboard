# Domain Responsibilities

> Map of business domains, their boundaries, responsibilities, and interaction patterns.

---

## Domain Overview

Womaniya Dashboard is organized around five core business domains:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CORE DOMAINS                                   │
│                                                                             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐             │
│  │   INVENTORY     │  │     SALES       │  │     STAFF       │             │
│  │   (Products)    │  │   (POS/Orders)  │  │ (HR/Attendance) │             │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘             │
│           │                    │                    │                       │
│           └────────────────────┼────────────────────┘                       │
│                                │                                            │
│                       ┌────────▼────────┐                                   │
│                       │     SHOP        │                                   │
│                       │ (Multi-tenant)  │                                   │
│                       └────────┬────────┘                                   │
│                                │                                            │
│                       ┌────────▼────────┐                                   │
│                       │     FINANCE     │                                   │
│                       │ (Transactions)  │                                   │
│                       └─────────────────┘                                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Domain 1: Shop (Multi-Tenancy Core)

### Responsibility

The foundational domain that enables multi-tenant data isolation. Every other domain's data is scoped to a shop.

### Boundaries

```
Tables:
├── shops (Core tenant entity)
├── tax_settings (Shop-level configuration)
└── (All other tables have shop_id FK)

Owned By: Superadmin (create), Owner (configure)
```

### Key Entities

```typescript
interface Shop {
  id: string;
  shop_name: string;
  bill_prefix: string;      // e.g., "WOM" → Bills: WOM-001
  tax_rate: number;         // Default GST rate
  address: string | null;
  phone: string | null;
}
```

### Relationships

```
Shop (1) ────── (N) Profiles (staff belong to shop)
Shop (1) ────── (N) Inventory Items
Shop (1) ────── (N) Sales
Shop (1) ────── (N) Categories
Shop (1) ────── (N) Sizes
Shop (1) ────── (1) Tax Settings
```

### Routes

| Route | Purpose |
|-------|---------|
| `/superadmin` | Create/manage shops (superadmin only) |
| `/admin/settings` | Configure shop settings (owner/admin) |

---

## Domain 2: Inventory

### Responsibility

Manage product lifecycle from stock arrival to sale or damage. Track individual items via QR codes.

### Boundaries

```
Tables:
├── lots (Stock batches)
├── inventory_items (Individual trackable units)
├── qr_codes (Unique identifiers)
├── categories (Product categories)
├── sizes (Size options)
└── inventory_adjustments (Status change audit)

API Files:
├── src/lib/api/inventory.ts
├── supabase/functions/add-stock-lot/
```

### Key Entities

```typescript
interface Lot {
  id: string;
  category_id: string;
  size_id: string | null;
  free_text_size: string | null;
  vendor_name: string | null;
  date_of_stock_arrival: string;
  cost_price_per_unit: number;
  selling_price_default: number;
  tax_rate: number;
  quantity: number;
  shop_id: string;
}

interface InventoryItem {
  id: string;
  lot_id: string;
  qr_code_id: string;
  status: 'available' | 'reserved' | 'sold' | 'damaged' | 'returned';
  shop_id: string;
  sold_at: string | null;
  sale_item_id: string | null;
}

interface QrCode {
  id: string;
  code: string;              // e.g., "WOM-A001"
  status: 'unused' | 'assigned' | 'sold' | 'lost';
  shop_id: string;
}
```

### Status State Machine

```
┌─────────┐
│ unused  │ (QR code generated, not linked to inventory)
└────┬────┘
     │ add-stock-lot Edge Function
     ▼
┌─────────┐
│assigned │ (QR linked to inventory_item)
└────┬────┘
     │
     ├──────────────────────────────────────────────────┐
     │                                                  │
     ▼                                                  ▼
┌─────────┐                                      ┌──────────┐
│available│ ────── Sale ─────────────────────────│   sold   │
└────┬────┘                                      └──────────┘
     │                                                  │
     │ Manual Adjustment                                │ Return
     ▼                                                  ▼
┌─────────┐                                      ┌──────────┐
│ damaged │                                      │ returned │
└─────────┘                                      └──────────┘
```

### Business Rules

1. **One QR = One Item**: `qr_code_id` is unique on `inventory_items`
2. **Stock Addition Atomic**: Lot + Items + QR assignments in single transaction
3. **Adjustments Audited**: Status changes logged to `inventory_adjustments`
4. **Price from Lot**: Items inherit `selling_price_default` from lot

### Routes

| Route | Purpose |
|-------|---------|
| `/admin/inventory` | View/search inventory |
| `/admin/inventory/add-stock` | Add new stock lot |
| `/admin/qr-codes` | Manage QR codes |

---

## Domain 3: Sales

### Responsibility

Process point-of-sale transactions, track financial records, and support offline operation.

### Boundaries

```
Tables:
├── sales (Transaction header)
├── sale_items (Line items)
├── sale_returns (Return processing)
└── financial_transactions (Accounting records)

API Files:
├── src/lib/api/sales.ts
├── supabase/functions/complete-sale/

Components:
├── src/components/pos/
├── src/app/(protected)/pos/
```

### Key Entities

```typescript
interface Sale {
  id: string;
  bill_number: number;       // Auto-generated per shop
  client_sale_id: string;    // Idempotency key
  shop_id: string;
  created_by: string;        // Staff profile ID
  payment_method: 'cash' | 'upi' | 'card' | 'other';
  subtotal_amount: number;
  total_discount: number;
  total_tax: number;
  total_amount: number;
  customer_name: string | null;
  customer_phone: string | null;
}

interface SaleItem {
  id: string;
  sale_id: string;
  inventory_item_id: string;
  original_price: number;
  final_price: number;
  discount_reason: string | null;
  tax_amount: number;
}
```

### Offline Support

```typescript
interface PendingSale {
  id: string;                // client_sale_id
  status: 'pending' | 'syncing' | 'synced' | 'failed';
  items: Array<{
    qrCode: string;
    originalPrice: number;
    finalPrice: number;
    discountReason?: string;
  }>;
  paymentMethod: string;
  customerName?: string;
  customerPhone?: string;
  createdAt: string;
  retryCount?: number;
  lastError?: string;
}
```

### Business Rules

1. **Idempotent**: `client_sale_id` prevents duplicate processing
2. **Bill Numbers**: Auto-incremented per shop via database function
3. **Discount Limits**: Staff have `max_discount_percent` in profile
4. **Inventory Updated**: Items marked `sold` on completion
5. **Financial Record**: `financial_transaction` created with type `sale`

### Sale Completion Flow

```
1. Client generates UUID (client_sale_id)
2. Edge Function receives sale request
3. Check idempotency (existing client_sale_id?)
4. Validate all items are available
5. Create sale record
6. Create sale_items records
7. Update inventory_items.status → 'sold'
8. Create financial_transaction
9. Return sale with bill_number
```

### Routes

| Route | Purpose |
|-------|---------|
| `/pos` | Point of sale interface |
| `/admin/sales` | Sales history & reports |

---

## Domain 4: Staff

### Responsibility

Manage shop staff, track attendance, and assign daily tasks.

### Boundaries

```
Tables:
├── profiles (User accounts + roles)
├── attendance_logs (Clock in/out records)
├── checklists (Task templates)
├── checklist_items (Individual tasks)
├── staff_checklist_assignments (Daily assignments)
└── staff_checklist_item_status (Task completion)

Components:
├── src/components/staff/
├── src/app/(protected)/me/
├── src/app/(protected)/admin/staff/
├── src/app/(protected)/admin/attendance/
├── src/app/(protected)/admin/checklists/
```

### Key Entities

```typescript
interface Profile {
  id: string;                // Matches auth.users.id
  full_name: string;
  phone: string | null;
  role: 'superadmin' | 'owner' | 'admin' | 'staff';
  shop_id: string | null;    // null for superadmin
  is_active: boolean;
  max_discount_percent: number;
}

interface AttendanceLog {
  id: string;
  staff_id: string;
  shop_id: string;
  date: string;
  clock_in: string;
  clock_out: string | null;
  status: 'open' | 'closed';
  total_break_minutes: number;
  is_manual_entry: boolean;
  manual_entry_reason: string | null;
  // Audit fields for edits/deletes
  edited_by: string | null;
  edit_reason: string | null;
  deleted_by: string | null;
  delete_reason: string | null;
}

interface Checklist {
  id: string;
  name: string;
  description: string | null;
  shop_id: string;
  is_active: boolean;
}
```

### Role Hierarchy

```
superadmin (Global)
    │
    └── Can manage all shops
    
owner (Per Shop)
    │
    └── Full shop control, can manage admins
    
admin (Per Shop)
    │
    └── Manage staff, inventory, sales
    
staff (Per Shop)
    │
    └── POS access, own attendance/tasks
```

### Business Rules

1. **Role Constraints**: Staff can only modify own attendance
2. **Audit Trail**: Edits/deletes require reason and are tracked
3. **Daily Checklists**: Auto-assigned by Edge Function (create-daily-checklists)
4. **Active Status**: Inactive profiles blocked from login (TODO: enforce)

### Routes

| Route | Purpose |
|-------|---------|
| `/me` | Staff personal dashboard |
| `/admin/staff` | Manage staff accounts |
| `/admin/attendance` | View/edit attendance |
| `/admin/checklists` | Manage task templates |

---

## Domain 5: Finance

### Responsibility

Track all financial movements including sales revenue, expenses, and adjustments.

### Boundaries

```
Tables:
├── financial_transactions (All money movements)
└── expense_categories (Expense classification)

Routes:
├── /admin/finances
```

### Key Entities

```typescript
interface FinancialTransaction {
  id: string;
  shop_id: string;
  type: 'sale' | 'expense' | 'adjustment';
  amount: number;
  description: string | null;
  payment_method: string | null;
  expense_category_id: string | null;  // For expenses
  related_sale_id: string | null;      // For sales
  occurred_at: string;
  created_by: string;
}

interface ExpenseCategory {
  id: string;
  name: string;
  description: string | null;
  shop_id: string;
}
```

### Business Rules

1. **Auto-Created for Sales**: `complete-sale` creates transaction
2. **Manual Expenses**: Admin enters with category
3. **Immutable**: Transactions are insert-only (no updates)

---

## Cross-Domain Interactions

### Sale → Inventory

```
complete-sale Edge Function:
1. Validate inventory_items.status === 'available'
2. Create sale + sale_items
3. UPDATE inventory_items SET status = 'sold'
4. UPDATE qr_codes SET status = 'sold'
```

### Sale → Finance

```
complete-sale Edge Function:
1. Create sale record
2. INSERT financial_transaction (type='sale', related_sale_id)
```

### Staff → Attendance → Checklists

```
create-daily-checklists Edge Function (scheduled):
1. Get all active checklists for shop
2. Get all staff with attendance for today
3. Create staff_checklist_assignments for each staff
```

---

## Shared vs Isolated Logic

### Shared Components (`src/components/shared/`)

- `ConfirmDialog` - Generic confirmation modal
- `DateRangePicker` - Date selection
- `ExportButton` - CSV export functionality
- `InventoryItemDetailsDialog` - View item details (read-only)
- `QrCodeDetailsDialog` - View QR details (read-only)

### Domain-Specific Components

| Domain | Component Folder | Purpose |
|--------|-----------------|---------|
| POS/Sales | `src/components/pos/` | Cart, checkout, scanning |
| Staff | `src/components/staff/` | Attendance cards, calendars |
| Admin | `src/components/admin/` | Attendance CRUD dialogs |
| Layout | `src/components/tablet/` | Navigation, top bar |

### Shared Utilities (`src/lib/`)

| File | Purpose |
|------|---------|
| `utils.ts` | `cn()` classname merge, generic helpers |
| `formatters.ts` | Date, currency formatting |
| `constants.ts` | App-wide constants |
| `supabase.ts` | Database client singleton |

---

## Domain Boundaries Checklist

When adding a new feature, determine:

1. **Which domain owns it?**
   - Data tables → Domain's API folder
   - UI components → Domain's component folder

2. **Does it cross domains?**
   - Yes → Consider Edge Function for atomicity
   - No → Direct Supabase mutations acceptable

3. **Who can access it?**
   - All staff → Available in POS or /me
   - Admin only → Under /admin/* with role check
   - Superadmin → Under /superadmin/*

4. **Does it need offline support?**
   - Yes → Add to IndexedDB schema, handle in SyncContext
   - No → Block operation when offline
