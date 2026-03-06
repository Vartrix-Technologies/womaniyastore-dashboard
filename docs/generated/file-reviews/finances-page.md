# File Review: Finances Module

**Last Updated:** February 8, 2026  
**Files:**
- `src/app/(protected)/admin/finances/page.tsx` — 867 lines

---

## 1. Architecture

**Page responsibility:** Financial dashboard with expense management, revenue tracking, category breakdown visualization, and CSV export.

**What this module does NOT do:**
- Process payments (POS handles this)
- Edit/delete past expenses (immutable after creation)
- Manage invoices or tax filings
- Vendor profit reporting (was mentioned in old review — not present in code)

**Dependencies:**

| Import | Purpose |
|--------|---------|
| `StatsCardGrid` | Summary stat cards (display-only, no toggle filtering) |
| `DateRangeFilter` | Shared date filter with buffered Apply |
| `useDateFilter` | Date preset + custom range state |
| `useServerPagination` | Server-side pagination for expenses |
| `useSortableTable` | Column sort state |
| `useDebouncedSearch` | 500ms debounced search |
| `SortableHeader` | Sortable column headers |
| `FieldError` / `useFormErrors` | Form validation with inline error display |
| `formatCurrency` / `formatDate` | Shared formatters |
| `exportToCSV` | Shared CSV export utility |

---

## 2. Data Flow

### Mount
1. `useEffect` fires on `profile.shop_id` + all filter/sort/pagination deps
2. `loadExpenseCategories()` — dropdown options
3. `loadFinancialData()` — parallel fetch of all financial data

### loadFinancialData (Lines 113–237)
Uses `Promise.all` for ~3x faster load:
1. `salesQuery` — total revenue (just amounts from `sales`)
2. `transQuery` — paginated expenses with category joins, `{ count: 'exact' }`
3. `inventoryQuery` — available stock value (`selling_price_default`)
4. `statsTransQuery` — **full** expense dataset for accurate totals (not paginated)

### Category Breakdown (Lines 221–233)
- **Known bug:** Built from `transactionsData` (paginated) — percentages reflect current page only, not all expenses
- Hardcoded 6 colors: `bg-red-500` through `bg-green-500`, cycling on overflow
- Horizontal bar chart with percentage labels

### Add Expense (Lines 241–278)
- Validated via `useFormErrors` — amount, description, category required
- Inline category creation: toggles between `Select` and `Input + Plus + X`
- Auto-selects newly created category
- Reloads all data on success

### Export (Lines 322–362)
- Fetches **all** expenses matching current filters (ignores pagination)
- Uses shared `exportToCSV` utility
- Toast feedback on success/error/empty

---

## 3. Checklist Assessment

### Config-Driven Theming — 1/10 ❌
- [ ] No `appConfig` import, no `const s = appConfig.styles`
- [ ] Hardcoded `text-teal-600 hover:text-teal-700 hover:bg-teal-50` on back button (line 381)
- [ ] Hardcoded `bg-gradient-to-r from-teal-500 to-cyan-600` on CTA buttons (lines 392, 860)
- [ ] Header icon: bare `<PieChart className="h-6 w-6 text-teal-600" />` — no gradient badge
- [ ] Hardcoded `hover:scale-105 active:scale-95 transition-all` on buttons
- [x] Uses `DateRangeFilter` (shared component handles its own tokens internally)

### Page Header — 4/10 ⚠️
- [x] Back button: `variant="ghost"`, `-ml-2`, `ArrowLeft` icon — but hardcoded colors
- [ ] **Missing:** Gradient icon badge — icon sits inline with title text, no badge container
- [x] Title: `text-2xl font-bold tracking-tight` with subtitle
- [x] Action button ("Add Expense") right-aligned on desktop
- [ ] **Missing:** Title row uses `flex items-center gap-2` (should be `gap-3` with badge)

### Stats Cards — 5/10 ⚠️
- [x] Uses `StatsCardGrid` component (Option A from Bible — acceptable)
- [x] 6 stats with icons, semantic colors, subtitles
- [x] Loading skeleton built into `StatsCardGrid`
- [ ] **Missing:** Stats are display-only — no toggle filtering behavior
- [ ] **Missing:** No `border-l-4` active states, no opacity dimming
- [ ] Net Profit correctly shows red when negative (`summary.netProfit >= 0`)
- [ ] "Cash Flow" duplicates Net Profit — redundant metric

### Date Filtering — 10/10 ✅
- [x] Uses shared `DateRangeFilter` component
- [x] Paired with `useDateFilter({ initialFilter: 'week' })`
- [x] Buffered Apply pattern works correctly
- [x] Date range applied consistently to all queries (`startDateISO`, `endDateISO`)

### Filter Toolbar — 4/10 ⚠️
- [x] `useDebouncedSearch` with `delay: 500`, `pl-9` search icon layout
- [x] Category `Select` dropdown with all categories
- [ ] **Missing:** No active filter chips showing what's currently filtered
- [ ] **Missing:** No "Clear all" button (only appears in empty state)
- [ ] **Missing:** No descriptive subtitle ("X expenses in {category}")
- [ ] Search and category filter are stacked vertically — could be side-by-side on desktop

### Table & Data — 6/10 ⚠️
- [x] Server-side pagination via `useServerPagination` + `.range(from, to)`
- [x] Server-side sorting via `useSortableTable` + `SortableHeader`
- [x] Server-side search via `useDebouncedSearch` + `.ilike()`
- [x] Pagination footer: showing X-Y of Z, items-per-page Select, page arrows
- [ ] **Missing:** No row status tinting (all expenses look identical)
- [ ] **Missing:** No inline skeleton rows during re-fetch — uses full card skeleton
- [ ] **Missing:** No keyboard pagination (`ArrowLeft`/`ArrowRight`)
- [ ] **Missing:** No action buttons on rows (no edit/delete/view)

### Dialogs — 3/10 ❌
- **Form dialog (Add Expense):**
  - [x] Validation with `FieldError` + `useFormErrors`
  - [x] Submit spinner: `Loader2 animate-spin`
  - [x] Gradient submit button (hardcoded)
  - [x] Inline category creation with Enter key support
  - [ ] **Missing:** `p-0 overflow-hidden` premium pattern
  - [ ] **Missing:** No gradient icon badge in header
  - [ ] **Missing:** Labels use `Label` not uppercase tracking style
  - [ ] **Missing:** No `max-w-[calc(100%-2rem)]` for mobile
- **No detail dialog** for viewing individual expenses
- **No Sheet/Drawer** used

### Mobile Responsiveness — 7/10 ⚠️
- [x] `space-y-4 md:space-y-6` page wrapper
- [x] Stats responsive via `StatsCardGrid` (handles grid internally)
- [x] Table has `overflow-x-auto` + `min-w-[600px]`
- [x] Pagination stacks on mobile (`flex-col sm:flex-row`)
- [ ] **Missing:** Dialog uses `sm:max-w-[500px]` — no mobile `max-w-[calc(100%-2rem)]`
- [ ] **Missing:** Search/category filters don't go side-by-side on desktop (`flex-col` only)

### Interactions — 5/10 ⚠️
- [x] CTA buttons have animation (hardcoded `hover:scale-105 active:scale-95`)
- [x] Export button has animation
- [x] `hover:bg-muted/50 transition-colors` on table rows
- [ ] **Missing:** No action buttons on expense rows (no edit/delete)
- [ ] **Missing:** No optimistic UI patterns
- [ ] **Missing:** No `ConfirmDialog` usage (no destructive actions available)

### Empty States — 5/10 ⚠️
- [x] Separate empty states for "no data" vs "no filter results"
- [x] Clear filters button in filter-results empty state
- [ ] **Missing:** Hand-rolled empty state — not shared `EmptyState` component
- [ ] **Missing:** Icon not in `rounded-full bg-muted p-4` circle
- [ ] Category breakdown bar chart disappears entirely when no expenses — no empty state shown

### Core Rules — 9/10 ✅
- [x] No `confirm()`, `alert()`, `prompt()`
- [x] Server-side pagination/filtering
- [x] Uses `DateRangeFilter` (not `DateFilterTabs`)
- [x] Uses `StatsCardGrid`
- [x] Supabase errors checked via `.error` + throw
- [x] Debounced search at 500ms
- [x] Toast via sonner consistently
- [ ] Category breakdown uses paginated data (architectural bug, not rule violation)

### **Overall Score: 19/40** — Needs premium treatment

---

## 4. Risks

| Risk | Severity | Description |
|------|----------|-------------|
| Category breakdown from paginated data | **High** | Percentages reflect current page only — misleading when >1 page |
| No expense edit/delete | **Medium** | Mistakes are permanent — no correction mechanism |
| Inventory value misleading | **Medium** | Uses `selling_price_default` not `cost_price_per_unit` — inflates asset value |
| "Cash Flow" duplicates Net Profit | **Low** | Same calculation, takes up a stat card |
| `salesQuery` fetches all sale amounts | **Low** | No pagination — memory risk for shops with thousands of sales |
| Future dates allowed for expenses | **Low** | No max-date constraint on date input |
| Negative amounts allowed | **Low** | No min constraint on amount field |
| Category name duplicates | **Low** | Case-sensitive — "Rent" and "rent" are separate |

---

## 5. TODOs — UI/UX

| # | Task | Priority | Effort |
|---|------|----------|--------|
| 1 | **Adopt `appConfig.styles` tokens** — add `const s = appConfig.styles`, replace all hardcoded teal/gradient/animation classes | **High** | 30 min |
| 2 | **Add gradient icon badge** to page header (match inventory pattern: `p-2.5 rounded-lg ${s.headerIconGradient} text-white shadow-md`) | **High** | 10 min |
| 3 | **Add active filter chips** — `Badge variant="secondary"` per active filter with X dismiss + "Clear all" link | **High** | 30 min |
| 4 | **Replace hand-rolled empty state** with shared `EmptyState` component | Medium | 15 min |
| 5 | **Add inline skeleton rows** during table re-fetch instead of full-card skeleton | Medium | 30 min |
| 6 | **Upgrade Add Expense dialog** to premium pattern: `p-0 overflow-hidden`, gradient badge header, uppercase tracking labels, `Separator` | Medium | 45 min |
| 7 | **Add keyboard pagination** — `ArrowLeft`/`ArrowRight` event listeners | Medium | 15 min |
| 8 | **Make search + category filter side-by-side** on desktop (`flex-col sm:flex-row gap-3`) | Medium | 10 min |
| 9 | **Add descriptive subtitle** below card title: "X expenses in {category} for {date range}" | Low | 15 min |
| 10 | **Remove "Cash Flow" stat card** — redundant with Net Profit, or differentiate it | Low | 10 min |
| 11 | **Add staggered fade-in** animation to category breakdown bars | Low | 20 min |
| 12 | **Add `max-w-[calc(100%-2rem)]`** to Add Expense dialog for mobile | Low | 5 min |

## 6. TODOs — Functionality

| # | Task | Priority | Effort |
|---|------|----------|--------|
| 1 | **Fix category breakdown** — run separate aggregation query on full dataset, not paginated `transactionsData` | **High** | 1 hr |
| 2 | **Add expense edit** — inline or dialog-based editing with audit trail | **High** | 3 hr |
| 3 | **Add expense delete** — soft delete with `ConfirmDialog` + toast undo pattern | **High** | 1.5 hr |
| 4 | **Add expense detail view** — premium `p-0` dialog showing full expense record + edit button | Medium | 1.5 hr |
| 5 | **Fix inventory value** — use `cost_price_per_unit` for true asset valuation (or toggle cost/selling) | Medium | 30 min |
| 6 | **Add form validation** — min amount >0, max reasonable amount, no future dates, trim whitespace | Medium | 30 min |
| 7 | **Consolidate sales revenue query** — use `{ count: 'exact', head: false }` with `.select('total_amount')` + server-side aggregation (RPC) to avoid fetching all rows | Medium | 1.5 hr |
| 8 | **Add stats toggle filtering** — clicking "Total Expenses" card filters to expenses view, clicking "Revenue" could show sales breakdown | Medium | 2 hr |
| 9 | **Case-insensitive category dedup** — check for existing category name (lowered) before creating | Low | 15 min |
| 10 | **Add URL-synced filters** via `useSearchParams` (preserve filter state on back navigation) | Low | 1.5 hr |
| 11 | **Server-side aggregation** — replace client-side revenue/expense sum with Supabase RPC function | Low | 2 hr |

---

> **Version:** 2.0  
> **Reviewed against:** PAGE_ANALYSIS_CHECKLIST v2.0, DESIGN_SYSTEM_BIBLE v2.0
