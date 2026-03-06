# File Review: src/app/(protected)/admin/checklists/page.tsx

**Last Updated**: February 9, 2026  
**Lines of Code**: 939 (was 840 at v1.0 — grown by ~100 lines with drag-reorder + FieldError + ConfirmDialog)  
**Version**: 2.0 (Checklist-scored rewrite)  
**Checklist Score**: **24/40** — needs polish (borderline)  
**Recent Changes**: Drag-and-drop reorder via `framer-motion` `Reorder`, `useFormErrors` + `FieldError` for form validation, `ConfirmDialog` for destructive actions, `DraggableChecklistItem` extracted component, `useDebouncedSearch`

---

## 1. File Responsibility

**Primary Purpose**: Admin interface for managing checklist templates (CRUD), checklist items (add/remove/reorder), creating daily instances for active checklists, and viewing completion history with stats.

**Role in the System:**  
Central checklist management hub. Admins define templates with recurrence rules (daily/weekly/once), manage ordered item lists, create today's instances, and review 30-day completion history per checklist.

**What This File Intentionally Does NOT Do:**
- Does NOT complete checklist items (staff-facing UI)
- Does NOT assign to specific staff (shop-wide checklists)
- Does NOT schedule future instances (only "Create Today")
- Does NOT archive templates (hard-delete only)
- Does NOT handle server-side pagination (all templates fetched at once — expected low volume per shop)

**Key Dependencies:**
| Dependency | Purpose |
|-----------|---------|
| `@/lib/api/checklists-v2` | API functions for all checklist operations |
| `@/lib/supabase` | Direct DB access for orphan instance cleanup |
| `@/context/AuthContext` | `profile.shop_id`, `profile.id` |
| `@/hooks` — `useDebouncedSearch` | Debounced search (300ms) |
| `@/components/shared/ConfirmDialog` | Destructive action confirmation |
| `@/components/shared/FieldError` | `useFormErrors`, `FieldError`, `fieldErrorClass` |
| `framer-motion` — `Reorder`, `useDragControls` | Drag-and-drop item reordering |
| `sonner` | Toast notifications |

---

## 2. Execution Flow

### Initial Load Sequence
1. Component mounts → extract `profile.shop_id` from auth context
2. `loadChecklists()` — fetches all templates with nested items
3. Simple text "Loading checklists..." during fetch — **not** a layout skeleton

### loadChecklists() (Lines 182–195)
Fetches all templates via `getChecklistTemplates(shop_id)`. Cast to `ChecklistWithItems` (type assertion `as any as`). No pagination — all templates loaded at once.

### Card Grid Display (Lines 525–618)
- Client-side filter: status (all/active/inactive) + debounced search (name + description)
- Grid layout: `md:grid-cols-2 lg:grid-cols-3`
- Each card shows: name, description, recurrence info, item count, action buttons (History, Edit, Delete)

### handleSaveChecklist() (Lines 267–313)
**For new:** `createChecklistTemplate()` with form data + items in one call.  
**For edit:** `updateChecklistTemplate()` for metadata, then **delete ALL old items and re-create** (simplifies reorder but creates new item IDs, breaking completion history references).

### handleCreateTodaysInstances() (Lines 335–371)
1. Get today's date + day of week
2. Fetch existing instances for today
3. **Orphan cleanup**: Delete instances where template recurrence no longer matches today
4. `createChecklistInstances()` to generate new
5. Uses direct `supabase` client (not API layer) for orphan queries

### handleViewHistory() (Lines 373–393)
Opens history dialog immediately, then parallel-fetches 30-day history + stats via `Promise.all`.

### DraggableChecklistItem Component (Lines 45–122)
Extracted sub-component using `framer-motion` `Reorder.Item` + `useDragControls`. Provides both:
- **Drag handle** (`GripVertical` icon with `pointerDown` → `dragControls.start()`)
- **Chevron up/down** buttons for keyboard/accessibility fallback
- **Remove button** per item

### Dialog Architecture
| Dialog | Purpose | Lines |
|--------|---------|-------|
| Create/Edit | Form: name, description, active switch, recurrence, item list with drag-reorder | 638–825 |
| History | 30-day stats + instance cards with completions | 828–920 |
| ConfirmDialog | Shared destructive action confirmation for deletes | 922–932 |

---

## 3. Business Rules & Assumptions

**Explicit Rules:**
| Rule | Implementation |
|------|----------------|
| Recurrence types: daily, weekly, once | Select dropdown; affects day selector visibility |
| Weekly checklists need active days | Array of 0–6 (Sun–Sat), validated non-empty |
| Default recurrence days: Mon–Sat | Initial state `[1,2,3,4,5,6]` |
| Checklist must have ≥1 item | `useFormErrors` validation |
| Items maintain sort_order | Maintained on drag/chevron reorder, persisted on save |
| Orphan cleanup on instance creation | Removes instances for non-matching recurrence days |
| Delete confirmation | Uses shared `ConfirmDialog` (no browser `confirm()`) |

**Implicit Assumptions:**
- Low template count per shop (no pagination needed)
- Day 0 = Sunday (JavaScript convention)
- `created_by` tracked on templates
- History limited to 30 days for performance
- Item re-creation on edit loses completion history links (trade-off accepted)

---

## 4. PAGE_ANALYSIS_CHECKLIST — Detailed Scoring

### ✅ = Pass · ⚠️ = Partial · ❌ = Fail · N/A = Not Applicable

### §1 Config-Driven Theming — **2/10** ❌

| Check | Status | Detail |
|-------|--------|--------|
| Imports `appConfig`, aliases `const s = appConfig.styles` | ❌ | Not imported at all |
| Gradients use `s.primaryGradient` | ❌ | ~8 hardcoded `bg-gradient-to-r from-teal-500 to-cyan-600` (L430, L449, L614, L724, L793, L813) |
| Header icon badge uses `s.headerIconGradient` | ❌ | Hardcoded `bg-gradient-to-br from-teal-500 to-cyan-600` (L430) — correct visual but not tokenized |
| Back button uses `s.linkColor` + `s.linkHover` | ❌ | Hardcoded `text-teal-600 hover:text-teal-700 hover:bg-teal-50` (L423) |
| Stats active states use `s.statsActive.*` | ❌ | Stats cards have no active state differentiation — no `s.statsActive.*` tokens |
| Button animations use `s.btnAnimation` | ❌ | Hardcoded `hover:scale-105 active:scale-95 transition-all` (15+ instances) |
| Drag border uses theme token | ❌ | Hardcoded `rgb(20 184 166)` in `whileDrag` style (L71) |
| Day toggle uses tokens | ❌ | Hardcoded `border-teal-500 bg-gradient-to-br from-teal-500 to-cyan-600` (L728–730) |
| Zero hardcoded teal classes | ❌ | **20+ instances** across back button, gradient badge, CTAs, day toggles, drag state |

### §2 Page Header — **8/10** ✅

| Check | Status | Detail |
|-------|--------|--------|
| Back button: `variant="ghost"` + `-ml-2` | ✅ | `variant="ghost" -ml-2` (L420–423) — correctly aligned ✅ |
| Gradient icon badge | ✅ | `p-2 bg-gradient-to-br from-teal-500 to-cyan-600 rounded-lg` wrapping `ListChecks` icon (L430–432) — correct visual pattern ✅ |
| Title row: flex gap-3 + heading + subtitle | ✅ | `flex items-center gap-3` → icon badge + title div (L429–436) |
| Action buttons right-aligned | ✅ | `flex-col sm:flex-row sm:items-center sm:justify-between gap-3` with buttons right side (L428, L438–453) |
| Heading `text-2xl font-bold` | ✅ | L434 |
| Subtitle `text-sm text-muted-foreground` | ✅ | L435 |
| *(Deduction)* All header tokens hardcoded | ⚠️ | Correct visual pattern implemented but not via `s.*` tokens — duplicate of §1 issue |

### §3 Stats Cards — **4/10** ⚠️

| Check | Status | Detail |
|-------|--------|--------|
| Uses `StatsCardGrid` component | ❌ | Manual stats card grid — 4 individual `<Card>` components (L457–494) |
| Grid responsive | ✅ | `grid-cols-2 lg:grid-cols-4` (L457) — correct breakpoints |
| Stats cards clickable for filtering | ✅ | 3 of 4 cards clickable (Total, Active, Inactive → set `filterStatus`). Total Items is display-only |
| Active states differentiated | ❌ | No visual active state when a card is selected as filter — cards look identical whether active or not |
| Stats text sizing | ⚠️ | Uses `text-2xl md:text-3xl` — ⚠️ `text-3xl` is an anti-pattern per Bible (too large on desktop). Should be `text-2xl` consistently |
| Color-coded stat values | ✅ | Active: `text-green-600`, Inactive: `text-gray-600`, Items: `text-blue-600` — semantically correct |
| Stats from full dataset | ✅ | Computed client-side from full checklist array |
| Filter hint below grid | ❌ | Missing — no hint that clicking cards filters the list |

### §4 Date Filtering — **N/A**

Checklists don't use date filtering for the main list. History dialog has a fixed 30-day lookback (not user-configurable). Not applicable.

### §5 Filter Toolbar & Chips — **5/10** ⚠️

| Check | Status | Detail |
|-------|--------|--------|
| Search uses `useDebouncedSearch` | ✅ | `delay: 300` (L131) — ✅ |
| Search icon in input | ✅ | `Search` icon positioned left (L501) |
| Filter tabs (All/Active/Inactive) | ✅ | `Tabs` + `TabsList` with 3 options (L511–519) |
| Active filter chips | ❌ | Not implemented — no visual badges showing "Active: 3 templates" |
| "Clear all" link | ❌ | No way to reset filters to default except clicking tab |
| Stats card → filter sync | ⚠️ | Clicking a stat card sets `filterStatus` which syncs with tabs, but tabs don't highlight the stat card |
| Client-side filtering adequate | ✅ | Low volume per shop — client-side is appropriate here |

### §6 Table & Data Display — **5/10** ⚠️

| Check | Status | Detail |
|-------|--------|--------|
| Uses card grid (not table) | ✅ | `grid md:grid-cols-2 lg:grid-cols-3` — appropriate for templates |
| Card structure consistent | ✅ | Name, badge, description, recurrence, item count, actions |
| Card dim on inactive | ✅ | `opacity-60` when `!checklist.is_active` (L555) |
| Row/card status tinting | ❌ | No color tinting for active vs inactive — only opacity |
| Action buttons always visible | ✅ | History, Edit, Delete always shown |
| Action button sizing | ⚠️ | Uses `size="sm"` instead of `size="icon" h-8 w-8` for Edit/Delete — not standard |
| Card hover effect | ✅ | `hover:shadow-lg` on cards |
| No pagination needed | ✅ | Low volume — all templates loaded at once |

### §7 Dialogs & Sheets — **7/10** ✅

| Check | Status | Detail |
|-------|--------|--------|
| Create/Edit dialog | ✅ | Full form with sections, validation, drag-reorder items (L638–825) |
| History dialog | ✅ | Stats grid + scrollable instance cards (L828–920) |
| ConfirmDialog for delete | ✅ | Uses shared `ConfirmDialog` component — ✅ no `confirm()` (L922–932) |
| Dialog responsive width | ✅ | `w-[90vw] max-w-2xl` (create/edit), `max-w-4xl` (history) |
| `overflow-y-auto` on long content | ✅ | Both dialogs have `max-h-[90vh] overflow-y-auto` |
| `useFormErrors` + `FieldError` | ✅ | Proper inline validation for name, items, recurrence_days (L130, L663, L780) |
| Premium `p-0` pattern | ❌ | Standard padding — not using premium dialog pattern |
| DialogFooter with Cancel + Submit | ✅ | Proper footer with disabled states during submit |

### §8 Mobile Responsiveness — **6/10** ⚠️

| Check | Status | Detail |
|-------|--------|--------|
| Page wrapper `space-y-4 md:space-y-6` | ✅ | L420 |
| Stats grid collapses | ✅ | `grid-cols-2 lg:grid-cols-4` |
| Card grid collapses | ✅ | `md:grid-cols-2 lg:grid-cols-3` — 1 col on mobile |
| Header buttons stack | ✅ | `flex-col sm:flex-row` (L428) |
| Day toggle touch targets | ✅ | `min-w-[44px] h-11` (L727) — meets 44px minimum |
| Drag works on touch | ✅ | `touch-none` on handle + `pointerDown` event — works with framer-motion |
| Tab triggers responsive text | ✅ | `text-xs md:text-sm` on TabsTrigger |
| Loading state not skeleton | ❌ | Text-only "Loading checklists..." centered (L399–403) — not a layout skeleton |

### §9 Typography — **6/10** ⚠️

| Check | Status | Detail |
|-------|--------|--------|
| Page heading `text-2xl font-bold` | ✅ | L434 |
| Card titles `text-lg` | ✅ | L558 |
| Body text `text-sm` | ✅ | Descriptions, recurrence info, item counts |
| Caption `text-xs text-muted-foreground` | ✅ | Stat card descriptions (L464, L472, L481, L490) |
| Dialog title `text-2xl` | ⚠️ | L641, L831 — `text-2xl` on dialog title is oversized; standard is `text-lg font-semibold` from DialogTitle defaults |
| *(Deduction)* Stat values `text-2xl md:text-3xl` | ⚠️ | `text-3xl` is anti-pattern per Bible — too large. Stat values should be `text-2xl` or `text-3xl font-bold` only in StatsCardGrid |

### §10 Interactions & Touch — **6/10** ⚠️

| Check | Status | Detail |
|-------|--------|--------|
| Primary CTA uses gradient + animation | ✅ | "New Checklist" button (L448–453) |
| Secondary CTA uses outline + animation | ✅ | "Create Today" button (L439–445) |
| Drag-and-drop reorder | ✅ | `framer-motion` Reorder with `useDragControls` — premium interaction |
| Chevron fallback for reorder | ✅ | `ChevronUp`/`ChevronDown` keyboard accessibility |
| Drag visual feedback | ✅ | `whileDrag` scale + shadow + border highlight (L67–73) |
| Empty state CTA | ✅ | "Create Checklist" gradient button in empty state (L608–617) |
| Item Enter-to-add | ✅ | `onKeyDown` Enter → `handleAddItem()` (L786–789) |
| Stats cards clickable | ⚠️ | Clickable but no visual active state — user can't tell which is selected |
| All animations hardcoded | ❌ | `hover:scale-105 active:scale-95` repeated 15+ times — should use `s.btnAnimation` |

### §11 Empty & Error States — **6/10** ⚠️

| Check | Status | Detail |
|-------|--------|--------|
| Empty state for card grid | ✅ | Contextual: "No checklists yet" / "No matching checklists" / "No checklists found" (L620–631) |
| Empty state icon + title + subtitle | ✅ | `ListChecks` icon + heading + description (L621–628) |
| CTA in empty state | ✅ | "Create Checklist" button when zero checklists (L630–617) |
| Empty state for dialog items | ✅ | "No items added yet" dashed border placeholder (L766–768) |
| History empty state | ✅ | "No completion history yet" with `BarChart3` icon (L910–916) |
| Uses shared `EmptyState` component | ❌ | Custom inline empty states — not using shared `EmptyState` component |
| Error state UI | ❌ | Errors go to `console.error` + `toast.error` — no error card with retry |

### §12 Core Rules — **7/10** ✅

| Check | Status | Detail |
|-------|--------|--------|
| No `confirm()` / `alert()` / `prompt()` | ✅ | Uses `ConfirmDialog` component — ✅ (was `confirm()` in v1, now fixed) |
| No client-side filtering of large datasets | ✅ | Client-side is appropriate — low template count per shop |
| Uses appropriate API layer | ⚠️ | Uses `checklists-v2` API but also direct `supabase` for orphan cleanup — mixed pattern |
| Search debounced | ✅ | 300ms delay |
| Toast via sonner | ✅ | Success/error toasts throughout |
| Validation before save | ✅ | `useFormErrors` with 3 fields: name, items, recurrence_days |
| `window.history.back()` | ⚠️ | Should use `router.back()` for consistency |

---

## 5. Checklist Score Summary

| Metric | Score | Notes |
|--------|-------|-------|
| Config compliance (no hardcoded colors) | **2/10** | No `appConfig`. 20+ hardcoded teal/gradient instances. Drag border hardcoded. Day toggles hardcoded. |
| Mobile responsiveness | **6/10** | Good grid collapse, touch-friendly day toggles, drag works on touch. Loading is text-only (no skeleton). |
| Design consistency | **6/10** | Gradient icon badge ✅, `ConfirmDialog` ✅, `FieldError` ✅, drag reorder ✅. Manual stats cards (not StatsCardGrid), no shared EmptyState, action button sizing wrong. |
| Interaction quality | **7/10** | Drag-and-drop ✅, chevron fallback ✅, Enter-to-add ✅, gradient CTAs ✅. Stats cards have no active state. All animations hardcoded. |
| Misc (typography, empty states, core rules) | **3/10** | `text-3xl` anti-pattern on stats, dialog titles oversized, `window.history.back()`, mixed API/direct-supabase |
| **Overall** | **24/40** | **Needs polish** (borderline — just at threshold of 24) |

---

## 6. Key Differences from Other Pages

### 6.1 Card Grid Instead of Table
This is the **only admin page** using a card-grid layout (`md:grid-cols-2 lg:grid-cols-3`) instead of a table. Appropriate for templates (low volume, rich card content), but means many table-specific Bible patterns (SortableHeader, row tinting, PaginationControls) don't apply.

### 6.2 Drag-and-Drop Reorder with framer-motion
**Unique to this page.** Uses `Reorder.Group` + `Reorder.Item` + `useDragControls` from `framer-motion`. Bible §4.3 mentions chevron reorder and references this page, but doesn't document the drag-drop pattern. The Bible Phase 3 roadmap mentions `@dnd-kit` for drag-reorder — but this page already uses framer-motion's `Reorder` instead.

### 6.3 `useFormErrors` + `FieldError` for Dialog Validation
One of 2 pages using this pattern (along with finances). Validates name (non-empty), items (≥1), recurrence_days (non-empty when weekly). Well-integrated with `fieldErrorClass` for red ring styling.

### 6.4 ConfirmDialog for Destructive Actions
Correctly uses the shared `ConfirmDialog` component instead of `window.confirm()`. This was a fix from the v1 review.

### 6.5 Manual Stats Cards (Not StatsCardGrid)
4 individual `<Card>` components with hardcoded styling. Bible §12 says "Manual stats card grids → `StatsCardGrid` or inline buttons with `s.statsActive.*` tokens". This page should migrate.

### 6.6 Item Re-creation on Edit
On save-edit, ALL existing items are deleted and re-created. This breaks completion history references (new item IDs). A batch update API would preserve IDs.

### 6.7 Mixed Data Access Pattern
Uses `checklists-v2` API layer for CRUD but direct `supabase` client for orphan instance cleanup. Should be consolidated into the API layer.

---

## 7. Cross-Reference: Bible Compliance

| Bible Section | Status | Gap |
|--------------|--------|-----|
| §2.1 Token reference | ❌ | No `appConfig` import |
| §2.4 Grid layouts | ✅ | Correct breakpoints for card grid and stats grid |
| §3.1 Stats cards | ❌ | Manual `<Card>` stats — not `StatsCardGrid`. No active state differentiation. |
| §4.1 Button animation tokens | ❌ | 15+ hardcoded `hover:scale-105 active:scale-95` — should use `s.btnAnimation` |
| §4.3 Chevron reorder | ✅ | Chevron up/down + drag-drop with correct button markup |
| §4.4 Action buttons | ⚠️ | Always visible ✅, but `size="sm"` instead of `size="icon" h-8 w-8` |
| §5.7 Filter chips | ❌ | No filter chips — status only shown in tabs |
| §6.6 useFormErrors | ✅ | Properly implemented with 3 validated fields |
| §7.1 Back button tokens | ⚠️ | Has `-ml-2` ✅ but hardcoded teal colors |
| §7.3 Header icon badge | ✅ | Correct visual pattern (hardcoded but present) |
| §9.3 Empty state | ⚠️ | Contextual empty states with CTA ✅, but not using shared `EmptyState` component |
| §10 Toast | ✅ | `sonner` toasts for success/error |
| §11 Component table | ⚠️ | Uses `ConfirmDialog` ✅, `FieldError` ✅. Doesn't use `StatsCardGrid`, `EmptyState` |
| §12 Anti-patterns | ✅ | No `confirm()` ✅, no `alert()` ✅. Has `window.history.back()` (should be `router.back()`) |

---

## 8. What Changed Since v1.0 Review

| Area | v1.0 (840 lines) | v2.0 (939 lines) | Status |
|------|-------------------|-------------------|--------|
| File size | 840 | 939 (+99) | ⚠️ Larger — drag component added |
| Item reorder | Manual up/down buttons only | Drag-and-drop + chevron fallback | ✅ Fixed |
| Delete confirmation | `confirm()` browser dialog | `ConfirmDialog` shared component | ✅ Fixed |
| Form validation | Toast-based ("Please enter a name") | `useFormErrors` + `FieldError` inline | ✅ Fixed |
| Unused import | `Link` from `next/link` | Removed | ✅ Fixed |
| `appConfig` tokens | Not used | Still not used | ❌ Still open |
| `StatsCardGrid` | Manual grid | Still manual grid | ❌ Still open |
| Loading skeleton | Text-only spinner | Still text-only | ❌ Still open |
| Component extraction | 840 lines monolith | 939 lines — `DraggableChecklistItem` extracted but rest still monolithic | ⚠️ Partially addressed |

---

## 9. Risks & Edge Cases

| Risk | Severity | Description |
|------|----------|-------------|
| Item deletion on edit | **High** | All items deleted + re-created → breaks completion history foreign key references |
| Orphan cleanup race condition | **Medium** | Delete + create not in a transaction; concurrent requests could corrupt state |
| Mixed API / direct-supabase | **Medium** | Orphan cleanup bypasses API layer — inconsistent, harder to test/mock |
| `text-3xl` on stat values | **Low** | Anti-pattern per Bible; too large on desktop width |
| `window.history.back()` | **Low** | Doesn't use Next.js router; could behave unexpectedly with browser history |
| No error state UI | **Medium** | `toast.error` only — no retry mechanism, stale UI on load failure |
| 939 lines still large | **Medium** | Only `DraggableChecklistItem` extracted — form dialog + history dialog should be separate |

---

## 10. TODO Table: UI/UX Improvements

| # | Task | Priority | Effort | Checklist Ref |
|---|------|----------|--------|---------------|
| U1 | Adopt `appConfig.styles` — import `const s = appConfig.styles`, replace all 20+ hardcoded teal/gradient/animation instances with tokens (`s.primaryGradient`, `s.primaryGradientHover`, `s.linkColor`, `s.linkHover`, `s.headerIconGradient`, `s.btnAnimation`, `s.btnAnimationSubtle`) | **P0** | 40 min | §1 |
| U2 | Replace manual stats cards with `StatsCardGrid` component — pass 4 stats with `onClick` for filtering, use `s.statsActive.*` tokens for active state differentiation | **P1** | 45 min | §3 |
| U3 | Add visual active state to stats cards — when a filter is active (e.g., "Active"), the corresponding card should have a highlighted border/bg (currently all look the same) | **P1** | 20 min | §3 |
| U4 | Replace text-only loading with layout-matching skeleton — stats skeleton grid + card skeleton placeholders | **P1** | 30 min | §8 |
| U5 | Add filter chips — show "Status: Active [×]", "Search: opening [×]" badges below filters, with "Clear all" link | **P1** | 40 min | §5 |
| U6 | Migrate to shared `EmptyState` component — replace 3 inline empty states (grid, items, history) | **P2** | 20 min | §11 |
| U7 | Fix action button sizing — change History to `size="sm"` (with text), Edit/Delete to `size="icon" h-8 w-8` for consistency with Bible §4.4 | **P2** | 10 min | §6, §10 |
| U8 | Fix stat values `text-3xl` anti-pattern — change `text-2xl md:text-3xl` to `text-2xl` consistently | **P2** | 5 min | §9 |
| U9 | Fix dialog title sizing — change `text-2xl` override on `DialogTitle` to default `text-lg font-semibold` | **P2** | 5 min | §9 |
| U10 | Add filter hint below stats grid — `text-[11px]` "Click a card to filter the list below" | **P3** | 5 min | §3 |
| U11 | Add card tinting — active checklists with subtle green-left-border, inactive with gray-left-border | **P3** | 15 min | §6 |
| U12 | Tokenize drag border color — replace `rgb(20 184 166)` inline style with CSS variable or token reference | **P3** | 5 min | §1 |
| U13 | Add completion rate badge on card — show latest week's completion % as a small badge | **P3** | 30 min | Premium |

---

## 11. TODO Table: Functionality Improvements

| # | Task | Priority | Effort | Notes |
|---|------|----------|--------|-------|
| F1 | Extract `ChecklistFormDialog` component — move create/edit dialog + form state + validation to separate file (~200 lines) | **P1** | 1.5 hr | 939 lines too large; most complex dialog |
| F2 | Extract `ChecklistHistoryDialog` component — move history dialog + stats fetch to separate file (~100 lines) | **P1** | 45 min | Further reduces main page |
| F3 | Batch item update API — replace delete-all-then-recreate with `upsertChecklistItems()` that preserves item IDs for edit, only adds/removes changed items | **P1** | 2 hr | Fixes completion history breakage |
| F4 | Move orphan cleanup to API layer — move direct `supabase` orphan instance queries into `checklists-v2` API | **P2** | 30 min | Eliminates mixed data access anti-pattern |
| F5 | Replace `window.history.back()` with `router.back()` — use Next.js router for consistent navigation | **P2** | 5 min | Bible compliance |
| F6 | Add error state UI — error card with retry button when `loadChecklists()` fails (currently just toast) | **P2** | 30 min | Better UX on failure |
| F7 | Extract `useChecklistForm` hook — encapsulate form state, items state, validation, save logic | **P2** | 1 hr | Separates form logic from page |
| F8 | Add `type: 'as any as'` type fix — create proper type for API response to avoid `data as any as ChecklistWithItems[]` cast | **P2** | 20 min | Type safety |
| F9 | Persist drag reorder to DB — currently items only reorder locally until dialog save; if user closes without saving, reorder is lost. Consider auto-saving reorder. | **P3** | 1 hr | UX improvement for large checklists |
| F10 | Add duplicate/clone checklist — "Save as template" or clone button to quickly create variations | **P3** | 1 hr | Power user feature |

---

*Review updated: February 9, 2026 — Version 2.0 (Checklist-scored rewrite)*
