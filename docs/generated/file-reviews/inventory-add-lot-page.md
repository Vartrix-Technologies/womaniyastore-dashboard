# File Review: Add Stock Lot Module

**Last Updated:** February 8, 2026
**Files:**
- `src/app/(protected)/admin/inventory/add-lot/page.tsx` — 556 lines

---

## 1. Architecture

**Page responsibility:** Form page for batch-adding inventory items with shared characteristics (category, size, pricing) and auto-assigning unused QR codes from a selected prefix.

**What this module does NOT do:**
- Manage existing inventory items (main inventory page)
- Generate new QR codes (assumes pre-generated codes exist)
- Edit existing lots (create-only, immutable for audit trail)
- Handle sales or POS operations

**Dependencies:**

| Import | Purpose |
|--------|---------|
| `react-hook-form` + `Controller` | Form state, validation, field registration |
| `zodResolver` + `addStockLotSchema` | Schema-based validation via Zod |
| `addStockLot` | `@/lib/api/inventory` — core lot creation API |
| `fetchActiveQrPrefixes` / `getUnusedQrCodeCount` | `@/lib/api/qr-prefixes` — QR prefix data |
| `supabase` | Direct queries for categories/sizes dropdowns |
| `sonner` | Toast notifications |
| `next/navigation` | Router for post-submit redirect |

**Notable:** This page uses **React Hook Form + Zod** — the only form page in the app that uses a proper form library. All other forms use manual `useState` + `useFormErrors`.

---

## 2. Data Flow

### Mount
1. `useEffect` fires on `profile.shop_id`
2. Parallel calls: `fetchCategories()`, `fetchSizes()`, `fetchQrPrefixes()`
3. First active prefix auto-selected via `setValue('prefix_id', data[0].id)`
4. Available QR count loaded for selected prefix

### Form State (React Hook Form)
- `useForm<AddStockLotFormValues>` with `zodResolver(addStockLotSchema)`
- `watch()` for reactive fields: `prefix_id`, `quantity`, `cost_price`, `selling_price`, `sale_type`
- `Controller` for Select components (shadcn Select doesn't support native `ref`)
- `register()` for standard Input fields

### Profit Margin (Lines 191–194)
- Reactive calculation: `((selling - cost) / cost) × 100`
- Display-only, no enforcement of minimum margin
- **Bug:** Division by zero when cost = 0 → shows `Infinity%`

### onSubmit (Lines 147–185)
1. Pre-validates quantity vs available QR count (client-side)
2. Builds payload — `undefined` for optional empty fields (not empty strings)
3. Calls `addStockLot()` API
4. On success: toast with item count + redirect to `/admin/inventory`
5. On error: specific handling for `INSUFFICIENT_QR_CODES`, generic for others

### Sale Configuration (Lines 430–490)
- Toggle buttons: "Not on Sale", "Festival Sale", "Promotional Sale"
- Conditional fields: `min_margin_percent` + `sale_reason` shown when sale type selected
- "Clearance" is not available here — marked later at POS

---

## 3. Checklist Assessment

### Config-Driven Theming — 1/10 ❌
- [ ] No `appConfig` import, no `const s = appConfig.styles`
- [ ] Hardcoded `text-teal-600 hover:text-teal-700 hover:bg-teal-50` on back button (line 207)
- [ ] Hardcoded `bg-gradient-to-r from-teal-500 to-cyan-600` on submit button (line 517)
- [ ] Hardcoded `text-teal-600` on profit margin display (line 423) and help icon (line 541)
- [ ] Hardcoded `hover:scale-105 active:scale-95 transition-all` on buttons
- [ ] Sale type active states hardcoded: `bg-teal-50 border-teal-500`, `bg-green-50 border-green-500`, `bg-blue-50 border-blue-500`
- [x] No stats cards, no row tinting, no date filtering (N/A for form pages)

### Page Header — 3/10 ❌
- [x] Back button: `variant="ghost"`, `-ml-2`, `ArrowLeft` icon — but hardcoded colors
- [ ] **Missing:** Gradient icon badge — no badge container at all, `Package` icon only on submit button
- [x] Title: `text-2xl font-bold tracking-tight` with subtitle
- [ ] **Missing:** `flex items-center gap-3` title row with badge — title sits alone under back button
- [ ] **N/A:** No action buttons in header (submit is in form)

### Stats Cards — N/A
Form page — no stats cards applicable. Skip section.

### Date Filtering — N/A
Form page — `date_of_stock_arrival` is a form field, not a filter. Skip section.

### Filter Toolbar & Chips — N/A
No listing/filtering on this page. Skip section.

### Table & Data — N/A
No table on this page. Skip section.

### Dialogs & Sheets — N/A
No dialogs or sheets on this page. Skip section.

### Mobile Responsiveness — 6/10 ⚠️
- [ ] **Issue:** Page wrapper uses `max-w-2xl mx-auto` — non-standard, Bible says `space-y-4 md:space-y-6` without `mx-auto`
- [x] Form uses `grid grid-cols-1 sm:grid-cols-2 gap-4` for field pairs
- [x] Submit buttons: `flex flex-col sm:flex-row gap-3`
- [x] Touch targets: all inputs `h-9`+, buttons standard sizing
- [ ] **Missing:** No `max-w-[calc(100%-2rem)]` consideration — `max-w-2xl mx-auto` could clip on very narrow screens
- [x] Sale type buttons wrap with `flex-wrap gap-2`

### Typography — 7/10 ⚠️
- [x] `text-2xl font-bold tracking-tight` for page heading
- [x] `text-lg` for CardTitle
- [x] `text-sm` consistently on labels and inputs
- [x] `text-xs text-muted-foreground` for helper text
- [ ] **Missing:** Labels use basic `text-sm` — not uppercase tracking style from Bible
- [x] Profit margin: `font-medium text-teal-600` — readable

### Interactions & Touch — 5/10 ⚠️
- [x] Submit button: gradient + `hover:scale-105 active:scale-95` (hardcoded)
- [x] Cancel button: `hover:scale-105 active:scale-95`
- [x] `Loader2 animate-spin` during submission
- [x] Accordion hover: `hover:bg-muted/50 transition-colors`
- [ ] **Missing:** No `ConfirmDialog` for cancel-with-unsaved-changes
- [ ] **Missing:** No `beforeunload` warning for dirty form
- [ ] **No optimistic UI** — waits for full DB round-trip before redirect

### Empty & Error States — 5/10 ⚠️
- [x] QR prefix empty state: dashed border box with "No active QR prefixes found" + link to Settings
- [x] Inline Zod validation errors: `<p className="text-xs text-red-500">` per field
- [x] Red border on invalid fields via `errors.field ? 'border-red-500' : ''`
- [ ] **Missing:** No empty state for categories dropdown (if shop has no categories, dropdown is just empty)
- [ ] **Missing:** No empty state for sizes dropdown
- [ ] **Missing:** No shared `EmptyState` component used

### Core Rules — 8/10 ✅
- [x] No `confirm()`, `alert()`, `prompt()`
- [x] Toast via sonner consistently
- [x] Uses Zod schema validation (better than most pages!)
- [x] Supabase errors handled with try/catch + toast
- [ ] **Issue:** `error: any` type in catch blocks — no typed error handling
- [x] Form library used (React Hook Form) — unique to this page
- [ ] **Issue:** Sale type buttons use hardcoded color classes, not tokens

### **Overall Score: 15/40** — Needs token adoption + header upgrade

*Note: Many checklist items (stats, tables, filters, dialogs) are N/A for a form page. Score reflects applicable items only. Adjusted denominator: 15/25 applicable = 60%.*

---

## 4. Risks

| Risk | Severity | Description |
|------|----------|-------------|
| Profit margin Infinity% | **Medium** | Division by zero when `cost_price = 0` shows `Infinity%` |
| No draft save | **Medium** | 10+ field form — all data lost if user navigates away or browser crashes |
| No max quantity limit | **Medium** | Creating lot with 10,000+ items could timeout database transaction |
| Both size fields fillable | **Low** | User can select dropdown size AND type custom — no mutual exclusion |
| Vendor name duplicates | **Low** | Free text allows "ABC Suppliers" and "ABC Supplier" as different vendors |
| Future dates allowed | **Low** | No max-date constraint on stock arrival date |
| No cancel confirmation | **Low** | Cancel button navigates away without warning if form is dirty |
| `console.log` in production | **Low** | Lines 160-161 log payload and result to console |

---

## 5. What's Already Well Done

| Feature | Detail |
|---------|--------|
| **React Hook Form + Zod** | Only page in app using proper form library — field-level validation, type-safe, schema-driven |
| **QR prefix integration** | Smart prefix selector with live available-count — prevents "not enough QR codes" failures |
| **Sale type configuration** | Festival/promotion toggle with conditional fields — clean UI pattern |
| **Inline Zod errors** | Per-field error messages with red borders — better than most pages in the app |
| **Help accordion** | Collapsible how-it-works guide — good onboarding without clutter |
| **QR count link** | When insufficient, links to QR codes page — actionable error guidance |
| **Conditional sale fields** | border-l-2 visual indent for sub-fields — clear parent-child relationship |

---

## 6. TODOs — UI/UX

| # | Task | Priority | Effort |
|---|------|----------|--------|
| 1 | **Adopt `appConfig.styles` tokens** — add `const s = appConfig.styles`, replace all hardcoded teal/gradient/animation classes (back button, submit button, profit margin, help icon, sale type active states) | **High** | 30 min |
| 2 | **Add gradient icon badge** to page header — `p-2.5 rounded-lg ${s.headerIconGradient} text-white shadow-md` with `Package` icon, `flex items-center gap-3` title row | **High** | 10 min |
| 3 | **Upgrade labels** to uppercase tracking style — `text-xs font-medium uppercase tracking-wide text-muted-foreground` with icons for section groups | Medium | 20 min |
| 4 | **Add empty state for categories** — if dropdown has 0 items, show dashed box with "No categories found" + link to Settings (match QR prefix empty pattern) | Medium | 15 min |
| 5 | **Remove `max-w-2xl mx-auto`** page wrapper — use standard `space-y-4 md:space-y-6` pattern, let Card handle content width | Medium | 5 min |
| 6 | **Add margin health indicator** — color the profit margin display: red `<20%`, amber `20-50%`, green `≥50%` with colored text via tokens | Medium | 20 min |
| 7 | **Add cancel confirmation** — if form is dirty, show `ConfirmDialog` before navigating away on Cancel click | Medium | 30 min |
| 8 | **Add `beforeunload` warning** — prompt browser dialog when navigating away with unsaved form data | Low | 10 min |
| 9 | **Size field mutual exclusion** — disable custom size input when dropdown is selected, show "(or)" between them | Low | 15 min |
| 10 | **Remove `console.log` statements** — lines 160-161 log payload/result to console in production | Low | 2 min |

## 7. TODOs — Functionality

| # | Task | Priority | Effort |
|---|------|----------|--------|
| 1 | **Fix profit margin division by zero** — show "N/A" when `cost_price = 0` instead of `Infinity%` | **High** | 5 min |
| 2 | **Add vendor autocomplete** — query existing vendor names from `lots` table, show suggestions on type, allow new entry | **High** | 2 hr |
| 3 | **Add max quantity limit** — cap at reasonable number (e.g., 500) in Zod schema + show warning above threshold | Medium | 15 min |
| 4 | **Add draft auto-save** — persist form state to `localStorage` every 30s, restore on mount, clear on successful submit | Medium | 1 hr |
| 5 | **Add date validation** — no future dates for stock arrival, reasonable past limit (e.g., 1 year) | Medium | 15 min |
| 6 | **Type error handling** — replace `error: any` with typed API error interface, handle all error codes explicitly | Medium | 30 min |
| 7 | **Case-insensitive vendor dedup** — normalize vendor name (trim, consistent casing) before storage | Low | 15 min |
| 8 | **Prevent double-submit** — disable form after first submit, debounce submit handler (currently `submitting` state exists but button could be clicked twice fast) | Low | 10 min |
| 9 | **Add lot preview step** — show summary card before final submit ("You're adding 15 items at ₹499 each to category X with prefix WA-499") | Low | 1 hr |
| 10 | **Parallelize dropdown fetches** — wrap `fetchCategories` + `fetchSizes` + `fetchQrPrefixes` in `Promise.all` for faster load | Low | 10 min |

---

> **Version:** 2.0
> **Reviewed against:** PAGE_ANALYSIS_CHECKLIST v2.0, DESIGN_SYSTEM_BIBLE v2.0
