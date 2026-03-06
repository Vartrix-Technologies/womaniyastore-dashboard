# File Review: src/app/(protected)/me/page.tsx

**Last Updated**: February 9, 2026  
**Lines of Code**: 96 orchestrator + ~1,064 across 3 child components (~1,160 total)  
**Version**: 2.0 (Checklist-scored rewrite)  
**Checklist Score**: **21/40** — needs rework (borderline)  
**Applicable Sections**: 8 of 12 (Staff dashboard — Stats Cards, Date Filtering, Filter Toolbar, Table/Pagination are N/A)  
**Recent Changes**: Minimal since v1.0 — page was already a thin presentation layer. No significant refactor.

---

## 1. File Responsibility

**Primary Purpose**: Staff personal dashboard — thin orchestrator rendering attendance status, daily task checklists, and attendance history calendar via 3 dedicated child components.

**Role in the System:**  
Entry point for non-admin staff after login. Displays current shift status (clock in/out), today's assigned checklists (with real-time completion), and collapsible attendance calendar history. All business logic lives in child components.

**What This File Intentionally Does NOT Do:**
- Does NOT fetch data — all data loading delegated to `AttendanceCard`, `TaskChecklistCard`, `AttendanceCalendar`
- Does NOT mutate state — clock in/out handled by `AttendanceCard`, checklist toggle by `TaskChecklistCard`
- Does NOT handle other staff data — strictly current user's personal dashboard
- Does NOT use `appConfig` — hardcoded teal on 2 icons (known debt)

**Key Dependencies:**
| Dependency | Purpose |
|-----------|---------|
| `@/components/staff/AttendanceCard` | Clock in/out widget with live elapsed timer (201 lines) |
| `@/components/staff/TaskChecklistCard` | Daily checklist with real-time completion + 30s auto-refresh (367 lines) |
| `@/components/staff/AttendanceCalendar` | Monthly calendar + stats + details dialog + edit/delete (496 lines) |
| `@/context/AuthContext` | `profile.full_name` for personalized greeting |
| `@/components/ui/accordion` | **Imported but unused** ❌ — `Accordion`, `AccordionContent`, `AccordionItem`, `AccordionTrigger` |
| `lucide-react` — `Calendar` | Icon for attendance history section |

### Child Component Summary

| File | Lines | Patterns | Notable |
|------|-------|----------|---------|
| `AttendanceCard.tsx` | 201 | Self-contained CRUD + live timer | `setInterval` every 1s for elapsed time, `font-mono text-primary` clock display |
| `TaskChecklistCard.tsx` | 367 | Dual render modes + auto-refresh | `compact` + `showCompactSummary` props, 30s polling, checkbox toggle with `updatingItems` Set, **duplicate dead code** |
| `AttendanceCalendar.tsx` | 496 | Calendar grid + stats sidebar + dialogs | `Promise.all` for parallel load, color-coded day cells, `AttendanceEditDialog` + `AttendanceDeleteDialog`, admin edit gating |

---

## 2. Execution Flow

### Initial Load Sequence
1. Component mounts → read `profile.full_name` from AuthContext
2. Render header with personalized greeting
3. Render `AttendanceCard` and `TaskChecklistCard` in responsive grid (each fetches own data independently)
4. Render collapsed attendance history card (`showCalendar = false` by default)

### State Management — Single Boolean
```
showCalendar: false → "View History" card with Calendar icon
showCalendar: true  → Full AttendanceCalendar component mounted
```
- `AttendanceCalendar` only mounts when expanded — lazy load for performance ✅
- No URL persistence — resets on page revisit

### Child Component Data Flow

| Component | Data Fetch | Trigger | Refresh Mechanism |
|-----------|-----------|---------|-------------------|
| `AttendanceCard` | `getTodayAttendance(userId)` | `useEffect` on mount | Manual after clock in/out |
| `TaskChecklistCard` | `getTodaysChecklists(shopId, today)` | `useEffect` + 30s polling | `setInterval(loadChecklists, 30000)` |
| `AttendanceCalendar` | `Promise.all([getMonthlyAttendance, getAttendanceStats])` | When mounted + month change | After edit/delete |

### TaskChecklistCard — Dual Render Pattern
```tsx
// In header — compact summary badge only
<TaskChecklistCard showCompactSummary={true} />

// In content area — full checklist items
<TaskChecklistCard compact={true} />
```
**Note:** Two separate component instances = two separate `useEffect` → two separate API calls for the same data. Could be optimized with context/shared state.

---

## 3. Business Rules & Assumptions

**Explicit Rules:**
| Rule | Implementation | Location |
|------|----------------|----------|
| Personalized greeting | Falls back to "Staff Member" if no name | Main page L22 |
| Calendar lazy load | Only mounts when `showCalendar` is true | Main page L50–90 |
| Live elapsed time | Updates every second while clocked in | AttendanceCard `setInterval` |
| Net work time | Subtracts break minutes from elapsed | AttendanceCard L35 |
| Checklist auto-refresh | Polls every 30 seconds | TaskChecklistCard L38 |
| Completion celebration | Green banner with emoji when all items complete | TaskChecklistCard L320 |
| Calendar edit/delete | Only admin/owner can edit attendance records | AttendanceCalendar `canEdit` |

**Implicit Assumptions:**
- User is authenticated (protected route)
- Staff role has access to `/me` route
- Children handle their own loading/error states
- Single-user scope — no manager/team views
- `TaskChecklistCard` rendered twice creates duplicate API calls (performance concern)
- Clock-out has no confirmation dialog (instant action)

---

## 4. PAGE_ANALYSIS_CHECKLIST — Detailed Scoring

> **Note:** This is a **staff-facing personal dashboard**, not an admin data page. Sections §3 (Stats Cards), §4 (Date Filtering), §5 (Filter Toolbar), §6 (Table & Data Display) are **N/A**. Scoring includes the orchestrator page AND all 3 child components as a system.

### ✅ = Pass · ⚠️ = Partial · ❌ = Fail · N/A = Not Applicable

### §1 Config-Driven Theming — **3/10** ❌

| Check | Status | Detail |
|-------|--------|--------|
| Imports `appConfig`, aliases `const s = appConfig.styles` | ❌ | Not imported on main page or ANY child component |
| Gradients use `s.primaryGradient` | N/A | No gradient buttons on main page or AttendanceCard. Children use default shadcn Button styles |
| Icon colors use tokens | ❌ | `text-teal-600` on Calendar icon (L54, L76) — 2 hardcoded teal instances |
| Hover states use tokens | ❌ | N/A for most elements — children use default hover styles |
| Button animations use `s.btnAnimation` | ⚠️ | `hover:scale-105 active:scale-95 transition-all` present (L64, L83) — correct behavior but hardcoded, should be `s.btnAnimation` token |
| Zero hardcoded teal classes | ❌ | **2 instances** on main page. Children have zero teal/gradient — use neutral `text-primary` and default shadcn (rare positive) |

**Note:** Children are remarkably theme-neutral — `AttendanceCard` uses `text-primary` for the live clock, default Badge variants, default Button colors. This means fewer tokens to replace vs. other pages, but also less brand personality.

### §2 Page Header — **5/10** ⚠️

| Check | Status | Detail |
|-------|--------|--------|
| Heading `text-2xl font-bold` | ✅ | L20 `text-2xl font-bold tracking-tight` |
| Subtitle `text-sm text-muted-foreground` | ✅ | L21 with personalized greeting |
| Icon next to heading | ❌ | No icon — just plain "My Dashboard" text |
| Gradient icon badge | ❌ | No badge wrapper — no icon at all |
| Header responsive layout | ✅ | Simple `div` with `space-y-1` — adequate for text-only header |
| No back button needed | ✅ | `/me` is a top-level staff route — correct |
| Personalized greeting | ✅ | "Welcome back, {name}!" with fallback — premium touch |

### §3 Stats Cards — **N/A**
Stats live inside `AttendanceCalendar` sidebar, not page-level. The main page has no stats display.

### §4 Date Filtering — **N/A**
No date filtering on this page. Calendar has month navigation (handled internally).

### §5 Filter Toolbar & Chips — **N/A**
No filtering on staff dashboard.

### §6 Table & Data Display — **N/A**
Uses card-based layouts, not tables. No pagination needed.

### §7 Dialogs & Sheets — **5/10** ⚠️

| Check | Status | Detail |
|-------|--------|--------|
| AttendanceCalendar details Dialog | ✅ | `Dialog` with `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription`, `DialogFooter` |
| `AttendanceEditDialog` | ✅ | Shared admin component reused for calendar edit |
| `AttendanceDeleteDialog` | ✅ | Shared admin component for soft-delete |
| Role-gated edit/delete | ✅ | `canEdit = profile?.role === 'admin' \|\| profile?.role === 'owner'` — staff can only view, not edit |
| No `ConfirmDialog` for clock-out | ⚠️ | Clock-out is instant with no confirmation — `variant="destructive"` but one-click. Less risky than delete, but could be accidental |
| Unused `Accordion` import | ❌ | `Accordion`, `AccordionContent`, `AccordionItem`, `AccordionTrigger` imported but never used — dead code |
| No premium `p-0` dialog pattern | ❌ | Standard dialog styling |
| No `FieldError` validation | N/A | No form input on main page — children handle clock in/out as button-only |

### §8 Mobile Responsiveness — **7/10** ✅

| Check | Status | Detail |
|-------|--------|--------|
| Page wrapper `space-y-4 md:space-y-6` | ✅ | L18 |
| Grid collapses | ✅ | `grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6` (L28) |
| Calendar responsive | ✅ | `aspect-square` cells, `md:` breakpoints throughout, responsive text sizes |
| Task list scrollable | ✅ | `max-h-[500px] overflow-y-auto` prevents page overflow |
| Touch targets adequate | ✅ | Clock in/out `size="lg" w-full` buttons, checkboxes with `p-2`/`p-3` tap areas |
| Attendance history card responsive | ✅ | `flex-col sm:flex-row` for collapsed state |
| *(Deduction)* No loading skeleton | ⚠️ | No skeleton on main page. Children show text-only loading ("Loading checklists...", "Loading calendar...") — not skeleton ❌ |
| *(Deduction)* No skeleton for AttendanceCard initial load | ⚠️ | No visible loading state while `getTodayAttendance()` fetches |

### §9 Typography — **7/10** ✅

| Check | Status | Detail |
|-------|--------|--------|
| Page heading `text-2xl font-bold` | ✅ | L20 |
| Card titles `text-lg` | ✅ | Consistent across AttendanceCard + Daily Tasks |
| Body text `text-sm` | ✅ | Descriptions, muted text, status labels |
| Font hierarchy clear | ✅ | Heading → Card title → Body → Muted |
| `font-mono` for elapsed time | ✅ | AttendanceCard L165: `font-mono text-lg font-bold text-primary` |
| Badge variants used correctly | ✅ | Status badges: `default` (active), `secondary` (inactive), `outline` (not started) |
| *(Deduction)* No `tabular-nums` on numeric displays | ⚠️ | Calendar stats (Days Present, Total Hours, Avg Hours) are plain — should use `tabular-nums` for alignment |
| *(Deduction)* Calendar day text tiny on mobile | ⚠️ | `text-[8px]` badge on calendar days — very small, may be hard to read |

### §10 Interactions & Touch — **6/10** ⚠️

| Check | Status | Detail |
|-------|--------|--------|
| **Live elapsed timer** | ✅ | Updates every second — premium real-time display |
| Button animations on View History/Hide | ✅ | `hover:scale-105 active:scale-95 transition-all` — correct pattern, just not tokenized |
| Checkbox completion with optimistic tracking | ✅ | `updatingItems` Set prevents double-toggle |
| Progress bars on checklists | ✅ | `Progress` component with percentage display |
| Completion celebration 🎉 | ✅ | Green banner: "All tasks completed! Great work!" — premium touch |
| Auto-refresh 30s polling | ✅ | `TaskChecklistCard` auto-polls for team real-time updates |
| Clock in/out `size="lg" w-full` | ✅ | Large touch targets for primary actions |
| Calendar day interaction | ✅ | Click to select → details card/dialog |
| *(Deduction)* No `ConfirmDialog` for clock-out | ⚠️ | Destructive button with no confirmation — could be accidental tap |
| *(Deduction)* No CTA animations on Clock In button | ⚠️ | Clock In is the most important action but has no gradient or animation |
| *(Deduction)* Calendar loading text-only | ⚠️ | "Loading calendar..." instead of skeleton grid |

### §11 Empty & Error States — **4/10** ❌

| Check | Status | Detail |
|-------|--------|--------|
| Compact empty state (tasks) | ✅ | Calendar icon + "All caught up! No tasks scheduled for today." |
| Attendance "not started" state | ✅ | Badge "Not Started" + Clock In button — functional |
| Calendar "No data available" | ⚠️ | Plain text — no icon, no visual styling |
| **Duplicate dead code** | ❌ | TaskChecklistCard has **3** `if (checklists.length === 0)` blocks — L100 returns compact summary badge, L126 returns compact empty, BUT L147 is **unreachable dead code** (duplicate empty check after the compact early return) |
| Uses shared `EmptyState` component | ❌ | All inline empty states — not using shared `EmptyState` |
| Loading states | ❌ | "Loading checklists..." and "Loading calendar..." text-only — no skeleton |
| AttendanceCard loading | ❌ | No visible loading state during initial `getTodayAttendance()` fetch |
| Error state on failure | ⚠️ | Toast-only error handling (`toast.error(...)`) — no visual error card with retry |
| Toast feedback on actions | ✅ | Clock in/out, checklist toggle — all have toasts |

### §12 Core Rules — **7/10** ✅

| Check | Status | Detail |
|-------|--------|--------|
| No `confirm()` / `alert()` / `prompt()` | ✅ | Zero instances across all 4 files |
| `Promise.all` in calendar | ✅ | Parallel `getMonthlyAttendance` + `getAttendanceStats` in AttendanceCalendar |
| Toast via sonner | ✅ | Consistent throughout all children |
| Auto-refresh polling | ✅ | 30s interval in TaskChecklistCard |
| Clean interval on unmount | ✅ | Both AttendanceCard timer and TaskChecklistCard polling clear intervals |
| Color-coded calendar cells | ✅ | Green (present) / yellow (ongoing) / accent (hover) |
| No back button (correct) | ✅ | Top-level route `/me` — not a sub-page |
| *(Deduction)* Unused Accordion import | ❌ | Dead import — 4 components imported but never used |
| *(Deduction)* `TaskChecklistCard-old.tsx` still exists | ❌ | Dead file in `src/components/staff/` — should be deleted |
| *(Deduction)* Duplicate empty state checks | ❌ | 3 `checklists.length === 0` checks, one unreachable |
| *(Deduction)* Spelling error "Calender View" | ⚠️ | AttendanceCalendar L224 — should be "Calendar View" |
| *(Deduction)* Dual TaskChecklistCard = duplicate API calls | ⚠️ | Two instances with `showCompactSummary` and `compact` each trigger their own `useEffect` → two API calls for the same data |

---

## 5. Checklist Score Summary

> Scoring prorated for 8 applicable sections (§3, §4, §5, §6 are N/A).

| Metric | Score | Notes |
|--------|-------|-------|
| Config compliance (no hardcoded colors) | **3/10** | No `appConfig`. Only 2 teal instances (lowest among reviewed pages) + 2 hardcoded animations. Children use neutral shadcn defaults. |
| Mobile responsiveness | **7/10** | Good grid collapse, responsive calendar, scrollable tasks. No skeleton loading anywhere — text-only. |
| Design consistency | **5/10** | No gradient badge, no header icon, unused Accordion import, duplicate dead code, inline empty states, text-only loading. |
| Interaction quality | **6/10** | Live timer ✅, progress bars ✅, auto-refresh ✅, completion celebration ✅. No clock-out confirm, no CTA animation, no skeleton. |
| **Overall** | **21/40** | **Needs rework** (borderline with "needs polish") |

---

## 6. What Changed Since v1.0 Review

| Area | v1.0 (85 lines noted) | v2.0 (96 lines) | Status |
|------|----------------------|------------------|--------|
| File size | ~85 lines | 96 lines (+11) | Minimal growth |
| Architecture | Thin presentation layer | Still thin — correct pattern | ✅ Unchanged (was already good) |
| Component delegation | AttendanceCard + TaskChecklistCard + AttendanceCalendar | Same 3 children | ✅ Unchanged |
| `appConfig` tokens | Not used | Still not used | ❌ Still open |
| Unused Accordion import | Flagged | Still present | ❌ Still open |
| Empty state quality | Inline, basic | Still inline, basic | ❌ Still open |
| Loading states | Text-only | Still text-only | ❌ Still open |
| Calendar spelling | "Calender View" | Still misspelled | ❌ Still open |
| `TaskChecklistCard-old.tsx` | Not flagged | Dead file still exists | ❌ New finding |
| Duplicate API calls | Not flagged | 2 TaskChecklistCard instances = 2 API calls | ❌ New finding |
| Duplicate dead code | Not flagged | 3 empty state checks, one unreachable | ❌ New finding |

---

## 7. Key Differences from Other Pages

### 7.1 Staff-Facing (Not Admin)
This is the only **staff-facing dashboard page** in the codebase. All other reviewed pages are admin modules. Different user persona — staff want quick clock in/out and task completion, not data analysis or configuration.

### 7.2 Ultra-Lean Orchestrator
At 96 lines, this is the **thinnest page** in the entire app. Even POS (328 lines) and settings (250 lines) are heavier. The page is pure presentation — zero CRUD, zero data fetching, zero state beyond a single boolean toggle.

### 7.3 Live Elapsed Timer (Unique)
Only component in the codebase with a 1-second `setInterval` for real-time display. `AttendanceCard` shows `HH:MM:SS` elapsed work time, subtracting break minutes. Premium pattern documented in Bible §10.

### 7.4 Auto-Refresh Polling (Unique)
`TaskChecklistCard` uses `setInterval(loadChecklists, 30000)` for real-time team updates. When another staff member completes a checklist item, it appears within 30 seconds. This is the only polling pattern in the codebase.

### 7.5 Dual Component Rendering (Smell)
`TaskChecklistCard` is rendered **twice** with different props:
- `showCompactSummary={true}` → progress badge in card header
- `compact={true}` → full checklist items in card content

Each instance triggers its own `useEffect` → two API calls for the same data. Should be consolidated into a single instance or shared state via context/hook.

### 7.6 No Brand Theme Colors in Children
Uniquely among all pages, the child components (`AttendanceCard`, `TaskChecklistCard`) have **zero teal/gradient/brand color** usage. They rely entirely on shadcn defaults (`text-primary`, `default`/`secondary`/`outline` Badge variants). This means the staff experience lacks the teal brand personality present on every admin page.

### 7.7 Calendar Reuse (Admin + Staff)
`AttendanceCalendar` serves dual purposes via props:
- Staff view (`/me`): Shows own calendar, no edit/delete
- Admin view (attendance page): Shows selected staff member, with edit/delete via `canEdit` gating

This is good component reuse but means the component is 496 lines to handle both modes.

---

## 8. Cross-Reference: Bible Compliance

| Bible Section | Status | Gap |
|--------------|--------|-----|
| §2.1 Token reference | ❌ | No `appConfig` — 2 hardcoded teal on main page. Children have zero brand colors. |
| §4.1 Button animation tokens | ⚠️ | `hover:scale-105 active:scale-95` present but hardcoded — should be `s.btnAnimation` |
| §7.3 Page header pattern | ❌ | No icon, no gradient badge. Just plain text heading. |
| §9.3 Shared `EmptyState` | ❌ | All inline empty states |
| §9.4 Inline empty states | ⚠️ | Present but inconsistent quality — some have icons, some plain text |
| §10 Premium features | ✅ | Live timer + auto-refresh + completion celebration = premium patterns |
| §11 Component table | ❌ | Staff dashboard components NOT yet listed in Bible §11 |
| §12 Anti-patterns | ⚠️ | No `confirm()` ✅, no `animate-spin` spinner — but text-only loading ❌ |
| §12 Cleanup | ❌ | `TaskChecklistCard-old.tsx` dead file not listed in Bible cleanup table |
| §13 Phase 1 tasks | ❌ | Me-page token migration NOT yet listed in Phase 1 |

---

## 9. Risks & Edge Cases

| Risk | Severity | Description |
|------|----------|-------------|
| Duplicate API calls | **Medium** | Two `TaskChecklistCard` instances → two `getTodaysChecklists()` calls + two 30s polling intervals. Wasteful. |
| Duplicate dead code | **Medium** | TaskChecklistCard has 3 `checklists.length === 0` checks — L147 block is unreachable after L126 early return |
| No clock-out confirmation | **Medium** | `variant="destructive"` button with no `ConfirmDialog` — accidental tap possible on tablet |
| `TaskChecklistCard-old.tsx` dead file | **Low** | 367 unused lines sitting in `src/components/staff/` — confusion risk |
| Unused Accordion import | **Low** | Dead import adds to bundle — unused `Accordion`/`AccordionContent`/`AccordionItem`/`AccordionTrigger` |
| Spelling error "Calender" | **Low** | AttendanceCalendar L224 — visible to users, looks unprofessional |
| No loading state for AttendanceCard | **Low** | Initial fetch shows nothing while API call completes — brief flash |
| No offline handling | **Low** | Clock in/out fails silently if offline — no offline queue for attendance |
| Calendar month boundary | **Low** | Stats sidebar shows monthly data — no cross-month comparison |

---

## 10. TODO Table: UI/UX Improvements

| # | Task | Priority | Effort | Checklist Ref |
|---|------|----------|--------|---------------|
| U1 | Adopt `appConfig.styles` — import `const s = appConfig.styles`, replace 2 hardcoded `text-teal-600` with `s.linkColor`, replace 2 `hover:scale-105 active:scale-95 transition-all` with `s.btnAnimation` | **P0** | 10 min | §1 |
| U2 | Add gradient icon badge to header — wrap suitable icon (e.g., `LayoutDashboard` or `User`) in `p-2.5 rounded-lg ${s.headerIconGradient} text-white shadow-md` | **P1** | 10 min | §2 |
| U3 | Add gradient CTA to Clock In button — `className={s.primaryGradient}` to make it the visual anchor of the page | **P1** | 5 min | §10 |
| U4 | Replace text-only loading in TaskChecklistCard with skeleton — animated `div` blocks matching checklist item layout | **P1** | 20 min | §8, §11 |
| U5 | Replace text-only loading in AttendanceCalendar with skeleton grid — 7×5 pulse grid matching calendar layout | **P1** | 20 min | §8, §11 |
| U6 | Add loading skeleton to AttendanceCard — show pulse blocks for status badge + time rows during initial fetch | **P2** | 15 min | §8, §11 |
| U7 | Migrate inline empty states to shared `EmptyState` component — tasks "All caught up" + calendar "No data" | **P2** | 15 min | §11 |
| U8 | Add `tabular-nums` to calendar stats (Days Present, Total Hours, Avg Hours) and AttendanceCard elapsed time | **P2** | 5 min | §9 |
| U9 | Add brand accent to AttendanceCard — e.g., teal border-left or status icon with `text-teal-600` when clocked in | **P3** | 10 min | §1 |
| U10 | Restyle staff placeholder into richer "Daily Tasks" card empty state — icon + motivational message when no checklists exist | **P3** | 10 min | §11 |
| U11 | Consider time-of-day greeting — "Good morning/afternoon/evening, {name}!" based on `new Date().getHours()` | **P3** | 5 min | Polish |

---

## 11. TODO Table: Functionality Improvements

| # | Task | Priority | Effort | Notes |
|---|------|----------|--------|-------|
| F1 | **Consolidate dual `TaskChecklistCard`** — extract a `useTaskChecklists(shopId)` hook that both instances share, OR render once and pass data up for summary badge. Eliminates duplicate API calls + duplicate 30s polling. | **P0** | 1 hr | Performance — 2 API calls + 2 intervals for same data |
| F2 | **Remove dead code in `TaskChecklistCard`** — delete unreachable `checklists.length === 0` block at L147 (after compact early return at L126) | **P0** | 5 min | Code quality |
| F3 | **Delete `TaskChecklistCard-old.tsx`** — dead file, 367 unused lines | **P0** | 2 min | Cleanup |
| F4 | **Remove unused Accordion import** — 4 components imported but never used on main page | **P0** | 2 min | Bundle size + code quality |
| F5 | **Fix "Calender" → "Calendar"** spelling in `AttendanceCalendar.tsx` L224 | **P0** | 1 min | User-visible typo |
| F6 | Add `ConfirmDialog` for clock-out — "End your shift? You worked {elapsed}" with confirm/cancel | **P1** | 15 min | Prevent accidental clock-out |
| F7 | Add weekly hours summary stat to header — "X hours this week" computed from recent attendance | **P2** | 45 min | Staff engagement — premium feel |
| F8 | Add mini 7-day attendance preview inline — green/red/gray dots for last 7 days without expanding full calendar | **P2** | 1 hr | Reduce need to expand calendar for quick status check |
| F9 | Persist `showCalendar` state in `localStorage` or URL param — avoids re-expanding every page revisit | **P3** | 10 min | UX memory |
| F10 | Add completion streaks — "🔥 12 days on time!" — gamification from attendance records | **P3** | 1.5 hr | Staff engagement |
| F11 | Implement `useCalendar` shared state to avoid re-fetching attendance data when toggling calendar visibility | **P3** | 30 min | Performance optimization |

---

*Review updated: February 9, 2026 — Version 2.0 (Checklist-scored rewrite)*
