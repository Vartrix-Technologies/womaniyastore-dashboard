# File Review: src/app/(protected)/admin/settings/page.tsx

**Last Updated**: February 9, 2026  
**Lines of Code**: 250 orchestrator + ~1,367 across 5 tab components (~1,617 total; was 887-line monolith at v1.0)  
**Version**: 2.0 (Checklist-scored rewrite)  
**Checklist Score**: **25/40** — needs polish  
**Applicable Sections**: 8 of 12 (Settings is a configuration page — Stats Cards, Date Filtering, Filter Toolbar, Table/Pagination are N/A)  
**Recent Changes**: Massive refactor — 887-line monolith split into 250-line orchestrator + 5 extracted tab component files. `Promise.all()` parallel loading. `ConfirmDialog` replaces all `confirm()`. Dirty state tracking with "Unsaved changes" bar. Optimistic reorder for sizes. Mobile `Select` dropdown for tabs. Quick-add inline pattern. QR Prefixes tab added (6th tab).

---

## 1. File Responsibility

**Primary Purpose**: Settings orchestrator — manages tab navigation, parallel data loading, and routes to 6 extracted tab components for shop configuration, categories, sizes, expense categories, tax settings, and QR prefixes.

**Role in the System:**  
Central configuration hub for shop owners/admins. Each tab delegates CRUD operations to its own component. The orchestrator handles initial data fetch via `Promise.all()`, silent `refreshData()` for children, and role-based access gating (staff sees placeholder).

**What This File Intentionally Does NOT Do:**
- Does NOT contain any CRUD logic — delegated to tab components
- Does NOT manage form state — each tab owns its own state
- Does NOT handle validation — delegated to children
- Does NOT persist tab selection (resets to "shop" on refresh)
- Does NOT use `appConfig` — hardcoded teal throughout (known debt)

**Key Dependencies:**
| Dependency | Purpose |
|-----------|---------|
| `@/components/admin/settings/ShopTabs` | `ShopDetailsTab` + `TaxSettingsTab` (ship details, tax rate) |
| `@/components/admin/settings/CategoriesTab` | Product category CRUD (quick-add, edit dialog, delete) |
| `@/components/admin/settings/SizesTab` | Size CRUD (inline edit, optimistic reorder, quick-add) |
| `@/components/admin/settings/ExpenseCategoriesTab` | Expense category CRUD (inline edit, orphan check on delete) |
| `@/components/admin/settings/QrPrefixesTab` | QR prefix CRUD (regex validation, active/inactive toggle) |
| `@/lib/api/qr-prefixes` | `fetchQrPrefixes` API function |
| `@/context/AuthContext` | `profile.shop_id`, `profile.role` |
| `@/lib/supabase` | Direct DB access for 4 parallel queries |
| `sonner` | Toast notifications |

### Tab Component Summary

| File | Lines | Patterns | Notable |
|------|-------|----------|---------|
| `ShopTabs.tsx` | ~270 | Form + dirty state + discard/save bar | Icon-labeled fields, `isDirty` check, amber warning |
| `CategoriesTab.tsx` | ~250 | Quick-add + edit Dialog + ConfirmDialog | Teal dot indicator per item, description support |
| `SizesTab.tsx` | ~295 | Quick-add + inline edit + optimistic reorder | `ChevronUp`/`ChevronDown` arrows, background DB persist |
| `ExpenseCategoriesTab.tsx` | ~250 | Quick-add + inline edit + ConfirmDialog | Orphan check: `financial_transactions` count before delete |
| `QrPrefixesTab.tsx` | ~302 | Dialog CRUD + Switch toggle + regex validation | Card grid layout, active/inactive states, `validateFormat` regex |

---

## 2. Execution Flow

### Initial Load Sequence
1. Component mounts → extract `profile.shop_id` from auth context
2. `useEffect` triggers `loadData()` when `profile.shop_id` available
3. `Promise.all()` — **4 parallel queries**: shop, categories, sizes, expense_categories
4. Separate `fetchQrPrefixes()` call after Promise.all (API function, not raw Supabase)
5. UI renders with layout-matching skeleton during loading
6. Default tab: "shop" (Shop Details)

### loadData() (Lines 55–91)
```
Promise.all([
  shops.select('*').eq('id', shopId).single(),
  categories.select('*').eq('shop_id', shopId).order('name'),
  sizes.select('*').eq('shop_id', shopId).order('sort_order'),
  expense_categories.select('*').eq('shop_id', shopId).order('name'),
])
→ fetchQrPrefixes(shopId)  // separate API call
```
**v1 → v2 fix**: Was 4 sequential `await` calls, now parallel. Load time = slowest query.

### refreshData() (Lines 94–120)
Silent re-fetch **without** loading skeleton — called by children via `onRefresh` prop after any CRUD operation. Identical queries to `loadData()` but no `setLoading(true)`.

### Tab Navigation
- `activeTab` state managed by `useState('shop')` — not URL-based, resets on refresh
- Mobile: `Select` dropdown (`sm:hidden`) — all 6 tabs in one tap
- Desktop: `TabsList` (`hidden sm:inline-flex`) — horizontal bar with active accent
- Each `TabsContent` renders conditionally when `shop && shopId` truthy

### Role-Based Access
- **Staff**: `profile?.role === 'staff'` → shows placeholder "Staff settings coming soon"
- **Admin/Owner**: All 6 tabs visible + content rendered

---

## 3. Business Rules & Assumptions

**Explicit Rules:**
| Rule | Implementation | Location |
|------|----------------|----------|
| Shop name required | `.trim()` check before save | `ShopDetailsTab` |
| Tax rate 0–100 | HTML `min={0} max={100}` | `TaxSettingsTab` (client-only) |
| QR prefix format | Regex `/^[A-Z0-9]+(-[A-Z0-9]+)+$/` | `QrPrefixesTab` |
| Expense category safe delete | Checks `financial_transactions` count before delete | `ExpenseCategoriesTab` |
| QR prefix safe delete | Foreign key constraint (`23503`) catches usage | `QrPrefixesTab` |
| QR prefix uniqueness | Database unique constraint (`23505`) | `QrPrefixesTab` |
| Size ordering | Optimistic local swap → background `Promise.all` DB updates | `SizesTab` |
| Dirty state guard | Save bar only visible when `isDirty` is true | `ShopDetailsTab`, `TaxSettingsTab` |

**Implicit Assumptions:**
- Single shop context — all queries scoped by `shop_id` (RLS enforced)
- Low data volume — all entities loaded at once (no pagination needed for config data)
- Tab state not persisted — resets to "shop" on page revisit
- No audit log — changes not tracked (who changed tax rate when?)
- QR prefix `display_order` set to `qrPrefixes.length` (append to end)

**What's Protected vs. What's Not:**
| Entity | Orphan Check | Risk |
|--------|-------------|------|
| Expense Categories | ✅ Checks `financial_transactions` | Safe |
| QR Prefixes | ✅ Foreign key constraint | Safe |
| Product Categories | ❌ **No check** | May orphan `lots` items |
| Sizes | ❌ **No check** | May orphan `inventory_items` |
| Shop name/prefix | ❌ No validation on change impact | Bill prefix change doesn't update existing bills |

---

## 4. PAGE_ANALYSIS_CHECKLIST — Detailed Scoring

> **Note:** Settings is a configuration page, not a data/analytics page. Sections §3 (Stats Cards), §4 (Date Filtering), §5 (Filter Toolbar), §6 (Table & Data Display) are **N/A**. Scoring includes the orchestrator page AND all 5 child tab components as a system.

### ✅ = Pass · ⚠️ = Partial · ❌ = Fail · N/A = Not Applicable

### §1 Config-Driven Theming — **2/10** ❌

| Check | Status | Detail |
|-------|--------|--------|
| Imports `appConfig`, aliases `const s = appConfig.styles` | ❌ | Not imported on main page or ANY child component |
| Gradients use `s.primaryGradient` | ❌ | Hardcoded `bg-gradient-to-r from-teal-500 to-cyan-600` in every child (SizesTab L275, ShopTabs L162+247, CategoriesTab L187+229, ExpenseCategoriesTab L221, QrPrefixesTab L151+182+282) |
| Icon colors use tokens | ❌ | Hardcoded `text-teal-600` (SizesTab L212, ExpenseCategoriesTab L160, main page L161) |
| Hover states use tokens | ❌ | Hardcoded `hover:text-teal-700 hover:bg-teal-50` on back button (L161) |
| Button animations use `s.btnAnimation` | ❌ | No animation tokens on any button — no `hover:scale-105 active:scale-95` anywhere |
| Tab active state uses tokens | ❌ | Complex hardcoded `data-[state=active]:border-teal-300 bg-teal-50 text-teal-700` with dark mode variants (L205) |
| Select border uses tokens | ❌ | Hardcoded `border-teal-200 dark:border-teal-800` (L183) |
| Zero hardcoded teal classes | ❌ | **40+ instances** across 6 files: 6 on main page, 34 in child components |

### §2 Page Header — **8/10** ✅

| Check | Status | Detail |
|-------|--------|--------|
| Heading `text-2xl font-bold` | ✅ | L170 `text-2xl font-bold tracking-tight` |
| Subtitle `text-sm text-muted-foreground` | ✅ | L171 |
| Icon next to heading | ✅ | `Settings` icon (L168) |
| Gradient icon badge | ✅ | `p-2 bg-gradient-to-br from-teal-500 to-cyan-600 rounded-lg` wrapping `Settings` icon — correct pattern, just not tokenized |
| Header responsive layout | ✅ | Clean `flex items-center gap-3` |
| Back button present | ✅ | `variant="ghost"`, `-ml-2`, `router.push('/admin')` — not `window.history.back()` |
| Back button tokenized | ⚠️ | Hardcoded `text-teal-600 hover:text-teal-700 hover:bg-teal-50` — should be `s.linkColor` / `s.linkHover` |

### §3 Stats Cards — **N/A**
Settings page has no stats cards. Config data, not analytics.

### §4 Date Filtering — **N/A**
No date filtering on settings page.

### §5 Filter Toolbar & Chips — **N/A**
No filtering (aside from tab navigation).

### §6 Table & Data Display — **N/A**
Settings uses card-based lists, not tables. No pagination needed (low volume config data).

### §7 Dialogs & Sheets — **7/10** ✅

| Check | Status | Detail |
|-------|--------|--------|
| `ConfirmDialog` for ALL destructive actions | ✅ | CategoriesTab, SizesTab, ExpenseCategoriesTab, QrPrefixesTab — all 4 use it |
| No `confirm()` anywhere | ✅ | Verified with grep — zero instances across all 6 files |
| Edit dialogs properly controlled | ✅ | CategoriesTab + QrPrefixesTab use `Dialog` with `open`/`onOpenChange` |
| Dialog content appropriate | ✅ | Edit forms with labels, inputs, cancel/confirm buttons |
| `sm:max-w-md` sizing | ✅ | Both CategoriesTab and QrPrefixesTab dialogs |
| `FieldError` for inline validation | ❌ | Not used in ANY dialog — errors are toast-only |
| `useFormErrors` hook | ❌ | Not imported anywhere |
| Premium `p-0` dialog pattern | ❌ | Standard dialog styling throughout |
| *(Deduction)* No form-level disabled state | ⚠️ | Dialog save button not disabled while saving (missing `saving` guard in some dialogs) |

### §8 Mobile Responsiveness — **9/10** ✅

| Check | Status | Detail |
|-------|--------|--------|
| Page wrapper `space-y-4 md:space-y-6` | ✅ | L155 |
| Loading skeleton matches layout | ✅ | L128–149: animated pulse skeleton (not text-only) |
| **Responsive tabs** | ✅ | **Premium pattern**: Mobile `Select` dropdown (`sm:hidden`) + Desktop `TabsList` (`hidden sm:inline-flex`) — all 6 tabs accessible on any screen |
| Form grids collapse | ✅ | ShopDetailsTab: `grid-cols-1 sm:grid-cols-2 gap-4` |
| Card grids collapse | ✅ | QrPrefixesTab: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` |
| Touch targets adequate | ✅ | Action buttons h-7/h-8, inputs h-10/h-11, quick-add buttons sized |
| Inline edit touch-friendly | ✅ | SizesTab/ExpenseCategoriesTab: Check/X buttons for confirm/cancel inline edit |
| Quick-add Enter key support | ✅ | All tabs: `onKeyDown={(e) => e.key === 'Enter' && handleQuickAdd()}` |
| *(Deduction)* Tab select border | ⚠️ | Mobile Select trigger uses hardcoded `border-teal-200` — should be tokenized |

### §9 Typography — **9/10** ✅

| Check | Status | Detail |
|-------|--------|--------|
| Page heading `text-2xl font-bold` | ✅ | L170 |
| Card titles `text-lg font-semibold` | ✅ | Consistent across all 5 tab components |
| Body text `text-sm` | ✅ | Descriptions, subtitle, muted text |
| Label pattern premium | ✅ | `text-xs font-medium uppercase tracking-wide text-muted-foreground flex items-center gap-1.5` — icon-labeled fields in ShopTabs |
| Required field indicator | ✅ | `<span className="text-red-400">*</span>` on all required fields |
| Font hierarchy clear | ✅ | Title → Card title → Label → Body → Muted description |
| `font-mono` on code-like fields | ✅ | Bill prefix input, QR prefix input, order numbers in SizesTab |
| Badge count indicators | ✅ | All list tabs show count badge: `<Badge variant="secondary">{count}</Badge>` |
| *(Deduction)* No `tabular-nums` | ⚠️ | Tax rate input and sort order numbers could use `tabular-nums` |

### §10 Interactions & Touch — **7/10** ✅

| Check | Status | Detail |
|-------|--------|--------|
| Primary CTA uses gradient | ✅ | All save/add buttons use `bg-gradient-to-r from-teal-500 to-cyan-600` |
| **Dirty state tracking** | ✅ | `ShopDetailsTab` + `TaxSettingsTab`: `isDirty` computed from form vs props, amber "You have unsaved changes" bar with Discard + Save |
| Loading states on save | ✅ | `<Loader2 className="animate-spin" />` on all save buttons with `disabled={saving}` |
| **Optimistic reorder** | ✅ | SizesTab: `ChevronUp`/`ChevronDown` swap local array instantly, background `Promise.all` DB persist, revert on failure |
| Quick-add focus persistence | ✅ | `inputRef.current?.focus()` after add — cursor returns to input for rapid entry |
| Row hover feedback | ✅ | `hover:bg-muted/40 transition-colors` on all list items |
| Edit inline cancel | ✅ | Escape key closes inline edit (SizesTab, ExpenseCategoriesTab) |
| `ConfirmDialog` destructive variant | ✅ | `variant="destructive"` with red confirm button |
| *(Deduction)* No `hover:scale-105` on CTAs | ⚠️ | No animation tokens on any button — missing `s.btnAnimation` |
| *(Deduction)* No QR prefix toggle animation | ⚠️ | `Switch` toggle is instant — no transition feedback beyond toast |

### §11 Empty & Error States — **6/10** ⚠️

| Check | Status | Detail |
|-------|--------|--------|
| Empty state per tab | ✅ | CategoriesTab: `Package` icon, SizesTab: `Layers` icon, ExpenseCategoriesTab: `Wallet` icon, QrPrefixesTab: `QrCode` icon |
| Empty state messaging | ✅ | Contextual per tab (e.g., "Add categories to start organizing products", "Add sizes below — they'll appear at the POS in this order") |
| Empty state layout | ✅ | `rounded-full bg-muted p-4 mb-4` icon container + `font-medium text-sm` title + `text-xs text-muted-foreground` description |
| CTA in empty state | ⚠️ | Only QrPrefixesTab has "Create First Prefix" button. Others point to quick-add below but no direct CTA |
| Uses shared `EmptyState` component | ❌ | All inline empty states — not using shared `EmptyState` from `@/components/shared/EmptyState` |
| Error state on load failure | ⚠️ | Toast only (`toast.error('Failed to load settings')`) — no visual error state / retry button |
| Staff placeholder | ⚠️ | "Staff settings coming soon" — no icon, no styling, plain `text-sm text-muted-foreground` |
| Toast feedback on all CRUD ops | ✅ | Add, edit, delete, save, toggle — all have success/error toasts |

### §12 Core Rules — **7/10** ✅

| Check | Status | Detail |
|-------|--------|--------|
| No `confirm()` / `alert()` / `prompt()` | ✅ | Zero instances — all replaced with `ConfirmDialog` |
| No client-side filtering large datasets | ✅ | N/A — config data, low volume |
| `Promise.all` for parallel loading | ✅ | 4 parallel Supabase queries in `loadData()` |
| `refreshData()` silent re-fetch | ✅ | No loading skeleton on refresh — smooth UX |
| Router navigation for back | ✅ | `router.push('/admin')` — not `window.history.back()` |
| Toast via sonner | ✅ | Throughout all components |
| Expense category orphan check | ✅ | Checks `financial_transactions` count before delete |
| QR prefix foreign key protection | ✅ | Catches `23503` error on delete |
| *(Deduction)* No orphan check for categories | ❌ | Can delete category with associated `lots` — data integrity risk |
| *(Deduction)* No orphan check for sizes | ❌ | Can delete size with associated `inventory_items` — data integrity risk |
| *(Deduction)* No `FieldError` validation | ⚠️ | Only basic toast errors — no inline field-level validation |
| *(Deduction)* No unique name enforcement | ⚠️ | Can create duplicate category/size names — confusing UX |
| *(Deduction)* Tax rate not range-validated in code | ⚠️ | HTML `min/max` only — not enforced in handler (can bypass with devtools) |

---

## 5. Checklist Score Summary

> Scoring prorated for 8 applicable sections (§3, §4, §5, §6 are N/A).

| Metric | Score | Notes |
|--------|-------|-------|
| Config compliance (no hardcoded colors) | **2/10** | No `appConfig` anywhere. 40+ hardcoded teal/gradient instances across 6 files. Worst among reviewed pages. |
| Mobile responsiveness | **9/10** | Premium responsive tabs (Select on mobile, TabsList on desktop). Responsive grids, skeleton, touch targets. |
| Design consistency | **7/10** | `ConfirmDialog` ✅, premium typography ✅, dirty state tracking ✅, consistent empty states ✅. Missing `FieldError`, shared `EmptyState`. |
| Interaction quality | **7/10** | Optimistic reorder ✅, quick-add ✅, inline edit ✅, dirty state with Discard ✅. Missing orphan checks, CTA animations. |
| **Overall** | **25/40** | **Needs polish** |

---

## 6. What Changed Since v1.0 Review

| Area | v1.0 (887 lines monolith) | v2.0 (250 + 5 components) | Status |
|------|--------------------------|---------------------------|--------|
| Architecture | Single 887-line file, all tabs inline | 250-line orchestrator + 5 extracted tab components | ✅ **Major improvement** |
| Tab count | 5 tabs (no QR prefixes) | 6 tabs (added QR Prefixes + Wallet icon for expenses) | ✅ Feature added |
| Data loading | 4 sequential `await` calls | `Promise.all()` for parallel queries | ✅ **Fixed** (was P1 risk) |
| Delete confirmation | 3× `confirm('Are you sure...')` | `ConfirmDialog` shared component (all 4 CRUD tabs) | ✅ **Fixed** (was P1 risk) |
| Loading state | Text-only loading | Layout-matching skeleton with `animate-pulse` | ✅ **Fixed** |
| Back navigation | `window.history.back()` | `router.push('/admin')` | ✅ **Fixed** |
| Dirty state tracking | Not implemented | `isDirty` + amber "Unsaved changes" bar + Discard button | ✅ **Added** (premium) |
| Size reordering | Manual sort_order number editing | `ChevronUp`/`ChevronDown` optimistic reorder | ✅ **Added** (premium) |
| Inline editing | Not supported | SizesTab + ExpenseCategoriesTab inline edit with Enter/Escape | ✅ **Added** |
| Quick-add pattern | Not supported | All list tabs have `Plus` icon + Input + Enter key quick-add | ✅ **Added** (premium) |
| QR prefix validation | N/A | Regex `/^[A-Z0-9]+(-[A-Z0-9]+)+$/` | ✅ **Added** |
| Silent refresh | Not supported | `refreshData()` — no skeleton on child CRUD ops | ✅ **Added** |
| `appConfig` tokens | Not used | Still not used | ❌ Still open |
| `FieldError` validation | Not used | Still not used | ❌ Still open |
| Category orphan check | Missing | Still missing | ❌ Still open |
| Size orphan check | Missing | Still missing | ❌ Still open |
| Unique name enforcement | Missing | Still missing | ❌ Still open |
| Shared `EmptyState` | Inline | Still inline (but consistent pattern) | ❌ Still open |
| Tab state persistence | Not persistent | Still not persistent (resets to "shop") | ❌ Still open |

---

## 7. Key Differences from Other Pages

### 7.1 Configuration Page (Not Data Page)
Settings is fundamentally different from data pages (inventory, sales, finances). No stats cards, no date filtering, no server-side pagination, no table sorting. The "data" is low-volume configuration entities (usually <50 items per tab). Many checklist sections (§3–§6) are N/A.

### 7.2 Orchestrator + Tab Components Architecture
At 250 lines, the main page is now a **lean orchestrator** — state management, parallel data loading, tab routing. All CRUD logic lives in 5 dedicated tab components. This is the **most cleanly extracted** admin page in the codebase.

**Contrast with other pages:**
- Checklists: 939 lines, single file (monolith)
- Attendance: ~827 lines, single file (monolith)
- Settings: 250 lines orchestrator + 5 components (~1,617 total but well-separated)

### 7.3 Dirty State Tracking (Unique)
Only page with `isDirty` + "Unsaved changes" amber bar + Discard button. ShopDetailsTab and TaxSettingsTab both implement this pattern:
```tsx
const isDirty = form.shop_name !== shop.shop_name || ...;
{isDirty && <div className="...amber-600...">"You have unsaved changes" + Discard + Save</div>}
```
This is documented in Bible §6.3. Premium pattern not yet on other form pages.

### 7.4 Optimistic Reorder (SizesTab)
SizesTab uses `ChevronUp`/`ChevronDown` buttons with optimistic local array swap → background `Promise.all` DB persist → revert on failure. Different from checklists' `framer-motion` `Reorder` drag-and-drop (Bible §4.3.1).

### 7.5 Responsive Tab Pattern (Unique)
Only page using mobile `Select` dropdown + desktop `TabsList` for responsive navigation. Documented in Bible §7.2. All other tabbed pages use horizontal tabs that may overflow on mobile.

### 7.6 Quick-Add Pattern (Settings Innovation)
All 4 list tabs (Categories, Sizes, Expense Categories, QR Prefixes) share a consistent quick-add pattern:
```tsx
<div className="flex items-center gap-2 pt-1">
  <Input ref={inputRef} onKeyDown={(e) => e.key === 'Enter' && handleQuickAdd()} className="pl-9 h-10 border-dashed" />
  <Button className="bg-gradient-to-r ..." disabled={!name.trim() || adding}>
    {adding ? <Loader2 /> : <Plus />}
  </Button>
</div>
```
Dashed border input + auto-focus after add + Enter key = rapid data entry without dialogs.

---

## 8. Cross-Reference: Bible Compliance

| Bible Section | Status | Gap |
|--------------|--------|-----|
| §2.1 Token reference | ❌ | No `appConfig` — 40+ hardcoded teal/gradient across 6 files |
| §4.1 Button animation tokens | ❌ | No `s.btnAnimation` — no animations at all on buttons |
| §6.3 Dirty state tracking | ✅ | `isDirty` + save bar pattern exactly matches Bible §6.3 |
| §6.4 Icon-labeled fields | ✅ | Premium label pattern with icons in ShopDetailsTab |
| §6.5 Two-column responsive forms | ✅ | `grid-cols-1 sm:grid-cols-2` in ShopDetailsTab |
| §7.2 Responsive tabs | ✅ | Mobile Select + desktop TabsList — documented in Bible |
| §7.3 Page header pattern | ⚠️ | Gradient badge ✅, back button ✅ — just not tokenized |
| §9.3 Shared `EmptyState` | ❌ | Inline empty states — not using shared component |
| §9.4 Inline empty states | ✅ | Settings pattern documented in Bible §9.4 — matches |
| §11 Component table | ⚠️ | Settings tab components NOT yet listed in Bible §11 |
| §12 Anti-patterns | ✅ | No `confirm()` ✅, no `animate-spin` spinner (skeleton instead) ✅, no `window.history.back()` ✅ |
| §13 Phase 1 tasks | ⚠️ | Settings page token migration NOT yet listed in Phase 1 |

---

## 9. Risks & Edge Cases

| Risk | Severity | Description |
|------|----------|-------------|
| No category orphan check | **High** | Can delete category with `lots` items → orphaned inventory, broken reports |
| No size orphan check | **High** | Can delete size with `inventory_items` → orphaned records |
| Tax rate range bypass | **Medium** | HTML `min/max` only — not validated in handler. Can set 150% or -5% via devtools |
| No unique name enforcement | **Medium** | Can create 5 categories all named "Other" — confusing dropdowns |
| Bill prefix change impact | **Medium** | Changing prefix doesn't update existing bills — users unaware |
| Tax rate change impact | **Medium** | No warning that rate change only affects future sales |
| No audit log | **Low** | Who changed tax rate from 18% to 12%? No record. |
| Tab state not persisted | **Low** | Returning to settings always lands on "shop" tab, not last-viewed |
| QR prefixes loaded separately | **Low** | Not in `Promise.all` — adds one more sequential call after the parallel batch |
| Concurrent edit race | **Low** | Two admins editing same category → last write wins |
| Staff placeholder lackluster | **Low** | Plain text "Staff settings coming soon" — no icon, no card wrapper |

---

## 10. TODO Table: UI/UX Improvements

| # | Task | Priority | Effort | Checklist Ref |
|---|------|----------|--------|---------------|
| U1 | Adopt `appConfig.styles` on main page — import `const s = appConfig.styles`, replace back button (`s.linkColor`/`s.linkHover`), gradient badge (`s.headerIconGradient`), tab active states, select border (6 instances) | **P0** | 20 min | §1 |
| U2 | Adopt `appConfig.styles` on ALL 5 child components — replace hardcoded gradients (`s.primaryGradient`/`s.primaryGradientHover`), icon colors (`s.linkColor`), inline edit check color (~34 instances total) | **P0** | 40 min | §1 |
| U3 | Add `s.btnAnimation` or `s.btnAnimationSubtle` to primary CTA buttons across all children (save, add, quick-add) | **P1** | 15 min | §1, §10 |
| U4 | Migrate all inline empty states to shared `EmptyState` component — drop-in replacement for existing pattern | **P2** | 25 min | §11 |
| U5 | Add CTA buttons to empty states in CategoriesTab, SizesTab, ExpenseCategoriesTab — e.g., focus quick-add input on click | **P2** | 15 min | §11 |
| U6 | Add visual error state on load failure — replace toast-only with Card + error icon + "Retry" button | **P2** | 20 min | §11 |
| U7 | Improve staff placeholder — add `Settings` icon, wrap in Card, add "Contact your admin" message | **P3** | 10 min | §11 |
| U8 | Add `tabular-nums` to tax rate display and size order numbers | **P3** | 5 min | §9 |
| U9 | Tokenize tab active state for dark mode — extract complex `data-[state=active]` classes to config token | **P3** | 15 min | §1 |
| U10 | Add `border-dashed` indicator to QrPrefixesTab empty card grid (visual hint for "add here") | **P3** | 5 min | §11 |

---

## 11. TODO Table: Functionality Improvements

| # | Task | Priority | Effort | Notes |
|---|------|----------|--------|-------|
| F1 | Add orphan check for **product categories** — query `lots` count by `category_id` before delete, block with toast if >0 | **P0** | 30 min | Data integrity — matches expense category pattern |
| F2 | Add orphan check for **sizes** — query `inventory_items` count by `size_id` before delete, block with toast if >0 | **P0** | 30 min | Data integrity — matches expense category pattern |
| F3 | Add code-level tax rate validation — enforce 0–100 range in handler, show `FieldError` if out of range | **P1** | 15 min | Prevent data corruption |
| F4 | Adopt `useFormErrors` + `FieldError` in ShopDetailsTab — inline validation for shop name (required), bill prefix (alphanumeric) | **P1** | 30 min | Consistency with checklists page |
| F5 | Adopt `useFormErrors` + `FieldError` in CategoriesTab/QrPrefixesTab edit dialogs — inline validation for name (required) | **P1** | 25 min | Better than toast-only errors |
| F6 | Add unique name validation — check for duplicates before insert/update (categories, sizes, expense categories) | **P2** | 30 min | UX — prevent confusing dropdowns |
| F7 | Add tax rate change warning — toast.info or dialog: "Tax rate change only affects future sales" | **P2** | 10 min | Business clarity |
| F8 | Move `fetchQrPrefixes` into `Promise.all` — add as 5th parallel query to eliminate sequential call | **P2** | 10 min | Performance |
| F9 | Persist active tab in URL search params — `?tab=categories` → `const [activeTab] = useSearchParams()` | **P3** | 20 min | UX — maintain context on page revisit |
| F10 | Add bill prefix change warning — "Changing prefix won't update existing bills" | **P3** | 10 min | Business clarity |
| F11 | Extend optimistic reorder to categories (alphabetical → manual order) | **P3** | 1 hr | Power user feature |
| F12 | Add `framer-motion Reorder` drag-and-drop to sizes (upgrade from ChevronUp/ChevronDown) | **P3** | 1.5 hr | Premium UX — matches checklists pattern |

---

*Review updated: February 9, 2026 — Version 2.0 (Checklist-scored rewrite)*
