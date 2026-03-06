# Page Analysis Checklist

> Run every item against a page before shipping. Scores at the bottom.
> Reference pages: **Inventory**, **QR Codes**.

---

## 1. Config-Driven Theming

- [ ] Page imports `appConfig` from `@/lib/config` and aliases `const s = appConfig.styles`
- [ ] Gradients use `s.primaryGradient` / `s.primaryGradientHover` — never hardcoded teal classes
- [ ] Header icon badge uses `s.headerIconGradient`
- [ ] Back button / links use `s.linkColor` + `s.linkHover`
- [ ] Stats card active states use `s.statsActive.*` tokens
- [ ] Table row tinting uses `s.rowTint.*` tokens
- [ ] Button animations use `s.btnAnimation` or `s.btnAnimationSubtle`
- [ ] Zero hardcoded `from-teal-*`, `to-cyan-*`, `text-teal-*` outside `app.config.ts`

---

## 2. Page Header

- [ ] Back button: `variant="ghost"` + `s.linkColor` + `s.linkHover`, `-ml-2`, `ArrowLeft` icon
- [ ] Gradient icon badge: `p-2.5 rounded-lg ${s.headerIconGradient} text-white shadow-md` with `h-6 w-6` icon
- [ ] Title row: `flex items-center gap-3` → badge + heading (`text-2xl font-bold`) + subtitle (`text-sm text-muted-foreground`)
- [ ] Action buttons sit right-aligned in the title row on desktop, stack below on mobile

---

## 3. Stats Cards (Inline Buttons)

- [ ] Uses inline `<button>` elements in `grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-3`
- [ ] Each card: `rounded-lg border p-3 md:p-4 text-left transition-all cursor-pointer`
- [ ] Active state: `border-l-4 shadow-sm` + `s.statsActive.{status}.border` + `s.statsActive.{status}.bg`
- [ ] Inactive-while-filtered: `opacity-50 hover:opacity-80 hover:bg-muted/50`
- [ ] Default (nothing filtered): `hover:shadow-md hover:bg-muted/50`
- [ ] Click toggles: same card deselects, different card switches, resets pagination
- [ ] Filter hint below grid: `text-[11px] text-muted-foreground/60` with `Filter` icon

---

## 4. Date Filtering (`DateRangeFilter`)

- [ ] Uses shared `DateRangeFilter` component — not custom buttons
- [ ] Paired with `useDateFilter()` hook from `@/hooks`
- [ ] Grid: `grid-cols-3 sm:grid-cols-5` — presets wrap into 2 rows on mobile
- [ ] Custom button: `col-span-2 sm:col-span-1` for mobile breathing room
- [ ] Custom range is **buffered** — calendar picks update `pendingRange`, fetch only on **Apply**
- [ ] Dismiss without Apply reverts the buffer silently
- [ ] Clear button resets to `'week'` preset

---

## 5. Filter Toolbar & Chips

- [ ] Search uses `useDebouncedSearch` with `delay: 400`, `pl-9` for search icon inset
- [ ] Dropdowns use shadcn `Select` (not native `<select>` or button groups)
- [ ] **No duplicate filtering** — if stats cards filter by status, remove status dropdown
- [ ] Active filter chips: `Badge variant="secondary"` with `X` dismiss icon per chip
- [ ] "Clear all" link at the end of the chip row
- [ ] Descriptive subtitle: `"{count} items in {category} ({status})"`

---

## 6. Table & Data Display

- [ ] Server-side pagination via `useServerPagination` + Supabase `.range(from, to)`
- [ ] Server-side sorting via `useSortableTable` + `SortableHeader` component
- [ ] Server-side search via `useDebouncedSearch` + `.ilike()` / `.or()`
- [ ] Row status tinting: `s.rowTint.*` gradient classes on `<tr>`
- [ ] Inline refresh skeleton rows during re-fetch (not full-page skeleton)
- [ ] Full-page skeleton only on `initialLoading` with layout-matching shapes
- [ ] Pagination footer: "Showing X–Y of Z", items-per-page `Select`, page arrows
- [ ] Keyboard pagination: `ArrowLeft` / `ArrowRight` event listeners

---

## 7. Dialogs & Sheets

### Detail Dialogs (read-only)
- [ ] `DialogContent` uses `p-0 overflow-hidden` — manual padding per section
- [ ] Max width: `max-w-[calc(100%-2rem)] sm:max-w-lg`
- [ ] Max height: `max-h-[85vh] flex flex-col`
- [ ] Header: gradient icon badge + title + badges/chips in `DialogDescription`
- [ ] `<Separator />` between header and scrollable body
- [ ] Body: `flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-4`
- [ ] Sections: `<section>` + uppercase label (`text-xs font-semibold uppercase tracking-wide text-muted-foreground`) + icon
- [ ] Data cards: `rounded-lg border bg-muted/30 p-3` with `flex justify-between` key-value rows

### Form Dialogs
- [ ] Two-column fields on `sm+`: `grid grid-cols-1 sm:grid-cols-2 gap-4`
- [ ] Labels: `text-xs font-medium uppercase tracking-wide text-muted-foreground` with icon
- [ ] Required fields marked with `<span className="text-red-400">*</span>`
- [ ] Submit button shows `Loader2 animate-spin` during save

### Sheets / Drawers
- [ ] Mobile width: `w-[calc(100%-2.5rem)]` — leaves ~40px gap for spatial context
- [ ] Desktop width: `sm:max-w-md`
- [ ] Mobile rounding: `rounded-l-xl sm:rounded-none`
- [ ] Layout: `flex flex-col p-0 gap-0` — manual padding per zone
- [ ] Zones: Header (`px-5 pt-5 pb-3`) → `<Separator />` → Filters (`px-5 py-3 border-b bg-muted/30`) → Body (`flex-1 min-h-0 overflow-y-auto px-5 py-4`) → Footer (`px-5 py-3 border-t`)

---

## 8. Mobile Responsiveness

- [ ] Page wrapper: `space-y-4 md:space-y-6` — never `container mx-auto p-6`
- [ ] Grids collapse: `grid-cols-2 lg:grid-cols-4` for stats, `grid-cols-1 sm:grid-cols-2` for forms
- [ ] Buttons stack vertically on mobile where needed
- [ ] Touch targets: minimum `h-8 w-8` (32px) for icon buttons, `h-10` (40px) for form inputs
- [ ] No horizontal overflow — check narrow viewport (320px)
- [ ] Dialogs use `max-w-[calc(100%-2rem)]` to avoid edge-to-edge on mobile
- [ ] Sheets leave left margin for spatial awareness

---

## 9. Typography

| Role | Class |
|------|-------|
| Page heading | `text-2xl font-bold` |
| Card title | `text-lg font-semibold` |
| Body | `text-sm` or `text-base` |
| Label | `text-sm font-medium` |
| Caption | `text-xs text-muted-foreground` |
| Section label (dialog) | `text-xs font-semibold uppercase tracking-wide text-muted-foreground` |
| Stat value | `text-2xl font-bold tabular-nums` |

- [ ] No `text-3xl` page headings
- [ ] Stat numbers use `tabular-nums` for alignment
- [ ] Mono text where appropriate: `font-mono text-base font-bold tracking-wide`

---

## 10. Interactions & Touch

- [ ] Primary CTA buttons: `${s.primaryGradient} ${s.primaryGradientHover} ${s.btnAnimation}`
- [ ] Cards/stats: `${s.btnAnimationSubtle}` or equivalent `hover:scale-[1.02] active:scale-[0.98]`
- [ ] Action buttons (edit/delete) always visible — never behind `group-hover:opacity`
- [ ] Action buttons: `size="icon" variant="ghost" h-8 w-8`
- [ ] Delete buttons: `hover:text-red-600`
- [ ] Loading states: skeleton placeholders matching layout, not spinner-only
- [ ] Optimistic UI: visual update first, DB persist in background, revert on failure

---

## 11. Empty & Error States

- [ ] Uses shared `EmptyState` component from `@/components/shared/EmptyState`
- [ ] Icon in `rounded-full bg-muted p-4` circle
- [ ] Title: `font-medium text-sm`
- [ ] Subtitle: `text-xs text-muted-foreground max-w-[220px]`
- [ ] Call-to-action button where applicable
- [ ] Table empty state spans all columns via `colSpan`

---

## 12. Core Rules

- [ ] No `confirm()`, `alert()`, `prompt()` — use `ConfirmDialog`
- [ ] No client-side filtering of large datasets — server-side with Supabase
- [ ] No `DateFilterTabs` — use `DateRangeFilter`
- [ ] No manual stats card grids — use inline button pattern or `StatsCardGrid`
- [ ] Supabase errors checked via `result.error`, not try/catch (client doesn't throw)
- [ ] Search is debounced — never on every keystroke
- [ ] Toast notifications via `sonner` — `toast.success()`, `toast.error()`

---

## Premium Patterns to Implement

Enterprise-level touches to elevate the experience. Prioritised by impact.

### High Priority

| Pattern | Description | Where |
|---------|-------------|-------|
| **Backdrop blur on dialogs** | Add `bg-black/60 backdrop-blur-sm` to Dialog overlay for frosted-glass depth | Global — shadcn Dialog overlay customization |
| **Staggered list entrance** | Items fade in with 30–50ms offset per row using `animation-delay` + `animate-in fade-in slide-in-from-bottom-2` | Tables, category cards, Sheet lists |
| **Count-up stat animation** | Stat numbers roll from 0 to value on mount using a lightweight counter (`requestAnimationFrame` + easing, no library) | All stats cards, Sheet summary |
| **Skeleton-to-content crossfade** | Replace hard swap with `animate-in fade-in duration-300` on the real content container when `loading` becomes false | Every page with skeletons |

### Medium Priority

| Pattern | Description | Where |
|---------|-------------|-------|
| **Toast with Undo** | Destructive actions show `toast('Deleted', { action: { label: 'Undo', onClick } })` — soft-delete first, hard-delete after 5s | Delete flows |
| **Bottom Sheet for mobile forms** | On `sm:` and below, render form dialogs as bottom `Sheet` instead of centered `Dialog` for thumb-friendly interaction | Add stock lot, add category |
| **Drag-to-reorder** | Replace `ChevronUp`/`ChevronDown` with `GripVertical` drag handle via `@dnd-kit/core` | Sizes, checklists |
| **Shared filter chip component** | Extract "Filtered by: Status: X [×]" chip row into a `FilterChips` shared component — currently duplicated inline | Inventory, QR codes, Sales |
| **Contextual empty states** | Different messages depending on cause: no data vs. filters too narrow vs. search no match | All table pages |

### Low Priority (Polish)

| Pattern | Description | Where |
|---------|-------------|-------|
| **Pull-to-refresh** | `touchstart` / `touchmove` gesture detection → refetch on overscroll | All data pages |
| **Command palette** | `Ctrl+K` / `Cmd+K` overlay to search pages, actions, items globally | Global |
| **Page transitions** | `framer-motion` `AnimatePresence` route-level fade/slide | Layout wrapper |
| **Haptic feedback** | `navigator.vibrate(10)` on destructive confirmation | Mobile PWA |
| **Success confetti** | Lightweight canvas confetti on milestone events (first sale, 100th QR) | POS, milestones |
| **Swipe-to-reveal actions** | Horizontal swipe on list rows to expose edit/delete on mobile | Table rows on touch |
| **Inline sparkline charts** | Tiny 7-day trend line inside stats cards | Stats cards |
| **Ambient sync indicator** | Thin gradient bar at page top that pulses during background sync | Layout header |
| **Smart shortcuts** | Keyboard shortcut badges on buttons for desktop users, `?` to view all | Global |

---

## Scoring

After running the checklist, rate:

| Metric | Score |
|--------|-------|
| Config compliance (no hardcoded colors) | /10 |
| Mobile responsiveness | /10 |
| Design consistency | /10 |
| Interaction quality | /10 |
| **Overall** | **/40** |

**Thresholds:** 32+ = ship-ready, 24–31 = needs polish, <24 = needs rework.

---

> **Last Updated:** February 8, 2026
> **Version:** 2.0
> **Reference implementations:** Inventory page, QR Codes page, InventoryItemDetailsDialog, CategoryBreakdownSheet
