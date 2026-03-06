# Architectural TODO

> Prioritized technical improvements derived from cross-file analysis.  
> Ordered by ROI, not elegance.

---

## Priority Legend

| Tag | Meaning |
|-----|---------|
| 🔴 **Must-do** | Bugs, data integrity, or blocking issues |
| 🟡 **Should-do** | High-value improvements with clear payoff |
| 🟢 **Nice-to-have** | Quality-of-life, only if time permits |

---

## 1. Bug Fixes & Data Integrity

### 🔴 Must-do

- [x] **Fix sales page stats showing page-only totals**
  - *Rationale:* Stats cards display sum of current page, not filtered dataset. Users see wrong revenue/discount totals when paginated.

- [x] **Remove hardcoded "Airoli Store" from TopBar**
  - *Rationale:* Multi-tenant app shows wrong store name for all shops. Should pull from shop settings.

- [x] **Fix "All Time" date filter meaning 1 year**
  - *Rationale:* Inconsistent with user expectation. Either rename to "Last Year" or make truly unlimited.

---

## 2. Utilities & Pure Functions

### 🔴 Must-do

- [x] **Extract `calculateDateRange(filter)` utility**
  - *Rationale:* 3+ pages have identical date calculation logic inline. Single source of truth prevents bugs.

### 🟡 Should-do

- [x] **Generalize `exportToCSV()` utility**
  - *Rationale:* 5 pages have near-identical export code. Existing shared/ExportButton could be enhanced.

- [x] **Create `calculateHours(start, end, breaks)` utility**
  - *Rationale:* Duplicated in AttendanceCard and attendance page. Time math is error-prone.

- [x] **Create `buildPaginationRange(page, size)` utility**
  - *Rationale:* 5 pages calculate `from`/`to` identically. Trivial extraction.

### 🟢 Nice-to-have

- [ ] **Standardize `handleApiError(error)` utility**
  - *Rationale:* Consistent error toasts across app. Lower priority since current approach works.

---

## 3. Custom Hooks

### 🟡 Should-do

- [x] **Extract `useDateFilter` hook**
  - *Rationale:* Combines filter state + date range calculation. 3 pages benefit immediately.

- [x] **Extract `useServerPagination` hook**
  - *Rationale:* 5 pages duplicate page state, reset logic, range calculation. Extract after utility exists.

- [x] **Extract `useSortableTable` hook**
  - *Rationale:* 5 tables have identical toggleSort + direction state. Common UX pattern.

- [x] **Extract `useDebouncedSearch` hook**
  - *Rationale:* 6 pages implement 500ms debounce inline. Already well-understood pattern.

### 🟢 Nice-to-have

- [ ] **Extract `useDialogForm` hook**
  - *Rationale:* 6+ dialogs share open/form/reset/validation lifecycle. Benefit grows with more admin features.

- [ ] **Consider `useShopQuery` wrapper hook**
  - *Rationale:* Auto-apply shop_id filter. RLS already enforces, so this is defense-in-depth only.

---

## 4. UI Components

### 🟡 Should-do

- [x] **Create `<DateFilterTabs>` component**
  - *Rationale:* After `useDateFilter` hook exists, wrap in consistent UI. 2 pages use identical tabs.

- [x] **Create `<StatsCardGrid>` component**
  - *Rationale:* 4 admin pages had 3-4 stat cards with icon/label/value. High visual consistency value.

- [x] **Create `<SortableHeader>` component**
  - *Rationale:* 5 tables have same header + icon + click handler pattern. Small but repetitive.

### 🟢 Nice-to-have

- [ ] **Create `<SearchInput>` with built-in debounce**
  - *Rationale:* Consolidates input + clear button + debounce. Lower priority, hooks may suffice.

- [ ] **Replace browser `confirm()` with branded dialog**
  - *Rationale:* settings page uses native confirm(). Inconsistent UX but functional.

---

## 5. Performance

### 🟡 Should-do

- [x] **Parallelize settings page data fetches**
  - *Rationale:* 5 sequential queries could be `Promise.all`. Faster load, easy fix.

- [x] **Parallelize finances page data fetches**
  - *Rationale:* Multiple sequential queries on page load. Same fix pattern.

- [x] **Separate stats query from list query**
  - *Rationale:* Stats should query full dataset, not current page. Fixes data integrity + allows caching.

### 🟢 Nice-to-have

- [ ] **Consider React Query for data caching**
  - *Rationale:* Would reduce refetches on filter changes. Current approach works at this scale.

---

## 6. Code Organization

### 🟡 Should-do

- [ ] **Move inline Supabase queries to `lib/api/` (Ongoing)**
  - *Status:* API layer exists for Edge Functions and complex operations. Most pages use inline queries for flexibility.
  - *Rationale:* Gradual migration during feature work, not proactive refactor. Prioritize Edge Function wrappers and shared business logic.

- [ ] **Break up 600+ line page components**
  - *Rationale:* finances (1043), checklists (840), qr-codes (950) are hard to maintain. Split during feature work.

### 🟢 Nice-to-have

- [ ] **Add Zod schemas for form validation**
  - *Rationale:* Currently inline validation. Schemas would improve consistency but not blocking.

- [ ] **Type form state properly (no implicit any)**
  - *Rationale:* Many dialogs use loose types. Improves IDE support but runtime is fine.

---

## 7. Infrastructure

### 🟢 Nice-to-have

- [ ] **Add error boundary at layout level**
  - *Rationale:* Page crashes currently show nothing. Low priority since crashes are rare.

- [ ] **Standardize Edge Function error codes**
  - *Rationale:* Consistent error shape would help client-side handling. Current approach works.

---

## Do NOT Do

| Item | Reason |
|------|--------|
| Generic `<DataTable>` with many props | Over-abstraction, harder to customize than hooks |
| Universal `<FormDialog>` component | Forms vary too much, hooks are better fit |
| Abstract Supabase client entirely | Lose type inference and query flexibility |
| Proactive React Query migration | Current approach works at this scale |
| Refactor large pages without feature work | Risk of regression without business value |

---

## Suggested Execution Order

1. **Week 1:** Bug fixes (sales stats, hardcoded store name, date filter naming)
2. **Week 2:** Extract `calculateDateRange` + `useDateFilter` (highest reuse)
3. **Week 3:** Extract pagination utilities + hook
4. **Week 4:** Parallelize fetches in settings/finances
5. **Ongoing:** Extract hooks/components as pages are touched for features

---

*Generated from cross-file analysis on 2026-01-01*



<!-- 
useDialogForm Hook
Immediate Candidates (Dialog Components with Forms):
AttendanceEditDialog.tsx - Has form state for clockIn, clockOut, breakMinutes, reason + validation + submit logic

AttendanceCreateDialog.tsx - Similar form pattern with multiple fields and validation

finances/page.tsx/admin/finances/page.tsx) (lines ~50-72) - Has addExpenseOpen, expenseForm, submitting states that could be consolidated

qr-codes/page.tsx/admin/qr-codes/page.tsx) - Has inline dialog for QR generation with prefix, startNumber, quantity form fields + generating state

inventory/page.tsx/admin/inventory/page.tsx) - Likely has item edit/create dialogs with form state

staff/page.tsx/admin/staff/page.tsx) - Probably has staff creation/edit forms

useShopQuery Hook
Immediate Candidates (Pages with .eq('shop_id', profile.shop_id) patterns):
High Priority (10+ shop_id queries):

qr-codes/page.tsx/admin/qr-codes/page.tsx) - 10 occurrences (lines 70, 256, 274, 345, 391, 436, 441, 447, 453, 459)
finances/page.tsx/admin/finances/page.tsx) - 8 occurrences (lines 87, 109, 124, 159, 217, 268, 305, 364)
inventory/page.tsx/admin/inventory/page.tsx) - 7 occurrences (lines 61, 66, 72, 78, 96, 166, 234, 339)
Medium Priority (2-5 queries):
4. attendance/page.tsx/admin/attendance/page.tsx) - 2 occurrences
5. settings/page.tsx/admin/settings/page.tsx) - 3 occurrences
6. checklists/page.tsx/admin/checklists/page.tsx) - 1 occurrence
7. staff/page.tsx/admin/staff/page.tsx) - 1 occurrence
8. inventory/add-lot/page.tsx/admin/inventory/add-lot/page.tsx) - 2 occurrences
9. superadmin/page.tsx/superadmin/page.tsx) - 5 occurrences

Edge Functions:
10. complete-sale/index.ts - 2 occurrences
11. add-stock-lot/index.ts - 1 occurrence -->