# Womaniya Dashboard - Immediate Action Plan

**Date:** December 20, 2025  
**Status:** Debugging & Cleanup Phase

---

## ✅ CURRENT STATUS: Login Working!

### Resolved Issues
- ✅ Supabase project restored (was paused)
- ✅ Login working with redirect
- ✅ Admin/staff role-based routing implemented
- ✅ Database schema fully deployed (18 tables)
- ✅ TypeScript types generated from database

### Likely Causes

#### 1. **Profile Fetch Failing** (Most Likely)
After successful auth, the app tries to fetch user profile from `profiles` table. If this fails, user stays logged in but `profile` is null, causing infinite redirect loop.

**Check in AuthContext.tsx:**
```typescript
async function fetchProfile(userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) {
    console.error('Error fetching profile:', error); // Check console!
    return null;
  }
  return data;
}
```

**Possible Reasons:**
- User doesn't have a profile record in `profiles` table
- RLS policies are blocking the query
- Profile table structure doesn't match the types

#### 2. **RLS Policies Too Restrictive**
The `profiles` table might have RLS enabled but no policy allowing users to read their own profile.

**Required Policy:**
```sql
-- Allow users to read their own profile
CREATE POLICY "Users can view own profile"
ON profiles FOR SELECT
USING (auth.uid() = id);
```

#### 3. **Session Storage Issue**
Browser's localStorage might be corrupted or blocked.

**Fix:**
- Clear browser localStorage
- Check browser console for storage errors
- Try incognito mode

---

## ✅ IMMEDIATE DEBUG STEPS (Do This Now!)

### Step 0: Unpause Supabase Project (2 minutes) 🚨 CRITICAL

**If your project was paused due to inactivity, this is the issue!**

A paused project means:
- ✅ Auth API works (returns 200 OK) 
- ❌ Database is offline (profile fetch fails)
- ❌ Edge Functions are offline

**How to Restore:**
1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Look for "Project Paused" banner
4. Click **"Restore Project"** or **"Unpause"**
5. Wait 1-2 minutes for database to start
6. Try logging in again - should work now!

**Note:** Free tier projects pause after 7 days of inactivity. To prevent this:
- Upgrade to Pro ($25/month) for always-on projects, OR
- Keep project active by logging in at least once per week

---

### Step 1: Check Browser Console (5 minutes)

1. Open DevTools (F12)
2. Go to Console tab
3. Try logging in
4. Look for errors specifically:
   - "Error fetching profile"
   - RLS policy violations
   - Network errors

### Step 2: Verify Profile Exists (5 minutes)

1. Go to Supabase Studio
2. Open `profiles` table
3. Check if a profile exists for your user
4. Verify the `id` matches your `auth.users.id`

**If NO profile exists:**
```sql
-- Create profile manually
INSERT INTO profiles (id, shop_id, role, email, full_name)
VALUES (
  'YOUR_AUTH_USER_ID',
  'YOUR_SHOP_ID',
  'admin',
  'your@email.com',
  'Your Name'
);
```

### Step 3: Check RLS Policies (5 minutes)

1. In Supabase Studio, go to Authentication → Policies
2. Check `profiles` table policies
3. Ensure there's a SELECT policy allowing users to read their own profile

**If missing, add this policy:**
```sql
CREATE POLICY "Users can view own profile"
ON profiles FOR SELECT
USING (auth.uid() = id);
```

### Step 4: Add Debug Logging (10 minutes)

Edit [src/context/AuthContext.tsx](src/context/AuthContext.tsx):

```typescript
// Add more logging
async function fetchProfile(userId: string) {
  console.log('🔍 Fetching profile for user:', userId);
  
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) {
    console.error('❌ Error fetching profile:', error);
    console.error('Error details:', JSON.stringify(error, null, 2));
    return null;
  }

  console.log('✅ Profile fetched:', data);
  return data;
}
```

Then try logging in again and check console output.

---

## 🗑️ DOCUMENTATION CLEANUP

### Files to **DELETE** (Outdated/Conflicting):

1. **README.md** - Default Next.js boilerplate, not customized
2. **CODE_REVIEW_SUGGESTIONS.md** - Old analysis, superseded by current plan
3. **CRITICAL_FIXES_REQUIRED.md** - Old issues, many not relevant
4. **PROJECT_STATUS.md** - Outdated status, conflicts with reality
5. **COMPREHENSIVE_TESTING_GUIDE.md** - Premature, no tests yet
6. **DEVELOPMENT_INTERVIEW_GUIDE.md** - Not needed
7. **All .agent.md files** - Not part of the actual project

### Files to **KEEP**:

1. **UPDATED_REQUIREMENTS.md** - Source of truth for requirements ✅
2. **SUPABASE_SETUP_GUIDE.md** - Useful reference ✅
3. **PROJECT_ANALYSIS_AND_ROADMAP.md** - Current comprehensive analysis ✅
4. **QUICK_START.md** - Useful for onboarding ✅
5. **THIS FILE (ACTION_PLAN.md)** - Current action plan ✅

### Files to **CREATE**:

1. **DEVELOPMENT_LOG.md** - Daily progress tracking
2. **BUGS.md** - Known issues tracker

---

## 📋 NEXT STEPS AFTER LOGIN FIX

### Priority 1: Verify Core Functionality (Day 1)

- [ ] Login works and redirects to dashboard
- [ ] Can navigate to POS page
- [ ] Can scan QR code (or enter manually)
- [ ] Can add item to cart
- [ ] Can complete checkout
- [ ] Sale saves to Supabase (check in Studio)

### Priority 2: Fix Known Issues (Day 2-3)

1. **Type Safety**
   - [ ] Generate fresh types: `npx supabase gen types typescript --project-id nyrorjhhpvnwxfpnxgxv > src/types/database.types.ts`
   - [ ] Replace `any` types in offline/db.ts
   - [ ] Replace `any` types in admin pages
   - [ ] Fix Edge Function TypeScript errors

2. **Edge Functions**
   - [ ] Fix `complete-sale` Deno types
   - [ ] Test `complete-sale` locally
   - [ ] Fix `add-stock-lot` Deno types
   - [ ] Deploy both functions

3. **Clean Up Empty Folders**
   - [ ] Delete unused component folders
   - [ ] Remove .agent.md files
   - [ ] Archive outdated documentation

### Priority 3: Service Worker (Day 4)

- [ ] Install next-pwa
- [ ] Configure caching strategies
- [ ] Test offline mode
- [ ] Test PWA installation on tablet

### Priority 4: Admin Pages (Week 2)

- [ ] Inventory list page
- [ ] Add stock lot page
- [ ] Sales history page
- [ ] Finance dashboard

---

## 🔧 QUICK FIXES CHECKLIST

### If Login Still Doesn't Work:

1. **Nuclear Option: Reset Auth State**
   ```javascript
   // In browser console
   localStorage.clear();
   sessionStorage.clear();
   location.reload();
   ```

2. **Check Supabase Project Status**
   - Is project paused? (Check Supabase dashboard)
   - Are there any service issues?
   - Is the API key correct in .env.local?

3. **Verify Environment Variables**
   ```bash
   # Should see both variables
   cat .env.local
   ```

4. **Test Direct Supabase Connection**
   Create a test page to verify Supabase works:
   ```typescript
   // pages/test-supabase.tsx
   const { data, error } = await supabase.from('profiles').select('*').limit(1);
   console.log({ data, error });
   ```

---

## 📝 DEVELOPMENT WORKFLOW (Going Forward)

### Daily Routine:

1. **Morning:**
   - Pull latest code
   - Check BUGS.md for blocking issues
   - Review today's tasks in this ACTION_PLAN.md

2. **During Development:**
   - Work on ONE feature at a time
   - Test immediately after implementation
   - Update DEVELOPMENT_LOG.md with progress

3. **Before Committing:**
   - Run `npm run build` (ensure no errors)
   - Test the feature manually
   - Update documentation if needed

### Testing Before Deploy:

1. **Manual Testing Checklist:**
   - [ ] Login/logout works
   - [ ] POS workflow works (scan → cart → checkout)
   - [ ] Offline mode works
   - [ ] Sync recovery works
   - [ ] Admin pages accessible (if applicable)

2. **Build Test:**
   ```bash
   npm run build
   # Should complete with no errors
   ```

3. **Deploy:**
   ```bash
   firebase deploy
   npx supabase functions deploy complete-sale
   npx supabase functions deploy add-stock-lot
   ```

---

## 🎯 SUCCESS CRITERIA

### This Week:
- ✅ Login working reliably
- ✅ POS workflow end-to-end functional
- ✅ Edge Functions deployed and working
- ✅ Documentation cleaned up
- ✅ No TypeScript errors in build

### Next Week:
- ✅ Service Worker implemented
- ✅ Basic tests written (30% coverage)
- ✅ Admin inventory page complete
- ✅ Admin sales page complete

---

## 📞 NEED HELP?

### Common Issues & Solutions:

1. **"RLS policy violation"**
   → Check policies in Supabase Studio
   → Ensure current_user() has access

2. **"Type errors during build"**
   → Regenerate types from database
   → Check for `any` types

3. **"Network error" or "Failed to fetch"**
   → Check .env.local variables
   → Verify Supabase project is active
   → Check CORS settings

4. **"Profile is null after login"**
   → User has no profile in database
   → Create profile manually in Supabase Studio
   → Check RLS policies on profiles table

---

**Current Focus:** Fix login issue FIRST, then proceed with cleanup and development.

**Debug Steps:** Follow the 4-step debug process above and report back what you find!
