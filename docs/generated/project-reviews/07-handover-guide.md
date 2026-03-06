# Handover Guide

> A structured onboarding guide for new maintainers with reading order, debugging tips, and common scenarios.

---

## Welcome, New Maintainer! 👋

This guide will help you understand the Womaniya Dashboard codebase efficiently. Follow the structured reading order and use the debugging tips when issues arise.

---

## Week 1: Foundation

### Day 1-2: Get Running

**Goal:** Have the app running locally and understand the user journey.

1. **Read:** [docs/QUICK_START.md](../QUICK_START.md) - Setup instructions
2. **Do:** Clone repo, install deps, set up `.env.local`
3. **Run:** `npm run dev` and open `http://localhost:3000`
4. **Explore:** Login as different roles (staff, admin, superadmin)

**Test Credentials** (if available):
- Staff: `staff@example.com` / password
- Admin: `admin@example.com` / password
- Check [docs/SETUP_INITIAL_DATA.md](../SETUP_INITIAL_DATA.md) for setup

### Day 3-4: Architecture Overview

**Goal:** Understand how the pieces fit together.

**Read in order:**
1. [01-system-overview.md](01-system-overview.md) - Big picture
2. [02-auth-session-flow.md](02-auth-session-flow.md) - How auth works
3. [03-data-flow-ownership.md](03-data-flow-ownership.md) - How data moves

**Key Files to Browse:**
- `src/app/(protected)/layout.tsx` - Route protection
- `src/context/AuthContext.tsx` - Auth state
- `src/lib/supabase.ts` - Database client

### Day 5: Business Domains

**Goal:** Map business concepts to code.

**Read:**
- [04-domain-responsibilities.md](04-domain-responsibilities.md)

**Explore Each Domain:**
| Domain | Start Here |
|--------|------------|
| Inventory | `src/app/(protected)/admin/inventory/page.tsx` |
| Sales | `src/app/(protected)/pos/page.tsx` |
| Staff | `src/app/(protected)/me/page.tsx` |
| Finance | `src/app/(protected)/admin/finances/page.tsx` |

---

## Week 2: Deep Dive

### Day 6-7: Critical Flows

**Goal:** Trace the most important operations.

**1. Complete a Sale (Most Critical)**

Start: `src/app/(protected)/pos/page.tsx`
```
User scans QR → ScanQRButton → searchInventoryByQRCode()
                    ↓
            Add to cart state
                    ↓
            Open CheckoutDialog
                    ↓
            completeSale() → Edge Function
                    ↓
            complete-sale/index.ts → Database
```

**Files to Read:**
- `src/components/pos/ScanQRButton.tsx`
- `src/components/pos/CheckoutDialog.tsx`
- `src/lib/api/sales.ts`
- `supabase/functions/complete-sale/index.ts`

**2. Add Stock Lot**

Start: `src/app/(protected)/admin/inventory/add-stock/page.tsx` (if exists)
```
Fill form → Submit → addStockLot()
                ↓
        add-stock-lot Edge Function
                ↓
        Create Lot + Inventory Items + Assign QR codes
```

**Files to Read:**
- `src/lib/api/inventory.ts`
- `supabase/functions/add-stock-lot/index.ts`

### Day 8-9: Offline System

**Goal:** Understand PWA and offline behavior.

**Read:**
- [05-invariants-contracts.md](05-invariants-contracts.md) - CONTRACT-004, CONTRACT-005

**Files to Read:**
- `src/context/SyncContext.tsx` - Sync orchestration
- `src/lib/offline/db.ts` - IndexedDB operations
- `src/hooks/useOfflineStatus.ts` - Online detection

**Test:**
1. Start a sale at `/pos`
2. Go offline (Chrome DevTools → Network → Offline)
3. Complete the sale
4. Observe "Sale queued" message
5. Go online
6. Watch for auto-sync

### Day 10: Types & Database

**Goal:** Understand the data model.

**Files to Read:**
- `src/types/database.types.ts` - Generated from DB schema
- `src/types/index.ts` - App-specific types
- `src/types/pos.types.ts` - POS/offline types

**Supabase Dashboard:**
1. Open your Supabase project
2. Go to Table Editor
3. Browse: `shops`, `profiles`, `inventory_items`, `sales`

---

## Week 3: Mastery

### Day 11-12: Deployment & Config

**Read:**
- [06-deployment-runtime.md](06-deployment-runtime.md)

**Do:**
- Deploy to a test environment (Vercel free tier works)
- Test Edge Functions in production

### Day 13-14: Edge Cases & Invariants

**Read:**
- [05-invariants-contracts.md](05-invariants-contracts.md) - All sections

**Test:**
- Try to sell the same item twice (should fail)
- Try offline sync retry scenarios
- Verify RLS blocks cross-shop data

---

## Files to Read First

### Tier 1: Core Understanding (Read Fully)

| File | Why |
|------|-----|
| `src/context/AuthContext.tsx` | All auth flows |
| `src/context/SyncContext.tsx` | Offline behavior |
| `src/app/(protected)/layout.tsx` | Route protection |
| `supabase/functions/complete-sale/index.ts` | Critical transaction |

### Tier 2: Domain Entry Points (Skim)

| File | Why |
|------|-----|
| `src/app/(protected)/pos/page.tsx` | POS main page |
| `src/app/(protected)/admin/page.tsx` | Admin dashboard |
| `src/app/(protected)/me/page.tsx` | Staff dashboard |

### Tier 3: API Layer (Reference)

| File | Why |
|------|-----|
| `src/lib/api/sales.ts` | Sale operations |
| `src/lib/api/inventory.ts` | Inventory operations |
| `src/lib/api/attendance.ts` | Attendance operations |

### Tier 4: Utility (As Needed)

| File | Why |
|------|-----|
| `src/lib/utils.ts` | Helper functions |
| `src/lib/formatters.ts` | Date/currency formatting |
| `src/lib/constants.ts` | App-wide constants |

---

## Common Debugging Scenarios

### Scenario 1: "User Can't Log In"

**Symptoms:** Login fails, no error message, or generic error.

**Debug Steps:**
1. Check browser console for errors
2. Verify `.env.local` has correct Supabase credentials
3. Check Supabase Auth logs (Dashboard → Authentication → Users)
4. Verify user exists in `profiles` table
5. Check `is_active` flag on profile

**Key Files:**
- `src/app/login/page.tsx`
- `src/context/AuthContext.tsx`

### Scenario 2: "Sale Not Completing"

**Symptoms:** Checkout spins forever, or fails silently.

**Debug Steps:**
1. Check browser console for network errors
2. Check browser Network tab for Edge Function response
3. Check Supabase Dashboard → Edge Functions → Logs
4. Look for RLS policy violations
5. Verify inventory items are `status = 'available'`

**Key Files:**
- `src/components/pos/CheckoutDialog.tsx`
- `src/lib/api/sales.ts`
- `supabase/functions/complete-sale/index.ts`

### Scenario 3: "Offline Sales Not Syncing"

**Symptoms:** Sales stuck in "pending", never sync.

**Debug Steps:**
1. Check IndexedDB in DevTools → Application → IndexedDB
2. Look at `pendingSales` store
3. Check `status` and `retryCount` on each
4. Verify online status in SyncContext
5. Check for errors in `lastError` field

**Key Files:**
- `src/context/SyncContext.tsx`
- `src/lib/offline/db.ts`

### Scenario 4: "RLS Policy Blocking Access"

**Symptoms:** Queries return empty or 403/404 errors.

**Debug Steps:**
1. Check which user is logged in (`useAuth().profile`)
2. Verify `shop_id` on user profile
3. Check the RLS policy in Supabase Dashboard
4. Test query in Supabase SQL Editor as that user

**Key Concept:**
```sql
-- Most RLS policies follow this pattern:
USING (shop_id = (SELECT shop_id FROM profiles WHERE id = auth.uid()))
```

### Scenario 5: "Type Error on Build"

**Symptoms:** Build fails with TypeScript errors.

**Debug Steps:**
1. Read the error message carefully
2. If database types mismatch → regenerate types:
   ```bash
   supabase gen types typescript --linked > src/types/database.types.ts
   ```
3. Check if schema changed without type update
4. Look for nullability mismatches

---

## Common Modification Tasks

### Task: Add a New Page

1. Create `src/app/(protected)/[route]/page.tsx`
2. Add `'use client';` at top
3. Import `useAuth` and check permissions if needed
4. Add navigation link in sidebar/menu

### Task: Add a New Database Table

1. Create migration in `supabase/migrations/`
2. Add RLS policies
3. Run migration: `supabase db push`
4. Regenerate types: `supabase gen types typescript`
5. Add TypeScript interface in `src/types/index.ts` if needed

### Task: Add a New Edge Function

1. Create folder: `supabase/functions/[name]/`
2. Add `index.ts` with Deno.serve handler
3. Copy CORS handling from existing function
4. Add JWT verification
5. Deploy: `supabase functions deploy [name]`

### Task: Add Offline Support for Operation

1. Define schema in `src/lib/offline/db.ts`
2. Add queue function (like `addPendingSale`)
3. Add sync function in `SyncContext`
4. Handle in component with `isOnline` check

---

## Architecture Decision Records

### Why Edge Functions for Sales?

**Decision:** Use Edge Functions instead of direct Supabase mutations for sales.

**Rationale:**
- Need atomic multi-table transaction
- Complex business validation (inventory status check)
- Idempotency handling for offline retry
- Bill number generation needs locking

### Why Client-Side Auth Check?

**Decision:** Check auth in client layout, not server middleware.

**Rationale:**
- Offline-first PWA needs client-side session access
- Service worker caching conflicts with server auth
- Simpler mental model for client-heavy app

### Why IndexedDB over localStorage?

**Decision:** Use IndexedDB for offline storage.

**Rationale:**
- Structured data with indexes
- Larger storage quota
- Better for querying pending sales
- `idb` library provides nice async API

---

## Glossary

| Term | Meaning |
|------|---------|
| **Lot** | A batch of inventory items from same vendor/date |
| **QR Code** | Unique identifier printed on product tag |
| **POS** | Point of Sale - the checkout interface |
| **RLS** | Row Level Security - Postgres data isolation |
| **Edge Function** | Serverless function in Supabase (Deno runtime) |
| **Anon Key** | Public API key (safe for client) |
| **Service Role Key** | Admin API key (server-only, bypasses RLS) |
| **Client Sale ID** | UUID generated client-side for idempotency |

---

## Support & Resources

### Documentation

- [docs/](../) - All project documentation
- [docs/generated/file-reviews/](../generated/file-reviews/) - Individual file reviews
- [docs/generated/project-reviews/](./index) - This project-level documentation

### External Resources

- [Next.js Docs](https://nextjs.org/docs)
- [Supabase Docs](https://supabase.com/docs)
- [Tailwind CSS Docs](https://tailwindcss.com/docs)
- [Shadcn UI](https://ui.shadcn.com/)
- [TanStack Query](https://tanstack.com/query)

---

## Handover Checklist

For the outgoing maintainer to complete:

- [ ] Environment variables documented
- [ ] All test accounts listed
- [ ] Known bugs documented
- [ ] Pending features listed
- [ ] Deployment credentials shared securely
- [ ] Supabase project access granted
- [ ] Git repository access granted
- [ ] This guide reviewed and updated

---

## Final Tips

1. **Start Small:** Make a small change, see it work, understand why.
2. **Use the Debugger:** Browser DevTools + breakpoints > console.log
3. **Check Supabase Logs:** 90% of backend issues are visible there.
4. **Understand RLS First:** Most "data not showing" bugs are RLS issues.
5. **Test Offline:** Many edge cases only appear offline.
6. **Read Error Messages:** They're usually quite helpful in this codebase.

Good luck! 🚀
