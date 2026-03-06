# Authentication & Session Flow

> Complete documentation of how authentication works from login to session restoration, including route protection and role-based access control.

---

## Overview

The app uses **Supabase Auth** with email/password authentication. Sessions are persisted to `localStorage` and automatically restored on page load. Route protection is handled client-side in the `(protected)` layout.

---

## Authentication Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            INITIAL PAGE LOAD                                │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  AuthContext.useEffect()                                                    │
│  ├─ supabase.auth.getSession()                                              │
│  │   └─ Returns cached session from localStorage (if exists)                │
│  ├─ If session exists:                                                      │
│  │   ├─ Set user state                                                      │
│  │   └─ Fetch profile from profiles table                                   │
│  └─ Set loading = false                                                     │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  onAuthStateChange listener (runs continuously)                             │
│  ├─ SIGNED_IN event → Update user + fetch profile                           │
│  ├─ SIGNED_OUT event → Clear user + profile                                 │
│  └─ TOKEN_REFRESHED → Session auto-renewed (handled by Supabase)            │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Key Components

### 1. Supabase Client Configuration

**File:** `src/lib/supabase.ts`

```typescript
const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,          // Save session to localStorage
    autoRefreshToken: true,        // Auto-refresh before expiry
    storageKey: 'womaniya-auth',   // localStorage key
    storage: customStorage,         // window.localStorage wrapper
  },
});
```

**Storage Key:** `womaniya-auth` in localStorage

**Session Structure:**
```json
{
  "access_token": "eyJ...",
  "refresh_token": "xxx",
  "expires_at": 1234567890,
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    ...
  }
}
```

### 2. AuthContext Provider

**File:** `src/context/AuthContext.tsx`

**Exported State:**
```typescript
interface AuthContextType {
  user: User | null;              // Supabase auth user
  profile: Profile | null;        // App-specific profile data
  loading: boolean;               // Initial auth check in progress
  signIn: (email, password) => Promise<void>;
  signOut: () => Promise<void>;
  hasRole: (role: UserRole) => boolean;
  isAdmin: () => boolean;
  isStaff: () => boolean;
  isSuperadmin: () => boolean;
}
```

**Profile Structure (from profiles table):**
```typescript
interface Profile {
  id: string;                     // Same as auth user ID
  full_name: string;
  phone: string | null;
  role: 'superadmin' | 'owner' | 'admin' | 'staff';
  shop_id: string | null;         // null for superadmin
  is_active: boolean;
  max_discount_percent: number;
  created_at: string;
}
```

---

## Login Flow

### User Journey

```
┌─────────────┐    ┌─────────────────┐    ┌─────────────────────┐
│  /login     │───▶│ signIn(email,   │───▶│ Supabase Auth       │
│  page       │    │ password)       │    │ signInWithPassword  │
└─────────────┘    └─────────────────┘    └──────────┬──────────┘
                                                      │
                          ┌───────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│  onAuthStateChange fires SIGNED_IN event                        │
│  ├─ AuthContext updates user state                              │
│  ├─ Profile fetched from profiles table                         │
│  └─ Session persisted to localStorage                           │
└─────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│  Login page useEffect detects user + profile                    │
│  └─ router.push('/') → Redirects to home                        │
└─────────────────────────────────────────────────────────────────┘
```

### Code Path

**File:** `src/app/login/page.tsx`

```typescript
const handleSubmit = async (e) => {
  e.preventDefault();
  setLoading(true);
  
  try {
    await signIn(email, password);  // From AuthContext
    toast.success('Welcome back!');
    // Redirect handled by useEffect when profile loads
  } catch (error) {
    toast.error(error.message);
    setLoading(false);
  }
};

// Auto-redirect when authenticated
useEffect(() => {
  if (user && profile) {
    router.push('/');
  }
}, [user, profile, router]);
```

**File:** `src/context/AuthContext.tsx`

```typescript
const signIn = async (email: string, password: string) => {
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  
  if (error) {
    throw new Error(error.message);
  }
  // onAuthStateChange will handle the rest
};
```

---

## Session Restoration

### On Page Load/Refresh

```typescript
// AuthContext.tsx useEffect
useEffect(() => {
  const initializeAuth = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user) {
        setUser(session.user);
        await fetchProfile(session.user.id);
      }
    } finally {
      setLoading(false);
    }
  };

  initializeAuth();

  // Listen for auth changes
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        setUser(session.user);
        await fetchProfile(session.user.id);
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setProfile(null);
      }
    }
  );

  return () => subscription.unsubscribe();
}, []);
```

### Token Refresh

Supabase automatically refreshes tokens when:
- `autoRefreshToken: true` is set
- Token is within 60 seconds of expiry
- User makes an API request

---

## Route Protection

### Protected Layout

**File:** `src/app/(protected)/layout.tsx`

```typescript
export default function ProtectedLayout({ children }) {
  const { user, profile, loading } = useAuth();
  const router = useRouter();

  // Show loading state during auth check
  if (loading) {
    return <LoadingSpinner />;
  }

  // Redirect unauthenticated users
  if (!user) {
    router.push('/login');
    return null;
  }

  // Wait for profile to load
  if (!profile) {
    return <LoadingSpinner />;
  }

  // User is authenticated with profile
  return (
    <div>
      {/* Offline status banner */}
      <OfflineBanner />
      {/* Sync warning banner */}
      <SyncWarningBanner />
      {/* Page content */}
      {children}
    </div>
  );
}
```

### Route Structure

```
src/app/
├── login/page.tsx          # Public - Login form
├── (protected)/            # Group - All children require auth
│   ├── layout.tsx          # Auth check wrapper
│   ├── page.tsx            # / (redirects based on role)
│   ├── admin/              # Admin dashboard & tools
│   ├── me/                 # Staff personal dashboard
│   ├── pos/                # Point of sale
│   └── superadmin/         # Superadmin dashboard
```

---

## Role-Based Access Control

### Role Hierarchy

```
superadmin  ─────────────────────────────────────┐
    │                                            │
    ▼                                            │
  owner  ─────────────────────────────────┐      │ Can access
    │                                     │      │ superadmin
    ▼                                     │      │ features
  admin  ─────────────────────────┐       │      │
    │                             │       │      │
    ▼                             │       │      │
  staff                           │       │      │
                                  │       │      │
        ┌─────────────────────────┴───────┴──────┴─────┐
        │              All roles have access to:       │
        │              - /me (personal dashboard)      │
        │              - /pos (point of sale)          │
        └──────────────────────────────────────────────┘
```

### Role Checks in Code

**AuthContext Helpers:**

```typescript
const hasRole = (role: UserRole): boolean => {
  if (!profile) return false;
  
  const roleHierarchy = ['staff', 'admin', 'owner', 'superadmin'];
  const userRoleIndex = roleHierarchy.indexOf(profile.role);
  const requiredRoleIndex = roleHierarchy.indexOf(role);
  
  return userRoleIndex >= requiredRoleIndex;
};

const isAdmin = () => hasRole('admin');
const isStaff = () => hasRole('staff');  // All roles pass
const isSuperadmin = () => profile?.role === 'superadmin';
```

**Usage in Components:**

```typescript
// Hide admin-only features
{isAdmin() && <AdminPanel />}

// Conditional navigation
{isSuperadmin() && (
  <Link href="/superadmin">System Admin</Link>
)}

// Role-based redirects
useEffect(() => {
  if (profile && !isAdmin()) {
    router.push('/me');  // Staff go to personal dashboard
  }
}, [profile]);
```

### Role-Restricted Pages

| Route | Minimum Role | Enforced By |
|-------|--------------|-------------|
| `/admin/*` | admin | Page-level check + UI hiding |
| `/superadmin/*` | superadmin | Layout check + UI hiding |
| `/me` | staff | Available to all |
| `/pos` | staff | Available to all |

---

## Database Integration

### Profile Fetch

```typescript
const fetchProfile = async (userId: string) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) {
    console.error('Profile fetch error:', error);
    // User exists in auth but not in profiles table
    throw new Error('Profile not found');
  }

  setProfile(data);
};
```

### Profiles Table Schema

```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  full_name TEXT NOT NULL,
  phone TEXT,
  role user_role DEFAULT 'staff',
  shop_id UUID REFERENCES shops(id),
  is_active BOOLEAN DEFAULT true,
  max_discount_percent INTEGER DEFAULT 10,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### Row Level Security (RLS)

```sql
-- Users can read their own profile
CREATE POLICY "Users can read own profile"
ON profiles FOR SELECT
USING (auth.uid() = id);

-- Admins can read profiles in their shop
CREATE POLICY "Admins can read shop profiles"
ON profiles FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND shop_id = profiles.shop_id
    AND role IN ('admin', 'owner')
  )
);
```

---

## Logout Flow

```typescript
const signOut = async () => {
  // Clear Supabase session
  await supabase.auth.signOut();
  
  // onAuthStateChange will fire SIGNED_OUT
  // which clears user and profile state
  
  // Router redirect to login
  router.push('/login');
};
```

---

## Edge Cases & Error Handling

### 1. Session Expired

**Scenario:** Token expired and refresh failed

**Behavior:**
- Supabase auth state changes to SIGNED_OUT
- AuthContext clears user/profile
- Protected layout redirects to /login

### 2. Profile Not Found

**Scenario:** User exists in auth but not in profiles table

**Behavior:**
- Profile fetch fails
- User remains in loading state
- Should display error and prompt admin to create profile

### 3. Tab Switching Bug

**Scenario:** Auth state lost after extended tab inactivity

**Documented in:** `docs/SUPABASE_AUTH_TAB_SWITCHING_BUG.md`

**Mitigation:**
- `autoRefreshToken: true` in Supabase config
- Session restoration on visibility change

### 4. Inactive User

**Scenario:** `is_active = false` in profile

**Behavior:**
- Profile loads but should be checked in protected layout
- TODO: Currently not enforced - inactive users can still access

---

## Security Considerations

### Client-Side Limitations

⚠️ **Route protection is client-side only.** Malicious users could:
- Modify localStorage to fake sessions
- Bypass UI role checks

### Server-Side Enforcement

✅ **Data is protected by:**
- Supabase RLS policies on all tables
- JWT verification in Edge Functions
- Service role key only available server-side

### Best Practice

All sensitive operations should go through Edge Functions which:
1. Verify JWT token
2. Look up profile and check role
3. Apply business logic with service role privileges

---

## Testing Authentication

### Manual Testing Checklist

- [ ] Login with valid credentials → Redirects to dashboard
- [ ] Login with invalid credentials → Shows error
- [ ] Refresh page while logged in → Session restored
- [ ] Logout → Redirects to login
- [ ] Access /admin as staff → Redirected or access denied
- [ ] Access /superadmin as admin → Redirected or access denied
- [ ] Clear localStorage → Requires re-login

### Environment Variables

```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

---

## Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| Infinite loading | Profile fetch fails | Check profiles table has entry |
| Session not persisting | localStorage disabled | Check browser settings |
| Role checks failing | Profile not loaded | Wait for loading state |
| Edge Function auth fails | Token not sent | Check Authorization header |
