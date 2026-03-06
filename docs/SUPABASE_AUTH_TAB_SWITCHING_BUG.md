# Supabase Auth Tab Switching Bug - Workaround Documentation

## 🐛 The Problem

### Symptom
When users switch browser tabs or minimize the app and return later, all data disappears and the app shows loading spinners or empty states. A hard refresh is required to restore the data.

### Root Cause
Supabase Auth **intentionally** fires `SIGNED_IN` events when browser tabs regain focus. This is a feature designed for mobile devices to recover sessions after being in the background.

**Official Supabase Response:**
> "This is intentional behavior since tabs can be forgotten for a very long time in certain cases, and when you come back to the tab the user is effectively 'signed-in' again."

**The Issue:**
- When tab regains focus → Supabase validates session
- Validation triggers `onAuthStateChange` with `SIGNED_IN` event
- Even though user never actually signed in again
- React components listening to auth changes re-render
- Profile object gets re-fetched, creating new object reference
- New object reference triggers useEffect dependencies
- Pages clear data and show loading states

## ✅ The Solution

### Implementation: Session Tracking Wrapper

Track the current user ID and only update state when it **actually changes**, not just when Supabase fires events.

```typescript
// src/context/AuthContext.tsx

useEffect(() => {
  let mounted = true;
  let currentUserId: string | null = null; // 👈 Track current user ID

  // Get initial session
  supabase.auth.getSession().then(({ data: { session } }) => {
    if (!mounted) return;
    setUser(session?.user ?? null);
    
    if (session?.user) {
      currentUserId = session.user.id; // 👈 Store initial user ID
      fetchProfile(session.user.id).then(profileData => {
        if (mounted) {
          setProfile(profileData);
          setLoading(false);
        }
      });
    } else {
      setLoading(false);
    }
  });

  // Listen for auth changes with session tracking
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    async (event, session) => {
      // User signed out - clear everything
      if (event === 'SIGNED_OUT') {
        currentUserId = null;
        setUser(null);
        setProfile(null);
        setLoading(false);
        return;
      }
      
      // Check if user ID actually changed
      if (session?.user) {
        if (session.user.id === currentUserId) {
          // 👈 CRITICAL: Same user, skip profile fetch
          return; // Prevents profile object recreation and re-renders
        }
        
        // User ID changed - update everything
        currentUserId = session.user.id;
        setUser(session.user);
        const userProfile = await fetchProfile(session.user.id);
        setProfile(userProfile);
      }
    }
  );

  return () => {
    mounted = false;
    subscription.unsubscribe();
  };
}, []);
```

### Why This Works

1. **Without Fix:**
   - Tab focus → `SIGNED_IN` event
   - Profile fetched → New object created
   - Object reference changed → useEffect triggers
   - Data cleared → Loading spinner shown

2. **With Fix:**
   - Tab focus → `SIGNED_IN` event
   - Check user ID → Same as before
   - Return early → No profile fetch
   - No object recreation → No re-renders
   - Data persists ✅

## 📋 DO's and DON'Ts

### ✅ DO

1. **Track session state with local variables**
   ```typescript
   let currentUserId: string | null = null;
   ```

2. **Return early when user ID unchanged**
   ```typescript
   if (session.user.id === currentUserId) return;
   ```

3. **Use specific dependencies in useEffect**
   ```typescript
   // ✅ Good - only re-run when shop_id changes
   useEffect(() => {
     if (profile?.shop_id) loadData();
   }, [profile?.shop_id]);
   ```

4. **Handle undefined profile states**
   ```typescript
   if (profile?.shop_id) {
     loadData();
   } else if (profile !== undefined) {
     setLoading(false); // Prevent infinite spinner
   }
   ```

### ❌ DON'T

1. **Don't depend on entire profile object**
   ```typescript
   // ❌ Bad - triggers on every profile object recreation
   useEffect(() => {
     loadData();
   }, [profile]);
   ```

2. **Don't fetch profile on every auth event**
   ```typescript
   // ❌ Bad - creates new object even when user unchanged
   supabase.auth.onAuthStateChange(async (event, session) => {
     if (session?.user) {
       const profile = await fetchProfile(session.user.id); // Always fetches
       setProfile(profile);
     }
   });
   ```

3. **Don't use `multiTab: false`**
   ```typescript
   // ❌ Bad - disables cross-tab session sync
   createClient(supabaseUrl, supabaseKey, { multiTab: false });
   ```
   This "fixes" the issue but breaks legitimate multi-tab functionality.

4. **Don't clear state on TOKEN_REFRESHED**
   ```typescript
   // ❌ Bad - clears state during normal token refresh
   if (event === 'TOKEN_REFRESHED') {
     setUser(null);
     setProfile(null);
   }
   ```

## 🔍 Alternative Solutions (Not Recommended)

### 1. Disable Multi-Tab Support
```typescript
const supabase = createClient(url, key, { multiTab: false });
```
**Why not:** Breaks session sync across tabs.

### 2. Debounce Auth Changes
Add delay before processing auth events.
**Why not:** Adds latency, doesn't solve root cause.

### 3. Manual Refresh Button
Add UI button for users to manually refresh data.
**Why not:** Poor UX, treats symptom not cause.

## 📚 References

- **GitHub Issue:** [supabase/gotrue-js#95](https://github.com/supabase/gotrue-js/issues/95)
- **Key Quote:** "This is intentional behavior... when you come back to the tab the user is effectively 'signed-in' again."
- **Community Workaround:** Session tracking wrapper pattern (implemented above)

## 🧪 Testing

### Test Case 1: Tab Switching
1. Login to app
2. Navigate to data-heavy page (Inventory, Finances)
3. Switch to different app for 2+ minutes
4. Return to browser tab
5. **Expected:** Data persists, no loading spinner

### Test Case 2: Multiple Tabs
1. Open app in Tab A
2. Open same app in Tab B
3. Login in Tab A
4. Switch to Tab B
5. **Expected:** Tab B reflects logged-in state

### Test Case 3: Token Refresh
1. Login to app
2. Wait for token expiry (~1 hour)
3. Perform an action
4. **Expected:** Silent token refresh, no data loss

## 📝 Maintenance Notes

- The `currentUserId` variable is scoped to the useEffect hook
- Cleanup function unsubscribes from auth listener on unmount
- This pattern is React 18+ compatible
- No external dependencies required
- Works with Next.js 13+ App Router

## 🚀 Impact

**Before Fix:**
- Users lost data on tab switches
- Required hard refresh to restore
- Infinite loading spinners
- Poor user experience

**After Fix:**
- Data persists across tab switches
- Seamless session recovery
- No unnecessary re-renders
- Production-ready stability

---

**Last Updated:** December 21, 2025  
**Status:** ✅ Implemented and Tested  
**Affects:** All Supabase + React applications using `onAuthStateChange`
