# Feature Module Index

> Reference guide for copying individual features or full modules from this codebase into a new Next.js + Supabase project. Each entry lists exact files, dependencies, database requirements, and numbered copy steps.

---

## Table of Contents

| Module | Complexity | Steps |
|--------|-----------|-------|
| [A. Theme System](#a-theme-system) | Low | 5 |
| [B. Auth System](#b-auth-system) | High | 9 |
| [C. POS Module](#c-pos-module) | High | 11 |
| [D. Inventory Module](#d-inventory-module) | High | 12 |
| [E. Sales + Returns + Bill Print](#e-sales--returns--bill-print) | High | 10 |
| [F. Finance Ledger](#f-finance-ledger) | Medium | 6 |
| [G. Attendance Module](#g-attendance-module) | Medium | 8 |
| [H. Checklists Module](#h-checklists-module) | Medium | 7 |
| [I. Reports & Analytics](#i-reports--analytics) | High | 8 |
| [J. User Management](#j-user-management) | Medium | 5 |
| [K. Shared UI Primitives](#k-shared-ui-primitives) | Low–Medium | Varies per component |
| [L. Offline / Sync System](#l-offline--sync-system) | High | 9 |
| [M. PWA Setup](#m-pwa-setup) | Low | 6 |

---

## Reading This Document

Each module entry follows this structure:

- **What it does** — one-line summary
- **Files** — exact paths to copy from `src/` and `public/`
- **DB tables** — Supabase tables the module reads/writes
- **Migrations** — which migration files set up those tables
- **Edge functions** — Supabase Edge Functions required
- **Depends on** — other modules this one imports from
- **Steps** — numbered copy instructions
- **Can omit** — optional parts you can skip for simpler use cases

---

## A. Theme System

**What it does**: Runtime color palette switching (6 built-in palettes), CSS custom property injection, and dark/light mode toggle. Users pick a palette in Settings; it persists across sessions via localStorage. No rebuild required to change brand color.

### Files

```
src/context/ThemeColorContext.tsx       ← 6 palettes, CSS variable injection, localStorage
src/components/shared/ThemePickerDialog.tsx  ← Palette picker UI (modal)
src/lib/config/app.config.ts            ← styles.brandHex defaults (inline canvas colors)
src/app/globals.css                     ← CSS custom property declarations (--color-brand-*)
```

### DB Tables
None.

### Migrations
None.

### Edge Functions
None.

### Depends On
- `next-themes` npm package (dark/light mode toggle)
- `appConfig` (for default hex values)
- Tailwind CSS (brand-* color classes must be configured)

### Steps

1. Install `next-themes`: `npm install next-themes`
2. Copy `src/context/ThemeColorContext.tsx`
3. Copy `src/components/shared/ThemePickerDialog.tsx`
4. Copy the `--color-brand-*` CSS variable block from `src/app/globals.css` into your global CSS
5. Wrap your root layout in `ThemeColorProvider` (and `ThemeProvider` from `next-themes`):
   ```tsx
   // src/app/layout.tsx
   import { ThemeProvider } from 'next-themes'
   import { ThemeColorProvider } from '@/context/ThemeColorContext'

   export default function RootLayout({ children }) {
     return (
       <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
         <ThemeColorProvider>
           {children}
         </ThemeColorProvider>
       </ThemeProvider>
     )
   }
   ```

### Can Omit
- `ThemePickerDialog` — if you want to fix one palette and not expose a picker to users, just hardcode the CSS variables and skip this component entirely.
- The `appConfig.styles.brandHex` values — only needed if you render canvas/SVG (bill preview, QR codes). Skip if not using those.

---

## B. Auth System

**What it does**: Supabase email/password login, role-based routing (superadmin / owner / admin / staff), profile caching in localStorage for network resilience, and a forced password-change flow on first login.

### Files

```
src/context/AuthContext.tsx             ← Auth state, profile cache (24h TTL), signIn/signOut
src/app/login/page.tsx                  ← Login form, logo, last-email recall
src/app/change-password/page.tsx        ← Forced password change on first login
src/app/page.tsx                        ← Root redirect hub (role → dashboard)
src/lib/supabase.ts                     ← Supabase client singleton
src/lib/config/app.config.ts            ← internal.* cache key names
```

### DB Tables
- `auth.users` (Supabase managed)
- `profiles` — `id, full_name, phone, role, shop_id, is_active, max_discount_percent, must_change_password, password_changed_at, created_by`

### Migrations
```
00000000000000_initial_schema.sql           ← profiles table + user_role enum
20260101000000_profiles_update_policy.sql
20260208000100_fix_user_profiles_security_definer.sql
20260303000000_consolidate_profiles_policies.sql
20260306000000_fix_profiles_update_recursion.sql
```

### Edge Functions
- `create-user` — needed only for in-app user creation (see Module J). Not needed for auth itself.

### Depends On
- `@supabase/supabase-js` + `@supabase/auth-helpers-nextjs`
- `appConfig.internal.*` (cache key names)

### Steps

1. Install: `npm install @supabase/supabase-js @supabase/auth-helpers-nextjs`
2. Create `.env.local` with `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. Copy `src/lib/supabase.ts`
4. Copy `src/context/AuthContext.tsx`
5. Copy `src/app/login/page.tsx` (update logo/brand via `appConfig`)
6. Copy `src/app/change-password/page.tsx`
7. Copy `src/app/page.tsx` — update the role-to-route mapping to match your app's routes
8. Run the required migrations (listed above) via `supabase db push`
9. Wrap root layout in `AuthProvider`:
   ```tsx
   import { AuthProvider } from '@/context/AuthContext'
   // ... inside RootLayout:
   <AuthProvider>{children}</AuthProvider>
   ```

### Can Omit
- `change-password/page.tsx` — if you don't want forced password change on first login, remove the `must_change_password` column from profiles and skip this page.
- Profile caching logic — safe to remove if you're building an always-online app. The auth flow still works without it; it just won't be resilient to slow networks.

---

## C. POS Module

**What it does**: QR code scanning via camera, cart management, discount validation, manual quick-add items (without a QR code), offline sale queuing, and checkout that calls the `complete-sale` edge function. Sales work fully offline and sync automatically when back online.

### Files

```
src/app/(protected)/pos/page.tsx        ← POS page (cart state, scan loop, checkout)
src/components/pos/CartList.tsx         ← Cart line items display
src/components/pos/CartSummary.tsx      ← Total, discount, payment method selector
src/components/pos/CheckoutDialog.tsx   ← Confirm + submit sale
src/components/pos/ProductSearchDialog.tsx  ← Search inventory by text
src/components/pos/QuickAddItemDialog.tsx   ← Manual item entry (no QR)
src/components/pos/ScanQRButton.tsx     ← Camera QR scanner (html5-qrcode)
src/lib/api/sales.ts                    ← completeSale(), CompleteSaleRequest type
src/types/pos.types.ts                  ← CartItem, PendingSale, ScanResult types
```

### DB Tables
- `sales` — bill header
- `sale_items` — line items
- `inventory_items` — status updated to `sold`
- `qr_codes` — status updated to `sold`
- `lots` — pricing source
- `profiles` — `max_discount_percent` validation

### Migrations
```
00000000000000_initial_schema.sql
20260122000000_add_sale_to_lots.sql
20260122000100_add_sale_to_sale_items.sql
20260314000100_item_level_sale_type.sql
20260314_item_level_pricing.sql
20260318000000_quick_sale_manual_items.sql
20260419100000_add_cost_price_to_sale_items.sql
```

### Edge Functions
- `complete-sale` — **required**. Handles idempotency, inventory status update, bill number generation, and discount validation server-side.

### Depends On
- Module B (Auth) — `useAuth()` for `shop_id`, `profile.max_discount_percent`
- Module L (Offline/Sync) — `useSyncContext()` for queueing offline sales
- Module D (Inventory) — inventory cache for offline QR lookup

### Steps

1. Install: `npm install html5-qrcode`
2. Copy all 7 `src/components/pos/` files
3. Copy `src/app/(protected)/pos/page.tsx`
4. Copy `src/lib/api/sales.ts`
5. Copy `src/types/pos.types.ts`
6. Deploy the `complete-sale` edge function: `supabase functions deploy complete-sale`
7. Run required migrations
8. Set up Module B (Auth) — the POS page requires `useAuth()`
9. Set up Module L (Offline/Sync) — required for offline sale queuing
10. Add `SyncContext` to the POS layout wrapper so pending sales auto-sync
11. Create a `/pos` route in your app and protect it with role `staff` (or higher)

### Can Omit
- `ProductSearchDialog.tsx` — if your flow is QR-only, omit search
- `QuickAddItemDialog.tsx` — if you don't need manual non-QR items
- Offline sync (Module L) — if your POS is always-online, remove `SyncContext` dependency and call `completeSale()` directly on checkout

---

## D. Inventory Module

**What it does**: Stock lot creation (adding batches of goods), QR code generation and assignment to individual items, inventory item status tracking (available / sold / damaged / returned), and QR prefix management for batch labeling.

### Files

```
src/app/(protected)/admin/inventory/page.tsx          ← Inventory list with filters
src/app/(protected)/admin/inventory/add-lot/page.tsx  ← Add stock lot form
src/components/shared/EditLotDialog.tsx               ← Edit lot details
src/components/shared/EditInventoryItemDialog.tsx     ← Edit individual item status
src/components/shared/InventoryItemDetailsDialog.tsx  ← Item details + history
src/components/shared/QrCodeCard.tsx                  ← QR code display card
src/components/shared/QrCodeDetailsDialog.tsx         ← QR code details sheet
src/components/shared/QrCodeDownloadDialog.tsx        ← Batch QR download (ZIP)
src/components/shared/PickerDialog.tsx                ← Full-screen search picker (categories, sizes)
src/components/shared/LotsHistorySheet.tsx            ← Lot purchase history side panel
src/lib/api/inventory.ts                              ← addStockLot(), inventory queries
src/lib/api/qr-prefixes.ts                           ← QR prefix CRUD
src/lib/qr-styles.ts                                 ← QR code visual styling config
src/components/admin/settings/CategoriesTab.tsx      ← Manage categories
src/components/admin/settings/SizesTab.tsx           ← Manage sizes
src/components/admin/settings/QrPrefixesTab.tsx      ← Manage QR prefixes
```

### DB Tables
- `lots` — stock batches
- `inventory_items` — one per QR code
- `qr_codes` — QR code records
- `qr_prefixes` — prefix definitions (e.g., "STORE-A-")
- `categories` — item categories
- `sizes` — size definitions
- `inventory_adjustments` — audit trail for status changes

### Migrations
```
00000000000000_initial_schema.sql
20260110000000_create_qr_prefixes.sql
20260110000100_alter_qr_codes_add_prefix.sql
20260110000200_qr_prefix_functions.sql
20260122000000_add_sale_to_lots.sql
20260205000000_inventory_items_rls.sql
20260210000000_categories_sort_order.sql
20260219000000_lots_rls.sql
20260302000000_optimize_indexes.sql
20260303000100_fix_categories_sizes_rls.sql
20260314000100_item_level_sale_type.sql
20260314_item_level_pricing.sql
20260319000000_allow_staff_insert_categories_sizes.sql
20260502000000_qr_code_auto_reset_trigger.sql
```

### Edge Functions
- `add-stock-lot` — **required**. Creates lot, generates QR codes, and assigns them to inventory items atomically.

### Depends On
- Module B (Auth) — `useAuth()` for `shop_id`
- `qrcode` npm package — QR image generation
- `jszip` + `html2canvas` — batch QR download
- `appConfig.billing.logoDarkPath` — logo embedded in QR downloads

### Steps

1. Install: `npm install qrcode jszip html2canvas`
2. Copy all files listed above
3. Deploy edge function: `supabase functions deploy add-stock-lot`
4. Run required migrations
5. Set up Module B (Auth)
6. Create settings pages/tabs for Categories, Sizes, QR Prefixes (copy the three `*Tab.tsx` files)
7. Create the inventory list page at your desired route
8. Create the add-lot page at your desired route
9. Wire `PickerDialog` for category/size selection in the add-lot form (it handles back-button navigation via history API)
10. Protect inventory routes with `admin` or `owner` role
11. Add `LotsHistorySheet` to the inventory list for lot purchase history
12. Verify QR download works (requires `jszip` + logo images in `public/`)

### Can Omit
- `QrCodeDownloadDialog.tsx` — if you don't need batch PDF/ZIP QR downloads
- `LotsHistorySheet.tsx` — if you don't need lot history
- `QrPrefixesTab.tsx` + the three `qr_prefixes` migrations — if you use simple sequential QR codes without prefixes
- `inventory_adjustments` table — if you don't need an audit trail for status changes

---

## E. Sales + Returns + Bill Print

**What it does**: Sales history list with filters, return processing (refund a previously completed sale), and a bill preview/print dialog that generates A4 invoices and 80mm/58mm thermal receipts as printable HTML and downloadable images.

### Files

```
src/app/(protected)/admin/sales/page.tsx      ← Sales list with date filters, pagination, export
src/app/(protected)/admin/returns/page.tsx    ← Returns list
src/components/shared/BillPreviewDialog.tsx   ← Receipt preview, A4 print, image download
src/components/shared/ProcessReturnDialog.tsx ← Return processing modal
src/lib/api/sales.ts                          ← Sale queries
src/lib/api/returns.ts                        ← processReturn()
```

### DB Tables
- `sales`
- `sale_items`
- `sale_returns`
- `inventory_items` (status restored on return)

### Migrations
```
00000000000000_initial_schema.sql
20241222000000_bill_number_function.sql
20260122000100_add_sale_to_sale_items.sql
20260205000100_sale_returns_rls.sql
20260314_item_level_pricing.sql
20260318000000_quick_sale_manual_items.sql
20260419100000_add_cost_price_to_sale_items.sql
```

### Edge Functions
- `complete-sale` — used when re-processing (returns create a new sale internally)

### Depends On
- Module B (Auth) — shop filtering
- Module D (Inventory) — `inventory_items` status update on return
- `jspdf` + `html2canvas` — bill image/PDF generation
- `appConfig.billing.*` — receipt header, tagline, logo paths

### Steps

1. Install: `npm install jspdf html2canvas`
2. Copy `src/components/shared/BillPreviewDialog.tsx` — **update `appConfig.billing.*` if you've renamed fields**
3. Copy `src/components/shared/ProcessReturnDialog.tsx`
4. Copy `src/lib/api/sales.ts` and `src/lib/api/returns.ts`
5. Copy `src/app/(protected)/admin/sales/page.tsx`
6. Copy `src/app/(protected)/admin/returns/page.tsx`
7. Run required migrations
8. Set up Module B (Auth)
9. Protect routes with `admin` or `owner` role
10. Verify logo images exist at `appConfig.billing.logoPath` and `appConfig.billing.logoDarkPath`

### Can Omit
- `ProcessReturnDialog.tsx` + `returns/page.tsx` + `src/lib/api/returns.ts` — if you don't need returns processing
- A4 layout in `BillPreviewDialog.tsx` — the component supports A4, 80mm, and 58mm thermal; you can remove the unused layout sections

---

## F. Finance Ledger

**What it does**: Tracks all financial events (sales income, expenses, adjustments) in a single ledger. Expense categories are admin-configurable. Transactions are linked to sales or expense categories.

### Files

```
src/app/(protected)/admin/finances/page.tsx            ← Finance dashboard + transaction list
src/components/admin/settings/ExpenseCategoriesTab.tsx ← Manage expense categories
src/lib/api/                                           ← Financial transaction queries (in sales.ts)
```

### DB Tables
- `financial_transactions` — `type (sale/expense/adjustment), amount, payment_method, expense_category_id, related_sale_id`
- `expense_categories` — admin-defined categories

### Migrations
```
20241222000100_expense_categories.sql
20241222000200_financial_transactions_rls.sql
20260319100000_fix_financial_transactions_schema.sql
20260319100000_rename_category_id_to_expense_category_id.sql
```

### Edge Functions
None. Transactions are inserted by the `complete-sale` function automatically for sales, and directly by the finance page for expenses.

### Depends On
- Module B (Auth) — shop filtering
- Module E (Sales) — sale transactions are auto-created by `complete-sale`

### Steps

1. Copy `src/app/(protected)/admin/finances/page.tsx`
2. Copy `src/components/admin/settings/ExpenseCategoriesTab.tsx`
3. Run required migrations
4. Set up Module B (Auth)
5. Protect route with `admin` or `owner` role
6. Add `ExpenseCategoriesTab` to your settings page

### Can Omit
- `ExpenseCategoriesTab.tsx` — if you pre-seed fixed expense categories via SQL and don't need UI management

---

## G. Attendance Module

**What it does**: Staff clock in/out with timestamps, manual entry (with reason), edit history (full audit trail), soft deletes, bulk entry for multiple staff, and automatic end-of-day clock-out via a scheduled edge function.

### Files

```
src/app/(protected)/admin/attendance/page.tsx       ← Attendance list with date filters
src/components/admin/AttendanceCreateDialog.tsx     ← Clock in / clock out
src/components/admin/AttendanceEditDialog.tsx       ← Edit an existing entry
src/components/admin/AttendanceDeleteDialog.tsx     ← Soft-delete an entry
src/components/admin/AttendanceBulkEntryDialog.tsx  ← Bulk entry for multiple staff
src/components/staff/AttendanceCard.tsx             ← Staff view: today's attendance status
src/components/staff/AttendanceCalendar.tsx         ← Staff view: monthly calendar
src/lib/api/attendance.ts                           ← clockIn(), clockOut(), edit, delete
src/lib/utils/attendance.ts                         ← calculateHours(), time formatting
src/lib/utils/timezone.ts                           ← IST timezone constants
supabase/functions/auto-close-attendance/           ← Scheduled edge function
```

### DB Tables
- `attendance_logs` — `staff_id, date, clock_in, clock_out, status, total_break_minutes, is_manual_entry, edited_by, edit_reason, deleted_at`

### Migrations
```
00000000000000_initial_schema.sql                   ← attendance_logs table
20250101000100_attendance_crud_audit.sql
20260319110000_attendance_auto_close_guardrails.sql
20260319120000_nightly_cron_pg_net.sql              ← pg_cron setup for auto-close
```

### Edge Functions
- `auto-close-attendance` — closes any open clock-in records at end of business day. Called by `pg_cron`.

### Depends On
- Module B (Auth) — `shop_id`, staff profile
- `date-fns` npm package — date calculations

### Steps

1. Install: `npm install date-fns`
2. Copy `src/lib/api/attendance.ts`, `src/lib/utils/attendance.ts`, `src/lib/utils/timezone.ts`
3. Copy all 4 admin dialog components
4. Copy `src/app/(protected)/admin/attendance/page.tsx`
5. Copy staff-view components if needed: `AttendanceCard.tsx`, `AttendanceCalendar.tsx`
6. Deploy: `supabase functions deploy auto-close-attendance`
7. Run required migrations
8. Set up the cron job via SQL (see section 3.8 in the White-Label Setup Guide — replace the function URL with your project ref)

### Can Omit
- `AttendanceBulkEntryDialog.tsx` — if you only need individual entry
- `AttendanceCalendar.tsx` + `AttendanceCard.tsx` — if staff don't have a self-service view
- `auto-close-attendance` edge function + cron job — if staff are expected to always manually clock out

---

## H. Checklists Module

**What it does**: Recurring task checklists for staff. Admin creates templates (with items and recurrence schedule). A scheduled edge function creates daily instances from templates. Staff check off items; progress is tracked in real time.

### Files

```
src/app/(protected)/admin/checklists/page.tsx      ← Manage templates + view today's progress
src/components/admin/TodayChecklistProgress.tsx    ← Today's completion status (admin view)
src/components/admin/ChecklistProgressBanner.tsx   ← Compact progress banner for dashboards
src/components/staff/TaskChecklistCard.tsx         ← Staff checklist view (check off items)
src/lib/api/checklists-v2.ts                       ← All checklist CRUD and completion API
supabase/functions/create-daily-checklists/        ← Scheduled edge function
```

### DB Tables
- `checklists` — templates with recurrence config
- `checklist_items` — items within a template
- `checklist_instances` — daily copies created from templates
- `checklist_item_completions` — who checked off what and when

### Migrations
```
00000000000000_initial_schema.sql
20241231000000_checklists_rls.sql
20241231000100_checklist_shared_pool.sql
```

### Edge Functions
- `create-daily-checklists` — creates today's instances from active templates. Called by `pg_cron` each morning.

### Depends On
- Module B (Auth) — `shop_id`, staff identity for completion attribution

### Steps

1. Copy `src/lib/api/checklists-v2.ts`
2. Copy `src/app/(protected)/admin/checklists/page.tsx`
3. Copy `TodayChecklistProgress.tsx` and `ChecklistProgressBanner.tsx`
4. Copy `TaskChecklistCard.tsx` for the staff-facing view
5. Deploy: `supabase functions deploy create-daily-checklists`
6. Run required migrations
7. Set up the cron job via SQL (see section 3.8 in the White-Label Setup Guide)

### Can Omit
- `ChecklistProgressBanner.tsx` — if you don't want a compact banner on the admin dashboard
- `TaskChecklistCard.tsx` — if staff don't have a self-service view
- The cron job — instances can be created on-demand by calling the edge function manually or via a "Create Today's Checklists" button

---

## I. Reports & Analytics

**What it does**: Date-filtered analytics dashboard with revenue trends, category performance, payment method breakdown, vendor performance, staff sales stats, top customers, cohort retention grid, and sale-type analysis (festival / clearance / promotion).

### Files

```
src/app/(protected)/admin/reports/                  ← Report sub-pages
  clearance/page.tsx
  festival/page.tsx
  promotion/page.tsx
src/app/(protected)/admin/staff-performance/page.tsx

src/components/admin/analytics/
  index.ts                     ← Re-exports all analytics components
  CategoryPerformance.tsx
  CohortRetentionGrid.tsx
  InsightsPanel.tsx
  MarginByCategoryChart.tsx
  PaymentMethodBreakdown.tsx
  RevenueHeatmap.tsx
  RevenueTrendChart.tsx
  SaleTypeAnalysis.tsx
  StaffPerformance.tsx
  TopCustomers.tsx
  VendorPerformance.tsx

src/lib/api/staff-performance.ts    ← Staff metrics queries
src/lib/utils/stats-cache.ts        ← localStorage cache for computed stats
```

### DB Tables
Reads from: `sales`, `sale_items`, `lots`, `categories`, `profiles`, `inventory_items`. No writes.

### Migrations
All sales, inventory, and profile migrations (listed under Modules C, D, E, B).

### Edge Functions
None. All analytics are computed via Supabase queries directly.

### Depends On
- Module B (Auth) — shop filtering
- Module C, D, E (data source) — reports read from those tables
- `recharts` npm package — charts
- `date-fns` — date range calculations
- `xlsx` — CSV/Excel export

### Steps

1. Install: `npm install recharts date-fns xlsx`
2. Copy `src/components/admin/analytics/` directory (all 12 files)
3. Copy `src/lib/api/staff-performance.ts`
4. Copy `src/lib/utils/stats-cache.ts`
5. Copy report pages at desired routes
6. Set up Module B (Auth) — required for shop_id filtering
7. Ensure Modules C, D, E data exists (reports are empty without sales/inventory data)
8. Protect routes with `admin` or `owner` role

### Can Omit
Pick and choose individual chart components — they are independent of each other:
- `CohortRetentionGrid.tsx` — complex, skip if retention analysis isn't needed
- `RevenueHeatmap.tsx` — skip if hour-of-day analysis isn't needed
- `InsightsPanel.tsx` — skip if you don't need auto-generated text insights
- `VendorPerformance.tsx` — skip if vendor tracking isn't used

---

## J. User Management

**What it does**: Superadmin and owner can create new staff users, assign roles, set max discount limits, activate/deactivate accounts, and trigger password resets — all from within the app UI.

### Files

```
src/components/admin/UserManagement.tsx        ← Full CRUD UI for staff users
supabase/functions/create-user/               ← Creates auth user + profile atomically
```

### DB Tables
- `auth.users` (Supabase managed)
- `profiles`

### Migrations
```
20260125000000_user_management.sql
20260208000100_fix_user_profiles_security_definer.sql
```

### Edge Functions
- `create-user` — **required**. Uses the service role key to create auth users (not possible from frontend code).

### Depends On
- Module B (Auth) — role-gating (only superadmin/owner can access)
- `appConfig.internal.*` — none directly, but Auth system cache keys are used

### Steps

1. Copy `src/components/admin/UserManagement.tsx`
2. Deploy: `supabase functions deploy create-user`
3. Run required migrations
4. Set up Module B (Auth)
5. Place `<UserManagement />` on your admin/settings page, gated to superadmin/owner roles

---

## K. Shared UI Primitives

These are standalone components and hooks you can copy individually. Most have zero dependencies beyond Tailwind CSS and the Radix UI primitives already in `src/components/ui/`.

---

### K1. Full-Screen Picker Dialog

**File**: `src/components/shared/PickerDialog.tsx`

A full-screen search-and-select modal, designed for mobile. Handles back-button dismissal via the browser history API (works correctly with Next.js App Router).

**Features**: Real-time search, "Create new" option, selected-item checkmark, sublabels, monospace font mode for code-like values.

**Dependencies**: `src/components/ui/` (Dialog, Input, Button)

**Copy steps**:
1. Copy `src/components/shared/PickerDialog.tsx`
2. Use anywhere you'd use a `<select>` but want a full-screen mobile-friendly UI:
   ```tsx
   <PickerDialog
     open={open}
     onOpenChange={setOpen}
     title="Select Category"
     items={categories.map(c => ({ id: c.id, label: c.name }))}
     selectedId={selectedId}
     onSelect={(id) => setSelectedId(id)}
     allowCreate
     onCreateNew={(name) => createCategory(name)}
   />
   ```

---

### K2. Command Palette

**File**: `src/components/shared/CommandPalette.tsx`

Global keyboard-triggered search/navigation palette (Cmd+K / Ctrl+K). Searches across pages and actions.

**Dependencies**: `cmdk` npm package, `src/components/ui/command.tsx`, Module B (Auth) for role-aware commands

**Copy steps**:
1. Install: `npm install cmdk`
2. Copy `src/components/shared/CommandPalette.tsx`
3. Copy `src/components/ui/command.tsx`
4. Add `<CommandPalette />` to your root layout or top-level page

---

### K3. Date Range Filter

**File**: `src/components/shared/DateRangeFilter.tsx`
**Hook**: `src/hooks/index.ts` → `useDateFilter`

Preset date filter buttons (Today / Week / Month / All) plus a custom date range picker. Outputs ISO date strings for use in Supabase `.gte()` / `.lte()` queries.

**Dependencies**: `date-fns`, `src/components/ui/` (Popover, Calendar, Button)

**Copy steps**:
1. Copy `src/components/shared/DateRangeFilter.tsx`
2. Copy the `useDateFilter` hook from `src/hooks/index.ts`
3. Use in any list page:
   ```tsx
   const { dateFilter, setDateFilter, startDateISO, endDateISO } = useDateFilter()
   // Then: .gte('created_at', startDateISO).lte('created_at', endDateISO)
   <DateRangeFilter value={dateFilter} onChange={setDateFilter} />
   ```

---

### K4. Animated Stats Cards

**Files**:
- `src/components/shared/StatsCardGrid.tsx` — responsive grid of stat cards
- `src/components/shared/CountUp.tsx` — number animation (counts up from 0)

**Dependencies**: `framer-motion` npm package

**Copy steps**:
1. Install: `npm install framer-motion`
2. Copy both files
3. Use:
   ```tsx
   <StatsCardGrid stats={[
     { label: 'Total Sales', value: 1234, prefix: '₹' },
     { label: 'Items Sold', value: 567 },
   ]} />
   ```

---

### K5. Sortable Table Header

**File**: `src/components/shared/SortableHeader.tsx`
**Hook**: `src/hooks/index.ts` → `useSortableTable`

Column header component with sort direction indicator. Works with any array of data.

**Dependencies**: `lucide-react`

**Copy steps**:
1. Copy `src/components/shared/SortableHeader.tsx`
2. Copy the `useSortableTable` hook from `src/hooks/index.ts`
3. Use in table headers:
   ```tsx
   const { sortBy, sortOrder, toggleSort } = useSortableTable({ initialSortBy: 'created_at' })
   <SortableHeader column="name" label="Name" sortBy={sortBy} sortOrder={sortOrder} onSort={toggleSort} />
   ```

---

### K6. Debounced Search

**Hook**: `src/hooks/index.ts` → `useDebouncedSearch`

500ms debounced search input with minimum character length support. Returns both the raw input value (for the input field) and the debounced value (for the API query).

**Dependencies**: None

**Copy steps**:
1. Copy the `useDebouncedSearch` hook from `src/hooks/index.ts`
2. Use:
   ```tsx
   const { searchTerm, debouncedSearchTerm, setSearchTerm } = useDebouncedSearch({ minLength: 2 })
   <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
   // Use debouncedSearchTerm in your Supabase query
   ```

---

### K7. Server-Side Pagination

**Files**:
- `src/components/shared/PaginationControls.tsx` — Previous/Next/page-number buttons
- `src/hooks/index.ts` → `useServerPagination` — pagination state and Supabase `.range()` values

**Dependencies**: `lucide-react`, `src/components/ui/button.tsx`

**Copy steps**:
1. Copy `src/components/shared/PaginationControls.tsx`
2. Copy the `useServerPagination` hook from `src/hooks/index.ts`
3. Use:
   ```tsx
   const { from, to, currentPage, totalPages, goToNextPage, goToPrevPage } =
     useServerPagination({ initialItemsPerPage: 50, totalCount: data?.count ?? 0 })
   // Query: .range(from, to)
   <PaginationControls currentPage={currentPage} totalPages={totalPages}
     onNext={goToNextPage} onPrev={goToPrevPage} />
   ```

---

### K8. Export Button (CSV / Excel)

**File**: `src/components/shared/ExportButton.tsx`

Exports table data as CSV or `.xlsx` with one click.

**Dependencies**: `xlsx` npm package

**Copy steps**:
1. Install: `npm install xlsx`
2. Copy `src/components/shared/ExportButton.tsx`
3. Pass your data and column definitions:
   ```tsx
   <ExportButton data={rows} filename="sales-export" />
   ```

---

### K9. Sync Status Indicator

**File**: `src/components/shared/SyncStatusIndicator.tsx`

Badge showing pending/failed offline sale count with a manual retry button.

**Dependencies**: Module L (Offline/Sync) — `useSyncContext()`

**Copy steps**:
1. Copy `src/components/shared/SyncStatusIndicator.tsx`
2. Requires Module L (Offline/Sync) to be set up first
3. Place in your top navigation bar

---

### K10. PWA Install Banner

**File**: `src/components/shared/PwaInstallBanner.tsx`
**Hook**: `src/hooks/usePwaInstall.ts`

Shows a dismissible "Install App" prompt when the browser's PWA install event fires.

**Dependencies**: None beyond React

**Copy steps**:
1. Copy `src/components/shared/PwaInstallBanner.tsx`
2. Copy `src/hooks/usePwaInstall.ts`
3. Place `<PwaInstallBanner />` at the top of your layout

---

### K11. Brand Loader

**File**: `src/components/shared/BrandLoader.tsx`

Full-screen animated loading spinner with the brand logo. Used during auth initialization.

**Dependencies**: `framer-motion`, `appConfig.billing.logoPath` / `logoDarkPath`

**Copy steps**:
1. Copy `src/components/shared/BrandLoader.tsx`
2. Use wherever you need a full-screen loading state:
   ```tsx
   if (loading) return <BrandLoader />
   ```

---

### K12. Confirm Dialog

**File**: `src/components/shared/ConfirmDialog.tsx`

Generic destructive-action confirmation modal (e.g., "Are you sure you want to delete?").

**Dependencies**: `src/components/ui/` (Dialog, Button)

**Copy steps**:
1. Copy `src/components/shared/ConfirmDialog.tsx`
2. Use:
   ```tsx
   <ConfirmDialog
     open={open}
     title="Delete Item"
     description="This action cannot be undone."
     onConfirm={handleDelete}
     onCancel={() => setOpen(false)}
   />
   ```

---

### K13. Particle Background

**File**: `src/components/ui/ParticleBackground.tsx`

Animated particle canvas for login page backgrounds.

**Dependencies**: `@tsparticles/react` + `@tsparticles/engine` npm packages

**Copy steps**:
1. Install: `npm install @tsparticles/react @tsparticles/engine`
2. Copy `src/components/ui/ParticleBackground.tsx`
3. Use in your login page layout

---

### K14. QR Code Batch Download

**File**: `src/components/shared/QrCodeDownloadDialog.tsx`

Generates QR codes for a batch of items with the brand logo embedded, packages them into a ZIP file, and triggers a browser download.

**Dependencies**: `qrcode`, `jszip`, `html2canvas`, `appConfig.billing.*`

**Copy steps**:
1. Install: `npm install qrcode jszip html2canvas`
2. Copy `src/components/shared/QrCodeDownloadDialog.tsx`
3. Copy `src/lib/qr-styles.ts`

---

## L. Offline / Sync System

**What it does**: Stores pending sales in IndexedDB when the device goes offline. Pre-caches the shop's inventory (QR codes + prices) for offline scanning. Auto-syncs every 30 seconds when back online. Max 3 retry attempts per sale, with failed sales surfaced in the UI for manual retry.

### Files

```
src/context/SyncContext.tsx              ← Manages pending sales, inventory cache, auto-sync
src/lib/offline/db.ts                   ← IndexedDB operations (idb wrapper)
src/lib/offline/inventory-cache.ts      ← Pre-cache inventory items for offline QR lookup
src/lib/offline/config.ts               ← Store names, DB version
src/lib/offline/index.ts                ← Exports
src/hooks/useOfflineStatus.ts           ← Detects online/offline (navigator.onLine + events)
src/hooks/useSyncStatus.ts              ← Exposes pendingCount, failedCount, syncing
src/components/shared/SyncStatusIndicator.tsx  ← Visual badge (see K9)
```

### DB Tables
None (uses IndexedDB — browser-side only):
- `pending_sales` store — cart transactions waiting to sync
- `cached_inventory` store — QR codes + prices for offline scanning

### Migrations
None.

### Edge Functions
- `complete-sale` — the sync system calls this when syncing pending sales.

### Depends On
- `idb` npm package — IndexedDB wrapper
- Module B (Auth) — `shop_id` for inventory cache
- `appConfig.internal.idbName` — database name
- `appConfig.internal.inventoryCacheTimestampKey` — cache timestamp key

### Steps

1. Install: `npm install idb`
2. Copy `src/lib/offline/` directory (all 4 files)
3. Copy `src/context/SyncContext.tsx`
4. Copy `src/hooks/useOfflineStatus.ts` and `src/hooks/useSyncStatus.ts`
5. Copy `src/components/shared/SyncStatusIndicator.tsx`
6. Wrap your POS layout in `SyncProvider`:
   ```tsx
   import { SyncProvider } from '@/context/SyncContext'
   // Inside layout:
   <SyncProvider>{children}</SyncProvider>
   ```
7. Deploy `complete-sale` edge function (required for sync to succeed)
8. Set up Module B (Auth) — sync needs `shop_id`
9. Call `preCacheShopInventory()` after login to pre-load inventory for offline use

### Can Omit
- `inventory-cache.ts` + the pre-cache call — if you don't need offline QR scanning (just sale queuing)
- `SyncStatusIndicator.tsx` — if you don't need a visible pending count badge
- The entire module — if your POS is always-online and you can afford a hard failure on network loss

---

## M. PWA Setup

**What it does**: Makes the app installable as a standalone app on mobile and desktop, with an offline fallback page, pre-cached app shell, and service worker cache management.

### Files

```
src/app/manifest.ts                              ← Dynamic PWA manifest (reads from appConfig)
public/sw.js                                     ← Service worker (cache strategy, offline fallback)
public/offline.html                              ← Offline fallback page (static HTML)
public/icons/                                    ← 8 SVG app icons (72–512px)
src/components/shared/ServiceWorkerRegistration.tsx  ← Registers sw.js on app load
src/hooks/usePwaInstall.ts                       ← Detects PWA install prompt
```

### DB Tables
None.

### Migrations
None.

### Edge Functions
None.

### Depends On
- `appConfig.brand.*`, `appConfig.theme.*`, `appConfig.pwa.*` — manifest values
- Next.js App Router — `src/app/manifest.ts` uses `MetadataRoute.Manifest`

### Steps

1. Copy `src/app/manifest.ts` — Next.js serves this as `/manifest.webmanifest` automatically
2. Copy `public/sw.js`
3. Copy `public/offline.html` — update title and logo letter (see section 4.2 of setup guide)
4. Copy `public/icons/` directory
5. Copy `src/components/shared/ServiceWorkerRegistration.tsx`
6. Add `<ServiceWorkerRegistration />` to your root layout
7. Optionally copy `src/hooks/usePwaInstall.ts` + `src/components/shared/PwaInstallBanner.tsx` for the install prompt

### Can Omit
- `usePwaInstall.ts` + `PwaInstallBanner.tsx` — if you don't want a banner prompting users to install
- Entire service worker (`sw.js`) — if you don't need offline support at all (remove `ServiceWorkerRegistration` too)

---

## Appendix: Dependency Map

Which modules depend on which:

```
Auth (B) ←─────────── all modules depend on this
  │
  ├── POS (C) ──────── Offline/Sync (L)
  │                    Inventory (D) [for cache]
  │
  ├── Inventory (D) ── Settings: Categories, Sizes, QR Prefixes
  │
  ├── Sales (E) ──────  Inventory (D) [returns update item status]
  │
  ├── Finance (F) ───── Sales (E) [auto-creates transactions]
  │
  ├── Attendance (G) ── (standalone)
  │
  ├── Checklists (H) ── (standalone)
  │
  ├── Reports (I) ───── Sales (E) + Inventory (D) + Attendance (G)
  │
  └── User Mgmt (J) ── (standalone beyond Auth)

Theme System (A) ←──── all modules (reads CSS vars + appConfig)
PWA (M) ←──────────── all modules (wraps the whole app)
Offline/Sync (L) ←──── POS (C) only
```

## Appendix: npm Packages by Module

| Package | Used By |
|---|---|
| `@supabase/supabase-js` | B (Auth) — all modules indirectly |
| `@supabase/auth-helpers-nextjs` | B (Auth) |
| `next-themes` | A (Theme System) |
| `html5-qrcode` | C (POS) |
| `idb` | L (Offline/Sync) |
| `qrcode` | D (Inventory) |
| `jszip` | D (Inventory), K14 (QR Download) |
| `html2canvas` | E (Bill Print), D (QR Download) |
| `jspdf` | E (Bill Print) |
| `recharts` | I (Reports) |
| `xlsx` | I (Reports), K8 (Export Button) |
| `date-fns` | G (Attendance), I (Reports), K3 (Date Filter) |
| `framer-motion` | K4 (Stats Cards), K11 (Brand Loader) |
| `cmdk` | K2 (Command Palette) |
| `@tsparticles/react` + `@tsparticles/engine` | K13 (Particle Background) |
