# File Review: Inventory Module

**Last Updated:** February 8, 2026
**Files:**
- `src/app/(protected)/admin/inventory/page.tsx` — 817 lines
- `src/components/shared/InventoryItemDetailsDialog.tsx` — 245 lines
- `src/components/shared/CategoryBreakdownSheet.tsx` — 268 lines

---

## 1. Architecture

**Page responsibility:** Server-side paginated inventory listing with filtering, sorting, search, export, and deletion.

**What this module does NOT do:**
- Create/edit items (delegated to `/add-lot/page.tsx`)
- POS operations (selling, scanning)
- Batch operations beyond single-item delete

**Dependencies:**

| Import | Purpose |
|--------|---------|
| `appConfig` from `@/lib/config` | All style tokens via `const s = appConfig.styles` |
| `useServerPagination` | Range-based Supabase pagination |
| `useSortableTable` | Column sort state |
| `useDebouncedSearch` | 500ms debounced search |
| `useDateFilter` | Date preset + custom range state |
| `DateRangeFilter` | Shared date filter UI (buffered Apply) |
| `SortableHeader` | Clickable sortable column headers |
| `InventoryItemDetailsDialog` | Premium detail dialog |
| `CategoryBreakdownSheet` | Right-side drawer with analytics |
| `ConfirmDialog` | Destructive delete confirmation |

---

## 2. Data Flow

### Mount
1. `useEffect` fires on `profile.shop_id` + all filter/sort/pagination deps
2. Parallel calls: `fetchInventory()` + `fetchCategories()`
3. `getStats()` runs separately when `inventory` changes

### fetchInventory (Lines 164–268)
- Two-step search: first finds matching QR code IDs, then filters `inventory_items` with `.in('qr_code_id', ids)`
- Applies: status filter, category filter, date range filter, sort, `.range(from, to)`
- Sets `inventory[]` + `totalCount`

### getStats (Lines 78–110)
- Four separate `{ count: 'exact', head: true }` queries (total, available, sold, damaged)
- Runs on every inventory change

### handleDeleteItem (Lines 130–162)
- Opens `ConfirmDialog` with item QR code
- On confirm: delete QR code first (FK constraint), then inventory item
- **Risk:** Non-atomic — if QR deletes but item fails, QR is orphaned

---

## 3. Checklist Assessment

### Config-Driven Theming — 10/10 ✅
- [x] `const s = appConfig.styles` at module level
- [x] Header badge: `${s.headerIconGradient}`
- [x] Back button: `${s.linkColor} ${s.linkHover}`
- [x] Stats active states: `s.statsActive.*` per status
- [x] Row tinting: `s.rowTint.*` via `saleType` lookup
- [x] CTA buttons: `${s.primaryGradient} ${s.primaryGradientHover} ${s.btnAnimation}`
- [x] Zero hardcoded teal/cyan classes

### Page Header — 10/10 ✅
- [x] Back button with `ArrowLeft`, `variant="ghost"`, token colors
- [x] Gradient icon badge: `p-2.5 rounded-lg ${s.headerIconGradient} text-white shadow-md`
- [x] Title row: `flex items-center gap-3` with heading + subtitle
- [x] Action buttons right-aligned on desktop, wrap on mobile

### Stats Cards — 10/10 ✅
- [x] Inline `<button>` elements in `grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-3`
- [x] Active: `border-l-4 shadow-sm` + token classes
- [x] Inactive-while-filtered: `opacity-50 hover:opacity-80`
- [x] Toggle behavior: click deselects, resets pagination
- [x] Filter hint: `text-[11px]` with `Filter` icon

### Date Filtering — 10/10 ✅
- [x] Shared `DateRangeFilter` component
- [x] Paired with `useDateFilter({ initialFilter: 'all' })`
- [x] Responsive grid: `grid-cols-3 sm:grid-cols-5`
- [x] Buffered Apply button — no premature fetch
- [x] Clear resets to `'week'`

### Filter Toolbar — 9/10 ⚠️
- [x] `useDebouncedSearch` with `delay: 500`, `pl-9` search icon
- [x] Category dropdown via shadcn `Select`
- [x] No duplicate status dropdown (stats cards handle it)
- [x] Active filter chips with `Badge + X` dismiss
- [x] "Clear all" link
- [x] Descriptive subtitle with count/status/category
- [ ] **Missing:** Filter chips not extracted into shared `FilterChips` component (duplicated in QR codes)

### Table & Data — 9/10 ⚠️
- [x] Server-side pagination, sorting, search
- [x] Row tinting via `s.rowTint.*`
- [x] Table loading overlay (`bg-background/60` + `RefreshCw` spinner)
- [x] Full-page skeleton on `initialLoading`
- [x] Pagination footer with items-per-page select
- [x] Keyboard pagination: `ArrowLeft` / `ArrowRight`
- [ ] **Missing:** Inline skeleton rows during re-fetch (uses overlay instead)

### Dialogs & Sheets — 10/10 ✅
- [x] `InventoryItemDetailsDialog`: `p-0 overflow-hidden`, gradient badge, `Separator`, uppercase section labels, `bg-muted/30` data cards
- [x] `CategoryBreakdownSheet`: `w-[calc(100%-2.5rem)]` mobile gap, `rounded-l-xl`, flex-col zones with manual padding
- [x] `ConfirmDialog` for delete

### Mobile Responsiveness — 9/10 ⚠️
- [x] Page wrapper: `space-y-4 md:space-y-6`
- [x] Stats: `grid-cols-2 lg:grid-cols-4`
- [x] Sheet leaves 40px left margin
- [x] Dialog: `max-w-[calc(100%-2rem)]`
- [ ] **Missing:** Table empty state icon uses `h-12 w-12 md:h-16 md:w-16` but no shared `EmptyState` component

### Interactions — 9/10 ⚠️
- [x] CTA buttons have `s.btnAnimation`
- [x] Action buttons always visible (no hover-only)
- [x] `ConfirmDialog` for destructive actions
- [x] Toast via sonner for all feedback
- [ ] **Missing:** Delete is not optimistic — waits for DB round-trip before refreshing

### **Overall Score: 36/40** — Ship-ready

---

## 4. Risks

| Risk | Severity | Description |
|------|----------|-------------|
| Non-atomic delete | **Medium** | QR and item deleted separately — partial failure orphans QR |
| Stats on every change | **Low** | 4 count queries re-run whenever `inventory` state changes |
| Export query mismatch | **Low** | `exportInventory()` uses different select/join shape than `fetchInventory()` |
| Category filter on nested field | **Low** | `.eq('lots.categories.id', id)` may silently fail on some Supabase versions |

---

## 5. TODOs — UI/UX

| # | Task | Priority | Effort |
|---|------|----------|--------|
| 1 | Extract `FilterChips` shared component (duplicated in inventory + QR codes) | Medium | 1 hr |
| 2 | Replace table loading overlay with inline skeleton rows | Medium | 30 min |
| 3 | Replace hand-rolled empty state with shared `EmptyState` component | Low | 15 min |
| 4 | Add staggered fade-in animation on table rows | Low | 30 min |
| 5 | Add count-up animation to stats card numbers | Low | 45 min |
| 6 | Add backdrop blur to `ConfirmDialog` overlay | Low | 15 min |
| 7 | Add skeleton-to-content crossfade (`animate-in fade-in duration-300`) | Low | 15 min |

## 6. TODOs — Functionality

| # | Task | Priority | Effort |
|---|------|----------|--------|
| 1 | Wrap QR + item delete in a Supabase RPC/Edge Function for atomic transaction | **High** | 1 hr |
| 2 | Cache stats with `useMemo` or separate effect — avoid 4 queries on every inventory change | Medium | 30 min |
| 3 | Sync export query shape with main `fetchInventory()` select/joins | Medium | 30 min |
| 4 | Implement optimistic delete — remove row from UI immediately, revert on failure | Medium | 45 min |
| 5 | Add `toast.success('Deleted', { action: { label: 'Undo', onClick } })` soft-delete pattern | Medium | 1 hr |
| 6 | Consolidate getStats into `fetchInventory` response (return counts alongside data) | Low | 1 hr |
| 7 | Add URL-synced filters via `useSearchParams` (preserve state on back navigation) | Low | 1.5 hr |

---

> **Version:** 2.0
> **Reviewed against:** PAGE_ANALYSIS_CHECKLIST v2.0
