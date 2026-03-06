# 🎨 Womaniya Dashboard — Design System Bible

> The definitive reference for every UI/UX pattern, component standard, and premium interaction in this application.
> Every new page, feature, or AI session should consult this document before writing code.

---

## Table of Contents

1. [Philosophy & Principles](#1-philosophy--principles)
2. [Visual Foundation](#2-visual-foundation) — includes `appConfig.styles` token reference
3. [Component Patterns](#3-component-patterns) — stats cards (StatsCardGrid + token-driven), category drill-down
4. [Interaction Patterns](#4-interaction-patterns) — button animations via `s.btnAnimation` tokens
5. [Data Display Patterns](#5-data-display-patterns) — DateRangeFilter buffered Apply, row tinting tokens
6. [Form Patterns](#6-form-patterns)
7. [Navigation Patterns](#7-navigation-patterns) — back button + page header tokens
8. [Dialog & Modal Patterns](#8-dialog--modal-patterns) — premium `p-0` dialogs, Sheet/Drawer patterns
9. [Loading & Empty States](#9-loading--empty-states)
10. [Premium Polish](#10-premium-polish)
11. [Shared Components Reference](#11-shared-components-reference)
12. [Anti-Patterns & Deprecations](#12-anti-patterns--deprecations)
13. [Upgrade Roadmap](#13-upgrade-roadmap)

---

## 1. Philosophy & Principles

### Design Identity
- **Brand:** Teal-to-cyan gradient as the signature visual. No pink/rose colors.
- **Feel:** Premium, enterprise-grade — but lightweight and fast. Think Shopify admin, not government portal.
- **Mobile-first:** Every component starts as a phone layout and scales up. This is a **PWA used on tablets** in retail shops.

### Core Rules

| Rule | Why |
|------|-----|
| **Optimistic UI** | User sees the result instantly; DB persists in the background. Revert on failure. |
| **No native browser dialogs** | Never use `confirm()`, `alert()`, or `prompt()`. Use `ConfirmDialog`. |
| **No spinners-only loading** | Use skeleton placeholders that match the final layout shape. |
| **Always-visible actions** | Don't hide edit/delete buttons behind hover. They must be visible on touch devices. |
| **Server-side data operations** | Pagination, sorting, and search happen on the server (Supabase query), not client-side filtering. |
| **Shared components first** | Before building a custom empty state, stats grid, or loading skeleton — check `src/components/shared/`. |

---

## 2. Visual Foundation

### 2.1 Color System

```
┌─────────────────────────────────────────────────────────┐
│ PRIMARY GRADIENT                                         │
│ bg-gradient-to-r from-teal-500 to-cyan-600              │
│ hover: from-teal-600 to-cyan-700                        │
│                                                          │
│ LINKS & INTERACTIVE                                      │
│ text-teal-600 hover:text-teal-700 hover:bg-teal-50     │
│                                                          │
│ ACTIVE BORDERS                                           │
│ border-teal-300 (light) / border-teal-700 (dark)        │
│                                                          │
│ BACKGROUND TINTS                                         │
│ bg-teal-50 / bg-teal-50/50 (subtle)                     │
│                                                          │
│ STATUS COLORS                                            │
│ Green  → Available/Active/Success  (#22c55e)             │
│ Blue   → Sold/Info                 (#3b82f6)             │
│ Red    → Damaged/Error/Destructive (#ef4444)             │
│ Amber  → Warning/Pending          (#f59e0b)             │
│ Gray   → Inactive/Disabled                               │
└─────────────────────────────────────────────────────────┘
```

**Centralized config:** `src/lib/config/app.config.ts` — brand name, gradient tokens.

**Style Tokens (source of truth):** Every page must use `const s = appConfig.styles` and reference tokens instead of hardcoded Tailwind classes:

```tsx
import { appConfig } from '@/lib/config';
const s = appConfig.styles;

// Available tokens:
s.primaryGradient        // 'bg-gradient-to-r from-teal-500 to-cyan-600'
s.primaryGradientHover   // 'hover:from-teal-600 hover:to-cyan-700'
s.headerIconGradient     // 'bg-gradient-to-br from-teal-500 to-cyan-600'
s.linkColor              // 'text-teal-600'
s.linkHover              // 'hover:text-teal-700 hover:bg-teal-50'
s.btnAnimation           // 'hover:scale-105 active:scale-95 transition-all'
s.btnAnimationSubtle     // 'hover:scale-[1.02] active:scale-[0.98] transition-all'
s.statsActive.total      // { border, bg, text } per status
s.statsActive.available  // { border, bg, text } — inventory
s.statsActive.sold       // { border, bg, text } — inventory
s.statsActive.damaged    // { border, bg, text } — inventory
s.statsActive.unused     // { border, bg, text } — QR codes
s.statsActive.assigned   // { border, bg, text } — QR codes
s.statsActive.lost       // { border, bg, text } — QR codes
s.statsActive.purple     // { border, bg, text } — generic purple variant
s.rowTint.*              // Row background gradients per status/sale_type
s.categoryBarColors      // ['#14b8a6', '#06b6d4', ...] for charts
```

**⛔ Don't:** Hardcode `from-teal-500 to-cyan-600` when `s.primaryGradient` exists.

### 2.2 Typography Scale

| Role | Class | Example |
|------|-------|---------|
| Page heading | `text-2xl font-bold` | "Settings", "Inventory" |
| Card title | `text-lg font-semibold` | StatsCard title, CardTitle |
| Body text | `text-base` or `text-sm` | Descriptions, table cells |
| Label | `text-sm font-medium` | Form labels, filter labels |
| Caption/helper | `text-xs text-muted-foreground` | "Enter tax % applied to sales" |
| Uppercase label | `text-xs font-medium uppercase tracking-wide text-muted-foreground` | Dialog form labels |
| Mono/code | `font-mono text-base font-bold tracking-wide` | QR prefix display |

**Rules:**
- Never use `text-3xl` for page headings (too large on mobile).
- Use `text-sm md:text-base` for responsive body text where needed.

### 2.3 Spacing System

```tsx
// Page wrapper — consistent vertical rhythm
<div className="space-y-4 md:space-y-6">

// Card internal padding
<CardContent className="p-4 md:p-6">

// Form field spacing
<div className="space-y-4">

// Grid gaps
<div className="gap-4 md:gap-6">

// Button groups
<div className="flex items-center gap-2">
```

**Never use:** `container mx-auto p-6` (old pattern — excessive padding on mobile).

### 2.4 Grid Layouts

```tsx
// Stats cards
grid-cols-2 lg:grid-cols-4

// Module/feature cards
grid gap-4 md:gap-6 sm:grid-cols-2 lg:grid-cols-3

// Form fields
grid grid-cols-1 sm:grid-cols-2 gap-4

// Category chips
grid-cols-2 md:grid-cols-3 lg:grid-cols-6
```

### 2.5 Icon Sizes

| Context | Size |
|---------|------|
| Inline with text | `h-4 w-4` |
| Card feature icon | `h-6 w-6` |
| Empty state hero | `h-8 w-8` or `h-12 w-12` |
| Button icon (small) | `h-3.5 w-3.5` |
| Module card icon | `h-6 w-6` (inside gradient circle) |

---

## 3. Component Patterns

### 3.1 Stats Cards — Interactive Toggle Filtering

**Two approaches (both valid):**

#### Option A: `StatsCardGrid` Component (Quick Setup)

**Component:** `StatsCardGrid` from `src/components/shared/StatsCardGrid.tsx`

Best for pages needing a quick stats grid without custom styling.

```tsx
import { StatsCardGrid, type StatCard } from '@/components/shared/StatsCardGrid';

const stats: StatCard[] = [
  { label: 'Total', value: totalCount, icon: Package, isActive: statusFilter === 'all',
    activeClassName: 'border-l-teal-500 bg-teal-50', onClick: () => setStatusFilter('all') },
];

<StatsCardGrid stats={stats} loading={initialLoading} filterHint="Click a card to filter" />
```

#### Option B: Inline Buttons with Config Tokens (Premium Pattern) ✨

Best for pages that need full control over active states via `appConfig.styles`.

```tsx
const s = appConfig.styles;

<div className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-3">
  {[
    { key: 'all', label: 'Total', value: totalCount, icon: Package, style: s.statsActive.total },
    { key: 'available', label: 'Available', value: availableCount, icon: CheckCircle, style: s.statsActive.available },
    { key: 'sold', label: 'Sold', value: soldCount, icon: ShoppingCart, style: s.statsActive.sold },
    { key: 'damaged', label: 'Damaged', value: damagedCount, icon: AlertTriangle, style: s.statsActive.damaged },
  ].map((stat) => {
    const isActive = statusFilter === stat.key;
    const anyActive = statusFilter !== 'all' && stat.key !== statusFilter;
    return (
      <button key={stat.key}
        className={`text-left p-3 md:p-4 rounded-lg border ${s.btnAnimationSubtle} ${
          isActive ? `border-l-4 shadow-sm ${stat.style.border} ${stat.style.bg}` :
          anyActive ? 'opacity-50 hover:opacity-80' : 'hover:shadow-md'
        }`}
        onClick={() => setStatusFilter(isActive ? 'all' : stat.key)}>
        <p className={`text-xl md:text-2xl font-bold ${isActive ? stat.style.text : ''}`}>
          {stat.value}
        </p>
        <p className="text-xs text-muted-foreground">{stat.label}</p>
      </button>
    );
  })}
</div>
```

**Visual behavior (both options):**
- Active card: `border-l-4` left accent + token-driven tinted background
- Inactive cards when any is active: `opacity-50 hover:opacity-80` dimming
- Hover: `scale-[1.02]` subtle lift (via `s.btnAnimationSubtle`)
- Active press: `scale-[0.98]`
- Click again to deselect (toggle behavior)

**📍 Reference:** `inventory/page.tsx` (Option B), `attendance/page.tsx` (Option A)
**📍 Upgrade needed:** `checklists/page.tsx`, `qr-codes/page.tsx` still use manual grids.

### 3.2 Category Drill-Down

**Two approaches:**

#### Option A: Inline Chip Grid (for ≤6 categories)
```tsx
<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
  {categoryStats.map((stat) => (
    <button key={stat.id}
      className={`p-3 border rounded-lg text-left transition-all ${
        isActive ? 'border-l-4 border-l-teal-500 bg-teal-50 shadow-sm' :
        anyActive ? 'opacity-50 hover:opacity-80' : 'hover:shadow-md'
      }`}
      onClick={() => setCategoryFilter(isActive ? 'all' : stat.id)}>
      <p className="text-lg font-bold">{stat.count}</p>
      <p className="text-xs text-muted-foreground truncate">{stat.name}</p>
    </button>
  ))}
</div>
```

#### Option B: Sheet Drawer — `CategoryBreakdownSheet` (for many categories) ✨

Slide-in Sheet with category analytics, progress bars, and optional date filtering.
See [Section 8.5](#85-sheetdrawer-patterns) for full pattern.

**📍 Reference:** `inventory/page.tsx` uses Option B with a trigger button in the header.

### 3.3 Badge Counts

Always show item counts next to section titles:

```tsx
<CardTitle className="text-lg font-semibold flex items-center gap-2">
  Product Sizes
  {sizes.length > 0 && (
    <Badge variant="secondary" className="font-normal text-xs">{sizes.length}</Badge>
  )}
</CardTitle>
```

### 3.4 Card with Switch Toggle

For items with active/inactive state:

```tsx
<div className={`relative rounded-xl border-2 p-4 transition-all ${
  item.is_active
    ? 'border-teal-200 dark:border-teal-800 bg-teal-50/50 dark:bg-teal-950/20'
    : 'border-muted bg-muted/30 opacity-75'
}`}>
  {/* Content */}
  <div className="flex items-center justify-between pt-2 border-t border-dashed">
    <span className="text-xs font-medium text-muted-foreground">
      {item.is_active ? 'Active' : 'Inactive'}
    </span>
    <Switch checked={item.is_active} onCheckedChange={() => handleToggle(item)} className="scale-90" />
  </div>
</div>
```

**📍 Reference:** `QrPrefixesTab.tsx`, `checklists/page.tsx`

---

## 4. Interaction Patterns

### 4.1 Button Animations

All interactive buttons must have haptic-style transitions. **Use tokens from `appConfig.styles`:**

```tsx
const s = appConfig.styles;

// Standard CTA button
className={`${s.btnAnimation}`}      // 'hover:scale-105 active:scale-95 transition-all'

// Subtle variation (for stats cards, less intrusive)
className={`${s.btnAnimationSubtle}`} // 'hover:scale-[1.02] active:scale-[0.98] transition-all'

// Card hover
className="hover:shadow-lg transition-all"

// Combined for clickable feature cards
className={`hover:shadow-lg ${s.btnAnimation} cursor-pointer`}
```

### 4.2 Gradient Buttons (Primary Actions)

```tsx
// Primary CTA — use tokens
className={`${s.primaryGradient} ${s.primaryGradientHover} ${s.btnAnimation}`}

// Small/compact variant
className={`${s.primaryGradient} ${s.primaryGradientHover} shrink-0`}
```

**⛔ Don't:** Hardcode `from-teal-500 to-cyan-600` — use `s.primaryGradient`.

### 4.3 Chevron Reorder (Optimistic)

For ordered lists where users rearrange items:

```tsx
// Local state mirror for instant visual feedback
const [localItems, setLocalItems] = useState<Item[]>(items);
useEffect(() => { setLocalItems(items); }, [items]);

const handleMove = (index: number, direction: 'up' | 'down') => {
  const newIndex = direction === 'up' ? index - 1 : index + 1;
  if (newIndex < 0 || newIndex >= localItems.length) return;

  const newItems = [...localItems];
  [newItems[index], newItems[newIndex]] = [newItems[newIndex], newItems[index]];
  newItems.forEach((item, idx) => { item.sort_order = idx; });
  setLocalItems(newItems);  // ← Instant visual update

  // Background DB persist — do NOT call onRefresh() on success
  Promise.all(
    newItems.map((item) =>
      supabase.from('table').update({ sort_order: item.sort_order }).eq('id', item.id)
    )
  ).then((results) => {
    const failed = results.some((r) => r.error);
    if (failed) { toast.error('Failed to save order'); onRefresh(); } // Revert on failure only
  });
};
```

**Button markup:**
```tsx
<div className="flex flex-col shrink-0">
  <button type="button"
    className="h-7 w-7 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:pointer-events-none transition-colors"
    onClick={() => handleMove(index, 'up')}
    disabled={index === 0}>
    <ChevronUp className="h-4 w-4" />
  </button>
  <button type="button"
    className="h-7 w-7 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:pointer-events-none transition-colors"
    onClick={() => handleMove(index, 'down')}
    disabled={index === localItems.length - 1}>
    <ChevronDown className="h-4 w-4" />
  </button>
</div>
```

**Critical rules:**
- Use `ChevronUp`/`ChevronDown` icons, not text arrows (`↑`/`↓`).
- Keep reorder as local state swap — never wait for DB round-trip.
- Only call `onRefresh()` on **failure** to revert; don't call on success (it resets local state).

**📍 Reference:** `SizesTab.tsx` (optimistic DB persist), `checklists/page.tsx` (local-only until dialog save)

### 4.3.1 Drag-and-Drop Reorder (framer-motion)

For richer reorder UX — drag handles + chevron keyboard fallback:

```tsx
import { Reorder, useDragControls } from 'framer-motion';

function DraggableItem({ item, index, totalItems, onMoveUp, onMoveDown, onRemove }) {
  const dragControls = useDragControls();
  return (
    <Reorder.Item
      value={item}
      dragListener={false}
      dragControls={dragControls}
      className="flex items-center gap-2 p-3 border rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors select-none"
      whileDrag={{
        scale: 1.02,
        boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
        backgroundColor: 'var(--color-background, #fff)',
        zIndex: 50,
      }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
    >
      {/* Drag handle */}
      <div className="cursor-grab active:cursor-grabbing touch-none p-1"
        onPointerDown={(e) => dragControls.start(e)}>
        <GripVertical className="h-4 w-4" />
      </div>
      {/* Chevron fallback for accessibility */}
      <div className="flex flex-col shrink-0">
        <button ... onClick={onMoveUp} disabled={index === 0}><ChevronUp /></button>
        <button ... onClick={onMoveDown} disabled={index === totalItems - 1}><ChevronDown /></button>
      </div>
      <span className="flex-1 text-sm">{item.label}</span>
      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={onRemove}><X /></Button>
    </Reorder.Item>
  );
}

// Parent:
<Reorder.Group axis="y" values={items} onReorder={handleDragReorder} className="space-y-2">
  {items.map((item, i) => <DraggableItem key={item.id} item={item} index={i} ... />)}
</Reorder.Group>
```

**Critical rules:**
- Use `dragListener={false}` + explicit `dragControls.start(e)` on handle — don't make entire row draggable.
- Always provide chevron up/down as keyboard/accessibility fallback.
- `touch-none` on drag handle for proper mobile behavior.
- `whileDrag` should elevate (scale + shadow) for clear visual feedback.
- Update `sort_order` after reorder: `reorderedItems.map((item, idx) => ({ ...item, sort_order: idx }))`.

**📍 Reference:** `checklists/page.tsx` — `DraggableChecklistItem` component (framer-motion `Reorder`)

### 4.4 Action Buttons — Always Visible

```tsx
{/* ✅ Correct — always visible */}
<div className="flex items-center gap-1 shrink-0">
  <Button size="icon" variant="ghost"
    className="h-8 w-8 text-muted-foreground hover:text-foreground">
    <Pencil className="h-3.5 w-3.5" />
  </Button>
  <Button size="icon" variant="ghost"
    className="h-8 w-8 text-muted-foreground hover:text-red-600">
    <Trash2 className="h-3.5 w-3.5" />
  </Button>
</div>

{/* ⛔ NEVER — invisible on touch devices */}
<div className="opacity-0 group-hover:opacity-100">
```

### 4.5 Keyboard Shortcuts

```tsx
// Pagination: arrow keys
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowLeft' && currentPage > 1) goToPrev();
    if (e.key === 'ArrowRight' && currentPage < totalPages) goToNext();
  };
  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, [currentPage, totalPages]);

// Form fields: Enter to save, Escape to cancel
onKeyDown={(e) => {
  if (e.key === 'Enter') handleSave();
  if (e.key === 'Escape') handleCancel();
}}
```

---

## 5. Data Display Patterns

### 5.1 Server-Side Pagination

**Hook:** `useServerPagination` from `src/hooks/index.ts`

```tsx
const { from, to, currentPage, itemsPerPage, totalPages,
        startItem, endItem, goToFirst, goToLast, goToNext, goToPrev,
        setItemsPerPage, resetPage } = useServerPagination({ totalCount });

// In Supabase query:
const { data, count } = await supabase
  .from('table')
  .select('*', { count: 'exact' })
  .range(from, to);
```

**Pagination UI:**
```tsx
<div className="flex items-center justify-between">
  <p className="text-sm text-muted-foreground">
    Showing {startItem}-{endItem} of {totalCount}
  </p>
  <div className="flex items-center gap-1">
    <Select value={String(itemsPerPage)} onValueChange={(v) => setItemsPerPage(Number(v))}>
      {/* 10, 25, 50, 100, 200, 500 */}
    </Select>
    <Button variant="outline" size="icon" onClick={goToFirst} disabled={currentPage <= 1}>
      <ChevronFirst className="h-4 w-4" />
    </Button>
    {/* ...ChevronLeft, page indicator, ChevronRight, ChevronLast */}
  </div>
</div>
```

### 5.2 Server-Side Sorting

**Hook:** `useSortableTable<T>` from `src/hooks/index.ts`

```tsx
const { sortBy, sortOrder, handleSort } = useSortableTable<'name' | 'price' | 'date'>({
  initialSortBy: 'date',
  initialSortOrder: 'desc',
});

// In Supabase query:
query = query.order(sortBy, { ascending: sortOrder === 'asc' });
```

**Header component:**
```tsx
import { SortableHeader } from '@/components/shared/SortableHeader';

<SortableHeader column="name" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort}>
  Product Name
</SortableHeader>
```

### 5.3 Server-Side Search (Debounced)

**Hook:** `useDebouncedSearch` from `src/hooks/index.ts`

```tsx
const { searchTerm, debouncedSearchTerm, setSearchTerm } = useDebouncedSearch({ delay: 400 });

// UI:
<div className="relative">
  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
  <Input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
    placeholder="Search..." className="pl-9" />
</div>

// In Supabase query:
if (debouncedSearchTerm) {
  query = query.or(`name.ilike.%${debouncedSearchTerm}%,phone.ilike.%${debouncedSearchTerm}%`);
}
```

### 5.4 Filter Dropdowns (Compact)

Replace Tabs with `Select` when there are >4 filter options:

```tsx
<Select value={statusFilter} onValueChange={setStatusFilter}>
  <SelectTrigger className="w-[180px] text-sm">
    <SelectValue placeholder="All statuses" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="all">All Statuses</SelectItem>
    <SelectItem value="available">Available</SelectItem>
    <SelectItem value="sold">Sold</SelectItem>
  </SelectContent>
</Select>
```

### 5.5 Date Range Filtering

**Component:** `DateRangeFilter` from `src/components/shared/DateRangeFilter.tsx`
**Hook:** Pair with `useDateFilter` from `@/hooks`

```tsx
const { dateRange, setDateRange, customDateRange, setCustomDateRange,
        getDateRange } = useDateFilter({ initialFilter: 'all' });

<DateRangeFilter
  value={dateRange}
  onChange={setDateRange}
  customRange={customDateRange}
  onCustomRangeChange={setCustomDateRange}
/>
```

**Key behaviors:**
- **Buffered Apply:** Custom calendar selection is buffered in `pendingRange` — no fetch until user clicks the **Apply** button (`<Check> Apply`)
- **Responsive grid:** `grid-cols-3 sm:grid-cols-5` — wraps into 2 rows on mobile, single row on desktop
- **Custom button:** `col-span-2 sm:col-span-1` for horizontal balance on mobile
- **Clear behavior:** Resets to `'week'` preset
- **Dismiss without Apply:** Reverts buffer, no side effects

Options: Today, This Week, This Month, All Time, Custom (calendar popover with Apply button).

**⛔ Don't use:** `DateFilterTabs` (older, superseded).
**⛔ Don't:** Close popover on first calendar click — always require explicit Apply.

### 5.6 Table Row Status Indicators

Tint the entire row background with a left border accent. **Use tokens from `appConfig.styles.rowTint`:**

```tsx
const s = appConfig.styles;

// Row tinting by status
const getRowTint = (item: InventoryItem) => {
  if (item.status === 'sold') return s.rowTint.sold;
  if (item.status === 'damaged') return s.rowTint.damaged;
  // Available items: tint by sale_type
  return s.rowTint[item.sale_type as keyof typeof s.rowTint] || '';
};

<TableRow className={getRowTint(item)}>
```

Each `s.rowTint.*` value is a complete Tailwind string like:
`'bg-gradient-to-r from-green-50/60 via-green-50/30 to-transparent border-l-[3px] border-l-green-500'`

**⛔ Don't:** Hardcode gradient classes inline — use `s.rowTint.*` tokens.

### 5.7 Active Filter Chips (Dismissible)

**Reference implementation:** QR Codes page (`qr-codes/page.tsx` L828–866).

Show what's currently filtered and let users remove individual filters or clear all:

```tsx
{(filterStatus !== 'all' || filterPrefix !== 'all' || dateFilter !== 'all') && (
  <div className="flex items-center gap-2 flex-wrap">
    <span className="text-xs text-muted-foreground">Filtered by:</span>
    {filterStatus !== 'all' && (
      <Badge variant="secondary" className="gap-1 pl-2 pr-1 capitalize">
        Status: {filterStatus}
        <button
          onClick={() => { setFilterStatus('all'); setCurrentPage(1); }}
          className="ml-1 rounded-full hover:bg-muted-foreground/20 p-0.5"
        >
          <X className="h-3 w-3" />
        </button>
      </Badge>
    )}
    {filterPrefix !== 'all' && (
      <Badge variant="secondary" className="gap-1 pl-2 pr-1 font-mono">
        Prefix: {filterPrefix}
        <button
          onClick={() => { setFilterPrefix('all'); setCurrentPage(1); }}
          className="ml-1 rounded-full hover:bg-muted-foreground/20 p-0.5"
        >
          <X className="h-3 w-3" />
        </button>
      </Badge>
    )}
    <button
      onClick={() => { setFilterStatus('all'); setFilterPrefix('all'); setDateFilter('all'); setCurrentPage(1); }}
      className="text-xs text-muted-foreground hover:text-foreground underline"
    >
      Clear all
    </button>
  </div>
)}
```

**Rules:**
- Each chip: `Badge variant="secondary"` + `pl-2 pr-1` + dismiss `<button>` with `X h-3 w-3`
- Dismiss button: `rounded-full hover:bg-muted-foreground/20 p-0.5`
- Always reset `setCurrentPage(1)` when removing a filter
- "Clear all" link: `text-xs text-muted-foreground hover:text-foreground underline`
- Only render the chip row when at least one filter is active

### 5.8 Descriptive Toolbar Subtitle

Show a live summary of what's being displayed:

```tsx
<p className="text-sm text-muted-foreground">
  {totalCount} codes in {selectedPrefix} ({statusFilter})
</p>
```

---

## 6. Form Patterns

### 6.1 Quick-Add (Type + Enter)

For simple entities (categories, sizes, expense types):

```tsx
<div className="flex items-center gap-2 pt-1">
  <div className="relative flex-1">
    <Plus className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
    <Input
      ref={inputRef}
      value={newName}
      onChange={(e) => setNewName(e.target.value)}
      onKeyDown={(e) => e.key === 'Enter' && handleQuickAdd()}
      placeholder="Type a name and press Enter..."
      className="pl-9 h-10 border-dashed"
      disabled={adding}
    />
  </div>
  <Button size="sm" onClick={handleQuickAdd}
    disabled={!newName.trim() || adding}
    className="bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-600 hover:to-cyan-700 shrink-0">
    {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
  </Button>
</div>
```

**Key details:**
- `border-dashed` on the input communicates "add new"
- `Plus` icon prefix inside input
- Auto-refocus after successful add: `inputRef.current?.focus()`
- Loading spinner replaces the Plus icon during submit

### 6.2 Inline Edit (Enter/Escape)

For renaming items in a list without opening a dialog:

```tsx
{editingId === item.id ? (
  <div className="flex items-center gap-1">
    <Input autoFocus value={editValue}
      onChange={(e) => setEditValue(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') saveEdit(item.id);
        if (e.key === 'Escape') setEditingId(null);
      }}
      className="h-8 text-sm" />
    <Button size="icon" variant="ghost" className="h-7 w-7 text-teal-600 shrink-0"
      onClick={() => saveEdit(item.id)}>
      <Check className="h-3.5 w-3.5" />
    </Button>
    <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground shrink-0"
      onClick={() => setEditingId(null)}>
      <X className="h-3.5 w-3.5" />
    </Button>
  </div>
) : (
  <p className="text-sm font-medium truncate">{item.name}</p>
)}
```

**📍 Reference:** `SizesTab.tsx`, `ExpenseCategoriesTab.tsx`

### 6.3 Dirty-State Detection (Save Bar)

For forms with multiple fields that should only show save when changed:

```tsx
const isDirty = form.shop_name !== shop.shop_name
  || form.address !== (shop.address || '')
  || form.phone !== (shop.phone || '');

// Sync from props when they change
useEffect(() => { setForm({ shop_name: shop.shop_name, ... }); }, [shop]);

// Save bar — only visible when dirty
{isDirty && (
  <div className="flex items-center gap-3 pt-3 border-t">
    <div className="flex-1 text-xs text-amber-600 font-medium">You have unsaved changes</div>
    <Button variant="ghost" size="sm" onClick={resetToProp}>Discard</Button>
    <Button size="sm" onClick={handleSave}
      className="bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-600 hover:to-cyan-700">
      {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
      Save Changes
    </Button>
  </div>
)}
```

**📍 Reference:** `ShopTabs.tsx` (`ShopDetailsTab`, `TaxSettingsTab`)

### 6.4 Icon-Labeled Fields

For premium form sections:

```tsx
<Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
  <Store className="h-3.5 w-3.5" /> Shop Name <span className="text-red-400">*</span>
</Label>
```

### 6.5 Two-Column Responsive Forms

```tsx
<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
  <div className="space-y-2">
    <Label>Field 1 *</Label>
    <Input ... />
  </div>
  <div className="space-y-2">
    <Label>Field 2</Label>
    <Input ... />
  </div>
</div>
```

### 6.6 Field Validation (`useFormErrors` + `FieldError`)

Lightweight inline validation for `useState`-based forms (no React Hook Form needed).

**Hook:** `useFormErrors` from `@/components/shared/FieldError`

```tsx
import { FieldError, fieldErrorClass, useFormErrors } from '@/components/shared/FieldError';

const { errors, validateFields, clearFieldError } = useFormErrors<'amount' | 'description' | 'category_id'>();

// In submit handler:
const valid = validateFields({
  amount: [!form.amount, 'Amount is required'],
  description: [!form.description.trim(), 'Description is required'],
  category_id: [!form.category_id, 'Please select a category'],
});
if (!valid) return;

// In JSX — red border on error + inline message:
<Input
  value={form.amount}
  onChange={(e) => { setForm({ ...form, amount: e.target.value }); clearFieldError('amount'); }}
  className={fieldErrorClass(errors.amount)}
/>
<FieldError message={errors.amount} />
```

**Key details:**
- `fieldErrorClass()` returns `'border-red-500'` when error exists, empty string otherwise
- `clearFieldError()` on `onChange` — error disappears as user types
- `validateFields()` sets all errors at once and returns `boolean`
- Generic type param constrains field names: `useFormErrors<'email' | 'password'>()`

**📍 Reference:** `finances/page.tsx`, `login/page.tsx`, `change-password/page.tsx`, `AttendanceEditDialog.tsx`, `checklists/page.tsx`

### 6.7 Schema Validation (React Hook Form + Zod)

For complex forms with many fields, conditional logic, or cross-field validation — use **React Hook Form + Zod** instead of `useFormErrors`.

**Schema:** Define in `src/lib/validations/` as a separate file.

```tsx
// lib/validations/add-stock-lot.ts
import { z } from 'zod';

export const addStockLotSchema = z.object({
  category_id: z.string().min(1, 'Category is required'),
  quantity: z.coerce.number().int().min(1, 'At least 1 item required'),
  cost_price_per_unit: z.coerce.number().positive('Cost price must be positive'),
  selling_price_default: z.coerce.number().positive('Selling price must be positive'),
  tax_rate: z.coerce.number().min(0).max(100).optional().or(z.literal('')),
  // ...
}).refine(
  (data) => data.selling_price_default > data.cost_price_per_unit,
  { message: 'Selling price should be higher than cost price', path: ['selling_price_default'] }
);

export type AddStockLotFormValues = z.infer<typeof addStockLotSchema>;
```

**Form component:**

```tsx
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { addStockLotSchema, type AddStockLotFormValues } from '@/lib/validations/add-stock-lot';

const { register, handleSubmit, control, watch, setValue, formState: { errors } } = useForm<AddStockLotFormValues>({
  resolver: zodResolver(addStockLotSchema),
  defaultValues: { category_id: '', quantity: '' as unknown as number },
});

// Standard inputs — use register()
<Input {...register('vendor_name')} className={errors.vendor_name ? 'border-red-500' : ''} />
{errors.vendor_name && <p className="text-xs text-red-500">{errors.vendor_name.message}</p>}

// shadcn Select — use Controller (Select doesn't forward ref)
<Controller name="category_id" control={control}
  render={({ field }) => (
    <Select value={field.value} onValueChange={field.onChange}>
      <SelectTrigger className={errors.category_id ? 'border-red-500' : ''}>
        <SelectValue placeholder="Select category" />
      </SelectTrigger>
      <SelectContent>{/* items */}</SelectContent>
    </Select>
  )}
/>
```

**When to use which:**

| Approach | Best for | Example |
|----------|----------|---------|
| `useFormErrors` (§6.6) | Simple forms, 2-4 fields, presence-only validation | Add Expense dialog, Login |
| `useForm` + Zod (§6.7) | Complex forms, 5+ fields, cross-field rules, conditional fields | Add Stock Lot |

**📍 Reference:** `add-lot/page.tsx` (only page currently using this pattern)

---

## 7. Navigation Patterns

### 7.1 Back Button (Standard)

Every sub-page must have a back button to its parent. **Use tokens:**

```tsx
const s = appConfig.styles;

<Button variant="ghost" asChild
  className={`w-fit -ml-2 ${s.linkColor} ${s.linkHover}`}>
  <Link href="/admin">
    <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
  </Link>
</Button>
```

**⛔ Don't:** Hardcode `text-teal-600 hover:text-teal-700 hover:bg-teal-50` — use `s.linkColor` + `s.linkHover`.

### 7.2 Mobile Tab Navigation (Select Dropdown)

When a page has multiple tabs, use a `Select` on mobile and `TabsList` on desktop:

```tsx
<Tabs value={activeTab} onValueChange={setActiveTab}>
  {/* Mobile: dropdown */}
  <div className="sm:hidden">
    <Select value={activeTab} onValueChange={setActiveTab}>
      <SelectTrigger className="w-full h-11 border-teal-200">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {TAB_ITEMS.map((tab) => (
          <SelectItem key={tab.value} value={tab.value}>
            <span className="flex items-center gap-2">
              <tab.icon className="h-4 w-4" /> {tab.label}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  </div>

  {/* Desktop: horizontal tab bar */}
  <TabsList className="hidden sm:inline-flex">
    {TAB_ITEMS.map((tab) => (
      <TabsTrigger key={tab.value} value={tab.value}
        className="data-[state=active]:border-teal-300 dark:data-[state=active]:border-teal-700 data-[state=active]:bg-teal-50 data-[state=active]:text-teal-700 border-b-2 border-transparent">
        <tab.icon className="mr-1.5 h-4 w-4" /> {tab.label}
      </TabsTrigger>
    ))}
  </TabsList>

  <TabsContent value="..." />
</Tabs>
```

**📍 Reference:** `settings/page.tsx`

### 7.3 Page Header Pattern

```tsx
const s = appConfig.styles;

<div className="space-y-4 md:space-y-6">
  {/* Back button */}
  <Button variant="ghost" asChild className={`w-fit -ml-2 ${s.linkColor} ${s.linkHover}`}>
    <Link href="/admin"><ArrowLeft className="mr-2 h-4 w-4" /> Back</Link>
  </Button>

  {/* Title row */}
  <div className="flex items-center gap-3">
    <div className={`p-2.5 rounded-lg ${s.headerIconGradient} text-white shadow-md`}>
      <PageIcon className="h-6 w-6" />
    </div>
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Page Title</h1>
      <p className="text-sm text-muted-foreground">Brief description</p>
    </div>
  </div>

  {/* Content */}
</div>
```

---

## 8. Dialog & Modal Patterns

### 8.1 Confirm Dialog (Destructive Actions)

**Component:** `ConfirmDialog` from `src/components/shared/ConfirmDialog.tsx`

**State pattern:**
```tsx
const [confirmDialog, setConfirmDialog] = useState<{
  open: boolean; title: string; description: string; onConfirm: () => void;
}>({ open: false, title: '', description: '', onConfirm: () => {} });

// Trigger:
setConfirmDialog({
  open: true,
  title: 'Delete Item',
  description: 'Delete "Blue Kurta"? This cannot be undone.',
  onConfirm: async () => { /* delete logic */ },
});

// Render:
<ConfirmDialog
  open={confirmDialog.open}
  onOpenChange={(open) => setConfirmDialog({ ...confirmDialog, open })}
  onConfirm={confirmDialog.onConfirm}
  title={confirmDialog.title}
  description={confirmDialog.description}
  confirmText="Delete"
  variant="destructive"
/>
```

**⛔ NEVER use:** `if (confirm('Are you sure?'))` or `window.confirm()`.

### 8.2 Form Dialogs

```tsx
<Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
  <DialogContent className="sm:max-w-md">
    <DialogHeader>
      <DialogTitle>{editing ? 'Edit Item' : 'Add Item'}</DialogTitle>
    </DialogHeader>
    <div className="space-y-4 py-2">
      <div className="space-y-2">
        <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Name <span className="text-red-400">*</span>
        </Label>
        <Input value={form.name} onChange={...} onKeyDown={(e) => e.key === 'Enter' && handleSave()} autoFocus />
      </div>
    </div>
    <DialogFooter>
      <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
      <Button onClick={handleSave}
        className="bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-600 hover:to-cyan-700">
        {editing ? 'Update' : 'Create'}
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

### 8.3 Detail/Preview Dialogs (Premium Pattern) ✨

For read-only detail views (inventory item, QR code, bill):

```tsx
const s = appConfig.styles;

<DialogContent className="sm:max-w-lg max-w-[calc(100%-2rem)] p-0 overflow-hidden">
  {/* HEADER ZONE — manual padding, no DialogHeader */}
  <div className="px-5 pt-5 pb-3">
    <DialogTitle className="flex items-center gap-3">
      <div className={`p-2 rounded-lg ${s.headerIconGradient} text-white shadow-sm`}>
        <Package className="h-5 w-5" />
      </div>
      <div>
        <span className="text-lg font-semibold">Item Name</span>
        <DialogDescription className="flex items-center gap-2 mt-1">
          <Badge variant="outline">QR-001</Badge>
          <Badge className="bg-green-100 text-green-800">Available</Badge>
        </DialogDescription>
      </div>
    </DialogTitle>
  </div>

  <Separator />

  {/* SCROLLABLE BODY */}
  <div className="px-5 pb-5 overflow-y-auto max-h-[60vh] space-y-4">
    {/* Section with uppercase label */}
    <div>
      <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground flex items-center gap-1.5 mb-2">
        <Info className="h-3.5 w-3.5" /> Status Information
      </h4>
      <div className="grid grid-cols-2 gap-2">
        <div className="p-2.5 rounded-md bg-muted/30">
          <p className="text-[11px] text-muted-foreground">Status</p>
          <p className={`text-sm font-medium ${s.statsActive.available.text}`}>Available</p>
        </div>
      </div>
    </div>
  </div>
</DialogContent>
```

**Key rules:**
- `p-0 overflow-hidden` on `DialogContent` — header bleeds to edges
- Gradient icon badge in header matching `s.headerIconGradient`
- `<Separator />` divides header from scrollable body
- Sections use `uppercase tracking-wide` labels with icons
- Data cards use `bg-muted/30` — not full `<Card>` components
- Status text colored via `s.statsActive.*.text` tokens

**📍 Reference:** `InventoryItemDetailsDialog.tsx` (gold standard)

### 8.4 Sheet/Drawer Patterns (Mobile-Friendly Analytics)

For slide-in panels with analytics, filters, or secondary content:

```tsx
const s = appConfig.styles;

<Sheet open={open} onOpenChange={setOpen}>
  <SheetContent side="right"
    className="w-[calc(100%-2.5rem)] sm:max-w-md rounded-l-xl sm:rounded-none
               flex flex-col p-0 gap-0">
    {/* HEADER ZONE */}
    <div className="px-5 pt-5 pb-3">
      <SheetTitle className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${s.headerIconGradient} text-white shadow-sm`}>
          <BarChart3 className="h-5 w-5" />
        </div>
        <span className="text-lg font-semibold">Sheet Title</span>
      </SheetTitle>
    </div>

    <Separator />

    {/* FILTERS ZONE (optional) */}
    <div className="px-5 py-3 border-b bg-muted/30">
      <DateRangeFilter ... />
    </div>

    {/* SCROLLABLE BODY */}
    <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
      {/* Content */}
    </div>

    {/* FOOTER ZONE (optional) */}
    <div className="border-t p-4 bg-muted/30">
      <Button className={`w-full ${s.primaryGradient}`}>Export</Button>
    </div>
  </SheetContent>
</Sheet>
```

**Key rules:**
- `w-[calc(100%-2.5rem)]` — 40px left gap on mobile so user sees they can tap outside
- `rounded-l-xl sm:rounded-none` — rounded corner on mobile only
- `flex flex-col p-0 gap-0` — manual padding in each zone
- Use `<Separator />` between zones, not margins
- Progress bars colored via `s.categoryBarColors` array

**📍 Reference:** `CategoryBreakdownSheet.tsx` (gold standard)

### 8.5 Backdrop Blur (Premium)

```tsx
<Card className="backdrop-blur-sm bg-white/95 shadow-2xl">
```

**🔮 Future:** Apply to all dialogs via shadcn Dialog overlay customization.

---

## 9. Loading & Empty States

### 9.1 Loading Skeletons (Per-Page)

Each page should have a skeleton that matches its final layout shape:

```tsx
if (initialLoading) {
  return (
    <div className="space-y-4 md:space-y-6">
      {/* Mirror the real header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 bg-muted animate-pulse rounded-md" />
        <div className="space-y-2">
          <div className="h-8 w-48 bg-muted animate-pulse rounded" />
          <div className="h-4 w-96 bg-muted animate-pulse rounded" />
        </div>
      </div>
      {/* Mirror the stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />
        ))}
      </div>
      {/* Mirror the table */}
      <div className="h-64 bg-muted animate-pulse rounded-lg" />
    </div>
  );
}
```

### 9.2 Table Loading (Inline Refresh)

When re-fetching data (e.g., changing filters), show inline skeleton rows instead of replacing the entire page:

```tsx
{tableLoading ? (
  Array.from({ length: 5 }).map((_, i) => (
    <tr key={i}>
      {Array.from({ length: columnCount }).map((_, j) => (
        <td key={j} className="p-3">
          <div className="h-4 bg-muted animate-pulse rounded w-3/4" />
        </td>
      ))}
    </tr>
  ))
) : (
  /* Real data rows */
)}
```

**Split loading pattern:** `initialLoading` (full skeleton) vs `tableLoading` (inline rows only).

**Alternative: Loading Overlay** (QR Codes page pattern — keeps existing data visible):

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

Use the overlay approach when the table already has data and you want to indicate a refresh without swapping content. Requires `relative` on the parent container.

### 9.3 Empty State Component

**Component:** `EmptyState` from `src/components/shared/EmptyState.tsx`

```tsx
// Table mode (spans all columns)
<EmptyState
  icon={Package}
  title="No products found"
  description="Try adjusting your search or filters"
  colSpan={8}
/>

// Card/section mode
<EmptyState
  icon={Layers}
  title="No sizes yet"
  description="Add sizes below — they'll appear at the POS in this order"
  action={<Button onClick={focusInput}>Add First Size</Button>}
/>
```

**📍 Upgrade needed:** Most pages have hand-rolled empty states. Migrate to shared `EmptyState`.

### 9.4 Inline Empty States (Settings Tabs)

For small list sections inside cards:

```tsx
<div className="flex flex-col items-center justify-center py-12 text-center">
  <div className="rounded-full bg-muted p-4 mb-4">
    <Layers className="h-8 w-8 text-muted-foreground/60" />
  </div>
  <p className="font-medium text-sm">No sizes yet</p>
  <p className="text-xs text-muted-foreground mt-1 max-w-[240px]">
    Add sizes below &mdash; they'll appear at the POS in this order
  </p>
</div>
```

### 9.5 Shared Components (Unused — Adopt)

| Component | Status | Action |
|-----------|--------|--------|
| `LoadingTable` | Built, **never imported** | Adopt across all table pages |
| `EmptyState` | Built, used in **1 page** | Adopt across all pages |

---

## 10. Premium Polish

### 10.1 Current Premium Features

| Feature | Where | Details |
|---------|-------|---------|
| Animated particle background | Login page | Gradient blob orbs with `animate-blob` + grid pattern overlay |
| Gradient clip-text title | Login page | `bg-clip-text text-transparent` on brand name |
| Frosted glass cards | Login, change-password | `backdrop-blur-sm bg-white/95 shadow-2xl` |
| Branded toast notifications | Global (Sonner) | `border-l-4` semantic colors + tinted backgrounds |
| Smart bill number search | Sales page | Numeric input → bill prefix match, text → name/phone search |
| Cart persistence | POS | `localStorage` cart with restore toast on return |
| Offline-first checkout | POS | Queues sales locally when offline |
| Multi-layout bill printing | Bill preview | A4, thermal 80mm, thermal 58mm |
| QR print shop | QR download dialog | Color themes, badge layouts, paper sizes, PDF generation |
| URL-synced filters | Sales page | `useSearchParams` keeps tab+filter state in URL |
| Module cards with unique gradients | Admin dashboard | 9 different gradient color schemes |
| Keyboard pagination | Inventory, Sales | Arrow keys navigate pages |
| Optimistic reorder | Sizes tab | Instant swap, background DB persist, revert on error |

### 10.2 Premium Patterns to Implement

These are enterprise-level touches to aspire to:

| Pattern | Description | Priority |
|---------|-------------|----------|
| **Backdrop blur on all dialogs** | Semi-transparent blurred overlay behind every Dialog/AlertDialog | High |
| **Slide-in Sheet on mobile** | Replace Dialog with bottom Sheet for forms on mobile viewports | High |
| **Micro-animations** | Staggered fade-in for list items, count-up animation for stat numbers | Medium |
| **Drag-to-reorder** | Replace chevrons with drag handles (`GripVertical`) using `@dnd-kit` | Medium |
| **Skeleton matching** | Every page's skeleton should pixel-match the real layout (not generic bars) | Medium |
| **Toast with undo** | "Item deleted" toast with Undo button (soft delete → hard delete after timeout) | Medium |
| **Haptic feedback** | Vibration API on mobile for destructive actions | Low |
| **Transition between pages** | Page-level fade/slide transitions using `framer-motion` | Low |
| **Command palette** | `Ctrl+K` global search across all sections | Low |
| **Skeleton → content morph** | Animate the skeleton distortion into real content (not instant swap) | Low |
| **Success confetti** | Confetti animation on first sale, milestone achievements | Low |
| **Pull-to-refresh** | Mobile gesture to refresh data on PWA | Low |
| **Swipe actions on mobile** | Swipe list items to reveal edit/delete | Low |

### 10.3 Branded Sonner Toasts

Already implemented in `src/components/ui/sonner.tsx`:

```tsx
// Success: emerald tint + left border
// Error: red tint + left border
// Warning: amber tint + left border
// Info: blue tint + left border
```

Usage:
```tsx
toast.success('Item saved');
toast.error('Failed to delete');
```

---

## 11. Shared Components Reference

### Quick Lookup Table

| Component | Import | Purpose |
|-----------|--------|---------|
| `ConfirmDialog` | `@/components/shared/ConfirmDialog` | Destructive action confirmation |
| `EmptyState` | `@/components/shared/EmptyState` | Empty table/list placeholder |
| `LoadingTable` | `@/components/shared/LoadingTable` | Table skeleton loader |
| `StatsCardGrid` | `@/components/shared/StatsCardGrid` | Interactive stats with toggle filtering |
| `SortableHeader` | `@/components/shared/SortableHeader` | Table column with sort indicators |
| `DateRangeFilter` | `@/components/shared/DateRangeFilter` | Date range picker (Today/Week/Month/All/Custom) |
| `ExportButton` | `@/components/shared/ExportButton` | CSV export |
| `BillPreviewDialog` | `@/components/shared/BillPreviewDialog` | Sale bill preview + print |
| `QrCodeCard` | `@/components/shared/QrCodeCard` | Single QR code display |
| `QrCodeDetailsDialog` | `@/components/shared/QrCodeDetailsDialog` | QR code detail view |
| `QrCodeDownloadDialog` | `@/components/shared/QrCodeDownloadDialog` | Bulk QR download with layouts |
| `InventoryItemDetailsDialog` | `@/components/shared/InventoryItemDetailsDialog` | Inventory item detail view (premium `p-0` pattern) |
| `CategoryBreakdownSheet` | `@/components/shared/CategoryBreakdownSheet` | Category analytics drawer with date filtering |
| `FieldError` | `@/components/shared/FieldError` | Inline field-level error message + `fieldErrorClass` helper |
| `SyncStatusIndicator` | `@/components/shared/SyncStatusIndicator` | Online/offline sync status |

### Admin Analytics Components

| Component | Import | Purpose |
|-----------|--------|---------|
| `VendorPerformance` | `@/components/admin/analytics` | Vendor-level sales/revenue/profit drilldown |
| `CategoryPerformance` | `@/components/admin/analytics` | Category-level sales breakdown |
| `SaleTypeAnalysis` | `@/components/admin/analytics` | Festival/clearance/promotion sales analysis |

### Admin Attendance Components

| Component | Import | Purpose |
|-----------|--------|---------|
| `AttendanceCreateDialog` | `@/components/admin/AttendanceCreateDialog` | Manual attendance entry creation |
| `AttendanceEditDialog` | `@/components/admin/AttendanceEditDialog` | Edit existing attendance records |
| `AttendanceDeleteDialog` | `@/components/admin/AttendanceDeleteDialog` | Soft-delete attendance records |
| `AttendanceBulkEntryDialog` | `@/components/admin/AttendanceBulkEntryDialog` | Bulk entry for multiple staff at once |
| `AttendanceCalendar` | `@/components/staff/AttendanceCalendar` | Calendar visualization of attendance per staff |

### POS Components

| Component | Import | Purpose |
|-----------|--------|---------|
| `ScanQRButton` | `@/components/pos/ScanQRButton` | Camera/scanner QR code input with device integration |
| `CartList` | `@/components/pos/CartList` | Cart item display with price edit, sale type toggle, remove |
| `CartSummary` | `@/components/pos/CartSummary` | Cart totals, discount summary, coupon display |
| `CheckoutDialog` | `@/components/pos/CheckoutDialog` | Payment flow, customer info, bill generation |
| `ProductSearchDialog` | `@/components/pos/ProductSearchDialog` | Browse/search inventory with `existingQrCodes` duplicate filter |

### Admin Settings Tab Components

| Component | Import | Purpose |
|-----------|--------|--------|
| `ShopDetailsTab` | `@/components/admin/settings/ShopTabs` | Shop name, address, phone, bill prefix with dirty state tracking + Discard/Save bar |
| `TaxSettingsTab` | `@/components/admin/settings/ShopTabs` | Tax rate config with dirty state tracking + Discard/Save bar |
| `CategoriesTab` | `@/components/admin/settings/CategoriesTab` | Product category CRUD — quick-add, edit Dialog, ConfirmDialog delete |
| `SizesTab` | `@/components/admin/settings/SizesTab` | Size CRUD — inline edit, optimistic ChevronUp/ChevronDown reorder, quick-add |
| `ExpenseCategoriesTab` | `@/components/admin/settings/ExpenseCategoriesTab` | Expense category CRUD — inline edit, orphan check on delete |
| `QrPrefixesTab` | `@/components/admin/settings/QrPrefixesTab` | QR prefix CRUD — regex validation, active/inactive Switch toggle, card grid |

### Staff Dashboard Components

| Component | Import | Purpose |
|-----------|--------|--------|
| `AttendanceCard` | `@/components/staff/AttendanceCard` | Clock in/out widget with live 1s elapsed timer, break deduction, `font-mono text-primary` display |
| `TaskChecklistCard` | `@/components/staff/TaskChecklistCard` | Daily checklists with checkbox completion, progress bars, 30s auto-refresh polling, dual render mode (`compact` / `showCompactSummary`) |
| `AttendanceCalendar` | `@/components/staff/AttendanceCalendar` | Monthly calendar grid + stats sidebar + details dialog. Color-coded days (green/yellow). Dual-mode: staff self-view + admin view with edit/delete gating |

### Superadmin Components

| Component | Import | Purpose |
|-----------|--------|--------|
| `UserManagement` | `@/components/admin/UserManagement` | User CRUD via Edge Function (`create-user` action-based): create user, reset password, toggle active. Icon-labeled inputs, Skeleton loading, auto-generated passwords. 754 lines |
| `SyncIssuesPage` | `src/app/(protected)/superadmin/sync-issues/page.tsx` | Failed/pending offline sale management — retry all, delete individual, clear all failed. Uses `ConfirmDialog` for destructive actions |
| `SuperadminLayout` | `src/app/(protected)/superadmin/layout.tsx` | Role guard: redirects non-superadmin to `/admin` or `/pos`, blocks render until auth resolved |

### Admin Staff Management

| Component | Import | Purpose |
|-----------|--------|--------|
| `StaffPage` | `src/app/(protected)/admin/staff/page.tsx` | Staff list with debounced search, clickable stat-card filters (Total/Active/Admins/Staff), status tabs, role dropdown. Edit dialog with sections. Dual view mode: table (default) + create (superadmin only via `UserManagement`). 527 lines |

### API Functions

| Function | Import | Purpose |
|----------|--------|--------|
| `fetchQrPrefixes` | `@/lib/api/qr-prefixes` | Fetch all QR prefixes for a shop |
| `createQrPrefix` | `@/lib/api/qr-prefixes` | Create new QR prefix with validation |
| `updateQrPrefix` | `@/lib/api/qr-prefixes` | Update prefix text, description, or active status |
| `deleteQrPrefix` | `@/lib/api/qr-prefixes` | Delete prefix (fails if QR codes assigned — FK constraint) |

### Utility Functions

| Function | Import | Purpose |
|----------|--------|--------|
| `calculateHours` | `@/lib/utils/attendance` | Compute hours from clock_in/clock_out/breaks (handles in-progress with `new Date()`) |
| `initAudio` | `@/lib/sounds` | Initialize Web Audio API on first user interaction (required for mobile) |
| `successChime` | `@/lib/sounds` | Play success chime — POS cart add, QR scan success |
| `errorBuzz` | `@/lib/sounds` | Play error buzz — duplicate item, validation failure |

### Custom Hooks

| Hook | Import | Purpose |
|------|--------|---------|
| `useServerPagination` | `@/hooks` | Server-side pagination state |
| `useSortableTable` | `@/hooks` | Sort column + direction state |
| `useDebouncedSearch` | `@/hooks` | Debounced search input |
| `useOfflineStatus` | `@/hooks/useOfflineStatus` | Online/offline detection |
| `useSyncStatus` | `@/hooks/useSyncStatus` | Sync queue status |
| `useDateFilter` | `@/hooks` | Date preset + custom range state (pair with `DateRangeFilter`) |
| `useFormErrors` | `@/components/shared/FieldError` | Lightweight inline field-error state for useState forms |

### Validation Schemas

| Schema | Import | Purpose |
|--------|--------|---------|
| `addStockLotSchema` | `@/lib/validations/add-stock-lot` | Zod schema for stock lot creation form (RHF + Zod pattern) |

---

## 12. Anti-Patterns & Deprecations

### ⛔ Never Do This

| Anti-Pattern | Replacement |
|--------------|-------------|
| `confirm('Are you sure?')` | `ConfirmDialog` component |
| `alert('Done!')` | `toast.success('Done')` |
| `opacity-0 group-hover:opacity-100` on action buttons | Always-visible buttons (touch devices can't hover) |
| `container mx-auto p-6` page wrapper | `space-y-4 md:space-y-6` |
| `text-3xl` page heading | `text-2xl font-bold` |
| Client-side filtering large lists | Server-side with Supabase `.ilike()` / `.range()` |
| `animate-spin` border spinner as only loading state | Skeleton placeholders matching layout |
| Manual stats card grids | `StatsCardGrid` component or inline buttons with `s.statsActive.*` tokens |
| `DateFilterTabs` | `DateRangeFilter` (newer, with Custom + buffered Apply) |
| `DateRangePicker` (raw calendar) | `DateRangeFilter` (presets + buffered Apply + `useDateFilter` hook). Only attendance page still uses this. |
| Hardcoded `from-teal-500 to-cyan-600` | `s.primaryGradient` / `s.primaryGradientHover` tokens |
| Hardcoded `text-teal-600 hover:text-teal-700` | `s.linkColor` / `s.linkHover` tokens |
| Hardcoded row gradient classes | `s.rowTint.*` tokens |
| Hardcoded `bg-gradient-to-br from-teal-500 to-cyan-600` | `s.headerIconGradient` token |
| Text arrows `↑`/`↓` for reorder | `ChevronUp`/`ChevronDown` icons |
| `onRefresh()` after optimistic reorder | Only call on failure to revert |
| Supabase `.update()` in try/catch without checking `{ error }` | Check `result.error` — Supabase client doesn't throw |

### 🗑️ Files to Clean Up

| File | Status | Action |
|------|--------|--------|
| `checklists/page-old.tsx` | Dead code | Delete |
| `TaskChecklistCard-old.tsx` | Dead code | Delete from `src/components/staff/` |
| `DateFilterTabs.tsx` | Superseded | Delete after confirming no imports |
| `.history/` folder entries | Auto-generated | Gitignore |

---

## 13. Upgrade Roadmap

### Phase 1: Consistency (Apply existing patterns everywhere)

- [x] ~~Tokenize all style values into `appConfig.styles`~~ (Done — inventory module)
- [x] ~~Upgrade `InventoryItemDetailsDialog` to premium `p-0` pattern~~ (Done)
- [x] ~~Create `CategoryBreakdownSheet` with config tokens~~ (Done)
- [x] ~~Add buffered Apply button to `DateRangeFilter`~~ (Done)
- [ ] Replace manual stats grids in `checklists/page.tsx` and `qr-codes/page.tsx` with `StatsCardGrid` or token-driven inline buttons
- [ ] Adopt `EmptyState` component across all pages (currently only attendance uses it)
- [ ] Adopt `LoadingTable` component (currently unused)
- [ ] Delete `checklists/page-old.tsx`
- [ ] Delete `DateFilterTabs.tsx`
- [ ] Migrate attendance page from `DateRangePicker` to `DateRangeFilter` + `useDateFilter` hook
- [ ] Adopt `appConfig.styles` tokens on attendance page (~6 hardcoded teal instances)
- [ ] Adopt `appConfig.styles` tokens on checklists page (~20 hardcoded teal/gradient/animation instances)
- [ ] Replace manual stats cards on checklists page with `StatsCardGrid` + active state
- [ ] Migrate checklists page inline empty states to shared `EmptyState` component
- [ ] Replace checklists page text-only loading with layout skeleton
- [ ] Replace `window.history.back()` with `router.back()` on checklists page
- [ ] Adopt `appConfig.styles` tokens on POS page (~6 hardcoded teal instances)
- [ ] Add gradient icon badge to POS page header
- [ ] Adopt `appConfig.styles` tokens on settings main page (~6 hardcoded teal instances) + all 5 tab components (~34 instances)
- [ ] Add orphan checks before deleting product categories (check `lots` table) and sizes (check `inventory_items` table)
- [ ] Adopt `useFormErrors` + `FieldError` in settings ShopDetailsTab, CategoriesTab, QrPrefixesTab edit dialogs
- [ ] Migrate settings inline empty states to shared `EmptyState` component
- [ ] Add code-level tax rate validation (0–100 range enforcement in handler)
- [ ] Adopt `appConfig.styles` tokens on me-page (~2 hardcoded teal + 2 hardcoded animations)
- [ ] Add gradient icon badge to me-page header
- [ ] Replace text-only loading in `TaskChecklistCard` and `AttendanceCalendar` with layout skeletons
- [ ] Remove unused Accordion import from `me/page.tsx`
- [ ] Fix duplicate dead code in `TaskChecklistCard` (3 empty checks, one unreachable)
- [ ] Delete `TaskChecklistCard-old.tsx` dead file
- [ ] Fix spelling "Calender" → "Calendar" in `AttendanceCalendar.tsx`
- [ ] Consolidate dual `TaskChecklistCard` rendering to eliminate duplicate API calls
- [ ] Replace layout `animate-spin` spinners with skeleton screens
- [ ] Migrate hardcoded teal classes across all modules to `s.*` tokens
- [ ] Fix superadmin header gradient: replace `from-purple-500 to-pink-500` with `s.headerIconGradient` (brand violation)
- [ ] Adopt `appConfig.styles` tokens on superadmin `page.tsx` (~12 hardcoded instances) + `sync-issues/page.tsx` (~4) + `UserManagement.tsx` (~4)
- [ ] Parallelize superadmin export queries with `Promise.all()` (currently 5 sequential awaits)
- [ ] Add `ConfirmDialog` to superadmin Force Sync button and UserManagement toggle active
- [ ] Adopt `useFormErrors` + `FieldError` in UserManagement Create User dialog (currently toast-based validation)
- [ ] Replace inline empty states in sync-issues and UserManagement with shared `EmptyState` component
- [ ] Add skeleton placeholders for superadmin initial health check state
- [ ] Sanitize shop name in export filename (replace special characters)
- [ ] Adopt `appConfig.styles` tokens on staff page (~14 hardcoded teal/gradient/animation instances)
- [ ] Add gradient icon badge to staff page header
- [ ] Remove debug `console.log` from staff page (L115, L132) — production data leak
- [ ] Add self-deactivation guard on staff page — prevent admin toggling own active Switch
- [ ] Add `ConfirmDialog` to staff page toggle-active Switch (one-click deactivation is dangerous)
- [ ] Replace staff page `animate-spin` table loading with `LoadingTable` or `Skeleton` rows
- [ ] Replace staff page inline empty states with shared `EmptyState` component
- [ ] Replace staff page `window.location.reload()` with `refreshProfile()` from AuthContext
- [ ] Adopt `useFormErrors` + `FieldError` in staff edit dialog (currently toast-only validation)

### Phase 2: Premium Upgrades

- [ ] Add backdrop blur to all Dialog/AlertDialog overlays
- [x] ~~Implement Sheet for mobile-friendly analytics drawers~~ (Done — `CategoryBreakdownSheet`)
- [ ] Add staggered fade-in animations for list items
- [ ] Add count-up animation for stat card numbers
- [ ] Implement `toast.success('Deleted', { action: { label: 'Undo', onClick: ... } })` undo pattern
- [ ] Add skeleton-to-content morph transition
- [ ] Apply premium `p-0` dialog pattern to `QrCodeDetailsDialog` and `BillPreviewDialog`

### Phase 3: Enterprise Features

- [x] ~~Drag-to-reorder~~ (Done — `checklists/page.tsx` uses `framer-motion` `Reorder` instead of `@dnd-kit`)
- [ ] Extend drag-to-reorder to other ordered lists (inventory sizes, etc.) using framer-motion `Reorder` pattern
- [ ] Command palette (`Ctrl+K`) for global search
- [ ] Page transition animations with `framer-motion`
- [ ] Pull-to-refresh on PWA
- [ ] Swipe actions on mobile list items

---

> **Last Updated:** February 9, 2026
> **Version:** 2.0
> **Maintainer:** Development Team
