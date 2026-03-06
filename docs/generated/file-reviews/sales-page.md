# File Review: src/app/(protected)/admin/sales/page.tsx

**Last Updated**: February 8, 2026  
**Lines of Code**: 715  
**Version**: 2.0 (Checklist-scored rewrite)  
**Checklist Score**: **18/40** — needs rework  
**Recent Changes**: Tabs (Transactions / Analytics / Vendors), URL-synced state, BillPreviewDialog, StatsCardGrid, smart bill-number search, analytics components

---

## 1. File Responsibility

**Primary Purpose**: Multi-tab sales hub — paginated transaction list, category/sale-type analytics, and vendor performance dashboards, unified under a shared date filter and URL-synced state.

**Role in the System:**  
Central sales reporting interface. Shows all completed sales with customer info, payment method, discounts, and sale-type breakdown. Provides analytics and vendor-level drilldown. Uses `BillPreviewDialog` for invoice preview/print/PDF/share.

**What This File Intentionally Does NOT Do:**
- Does NOT create sales (handled by POS)
- Does NOT edit or delete sales (audit-trail integrity)
- Does NOT process returns (separate workflow needed)
- Does NOT send bills (BillPreviewDialog handles display only)

**Key Dependencies:**
| Dependency | Purpose |
|-----------|---------|
| `@/lib/api/sales` — `getSalesStats()` | Stats from full filtered dataset |
| `@/context/AuthContext` | `profile.shop_id` for multi-tenancy |
| `@/hooks` | `useDateFilter`, `useServerPagination`, `useSortableTable`, `useDebouncedSearch` |
| `@/components/shared/DateRangeFilter` | Date range selection with buffered Apply |
| `@/components/shared/StatsCardGrid` | Stats display (display-only, no toggle) |
| `@/components/shared/SortableHeader` | Sortable column headers |
| `@/components/shared/BillPreviewDialog` | Bill preview with print/PDF/share |
| `@/components/admin/analytics` | `VendorPerformance`, `CategoryPerformance`, `SaleTypeAnalysis` |

---

## 2. Execution Flow

### Initial Load Sequence
**Trigger:** Component mount with authenticated user  
**Dependencies:** `profile.shop_id`, `dateFilter`, `customRange`, `currentPage`, `itemsPerPage`, `debouncedSearchTerm`, `sortBy`, `sortOrder`, `saleTypeFilter`

1. `useSearchParams()` reads `tab` and `filter` from URL → hydrates `activeTab` and `dateFilter`
2. `useDateFilter({ initialFilter })` calculates `startDateISO` / `endDateISO`
3. `loadSales()` builds Supabase query with all filters
4. Fetches paginated results + separate `getSalesStats()` call for full-dataset stats

### URL Sync (Lines 75–84)
**Unique to this page.** Syncs `activeTab` and `dateFilter` back into the URL via `router.replace()` — enables bookmarkable deep links like `/admin/sales?tab=analytics&filter=month`.

### loadSales() — Main Data Fetch (Lines 101–201)
**Trigger:** Any filter/pagination/sort change  
**Steps:**
1. Build query with `sale_items` join + `{ count: 'exact' }`
2. Apply date filter: `.gte()` / `.lte()` on `created_at`
3. Smart search: numeric ≥4 digits → prefix-match `bill_number` range + name/phone; text → name/phone only
4. Apply sort + `.range(from, to)` pagination
5. **Client-side** sale-type filter (regular/mixed/festival/clearance/promotion) — because `sale_type` lives on `sale_items`, not `sales`
6. Separate `getSalesStats()` call for full-dataset totals

**Smart Bill Number Search (Lines 131–146):**
Detects numeric input ≥4 digits. Pads to 14-char min/max for YYYYMMDDHHMMSS prefix matching via `bill_number.gte` / `bill_number.lte`. Falls back to name/phone for shorter or text input.

### exportSales() — CSV Export (Lines 210–267)
Fetches ALL matching sales (no pagination limit). Maps each sale to columns including per-type item counts. Uses `exportToCSV()` utility + toast feedback.

### Tab Architecture (Lines 316–715)
| Tab | Content |
|-----|---------|
| `transactions` | Stats → Filters → Table → Pagination |
| `analytics` | DateRangeFilter → `CategoryPerformance` + `SaleTypeAnalysis` grid |
| `vendors` | DateRangeFilter → `VendorPerformance` card |

All three tabs share the same `dateFilter` state + `useDateFilter` hook.

---

## 3. Business Rules & Assumptions

**Explicit Rules:**
- Stats calculated from FULL filtered dataset (not page) via dedicated `getSalesStats()` API
- Sale-type badges: 🟢 festival, 🔴 clearance, 🔵 promotion (colored dots in bill-number cell)
- Client-side sale-type filter after paginated fetch
- Default sort: `created_at` descending
- Smart search: ≥4 numeric digits → bill number prefix match; else → name/phone

**Implicit Assumptions:**
- `bill_prefix` may be undefined (fallback `''`)
- `sale_items` always joined (may be empty array)
- Walk-in customer when `customer_name` is null → "Walk-in"
- Tab/filter URL params optional — defaults to `transactions` / `week`

---

## 4. PAGE_ANALYSIS_CHECKLIST — Detailed Scoring

### ✅ = Pass · ⚠️ = Partial · ❌ = Fail · N/A = Not Applicable

### §1 Config-Driven Theming — **1/10** ❌

| Check | Status | Detail |
|-------|--------|--------|
| Imports `appConfig`, aliases `const s = appConfig.styles` | ❌ | Not imported at all |
| Gradients use `s.primaryGradient` | ❌ | No gradient anywhere — plain icon `text-teal-600` |
| Header icon badge uses `s.headerIconGradient` | ❌ | No gradient icon badge, just inline `Receipt` |
| Back button uses `s.linkColor` + `s.linkHover` | ❌ | Hardcoded `text-teal-600 hover:text-teal-700 hover:bg-teal-50` (L297) |
| Stats active states use `s.statsActive.*` | ❌ | `StatsCardGrid` used display-only — no toggle, no active tokens |
| Row tinting uses `s.rowTint.*` | ❌ | No row tinting at all |
| Button animations use `s.btnAnimation` | ❌ | Hardcoded `hover:scale-105 active:scale-95` on Export (L336, L374) |
| Zero hardcoded teal classes | ❌ | 5 occurrences of `text-teal-600` (L297, L308, L641, L680) |

### §2 Page Header — **4/10** ⚠️

| Check | Status | Detail |
|-------|--------|--------|
| Back button: `variant="ghost"` + tokens | ⚠️ | Correct structure, but hardcoded colors instead of `s.linkColor` |
| Gradient icon badge (rounded-lg, shadow-md) | ❌ | Plain `<Receipt className="h-6 w-6 text-teal-600" />` — no badge wrap |
| Title row: flex gap-3 + heading + subtitle | ✅ | Correct: `text-2xl font-bold` + subtitle below |
| Action buttons right-aligned | ❌ | Export button lives inside table CardHeader, not in page header row |

### §3 Stats Cards — **5/10** ⚠️

| Check | Status | Detail |
|-------|--------|--------|
| Uses inline buttons or StatsCardGrid | ✅ | Uses `StatsCardGrid` component |
| Grid `grid-cols-2 lg:grid-cols-4` | ✅ | Via StatsCardGrid internal layout |
| Active toggle filtering | ❌ | Display-only — no click interactions, no `onClick` or `isActive` props passed |
| Filter hint below grid | ❌ | Missing |
| Stats from full dataset | ✅ | Uses separate `getSalesStats()` API call |

### §4 Date Filtering — **8/10** ✅

| Check | Status | Detail |
|-------|--------|--------|
| Uses shared `DateRangeFilter` | ✅ | Three instances (transactions, analytics, vendors tabs) |
| Paired with `useDateFilter()` hook | ✅ | With `initialFilter` from URL |
| Grid responsive `grid-cols-3 sm:grid-cols-5` | ✅ | Via component internals |
| Buffered Apply for custom range | ✅ | Via component |
| Clear resets to `'week'` | ✅ | Via component |
| *(Deduction)* Three separate DateRangeFilter instances for same state | ⚠️ | Functional but visually redundant |

### §5 Filter Toolbar & Chips — **3/10** ❌

| Check | Status | Detail |
|-------|--------|--------|
| Search uses `useDebouncedSearch` | ✅ | `delay: 500` (L66) |
| Dropdowns use shadcn `Select` | ✅ | Sale-type Select with colored dots |
| No duplicate filtering | ✅ | Stats don't filter, Select is the only type filter |
| Active filter chips (Badge + X dismiss) | ❌ | Not implemented — active filters not visualized |
| "Clear all" link | ❌ | Missing |
| Descriptive subtitle with counts | ❌ | Only "Total {count} bills" — no filter description |

### §6 Table & Data Display — **7/10** ✅

| Check | Status | Detail |
|-------|--------|--------|
| Server-side pagination | ✅ | `useServerPagination` + `.range(from, to)` |
| Server-side sorting | ✅ | `useSortableTable` + `SortableHeader` on 3 columns |
| Server-side search | ✅ | Smart bill-number prefix match + name/phone |
| Row status tinting | ❌ | No `s.rowTint.*` — all rows plain `hover:bg-muted/50` |
| Skeleton loading rows | ✅ | 5 skeleton rows with correct shape |
| Pagination footer | ✅ | "Showing X to Y of Z" + per-page Select + page arrows |
| Keyboard pagination | ✅ | ArrowLeft/Right with input guard |
| *(Deduction)* Client-side sale-type filter on paginated data | ⚠️ | Count mismatch possible at page boundary |

### §7 Dialogs & Sheets — **7/10** ✅

| Check | Status | Detail |
|-------|--------|--------|
| BillPreviewDialog | ✅ | Full invoice layout, multi-format print, PDF, Share API |
| Opens via eye icon on each row | ✅ | `onClick={() => setViewingSale(sale)}` |
| Dialog is read-only (no form) | ✅ | View/print/share only |
| *(N/A)* Form dialog patterns | — | No forms on this page |
| *(N/A)* Sheet/Drawer | — | Not applicable |

### §8 Mobile Responsiveness — **7/10** ✅

| Check | Status | Detail |
|-------|--------|--------|
| Page wrapper `space-y-4 md:space-y-6` | ✅ | L289 |
| Grids collapse | ✅ | Stats 2x2, forms stack, tabs grid-cols-3 |
| Touch targets ≥ 32px | ✅ | Pagination buttons `h-8 w-8`, form inputs `h-10` |
| No horizontal overflow except table | ✅ | Table has `overflow-x-auto` + `min-w-[800px]` |
| Tabs responsive (icon-only on mobile) | ✅ | `<span className="hidden sm:inline">` hides label text |
| *(Deduction)* No card-view fallback for mobile | ⚠️ | Horizontal scroll is functional but not ideal |

### §9 Typography — **8/10** ✅

| Check | Status | Detail |
|-------|--------|--------|
| Page heading `text-2xl font-bold` | ✅ | L307 |
| Card titles `text-lg` | ✅ | "Recent Bills", "Sales Analytics", "Vendor Performance" |
| Stat numbers (via StatsCardGrid) | ✅ | Component handles `tabular-nums` |
| No `text-3xl` | ✅ | Correct |
| Table text `text-xs` | ✅ | Consistent small table cells |
| Mono for bill numbers `font-mono text-xs font-semibold` | ✅ | L485 |

### §10 Interactions & Touch — **4/10** ⚠️

| Check | Status | Detail |
|-------|--------|--------|
| Primary CTA uses `s.primaryGradient` + `s.btnAnimation` | ❌ | No gradient CTAs at all |
| Cards/stats use `s.btnAnimationSubtle` | ❌ | StatsCardGrid display-only — no hover animations |
| Action buttons always visible | ✅ | Eye icon not behind group-hover |
| Action buttons `size="icon" variant="ghost" h-8 w-8` | ⚠️ | Uses `size="sm"` instead of `size="icon"` |
| Delete buttons `hover:text-red-600` | N/A | No delete |
| Loading skeletons match layout | ✅ | Skeleton rows match card shape |
| Optimistic UI | N/A | Read-only page, no mutations |

### §11 Empty & Error States — **4/10** ⚠️

| Check | Status | Detail |
|-------|--------|--------|
| Uses shared `EmptyState` component | ❌ | Custom inline empty state (L446–451) |
| Icon in `rounded-full bg-muted p-4` | ❌ | Plain `Receipt` icon, no circle wrap |
| Title + subtitle | ✅ | "No sales found" + "Start making sales at the POS" |
| CTA button | ❌ | No action button (e.g., "Go to POS") |
| `colSpan` for table empty | ❌ | Empty state outside table, not spanning columns |
| Error state UI | ❌ | Errors logged to console only, no error UI |

### §12 Core Rules — **6/10** ⚠️

| Check | Status | Detail |
|-------|--------|--------|
| No `confirm()` / `alert()` / `prompt()` | ✅ | Uses `toast` from sonner |
| No client-side filtering of large datasets | ⚠️ | Sale-type filter is client-side (justified but imperfect) |
| No `DateFilterTabs` | ✅ | Uses `DateRangeFilter` |
| Uses `StatsCardGrid` or inline buttons | ✅ | StatsCardGrid |
| Supabase error handling | ⚠️ | Uses `throw error` after `if (error)` — correct but no user-facing error state |
| Search debounced | ✅ | 500ms delay |
| Toast via sonner | ✅ | Export success/warning/error |

---

## 5. Checklist Score Summary

| Metric | Score | Notes |
|--------|-------|-------|
| Config compliance (no hardcoded colors) | **1/10** | Zero `appConfig` import. 5 hardcoded `text-teal-600`. No tokens. |
| Mobile responsiveness | **7/10** | Good collapse, table scrolls, tabs icon-only. No card-view fallback. |
| Design consistency | **5/10** | StatsCardGrid + DateRangeFilter ✅, but no gradient badge, no chips, no row tinting |
| Interaction quality | **5/10** | Keyboard nav + BillPreviewDialog ✅, but no token animations, no stat toggle, hardcoded scales |
| **Overall** | **18/40** | **Needs rework** (threshold: <24) |

---

## 6. Unique / Premium Patterns (Bible-Worthy)

These patterns are unique to the sales page and should be cross-referenced in the Bible:

### 6.1 URL-Synced Tab + Filter State
```tsx
const initialTab = searchParams.get('tab') || 'transactions';
const initialFilter = (searchParams.get('filter') as DateFilterType) || 'week';

useEffect(() => {
  const params = new URLSearchParams();
  if (activeTab !== 'transactions') params.set('tab', activeTab);
  if (dateFilter !== 'week') params.set('filter', dateFilter);
  router.replace(params.toString() ? `?${params.toString()}` : '/admin/sales', { scroll: false });
}, [activeTab, dateFilter, router]);
```
**Why it matters:** Enables bookmarkable deep-links. Pattern should be extracted to a `useUrlSyncedState` hook.

### 6.2 Smart Bill-Number Search
```tsx
if (isNumericSearch && searchLower.length >= 4) {
  const paddedMin = searchLower.padEnd(14, '0');
  const paddedMax = searchLower.padEnd(14, '9');
  query = query.or(
    `customer_name.ilike.%${searchLower}%,customer_phone.ilike.%${searchLower}%,and(bill_number.gte.${paddedMin},bill_number.lte.${paddedMax})`
  );
}
```
**Why it matters:** Numeric prefix-match on YYYYMMDDHHMMSS bill numbers. Elegant range-match pattern.

### 6.3 Multi-Tab Shared Date Filter
All three tabs share the same `dateFilter` / `useDateFilter` state. Each tab renders its own `DateRangeFilter` instance. Works but is visually redundant — a global filter bar above tabs would be cleaner.

---

## 7. TODO Table: UI/UX Improvements

| # | Task | Priority | Effort | Checklist Ref |
|---|------|----------|--------|---------------|
| U1 | Adopt `appConfig.styles` — import `const s = appConfig.styles`, replace all 5 hardcoded `text-teal-600` + hardcoded `hover:scale-*` with tokens | **P0** | 30 min | §1 |
| U2 | Add gradient icon badge to page header — `p-2.5 rounded-lg ${s.headerIconGradient} text-white shadow-md` wrapping `Receipt` | **P0** | 15 min | §2 |
| U3 | Make stats cards interactive — pass `onClick` + `isActive` + `activeClassName` to `StatsCardGrid` or switch to inline-button pattern; toggle filters total/revenue/discount/avg | **P1** | 1.5 hr | §3 |
| U4 | Add active filter chips — show "Sale Type: Festival [×]", "Search: xyz [×]" badges below filter row; "Clear all" link | **P1** | 1 hr | §5 |
| U5 | Add row tinting — use `s.rowTint.*` tokens to tint rows by sale-type composition (festival green, clearance red, mixed amber) | **P1** | 45 min | §6 |
| U6 | Use shared `EmptyState` component — wrap in `rounded-full bg-muted p-4` circle, add CTA "Go to POS" button | **P2** | 20 min | §11 |
| U7 | Move Export button to page header action area — right-aligned next to title on desktop, stacked on mobile | **P2** | 15 min | §2 |
| U8 | Fix eye icon button — change `size="sm"` to `size="icon"` + `h-8 w-8` for consistency | **P2** | 5 min | §10 |
| U9 | Hoist DateRangeFilter above tabs — single instance shared by all 3 tabs instead of 3 duplicates | **P2** | 30 min | §4 |
| U10 | Add error state UI — show error card with retry button instead of console.error only | **P2** | 30 min | §11 |
| U11 | Add descriptive filter subtitle — "Showing 156 bills in Festival sales (This Week)" below stats | **P3** | 15 min | §5 |
| U12 | Skeleton-to-content crossfade — `animate-in fade-in duration-300` when loading becomes false | **P3** | 15 min | Premium |

---

## 8. TODO Table: Functionality Improvements

| # | Task | Priority | Effort | Notes |
|---|------|----------|--------|-------|
| F1 | Extract `useSalesData` hook — encapsulate `loadSales()`, stats fetch, sale-type filter logic into a dedicated hook; reduce page to ~400 lines | **P1** | 2 hr | Refactor signal |
| F2 | Extract `useUrlSync` hook — generalize URL tab/filter sync pattern for reuse on other tabbed pages | **P1** | 1 hr | Bible §10.1 pattern |
| F3 | Server-side sale-type filter via Supabase RPC — eliminate client-side filtering; accurate pagination counts | **P1** | 3 hr | Current client-side filter causes count mismatch at page boundaries |
| F4 | Add export size warning — check `totalCount` before export, warn dialog if >10k records | **P2** | 30 min | Risk: browser freeze |
| F5 | Extract `PaginationControls` component — ~80 lines of pagination UI duplicated across pages | **P2** | 1 hr | Shared component |
| F6 | Add customer history link — click customer name → navigate to customer detail with purchase history | **P2** | 2 hr | Premium feature |
| F7 | Sale-type filter in export — current export doesn't apply sale-type filter; should mirror main query | **P2** | 30 min | Bug: export ignores sale-type |
| F8 | Add refund/return indicator — visually distinguish refunded sales in table | **P3** | 2 hr | Requires DB field |
| F9 | Streaming export — for large datasets, use chunked fetch + progress toast instead of single fetch | **P3** | 3 hr | Scalability |
| F10 | Analytics lazy-load — wrap analytics components in `Suspense` boundaries so they don't block tab switch | **P3** | 30 min | Performance |

---

## 9. Cross-Reference: Bible Compliance

| Bible Section | Status | Gap |
|--------------|--------|-----|
| §2.1 Token reference | ❌ | No `appConfig` import |
| §3.1 Stats cards (interactive toggle) | ⚠️ | Uses `StatsCardGrid` but display-only |
| §4.1 Button animation tokens | ❌ | Hardcoded `hover:scale-105` |
| §5.5 DateRangeFilter | ✅ | Correct usage with `useDateFilter` |
| §7.1 Back button tokens | ❌ | Hardcoded teal |
| §7.3 Header icon badge | ❌ | No badge — plain icon |
| §8.3 Premium dialog (p-0 pattern) | ✅ | `BillPreviewDialog` is separate component |
| §10.1 URL-synced filters | ✅ | Unique to this page — Bible should reference it |
| §12 Anti-patterns | ⚠️ | No `alert()`/`confirm()` ✅ but client-side large-dataset filter ⚠️ |

---

## 10. Risks & Edge Cases

| Risk | Severity | Description |
|------|----------|-------------|
| Client-side sale-type filter | **High** | Pagination count wrong when filter removes rows from fetched page |
| Large export (no limit) | **Medium** | No warning before 50k+ record export — browser may freeze |
| Export ignores sale-type filter | **Medium** | User expects filtered export but gets all types |
| 3 DateRangeFilter instances | **Low** | Same state but renders 3 times — wasted renders |
| Error state missing | **Medium** | Network errors → console.error only, user sees infinite loading |

---

*Review updated: February 8, 2026 — Version 2.0 (Checklist-scored rewrite)*
