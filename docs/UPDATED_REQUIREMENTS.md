# Womaniya Dashboard - Production Requirements (Updated v2.0)

You are an expert full-stack engineer (Next.js + TypeScript + Supabase + PWA) and solution architect.
Your job is to help me design and build a production-ready web app following the exact requirements below.
Please read everything carefully, respect the architecture decisions, and when generating code, keep it modular, typed, and clean.

---

## 1. Business Context

I'm building a custom dashboard + POS system for a small clothing shop called **Womaniya Airoli**.

The system will:
- Run as a **PWA app on a tablet** installed in the shop
- Provide:
  - Inventory dashboard & unique-item tracking (via pre-printed QR codes)
  - Integrated billing / POS
  - Finances tracking (sales + expenses, with reports & charts)
  - Attendance management (clock in/out, breaks)
  - Checklist management for staff (opening/closing tasks, etc.)
- Have different dashboards for admin vs staff:
  - **Admin**: full control over all modules
  - **Staff**: POS, attendance, checklist, quick add for missing inventory items

The app is **cloud-based (online-first)**, but must work **offline at checkout** and sync sales later when internet is back.

---

## 2. Tech Stack & Architecture Constraints

Use this stack and these patterns:

### Backend / Data Layer
- **Supabase**:
  - Postgres (with proper indexing for performance)
  - Auth
  - Edge Functions (TypeScript)
  - Row Level Security (RLS)
- DB schema and role model are defined below and must be followed

### Frontend
- **Next.js 14+** (React) with **TypeScript**
  - Use the **App Router** (`app/` directory)
  - The app must be compatible with **`next export`** (static export)
  - Do NOT rely on SSR, server actions, or API routes that require a Node server
  - Treat it as a **client-heavy PWA** that talks directly to Supabase via its JS client and Edge Functions
  
- **UI**:
  - **shadcn/ui** components (Radix UI primitives)
  - **Tailwind CSS** for styling (required, not optional)
  - Tablet-optimized design (≥44px touch targets, 18px base font)
  
- **Routing**:
  - Use Next.js file-based routing in `app/` to create the routes listed in the Frontend Architecture section

### Additional Libraries
- **html5-qrcode** - QR code scanning
- **idb** - IndexedDB wrapper for offline storage
- **Recharts** - Data visualization
- **xlsx** - Excel export
- **TanStack Table** (React Table v8) - Data grids
- **react-hook-form + Zod** - Form validation
- **Sonner** - Toast notifications
- **date-fns** - Date utilities

### Hosting
- **Frontend**: Build with `next build && next export` and deploy the static `out/` folder to **Firebase Hosting**
- **Backend**: Supabase project (managed Postgres + Auth + Edge Functions)

### PWA
- PWA capable:
  - `manifest.json` configured
  - Service worker (custom or via Next.js-compatible PWA setup)
- Installed on a tablet; main orientation: **portrait**
- Offline cache critical routes: `/`, `/pos`, `/me/attendance`

### Offline
- **Offline-aware POS** using IndexedDB for pending sales
- A **sync engine** that pushes offline sales to Supabase when online using the `complete_sale` Edge Function
- Auto-retry with exponential backoff (max 3 retries)

**When generating code, do not change the core architecture (Next.js + static export + Supabase + Firebase Hosting) unless explicitly asked.**

---

## 3. Roles, Auth & Security (Conceptual)

**Supabase Auth** is used for authentication. There is a `profiles` table that links to `auth.users` via `id`.

### User roles (`profiles.role`):
- `superadmin` – developer account (me), has global read/admin abilities
- `owner` – shop owner
- `admin` – store manager
- `staff` – normal employee

### Rules:
- A user belongs to exactly one shop via `profiles.shop_id`
- `superadmin` can see everything across shops
- `owner` / `admin` can manage all data for their shop
- `staff` can:
  - Use POS (create sales)
  - See their own attendance
  - See and complete their assigned checklists
  - Cannot directly modify finances structure or inventory logic outside defined flows
  - **Limited discount authority**: Enforced via `profiles.max_discount_percent`

### Row Level Security (RLS):
- Use RLS on **all tables** with patterns:
  - Most tables are filtered by `shop_id = current_shop_id()` for normal users
  - `superadmin` bypasses restrictions with a DB helper `is_superadmin()`

### DB helper functions:
```sql
SELECT public.current_profile();
SELECT public.current_shop_id();
SELECT public.current_role();
SELECT public.is_admin();
SELECT public.is_staff_or_higher();
SELECT public.is_superadmin();
```

Use these functions in RLS policies.

---

## 4. Database Schema (Supabase / Postgres)

Use exactly this schema, unless minor technical adjustments are needed. This is the source of truth for data design.

### 4.1 Enums

```sql
CREATE TYPE user_role AS ENUM ('superadmin', 'owner', 'admin', 'staff');
CREATE TYPE qr_status AS ENUM ('unused', 'assigned', 'sold', 'lost');
CREATE TYPE inventory_status AS ENUM ('available', 'reserved', 'sold', 'damaged', 'returned');
CREATE TYPE financial_tx_type AS ENUM ('sale', 'expense', 'adjustment');
CREATE TYPE attendance_status AS ENUM ('open', 'closed');
CREATE TYPE checklist_status AS ENUM ('pending', 'completed', 'partial');
CREATE TYPE checklist_item_status AS ENUM ('pending', 'done', 'na');
```

### 4.2 Core Tables

```sql
CREATE TABLE public.shops (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  address    text,
  phone      text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.profiles (
  id                    uuid PRIMARY KEY,  -- same as auth.users.id
  full_name             text NOT NULL,
  phone                 text,
  role                  user_role NOT NULL DEFAULT 'staff',
  shop_id               uuid REFERENCES public.shops(id) ON DELETE SET NULL,
  is_active             boolean NOT NULL DEFAULT true,
  max_discount_percent  numeric(5,2) NOT NULL DEFAULT 0,  -- NEW: Discount limit
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.categories (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id    uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  name       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (shop_id, name)
);

CREATE TABLE public.sizes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id    uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  name       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (shop_id, name)
);

CREATE TABLE public.qr_codes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id    uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  code       text NOT NULL,
  status     qr_status NOT NULL DEFAULT 'unused',
  created_at timestamptz NOT NULL DEFAULT now(),
  assigned_at timestamptz,
  sold_at    timestamptz,
  UNIQUE (shop_id, code)
);

CREATE TABLE public.lots (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id                uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  category_id            uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  size_id                uuid REFERENCES public.sizes(id) ON DELETE SET NULL,
  free_text_size         text,
  date_of_stock_arrival  date NOT NULL,
  cost_price_per_unit    numeric(10,2) NOT NULL,
  selling_price_default  numeric(10,2) NOT NULL,
  tax_rate               numeric(5,2) NOT NULL DEFAULT 0,  -- NEW: Tax rate (e.g., 18 for 18% GST)
  quantity               integer NOT NULL CHECK (quantity > 0),
  created_by             uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at             timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.inventory_items (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id           uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  lot_id            uuid NOT NULL REFERENCES public.lots(id) ON DELETE CASCADE,
  qr_code_id        uuid NOT NULL UNIQUE REFERENCES public.qr_codes(id) ON DELETE RESTRICT,
  status            inventory_status NOT NULL DEFAULT 'available',
  sold_at           timestamptz,
  sale_item_id      uuid,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.sales (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id          uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  bill_number      bigint,
  client_sale_id   text UNIQUE,  -- For offline sync idempotency
  customer_name    text,
  customer_phone   text,
  subtotal_amount  numeric(10,2) NOT NULL,
  total_discount   numeric(10,2) NOT NULL,
  total_tax        numeric(10,2) NOT NULL DEFAULT 0,  -- NEW: Total GST/tax
  total_amount     numeric(10,2) NOT NULL,
  payment_method   text NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  created_by       uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX sales_shop_bill_unique
  ON public.sales (shop_id, bill_number);

CREATE TABLE public.sale_items (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id           uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  sale_id           uuid NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  inventory_item_id uuid NOT NULL UNIQUE REFERENCES public.inventory_items(id) ON DELETE RESTRICT,
  original_price    numeric(10,2) NOT NULL,
  final_price       numeric(10,2) NOT NULL,
  tax_amount        numeric(10,2) NOT NULL DEFAULT 0,  -- NEW: Tax on this item
  discount_reason   text,
  created_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.inventory_items
  ADD CONSTRAINT inventory_items_sale_item_fk
  FOREIGN KEY (sale_item_id) REFERENCES public.sale_items(id) ON DELETE SET NULL;

CREATE TABLE public.expense_categories (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id     uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  name        text NOT NULL,
  description text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  created_by  uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  UNIQUE (shop_id, name)
);

CREATE TABLE public.financial_transactions (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id               uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  type                  financial_tx_type NOT NULL,
  related_sale_id       uuid REFERENCES public.sales(id) ON DELETE SET NULL,
  expense_category_id   uuid REFERENCES public.expense_categories(id) ON DELETE SET NULL,
  amount                numeric(12,2) NOT NULL,
  description           text,
  payment_method        text,
  occurred_at           timestamptz NOT NULL,
  created_at            timestamptz NOT NULL DEFAULT now(),
  created_by            uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);

CREATE TABLE public.attendance_logs (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id             uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  staff_id            uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  date                date NOT NULL,
  clock_in            timestamptz NOT NULL,
  clock_out           timestamptz,
  total_break_minutes integer NOT NULL DEFAULT 0,
  status              attendance_status NOT NULL DEFAULT 'open',
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX attendance_shop_staff_date_idx
  ON public.attendance_logs (shop_id, staff_id, date);

CREATE TABLE public.checklists (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id     uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  name        text NOT NULL,
  description text,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  created_by  uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);

CREATE TABLE public.checklist_items (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_id  uuid NOT NULL REFERENCES public.checklists(id) ON DELETE CASCADE,
  label         text NOT NULL,
  sort_order    integer NOT NULL DEFAULT 0
);

CREATE TABLE public.staff_checklist_assignments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id       uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  checklist_id  uuid NOT NULL REFERENCES public.checklists(id) ON DELETE CASCADE,
  staff_id      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  date          date NOT NULL,
  status        checklist_status NOT NULL DEFAULT 'pending',
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (shop_id, checklist_id, staff_id, date)
);

CREATE TABLE public.staff_checklist_item_status (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id         uuid NOT NULL REFERENCES public.staff_checklist_assignments(id) ON DELETE CASCADE,
  checklist_item_id     uuid NOT NULL REFERENCES public.checklist_items(id) ON DELETE CASCADE,
  status                checklist_item_status NOT NULL DEFAULT 'pending',
  updated_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (assignment_id, checklist_item_id)
);

-- NEW: Inventory Adjustments table (for damaged/lost items)
CREATE TABLE public.inventory_adjustments (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id             uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  inventory_item_id   uuid NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  old_status          inventory_status NOT NULL,
  new_status          inventory_status NOT NULL,
  reason              text NOT NULL,
  adjusted_by         uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now()
);

-- NEW: Sale Returns table (for returns/exchanges)
CREATE TABLE public.sale_returns (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id           uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  original_sale_id  uuid NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  return_sale_id    uuid REFERENCES public.sales(id) ON DELETE SET NULL,
  returned_items    jsonb NOT NULL,  -- [{inventory_item_id, reason}]
  refund_amount     numeric(10,2),
  return_reason     text,
  processed_by      uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now()
);

-- NEW: Tax Settings table (for GST configuration)
CREATE TABLE public.tax_settings (
  shop_id           uuid PRIMARY KEY REFERENCES public.shops(id) ON DELETE CASCADE,
  gst_number        text,
  is_tax_inclusive  boolean NOT NULL DEFAULT true,
  default_tax_rate  numeric(5,2) NOT NULL DEFAULT 0
);
```

### 4.3 Performance Indexes (IMPORTANT!)

```sql
-- Inventory lookups by QR code (critical for POS performance)
CREATE INDEX inventory_qr_lookup_idx 
  ON public.inventory_items(shop_id, qr_code_id) 
  WHERE status = 'available';

CREATE INDEX qr_code_lookup_idx 
  ON public.qr_codes(shop_id, code) 
  WHERE status IN ('assigned', 'unused');

-- Financial transactions by date (for reports)
CREATE INDEX financial_tx_occurred_idx 
  ON public.financial_transactions(shop_id, occurred_at DESC);

-- Sales by date
CREATE INDEX sales_created_idx 
  ON public.sales(shop_id, created_at DESC);
```

### 4.4 RLS Helper Functions

```sql
CREATE OR REPLACE FUNCTION public.current_profile()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT id FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.current_shop_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT shop_id FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.current_role()
RETURNS user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT role IN ('owner', 'admin') FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_staff_or_higher()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT role IN ('owner', 'admin', 'staff') FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_superadmin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'superadmin'
  );
$$;
```

### 4.5 Enable RLS on All Tables

```sql
ALTER TABLE public.shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sizes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qr_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_checklist_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_checklist_item_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tax_settings ENABLE ROW LEVEL SECURITY;
```

### 4.6 Key RLS Policies (Examples)

```sql
-- Sales: Prevent direct UPDATE (use Edge Functions instead)
CREATE POLICY sales_no_update ON public.sales
  FOR UPDATE USING (is_superadmin());

-- Sales: Staff can create
CREATE POLICY sales_insert ON public.sales
  FOR INSERT WITH CHECK (
    (is_staff_or_higher() OR is_superadmin()) 
    AND shop_id = current_shop_id()
    AND created_by = auth.uid()
  );

-- Attendance: Staff see own, admins see all
CREATE POLICY attendance_select ON public.attendance_logs
  FOR SELECT USING (
    is_superadmin() 
    OR (shop_id = current_shop_id() AND (is_admin() OR staff_id = auth.uid()))
  );
```

(Apply similar patterns to all tables as shown in the complete migration file)

### 4.7 Auto-create Profile on Auth User Creation

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'New User'),
    COALESCE(NEW.raw_user_meta_data->>'phone', NULL),
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'staff')
  );
  RETURN NEW;
EXCEPTION
  WHEN others THEN
    RAISE WARNING 'Failed to create profile for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

---

## 5. RLS Requirements (High-level)

You do not need to re-write every policy, but you must respect these rules when designing access logic:

- **RLS is enabled on all tables**
- **superadmin**:
  - Can read and modify everything (via `is_superadmin()`)
- **Normal users**:
  - Restricted by `shop_id = current_shop_id()` for most tables
- **Staff**:
  - Can:
    - Read inventory lists
    - Create sales and sale_items via POS
    - Read and update their own attendance and checklist statuses
  - Cannot:
    - Arbitrarily edit inventories, financial transactions, or other staff's data
    - Give discounts beyond their `max_discount_percent`
- **Admin/Owner**:
  - Can manage:
    - Inventory (lots, qr_codes, inventory_items via proper flows)
    - Finances (view reports, add expenses)
    - Attendance for their shop
    - Checklist templates and assignments
    - Staff management for their shop

**Typical policy pattern:**
- `USING (is_superadmin() OR shop_id = current_shop_id())` for SELECT
- `WITH CHECK (is_superadmin() OR (shop_id = current_shop_id() AND current_role() IN ('owner','admin','staff')))` depending on table

---

## 6. Critical Edge Functions / RPCs (Supabase)

Implement backend logic as **Supabase Edge Functions (TypeScript)** with transactions.

### 6.1 `add_stock_lot` – Bulk inventory + QR assignment

**Input (JSON):**
```json
{
  "category_id": "uuid",
  "size_id": "uuid-or-null",
  "free_text_size": "M",
  "date_of_stock_arrival": "2025-11-26",
  "cost_price_per_unit": 200,
  "selling_price_default": 500,
  "tax_rate": 18,
  "quantity": 15
}
```

**Behavior:**
1. Use `auth.uid()` to look up `profiles` & `shop_id`
2. Ensure role is `owner` or `admin`
3. Begin transaction:
   - Insert a `lots` row
   - Select `quantity` free QR codes (`status='unused'`) from `qr_codes` for that shop (ordered by `code` or `created_at`)
   - If not enough codes → rollback and return an error
   - Update those `qr_codes` to `status='assigned'`, set `assigned_at`
   - For each, insert `inventory_items` row as `status='available'`
4. Commit

**Return (JSON):**
```json
{
  "lot": { /* lot row */ },
  "items": [
    { "inventory_item_id": "uuid", "qr_code": "WA-0150" }
  ]
}
```

### 6.2 `complete_sale` – Checkout + offline sync idempotent endpoint

**Use one unified function for both online & offline modes.**

**Input (JSON):**
```json
{
  "client_sale_id": "client-generated-uuid",
  "items": [
    {
      "qr_code": "WA-0150",
      "original_price": 500,
      "final_price": 500,
      "discount_reason": null
    },
    {
      "qr_code": "WA-0151",
      "original_price": 500,
      "final_price": 450,
      "discount_reason": "Customer negotiation"
    }
  ],
  "payment_method": "cash",
  "customer_name": null,
  "customer_phone": null,
  "occurred_at": "2025-11-26T15:23:00Z"
}
```

**Behavior:**
1. Identify `shop_id` & role from current user; allow `staff`, `admin`, `owner`
2. **Idempotency check**: If `client_sale_id` present:
   - Check if a `sales` row already exists with that `client_sale_id` → if yes, return it
3. **Discount validation**: Check user's `max_discount_percent` against each item's discount
4. Begin transaction:
   - For each `qr_code`, fetch `qr_codes` + `inventory_items` for that shop:
     - `qr_codes.code = qr_code`
     - `inventory_items.status = 'available'`
     - If not found or already sold → rollback with specific error code
   - Compute:
     - `subtotal_amount` = sum of `original_price`
     - `total_amount` = sum of `final_price`
     - `total_discount` = `subtotal_amount - total_amount`
     - `total_tax` = sum of (`final_price` × `tax_rate` / 100)
   - Generate `bill_number` per shop:
     - `SELECT COALESCE(MAX(bill_number),0)+1 FROM sales WHERE shop_id = ? FOR UPDATE;`
   - Insert into `sales` with `client_sale_id`, amounts, `payment_method`, `created_by`, `occurred_at`
   - For each item:
     - Insert `sale_items` row linking `inventory_item_id`, `original_price`, `final_price`, `tax_amount`, `discount_reason`
     - Update the `inventory_items` row:
       - `status = 'sold'`
       - `sold_at = occurred_at`
       - `sale_item_id = sale_item.id`
     - Update `qr_codes`: `status = 'sold'`, `sold_at`
   - Insert `financial_transactions` row:
     - `type = 'sale'`
     - `amount = total_amount` (positive, includes tax)
     - `related_sale_id = sale.id`
     - `payment_method`, `occurred_at`
5. Commit

**Return (JSON):**
```json
{
  "sale": {
    "id": "uuid",
    "bill_number": 42,
    "total_amount": 950
  },
  "items": [
    {
      "qr_code": "WA-0150",
      "inventory_item_id": "uuid",
      "original_price": 500,
      "final_price": 500
    }
  ]
}
```

**Error Codes:**
- `ITEM_NOT_FOUND` - QR code doesn't exist
- `ITEM_ALREADY_SOLD` - Item sold at {timestamp}
- `ITEM_NOT_AVAILABLE` - Item status is {status}
- `DISCOUNT_EXCEEDS_LIMIT` - Discount {x}% exceeds user limit {y}%
- `INSUFFICIENT_QR_CODES` - (for add_stock_lot)

### 6.3 `add_expense` (optional function or direct insert)

**Input:**
```json
{
  "expense_category_id": "uuid-or-null",
  "amount": 1000,
  "description": "Electricity bill November",
  "payment_method": "cash",
  "occurred_at": "2025-11-30T10:00:00Z"
}
```

**Behavior:**
- Ensure `owner` or `admin`
- Insert into `financial_transactions`:
  - `type = 'expense'`
  - `amount = 1000` (positive, will be shown as expense in reports)
  - Link to category and shop

### 6.4 Attendance functions (RPC or Edge Functions)

**`clock_in`:**
- If open log exists for today & staff → error
- Insert `attendance_logs` with `status='open'`

**`clock_out`:**
- Find open attendance log; set `clock_out`, `status='closed'`

---

## 7. Frontend Architecture (Next.js PWA)

Use Next.js App Router with these routes (as pages in `app/`):

### 7.1 Routes

**Public:**
- `/login` – login screen

**Staff (Protected):**
- `/` – staff dashboard (default)
- `/pos` – POS / checkout screen
- `/me/attendance` – staff's own attendance
- `/me/checklists` – staff's own checklists

**Admin (Protected):**
- `/admin` – admin dashboard home
- `/admin/inventory` – inventory list / dashboard
- `/admin/inventory/add-lot` – bulk add inventory lot
- `/admin/sales` – orders & sales history
- `/admin/sales/[saleId]` – sale detail view
- `/admin/finances` – finance dashboard (reports, charts)
- `/admin/finances/expenses` – list of expenses
- `/admin/finances/expenses/new` – add expense form
- `/admin/attendance` – view staff attendance
- `/admin/checklists/templates` – manage checklist templates
- `/admin/checklists/assignments` – manage daily assignments
- `/admin/staff` – staff management
- `/admin/qr-codes` – QR code pre-printing / status overview
- `/admin/sync-issues` – offline sync issues (failed pending sales)
- `/admin/settings` – settings, dev tools

### 7.2 Route Guards

Use route guards and role-based redirects in layouts / client components:
- A **protected layout** that ensures the user is logged in (using Supabase Auth)
- An **Admin layout** that only allows roles `owner`, `admin`, `superadmin`
- A **Staff layout** for staff-facing pages

### 7.3 Layout & Navigation

**`app/layout.tsx`:**
- Global shell: shadcn/ui components, Tailwind CSS, PWA meta tags
- Wrap with `AuthProvider` and `SyncProvider`
- Include `Toaster` for notifications

**`app/(protected)/layout.tsx`:**
- Wraps all authenticated routes
- Top `TopBar` showing:
  - Shop name
  - Current user name
  - Online/offline status badge
  - User menu (sign out)
- Bottom navigation (`BottomNav`) for tablet:
  - **Staff menu**: Home, POS, Attendance, Checklists
  - **Admin menu**: Home, POS, Admin Dashboard

---

## 8. POS Screen & Offline Behavior

The POS page (`/pos`) must:

### Features:
- Provide a big **"Scan QR"** button that opens the camera and reads QR codes
- On successful scan:
  - Look up item by QR code (locally cached if offline; from Supabase if online)
  - Add the item to the cart with description, original price, editable final price for discounts
- Show:
  - **Cart list**: items, prices, discount fields, ability to remove
  - **Summary area**: subtotal, tax, total discount, grand total
  - **Payment method selector**
  - **"Complete Sale"** button

### Offline Requirements:

Use a `useOfflineStatus()` hook to determine `isOnline`.

**Maintain a local IndexedDB store of pending sales:**

```typescript
interface PendingSale {
  id: string; // local client_sale_id
  createdAt: string;
  items: Array<{
    qrCode: string;
    originalPrice: number;
    finalPrice: number;
    discountReason?: string;
  }>;
  paymentMethod: string;
  customerName?: string;
  customerPhone?: string;
  status: 'pending' | 'syncing' | 'synced' | 'failed';
  lastError?: string;
  retryCount?: number;
  occurredAt: string;
}
```

**On "Complete Sale":**
1. **If online:**
   - Try calling `complete_sale` Edge Function
   - If network error:
     - Save sale request as `pending` offline and clear cart
2. **If offline:**
   - Save sale request as `pending` offline and clear cart

**SyncContext (React context):**
- Watches for online events or runs periodically (every 30 seconds)
- When online:
  - Reads all `pending`/`failed` sales from IndexedDB
  - For each:
    - Calls `complete_sale` with `client_sale_id` and full payload
    - On success → delete from IndexedDB
    - On business error → mark as `failed` and store error message
    - Max 3 retries with exponential backoff

### Global UI:

**Offline banner** (if `!isOnline`):
> ⚠️ "You are offline. Sales will be saved and synced when back online."

**Failed sync warning** (if there are failed syncs):
> ⚠️ "Some sales could not sync. Review in Sync Issues."

**`/admin/sync-issues` page:**
- Lists failed offline sales with:
  - Time, items, total, error message
- Allows admin to:
  - Retry sync
  - Mark as handled manually

---

## 9. Finances: Reports & Charts

`/admin/finances` should have:

### Controls:
- **Date range and preset bar:**
  - From `[date]` To `[date]`
  - Quick presets:
    - Today, Yesterday, This Week, This Month
    - Last Week, Last Month, Quarter, Custom
  - Buttons: `[GENERATE REPORT]` `[EXPORT TO EXCEL]`

### Summary Cards:
- **Total Sales** (sum of `financial_transactions` where `type='sale'`)
- **Total Expenses** (sum where `type='expense'`)
- **Net Profit** (Sales - Expenses)
- **Sales Count**, **Average Sale value**

### Charts (using Recharts):
1. **Line chart**: Daily Revenue vs Daily Expenses for the selected period
2. **Pie/Donut chart**: Expenses by Category
3. **Bar chart**: Sales by Category (from `sale_items` joined to `lots` & `categories`)

### Data Source:
- Use `financial_transactions` for main numbers:
  - `type = 'sale'` (amount is positive)
  - `type = 'expense'` (amount is positive but represents expense)
- Group by `occurred_at::date` for daily graphs

### Export to Excel:
- Implement client-side using `xlsx` library to generate:
  - Summary sheet
  - Detailed transactions sheet

---

## 10. Attendance & Checklists UI

### Staff (`/me/attendance`, `/me/checklists`)

**Attendance:**
- Show today's status (Clocked In / Out)
- Buttons:
  - Clock In
  - Clock Out
  - Start / End Break (optional)
- Small history of recent days

**Checklists:**
- Show assigned checklists for today (from `staff_checklist_assignments`)
- For each assignment:
  - Show list of `checklist_items`
  - Allow marking items as Done / Pending / N/A
  - Update `staff_checklist_item_status` via Supabase

### Admin (`/admin/attendance`, `/admin/checklists/*`)

**Attendance:**
- Filters: date range, staff
- Table: staff, date, hours worked, break minutes

**Checklist templates:**
- CRUD for `checklists` and `checklist_items`

**Checklist assignments:**
- For given date & checklist:
  - Assign to staff
  - View completion status per staff

---

## 11. Developer / Superadmin Role

- `superadmin` is a special role for the developer (me)
- This account:
  - Can access any shop's data
  - Should have a small "Developer Tools" section in `/admin/settings`:
    - View raw profile/shop info
    - Maybe simple diagnostics
- Do not expose destructive actions like "delete all data" in the normal UI; those will be done manually in Supabase

---

## 12. Coding Style & Quality

When you generate code:

- **Use TypeScript everywhere** on frontend and in Edge Functions
- **Keep file structure modular and clean**
- **Use shadcn/ui components** with Tailwind CSS
- **Tablet-optimized design**:
  - Touch targets ≥44px (`min-h-touch`, `min-w-touch` utility classes)
  - Base font size 18px for readability
  - Portrait orientation primary
- **Use React hooks** for:
  - Auth (Supabase session, profile)
  - Offline status
  - Pending sales
  - Data fetching (TanStack Query or custom hooks)
- **Respect separation**:
  - UI components in `components/`
  - Pages in `app/` (Next.js App Router)
  - Data access logic in `hooks` or `lib/` modules
- **Add basic error handling & loading states** in UI
- **Type safety**: Use generated database types from Supabase schema

---

## 13. Suggested File Structure (Next.js App Router)

```
womaniya-dashboard/
├── src/
│   ├── app/
│   │   ├── (protected)/
│   │   │   ├── layout.tsx              # Protected layout
│   │   │   ├── page.tsx                # Staff dashboard
│   │   │   ├── pos/page.tsx            # POS page
│   │   │   ├── me/
│   │   │   │   ├── attendance/page.tsx
│   │   │   │   └── checklists/page.tsx
│   │   │   └── admin/
│   │   │       ├── layout.tsx          # Admin layout
│   │   │       ├── page.tsx
│   │   │       ├── inventory/
│   │   │       │   ├── page.tsx
│   │   │       │   └── add-lot/page.tsx
│   │   │       ├── sales/
│   │   │       │   ├── page.tsx
│   │   │       │   └── [saleId]/page.tsx
│   │   │       ├── finances/
│   │   │       │   ├── page.tsx
│   │   │       │   └── expenses/
│   │   │       │       ├── page.tsx
│   │   │       │       └── new/page.tsx
│   │   │       ├── attendance/page.tsx
│   │   │       ├── checklists/
│   │   │       │   ├── templates/page.tsx
│   │   │       │   └── assignments/page.tsx
│   │   │       ├── staff/page.tsx
│   │   │       ├── qr-codes/page.tsx
│   │   │       ├── sync-issues/page.tsx
│   │   │       └── settings/page.tsx
│   │   ├── login/page.tsx
│   │   ├── layout.tsx                  # Root layout
│   │   └── globals.css
│   ├── components/
│   │   ├── ui/                         # shadcn/ui components
│   │   ├── pos/                        # POS-specific
│   │   ├── tablet/                     # TopBar, BottomNav
│   │   ├── shared/                     # DataTable, etc.
│   │   ├── finances/                   # Charts, DateRangePicker
│   │   └── checklists/
│   ├── context/
│   │   ├── AuthContext.tsx
│   │   └── SyncContext.tsx
│   ├── hooks/
│   │   └── useOfflineStatus.ts
│   ├── lib/
│   │   ├── api/
│   │   │   ├── sales.ts
│   │   │   └── inventory.ts
│   │   ├── offline/
│   │   │   └── db.ts                   # IndexedDB wrapper
│   │   ├── supabase.ts
│   │   ├── formatters.ts
│   │   └── utils.ts
│   └── types/
│       ├── database.types.ts           # Generated from Supabase
│       ├── index.ts
│       └── pos.types.ts
├── supabase/
│   ├── migrations/
│   │   └── 20241130_initial_schema.sql
│   └── functions/
│       ├── complete-sale/
│       ├── add-stock-lot/
│       ├── adjust-inventory/
│       └── add-expense/
├── public/
│   ├── manifest.json
│   └── icons/
├── package.json
├── next.config.ts
├── tailwind.config.ts
└── tsconfig.json
```

---

## 14. Key Improvements Implemented

Based on analysis and recommendations:

✅ **Tax handling (GST)**: `tax_rate`, `total_tax`, `tax_amount` columns  
✅ **Discount limits**: `max_discount_percent` on profiles  
✅ **Inventory adjustments**: `inventory_adjustments` table  
✅ **Sale returns**: `sale_returns` table  
✅ **Performance indexes**: QR lookups, inventory, `financial_tx`  
✅ **Idempotent sales**: `client_sale_id` for offline sync  
✅ **Error handling**: Specific error codes in Edge Functions  
✅ **Offline cache**: IndexedDB with `clearOldInventoryCache()`  
✅ **Touch targets**: `min-h-touch` (44px) utility class  
✅ **Security**: RLS policies prevent staff over-privilege  
✅ **Retry logic**: Exponential backoff (max 3 retries)

---

## 15. When writing code, always:

- Follow the architecture & data model above
- Explain any key decisions briefly
- Point out any assumptions you make that might need my confirmation
- **Prioritize POS functionality** - it's the revenue-generating core
- **Test offline behavior thoroughly** - this is the highest risk area
- **Use proper TypeScript types** from generated database schema
- **Keep components small and focused**
- **Add loading states and error boundaries**

---

**This is a production-grade specification. Let's build a robust, offline-first POS system! 🚀**
