# 🗺️ Enterprise-Grade Routing Architecture

**Philosophy**: Role-based progressive disclosure with fail-safe defaults

---

## 🎯 Core Principles (30+ Years of Wisdom)

### 1. **Single Source of Truth**
- Role determines access, NOT URL manipulation
- Server-side RLS is the ultimate guardian
- Frontend routing is UX convenience, not security

### 2. **Progressive Disclosure**
- Show only what the user needs for their job
- Reduce cognitive load with focused interfaces
- Staff sees 4 routes, superadmin sees 15+

### 3. **Fail-Safe Defaults**
- Unknown routes → `/` (home based on role)
- Unauthorized access → Redirect to their home
- Missing data → Graceful empty states

### 4. **Performance First**
- Static routes (no dynamic segments unless necessary)
- Prefetch navigation links
- Lazy load admin components

### 5. **Offline Resilience**
- All routes work offline after first load
- POS works 100% offline
- Sync indicators always visible

---

## 🚦 Route Structure by Role

### 🔴 **Staff** (Frontline Workers)
**Purpose**: Daily operations only

```
/ ──────────────────────── Dashboard (Quick Actions)
│
├── /me/attendance ──────── Clock In/Out
│
├── /me/checklists ─────── Daily Tasks
│
└── /pos ───────────────── Point of Sale (PRIMARY)
```

**Navigation**: Bottom nav with 4 tabs
- 🏠 Home
- ✅ Tasks
- 💰 POS (primary CTA)
- 👤 Me

**Restrictions**:
- Cannot access /admin routes
- Cannot access /owner routes
- Cannot view other staff data
- Cannot modify settings

---

### 🟡 **Admin** (Store Managers)
**Purpose**: Daily operations + inventory + staff management

```
/ ──────────────────────── Auto-redirect to /admin

/admin ─────────────────── Admin Dashboard
│
├── /admin/inventory ───── Stock Overview
│   └── /admin/inventory/add-lot ─── Add New Stock
│
├── /admin/sales ───────── Sales History
│   └── /admin/sales/[saleId] ──── Sale Details
│
├── /admin/staff ───────── Team Management
│
├── /admin/attendance ──── Attendance Records
│
├── /admin/checklists ──── Task Templates
│
├── /admin/qr-codes ────── QR Management
│
├── /admin/sync-issues ─── Offline Sync Monitor
│
└── /admin/settings ────── Shop Config
    ├── Categories
    ├── Sizes
    ├── Tax Rates
    └── Expense Categories

/pos ───────────────────── POS Access (same as staff)
/me/attendance ─────────── Personal Attendance
/me/checklists ─────────── Personal Tasks
```

**Navigation**: Sidebar + Bottom Nav
- Sidebar for admin routes (desktop)
- Bottom nav for quick actions (tablet)

**Restrictions**:
- Cannot access /owner routes
- Cannot delete shop
- Cannot manage billing
- Cannot see financial analytics (beyond sales)

---

### 🟠 **Owner** (Business Owner)
**Purpose**: All admin features + financials + analytics

```
/ ──────────────────────── Auto-redirect to /owner

/owner ─────────────────── Owner Dashboard (Analytics)
│
├── /owner/finances ────── Financial Overview
│   ├── Revenue Analytics
│   ├── Expense Tracking
│   ├── Profit Margins
│   └── Tax Reports
│
├── /owner/analytics ───── Business Intelligence
│   ├── Sales Trends
│   ├── Inventory Turnover
│   ├── Staff Performance
│   └── Customer Insights
│
└── /owner/reports ─────── Export & Reports
    ├── Monthly P&L
    ├── GST Reports
    ├── Stock Valuation
    └── Custom Reports

(All /admin routes accessible)
(All /pos, /me routes accessible)
```

**Navigation**: Enhanced sidebar with owner section
- Owner section at top
- Admin section below
- Quick actions at bottom

**Restrictions**:
- Cannot access /superadmin routes
- Cannot manage multiple shops
- Single shop context only

---

### 🔵 **Superadmin** (Platform Admin / Multi-Shop Owner)
**Purpose**: Everything + multi-shop management

```
/ ──────────────────────── Superadmin Control Panel

/superadmin ────────────── Platform Overview
│
├── /superadmin/shops ──── All Shops Management
│   ├── Create New Shop
│   ├── Shop Analytics
│   └── Shop Settings
│
├── /superadmin/users ──── User Management (All Shops)
│
├── /superadmin/billing ─── Subscription & Billing
│
├── /superadmin/system ─── System Health
│   ├── Database Stats
│   ├── Edge Function Logs
│   └── API Performance
│
└── /superadmin/migrations ─ Schema Changes

(Can switch shop context to access any shop's data)
(All /owner, /admin, /pos, /me routes accessible)
```

**Navigation**: Multi-level sidebar
- Shop switcher at top
- Superadmin routes
- Current shop routes (owner/admin)
- Quick actions

---

## 🔐 Route Protection Layers

### Layer 1: Layout Guards (Immediate Redirect)

```tsx
// app/(protected)/layout.tsx
export default function ProtectedLayout() {
  const { user, loading } = useAuth();
  
  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [user, loading]);
  
  if (!user) return null; // Critical: prevent flash
  return <>{children}</>;
}
```

### Layer 2: Role Guards (Permission Check)

```tsx
// app/(protected)/admin/layout.tsx
export default function AdminLayout() {
  const { profile, loading } = useAuth();
  
  useEffect(() => {
    if (!loading && !hasRole(['admin', 'owner', 'superadmin'])) {
      router.push('/'); // Send to their home
    }
  }, [profile, loading]);
  
  if (!hasRole(['admin', 'owner', 'superadmin'])) return null;
  return <>{children}</>;
}
```

### Layer 3: RLS Policies (Database Guardian)

```sql
-- Even if they bypass frontend, RLS blocks unauthorized data access
CREATE POLICY "Users see only their shop's data"
ON inventory_items
FOR SELECT
USING (shop_id = current_shop_id());
```

---

## 🏗️ File Structure

```
src/app/
├── layout.tsx ─────────────── Root layout (global styles, providers)
├── page.tsx ───────────────── Public landing (redirects if logged in)
│
├── login/
│   └── page.tsx ───────────── Login form
│
├── (protected)/ ───────────── Route group (auth required)
│   ├── layout.tsx ─────────── Protected layout (auth check)
│   ├── page.tsx ───────────── Role-based home router
│   │
│   ├── pos/
│   │   └── page.tsx ───────── POS (all roles)
│   │
│   ├── me/
│   │   ├── attendance/
│   │   │   └── page.tsx ───── Personal attendance
│   │   └── checklists/
│   │       └── page.tsx ───── Personal tasks
│   │
│   ├── admin/ ─────────────── Admin routes
│   │   ├── layout.tsx ─────── Admin guard (admin+ only)
│   │   ├── page.tsx ───────── Admin dashboard
│   │   ├── inventory/
│   │   ├── sales/
│   │   ├── staff/
│   │   ├── attendance/
│   │   ├── checklists/
│   │   ├── qr-codes/
│   │   ├── sync-issues/
│   │   └── settings/
│   │
│   ├── owner/ ─────────────── Owner routes
│   │   ├── layout.tsx ─────── Owner guard (owner+ only)
│   │   ├── page.tsx ───────── Owner dashboard
│   │   ├── finances/
│   │   ├── analytics/
│   │   └── reports/
│   │
│   └── superadmin/ ────────── Superadmin routes
│       ├── layout.tsx ─────── Superadmin guard
│       ├── page.tsx ───────── Platform overview
│       ├── shops/
│       ├── users/
│       ├── billing/
│       └── system/
```

---

## 🎨 Navigation Patterns

### Mobile/Tablet (Touch-First)

```tsx
// Bottom Navigation (Always Visible)
<BottomNav>
  {/* Staff sees 4 items */}
  {hasRole('staff') && (
    <>
      <NavItem href="/" icon={Home}>Home</NavItem>
      <NavItem href="/me/checklists" icon={CheckSquare}>Tasks</NavItem>
      <NavItem href="/pos" icon={ShoppingCart} primary>POS</NavItem>
      <NavItem href="/me/attendance" icon={Clock}>Time</NavItem>
    </>
  )}
  
  {/* Admin sees 5 items */}
  {hasRole(['admin', 'owner', 'superadmin']) && (
    <>
      <NavItem href="/admin" icon={LayoutDashboard}>Admin</NavItem>
      <NavItem href="/admin/inventory" icon={Package}>Stock</NavItem>
      <NavItem href="/pos" icon={ShoppingCart} primary>POS</NavItem>
      <NavItem href="/admin/sales" icon={TrendingUp}>Sales</NavItem>
      <NavItem href="/admin/settings" icon={Settings}>Settings</NavItem>
    </>
  )}
</BottomNav>
```

### Desktop (Sidebar)

```tsx
// Left Sidebar (Collapsible)
<Sidebar>
  {/* Role-based sections */}
  {isSuperadmin && (
    <SidebarSection title="Platform">
      <NavItem href="/superadmin/shops">All Shops</NavItem>
      <NavItem href="/superadmin/users">All Users</NavItem>
    </SidebarSection>
  )}
  
  {hasRole(['owner', 'superadmin']) && (
    <SidebarSection title="Business">
      <NavItem href="/owner/finances">Finances</NavItem>
      <NavItem href="/owner/analytics">Analytics</NavItem>
    </SidebarSection>
  )}
  
  {hasRole(['admin', 'owner', 'superadmin']) && (
    <SidebarSection title="Operations">
      <NavItem href="/admin/inventory">Inventory</NavItem>
      <NavItem href="/admin/sales">Sales</NavItem>
      <NavItem href="/admin/staff">Staff</NavItem>
    </SidebarSection>
  )}
</Sidebar>
```

---

## 🔄 Route Transition Logic

### Smart Home Router (`/page.tsx`)

```tsx
'use client';

export default function HomePage() {
  const { profile, loading } = useAuth();
  const router = useRouter();
  
  useEffect(() => {
    if (!loading && profile) {
      // Route to role-appropriate home
      switch (profile.role) {
        case 'superadmin':
          router.replace('/superadmin');
          break;
        case 'owner':
          router.replace('/owner');
          break;
        case 'admin':
          router.replace('/admin');
          break;
        case 'staff':
          // Staff stays on / (their dashboard)
          break;
      }
    }
  }, [profile, loading, router]);
  
  if (loading) return <LoadingSpinner />;
  
  // If staff, show their dashboard
  if (profile?.role === 'staff') {
    return <StaffDashboard />;
  }
  
  // Transitioning to role-specific route
  return <LoadingSpinner />;
}
```

---

## 🐛 Common Pitfalls & Solutions

### Pitfall 1: Infinite Redirect Loops

**Problem**: `useEffect` triggers redirect which remounts component which triggers useEffect...

**Solution**: Use `router.replace()` instead of `router.push()` and add guard flag

```tsx
const [hasRedirected, setHasRedirected] = useState(false);

useEffect(() => {
  if (!loading && profile && !hasRedirected) {
    setHasRedirected(true);
    router.replace('/admin'); // Replace, don't push
  }
}, [profile, loading, hasRedirected]);
```

### Pitfall 2: Flash of Wrong Content

**Problem**: User sees admin page for 100ms before redirect kicks in

**Solution**: Return `null` while checking auth

```tsx
if (loading || !profile) return null; // Don't show anything

if (!hasRole(['admin'])) {
  router.push('/');
  return null; // Critical!
}

return <AdminContent />;
```

### Pitfall 3: Multiple Tabs Causing Race Conditions

**Problem**: Opening same route in new tab causes infinite loading

**Solution**: Add session storage flag + instance ID

```tsx
// AuthContext.tsx
useEffect(() => {
  const instanceId = Date.now().toString();
  sessionStorage.setItem('authInstanceId', instanceId);
  
  let mounted = true;
  
  supabase.auth.getSession().then(({ data: { session } }) => {
    // Only update state if this instance is still active
    if (mounted && sessionStorage.getItem('authInstanceId') === instanceId) {
      setUser(session?.user ?? null);
      // ... rest of logic
    }
  });
  
  return () => {
    mounted = false;
  };
}, []);
```

### Pitfall 4: Stale Profile Data After Role Change

**Problem**: User's role is changed in DB but UI doesn't update

**Solution**: Real-time subscription to profile changes

```tsx
// AuthContext.tsx
useEffect(() => {
  if (!user?.id) return;
  
  const channel = supabase
    .channel('profile-changes')
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'profiles',
        filter: `id=eq.${user.id}`,
      },
      (payload) => {
        setProfile(payload.new as Profile);
      }
    )
    .subscribe();
  
  return () => {
    supabase.removeChannel(channel);
  };
}, [user?.id]);
```

---

## 🚀 Implementation Priority

### Phase 1: Core Routes (Week 1)
- ✅ `/login`
- ✅ `/(protected)/layout.tsx`
- ✅ `/(protected)/page.tsx` (staff dashboard)
- ✅ `/pos`
- ⚠️ Fix infinite loading bug

### Phase 2: Admin Routes (Week 2)
- `/admin/layout.tsx` (fix guard logic)
- `/admin/page.tsx` (dashboard)
- `/admin/inventory`
- `/admin/settings`

### Phase 3: Owner Routes (Week 3)
- `/owner/layout.tsx`
- `/owner/finances`
- `/owner/analytics`

### Phase 4: Advanced (Week 4+)
- `/superadmin` routes
- Real-time subscriptions
- Advanced analytics
- Multi-shop switching

---

## 📊 Route Access Matrix

| Route | Staff | Admin | Owner | Superadmin |
|-------|-------|-------|-------|------------|
| `/login` | ✅ | ✅ | ✅ | ✅ |
| `/` | ✅ Dashboard | ↪️ /admin | ↪️ /owner | ↪️ /superadmin |
| `/pos` | ✅ | ✅ | ✅ | ✅ |
| `/me/*` | ✅ | ✅ | ✅ | ✅ |
| `/admin/*` | ❌ | ✅ | ✅ | ✅ |
| `/owner/*` | ❌ | ❌ | ✅ | ✅ |
| `/superadmin/*` | ❌ | ❌ | ❌ | ✅ |

---

## 💡 Pro Tips from 30+ Years

1. **Route names should be job titles, not features**
   - Good: `/admin/inventory`
   - Bad: `/inventory-management-dashboard`

2. **Depth indicates complexity**
   - Staff: 2 levels max (`/me/attendance`)
   - Admin: 3 levels max (`/admin/inventory/add-lot`)
   - Owner: 4 levels for analytics (`/owner/analytics/sales/trends`)

3. **Use route groups for organization, not URLs**
   - `(protected)` doesn't appear in URL
   - `(admin)` keeps codebase organized

4. **Prefetch navigation targets**
   ```tsx
   <Link href="/admin/inventory" prefetch={true}>
   ```

5. **URL state for filters, not navigation**
   ```
   /admin/sales?status=completed&date=2024-12
   ```

6. **Progressive enhancement**
   - Works without JS for login
   - Enhances with JS for navigation

7. **Mobile-first route priority**
   - Most used: `/pos` (60% of traffic)
   - Second: `/admin/inventory` (20%)
   - Third: `/admin/sales` (10%)

---

This architecture scales from 1 user to 1000 shops. Start simple, expand systematically.
