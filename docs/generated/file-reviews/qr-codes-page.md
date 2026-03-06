# File Review: src/app/(protected)/admin/qr-codes/page.tsx

**Last Updated**: February 8, 2026  
**Lines of Code**: 1118  
**Version**: 2.0 (Checklist-scored rewrite)  
**Checklist Score**: **25/40** — needs polish  
**Recent Changes**: QR prefix system, `QrCodeDownloadDialog`, `DateRangeFilter`, inline-button stats with toggle filtering, active filter chips, table loading overlay, prefix filter, bulk print

---

## 1. File Responsibility

**Primary Purpose**: Comprehensive QR code management hub — bulk generation via managed prefixes, server-side paginated table with status/prefix/date/search filtering, bulk selection + deletion, CSV export, QR image download/print, and detail viewing.

**Role in the System:**  
Central QR lifecycle management. Generates sequential codes under managed prefixes, tracks status transitions (unused → assigned → sold | lost), supports bulk operations and print layouts via `QrCodeDownloadDialog`.

**What This File Intentionally Does NOT Do:**
- Does NOT assign QR codes to inventory (handled by add-lot flow)
- Does NOT process sales (handled by POS)
- Does NOT manage QR prefixes (handled by Settings page)
- Does NOT edit individual QR code fields

**Key Dependencies:**
| Dependency | Purpose |
|-----------|---------|
| `@/lib/supabase` | Direct Supabase client for queries + RPC |
| `@/lib/api/qr-prefixes` — `fetchActiveQrPrefixes()` | Load active prefixes for generation form |
| `@/context/AuthContext` | `profile.shop_id` for multi-tenancy |
| `@/hooks` | `useServerPagination`, `useSortableTable`, `useDebouncedSearch`, `useDateFilter` |
| `@/components/shared/DateRangeFilter` | Date range with buffered Apply |
| `@/components/shared/SortableHeader` | Sortable column headers |
| `@/components/shared/QrCodeDetailsDialog` | Detail view for assigned/sold codes |
| `@/components/shared/QrCodeDownloadDialog` | Bulk QR print with layouts, paper sizes, PDF |
| `@/components/shared/QrCodeCard` — `downloadQrCode()` | Single QR code PNG download |
| `@/components/shared/ConfirmDialog` | Destructive action confirmations |

---

## 2. Execution Flow

### Initial Load Sequence
1. Component mounts → extract `profile.shop_id` from auth context
2. First run: fetch active QR prefixes via `fetchActiveQrPrefixes()`; auto-select first prefix
3. `loadQrCodes()` builds Supabase query with all filters (status, prefix, search, date, sort, pagination)
4. Separate `getStats()` — fetches all status values, counts client-side
5. Full-page skeleton during `initialLoading`; table loading overlay for subsequent fetches

### QR Code Generation (Lines 152–237)
**Via Supabase RPC:** `generate_qr_codes_with_prefix(p_shop_id, p_prefix_id, p_quantity)`
- Server-side sequential numbering (no client-side number tracking)
- Returns generated codes array → toast with range (first to last)
- Error: sequence limit exceeded → custom message with prefix name
- Resets to page 1 to show new codes

### Deletion Flows (Lines 244–340)
| Flow | Trigger | Guard |
|------|---------|-------|
| Single delete | Trash icon on unused row | `status === 'unused'` check |
| Bulk delete | "Delete (N)" button when selection active | Only unused codes selectable |
| Delete all unused | "Delete All Unused" button | Only visible when `filterStatus === 'unused'` |

All use `ConfirmDialog` — never `confirm()`.

### Stats Calculation (Lines 481–495)
Single query fetches all `status` values for the shop, then counts client-side in a loop. Reloads whenever `qrCodes` changes. **Not yet a GROUP BY aggregation** but better than the 5 separate queries from the old review.

### Filter Chip System (Lines 828–866)
Active filter chips with `Badge variant="secondary"` + `X` dismiss button for status, prefix, and date. "Clear all" link resets everything. This is the **reference implementation** of the filter chip pattern.

---

## 3. Business Rules & Assumptions

**Explicit Rules:**
- Only `unused` QR codes can be deleted (data integrity — assigned/sold codes link to inventory/sales)
- Sequence limit: max 9999 codes per prefix (enforced by RPC function)
- Prefix management is separate (Settings page) — this page only consumes them
- Default sort: `code` ascending
- Generation via server-side RPC — no client-side number tracking

**Implicit Assumptions:**
- `shop_id` isolation via RLS (not explicitly checked in every query)
- At least one active prefix required for generation — empty state shown otherwise
- Selection cleared on any filter/page change (intentional, prevents stale selections)
- `prefix_id` column on `qr_codes` table enables prefix filtering

**Status Lifecycle:**
```
unused → assigned (via add-lot) → sold (via POS)
  └────→ lost (via admin action, no UI for this yet)
```

---

## 4. PAGE_ANALYSIS_CHECKLIST — Detailed Scoring

### ✅ = Pass · ⚠️ = Partial · ❌ = Fail · N/A = Not Applicable

### §1 Config-Driven Theming — **2/10** ❌

| Check | Status | Detail |
|-------|--------|--------|
| Imports `appConfig`, aliases `const s = appConfig.styles` | ❌ | Not imported at all |
| Gradients use `s.primaryGradient` | ❌ | Hardcoded `bg-gradient-to-r from-teal-500 to-cyan-600` (L641) |
| Header icon badge uses `s.headerIconGradient` | ❌ | Hardcoded `bg-gradient-to-br from-teal-500 to-cyan-600` (L564) — correct visual, wrong source |
| Back button uses `s.linkColor` + `s.linkHover` | ❌ | Hardcoded `text-teal-600 hover:text-teal-700 hover:bg-teal-50` (L558) |
| Stats active states use `s.statsActive.*` | ❌ | Hardcoded per-status `activeClass` strings (L656–660) — correct pattern, wrong source |
| Row tinting uses `s.rowTint.*` | ❌ | No row tinting on table rows |
| Button animations use `s.btnAnimation` | ❌ | Hardcoded `hover:scale-105 active:scale-95 transition-all` (L641) |
| Zero hardcoded teal classes | ❌ | 16 occurrences across 6 locations |

**Note:** This page has all the *correct patterns* visually — it just hardcodes everything instead of referencing tokens. Tokenizing would be a mechanical find-and-replace.

### §2 Page Header — **8/10** ✅

| Check | Status | Detail |
|-------|--------|--------|
| Back button: `variant="ghost"` + tokens | ⚠️ | Correct structure, `variant="ghost"`, `-ml-2`, but hardcoded teal (L557–560) |
| Gradient icon badge (rounded-lg, shadow-md) | ⚠️ | Correct: `p-2 bg-gradient-to-br from-teal-500 to-cyan-600 rounded-lg` (L564) — missing `shadow-md` and `p-2.5` per Bible |
| Title row: flex gap-3 + heading + subtitle | ✅ | `flex items-center gap-3` → badge + `text-2xl font-bold` + subtitle (L563–569) |
| Action buttons right-aligned | ✅ | Export/Print buttons in CardHeader action row |

### §3 Stats Cards (Inline Buttons) — **9/10** ✅

| Check | Status | Detail |
|-------|--------|--------|
| Uses inline `<button>` elements | ✅ | Full inline-button pattern (L650–690) |
| Grid `grid-cols-2 lg:grid-cols-5` | ✅ | `grid-cols-2 sm:grid-cols-3 lg:grid-cols-5` — 5-stat layout |
| Active state: `border-l-4 shadow-sm` + active classes | ✅ | Correct implementation (L671–676) |
| Inactive-while-filtered: `opacity-50 hover:opacity-80` | ✅ | Correct (L674) |
| Default: `hover:shadow-md hover:bg-muted/50` | ✅ | Correct (L675) |
| Click toggles: same deselects, different switches | ✅ | `isActive && key !== 'all' ? 'all' : key` (L668) |
| Filter hint below grid | ✅ | `text-[11px]` with `Filter` icon (L683–686) |
| *(Deduction)* Active classes hardcoded instead of `s.statsActive.*` | ⚠️ | Uses inline strings, not config tokens |

### §4 Date Filtering — **9/10** ✅

| Check | Status | Detail |
|-------|--------|--------|
| Uses shared `DateRangeFilter` | ✅ | Single instance inside CardHeader (L773) |
| Paired with `useDateFilter()` hook | ✅ | `initialFilter: 'all'` (L42) |
| Buffered Apply for custom range | ✅ | Via component internals |
| Clear resets to `'all'` | ✅ | Via filter chips "Clear all" |
| *(Note)* Initial filter is `'all'` not `'week'` | — | Appropriate for QR codes (not time-scoped by default) |

### §5 Filter Toolbar & Chips — **9/10** ✅ 🏆

| Check | Status | Detail |
|-------|--------|--------|
| Search uses `useDebouncedSearch` | ✅ | `delay: 500` (L41) |
| Dropdowns use shadcn `Select` | ✅ | Prefix + Status selects (L793–825) |
| No duplicate filtering | ⚠️ | Stats cards filter by status AND there's a status dropdown — slight duplication, but chips unify them |
| Active filter chips (Badge + X dismiss) | ✅ | Full implementation: status, prefix, date chips with `X` dismiss (L828–866) |
| "Clear all" link | ✅ | Resets all filters + page (L862–865) |
| Descriptive subtitle with counts | ✅ | CardDescription: "{count} codes in {prefix} ({status})" (L709–711) |

**This is the reference implementation of the filter chip pattern.** Should be documented in Bible as canonical example.

### §6 Table & Data Display — **7/10** ✅

| Check | Status | Detail |
|-------|--------|--------|
| Server-side pagination | ✅ | `useServerPagination` + `.range(from, to)` |
| Server-side sorting | ✅ | `useSortableTable` + `SortableHeader` on 3 columns |
| Server-side search | ✅ | `debouncedSearchTerm` + `.ilike()` |
| Row status tinting | ❌ | No row tinting — all rows plain `hover:bg-muted/50` |
| Inline refresh skeleton (not full-page) | ✅ | Loading overlay with `bg-background/60` + spinning `RefreshCw` (L877–883) — keeps table visible |
| Full-page skeleton on `initialLoading` | ✅ | Layout-matching skeleton (L541–555) |
| Pagination footer | ✅ | "Showing X to Y of Z" + per-page Select + page arrows |
| Keyboard pagination | ✅ | ArrowLeft/Right with input guard (L506–520) |

### §7 Dialogs & Sheets — **8/10** ✅

| Check | Status | Detail |
|-------|--------|--------|
| `QrCodeDetailsDialog` for assigned/sold | ✅ | Opens via eye icon (L982–986) |
| `ConfirmDialog` for all destructive actions | ✅ | Single/bulk/delete-all unused — never `confirm()` |
| `QrCodeDownloadDialog` for bulk print | ✅ | Selected or page codes, with layouts/paper/PDF |
| `downloadQrCode()` for single download | ✅ | Per-row download button (L970–977) |
| *(Deduction)* Dialogs may not follow premium `p-0` pattern | ⚠️ | Not checked in detail — separate component reviews |

### §8 Mobile Responsiveness — **8/10** ✅

| Check | Status | Detail |
|-------|--------|--------|
| Page wrapper `space-y-4 md:space-y-6` | ✅ | L553 |
| Grids collapse | ✅ | Stats: `grid-cols-2 sm:grid-cols-3 lg:grid-cols-5`; Form: `grid-cols-1 sm:grid-cols-2` |
| Touch targets ≥ 32px | ✅ | Pagination `h-8 w-8`, form inputs `h-10` |
| No horizontal overflow except table | ✅ | Table has `overflow-x-auto min-w-[500px]` |
| Buttons wrap on mobile | ✅ | Action buttons use `flex flex-wrap` (L714) |
| *(Deduction)* No card-view fallback for mobile table | ⚠️ | Table with 4-5 cols horizontal scrolls on narrow |

### §9 Typography — **8/10** ✅

| Check | Status | Detail |
|-------|--------|--------|
| Page heading `text-2xl font-bold` | ✅ | L567 |
| Card titles `text-lg` | ✅ | "Generate New QR Codes", "QR Codes" |
| Stat values `text-2xl font-bold` | ✅ | L681 |
| No `text-3xl` | ✅ | Correct |
| Mono for QR codes `font-mono font-medium text-sm` | ✅ | L960 |
| Caption/helper `text-xs text-muted-foreground` | ✅ | Multiple instances |
| *(Deduction)* Stat numbers missing `tabular-nums` | ⚠️ | Should add for alignment |

### §10 Interactions & Touch — **6/10** ⚠️

| Check | Status | Detail |
|-------|--------|--------|
| Primary CTA uses gradient | ✅ | Generate button: `bg-gradient-to-r from-teal-500 to-cyan-600` (L641) — but hardcoded |
| CTA has animation | ✅ | `hover:scale-105 active:scale-95` (L641) — but hardcoded, not `s.btnAnimation` |
| Action buttons always visible | ✅ | Download/delete/view icons always shown, not behind hover |
| Action buttons `size="icon" variant="ghost"` | ❌ | Uses `size="sm"` instead of `size="icon"` + `h-8 w-8` (L970, L979, L989) |
| Delete buttons `hover:text-red-600` | ✅ | `hover:bg-red-50 hover:text-red-600` (L981) |
| Loading skeletons match layout | ✅ | Both initial skeleton and table loading overlay |
| Bulk selection checkbox | ✅ | Checkbox per unused row + select-all header checkbox |
| *(Deduction)* Table loading uses `animate-spin` spinner | ⚠️ | Loading overlay uses `RefreshCw animate-spin` — Bible says no spinner-only loading (mitigated by keeping table visible) |

### §11 Empty & Error States — **7/10** ✅

| Check | Status | Detail |
|-------|--------|--------|
| Empty table state with `colSpan` | ✅ | Spans all columns (L917) |
| Icon + title + contextual CTA | ✅ | QrCodeIcon + "No QR codes found" + "Clear search" button if searching (L918–930) |
| *(Does not use shared `EmptyState`)* | ⚠️ | Custom inline empty state — functional but not shared component |
| Empty prefix state (no prefixes) | ✅ | Dashed border card + icon + message + "Go to Settings" CTA (L582–596) |
| Error toast on failure | ✅ | `toast.error()` in all catch blocks |
| *(Deduction)* No error state UI | ⚠️ | Errors show toast but no dedicated error card with retry |

### §12 Core Rules — **8/10** ✅

| Check | Status | Detail |
|-------|--------|--------|
| No `confirm()` / `alert()` / `prompt()` | ✅ | Uses `ConfirmDialog` for all destructive actions |
| No client-side filtering of large datasets | ✅ | All filtering server-side (status, prefix, search, date) |
| No `DateFilterTabs` | ✅ | Uses `DateRangeFilter` |
| Uses inline buttons for stats (not `StatsCardGrid`) | ✅ | Correct premium pattern |
| Supabase error handling | ✅ | `if (error) throw error` + catch → toast |
| Search debounced | ✅ | 500ms delay |
| Toast via sonner | ✅ | `toast.success()`, `toast.error()` throughout |
| *(Deduction)* Stats fetch inefficient | ⚠️ | Fetches ALL status values then counts client-side — better than 5 queries but still loads full column |

---

## 5. Checklist Score Summary

| Metric | Score | Notes |
|--------|-------|-------|
| Config compliance (no hardcoded colors) | **2/10** | All patterns correct but every class is hardcoded. Zero `appConfig` usage. 16 teal instances. |
| Mobile responsiveness | **8/10** | Excellent grid collapse, loading states, wrap. Missing table card-view. |
| Design consistency | **8/10** | Gradient badge ✅, inline stats toggle ✅, filter chips ✅, DateRangeFilter ✅, ConfirmDialog ✅ |
| Interaction quality | **7/10** | Gradient CTA ✅, keyboard nav ✅, bulk ops ✅. Missing token refs, action btn sizing. |
| **Overall** | **25/40** | **Needs polish** (threshold: 24–31) |

**Key insight:** This page is architecturally the closest to the Bible's ideal — it has every premium pattern (gradient badge, inline-button stats, filter chips, ConfirmDialog, keyboard nav, loading overlay). The only thing holding it back is **zero config token adoption**. Migrating to `appConfig.styles` would likely push it to **33+/40** (ship-ready).

---

## 6. Unique / Premium Patterns (Bible-Worthy)

### 6.1 Filter Chip Implementation (Reference Pattern)
This page has the **canonical filter chip implementation** — should be the Bible's reference:
```tsx
{(filterStatus !== 'all' || filterPrefix !== 'all' || dateFilter !== 'all') && (
  <div className="flex items-center gap-2 flex-wrap">
    <span className="text-xs text-muted-foreground">Filtered by:</span>
    {filterStatus !== 'all' && (
      <Badge variant="secondary" className="gap-1 pl-2 pr-1 capitalize">
        Status: {filterStatus}
        <button onClick={() => { setFilterStatus('all'); setCurrentPage(1); }}
          className="ml-1 rounded-full hover:bg-muted-foreground/20 p-0.5">
          <X className="h-3 w-3" />
        </button>
      </Badge>
    )}
    {/* ...more chips... */}
    <button onClick={clearAll} className="text-xs text-muted-foreground hover:text-foreground underline">
      Clear all
    </button>
  </div>
)}
```

### 6.2 Table Loading Overlay (vs Full-Page Skeleton)
```tsx
{tableLoading && (
  <div className="absolute inset-0 bg-background/60 z-10 flex items-center justify-center rounded-md">
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <RefreshCw className="h-4 w-4 animate-spin" />
      Loading…
    </div>
  </div>
)}
```
Keeps table visible during re-fetch — better UX than full skeleton swap. Differentiated from `initialLoading` full-page skeleton.

### 6.3 5-Column Stats Grid for Multi-Status Entities
Uses `grid-cols-2 sm:grid-cols-3 lg:grid-cols-5` — first page to go beyond 4-column stats. Appropriate when entity has 4+ statuses.

### 6.4 Dual Deletion Strategy
Three-tier deletion UX: single → bulk selected → delete all (filtered). Each with appropriate ConfirmDialog. "Delete All Unused" only visible when status filter is `unused`.

### 6.5 Empty Prefix Generation Guard
When no active prefixes exist, the generation form is replaced with a dashed-border empty state card pointing to Settings:
```tsx
<div className="text-center p-8 border-2 border-dashed rounded-lg">
  <QrCodeIcon className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
  <p>No active QR prefixes found</p>
  <Button onClick={() => router.push('/admin/settings?tab=qr-prefixes')}>Go to Settings</Button>
</div>
```

---

## 7. TODO Table: UI/UX Improvements

| # | Task | Priority | Effort | Checklist Ref |
|---|------|----------|--------|---------------|
| U1 | Adopt `appConfig.styles` — import `const s = appConfig.styles`, replace all 16 hardcoded teal/gradient/animation instances with tokens (`s.linkColor`, `s.linkHover`, `s.headerIconGradient`, `s.primaryGradient`, `s.primaryGradientHover`, `s.btnAnimation`) | **P0** | 30 min | §1 |
| U2 | Migrate inline stats `activeClass` strings to `s.statsActive.*` tokens — requires adding `unused`/`assigned`/`sold`/`lost` variants to `appConfig.styles.statsActive` | **P0** | 45 min | §1, §3 |
| U3 | Fix header badge — add `p-2.5` (currently `p-2`) and `shadow-md` to match Bible spec exactly | **P2** | 5 min | §2 |
| U4 | Add row tinting — `s.rowTint.*` tokens to tint rows by status (green=unused, blue=assigned, purple=sold, red=lost) | **P1** | 45 min | §6 |
| U5 | Fix action button sizing — change `size="sm"` to `size="icon"` + `h-8 w-8` for download/delete/view buttons | **P2** | 10 min | §10 |
| U6 | Add `tabular-nums` to stat card values for proper number alignment | **P2** | 5 min | §9 |
| U7 | Use shared `EmptyState` component for table empty state instead of inline custom | **P3** | 15 min | §11 |
| U8 | Remove status dropdown duplication — stats cards already filter by status; dropdown is redundant; OR keep dropdown but sync it visually with stats active state | **P3** | 20 min | §5 |
| U9 | Replace loading overlay `animate-spin` with skeleton shimmer or progress bar | **P3** | 20 min | §10, §12 |
| U10 | Add error state UI — error card with retry button when data fetch fails, instead of toast-only | **P3** | 30 min | §11 |

---

## 8. TODO Table: Functionality Improvements

| # | Task | Priority | Effort | Notes |
|---|------|----------|--------|-------|
| F1 | Optimize stats query — use `GROUP BY status` aggregation via RPC or single query instead of fetching all rows and counting client-side | **P1** | 1 hr | Performance: currently fetches entire `status` column |
| F2 | Extract `PaginationControls` component — ~70 lines of pagination UI duplicated across QR codes, inventory, sales pages | **P1** | 1 hr | Shared component opportunity |
| F3 | Add export size warning — check `totalCount` before export, show ConfirmDialog if >10k records | **P2** | 20 min | Risk: browser freeze on 100k+ codes |
| F4 | Extract `useQrCodesData` hook — encapsulate `loadQrCodes()`, `manualRefresh()`, `getStats()`, `exportQrCodes()` into a dedicated data hook; page component drops by ~300 lines | **P2** | 2 hr | 1118 lines is too large |
| F5 | Remove `manualRefresh()` — duplicates `loadQrCodes()` with same logic; use a `refreshTrigger` state toggle to re-trigger the existing useEffect instead | **P2** | 30 min | DRY violation: query logic duplicated |
| F6 | Add "Mark as Lost" action — currently no UI to transition unused→lost; only visible for unused codes | **P2** | 1 hr | Missing lifecycle step |
| F7 | Batch insert chunking — for >500 codes, chunk generation and show progress | **P3** | 2 hr | Mitigated by RPC function, but worth monitoring |
| F8 | Selection persistence across pages — track selected IDs globally, not just current page | **P3** | 1.5 hr | Currently intentionally cleared; could be opt-in |
| F9 | Prefix stats — show per-prefix usage breakdown (e.g., "WA-499: 450/9999 used") | **P3** | 1.5 hr | Nice-to-have analytics |
| F10 | Lazy-load QR prefix list — currently blocks initial render; could load in parallel or cache | **P3** | 30 min | Performance on slow connections |

---

## 9. Cross-Reference: Bible Compliance

| Bible Section | Status | Gap |
|--------------|--------|-----|
| §2.1 Token reference | ❌ | No `appConfig` import — all patterns correct but hardcoded |
| §3.1 Stats cards (inline buttons) | ✅ (pattern) ⚠️ (tokens) | Correct inline-button pattern; missing `s.statsActive.*` |
| §3.2 Category drill-down | N/A | No category breakdown on this page |
| §4.1 Button animation tokens | ❌ | Hardcoded `hover:scale-105` |
| §5.5 DateRangeFilter | ✅ | Correct usage with `useDateFilter` |
| §5.6 Row tinting | ❌ | No row tinting |
| §7.1 Back button tokens | ❌ | Hardcoded teal |
| §7.3 Header icon badge | ⚠️ | Correct visual but hardcoded + missing `shadow-md` |
| §8.3 Premium dialog (p-0 pattern) | — | Dialogs are separate components |
| §11 Component table | ✅ | Uses `QrCodeDetailsDialog`, `QrCodeDownloadDialog`, `ConfirmDialog`, `SortableHeader`, `DateRangeFilter` |
| §12 Anti-patterns | ✅ | No `confirm()`, no `alert()`, no `DateFilterTabs` |

---

## 10. Risks & Edge Cases

| Risk | Severity | Description |
|------|----------|-------------|
| Stats fetches all status values | **Medium** | Loads entire `status` column for shop — scales poorly with 100k+ codes |
| `manualRefresh()` duplicates query logic | **Low** | Same filters built twice — drift risk |
| Export no limit | **Medium** | Exports ALL matching codes — browser may crash for large datasets |
| No error state UI | **Medium** | Toast only — user may miss it; no retry affordance |
| Prefix sequence gap | **Low** | If RPC partially fails, sequence numbers may have gaps |
| No "Mark as Lost" UI | **Low** | Status transition only possible via direct DB edit |

---

*Review updated: February 8, 2026 — Version 2.0 (Checklist-scored rewrite)*
