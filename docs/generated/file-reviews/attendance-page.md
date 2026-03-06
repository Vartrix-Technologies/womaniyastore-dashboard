# File Review: src/app/(protected)/admin/attendance/page.tsx

**Last Updated**: February 8, 2026  
**Lines of Code**: 776  
**Version**: 2.0 (Checklist-scored rewrite)  
**Checklist Score**: **21/40** — needs rework  
**Recent Changes**: Server-side pagination, `StatsCardGrid` with partial toggle, `EmptyState` with contextual messages, `SortableHeader`, table loading overlay, `DateRangePicker`, separate stats query, `AttendanceBulkEntryDialog`, `ExportButton`

---

## 1. File Responsibility

**Primary Purpose**: Admin interface for viewing, creating, editing, and deleting staff attendance records with dual-view (calendar + tabular), server-side pagination, filtering, sorting, and CSV export.

**Role in the System:**  
Central attendance management hub. Displays clock-in/out logs scoped by shop, with date range + staff + status filters. Supports manual entry, bulk entry, edit, and soft-delete workflows via separate dialog components.

**What This File Intentionally Does NOT Do:**
- Does NOT perform clock-in/out actions (separate staff-facing flows)
- Does NOT calculate payroll (only tracks hours)
- Does NOT track owner/superadmin attendance (explicitly filtered out)
- Does NOT provide real-time updates (manual refresh required)

**Key Dependencies:**
| Dependency | Purpose |
|-----------|---------|
| `@/lib/supabase` | Direct Supabase client for queries |
| `@/lib/utils/attendance` — `calculateHours()` | Utility for hours computation |
| `@/context/AuthContext` | `profile.shop_id`, `user.id` |
| `@/hooks` | `useServerPagination`, `useSortableTable`, `useDebouncedSearch` |
| `@/components/shared/DateRangePicker` | Date range selection (**not** `DateRangeFilter`) |
| `@/components/shared/StatsCardGrid` | Stats display with partial toggle filtering |
| `@/components/shared/EmptyState` | Empty state with contextual messages + `colSpan` |
| `@/components/shared/ExportButton` | CSV export button |
| `@/components/shared/SortableHeader` | Sortable column headers |
| `@/components/staff/AttendanceCalendar` | Calendar visualization per staff |
| `@/components/admin/AttendanceEditDialog` | Edit existing records |
| `@/components/admin/AttendanceDeleteDialog` | Soft-delete records |
| `@/components/admin/AttendanceCreateDialog` | Manual entry creation |
| `@/components/admin/AttendanceBulkEntryDialog` | Bulk entry for multiple staff |

---

## 2. Execution Flow

### Initial Load Sequence
1. Component mounts → extract `profile.shop_id` from auth context
2. Initialize date range: last 7 days (default)
3. Three parallel fetches: `loadStaff()` + `loadData()` + `loadStats()`
4. Full-page skeleton during `initialLoading`; table loading overlay for subsequent fetches

### loadStaff() (Lines 107–118)
Fetches profiles excluding owner/superadmin roles. Auto-selects first staff for calendar view.

### loadStats() (Lines 120–155)
Separate query for full-dataset stats (not paginated). Fetches all attendance_logs for date range, filters out owner/superadmin client-side, computes:
- Total records, avg hours/day, in-progress count, manual entries count

### loadData() (Lines 157–262)
**Server-side paginated query with filters:**
1. If searching → pre-query matching staff IDs by name (`ilike`), short-circuit if none match
2. Build query with date range, deleted_at filter, staff/status filters
3. Server-side sort on `date` (or `clock_in` as proxy for hours)
4. `.range(from, to)` for pagination
5. Client-side post-filter: remove owner/superadmin, then client-side sort for `staff` and `hours` columns (can't sort by joined/computed fields server-side)

### Tab Architecture (Lines 405–748)
| Tab | Content |
|-----|---------|
| `calendar` | `AttendanceCalendar` component with staff picker |
| `logs` | Filters → Table → Pagination |

### Dialog Workflows (Lines 750–776)
Four dialogs: Edit, Delete, Create, Bulk Entry. All use `onSuccess={handleRefresh}` to reload data + stats.

---

## 3. Business Rules & Assumptions

**Explicit Rules:**
| Rule | Implementation |
|------|----------------|
| Owner/superadmin excluded | Query filter + client-side belt-and-suspenders filter |
| Soft delete | `deleted_at IS NULL` — records preserved for audit |
| In-progress: live hours | `calculateHours()` uses `new Date()` when clock_out is null |
| Default date range: 7 days | State initialization |
| Manual entries tracked | `is_manual_entry` flag + "Manual" badge |
| Edit audit trail | `edited_at` + `edited_by` tracked |

**Implicit Assumptions:**
- Admin/owner has permission to view/edit all shop attendance
- Clock times stored as ISO timestamps
- Break time tracked in minutes (`total_break_minutes`)
- Attendance records are shop-scoped (RLS + explicit filter)

---

## 4. PAGE_ANALYSIS_CHECKLIST — Detailed Scoring

### ✅ = Pass · ⚠️ = Partial · ❌ = Fail · N/A = Not Applicable

### §1 Config-Driven Theming — **2/10** ❌

| Check | Status | Detail |
|-------|--------|--------|
| Imports `appConfig`, aliases `const s = appConfig.styles` | ❌ | Not imported at all |
| Gradients use `s.primaryGradient` | ❌ | Hardcoded `bg-gradient-to-r from-teal-500 to-cyan-600` (L444) |
| Header icon badge uses `s.headerIconGradient` | ❌ | No gradient icon badge at all — no badge wrap on header |
| Back button uses `s.linkColor` + `s.linkHover` | ❌ | Hardcoded `text-teal-600 hover:text-teal-700 hover:bg-teal-50` (L352) |
| Stats active states use `s.statsActive.*` | ❌ | Hardcoded `activeClassName` strings on StatsCardGrid (L390, L399) |
| Row tinting uses `s.rowTint.*` | ❌ | No row tinting |
| Button animations use `s.btnAnimation` | ❌ | Hardcoded `hover:scale-105 active:scale-95 transition-all` (L444, L508) |
| Zero hardcoded teal classes | ❌ | ~6 instances (L352, L373, L444) |

### §2 Page Header — **3/10** ❌

| Check | Status | Detail |
|-------|--------|--------|
| Back button: `variant="ghost"` + tokens + `-ml-2` | ⚠️ | `variant="ghost"` ✅ but hardcoded teal (L352), **missing `-ml-2`** for left-alignment |
| Gradient icon badge | ❌ | No badge at all — plain text heading without icon (L361–364) |
| Title row: flex gap-3 + heading + subtitle | ⚠️ | Has heading `text-2xl font-bold` + subtitle, but no icon/badge alongside |
| Action buttons right-aligned | ❌ | No action buttons in header — Add Attendance lives inside logs tab |

### §3 Stats Cards — **6/10** ⚠️

| Check | Status | Detail |
|-------|--------|--------|
| Uses `StatsCardGrid` component | ✅ | L367–402 |
| Grid responsive | ✅ | Via StatsCardGrid internals (`grid-cols-2 lg:grid-cols-4`) |
| Partial toggle filtering | ⚠️ | Only 2 of 4 cards are clickable (In Progress, Manual Entries). Total Records and Avg Hours are display-only |
| Active classes hardcoded | ⚠️ | `activeClassName: 'border-l-yellow-500 bg-yellow-50...'` — not `s.statsActive.*` tokens |
| Filter hint below grid | ❌ | Missing |
| Stats from full dataset | ✅ | Separate `loadStats()` query — not paginated data |

### §4 Date Filtering — **3/10** ❌

| Check | Status | Detail |
|-------|--------|--------|
| Uses shared `DateRangeFilter` | ❌ | Uses **`DateRangePicker`** instead — different component, different API |
| Paired with `useDateFilter()` hook | ❌ | Uses manual `useState<DateRange>` instead |
| Presets (Today/Week/Month/All) | ❌ | DateRangePicker is calendar-only — no quick presets |
| Buffered Apply for custom range | ❌ | DateRangePicker triggers on every pick |
| Clear resets behavior | ⚠️ | "Clear Filters" button resets staff/status but **not** date range |

**Key gap:** This page uses `DateRangePicker` (calendar widget from react-day-picker) instead of the standard `DateRangeFilter` with presets. This is the only admin page not using `DateRangeFilter`. Migrating would gain presets, buffered Apply, and `useDateFilter` hook.

### §5 Filter Toolbar & Chips — **4/10** ⚠️

| Check | Status | Detail |
|-------|--------|--------|
| Search uses `useDebouncedSearch` | ✅ | `delay: 500` (L59) |
| Dropdowns use shadcn `Select` | ✅ | Staff + Status selects (L479–506) |
| No duplicate filtering | ⚠️ | Stats cards filter by status (In Progress, Manual) AND there's a status dropdown — partial overlap |
| Active filter chips | ❌ | Not implemented — no visual indication of active filters beyond dropdown value |
| "Clear all" link | ⚠️ | "Clear Filters" button exists but it's a full-width button in the grid, not a small link |
| Descriptive subtitle with counts | ⚠️ | "Showing X–Y of Z records" exists but not a filter-aware description |

### §6 Table & Data Display — **7/10** ✅

| Check | Status | Detail |
|-------|--------|--------|
| Server-side pagination | ✅ | `useServerPagination` + `.range(from, to)` |
| Server-side sorting | ⚠️ | Partial — `date` is server-side; `staff` and `hours` fall back to client-side sort (can't sort by joined/computed) |
| Server-side search | ✅ | Pre-queries staff IDs by name, then filters by `staff_id` — server-side |
| Row status tinting | ❌ | No row tinting — all rows plain `hover:bg-muted/50` |
| Inline refresh overlay | ✅ | Loading overlay with `bg-background/60` + `RefreshCw animate-spin` (L555–561) |
| Full-page skeleton on initial | ✅ | Layout-matching skeleton (L325–345) |
| Pagination footer | ✅ | "Showing X to Y of Z" + per-page Select + page arrows (L648–728) |
| Keyboard pagination | ❌ | Not implemented — no arrow key listeners |

### §7 Dialogs & Sheets — **6/10** ⚠️

| Check | Status | Detail |
|-------|--------|--------|
| Edit dialog | ✅ | `AttendanceEditDialog` (L751–758) |
| Delete dialog | ✅ | `AttendanceDeleteDialog` — soft-delete (L760–767) |
| Create dialog | ✅ | `AttendanceCreateDialog` (L769–776) |
| Bulk entry dialog | ✅ | `AttendanceBulkEntryDialog` — new feature (L778–785) |
| Dialogs use premium `p-0` pattern | ❓ | Not checked — separate component reviews needed |
| *(Deduction)* No `ConfirmDialog` for deletes | ⚠️ | Uses dedicated `AttendanceDeleteDialog` instead — functional but not the shared `ConfirmDialog` pattern |

### §8 Mobile Responsiveness — **6/10** ⚠️

| Check | Status | Detail |
|-------|--------|--------|
| Page wrapper `space-y-4 md:space-y-6` | ✅ | L349 |
| Grids collapse | ⚠️ | Stats: `grid-cols-2 lg:grid-cols-4` ✅; Filters: `grid-cols-1 md:grid-cols-2 xl:grid-cols-4` — `xl` breakpoint is unusual, should be `lg` |
| Touch targets ≥ 32px | ⚠️ | Pagination `h-8 w-8` ✅, but action buttons are `h-11` (oversized, inconsistent) |
| Table has `overflow-x-auto` | ✅ | With `min-w-[800px]` (L564) |
| Buttons stack on mobile | ⚠️ | "Add Attendance" + "Bulk Entry" row doesn't stack on narrow screens |
| No card-view fallback for mobile | ❌ | Table-only, horizontal scroll on narrow |

### §9 Typography — **7/10** ✅

| Check | Status | Detail |
|-------|--------|--------|
| Page heading `text-2xl font-bold` | ✅ | L362 |
| Card titles `text-lg` | ✅ | "Attendance Logs" (L527) |
| Body text `text-sm` | ✅ | Filter labels, table cells |
| No `text-3xl` | ✅ | Correct |
| Hours display `font-semibold` | ✅ | L616 — but missing `tabular-nums` |
| *(Deduction)* Stat label on icon uses wrong prop | ⚠️ | `iconColor: 'text-teal-500'` passed to StatsCardGrid — this should be a token |

### §10 Interactions & Touch — **5/10** ⚠️

| Check | Status | Detail |
|-------|--------|--------|
| Primary CTA uses gradient + animation | ✅ | "Add Attendance" button (L443–448) — hardcoded gradient |
| Stats cards partial toggle | ⚠️ | Only 2 of 4 clickable |
| Action buttons always visible | ✅ | Edit/Delete never behind hover |
| Action buttons `size="icon" variant="ghost" h-8 w-8` | ❌ | Uses `size="sm"` + `h-11` — wrong sizing (should be `size="icon"` + `h-8 w-8`) |
| Delete buttons `hover:text-red-600` | ⚠️ | Uses `text-destructive hover:text-destructive` — works but not the standard `hover:text-red-600` pattern |
| Loading skeletons match layout | ✅ | Initial skeleton matches stats + table shape |
| Keyboard pagination | ❌ | No arrow key listeners |

### §11 Empty & Error States — **8/10** ✅

| Check | Status | Detail |
|-------|--------|--------|
| Uses shared `EmptyState` component | ✅ | L578–590 |
| Contextual messages | ✅ | Different message when filters active vs no data at all |
| `colSpan` for table empty | ✅ | `colSpan={7}` (L590) |
| CTA in empty state | ⚠️ | Text says "Click Add Attendance" but no actual button rendered in empty state |
| Calendar empty state | ✅ | "No staff members found" / "Select a staff member" (L416–423) |
| Error state UI | ❌ | Errors logged to console only — no error card with retry |

### §12 Core Rules — **7/10** ✅

| Check | Status | Detail |
|-------|--------|--------|
| No `confirm()` / `alert()` / `prompt()` | ✅ | Uses dedicated delete dialog |
| No client-side filtering of large datasets | ⚠️ | Client-side sort for staff/hours after paginated fetch — justified by Supabase join limitation |
| No `DateFilterTabs` | ✅ | Uses `DateRangePicker` (not ideal but not the deprecated component) |
| Uses `StatsCardGrid` | ✅ | With partial toggle |
| Supabase error handling | ⚠️ | Uses `throw error` in try/catch — correct but no user-facing error state |
| Search debounced | ✅ | 500ms delay |
| Toast via sonner | ⚠️ | Dialogs likely use toast but page itself doesn't show toasts for load errors |

---

## 5. Checklist Score Summary

| Metric | Score | Notes |
|--------|-------|-------|
| Config compliance (no hardcoded colors) | **2/10** | No `appConfig`. ~6 hardcoded teal/gradient instances. StatsCardGrid active styles inline. |
| Mobile responsiveness | **6/10** | Good grid collapse and table overflow. `xl` breakpoint unusual, action btn sizing wrong, buttons don't stack. |
| Design consistency | **6/10** | StatsCardGrid ✅, EmptyState ✅, SortableHeader ✅, ExportButton ✅. No gradient badge, no filter chips, uses DateRangePicker. |
| Interaction quality | **7/10** | Gradient CTA ✅, loading overlay ✅, dialogs ✅, bulk entry ✅. No keyboard nav, wrong button sizing. |
| **Overall** | **21/40** | **Needs rework** (threshold: <24) |

---

## 6. Key Differences from Other Pages

### 6.1 Uses `DateRangePicker` Instead of `DateRangeFilter`
This is the **only admin page** still using the calendar-based `DateRangePicker` (from react-day-picker) instead of the standardized `DateRangeFilter` with presets (Today/Week/Month/All/Custom) + `useDateFilter` hook. This means:
- No quick preset buttons
- No buffered Apply pattern for custom ranges
- Each calendar pick triggers an immediate re-fetch
- No `useDateFilter` hook integration

**Migration path:** Replace `DateRangePicker` with `DateRangeFilter` + `useDateFilter`. The calendar picker behavior is still available via the "Custom" preset.

### 6.2 Search Pre-Query Pattern
Unique approach: searches staff names by pre-querying `profiles` table, then filters attendance by matching `staff_id`s. Other pages do `.ilike()` on the main table or `.or()` with joined fields.

### 6.3 Partial Stats Toggle
Only 2 of 4 stats cards are clickable (In Progress, Manual Entries). Total Records and Avg Hours are display-only. Bible pattern specifies all cards should be clickable toggles.

### 6.4 Calculated Hours Column Sort
`hours` is computed client-side from `clock_in`, `clock_out`, `total_break_minutes`. Sort falls back to `clock_in` server-side as proxy. Can't do true hours sort server-side without a DB view or computed column.

### 6.5 Extracted `calculateHours` Utility
`calculateHours()` lives in `@/lib/utils/attendance` — properly extracted. This utility is not yet documented in the Bible.

---

## 7. Cross-Reference: Bible Compliance

| Bible Section | Status | Gap |
|--------------|--------|-----|
| §2.1 Token reference | ❌ | No `appConfig` import |
| §3.1 Stats cards | ⚠️ | `StatsCardGrid` with partial toggle — only 2 of 4 clickable |
| §4.1 Button animation tokens | ❌ | Hardcoded `hover:scale-105` on CTA + Clear Filters |
| §5.5 DateRangeFilter | ❌ | Uses `DateRangePicker` instead — non-standard |
| §5.6 Row tinting | ❌ | No row tinting |
| §5.7 Filter chips | ❌ | No filter chips — active filters only visible in dropdown state |
| §7.1 Back button tokens | ❌ | Hardcoded teal, missing `-ml-2` |
| §7.3 Header icon badge | ❌ | No icon badge at all |
| §9.2 Table loading | ✅ | Loading overlay pattern (matches QR codes page) |
| §9.3 Empty state | ✅ | Shared `EmptyState` with contextual messages |
| §11 Component table | ✅ | Uses `StatsCardGrid`, `EmptyState`, `SortableHeader`, `ExportButton` |
| §12 Anti-patterns | ✅ | No `confirm()`, no `alert()`, search debounced |

---

## 8. Risks & Edge Cases

| Risk | Severity | Description |
|------|----------|-------------|
| `DateRangePicker` unbounded | **Medium** | User can select years of data — no max range limit |
| Client-side sort on paginated data | **Medium** | Sort by staff/hours only affects current page, not full dataset |
| Stats fetch loads all logs | **Medium** | `loadStats()` fetches all records in range to count — scales poorly for large shops |
| Missing error state UI | **Medium** | Console errors only — user sees stale data |
| Action buttons `h-11` oversized | **Low** | Touch targets too large, wastes vertical space |
| "Clear Filters" doesn't reset date | **Low** | Partial clear — could confuse users |
| No keyboard pagination | **Low** | Other pages have ArrowLeft/Right — inconsistent |

---

## 9. TODO Table: UI/UX Improvements

| # | Task | Priority | Effort | Checklist Ref |
|---|------|----------|--------|---------------|
| U1 | Adopt `appConfig.styles` — import `const s = appConfig.styles`, replace all ~6 hardcoded teal/gradient/animation instances with tokens | **P0** | 25 min | §1 |
| U2 | Add gradient icon badge to page header — `p-2.5 rounded-lg ${s.headerIconGradient} text-white shadow-md` wrapping `Clock` or `Users` icon, with flex title row | **P0** | 15 min | §2 |
| U3 | Add `-ml-2` to back button for left-alignment with page content | **P2** | 2 min | §2 |
| U4 | Replace `DateRangePicker` with `DateRangeFilter` + `useDateFilter` hook — gain presets (Today/Week/Month/All), buffered Apply, consistent UX | **P1** | 45 min | §4 |
| U5 | Make all 4 stats cards clickable — Total Records → show all, Avg Hours → could sort by hours desc | **P1** | 30 min | §3 |
| U6 | Add filter chips — show "Staff: John [×]", "Status: In Progress [×]", "Date: Jan 1–7 [×]" badges with dismiss + "Clear all" | **P1** | 45 min | §5 |
| U7 | Add row tinting — in-progress rows yellow tint, manual entries blue tint, edited rows orange tint (using `s.rowTint.*` or new attendance-specific tokens) | **P1** | 30 min | §6 |
| U8 | Fix action button sizing — change `size="sm" h-11` to `size="icon" h-8 w-8` for Edit/Delete buttons | **P2** | 5 min | §10 |
| U9 | Add keyboard pagination — ArrowLeft/Right with input guard, consistent with inventory/sales/QR pages | **P2** | 15 min | §6 |
| U10 | Add filter hint below stats grid — `text-[11px]` "Click a card to filter the table below" | **P2** | 5 min | §3 |
| U11 | Add `tabular-nums` to hours column for alignment | **P3** | 2 min | §9 |
| U12 | Fix button stacking — "Add Attendance" + "Bulk Entry" should stack on mobile (`flex-col sm:flex-row`) | **P3** | 5 min | §8 |
| U13 | Add error state UI — error card with retry button when loadData fails | **P3** | 30 min | §11 |
| U14 | Skeleton-to-content crossfade — `animate-in fade-in duration-300` | **P3** | 10 min | Premium |

---

## 10. TODO Table: Functionality Improvements

| # | Task | Priority | Effort | Notes |
|---|------|----------|--------|-------|
| F1 | Migrate to `DateRangeFilter` — replace `DateRangePicker` + manual date state with `DateRangeFilter` + `useDateFilter` hook; removes ~20 lines of manual date handling | **P1** | 45 min | Consistency across all admin pages |
| F2 | Optimize stats query — use aggregate RPC or GROUP BY instead of fetching all rows and computing client-side | **P1** | 1 hr | Performance for large shops |
| F3 | Extract `useAttendanceData` hook — encapsulate `loadData()`, `loadStats()`, `loadStaff()` logic; reduce page to ~400 lines | **P1** | 2 hr | 776 lines is large |
| F4 | "Clear Filters" should also reset date range — currently only clears staff + status | **P2** | 10 min | UX bug |
| F5 | Server-side sort for hours — create DB view with computed hours column, or RPC function | **P2** | 2 hr | Currently client-side sort on single page only |
| F6 | Add max date range limit — prevent selecting unbounded ranges (e.g., max 90 days) | **P2** | 15 min | Performance guard |
| F7 | Extract `PaginationControls` component — ~80 lines of identical pagination UI | **P2** | 1 hr | Duplicated across 5+ pages |
| F8 | Add attendance analytics — trend charts (late arrivals, avg hours/week), staff comparisons | **P3** | 4 hr | Premium feature |
| F9 | Add bulk edit — select multiple logs, adjust times at once | **P3** | 3 hr | Power user feature |
| F10 | Optimistic delete — update UI immediately, soft-delete in background, revert on failure | **P3** | 1 hr | Bible: optimistic UI pattern |

---

*Review updated: February 8, 2026 — Version 2.0 (Checklist-scored rewrite)*
