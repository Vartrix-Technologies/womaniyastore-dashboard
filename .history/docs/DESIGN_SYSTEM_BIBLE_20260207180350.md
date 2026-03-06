# 🎨 Womaniya Dashboard — Design System Bible

> The definitive reference for every UI/UX pattern, component standard, and premium interaction in this application.
> Every new page, feature, or AI session should consult this document before writing code.

---

## Table of Contents

1. [Philosophy & Principles](#1-philosophy--principles)
2. [Visual Foundation](#2-visual-foundation)
3. [Component Patterns](#3-component-patterns)
4. [Interaction Patterns](#4-interaction-patterns)
5. [Data Display Patterns](#5-data-display-patterns)
6. [Form Patterns](#6-form-patterns)
7. [Navigation Patterns](#7-navigation-patterns)
8. [Dialog & Modal Patterns](#8-dialog--modal-patterns)
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

**Component:** `StatsCardGrid` from `src/components/shared/StatsCardGrid.tsx`

**When to use:** Any page with summary counts that can act as filters.

```tsx
import { StatsCardGrid, type StatCard } from '@/components/shared/StatsCardGrid';

const stats: StatCard[] = [
  {
    label: 'Total Items',
    value: totalCount,
    icon: Package,
    isActive: statusFilter === 'all',
    activeClassName: 'border-l-teal-500 bg-teal-50 dark:bg-teal-950/30',
    onClick: () => setStatusFilter('all'),
  },
  {
    label: 'Available',
    value: availableCount,
    icon: CheckCircle,
    isActive: statusFilter === 'available',
    activeClassName: 'border-l-green-500 bg-green-50 dark:bg-green-950/30',
    onClick: () => setStatusFilter(statusFilter === 'available' ? 'all' : 'available'),
  },
];

<StatsCardGrid stats={stats} loading={initialLoading} filterHint="Click a card to filter" />
```

**Visual behavior:**
- Active card: `border-l-4` left accent + tinted background
- Inactive cards when any is active: `opacity-50` dimming
- Hover: `scale-[1.02]` subtle lift
- Active press: `scale-[0.98]`
- Click again to deselect (toggle behavior)

**⛔ Don't:** Hand-code stats grids manually. Use `StatsCardGrid`.
**📍 Upgrade needed:** `checklists/page.tsx`, `qr-codes/page.tsx` still use manual grids.

### 3.2 Category Chip Grid (Sub-Filters)

Used below stats cards for category-level drill-down.

```tsx
<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
  {categoryStats.map((stat) => {
    const isActive = categoryFilter === stat.id;
    const anyActive = categoryFilter !== 'all';
    return (
      <button
        key={stat.id}
        className={`p-3 border rounded-lg text-left transition-all ${
          isActive
            ? 'border-l-4 border-l-teal-500 bg-teal-50 shadow-sm'
            : anyActive
              ? 'opacity-50 hover:opacity-80'
              : 'hover:shadow-md hover:bg-teal-50'
        }`}
        onClick={() => setCategoryFilter(isActive ? 'all' : stat.id)}
      >
        <p className="text-lg font-bold">{stat.count}</p>
        <p className="text-xs text-muted-foreground truncate">{stat.name}</p>
      </button>
    );
  })}
</div>
```

**📍 Reference:** `src/app/(protected)/admin/inventory/page.tsx`

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

All interactive buttons must have haptic-style transitions:

```tsx
// Standard CTA button
className="hover:scale-105 active:scale-95 transition-all"

// Subtle variation (for stats cards, less intrusive)
className="hover:scale-[1.02] active:scale-[0.98] transition-all"

// Card hover
className="hover:shadow-lg transition-all"

// Combined for clickable feature cards
className="hover:shadow-lg hover:scale-105 active:scale-95 transition-all cursor-pointer"
```

### 4.2 Gradient Buttons (Primary Actions)

```tsx
// Primary CTA
className="bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-600 hover:to-cyan-700 hover:scale-105 active:scale-95 transition-all"

// Small/compact variant
className="bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-600 hover:to-cyan-700 shrink-0"
```

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

```tsx
<DateRangeFilter
  value={dateRange}
  onChange={setDateRange}
  customRange={customDateRange}
  onCustomRangeChange={setCustomDateRange}
/>
```

Options: Today, This Week, This Month, All Time, Custom (calendar popover).

**⛔ Don't use:** `DateFilterTabs` (older, superseded).

### 5.6 Table Row Status Indicators

Tint the entire row background with a left border accent:

```tsx
<tr className={
  item.status === 'available'
    ? 'bg-gradient-to-r from-green-50/60 via-green-50/30 to-transparent border-l-[3px] border-l-green-500'
    : item.status === 'sold'
      ? 'bg-gradient-to-r from-blue-50/60 via-blue-50/30 to-transparent border-l-[3px] border-l-blue-500'
      : 'bg-gradient-to-r from-red-50/60 via-red-50/30 to-transparent border-l-[3px] border-l-red-500'
}>
```

### 5.7 Active Filter Chips (Dismissible)

Show what's currently filtered and let users remove filters:

```tsx
{hasActiveFilters && (
  <div className="flex flex-wrap gap-2 items-center">
    <span className="text-xs text-muted-foreground">Active filters:</span>
    {statusFilter !== 'all' && (
      <Badge variant="secondary" className="gap-1">
        Status: {statusFilter}
        <button onClick={() => setStatusFilter('all')}>
          <X className="h-3 w-3" />
        </button>
      </Badge>
    )}
    <Button variant="ghost" size="sm" className="text-xs h-6" onClick={clearAllFilters}>
      Clear all
    </Button>
  </div>
)}
```

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

---

## 7. Navigation Patterns

### 7.1 Back Button (Standard)

Every sub-page must have a back button to its parent:

```tsx
<Button variant="ghost" asChild
  className="w-fit -ml-2 text-teal-600 hover:text-teal-700 hover:bg-teal-50">
  <Link href="/admin">
    <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
  </Link>
</Button>
```

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
<div className="space-y-4 md:space-y-6">
  {/* Back button */}
  <Button variant="ghost" asChild className="w-fit -ml-2 text-teal-600 ...">
    <Link href="/admin"><ArrowLeft className="mr-2 h-4 w-4" /> Back</Link>
  </Button>

  {/* Title row */}
  <div className="flex items-center gap-3">
    <div className="p-2.5 rounded-lg bg-gradient-to-br from-teal-500 to-cyan-600 text-white shadow-md">
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

### 8.3 Detail/Preview Dialogs

For read-only detail views (inventory item, QR code, bill):

```tsx
<DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
  <DialogHeader>
    <DialogTitle className="flex items-center gap-2">
      <Icon className="h-5 w-5" /> Item Details
    </DialogTitle>
  </DialogHeader>
  {/* Multi-card layout */}
  <Card>...</Card>
  <Card>...</Card>
</DialogContent>
```

**📍 Reference:** `InventoryItemDetailsDialog.tsx`, `QrCodeDetailsDialog.tsx`, `BillPreviewDialog.tsx`

### 8.4 Backdrop Blur (Premium)

For login/auth pages — frosted glass effect:

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
| `InventoryItemDetailsDialog` | `@/components/shared/InventoryItemDetailsDialog` | Inventory item detail view |
| `SyncStatusIndicator` | `@/components/shared/SyncStatusIndicator` | Online/offline sync status |

### Custom Hooks

| Hook | Import | Purpose |
|------|--------|---------|
| `useServerPagination` | `@/hooks` | Server-side pagination state |
| `useSortableTable` | `@/hooks` | Sort column + direction state |
| `useDebouncedSearch` | `@/hooks` | Debounced search input |
| `useOfflineStatus` | `@/hooks/useOfflineStatus` | Online/offline detection |
| `useSyncStatus` | `@/hooks/useSyncStatus` | Sync queue status |

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
| Manual stats card grids | `StatsCardGrid` component |
| `DateFilterTabs` | `DateRangeFilter` (newer, with Custom option) |
| Text arrows `↑`/`↓` for reorder | `ChevronUp`/`ChevronDown` icons |
| `onRefresh()` after optimistic reorder | Only call on failure to revert |
| Supabase `.update()` in try/catch without checking `{ error }` | Check `result.error` — Supabase client doesn't throw |

### 🗑️ Files to Clean Up

| File | Status | Action |
|------|--------|--------|
| `checklists/page-old.tsx` | Dead code | Delete |
| `DateFilterTabs.tsx` | Superseded | Delete after confirming no imports |
| `.history/` folder entries | Auto-generated | Gitignore |

---

## 13. Upgrade Roadmap

### Phase 1: Consistency (Apply existing patterns everywhere)

- [ ] Replace manual stats grids in `checklists/page.tsx` and `qr-codes/page.tsx` with `StatsCardGrid`
- [ ] Adopt `EmptyState` component across all pages (currently only attendance uses it)
- [ ] Adopt `LoadingTable` component (currently unused)
- [ ] Delete `checklists/page-old.tsx`
- [ ] Delete `DateFilterTabs.tsx`
- [ ] Replace layout `animate-spin` spinners with skeleton screens

### Phase 2: Premium Upgrades

- [ ] Add backdrop blur to all Dialog/AlertDialog overlays
- [ ] Implement bottom `Sheet` for mobile form dialogs
- [ ] Add staggered fade-in animations for list items
- [ ] Add count-up animation for stat card numbers
- [ ] Implement `toast.success('Deleted', { action: { label: 'Undo', onClick: ... } })` undo pattern
- [ ] Add skeleton-to-content morph transition

### Phase 3: Enterprise Features

- [ ] Drag-to-reorder with `@dnd-kit`
- [ ] Command palette (`Ctrl+K`) for global search
- [ ] Page transition animations with `framer-motion`
- [ ] Pull-to-refresh on PWA
- [ ] Swipe actions on mobile list items

---

> **Last Updated:** February 7, 2026
> **Version:** 1.0
> **Maintainer:** Development Team
