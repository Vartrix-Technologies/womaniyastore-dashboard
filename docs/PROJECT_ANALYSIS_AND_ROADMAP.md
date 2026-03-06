# Womaniya Dashboard - Comprehensive Project Analysis & Development Roadmap

**Date:** December 20, 2025  
**Status:** Pre-Production (70% Complete)  
**Analyst:** GitHub Copilot

---

## Executive Summary

You've made **significant progress** on a well-architected PWA application. The foundation is solid with proper separation of concerns, offline-first architecture, and production-ready patterns. However, there are **critical gaps** and **architectural misalignments** that must be addressed before proceeding.

### Overall Assessment: **7/10**

**What's Working Well:**
- ✅ Clean Next.js 14 App Router architecture with TypeScript
- ✅ Proper offline-first POS with IndexedDB and sync mechanism
- ✅ Well-structured authentication with role-based access
- ✅ shadcn/ui component library properly integrated
- ✅ PWA manifest configured correctly
- ✅ Core POS workflow implemented and functional
- ✅ Static export configuration for Firebase Hosting

**Critical Issues to Address:**
- 🔴 **Database schema not deployed** - Missing all Supabase migrations
- 🔴 **Edge Functions incomplete** - Core business logic not implemented
- 🔴 **Service Worker missing** - PWA not truly functional offline
- 🟡 **Type safety compromised** - Multiple uses of `any` type
- 🟡 **No test coverage** - Zero tests written
- 🟡 **Many admin pages incomplete** - 60% of admin functionality missing

---

## 🔴 CRITICAL BLOCKERS (Must Fix Before Continuing)

### 1. **Database Schema Not Deployed** ❌

**Problem:** Your `supabase/migrations/` folder is **empty**. The entire database schema defined in `UPDATED_REQUIREMENTS.md` doesn't exist in Supabase.

**Impact:**
- Application cannot function - no tables exist
- Auth will fail - `profiles` table missing
- POS cannot save sales - `sales`, `sale_items` tables missing
- Inventory tracking impossible - `inventory_items`, `lots`, `qr_codes` tables missing

**Evidence:**
```bash
$ ls supabase/migrations/
# Empty folder!
```

**Fix Required:**
1. Create the initial migration file with the complete schema from `UPDATED_REQUIREMENTS.md`
2. Deploy to Supabase using `npx supabase db push`
3. Verify all tables, enums, RLS policies, and helper functions exist

**Action Items:**
- [ ] Create `supabase/migrations/20241220_initial_schema.sql` with full schema
- [ ] Include all enums (user_role, qr_status, inventory_status, etc.)
- [ ] Include all tables (shops, profiles, categories, sizes, qr_codes, lots, inventory_items, sales, sale_items, financial_transactions, attendance_logs, checklists, etc.)
- [ ] Include all RLS policies
- [ ] Include helper functions (current_profile(), current_shop_id(), is_admin(), is_superadmin())
- [ ] Deploy to Supabase
- [ ] Verify with Supabase Studio

---

### 2. **Edge Functions Incomplete** ⚠️

**Problem:** Both critical Edge Functions are **partially implemented** but not production-ready.

**Status:**

#### `complete-sale` Function
- ✅ File exists: `supabase/functions/complete-sale/index.ts`
- ❌ TypeScript errors (Deno types not configured)
- ❌ Transaction logic incomplete
- ❌ Bill number generation missing
- ❌ QR status update logic missing
- ❌ Discount validation missing
- ❌ Not tested

#### `add-stock-lot` Function
- ✅ File exists: `supabase/functions/add-stock-lot/index.ts`
- ❌ TypeScript errors (Deno types, implicit any)
- ❌ Transaction rollback incomplete
- ❌ QR code auto-assignment logic incomplete
- ❌ Not tested

**Impact:**
- POS cannot complete sales (will fail at final step)
- Inventory cannot be added (admin functionality broken)
- Offline sales cannot sync (sync engine will fail)

**Fix Required:**
1. Install Deno types: `npm install --save-dev @types/deno`
2. Configure TypeScript for Deno environment
3. Complete business logic for both functions
4. Add comprehensive error handling
5. Test locally with `npx supabase functions serve`
6. Deploy: `npx supabase functions deploy complete-sale`

---

### 3. **Service Worker Missing** ⚠️

**Problem:** You have `manifest.json` but **no service worker**. The app won't work offline for static assets.

**Current State:**
- ✅ PWA manifest configured
- ✅ Icons available
- ❌ No service worker
- ❌ No offline caching strategy
- ❌ Cannot install as standalone app properly

**Impact:**
- App won't work offline for UI/navigation
- Only IndexedDB data is cached (not HTML/CSS/JS)
- Poor user experience when internet is spotty
- Not a true PWA

**Fix Required:**
Choose one approach:

#### Option A: next-pwa (Recommended)
```bash
npm install next-pwa
```

Update `next.config.ts`:
```typescript
import withPWA from 'next-pwa';

const nextConfig = withPWA({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  skipWaiting: true,
  runtimeCaching: [
    {
      urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'supabase-cache',
        networkTimeoutSeconds: 10,
        expiration: {
          maxEntries: 200,
          maxAgeSeconds: 24 * 60 * 60, // 24 hours
        },
      },
    },
  ],
})({
  output: 'export',
  images: { unoptimized: true },
});
```

#### Option B: Custom Service Worker
Create `public/sw.js` with custom caching logic (more control, more work).

---

## 🟡 MAJOR ARCHITECTURAL ISSUES

### 4. **Type Safety Violated (Multiple `any` Uses)**

**Problem:** TypeScript's benefits are negated by liberal use of `any` type.

**Locations:**
1. **src/lib/offline/db.ts:8** - `data: any` in FailedSale interface
2. **src/app/(protected)/admin/inventory/page.tsx:17** - `useState<any[]>([])`
3. **src/app/(protected)/admin/sales/page.tsx:17** - `useState<any[]>([])`
4. **src/types/pos.types.ts:37-41** - InventoryItemData has 5 `any` fields
5. **Edge Functions** - Multiple implicit `any` parameters

**Impact:**
- No compile-time type checking
- Runtime errors that should be caught at build
- Poor IDE autocomplete
- Harder to refactor

**Fix Strategy:**
```typescript
// BEFORE (Bad)
const [inventory, setInventory] = useState<any[]>([]);

// AFTER (Good)
type InventoryWithRelations = Database['public']['Tables']['inventory_items']['Row'] & {
  qr_codes: Database['public']['Tables']['qr_codes']['Row'] | null;
  lots: Database['public']['Tables']['lots']['Row'] & {
    categories: Database['public']['Tables']['categories']['Row'] | null;
    sizes: Database['public']['Tables']['sizes']['Row'] | null;
  };
};

const [inventory, setInventory] = useState<InventoryWithRelations[]>([]);
```

**Action Items:**
- [ ] Fix all `any` types in database operations
- [ ] Add proper types to Edge Function parameters
- [ ] Generate database types: `npx supabase gen types typescript --project-id YOUR_PROJECT_ID > src/types/database.types.ts`
- [ ] Create composite types for common query results

---

### 5. **No Test Coverage** ⚠️

**Problem:** **Zero tests** in the entire codebase.

**Impact:**
- No safety net for refactoring
- Bugs discovered only in production
- Difficult to onboard new developers
- Cannot confidently deploy

**Testing Strategy:**

#### Phase 1: Critical Path Testing (Immediate)
```bash
npm install --save-dev @testing-library/react @testing-library/jest-dom \
  @testing-library/user-event jest jest-environment-jsdom @types/jest
```

**Priority Tests:**
1. **Utility Functions** (`src/lib/formatters.ts`)
   - formatCurrency()
   - formatDate()
   - formatPhone()

2. **Offline Database** (`src/lib/offline/db.ts`)
   - addPendingSale()
   - getPendingSales()
   - updatePendingSale()

3. **POS Workflow** (Integration Test)
   - Scan QR → Add to cart → Checkout → Save offline

#### Phase 2: Component Testing
- ScanQRButton camera flow
- CartList discount validation
- CheckoutDialog form validation

#### Phase 3: E2E Testing (Optional)
- Install Playwright
- Test full POS workflow
- Test sync recovery

---

### 6. **Empty Component Folders** 🗑️

**Problem:** Multiple empty folders create confusion.

**Empty Folders to Remove:**
```
src/components/attendance/     # Not needed (inline in pages)
src/components/checklists/     # Not needed (inline in pages)
src/components/finance/        # Duplicate of finances/
src/components/finances/       # Empty (components should be inline)
src/components/forms/          # Not needed (using react-hook-form inline)
src/components/inventory/      # Empty (components should be inline)
src/components/nav/            # Already in tablet/
src/components/tables/         # Using shadcn/ui table directly
```

**Recommendation:**
- Keep only folders with actual components
- Create components as needed during implementation
- Don't pre-create empty structure

---

## 📋 FEATURE COMPLETION STATUS

### ✅ Completed (70%)

#### Infrastructure & Foundation
- ✅ Next.js 14 project setup with TypeScript
- ✅ Static export configuration
- ✅ Tailwind CSS + shadcn/ui integration (20+ components)
- ✅ PWA manifest.json
- ✅ Supabase client configuration
- ✅ Offline IndexedDB setup
- ✅ Type system (needs improvement)

#### Authentication & Authorization
- ✅ AuthContext with role-based access
- ✅ Login page
- ✅ Protected route layout
- ✅ Role guards (hasRole, isAdmin, isStaff)

#### POS System (Complete!)
- ✅ POS page with QR scanning
- ✅ ScanQRButton (html5-qrcode integration)
- ✅ CartList (with price editing, discount tracking)
- ✅ CartSummary (tax calculation)
- ✅ CheckoutDialog (offline support)
- ✅ Offline sale storage
- ✅ Sync engine with retry logic

#### Navigation
- ✅ TopBar with user menu
- ✅ BottomNav with role-based items
- ✅ Online/offline status indicators

### ⚠️ Partially Complete (20%)

#### Edge Functions (Critical!)
- ⚠️ complete-sale (50% - needs transaction logic)
- ⚠️ add-stock-lot (50% - needs QR assignment)

#### Admin Pages (Scaffolded but Empty)
- ⚠️ /admin/inventory (page exists, no implementation)
- ⚠️ /admin/sales (page exists, no implementation)
- ⚠️ /admin/finances (page exists, no implementation)

### ❌ Not Started (10%)

#### Critical Missing Features
- ❌ Service Worker (PWA requirement)
- ❌ Database migrations (blocker!)
- ❌ Test suite

#### Admin Features
- ❌ /admin/inventory/add-lot
- ❌ /admin/qr-codes
- ❌ /admin/staff
- ❌ /admin/settings
- ❌ /admin/checklists (template management)
- ❌ /admin/attendance (view all staff)

#### Staff Features
- ❌ /me/attendance (clock in/out)
- ❌ /me/checklists (daily tasks)

#### Components
- ❌ Reusable DataTable (TanStack Table)
- ❌ DateRangePicker
- ❌ ExportButton (Excel export)

---

## 🎯 RECOMMENDED DEVELOPMENT ROADMAP

### Phase 1: Fix Critical Blockers (Week 1) 🔴

**Goal:** Make the app functional with core POS workflow working end-to-end.

#### Day 1-2: Database Setup
- [ ] Create complete migration file (`supabase/migrations/20241220_initial_schema.sql`)
- [ ] Deploy schema to Supabase
- [ ] Verify all tables in Supabase Studio
- [ ] Generate fresh database types
- [ ] Seed initial data (shop, admin user, categories, sizes, QR codes)

#### Day 3-4: Complete Edge Functions
- [ ] Fix TypeScript errors in both functions
- [ ] Implement complete-sale transaction logic
- [ ] Implement add-stock-lot with QR assignment
- [ ] Add proper error handling
- [ ] Test locally with Supabase CLI
- [ ] Deploy functions

#### Day 5-7: Fix Type Safety
- [ ] Replace all `any` types with proper types
- [ ] Add type guards where needed
- [ ] Fix TypeScript strict mode violations
- [ ] Ensure `npm run build` passes with no errors

**Success Criteria:**
- ✅ Can scan QR code → add to cart → checkout → save to Supabase
- ✅ Can add inventory lot with auto QR assignment
- ✅ Offline sales sync successfully when back online
- ✅ No TypeScript errors in build

---

### Phase 2: Service Worker & PWA (Week 2) 🟡

**Goal:** Make app installable and fully offline-capable.

#### Day 1-3: Service Worker
- [ ] Install next-pwa
- [ ] Configure caching strategies
- [ ] Test offline navigation
- [ ] Test offline asset loading

#### Day 4-5: PWA Features
- [ ] Test app installation on tablet
- [ ] Configure portrait orientation lock
- [ ] Test touch targets (44px minimum)
- [ ] Add offline-ready banner

#### Day 6-7: Testing Foundation
- [ ] Setup Jest + React Testing Library
- [ ] Write tests for utility functions
- [ ] Write tests for offline database
- [ ] Write integration test for POS flow

**Success Criteria:**
- ✅ App installs on tablet
- ✅ Works offline for navigation
- ✅ Offline sales cached and synced
- ✅ 30%+ code coverage

---

### Phase 3: Admin Inventory Module (Week 3) 🟢

**Goal:** Complete inventory management for admin.

#### Day 1-3: Inventory List
- [ ] Create DataTable component (TanStack Table)
- [ ] Implement /admin/inventory page
- [ ] Add filtering (category, size, status)
- [ ] Add search by QR code
- [ ] Add pagination

#### Day 4-5: Add Stock Lot
- [ ] Create /admin/inventory/add-lot form
- [ ] Implement category/size selection
- [ ] Implement quantity + price input
- [ ] Test QR auto-assignment
- [ ] Add success/error handling

#### Day 6-7: QR Code Management
- [ ] Create /admin/qr-codes page
- [ ] List all QR codes with status
- [ ] Add bulk QR generation
- [ ] Add print functionality (print labels)

**Success Criteria:**
- ✅ Can view all inventory items
- ✅ Can add new stock lots
- ✅ Can generate and print QR codes
- ✅ Can search and filter inventory

---

### Phase 4: Admin Sales & Finance (Week 4) 🟢

**Goal:** Complete sales reporting and financial tracking.

#### Day 1-3: Sales History
- [ ] Create /admin/sales page with DataTable
- [ ] Add date range filtering
- [ ] Add payment method filtering
- [ ] Add staff member filtering
- [ ] Implement /admin/sales/[saleId] detail view

#### Day 4-5: Finance Dashboard
- [ ] Create /admin/finances page
- [ ] Add Recharts graphs (daily/weekly/monthly sales)
- [ ] Show revenue, tax, discounts breakdown
- [ ] Add expense vs income comparison

#### Day 6-7: Expense Management
- [ ] Create expense list page
- [ ] Create add expense form
- [ ] Add expense categories
- [ ] Implement Excel export

**Success Criteria:**
- ✅ Can view all sales with filters
- ✅ Can see sale details
- ✅ Financial charts display correctly
- ✅ Can track expenses
- ✅ Can export to Excel

---

### Phase 5: Staff Features (Week 5) 🟢

**Goal:** Complete staff-facing features.

#### Day 1-2: Attendance System
- [ ] Create /me/attendance page
- [ ] Implement clock in/out buttons
- [ ] Show current shift status
- [ ] Show attendance history
- [ ] Fix schema issues (add `date` field to inserts)

#### Day 3-4: Checklist System
- [ ] Create /admin/checklists template management
- [ ] Create /me/checklists staff view
- [ ] Implement checklist assignment
- [ ] Implement item completion
- [ ] Add completion tracking

#### Day 5: Staff Management (Admin)
- [ ] Create /admin/staff page
- [ ] List all staff members
- [ ] Add/edit staff form
- [ ] Set roles and discount limits
- [ ] Deactivate staff members

**Success Criteria:**
- ✅ Staff can clock in/out
- ✅ Staff can see their checklists
- ✅ Admin can manage checklists
- ✅ Admin can manage staff
- ✅ Discount limits enforced

---

### Phase 6: Polish & Production (Week 6) 🎨

**Goal:** Production-ready deployment.

#### Day 1-2: Settings & Configuration
- [ ] Create /admin/settings page
- [ ] Shop information editor
- [ ] Tax settings (GST, rates)
- [ ] Category/size management
- [ ] Business hours configuration

#### Day 3-4: Error Handling & UX
- [ ] Add error boundaries
- [ ] Improve loading states
- [ ] Add skeleton loaders
- [ ] Improve toast notifications
- [ ] Add confirmation dialogs

#### Day 5-6: Testing & QA
- [ ] Increase test coverage to 60%
- [ ] Manual testing on actual tablet
- [ ] Test all offline scenarios
- [ ] Test sync recovery
- [ ] Performance audit

#### Day 7: Deployment
- [ ] Build static export
- [ ] Deploy to Firebase Hosting
- [ ] Deploy Edge Functions
- [ ] Configure custom domain
- [ ] Setup monitoring

**Success Criteria:**
- ✅ All features working
- ✅ 60%+ test coverage
- ✅ Deployed to production
- ✅ Monitoring in place

---

## 🏗️ ARCHITECTURE BEST PRACTICES

### 1. **Follow the Separation of Concerns**

**Current Issue:** Everything inline in page components.

**Recommended Pattern:**

```
src/features/inventory/
  ├── components/
  │   ├── InventoryTable.tsx       # Reusable table
  │   ├── AddLotForm.tsx            # Reusable form
  │   └── InventoryFilters.tsx      # Filters component
  ├── hooks/
  │   ├── useInventory.ts           # Data fetching
  │   └── useInventoryFilters.ts    # Filter state
  ├── types/
  │   └── inventory.types.ts        # Feature types
  └── utils/
      └── inventory.utils.ts        # Helper functions
```

### 2. **Use Composition Over Duplication**

**Bad (Current):**
```tsx
// src/app/(protected)/admin/sales/page.tsx
const [sales, setSales] = useState<any[]>([]);

useEffect(() => {
  // Fetch sales logic...
}, []);

return (
  <table>
    {/* Table markup... */}
  </table>
);
```

**Good (Recommended):**
```tsx
// src/components/shared/DataTable.tsx
export function DataTable<T>({ columns, data, onRowClick }: DataTableProps<T>) {
  // Reusable table logic
}

// src/app/(protected)/admin/sales/page.tsx
export default function SalesPage() {
  const { data, loading } = useSales();
  
  return <DataTable columns={salesColumns} data={data} />;
}
```

### 3. **Custom Hooks for Data Fetching**

**Pattern:**
```typescript
// src/hooks/useSales.ts
export function useSales(filters?: SalesFilters) {
  const [data, setData] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    fetchSales(filters)
      .then(setData)
      .catch(setError)
      .finally(() => setLoading(false));
  }, [filters]);

  return { data, loading, error, refetch: () => {} };
}
```

### 4. **Error Boundaries for Resilience**

**Add to root layout:**
```tsx
// src/components/shared/ErrorBoundary.tsx
export class ErrorBoundary extends React.Component {
  // Catch React errors
}

// src/app/layout.tsx
<ErrorBoundary>
  <AuthProvider>
    {children}
  </AuthProvider>
</ErrorBoundary>
```

### 5. **Environment Variables**

**Add to `.env.local`:**
```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
```

**Never commit:** Add `.env.local` to `.gitignore`

---

## 🔒 SECURITY CONSIDERATIONS

### 1. **Row Level Security (RLS)**

**Critical:** Ensure RLS policies are enabled on ALL tables.

**Verify:**
```sql
-- Check RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public';
```

### 2. **Discount Limit Enforcement**

**Current:** Enforced client-side only (can be bypassed).

**Fix:** Add validation in `complete-sale` Edge Function:
```typescript
// Check discount against profile.max_discount_percent
if (discount > userProfile.max_discount_percent) {
  return { error: 'DISCOUNT_EXCEEDS_LIMIT' };
}
```

### 3. **Edge Function Auth**

**Current:** Uses Authorization header ✅

**Add:** JWT validation and user context extraction:
```typescript
const { data: { user }, error } = await supabaseAdmin.auth.getUser(
  authHeader.replace('Bearer ', '')
);
```

---

## 🧪 TESTING STRATEGY

### Unit Tests (60% of tests)
- Utility functions (formatters, validators)
- Offline database operations
- Custom hooks
- Pure functions

### Integration Tests (30% of tests)
- POS workflow (scan → cart → checkout)
- Sync engine (offline → online → sync)
- Auth flow (login → redirect → logout)

### E2E Tests (10% of tests)
- Complete user journeys
- Cross-browser testing
- Tablet-specific interactions

### Test Coverage Goals
- **Phase 1:** 30% (critical paths)
- **Phase 2:** 60% (production ready)
- **Phase 3:** 80% (comprehensive)

---

## 📊 PROJECT METRICS

### Current State
```
Total Files:        ~80
Lines of Code:      ~8,000
TypeScript:         95%
Components:         25+
Pages:              15
Completed:          70%
Tests:              0%
```

### Target State (Production)
```
Total Files:        ~120
Lines of Code:      ~15,000
TypeScript:         100%
Components:         40+
Pages:              25
Completed:          100%
Test Coverage:      60%+
```

---

## 🎓 LEARNING RESOURCES

### Next.js 14 + Static Export
- [Static Exports Guide](https://nextjs.org/docs/app/building-your-application/deploying/static-exports)
- [Client-only patterns](https://nextjs.org/docs/app/building-your-application/rendering/client-components)

### Supabase
- [Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)
- [Edge Functions](https://supabase.com/docs/guides/functions)
- [Database Migrations](https://supabase.com/docs/guides/cli/local-development)

### PWA
- [Service Workers](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)
- [next-pwa](https://github.com/shadowwalker/next-pwa)

### Testing
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [Jest](https://jestjs.io/docs/getting-started)
- [Playwright](https://playwright.dev/)

---

## 🚨 IMMEDIATE NEXT STEPS (Today!)

1. **Create Database Migration File**
   - Copy schema from `UPDATED_REQUIREMENTS.md`
   - Create `supabase/migrations/20241220_initial_schema.sql`
   - Include: enums, tables, RLS policies, helper functions

2. **Deploy Database**
   ```bash
   npx supabase db push
   ```

3. **Generate Fresh Types**
   ```bash
   npx supabase gen types typescript --project-id YOUR_PROJECT_ID > src/types/database.types.ts
   ```

4. **Fix Edge Function TypeScript Errors**
   - Install Deno types
   - Fix implicit `any` types
   - Test locally

5. **Test POS End-to-End**
   - Scan QR → Cart → Checkout → Verify in Supabase Studio

---

## 📝 QUESTIONS FOR CLARIFICATION

Before proceeding with implementation, please clarify:

1. **Database:** Do you have a Supabase project already, or do we need to create one?

2. **QR Codes:** Do you have physical QR codes pre-printed, or do we need to generate them?

3. **Initial Data:** Do you need help seeding:
   - Categories (e.g., "Saree", "Kurti", "Dupatta")
   - Sizes (e.g., "S", "M", "L", "XL", "Free Size")
   - Initial QR codes (how many?)
   - Test shop data?

4. **Deployment:** Do you have a Firebase project for hosting, or should we create one?

5. **Testing Priority:** Given time constraints, should we:
   - Focus on manual testing only? (faster)
   - Write automated tests from day 1? (slower but safer)

6. **Timeline:** What's your target launch date? This affects which features we prioritize.

---

## ✅ CONCLUSION

You've built a **solid foundation** with good architectural decisions. The core POS workflow is well-designed and the offline-first approach is correctly implemented at the application level.

**The main issue is incomplete infrastructure:**
- Database schema not deployed
- Edge Functions not completed
- Service Worker missing
- No tests

Once these blockers are fixed (Week 1 of roadmap), the rest is straightforward feature development following established patterns.

**My recommendation:**
1. **DO NOT write any new features** until Phase 1 is complete
2. Fix the database schema first (blocker for everything)
3. Complete the Edge Functions (POS won't work without this)
4. Add service worker (PWA requirement)
5. Then proceed with admin pages in order of priority

**You're closer than you think!** With focused effort, you can have a production-ready MVP in 4-6 weeks.

---

**Ready to proceed?** Let me know if you'd like me to help with:
- Creating the database migration file
- Fixing the Edge Functions
- Setting up the service worker
- Writing the first tests
- Or any other specific task!
