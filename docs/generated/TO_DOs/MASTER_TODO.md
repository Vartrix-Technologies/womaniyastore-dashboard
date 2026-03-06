# Master TODO — Horizontal Sweep Plan

> Consolidated from 12 page reviews. Organized by **change type** (horizontal),
> not by page (vertical). Each sweep touches one pattern across all affected pages —
> open a file once, apply the pattern, never revisit for the same pattern.
>
> **Last Updated:** February 9, 2026
> **Source:** 12 v2.0 page reviews + DESIGN_SYSTEM_BIBLE v2.0

---

## Score Summary

| Page | Score | Status | Primary Gap |
|------|-------|--------|-------------|
| Inventory | 36/40 | Ship-ready | Minor cleanup only |
| QR Codes | 25/40 | Needs polish | Token adoption, row tinting |
| POS | 25/40 | Needs polish | Token adoption, empty states |
| Settings | 25/40 | Needs polish | Token adoption (main + 5 tabs) |
| Checklists | 24/40 | Needs polish | Token adoption, stats cards, skeleton |
| Me Page | 21/40 | Needs rework | Skeleton loading, dead code, tokens |
| Attendance | 21/40 | Needs rework | DateRangeFilter migration, tokens |
| Superadmin | 20/40 | Needs rework | Brand violation, 25+ hardcoded, ConfirmDialog |
| Finances | 19/40 | Needs rework | Category breakdown bug, tokens, crud |
| Staff | 18/40 | Needs rework | Zero tokens, console.log leak, ConfirmDialog |
| Sales | 18/40 | Needs rework | Zero tokens, non-interactive stats |
| Add Lot | 15/40 | Needs rework | Zero tokens, division-by-zero bug |

---

## Execution Order

Work sweeps top-to-bottom. Each sweep is independent — complete one fully before starting the next. Within a sweep, process files in any order.

---

## Sweep 0: Dead Code & Instant Fixes (30 min)

> Zero-risk deletions and one-line fixes. Do this first to reduce noise for later sweeps.

| # | Item | Files | Bible Ref | Notes |
|---|------|-------|-----------|-------|
~~| 0.1 | Delete `checklists/page-old.tsx` | 1 file | §12 | Confirm no imports first: `c` |~~
~~| 0.2 | Delete `TaskChecklistCard-old.tsx` | `src/components/staff/` | §12 | 367 unused lines |~~
~~| 0.3 | Delete `DateFilterTabs.tsx` | `src/components/shared/` | §12 | Superseded by `DateRangeFilter`. Verify: `grep -r "DateFilterTabs" src/` |~~
~~| 0.4 | Remove debug `console.log` from staff page (L115, L132) | `admin/staff/page.tsx` | §12 | **Production data leak** — logs full staff records |~~
~~| 0.5 | Remove `console.log` from add-lot page (L160-161) | `admin/inventory/add-lot/page.tsx` | §12 | Debug remnant |~~
~~| 0.6 | Remove unused Accordion import from me-page | `me/page.tsx` | §12 | 4 components imported, 0 used — bundle bloat |~~
| 0.7 | ~~Fix dead code in `TaskChecklistCard` — unreachable block at L147~~ | `src/components/staff/TaskChecklistCard.tsx` | §12 | ~~3 empty checks, one unreachable~~ Deleted in Sweep 3 |
~~| 0.8 | Fix typo "Calender" → "Calendar" in `AttendanceCalendar.tsx` L224 | `src/components/staff/AttendanceCalendar.tsx` | — | Visible to users |~~
~~| 0.9 | Replace `window.history.back()` → `router.back()` on checklists page | `admin/checklists/page.tsx` | §12 | Next.js standard |
| 0.10 | Replace `window.location.reload()` → `refreshProfile()` on staff page | `admin/staff/page.tsx` L140 | §12 | Import `refreshProfile` from AuthContext |

**Verification:** `grep -rn "console\.log\|window\.location\.reload\|window\.history\.back\|DateFilterTabs\|page-old\|TaskChecklistCard-old" src/` should return 0 matches after this sweep.

---

## ~~Sweep 1: `appConfig.styles` Token Adoption (2-3 hours)~~ ✅ COMPLETE

> ✅ **Completed Feb 9, 2026** — All primary + secondary teal tokens adopted. Added `accent` block (30+ tokens) and `brandHex` block to `app.config.ts`. Zero hardcoded teal classes remain outside config.
>
> ~~The single highest-impact sweep. Touches 11 pages. Every page except inventory needs this.~~
>
> **Bible ref:** §1 (Philosophy), §2.1 (Color System — token table), §12 (Anti-patterns — "Hardcoded" rows)
>
> **Pattern:** Add `import { appConfig } from '@/lib/config'; const s = appConfig.styles;` at top,
> then find-replace hardcoded classes with token references.

### Token Replacement Cheat Sheet

| Hardcoded | Token | Used for |
|-----------|-------|----------|
| `from-teal-500 to-cyan-600` | `s.primaryGradient` | CTA buttons, headers |
| `hover:from-teal-600 hover:to-cyan-700` | `s.primaryGradientHover` | Button hover |
| `bg-gradient-to-br from-teal-500 to-cyan-600` | `s.headerIconGradient` | Page header icon badge |
| `text-teal-600` | `s.linkColor` | Back buttons, links |
| `hover:text-teal-700 hover:bg-teal-50` | `s.linkHover` | Link hover states |
| `hover:scale-105 active:scale-95 transition-all` | `s.btnAnimation` | CTA buttons |
| `hover:scale-[1.02] active:scale-[0.98] transition-all` | `s.btnAnimationSubtle` | Stats cards, subtle interactions |
| `border-l-green-500 bg-green-50` (active state) | `s.statsActive.available.border` + `.bg` | Stats card active |
| `border-l-blue-500 bg-blue-50` (active state) | `s.statsActive.sold.border` + `.bg` | Stats card active |
| `border-l-red-500 bg-red-50` (active state) | `s.statsActive.damaged.border` + `.bg` | Stats card active |
| Row gradient classes | `s.rowTint.*` | Table row tinting |

### Files to Process (ordered by instance count, most → least)

| # | Page/Component | File(s) | ~Instances | Notes |
|---|----------------|---------|------------|-------|
| 1.1 | Settings tabs (5 components) | `ShopTabs.tsx`, `CategoriesTab.tsx`, `SizesTab.tsx`, `ExpenseCategoriesTab.tsx`, `QrPrefixesTab.tsx` | ~34 | Largest batch — do all 5 in one session |
| 1.2 | Checklists | `admin/checklists/page.tsx` | ~20 | Includes gradient, animation, link colors |
| 1.3 | QR Codes | `admin/qr-codes/page.tsx` | ~16 | Includes stats `activeClass` strings |
| 1.4 | Staff | `admin/staff/page.tsx` | ~14 | `appConfig` not even imported yet |
| 1.5 | Superadmin + children | `superadmin/page.tsx` + `sync-issues/page.tsx` + `UserManagement.tsx` | ~20 total | **Also fix brand violation:** replace `from-purple-500 to-pink-500` header with `s.headerIconGradient` |
| 1.6 | Finances | `admin/finances/page.tsx` | ~8 | |
| 1.7 | Sales | `admin/sales/page.tsx` | ~5 | Includes `text-teal-600` links |
| 1.8 | Attendance | `admin/attendance/page.tsx` | ~6 | |
| 1.9 | POS | `(protected)/pos/page.tsx` | ~6 | |
| 1.10 | Settings main | `admin/settings/page.tsx` | ~6 | |
| 1.11 | Add Lot | `admin/inventory/add-lot/page.tsx` | ~5 | |
| 1.12 | Me Page | `me/page.tsx` | ~4 | Fewest, quick win |

**Verification after sweep:** `grep -rn "from-teal-500\|to-cyan-600\|text-teal-600\|hover:text-teal-700\|hover:scale-105 active:scale-95" src/app/ src/components/admin/ src/components/staff/` should return 0 matches (only `app.config.ts` should have raw teal classes).

---

## ~~Sweep 2: Page Header Standardization (1 hour)~~ ✅ COMPLETE

> ✅ **Completed Feb 9, 2026** — All 11 pages now use standardized `p-2.5 rounded-lg ${s.headerIconGradient} text-white shadow-md` icon badge pattern. Also normalized Settings, Checklists, Superadmin, and QR Codes to match gold standard.
>
> ~~Add gradient icon badge + standardized title layout to every page missing it.~~
>
> **Bible ref:** §2 (Page Header), §7.3 (Page Header Pattern)
>
> **Pattern:**
> ```tsx
> <div className="flex items-center gap-3">
>   <div className={`p-2.5 rounded-lg ${s.headerIconGradient} text-white shadow-md`}>
>     <PageIcon className="h-6 w-6" />
>   </div>
>   <div>
>     <h1 className="text-2xl font-bold tracking-tight">Page Title</h1>
>     <p className="text-sm text-muted-foreground mt-0.5">Subtitle</p>
>   </div>
> </div>
> ```

| # | Page | Icon | Current State |
|---|------|------|---------------|
| 2.1 | Finances | `DollarSign` | No badge, bare heading |
| 2.2 | Add Lot | `PackagePlus` | No badge |
| 2.3 | Sales | `Receipt` | No badge |
| 2.4 | Attendance | `Clock` | No badge |
| 2.5 | POS | `ShoppingBag` | No badge |
| 2.6 | Me Page | `User` | No badge |
| 2.7 | Staff | `Users` | No badge |
| 2.8 | Superadmin | `Shield` | **Has badge but wrong color** — purple-pink → teal-cyan |

**Not needed:** Inventory (already done), QR Codes (has badge, minor fix: add `shadow-md`), Settings (has badge), Checklists (has badge).

---

## ~~Sweep 3: Shared `EmptyState` Component Adoption (1 hour)~~ ✅ COMPLETE

> ✅ **Completed Feb 9, 2026** — Replaced 14 inline empty-state blocks with `<EmptyState>` across 11 files: checklists (2), CategoriesTab, SizesTab, ExpenseCategoriesTab, QrPrefixesTab, UserManagement, staff, finances, sales, qr-codes (2), POS, TaskChecklistCard. Skipped: checklists italic hint (too minimal), sync-issues success state (green icon, not an empty state). Also deleted dead code block in TaskChecklistCard (0.7).
>
> ~~Replace inline empty `<div>` blocks with the shared component.~~
>
> **Bible ref:** §9.3 (Empty State Component), §11 (Shared Components Reference)
>
> **Component:** `import { EmptyState } from '@/components/shared/EmptyState';`
>
> **Pattern:**
> ```tsx
> <EmptyState
>   icon={Package}
>   title="No items found"
>   description="Try adjusting your filters or add new items"
>   action={{ label: "Add Item", onClick: handleAdd }}
> />
> ```

| # | Page | ~Inline Empty States | Notes |
|---|------|---------------------|-------|
| 3.1 | Checklists | 3 | Main list, history dialog, items list |
| 3.2 | Settings tabs | 4+ | CategoriesTab, SizesTab, ExpenseCategoriesTab, QrPrefixesTab |
| 3.3 | Superadmin | 2 | sync-issues list, UserManagement list |
| 3.4 | Staff | 1 | Table empty row |
| 3.5 | Finances | 1 | Table empty state |
| 3.6 | Sales | 1 | Plus add error state card |
| 3.7 | QR Codes | 1 | Table empty state |
| 3.8 | POS | 1 | Empty cart |
| 3.9 | Me Page | 1+ | TaskChecklistCard empty |

**Verification:** `grep -rn "text-center py-12\|text-center py-8\|No .* found" src/app/ src/components/` — each match should now use `EmptyState`.

---

## ~~Sweep 4: `ConfirmDialog` Adoption (30 min)~~ ✅ COMPLETE

> ✅ **Completed Feb 9, 2026** — Added ConfirmDialog to 6 destructive actions across 5 files: Staff toggle active Switch (4.1), Superadmin Force Sync (4.2), UserManagement toggle active (4.3), sync-issues Sync Now + Retry Failed (4.4), AttendanceCard Clock-out (4.5). Also added self-deactivation guard on Staff page — Switch is disabled when `member.id === profile?.id` (4.6).
>
> ~~Add confirmation dialogs to destructive one-click actions.~~
>
> **Bible ref:** §1 (Core Rules — "No native browser dialogs"), §8.2 (Confirm Dialog Pattern)
>
> **Component:** `import { ConfirmDialog } from '@/components/shared/ConfirmDialog';`

| # | Page | Action | Why |
|---|------|--------|-----|
| 4.1 | Staff | Toggle active Switch | One-click deactivation locks user out |
| 4.2 | Superadmin | Force Sync button | Triggers mass data sync |
| 4.3 | Superadmin | UserManagement toggle active | Same as staff — deactivation is destructive |
| 4.4 | Superadmin sync-issues | "Sync Now" bulk retry | Mass retry should be confirmed |
| 4.5 | Me Page | Clock-out button | Prevents accidental clock-out |
| 4.6 | Staff | Self-deactivation guard | **Prevent** admin from toggling their own active off (disable Switch, not just confirm) |

---

## ~~Sweep 5: `useFormErrors` + `FieldError` Adoption~~ ✅ COMPLETE

> Replace toast-only validation with inline field errors.
>
> **Bible ref:** §6.6 (Field Validation — `useFormErrors` + `FieldError`)
>
> **Pattern:**
> ```tsx
> import { FieldError, fieldErrorClass, useFormErrors } from '@/components/shared/FieldError';
> const { errors, validateFields, clearFieldError } = useFormErrors<'name' | 'phone'>();
> ```

| # | Page/Component | Current Validation | Fields | Status |
|---|----------------|-------------------|--------|--------|
| 5.1 | Settings — ShopDetailsTab | ~~Dirty tracking only, no field errors~~ | shop_name | ✅ |
| 5.2 | Settings — CategoriesTab | ~~Toast-only~~ | category name (quick-add + edit) | ✅ |
| 5.3 | Settings — QrPrefixesTab | ~~regex + toast~~ | prefix text | ✅ |
| 5.4 | Superadmin — UserManagement | ~~Toast-only~~ | email, password, full_name, shop_id | ✅ |
| 5.5 | Staff — edit dialog | ~~Toast-only~~ | full_name | ✅ |
| 5.6 | Settings — tax rate | ~~No validation~~ | tax_rate (0-100 range) | ✅ |

---

## ~~Sweep 6: Skeleton & Loading State Upgrades~~ ✅ COMPLETE

> ✅ **Completed Feb 9, 2026** — Replaced animate-spin spinners and text-only loading with layout-matching skeletons across 6 files. Superadmin health (6.5) renders instantly with static data — no skeleton needed. UserManagement (6.6) already had proper skeleton cards.
>
> ~~Replace `animate-spin` spinners and text-only loading with layout-matching skeletons.~~
>
> **Bible ref:** §9.1 (Loading Skeletons), §9.2 (Table Re-fetch Loading), §12 (Anti-patterns — "animate-spin")
>
> **Pattern:** Match the shape of the final layout. Stats cards → skeleton cards. Table → skeleton rows.
> Use `LoadingTable` component or inline `Skeleton` from shadcn.

| # | Page/Component | Current Loading | Replace With | Status |
|---|----------------|----------------|--------------|--------|
| 6.1 | Staff page | ~~`animate-spin` border spinner~~ | 5 skeleton rows × 6 columns in table | ✅ |
| 6.2 | Checklists page | ~~`"Loading checklists..."` text~~ | Full skeleton: header + 4 stat cards + filter card + 3 checklist card skeletons | ✅ |
| 6.3 | Me — TaskChecklistCard | ~~Text-only loading~~ | Skeleton badge (compact) + skeleton card with 3 checklist groups × 2 item rows (card mode) | ✅ |
| 6.4 | Me — AttendanceCalendar | ~~Text-only loading~~ | Skeleton 7×5 calendar grid + skeleton stat rows | ✅ |
| 6.5 | Superadmin — health check | No loading state needed | N/A — renders instantly with static "Unknown" badges | ✅ |
| 6.6 | Superadmin — UserManagement | Already has skeleton | Pre-existing 3 skeleton cards with avatar + text lines | ✅ |
| 6.7 | POS — cart restore | ~~No loading indicator~~ | Skeleton cart items while localStorage hasn't loaded | ✅ |
| 6.8 | Me — AttendanceCard | ~~No skeleton~~ | initialLoading state + skeleton timer card (status row + time rows + action button) | ✅ |

---

## Sweep 7: Active Filter Chips (1 hour)

> Add dismissible `Badge` chips showing active filters.
>
> **Bible ref:** §5.7 (Active Filter Chips — Dismissible)
>
> **Pattern:**
> ```tsx
> {filterActive && (
>   <div className="flex items-center gap-2 flex-wrap">
>     <span className="text-xs text-muted-foreground">Filtered by:</span>
>     <Badge variant="secondary" className="gap-1 pl-2 pr-1 capitalize">
>       Status: {filter}
>       <button onClick={clearFilter} className="ml-1 rounded-full hover:bg-muted-foreground/20 p-0.5">
>         <X className="h-3 w-3" />
>       </button>
>     </Badge>
>     <button onClick={clearAll} className="text-xs text-muted-foreground hover:text-foreground underline">
>       Clear all
>     </button>
>   </div>
> )}
> ```
>
> **Consider:** Extract a shared `FilterChips` component since this pattern now appears in 5+ pages.

| # | Page | Filters to Chip | Status |
|---|------|----------------|--------|
| 7.1 | Finances | category, date, search | ✅ Done |
| 7.2 | Sales | sale_type, date, search | ✅ Done |
| 7.3 | Attendance | staff, status, search | ✅ Done |
| 7.4 | Checklists | status, search | ✅ Done |
| 7.5 | Inventory | status, category, date | **Already implemented** — reference pattern |
| 7.6 | QR Codes | status, prefix, date | **Already implemented** |

---

## Sweep 8: Row Tinting with `s.rowTint.*` Tokens (30 min)

> ✅ **Completed Feb 9, 2026** — Added 6 new rowTint tokens (unused, assigned, lost, inProgress, completed, manual) to `app.config.ts`. Applied status-based row tinting to Sales (festival/clearance/promotion priority), QR Codes (status lookup), and Attendance (in-progress/manual detection).
>
> ~~Add status-based row background gradients using config tokens.~~
>
> **Bible ref:** §5.6 (Table Row Status Indicators)

| # | Page | Tint By | Token(s) | Status |
|---|------|---------|----------|--------|
| 8.1 | Sales | sale_type (festival/clearance/promotion) | `s.rowTint.festival`, `.clearance`, `.promotion` | ✅ Done |
| 8.2 | QR Codes | status (unused/assigned/used/lost) | `s.rowTint.unused`, `.assigned`, `.sold`, `.lost` | ✅ Done |
| 8.3 | Attendance | status (in-progress/completed/manual) | `s.rowTint.inProgress`, `.manual` | ✅ Done |

---

## Sweep 9: Stats Cards Interactivity (1 hour)

> Make stats cards clickable filter toggles where they aren't already.
>
> **Bible ref:** §3.1 (Stats Cards — Interactive Toggle Filtering)

| # | Page | Current Cards | Action Needed | Status |
|---|------|--------------|---------------|--------|
| 9.1 | Sales | 4 aggregate metric cards | Skipped — aggregates (Total/Revenue/Discount/Avg) not suited for filter toggles | ⏭️ Skipped |
| 9.2 | Attendance | 4 cards, 2 with onClick | Migrated hardcoded `activeClassName` → `s.statsActive.yellow/orange` tokens + `filterHint` + `setCurrentPage(1)` | ✅ Done |
| 9.3 | Checklists | Manual stat divs | Replaced with `StatsCardGrid` + `isActive`/`activeClassName`/`onClick` + `filterHint` | ✅ Done |
| 9.4 | Staff | 4 clickable manual Card divs | Replaced with `StatsCardGrid` + `isActive` (dual-filter) + `activeClassName` tokens + `filterHint` | ✅ Done |
| 9.5 | QR Codes | Clickable with hardcoded active | Migrated 5 `activeClass` strings + `textColor` to `s.statsActive.*` tokens | ✅ Done |

---

## Sweep 10: `DateRangeFilter` Migration (30 min)

> ✅ **Completed Feb 9, 2026** — Migrated attendance page from legacy `DateRangePicker` to `DateRangeFilter` + `useDateFilter` hook. Removed manual date state, added date chip to filter chips, added date reset to "Clear Filters" and "Clear all". Deleted `DateRangePicker.tsx` (sole consumer).
>
> **Bible ref:** §5.5 (Date Range Filtering), §12 (Anti-patterns — "DateRangePicker")

| # | Page | Current Component | Effort | Status |
|---|------|------------------|--------|--------|
| 10.1 | Attendance | ~~`DateRangePicker` (raw calendar)~~ | Replaced with `DateRangeFilter` + `useDateFilter`. Deleted `DateRangePicker.tsx`. | ✅ Done |

**Only 1 page** — attendance is the last holdout. All others already use `DateRangeFilter` or `useDateFilter`.

---

## Sweep 11: Extract Shared Components (1.5 hours)

> ✅ **11.1 & 11.2 Completed Feb 9, 2026** — Extracted `PaginationControls` and `FilterChips` shared components and adopted across all pages.
>
> - `PaginationControls` (123 lines): Adopted in inventory, sales, qr-codes, attendance, finances, returns (6 pages). Eliminated ~450 lines of duplicated pagination JSX. Standardized page sizes to [10,25,50,100,200,500]. Returns page gained per-page selector. QR codes removed manual `startItem`/`endItem` calc.
> - `FilterChips` (72 lines): Adopted in inventory, sales, qr-codes, attendance, finances, checklists (6 pages). Eliminated ~280 lines of duplicated filter chip Badge blocks. Cleaned up unused `X` imports from 4 pages, `Label` imports from 2 pages, and Chevron icons from all 6 pages.
> - 11.3-11.6 deferred per plan — page-specific refactors to do when touching those pages.
>
> **Bible ref:** §11 (Shared Components Reference)

| # | Component | Extract From | Used In | Lines Saved | Status |
|---|-----------|-------------|---------|-------------|--------|
| 11.1 | `PaginationControls` | inventory/page.tsx | sales, qr-codes, attendance, finances, returns (~70-80 lines each) | ~450 lines | ✅ Done |
| 11.2 | `FilterChips` | inventory/page.tsx | sales, finances, attendance, checklists, qr-codes | ~280 lines | ✅ Done |
| 11.3 | `useQrCodesData` hook | qr-codes/page.tsx | Single page, but 1118 lines → ~800 | 300 lines | ⏳ Deferred |
| 11.4 | `useSalesData` hook | sales/page.tsx | Single page | ~200 lines | ⏳ Deferred |
| 11.5 | `useAttendanceData` hook | attendance/page.tsx | Single page, 776 lines → ~500 | ~270 lines | ⏳ Deferred |
| 11.6 | `ChecklistFormDialog` | checklists/page.tsx | Single page, 939 lines → ~700 | ~200 lines | ⏳ Deferred |

**Priority:** 11.1 and 11.2 are global extractions (immediate ROI). 11.3-11.6 are page-specific refactors (do when touching that page).

---

## Sweep 12: Data Integrity & Fix Bugs (1 hour) ✅

> ✅ **Completed** — Fixed 8 data integrity/UX safety bugs across 8 files. 3 items (12.5, 12.6, 12.11) were already fixed in earlier sweeps.
>
> **Changes:**
> - **12.1** `finances/page.tsx` — Category breakdown now uses full `statsTransData` (with expense_category join) instead of paginated `transactionsData`
> - **12.2** `add-lot/page.tsx` — Profit margin guards against `costNum === 0` (was div-by-zero when cost price was "0")
> - **12.3** `CategoriesTab.tsx` — `handleDelete` queries `lots` count before confirmation; warns if category is in use
> - **12.4** `SizesTab.tsx` — Same orphan check pattern for sizes via `lots.size_id`
> - **12.5** Already fixed in Sweep 5 (tax rate 0-100 validation in ShopTabs)
> - **12.6** Already fixed in Sweep 4 (self-deactivation guard on Staff page)
> - **12.7** `superadmin/page.tsx` — Export uses `Promise.all()` for 4 parallel queries after shop query
> - **12.8** `superadmin/page.tsx` — Filename sanitized via `replace(/[^a-zA-Z0-9]/g, '-')`
> - **12.9** `TaskChecklistCard.tsx` + `me/page.tsx` — Extracted `useTaskChecklists` hook; Me page calls it once, passes `hookData` to both CardHeader summary and CardContent compact renders (eliminated duplicate fetch + 30s interval)
> - **12.10** `sales/page.tsx` — When sale-type filter is active, fetches full dataset and paginates client-side (correct totalCount); server pagination used when no filter
> - **12.11** Already fixed in Sweep 10 (Clear Filters resets dateFilter)

| # | Page | Bug | Fix |
|---|------|-----|-----|
| ~~12.1~~ | ~~Finances~~ | ~~Category breakdown uses paginated data, not full dataset~~ | ~~Run separate aggregation query on full dataset~~ |
| ~~12.2~~ | ~~Add Lot~~ | ~~Profit margin division by zero when cost = 0~~ | ~~Show "N/A" or "∞" when `cost_price_per_unit === 0`~~ |
| ~~12.3~~ | ~~Settings~~ | ~~No orphan check before deleting product category~~ | ~~Query `lots` count → if >0, show warning in ConfirmDialog~~ |
| ~~12.4~~ | ~~Settings~~ | ~~No orphan check before deleting size~~ | ~~Query `inventory_items` count → if >0, show warning~~ |
| ~~12.5~~ | ~~Settings~~ | ~~No tax rate validation (0-100 range)~~ | ~~Already fixed in Sweep 5~~ |
| ~~12.6~~ | ~~Staff~~ | ~~No self-deactivation prevention~~ | ~~Already fixed in Sweep 4~~ |
| ~~12.7~~ | ~~Superadmin~~ | ~~Sequential export (5 await chains)~~ | ~~`Promise.all([query1, query2, ..., query5])`~~ |
| ~~12.8~~ | ~~Superadmin~~ | ~~Export filename not sanitized~~ | ~~`shopName.replace(/[^a-zA-Z0-9]/g, '-')`~~ |
| ~~12.9~~ | ~~Me Page~~ | ~~Dual TaskChecklistCard = duplicate API calls + intervals~~ | ~~Extracted `useTaskChecklists` hook, shared via `hookData` prop~~ |
| ~~12.10~~ | ~~Sales~~ | ~~Sale-type filter runs client-side → count mismatch with server pagination~~ | ~~Full-fetch + client pagination when filter active~~ |
| ~~12.11~~ | ~~Attendance~~ | ~~"Clear Filters" doesn't reset date range~~ | ~~Already fixed in Sweep 10~~ |

---

## Sweep 13: Page-Specific Enhancements (P2/P3 — do later)

> Lower-priority items that are page-specific. Pick up opportunistically.

### Finances ✅
- [x] Add expense edit + delete with ConfirmDialog + toast undo
- [x] Add expense detail view (premium p-0 dialog)
- [x] Fix inventory value — use `cost_price_per_unit` for true asset valuation
- [x] URL-synced filters via `useSearchParams`

> **Completed Feb 10, 2026** — Full CRUD for expenses: edit dialog with inline validation, delete with ConfirmDialog + 6s undo toast that re-inserts the row. Premium p-0 expense detail dialog with gradient header, category badge, description, and edit/delete actions. Inventory value now queries `cost_price_per_unit` instead of `selling_price_default`. URL syncs `date` and `category` params via `useSearchParams` + Suspense wrapper.

### Sales
- [x] Extract `PaginationControls` component
- [x] Hoist `DateRangeFilter` above tabs — single instance shared by all 3
- [x] Add customer history link
- [x] Export size warning if >10k records

> **Completed Feb 10, 2026** — PaginationControls already adopted in Sweep 11. Hoisted DateRangeFilter above `<Tabs>` so all 3 tabs (Transactions, Analytics, Vendors) share a single instance; removed 3 duplicate DateRangeFilter placements and the redundant top export button. Added History icon button next to customer names that filters the transaction list to that customer's purchases. Export now checks `totalCount > 10000` and shows a ConfirmDialog warning before proceeding with large exports.

### QR Codes
- [x] Optimize stats with GROUP BY aggregation via RPC
- [x] Add "Mark as Lost" action — no UI for unused→lost transition
- [x] Batch insert chunking for >500 codes + progress
- [x] Remove `manualRefresh()` — duplicates `loadQrCodes()`

> **Completed Feb 10, 2026** — Stats now use 5 parallel `count`-only queries (`head: true`) via `Promise.all` instead of fetching all rows and counting in JS — zero rows transferred. Added "Mark as Lost" button (`CircleOff` icon) for unused/assigned codes with ConfirmDialog confirmation; uses optimistic local update. Generation >500 codes now chunks into sequential 500-code batches with progress toast (`Generating batch 2/4...`). Deleted `manualRefresh()` (50 lines of dead code, never called in JSX) and removed all 20 debug `console.log` statements.

### Attendance
- [ ] Server-side sort for hours — create DB view with computed hours column
- [ ] Max date range limit (90 days) for performance
- [ ] Attendance analytics — trend charts, staff comparisons

### Checklists
- [ ] Batch item update API — replace delete-all-then-recreate with upsert
- [ ] Extract `ChecklistFormDialog` (~200 lines)
- [ ] Persist drag reorder to DB without dialog save
- [ ] Move orphan cleanup to API layer

### POS
- [x] Price change validation — warn if <50% of original
- [x] Memoize `existingQrCodes` with useMemo
- ~~[x] Multi-cart / hold order support~~ **REVERTED** — enables duplicate sales risk
- [x] **CRITICAL FIX**: Harden offline-save logic — server errors must NEVER trigger offline save
- [x] Remove coupon UI *(no `coupons` DB table; UI removed to avoid confusion)*

> **Completed Feb 10, 2026** — Price validation: ConfirmDialog warns when new price is <50% of original, user can confirm or cancel; max-discount-% enforcement retained. `existingQrCodes` memoized with `useMemo` to prevent unnecessary `ProductSearchDialog` re-renders. Removed 7 debug `console.log` statements from CheckoutDialog and ProductSearchDialog.
>
> **Updated Feb 10, 2026** — **CRITICAL FIX**: `completeSale()` now checks `error.name === 'FunctionsFetchError'` + `navigator.onLine` before allowing offline save; all other errors throw `SaleApiError`. CheckoutDialog adds belt-and-suspenders `navigator.onLine` guard — if online but non-`SaleApiError`, shows generic error instead of saving offline. Multi-cart / hold order feature **reverted** (held carts could contain already-sold items, enabling duplicate sale attempts). Coupon input section removed (no backend table exists).

### Settings
- [x] Unique name validation for categories/sizes
- [x] Tax rate change warning — "only affects future sales"
- [x] Persist active tab in URL search params
- [x] Extend optimistic reorder + framer-motion drag to categories

> **Completed Feb 10, 2026** — Unique name validation: case-insensitive duplicate check on quick-add and edit for both CategoriesTab (via `useFormErrors` inline error) and SizesTab (via toast). Tax rate: inline amber warning banner when rate is dirty stating "only affects future sales", plus ConfirmDialog on save showing old→new rate. Active tab persisted via `useSearchParams` (`?tab=categories`); default `shop` tab has no param; wrapped in `Suspense`. Categories now have `sort_order` column (migration `20260210_categories_sort_order.sql`) and full drag-and-drop via `framer-motion Reorder` + arrow buttons + optimistic local state, matching the SizesTab pattern. SizesTab also upgraded with `framer-motion Reorder` drag handles (was arrow-only). Both tabs show `GripVertical` drag handle + `ChevronUp`/`ChevronDown` arrows + order number.

### Me Page
- [ ] Weekly hours summary stat in header
- [ ] Mini 7-day attendance preview (green/red/gray dots)
- [ ] Completion streaks gamification

~~### Superadmin~~
- [ ] Auto-refresh health status (30s interval toggle)
- [ ] Database import with conflict resolution
- [ ] Progress indicator for export (1/5, 2/5...)

~~### Staff~~
- [ ] Server-side search/pagination for shops with many staff
- [ ] SortableHeader on table columns
- [ ] Validate phone format + discount range (0-100) with FieldError

~~### Add Lot~~
- [ ] Vendor autocomplete — query existing vendor names
- [ ] Draft auto-save to localStorage every 30s
- [ ] Max quantity limit
- [ ] Lot preview step before final submit

~~### Inventory~~
- [ ] Atomic QR + item delete via Supabase RPC/Edge Function
- [ ] Cache stats with `useMemo` or separate effect
- [ ] Optimistic delete with toast undo
- [ ] URL-synced filters via `useSearchParams`

---

## Sweep 14: Premium Polish (Phase 2 — aspirational)

> Enterprise-level touches. Do after all P0/P1 sweeps are complete.
>
> **Bible ref:** §10 (Premium Polish), Checklist "Premium Patterns" section

| # | Item | Scope | Bible Ref |
|---|------|-------|-----------|
~~| 14.1 | Backdrop blur on all Dialog/AlertDialog overlays | Global CSS override | §8.5 |~~
~~| 14.2 | Staggered fade-in on table rows + list items | All table pages | Premium §High |~~
~~| 14.3 | Count-up animation on stat card numbers | All pages with stats | Premium §High |~~
~~| 14.4 | Skeleton-to-content crossfade (`animate-in fade-in`) | Every page with skeletons | Premium §High |~~
~~| 14.5 | Toast with Undo for destructive actions | Delete flows across all pages | Premium §Medium |~~
~~| 14.6 | Premium `p-0` dialog upgrade for `QrCodeDetailsDialog` | QR codes page | §8.3 |~~
~~| 14.7 | Premium `p-0` dialog upgrade for `BillPreviewDialog` | Sales page | §8.3 |~~
| 14.8 | ~~Extend `framer-motion Reorder` to sizes and categories~~ | ~~Settings tabs~~ | ~~§4.3.1~~ | ✅ Done in Sweep 13 Settings |

---

## Time Estimates (Sweeps 0–12)

| Sweep | Est. Time | Impact |
|-------|-----------|--------|
| 0. Dead Code & Instant Fixes | 30 min | Removes noise + production bugs |
| ~~1. Token Adoption~~ | ~~2–3 hours~~ | ✅ **COMPLETE** — brand consistency |
| ~~2. Page Headers~~ | ~~1 hour~~ | ✅ **COMPLETE** — visual polish |
| ~~3. EmptyState Adoption~~ | ~~1 hour~~ | ✅ **COMPLETE** — Consistent empty UX |
| ~~4. ConfirmDialog~~ | ~~30 min~~ | ✅ **COMPLETE** — Safety for destructive actions |
| 5. FieldError Adoption | 1 hour | Better form UX |
| 6. Skeleton Loading | 1.5 hours | Perceived performance |
| 7. Filter Chips | 1 hour | Filter discoverability |
| 8. Row Tinting | 30 min | Visual status clarity |
| 9. Stats Interactivity | 1 hour | Reduces clicks to filter |
| 10. DateRangeFilter Migration | 30 min | Consistency (1 page) |
| 11. Shared Component Extraction | 1.5 hours | Reduces ~800 lines of duplication |
| 12. Data Integrity Fixes | 1 hour | Correctness — bugs/safety |
| **Total** | **~12–13 hours** | |

---

## How to Use This Document

1. **Start a session** → Pick the next incomplete sweep
2. **Read the sweep's Bible references** for exact patterns/code
3. **Open each file in the sweep**, apply the pattern, move to next file
4. **Run the verification command** listed at the end of the sweep
5. **Mark the sweep complete** with a `[x]` checkbox
6. **Commit** with message: `refactor: sweep N — {sweep title}`

Each sweep is a standalone commit. If interrupted, you can resume any sweep safely.

---

> **Maintainer:** Development Team
> **Generated from:** 12 v2.0 page reviews + DESIGN_SYSTEM_BIBLE v2.0
