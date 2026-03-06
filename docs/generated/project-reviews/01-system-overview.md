# System Overview

> A comprehensive guide for new maintainers to understand the high-level architecture, major subsystems, and how they interact.

## Executive Summary

**Womaniya Dashboard** is a Progressive Web App (PWA) for retail inventory management, point-of-sale (POS) operations, staff attendance tracking, and business analytics. Built for a clothing/retail shop, it supports offline-first operations critical for environments with unreliable network connectivity.

---

## Technology Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Frontend** | Next.js 16 (App Router) + React 19 | UI framework with server/client components |
| **Styling** | Tailwind CSS + Shadcn UI | Design system with pre-built accessible components |
| **Backend** | Supabase (PostgreSQL + Auth + Edge Functions) | BaaS providing database, authentication, and serverless functions |
| **State Management** | React Context + TanStack Query | Client-side state and server state caching |
| **Offline Storage** | IndexedDB (via `idb` library) | Local persistence for offline operations |
| **Charts** | Recharts | Data visualization for analytics |

---

## Major Subsystems

### 1. Authentication & Authorization

```
┌─────────────────────────────────────────────────────────┐
│                    AuthContext                          │
│  - Session management (Supabase Auth)                   │
│  - Profile fetching (profiles table)                    │
│  - Role helpers: hasRole(), isAdmin(), isSuperadmin()   │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│                (protected) Layout                        │
│  - Enforces authentication                              │
│  - Redirects unauthenticated users to /login            │
│  - Shows offline/sync status banners                    │
└─────────────────────────────────────────────────────────┘
```

**Key Files:**
- `src/context/AuthContext.tsx` - Global auth state provider
- `src/app/(protected)/layout.tsx` - Route protection wrapper
- `src/lib/supabase.ts` - Supabase client configuration

### 2. Point of Sale (POS)

```
┌────────────────┐    ┌───────────────┐    ┌──────────────┐
│  QR Scan/Search│───▶│     Cart      │───▶│   Checkout   │
│  (Camera/List) │    │ (Client State)│    │   (Dialog)   │
└────────────────┘    └───────────────┘    └──────┬───────┘
                                                   │
                      ┌────────────────────────────┘
                      ▼
        ┌──────────────────────────────────────────┐
        │           Online?                        │
        │   YES ──▶ complete-sale Edge Function    │
        │   NO  ──▶ IndexedDB (pendingSales)       │
        └──────────────────────────────────────────┘
```

**Key Files:**
- `src/app/(protected)/pos/page.tsx` - Main POS interface
- `src/components/pos/` - POS UI components
- `src/lib/api/sales.ts` - Sale completion API
- `supabase/functions/complete-sale/` - Atomic sale processing

### 3. Inventory Management

```
┌─────────────────┐    ┌───────────────────┐    ┌──────────────────┐
│  Add Stock Lot  │───▶│ add-stock-lot     │───▶│  QR Codes        │
│  (Admin Form)   │    │ Edge Function     │    │  (Auto-assigned) │
└─────────────────┘    └───────────────────┘    └──────────────────┘
                                                         │
┌─────────────────┐                              ┌──────▼──────────┐
│  Inventory List │◀─────────────────────────────│ Inventory Items │
│  (View/Adjust)  │                              │ (with status)   │
└─────────────────┘                              └─────────────────┘
```

**Key Tables:** `qr_codes`, `lots`, `inventory_items`, `categories`, `sizes`

### 4. Offline Sync System

```
┌─────────────────────────────────────────────────────────┐
│                    SyncContext                          │
│  - Monitors online/offline status                       │
│  - Manages pendingSales queue                          │
│  - Auto-syncs on connectivity restoration              │
│  - 30-second sync interval when online                 │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│                    IndexedDB                            │
│  - pendingSales: Queue of unsynced sales               │
│  - inventoryCache: Cached products for offline lookup  │
│  - failedSales: Permanently failed transactions        │
└─────────────────────────────────────────────────────────┘
```

**Key Files:**
- `src/context/SyncContext.tsx` - Sync orchestration
- `src/lib/offline/db.ts` - IndexedDB operations
- `src/hooks/useOfflineStatus.ts` - Network status detection

### 5. Staff Management

```
┌─────────────────┐    ┌───────────────────┐    ┌──────────────────┐
│  Admin Panel    │───▶│ profiles table    │◀───│  Staff Portal    │
│  (CRUD Staff)   │    │ (with roles)      │    │  (/me dashboard) │
└─────────────────┘    └───────────────────┘    └──────────────────┘
                                │
                                ▼
                       ┌────────────────────┐
                       │ attendance_logs    │
                       │ staff_checklists   │
                       └────────────────────┘
```

---

## Directory Structure

```
womaniya-dashboard/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── (protected)/        # Auth-required routes
│   │   │   ├── admin/          # Admin dashboard & tools
│   │   │   ├── me/             # Staff personal dashboard
│   │   │   ├── pos/            # Point of sale
│   │   │   └── superadmin/     # System administration
│   │   ├── login/              # Public login page
│   │   └── layout.tsx          # Root layout
│   ├── components/
│   │   ├── pos/                # POS-specific components
│   │   ├── staff/              # Staff portal components
│   │   ├── shared/             # Cross-domain components
│   │   ├── tablet/             # Mobile/tablet chrome
│   │   └── ui/                 # Shadcn UI primitives
│   ├── context/                # React Context providers
│   │   ├── AuthContext.tsx     # Authentication state
│   │   └── SyncContext.tsx     # Offline sync state
│   ├── hooks/                  # Custom React hooks
│   ├── lib/
│   │   ├── api/                # Supabase API wrappers
│   │   ├── offline/            # IndexedDB operations
│   │   ├── supabase.ts         # Supabase client
│   │   └── utils.ts            # Utility functions
│   └── types/                  # TypeScript definitions
├── supabase/
│   ├── functions/              # Edge Functions (Deno)
│   │   ├── add-stock-lot/      # Bulk inventory creation
│   │   ├── complete-sale/      # Atomic sale processing
│   │   └── _shared/            # Shared function utilities
│   └── migrations/             # Database migrations
└── public/                     # Static assets + PWA manifest
```

---

## Server vs Client Components

### Server Components (Default in App Router)
- Static layouts, metadata generation
- **Not used extensively** - This app is primarily client-rendered for offline support

### Client Components ('use client')
- **All pages under (protected)** - Require auth state
- Interactive UI (forms, dialogs, data tables)
- Components using React hooks, Context, or browser APIs

### Why Client-Heavy?
1. **Offline-First PWA**: Browser APIs needed for IndexedDB, service workers
2. **Real-time Auth State**: Client-side session management
3. **Interactive UI**: Most features require user interaction

---

## Data Flow Summary

```
┌──────────────────────────────────────────────────────────────────┐
│                         Client (Browser)                          │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────┐   │
│  │ React State │◀──▶│ TanStack    │◀──▶│ Supabase JS Client │   │
│  │ (UI State)  │    │ Query Cache │    │ (Network Layer)     │   │
│  └─────────────┘    └─────────────┘    └─────────┬───────────┘   │
│                                                   │               │
│  ┌─────────────────────────────────────────────┐ │               │
│  │ IndexedDB (Offline Fallback)                │◀┘               │
│  └─────────────────────────────────────────────┘                 │
└──────────────────────────────────────────────────────────────────┘
                                │
                                ▼ HTTPS
┌──────────────────────────────────────────────────────────────────┐
│                      Supabase (Backend)                          │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────┐   │
│  │ Auth        │    │ Edge        │    │ PostgreSQL          │   │
│  │ (Sessions)  │    │ Functions   │    │ (+ RLS Policies)    │   │
│  └─────────────┘    └─────────────┘    └─────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
```

---

## Key Architectural Decisions

### 1. Edge Functions for Critical Operations
**Why**: Sale completion and stock addition require atomic, multi-table transactions with business logic validation.

**Where**: `supabase/functions/complete-sale/`, `supabase/functions/add-stock-lot/`

**How**: Client invokes via `supabase.functions.invoke()`, function uses service role key to bypass RLS.

### 2. Client-Side Route Protection
**Why**: Next.js App Router SSR would require server-side auth which conflicts with offline-first goals.

**Where**: `src/app/(protected)/layout.tsx`

**How**: Layout checks `AuthContext`, shows loading state, redirects if unauthenticated.

### 3. Idempotent Sale Processing
**Why**: Offline-first means duplicate submissions are possible when sync retries.

**Where**: `client_sale_id` field in sales table, checked in Edge Function

**How**: Client generates UUID, server rejects duplicates, returns existing sale.

### 4. Type Generation from Database
**Why**: Single source of truth for data shapes, catches schema drift at compile time.

**Where**: `src/types/database.types.ts` (generated via Supabase CLI)

**How**: Run `supabase gen types typescript` after schema changes.

---

## Common Patterns

### API Wrapper Pattern
```typescript
// src/lib/api/sales.ts
export async function completeSale(request: CompleteSaleRequest) {
  const { data, error } = await supabase.functions.invoke('complete-sale', {
    body: request,
  });
  
  if (error) throw mapEdgeFunctionError(error);
  if (data?.error) throw mapBusinessError(data);
  
  return data as CompleteSaleResponse;
}
```

### Context + Hook Pattern
```typescript
// Usage in components
const { user, profile, hasRole } = useAuth();
const { pendingSales, syncNow, isOnline } = useSync();
```

### Page Structure Pattern
```tsx
// Typical protected page
'use client';

import { useAuth } from '@/context/AuthContext';
import { useSync } from '@/context/SyncContext';

export default function SomePage() {
  const { profile, loading } = useAuth();
  const { isOnline } = useSync();
  
  if (loading) return <LoadingSpinner />;
  
  return (/* page content */);
}
```

---

## Quick Reference

| Concern | Location |
|---------|----------|
| Add a new protected page | `src/app/(protected)/[page]/page.tsx` |
| Add a new Edge Function | `supabase/functions/[name]/index.ts` |
| Add a new database table | Supabase Dashboard → regenerate types |
| Add a new UI component | `src/components/ui/` (Shadcn) or domain folder |
| Modify auth flow | `src/context/AuthContext.tsx` |
| Modify offline behavior | `src/context/SyncContext.tsx`, `src/lib/offline/db.ts` |

---

## Next Steps for New Maintainers

1. **Read** [02-auth-session-flow.md](02-auth-session-flow.md) to understand authentication
2. **Read** [03-data-flow-ownership.md](03-data-flow-ownership.md) to understand data movement
3. **Set up local environment** following `.env.example` and `docs/QUICK_START.md`
4. **Run the app** with `npm run dev` and explore each route
5. **Review database schema** in Supabase Dashboard or `src/types/database.types.ts`
