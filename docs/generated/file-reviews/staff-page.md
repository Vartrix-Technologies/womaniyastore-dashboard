# File Review: admin/staff/page.tsx (v2.0 — Checklist-Scored)

> **Reviewed:** February 9, 2026
> **Checklist version:** PAGE_ANALYSIS_CHECKLIST v2.0
> **Bible version:** DESIGN_SYSTEM_BIBLE v2.0+
> **Score: 18 / 40 — ⚠️ Needs Rework**

---

## File in Scope

| File | Lines | Purpose |
|------|-------|---------|
| `src/app/(protected)/admin/staff/page.tsx` | 527 | Staff management — view, edit, toggle active. Embeds `UserManagement` for superadmin create mode |

**Child dependency (already reviewed):** `UserManagement.tsx` (754 lines) — reviewed in superadmin-page.md

---

## Current State Summary

### What Works ✅
1. **Debounced search** — `useDebouncedSearch({ delay: 300 })` for name/phone filtering
2. **Stats cards as filters** — Clickable cards set `statusFilter`/`roleFilter` — discoverable UX
3. **Status Tabs** — All/Active/Inactive via Tabs component
4. **Role dropdown filter** — Select with role options, superadmin-only option
5. **Active/Inactive toggle** — Switch per row with `data-[state=checked]:bg-green-500`
6. **Superadmin create mode** — `isSuperadmin` check. Superadmins get `UserManagement`, admins get info toast
7. **Self-edit reload** — Editing own profile triggers `window.location.reload()` to refresh AuthContext
8. **DropdownMenu for actions** — MoreVertical trigger with Edit option
9. **Responsive header** — `flex-col sm:flex-row items-start sm:items-center`
10. **Dialog with sections** — "Basic Information" + "Permissions & Role" headings

### What's Missing ❌
1. **Zero `appConfig.styles` tokens** — `appConfig` not even imported
2. **No `ConfirmDialog`** — Toggle active is one-click, no confirmation
3. **No `EmptyState`** — Plain text in table cell for empty results
4. **No `Skeleton`/`LoadingTable`** — Uses `animate-spin` border spinner for table loading
5. **No `StatsCardGrid`** — Custom 4-card grid with hardcoded colors
6. **No `FieldError`** — Single `toast.error('Please enter full name')` for validation
7. **No page header gradient icon** — Plain text header, no icon badge
8. **No `SortableHeader`** — Table columns not sortable
9. **No self-deactivation prevention** — Admin can deactivate themselves, getting locked out
10. **Debug `console.log` left in** — L115, L132 — production leak

---

## §1. Config-Driven Theming — 0 / 5

| Check | Status | Detail |
|-------|--------|--------|
| `appConfig` imported | ❌ | Not imported at all |
| `const s = appConfig.styles` | ❌ | N/A |
| `s.primaryGradient` used | ❌ | 2× hardcoded `bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-600 hover:to-cyan-700` (L221, L515) |
| `s.linkColor` / `s.linkHover` used | ❌ | 1× hardcoded `text-teal-600 hover:text-teal-700 hover:bg-teal-50` on back button (L202) |
| `s.btnAnimation` used | ❌ | 7× hardcoded `hover:scale-105 active:scale-95 transition-all` (L221, L231, L243, L255, L267, L509, L515) |
| `s.headerIconGradient` used | ❌ | No icon badge on header |

**Hardcoded color inventory (all non-tokenized):**
- `from-teal-500 to-cyan-600` ×2 (Add Staff + dialog Submit)
- `text-teal-600 hover:text-teal-700 hover:bg-teal-50` ×1 (back button)
- `hover:scale-105 active:scale-95 transition-all` ×7 (buttons + stat cards)
- `text-green-600` ×1 (Active stat)
- `text-blue-600` ×1 (Admin stat)
- `text-purple-600` ×1 (Staff stat)
- `data-[state=checked]:bg-green-500` ×1 (Switch)

**Total: ~14 hardcoded style instances, 0 tokens.**

---

## §2. Page Header — 1 / 3

| Check | Status | Detail |
|-------|--------|--------|
| Gradient icon badge | ❌ | No icon badge — just `<h1>` and subtitle |
| `text-2xl font-bold` heading | ✅ | "Staff Management" L218 |
| Subtitle with context | ✅ | "Manage staff members and permissions" L219 |
| Back button | ✅ | ArrowLeft link to `/admin`, hardcoded `text-teal-600` (should be `s.linkColor`) |

---

## §3. Stats Cards — 2 / 4

| Check | Status | Detail |
|-------|--------|--------|
| Stats present | ✅ | 4 cards: Total, Active, Admins, Staff |
| Clickable as filters | ✅ | Each card sets `statusFilter` + `roleFilter` — good pattern |
| Uses `StatsCardGrid` | ❌ | Custom manual grid |
| Active state visual | ❌ | No visual distinction when a filter is active — user can't see which is selected |
| Token-driven colors | ❌ | Hardcoded `text-green-600`, `text-blue-600`, `text-purple-600` |
| Grid responsive | ✅ | `grid-cols-2 lg:grid-cols-4` |

---

## §4. Date Filtering — N/A

Staff list is not date-dependent.

---

## §5. Filter Toolbar & Chips — 3 / 4

| Check | Status | Detail |
|-------|--------|--------|
| Search input with icon | ✅ | Search icon + `pl-10` offset — correct pattern |
| Debounced | ✅ | `useDebouncedSearch({ delay: 300 })` |
| Status filter tabs | ✅ | All/Active/Inactive via `Tabs` component |
| Role dropdown | ✅ | Select with role options |
| Filter result count | ✅ | "Staff Members ({filteredStaff.length})" in table header |
| Active filter chips | ❌ | No visual chips showing active filters (low priority here) |

---

## §6. Table & Data Display — 1 / 5

| Check | Status | Detail |
|-------|--------|--------|
| Table present | ✅ | Manual `<table>` with columns: Name, Phone, Role, Max Discount, Status, Actions |
| Uses `SortableHeader` | ❌ | Plain `<th>` — no column sorting |
| Row hover feedback | ✅ | `hover:bg-muted/50 transition-colors` |
| Horizontal scroll | ✅ | `overflow-x-auto` + `min-w-[600px]` |
| Server-side pagination | ❌ | **All records loaded at once** — `loadStaff` fetches everything |
| Server-side search | ❌ | **Client-side filtering only** — searches `staff` array in memory |
| Row tinting tokens | N/A | No status-based row coloring |

---

## §7. Dialogs & Sheets — 2 / 4

| Check | Status | Detail |
|-------|--------|--------|
| Edit dialog | ✅ | Dialog with form sections, responsive `w-[90vw] max-w-2xl max-h-[90vh]` |
| `DialogDescription` present | ✅ | Context-appropriate text |
| `ConfirmDialog` for destructive | ❌ | **Toggle active has no confirmation** — one-click Switch deactivation |
| Form loading state in submit | ❌ | No loading indicator during save |
| Icon-labeled inputs | ❌ | Plain inputs without icon prefixes (unlike UserManagement which has them) |
| `FieldError` for validation | ❌ | Only `toast.error('Please enter full name')` |

---

## §8. Mobile Responsiveness — 3 / 4

| Check | Status | Detail |
|-------|--------|--------|
| Root `space-y-4 md:space-y-6` | ✅ | L197 |
| Header flex responsive | ✅ | `flex-col sm:flex-row items-start sm:items-center` |
| Stats grid responsive | ✅ | `grid-cols-2 lg:grid-cols-4` |
| Table horizontal scroll | ✅ | `overflow-x-auto` with `min-w-[600px]` |
| Dialog mobile-safe | ✅ | `w-[90vw] max-w-2xl max-h-[90vh]` |
| Form grid responsive | ✅ | `grid-cols-1 sm:grid-cols-2` |
| Filter toolbar mobile | ⚠️ | TabsList uses `grid-cols-3` (fine), but role filter row may not wrap cleanly |

---

## §9. Typography — 3 / 3

| Check | Status | Detail |
|-------|--------|--------|
| Page heading `text-2xl font-bold` | ✅ | L218 |
| Card titles `text-lg` | ✅ | Stats and table header |
| Secondary text `text-sm`/`text-xs` | ✅ | Labels, descriptions, table cells |
| No `text-3xl` | ✅ | Clean |

---

## §10. Interactions & Touch — 1 / 3

| Check | Status | Detail |
|-------|--------|--------|
| Button hover + active | ✅ | `hover:scale-105 active:scale-95 transition-all` on all interactive elements |
| Card hover elevation | ✅ | `hover:shadow-lg` on stat cards |
| No loading on action buttons | ❌ | Edit submit + toggle active have no loading spinner |
| Using `s.btnAnimation` token | ❌ | All 7 instances hardcoded |
| Touch targets | ✅ | Standard button/Switch sizing |

---

## §11. Empty & Error States — 0 / 3

| Check | Status | Detail |
|-------|--------|--------|
| Loading state | ❌ | `animate-spin` border spinner in table cell — **Bible anti-pattern** (should be `Skeleton`/`LoadingTable`) |
| Empty filtered state | ⚠️ | Inline text in `<td>`: "No staff members match the selected filters" — **not using `EmptyState`** |
| Empty unfiltered state | ⚠️ | "No staff members found" — no icon, no CTA, no explanation — **not using `EmptyState`** |
| Error boundaries | ❌ | Only `toast.error` on load failure |

---

## §12. Core Rules — 2 / 5

| Rule | Status | Detail |
|------|--------|--------|
| No `confirm()` | ✅ | No native dialogs |
| No `alert()` | ✅ | Uses `toast.*` |
| `toast` for feedback | ✅ | Success/error on edit, toggle, load |
| Layout `space-y-*` | ✅ | No `container mx-auto p-6` |
| Shared components first | ❌ | Skips `EmptyState`, `LoadingTable`, `StatsCardGrid`, `ConfirmDialog`, `FieldError` |
| `window.location.reload()` | ⚠️ | Used for self-edit (L140) — heavy-handed. Bible doesn't explicitly ban this but `refreshProfile()` from AuthContext would be better |
| Debug `console.log` | ❌ | 2× console.log left in production code (L115, L132) |
| Client-side only filtering | ⚠️ | All data loaded at once, search in memory — OK for small shops but doesn't follow server-side pattern |

---

## Scoring Summary

| # | Section | Score | Max | Notes |
|---|---------|-------|-----|-------|
| 1 | Config-Driven Theming | 0 | 5 | `appConfig` not imported, 14+ hardcoded |
| 2 | Page Header | 1 | 3 | No gradient icon badge |
| 3 | Stats Cards | 2 | 4 | Clickable but no StatsCardGrid, no active state, no tokens |
| 4 | Date Filtering | N/A | — | Not applicable |
| 5 | Filter Toolbar & Chips | 3 | 4 | Good: debounced search, tabs, role dropdown |
| 6 | Table & Data Display | 1 | 5 | No SortableHeader, no pagination, client-only filtering |
| 7 | Dialogs & Sheets | 2 | 4 | Edit dialog OK but no ConfirmDialog, no FieldError, no loading |
| 8 | Mobile Responsiveness | 3 | 4 | Solid responsive layout |
| 9 | Typography | 3 | 3 | ✅ Consistent |
| 10 | Interactions & Touch | 1 | 3 | Present but hardcoded, no loading states on actions |
| 11 | Empty & Error States | 0 | 3 | Spinner anti-pattern, inline text empties |
| 12 | Core Rules | 2 | 5 | Debug console.logs, skips shared components, window.location.reload |
| | **TOTAL** | **18** | **43** | **Normalized: 18 / 40** |

**Verdict: 18/40 — ⚠️ Needs Rework** (threshold: <24)

---

## Key Findings

### Unique Patterns on This Page

1. **Stats cards as toggle filters** — Clicking a stat card sets both `statusFilter` and `roleFilter`. Good UX but no visual active state (user doesn't know which is selected).
2. **Dual view mode** — `viewMode: 'table' | 'create'` — superadmin sees `UserManagement` component, admins see toast. Back button label changes accordingly.
3. **Self-edit detection** — If editing own profile, triggers full page reload to refresh AuthContext. Should use `refreshProfile()` instead.
4. **Query excludes superadmin** — `.neq('role', 'superadmin')` but stats still count admin/owner/superadmin together under "Admins" — misleading label.

### Production Issues 🚨

1. **`console.log` left in** — L115: `console.log('Updating staff with data:', {...})`, L132: `console.log('Update result:', { data, error })`. Leaks data to browser console in production.
2. **No self-deactivation guard** — Admin can toggle their own Switch to inactive, locking themselves out permanently.
3. **No loading state on submit** — Dialog "Update" button doesn't show spinner during async save. User can double-click.

---

## Bible Cross-Reference — Gaps Identified

| Bible Section | Gap on This Page |
|---------------|------------------|
| §1 Core Rules | `window.location.reload()` instead of `refreshProfile()` |
| §2.1 Color System | Zero `s.*` token usage — `appConfig` not even imported |
| §3.1 StatsCardGrid | Manual 4-card grid ignores shared `StatsCardGrid` component |
| §6.4 Icon-Labeled Fields | Edit dialog inputs are plain (unlike UserManagement which has icons) |
| §7.3 Page Header | No gradient icon badge |
| §8 Dialogs | No `ConfirmDialog` for toggle active |
| §9.2 Skeleton Loading | Uses `animate-spin` spinner — explicit Bible anti-pattern |
| §9.3 EmptyState | Custom inline text instead of shared component |
| §11 Shared Components | `SortableHeader`, `LoadingTable`, `FieldError` all unused |
| §12 Anti-Patterns | Debug console.logs in production, hardcoded gradients |
| §13 Roadmap | No staff page tasks in Phase 1 |

---

## TODO: UI/UX

| # | Task | Priority | Effort | Section |
|---|------|----------|--------|---------|
| 1 | Import `appConfig` + `const s = appConfig.styles`. Replace all 14+ hardcoded teal/gradient/animation instances with tokens | **P0** | S | §1 |
| 2 | Add gradient icon badge to page header (Users icon + `s.headerIconGradient`) | **P1** | XS | §2 |
| 3 | Replace manual stats grid with `StatsCardGrid` or add `s.statsActive.*` active state styling when a filter card is selected | **P1** | S | §3 |
| 4 | Replace `animate-spin` table loading with `LoadingTable` or `Skeleton` rows | **P1** | S | §11 |
| 5 | Replace inline empty states with shared `EmptyState` component (filtered + unfiltered variants) | **P1** | XS | §11 |
| 6 | Add icon prefixes to edit dialog inputs (User, Phone icons) — match UserManagement pattern | **P2** | XS | §7 |
| 7 | Add visual active state to stat cards (border/bg highlight when filter matches) | **P2** | S | §3 |
| 8 | Add `SortableHeader` to table columns (at least Name, Role, Status) | **P2** | M | §6 |
| 9 | Add loading spinner to dialog Submit button during save | **P2** | XS | §10 |
| 10 | Tokenize stat card colors (`text-green-600`, `text-blue-600`, `text-purple-600`) into `s.statsActive.*` | **P2** | XS | §1 |

## TODO: Functionality

| # | Task | Priority | Effort | Section |
|---|------|----------|--------|---------|
| 1 | Remove debug `console.log` statements (L115, L132) — production data leak | **P0** | XS | §12 |
| 2 | Add self-deactivation guard — prevent admin from toggling their own active Switch off | **P0** | XS | Core |
| 3 | Add `ConfirmDialog` before toggling active status — one-click deactivation is dangerous | **P0** | S | §7 |
| 4 | Replace `window.location.reload()` with `refreshProfile()` from AuthContext for self-edit | **P1** | XS | §12 |
| 5 | Adopt `useFormErrors` + `FieldError` in edit dialog — replace toast-based validation | **P1** | S | §7 |
| 6 | Add form loading state (disable submit + show Loader2 spinner during save) | **P1** | XS | §10 |
| 7 | Add server-side search/pagination for shops with many staff (future-proofing) | **P3** | M | §6 |
| 8 | Fix stats "Admins" label — currently counts owner/superadmin but those roles aren't shown in table. Clarify or split | **P2** | XS | §3 |
| 9 | Validate phone format (regex for Indian mobile number) and discount range (0-100 with `FieldError`) | **P2** | S | §7 |
| 10 | Add `submitting` state to prevent double-click on edit submit | **P1** | XS | Core |
