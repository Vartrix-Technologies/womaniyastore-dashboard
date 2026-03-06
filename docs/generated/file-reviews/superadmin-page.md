# File Review: superadmin/ (v2.0 — Checklist-Scored)

> **Reviewed:** February 9, 2026
> **Checklist version:** PAGE_ANALYSIS_CHECKLIST v2.0
> **Bible version:** DESIGN_SYSTEM_BIBLE v2.0+
> **Score: 20 / 40 — ⚠️ Needs Rework**

---

## Files in Scope

| File | Lines | Purpose |
|------|-------|---------|
| `src/app/(protected)/superadmin/page.tsx` | 617 | Main dashboard: system health, sync metrics, quick actions, UserManagement tab |
| `src/app/(protected)/superadmin/layout.tsx` | 45 | Role guard — redirects non-superadmin, blocks render |
| `src/app/(protected)/superadmin/sync-issues/page.tsx` | 256 | Failed/pending offline sales management — retry, delete, clear |
| `src/components/admin/UserManagement.tsx` | 754 | User CRUD via Edge Function — create, reset password, toggle active |

**Total:** ~1,672 lines across 4 files

---

## §1. Config-Driven Theming — 1 / 5

| Check | Status | Detail |
|-------|--------|--------|
| `appConfig` imported | ✅ | `page.tsx` L33: `import { appConfig } from '@/lib/config'` |
| `const s = appConfig.styles` | ❌ | **Never declared** — only `appConfig.internal.idbName` used (L77) |
| `s.primaryGradient` used | ❌ | 1× hardcoded `from-teal-500 to-cyan-600` on Force Sync button (L585) |
| `s.headerIconGradient` used | ❌ | Header uses `from-purple-500 to-pink-500` — **violates brand** |
| `s.btnAnimation` used | ❌ | 3× hardcoded `hover:scale-105 active:scale-95 transition-all` |
| `s.linkColor` / `s.linkHover` used | ❌ | No link tokens |
| Token usage in children | ❌ | sync-issues: 0 tokens, UserManagement: 0 tokens |

**Hardcoded color inventory:**
- **page.tsx:** `from-purple-500 to-pink-500` (header), `bg-green-500` (badge), `border-orange-200 bg-orange-50` (banner), `text-orange-900` ×3, `from-teal-500 to-cyan-600` ×1, 6× quickAction gradients, `hover:scale-105 active:scale-95` ×3
- **sync-issues:** `from-teal-500 to-cyan-600` ×1, `hover:scale-105 active:scale-95` ×3, `text-green-500` ×1
- **UserManagement:** `from-teal-500 to-cyan-600` ×1, `from-teal-400 to-cyan-500` ×1, `bg-gray-400` ×1, `text-orange-600 border-orange-300` ×1, `bg-orange-50 border-orange-200 text-orange-800` ×1, `data-[state=checked]:bg-green-500` ×1

**Total hardcoded instances: ~25+ across all files, 0 tokens used.**

---

## §2. Page Header — 1 / 3

| Check | Status | Detail |
|-------|--------|--------|
| Gradient icon badge | ⚠️ | Present but uses `from-purple-500 to-pink-500` — **brand violation** (Bible §1: "No pink/rose colors") |
| `text-2xl font-bold` heading | ✅ | "System Dashboard" L386 |
| Subtitle with context | ✅ | "Superadmin • {full_name}" L388 |
| Back button | N/A | Top-level page, not needed |

**Critical:** Header gradient must change from purple-pink to `s.headerIconGradient` (teal-cyan).

---

## §3. Stats Cards — 1 / 4

| Check | Status | Detail |
|-------|--------|--------|
| Stats present | ✅ | 2× Sync Metrics cards (Pending Syncs, Failed Syncs) + 4× Health Check items |
| Uses `StatsCardGrid` | ❌ | Custom card grid implementation |
| Active toggle filtering | ❌ | No clickable filter behavior |
| Token-driven colors | ❌ | Status colors hardcoded (`bg-green-500`, emoji indicators `✓ ⚠ ✗`) |
| Conditional link badges | ✅ | "View" button appears when metric > 0, links to sync-issues |

---

## §4. Date Filtering — N/A

System monitoring page — no date-based data filtering applicable.

---

## §5. Filter Toolbar & Chips — N/A

No filter/search functionality needed on this page.

---

## §6. Table & Data Display — 3 / 5

| Check | Status | Detail |
|-------|--------|--------|
| Card-based layout | ✅ | Health checks as bordered rows, sync metrics as stat cards, quick actions as card grid |
| Quick actions grid responsive | ✅ | `grid gap-4 md:grid-cols-2 lg:grid-cols-3` |
| Sync-issues card list | ✅ | Failed sales shown as destructive-bordered cards with inline item table |
| UserManagement card list | ✅ | Users as cards with avatar, badges, dropdown actions |
| Server-side pagination | N/A | Small datasets (health status, sync queue) |
| Disabled items filtered | ✅ | `quickActions.filter((a) => !a.disabled)` — "Coming Soon" items not rendered |

---

## §7. Dialogs & Sheets — 2 / 4

| Check | Status | Detail |
|-------|--------|--------|
| `ConfirmDialog` for destructive actions | ⚠️ | sync-issues ✅ (delete, clear all). **Main page ❌** — Force Sync has no confirm. **UserManagement ❌** — toggle active has no confirm |
| Dialog form pattern | ✅ | UserManagement: Create User + Reset Password dialogs with icon-labeled inputs |
| `DialogDescription` present | ✅ | Both dialogs include description text |
| Premium `p-0` pattern | ❌ | Standard dialog layout |
| Backdrop blur | ❌ | Default overlay |
| Loading state in submit | ✅ | Loader2 spinner during create/reset |

---

## §8. Mobile Responsiveness — 3 / 4

| Check | Status | Detail |
|-------|--------|--------|
| Root `space-y-4 md:space-y-6` | ✅ | L382 |
| Health cards flex responsive | ✅ | `flex-col sm:flex-row sm:items-center` |
| Tabs responsive | ✅ | `grid w-full grid-cols-2 lg:w-auto lg:inline-flex` |
| Quick actions grid scales | ✅ | `md:grid-cols-2 lg:grid-cols-3` |
| Sync metrics mobile | ✅ | `grid gap-4 grid-cols-2` |
| Dialog mobile scroll | ✅ | `max-h-[90vh] overflow-y-auto` on Create User dialog |
| Action Required responsive | ⚠️ | `flex items-center justify-between` — may wrap awkwardly on small screens |

---

## §9. Typography — 3 / 3

| Check | Status | Detail |
|-------|--------|--------|
| Page heading `text-2xl font-bold` | ✅ | L386 |
| Card titles `text-lg font-semibold` | ✅ | Throughout |
| Secondary text `text-sm`/`text-xs` | ✅ | Descriptions, metric labels, last tested timestamp |
| Mono for data | N/A | No code/QR display on this page |
| No `text-3xl` | ✅ | Clean |

---

## §10. Interactions & Touch — 2 / 3

| Check | Status | Detail |
|-------|--------|--------|
| Button hover + active feedback | ✅ | `hover:scale-105 active:scale-95 transition-all` on test/sync/action buttons |
| Card hover elevation | ✅ | Sync metrics: `hover:shadow-md`, Quick actions: `hover:shadow-lg hover:scale-105` |
| Transitions smooth | ✅ | `transition-all` on all interactive elements |
| Using `s.btnAnimation` token | ❌ | All hardcoded — should be `s.btnAnimation` |
| Touch targets ≥44px | ✅ | Buttons use standard sizing |

---

## §11. Empty & Error States — 1 / 3

| Check | Status | Detail |
|-------|--------|--------|
| Initial loading state | ❌ | Health checks show "Unknown" badges on mount — no skeleton placeholder |
| Sync-issues empty state | ⚠️ | Custom: CheckCircle2 icon + "All Clear!" message. **Not using `EmptyState` component** |
| UserManagement empty state | ⚠️ | Custom: User icon + "No users found" + CTA button. **Not using `EmptyState` component** |
| UserManagement loading | ✅ | `Skeleton` components (avatar circle + text blocks) |
| Error boundaries | ❌ | No error state for failed health checks beyond badge status |

---

## §12. Core Rules — 3 / 5

| Rule | Status | Detail |
|------|--------|--------|
| No `confirm()` | ✅ | sync-issues uses `ConfirmDialog`, no native dialogs |
| No `alert()` | ✅ | Uses `toast.*` throughout |
| `toast` for feedback | ✅ | Success/error toasts on all operations |
| Layout `space-y-*` | ✅ | No `container mx-auto p-6` |
| Shared components first | ⚠️ | Uses `ConfirmDialog` in sync-issues, `Skeleton` in UserManagement. But skips `EmptyState` everywhere |
| Parallel data loading | ❌ | Export uses **sequential** queries (5 await chains). Should use `Promise.all()` |
| Brand consistency | ❌ | Purple-pink header gradient violates brand identity |
| `FieldError` for form validation | ❌ | UserManagement uses `toast.error()` for each field — not inline errors |

---

## Scoring Summary

| # | Section | Score | Max | Notes |
|---|---------|-------|-----|-------|
| 1 | Config-Driven Theming | 1 | 5 | `appConfig` imported but zero style tokens used |
| 2 | Page Header | 1 | 3 | Present but purple-pink violates brand |
| 3 | Stats Cards | 1 | 4 | Custom metrics, no StatsCardGrid or tokens |
| 4 | Date Filtering | N/A | — | System monitoring, no dates |
| 5 | Filter Toolbar | N/A | — | No filtering needed |
| 6 | Table & Data Display | 3 | 5 | Good card layouts, no tokenization |
| 7 | Dialogs & Sheets | 2 | 4 | ConfirmDialog in sync-issues, missing on main page |
| 8 | Mobile Responsiveness | 3 | 4 | Solid responsive layout throughout |
| 9 | Typography | 3 | 3 | ✅ Consistent scale |
| 10 | Interactions & Touch | 2 | 3 | Present but hardcoded |
| 11 | Empty & Error States | 1 | 3 | Custom inline, not shared components |
| 12 | Core Rules | 3 | 5 | Brand violation, sequential export, no FieldError |
| | **TOTAL** | **20** | **39** | **Normalized: 20 / 40** |

**Verdict: 20/40 — ⚠️ Needs Rework** (threshold: <24)

---

## Key Findings

### What's Good ✅
1. **Tabbed architecture** — System Health + User Management separated cleanly via Tabs
2. **`ConfirmDialog` in sync-issues** — Delete/Clear All properly guarded
3. **`Skeleton` loading in UserManagement** — Correct pattern for card list loading
4. **Responsive layout throughout** — Health cards, tabs, quick actions all scale properly
5. **Health check test buttons** — Interactive system status with response time feedback
6. **Disabled quick actions filtered** — `quickActions.filter((a) => !a.disabled)` prevents rendering stubs
7. **Icon-labeled inputs in UserManagement** — Matches Bible §6.4 pattern (User, Mail, Phone, Key icons)
8. **Conditional Action Required banner** — Good alert UX when sync issues exist
9. **Layout role guard** — `layout.tsx` properly blocks non-superadmin with redirect

### What Needs Work ❌
1. **Purple-pink header gradient** — `from-purple-500 to-pink-500` violates Bible §1 ("No pink/rose colors") and §2.1 (brand = teal-cyan)
2. **Zero style tokens** — `appConfig` imported but `styles` never used. 25+ hardcoded instances across 4 files
3. **Sequential export queries** — 5 await chains should be `Promise.all()` (Bible pattern)
4. **No `ConfirmDialog` on main page** — Force Sync and toggle active are unguarded destructive actions
5. **No `EmptyState` shared component** — Custom inline empty states in sync-issues and UserManagement
6. **No `FieldError` in UserManagement** — Toast-based validation instead of inline field errors
7. **No initial skeleton** — Health checks start as "Unknown" badges with no loading visual
8. **6 different quickAction gradients** — Inconsistent with brand (red, green, blue, cyan-teal, purple, orange)
9. **UserManagement avatar gradient** — `from-teal-400 to-cyan-500` is close but not tokenized
10. **Export filename not sanitized** — Shop name with special characters creates invalid filenames

---

## Bible Cross-Reference — Gaps Identified

| Bible Section | Gap on This Page |
|---------------|------------------|
| §1 Core Rules | Purple-pink gradient violates "No pink/rose colors" |
| §2.1 Color System | Zero `s.*` token usage across all 4 files |
| §6.3 Dirty State | N/A (no form editing on main page) |
| §6.4 Icon-Labeled Fields | ✅ UserManagement adopts this correctly |
| §7.3 Page Header | Header icon gradient wrong color |
| §8 Dialogs | Missing `ConfirmDialog` for Force Sync + toggle active |
| §9.2 Skeleton Loading | No skeleton for initial health check state |
| §9.3 EmptyState | Custom inline instead of shared component |
| §11 Shared Components | UserManagement not documented in Bible |
| §12 Anti-Patterns | Hardcoded gradients, sequential fetches |
| §13 Roadmap | No superadmin tasks in Phase 1 |

---

## TODO: UI/UX

| # | Task | Priority | Effort | Section |
|---|------|----------|--------|---------|
| 1 | Replace header `from-purple-500 to-pink-500` with `s.headerIconGradient` (teal-cyan) | **P0** | XS | §2 |
| 2 | Add `const s = appConfig.styles` and replace all hardcoded teal/gradient/animation in `page.tsx` (~12 instances) | **P0** | S | §1 |
| 3 | Adopt `s.*` tokens in `sync-issues/page.tsx` (~4 hardcoded teal/gradient/animation) | **P0** | XS | §1 |
| 4 | Adopt `s.*` tokens in `UserManagement.tsx` (~4 hardcoded teal/gradient instances) | **P0** | XS | §1 |
| 5 | Replace inline empty state in sync-issues with shared `EmptyState` component | **P1** | XS | §11 |
| 6 | Replace inline empty state in UserManagement with shared `EmptyState` component | **P1** | XS | §11 |
| 7 | Add skeleton placeholders for initial health check state (4 items) | **P1** | S | §11 |
| 8 | Standardize quickAction icon gradients — use brand-consistent palette or make them `s.*` tokens | **P2** | S | §1 |
| 9 | Replace emoji status indicators (✓ ⚠ ✗) with proper icon badges | **P2** | XS | §10 |
| 10 | Add loading skeleton for UserManagement tab (currently blocks on fetch) | **P2** | XS | §9 |
| 11 | Improve Action Required banner mobile layout (button wrapping on small screens) | **P3** | XS | §8 |

## TODO: Functionality

| # | Task | Priority | Effort | Section |
|---|------|----------|--------|---------|
| 1 | Add `ConfirmDialog` to Force Sync button — user should confirm before triggering sync | **P0** | XS | §7 |
| 2 | Add `ConfirmDialog` to UserManagement toggle active — deactivating a user is destructive | **P0** | S | §7 |
| 3 | Parallelize export queries with `Promise.all()` — currently 5 sequential awaits | **P0** | S | §12 |
| 4 | Sanitize shop name in export filename — replace `/\:*?"<>|` with `-` | **P1** | XS | §12 |
| 5 | Add export size warning — count records first, warn if >10k before proceeding | **P1** | S | Core |
| 6 | Adopt `useFormErrors` + `FieldError` in UserManagement Create User dialog — replace toast-based validation | **P1** | M | §6 |
| 7 | Add progress indicator for database export — show step-by-step (1/5, 2/5...) | **P2** | M | Core |
| 8 | Add explicit health check endpoint to edge function — stop relying on error message parsing | **P2** | M | Core |
| 9 | Add auto-refresh toggle for health status (30s interval) | **P2** | S | Core |
| 10 | Implement database import with conflict resolution — or hide the entry from quickActions data | **P3** | L | Core |
| 11 | Extract export/import logic into `useDatabaseBackup` custom hook | **P3** | M | Core |
| 12 | Add `ConfirmDialog` to sync-issues "Sync Now" — mass retry should be confirmed | **P2** | XS | §7 |
