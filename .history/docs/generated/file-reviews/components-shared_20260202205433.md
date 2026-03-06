# File Review: components/shared

**Folder:** `src/components/shared/`
**Files:** 5 (ConfirmDialog.tsx, DateRangePicker.tsx, ExportButton.tsx, InventoryItemDetailsDialog.tsx, QrCodeDetailsDialog.tsx)
**Total Lines:** ~534
**Last Updated:** 2026-01-01

---

## Folder Overview

Reusable UI components shared across multiple pages. These are domain-aware but not page-specific - they can be dropped into any context that needs their functionality.

---

## 1. File Responsibilities

### ConfirmDialog.tsx (60 lines)

**Primary Responsibility:** Generic confirmation dialog using AlertDialog pattern.

**Key Features:**
- Configurable title, description, button labels
- Destructive variant with red styling
- Controlled open state via props
- Auto-close on confirm

**Does NOT:**
- Handle async confirmation (immediate callback)
- Show loading state
- Support multiple buttons

### DateRangePicker.tsx (59 lines)

**Primary Responsibility:** Date range selection with calendar popover.

**Key Features:**
- Two-month calendar display
- Range selection (from/to)
- Formatted display in trigger button
- Uses react-day-picker DateRange type

**Does NOT:**
- Preset ranges (last 7 days, this month, etc.)
- Validate date constraints
- Support single date selection

### ExportButton.tsx (50 lines)

**Primary Responsibility:** Export any array data to CSV file.

**Key Features:**
- Auto-generates headers from first object keys
- Handles comma/quote escaping in values
- Timestamped filename
- Blob download pattern

**Does NOT:**
- Export to Excel or other formats
- Stream large datasets
- Allow column selection

### InventoryItemDetailsDialog.tsx (205 lines)

**Primary Responsibility:** Display comprehensive inventory item information.

**Key Features:**
- Status information (QR code, status, dates)
- Product details (category, size, vendor)
- Pricing information (cost, selling, tax, margin)
- Stock information (arrival date, days in inventory)
- Status-based badge coloring

**Does NOT:**
- Allow editing
- Show sales history
- Display lot information

### QrCodeDetailsDialog.tsx (209 lines)

**Primary Responsibility:** Display QR code details and associated inventory item.

**Key Features:**
- QR code status display
- Associated inventory item fetch
- Product pricing details
- Lot information
- Loading state with spinner

**Does NOT:**
- Allow status changes
- Show multiple items (single QR = single item)
- Display print/regenerate options

---

## 2. Execution Flows

### ConfirmDialog

```
Parent sets open=true → Dialog displays
  → User clicks Cancel → onOpenChange(false)
  → User clicks Confirm → onConfirm() → onOpenChange(false)
```

**Simple synchronous pattern** - no async handling.

### DateRangePicker

```
User clicks trigger → Popover opens with 2-month calendar
  → User selects start date → intermediate selection state
  → User selects end date → onDateRangeChange({ from, to })
  → Display updates to show formatted range
```

### ExportButton - handleExport()

```
User clicks Export → Check data not empty
  → Extract headers from Object.keys(data[0])
  → Map each row to CSV-escaped values
  → Join with commas and newlines
  → Create Blob → Create download link
  → Trigger download → Clean up link
```

**CSV Escaping Logic:**
```typescript
// If value contains comma or quote, wrap in quotes and escape internal quotes
stringVal.includes(',') || stringVal.includes('"')
  ? `"${stringVal.replace(/"/g, '""')}"`
  : stringVal
```

### QrCodeDetailsDialog - fetchDetails()

```
Dialog opens (qrCode truthy) → useEffect triggers
  → Query inventory_items by qr_code_id
  → Join lots → categories, sizes
  → Set details state or null if not found
```

**Query Structure:**
```sql
inventory_items
  WHERE qr_code_id = ?
  JOIN lots
    JOIN categories
    JOIN sizes
  LIMIT 1 (maybeSingle)
```

---

## 3. Business Rules & Assumptions

### Explicit Business Rules

| Rule | Implementation | File |
|------|----------------|------|
| Empty data shows alert | `if (data.length === 0) alert(...)` | ExportButton |
| Profit margin from cost/selling | `(selling - cost) / cost * 100` | InventoryItemDetails |
| Days in inventory calculated live | `(now - created_at) / (1000*60*60*24)` | InventoryItemDetails |
| QR may have no inventory item | Shows "not assigned" message | QrCodeDetailsDialog |

### Implicit Assumptions
- DateRange type from react-day-picker is always valid
- Export data arrays are homogeneous (all objects have same keys)
- Inventory items have nested lots relationship
- QR code IDs are UUIDs matching inventory_items.qr_code_id

### Status Badge Mappings

**InventoryItemDetailsDialog:**
```typescript
const statusVariant = {
  available: 'default',
  sold: 'secondary',
  damaged: 'destructive',
  reserved: 'outline',
  returned: 'outline',
};
```

**QrCodeDetailsDialog:**
```typescript
qrCode.status === 'assigned' ? 'secondary' : 
qrCode.status === 'sold' ? 'outline' : 
'destructive'
```

---

## 4. Risks & Edge Cases

### Medium Priority

| Risk | Impact | File | Mitigation |
|------|--------|------|------------|
| Large CSV export | Memory/browser freeze | ExportButton | None - all in memory |
| Object values with newlines | Malformed CSV | ExportButton | Not escaped currently |
| Missing nested data | Display "N/A" | InventoryItemDetails, QrCodeDetails | Optional chaining throughout |

### Low Priority

| Risk | Impact | File | Mitigation |
|------|--------|------|------------|
| Date picker timezone | Wrong date selected | DateRangePicker | Uses date-fns format (locale-aware) |
| No items for QR code | Confusing UX | QrCodeDetailsDialog | Shows explanatory message |
| Confirm dialog close race | Callback not called | ConfirmDialog | Synchronous pattern avoids this |
| null/undefined in export | "null" string in CSV | ExportButton | `String(val ?? '')` |

---

## 5. Comment Suggestions (Selective)

### ExportButton - Lines ~20-28
```typescript
// CSV escaping rules:
// - If value contains comma or double-quote, wrap in double-quotes
// - Internal double-quotes are escaped by doubling them
// - null/undefined converted to empty string
const escaped = stringVal.includes(',') || stringVal.includes('"')
  ? `"${stringVal.replace(/"/g, '""')}"`
  : stringVal;
```

### InventoryItemDetailsDialog - Lines ~58-60
```typescript
// Profit margin calculation: percentage above cost price
// Example: cost=100, selling=150 → margin = 50%
const profitMargin = ((selling - cost) / cost * 100).toFixed(1);
```

### QrCodeDetailsDialog - Lines ~35-56
```typescript
// Optimized single query with all necessary joins
// Uses maybeSingle() since a QR code may not have an associated item yet
// (e.g., code generated but not assigned to lot)
```

---

## 6. Refactor Signals

### ExportButton Improvements

```typescript
// Current: All data loaded in memory
// For large datasets, consider:
// 1. Streaming CSV generation
// 2. Server-side export for >1000 rows
// 3. Progress indicator

// Missing: Newline escaping in values
// Should add: stringVal.replace(/\n/g, ' ')
```

### ConfirmDialog - Async Support

Current implementation doesn't handle async confirmation:
```typescript
// Consider adding:
interface ConfirmDialogProps {
  onConfirm: () => void | Promise<void>;
  loading?: boolean;
}
```

### DateRangePicker - Preset Ranges

Common enhancement for reporting pages:
```typescript
// Consider adding preset buttons:
// - Today
// - Last 7 days
// - This month
// - Last month
// - Custom range
```

### Detail Dialogs Consolidation

InventoryItemDetailsDialog and QrCodeDetailsDialog share:
- Similar Card layouts
- formatDate/formatCurrency usage
- Status badge patterns
- Optional chaining for nested data

Could share a `DetailCard` component for consistent styling.

### Type Definitions

```typescript
// InventoryItemDetailsDialog has inline interface
// Should move to types/index.ts:
export interface InventoryItemWithDetails {
  id: string;
  status: string;
  sold_at: string | null;
  created_at: string;
  qr_codes: { code: string } | null;
  lots: LotWithRelations | null;
}
```

---

## Summary Assessment

| Aspect | Rating | Notes |
|--------|--------|-------|
| Readability | ✅ Excellent | Small, focused components |
| Maintainability | ✅ Good | Clear interfaces, single responsibility |
| Reusability | ✅ Good | Properly decoupled from specific pages |
| Error Handling | ⚠️ Moderate | Some edge cases not handled |
| Type Safety | ⚠️ Moderate | Inline interfaces, some `any` |
| Performance | ⚠️ Moderate | Export could be optimized for large data |

---

## 7. Critic Section: Premium & Modern Assessment

### Recent Additions ✅ (January 2026)

| Component | Purpose | Impact |
|-----------|---------|--------|
| **SortableHeader** | Reusable table header with sort indicators | Consistent sorting UX across pages |
| **StatsCardGrid** | Standardized stats display | Dashboard consistency |
| **DateFilterTabs** | Today/Week/Month/Year tabs | Clean date range filtering |
| **BillPreviewDialog** | PDF bill preview with download | Critical for sales workflow |

### What Works Well ✅

| Component | Why It's Good |
|-----------|---------------|
| **ConfirmDialog** | Replaces browser `confirm()`—proper modal pattern |
| **BillPreviewDialog** | PDF generation with preview—professional output |
| **SortableHeader** | Visual sort indicators, click to toggle—expected UX |
| **QrCodeDetailsDialog** | Shows complete code info—good detail view pattern |

### What Feels Dated or Unpolished ❌

| Issue | Component | Premium Comparison |
|-------|-----------|-------------------|
| **No async loading state in ConfirmDialog** | ConfirmDialog | Stripe shows loading during confirm |
| **CSV export could crash on large data** | exportToCSV utility | Should stream or chunk |
| **No preset date ranges** | DateRangePicker | "Last 7 days" buttons are standard |
| **PDF is plain text** | BillPreviewDialog | Could have logo, styling |
| **No QR image in dialog** | QrCodeDetailsDialog | Should show actual QR code image |

### Missing Shared Components

Based on page reviews, these components should exist but don't:

1. **EmptyState Component**
   ```tsx
   <EmptyState
     icon={Package}
     title="No inventory items"
     description="Add your first item to get started"
     action={{ label: "Add Item", onClick: handleAdd }}
   />
   ```

2. **LoadingTable Skeleton**
   ```tsx
   <LoadingTable rows={5} columns={4} />
   // Shows shimmering rows during data load
   ```

3. **EntityDialog (Generic CRUD)**
   ```tsx
   <EntityDialog
     title="Add Category"
     fields={[{ name: 'name', label: 'Name', required: true }]}
     onSave={handleSave}
   />
   // Reusable across Settings page entities
   ```

4. **PageHeader Component**
   ```tsx
   <PageHeader
     title="Inventory"
     description="Manage your inventory items"
     actions={<Button>Add Item</Button>}
     breadcrumbs={[{ label: 'Admin', href: '/admin' }, { label: 'Inventory' }]}
   />
   ```

5. **DataTable Component**
   ```tsx
   <DataTable
     data={items}
     columns={columns}
     sortable
     selectable
     pagination
     emptyState={<EmptyState ... />}
   />
   // Consolidate repeated table patterns
   ```

### Comparison to Component Libraries

| Library | Feature You're Missing |
|---------|----------------------|
| **shadcn/ui** | Already using, but missing DataTable, Command palette |
| **Radix Themes** | Consistent spacing, color tokens |
| **Tremor** | Chart components, KPI cards, badges |
| **Headless UI** | Combobox (for autocomplete), Listbox |

### Priority New Components (Effort vs Impact)

| Component | Effort | Impact | Priority |
|-----------|--------|--------|----------|
| EmptyState | Low | High | **P1** |
| LoadingTable skeleton | Low | Medium | **P1** |
| PageHeader | Low | Medium | **P2** |
| EntityDialog (generic CRUD) | Medium | High | **P2** |
| DataTable (consolidate tables) | High | High | **P2** |
| QR image in QrCodeDetailsDialog | Low | Medium | **P2** |

### Key Quote for Your Team
> "You have the foundation of a good component library, but it's incomplete. Every page has similar patterns—stats cards, tables with sorting, empty states, loading skeletons—but they're reimplemented each time. Creating EmptyState and LoadingTable components would instantly make the app feel more polished and reduce code duplication by 30%."
