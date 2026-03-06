# Shared Checklist Pool System - Implementation Guide

**Date:** December 31, 2024  
**Status:** Ready to Deploy

---

## 🎯 What Changed

Transformed from **Individual Assignment Model** to **Shared Pool Model**:

**Before:**
- Checklists assigned to specific staff members
- Complicated assignment management
- Doesn't work well with rotational staff

**After:**
- Checklists shared across all shop staff
- Anyone can complete any item
- Real-time collaboration
- Logs who completed what

---

## 📦 Files Created/Modified

### 1. Database Migration
**File:** `supabase/migrations/20241231_checklist_shared_pool.sql`

**What it does:**
- Drops old `staff_checklist_assignments` and `staff_checklist_item_status` tables
- Creates new `checklist_instances` table (daily/weekly checklist instances)
- Creates new `checklist_item_completions` table (who completed what)
- Adds recurrence fields to `checklists` table (daily/weekly/once)
- Sets up RLS policies for shared access
- Creates auto-update triggers
- Includes `create_daily_checklist_instances()` function

**Action Required:** Run this SQL in Supabase Dashboard → SQL Editor

---

### 2. API Functions
**File:** `src/lib/api/checklists-v2.ts`

**Functions:**
- `createChecklistTemplate()` - Create template with items in one call
- `updateChecklistTemplate()` - Update template settings
- `deleteChecklistTemplate()` - Delete template
- `getTodaysChecklists()` - Get all checklists for today (staff view)
- `completeChecklistItem()` - Mark item complete
- `uncompleteChecklistItem()` - Unmark item
- `createChecklistInstances()` - Manually create instances for a date
- `getChecklistCompletionHistory()` - View past completions
- `getChecklistStats()` - Get completion rates

---

### 3. Admin Page (New)
**File:** `src/app/(protected)/admin/checklists/page-v2.tsx`

**Features:**
- ✅ Single-screen template creation
- ✅ Inline item management (add/remove/reorder)
- ✅ Recurrence selection (daily/weekly/once)
- ✅ Day-of-week picker (Mon-Sat by default)
- ✅ Completion history viewer
- ✅ Stats dashboard (completion rates)
- ✅ Active/inactive toggle
- ✅ Manual "Create Today's Checklists" button

**UI Improvements:**
- All items added in ONE dialog
- Up/down arrows to reorder (no manual sort numbers)
- Press Enter to add items quickly
- Visual day picker (S M T W T F S)
- Completion history with staff names and times

---

### 4. Staff Component (New)
**File:** `src/components/staff/StaffChecklistsCard-v2.tsx`

**Features:**
- ✅ Shared checklist view (all shop staff see same checklists)
- ✅ Real-time updates (refreshes every 30 seconds)
- ✅ Shows who completed each item
- ✅ Shows completion time
- ✅ Progress bars
- ✅ Checkboxes to complete items
- ✅ Optimistic UI updates
- ✅ Celebration message when all done

**User Experience:**
- Priya checks "Unlock door" → Deepa's screen shows "✓ Unlocked by Priya"
- Item disappears from uncompleted section instantly
- Progress bar updates in real-time
- Shows "You" for your own completions

---

### 5. Edge Function (Auto-creation)
**File:** `supabase/functions/create-daily-checklists/index.ts`

**Purpose:** Automatically create today's checklist instances every morning

**How it works:**
- Runs daily at 6:00 AM (via Supabase Cron)
- Loops through all shops
- Calls `create_daily_checklist_instances()` for each shop
- Creates instances based on recurrence rules
- Logs results

**Deployment:**
```bash
supabase functions deploy create-daily-checklists
```

**Set up cron in Supabase Dashboard:**
```
Function: create-daily-checklists
Schedule: 0 6 * * * (every day at 6 AM)
```

---

## 🚀 Deployment Steps

### Step 1: Run Database Migration

1. Open **Supabase Dashboard** → **SQL Editor**
2. Copy contents of `supabase/migrations/20241231_checklist_shared_pool.sql`
3. Paste and click **Run**
4. Verify success (no errors)

**⚠️ Warning:** This will delete existing checklist assignments! If you have important data, back it up first.

---

### Step 2: Replace Old Files

**Admin Page:**
```bash
# Backup old file
mv src/app/(protected)/admin/checklists/page.tsx src/app/(protected)/admin/checklists/page-old.tsx

# Rename new file
mv src/app/(protected)/admin/checklists/page-v2.tsx src/app/(protected)/admin/checklists/page.tsx
```

**Staff Component:**
```bash
# In src/app/(protected)/me/page.tsx, replace import:
# OLD: import TaskChecklistCard from '@/components/staff/TaskChecklistCard';
# NEW: import TaskChecklistCard from '@/components/staff/StaffChecklistsCard-v2';
```

Or just rename the files:
```bash
mv src/components/staff/TaskChecklistCard.tsx src/components/staff/TaskChecklistCard-old.tsx
mv src/components/staff/StaffChecklistsCard-v2.tsx src/components/staff/TaskChecklistCard.tsx
```

**API Functions:**
```bash
# Keep old file for reference, use new one
# In components, import from '@/lib/api/checklists-v2'
```

---

### Step 3: Deploy Edge Function (Optional but Recommended)

1. Install Supabase CLI if not already:
```bash
npm install -g supabase
```

2. Login:
```bash
supabase login
```

3. Link project:
```bash
supabase link --project-ref YOUR_PROJECT_REF
```

4. Deploy function:
```bash
supabase functions deploy create-daily-checklists
```

5. Set up cron in Supabase Dashboard:
   - Go to **Database** → **Cron Jobs** (or use pg_cron)
   - Create new cron job:
   ```sql
   SELECT cron.schedule(
     'create-daily-checklists',
     '0 6 * * *',
     $$SELECT net.http_post(
       url:='YOUR_SUPABASE_URL/functions/v1/create-daily-checklists',
       headers:='{"Content-Type": "application/json", "Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb
     ) as request_id;$$
   );
   ```

---

### Step 4: Create Initial Checklists

1. Login as admin
2. Go to **Admin** → **Checklists**
3. Click **"New Checklist"**
4. Create your first checklist:

**Example: Daily Opening Tasks**
```
Name: Daily Opening Tasks
Description: Tasks to complete every morning
Recurrence: Daily
Days: Mon, Tue, Wed, Thu, Fri, Sat

Items:
1. Unlock main entrance
2. Turn on all lights
3. Check inventory levels
4. Count cash register
5. Clean front counter
```

5. Click **"Create Checklist"**
6. Click **"Create Today's Checklists"** button to test

---

### Step 5: Test Staff View

1. Login as staff member
2. Go to **Home** (`/me`)
3. You should see "Today's Checklists" section
4. Check off items
5. Login as another staff member (or refresh)
6. You should see the same checklist with completed items

---

## 🎨 UI/UX Highlights

### Admin Experience

**Create Checklist Dialog:**
```
┌──────────────────────────────────────┐
│  Create Checklist Template          │
├──────────────────────────────────────┤
│ Name: [Daily Opening Tasks        ] │
│ Description: [Morning tasks...    ] │
│ Active: [✓]                         │
│                                     │
│ Recurrence: [Daily ▼]              │
│ Days: Ⓢ Ⓜ Ⓣ Ⓦ Ⓣ Ⓕ Ⓢ            │
│                                     │
│ Items:                              │
│  ↑↓ 1. Unlock main door        [×] │
│  ↑↓ 2. Turn on lights          [×] │
│  ↑↓ 3. Check inventory         [×] │
│  [Add new item...]             [+] │
│                                     │
│ [Cancel]              [Create]     │
└──────────────────────────────────────┘
```

**History View:**
```
December 31, 2024 - 100% ✓
  ✓ Unlock main door - Priya @ 8:02 AM
  ✓ Turn on lights - Deepa @ 8:05 AM
  ✓ Check inventory - Priya @ 8:15 AM
  
December 30, 2024 - 75% ⚠️
  ✓ Unlock main door - Riya @ 8:00 AM
  ✓ Turn on lights - Riya @ 8:01 AM
  ✗ Check inventory - NOT DONE
```

### Staff Experience

**Today's Checklists:**
```
┌──────────────────────────────────────┐
│  Daily Opening Tasks        [2/4]   │
│  ●●○○ 50% Complete                  │
├──────────────────────────────────────┤
│  [✓] Unlock main door               │
│      by Priya • 8:02 AM            │
│  [✓] Turn on lights                 │
│      by You • just now             │
│  [ ] Check inventory                │
│  [ ] Count cash register            │
└──────────────────────────────────────┘

┌──────────────────────────────────────┐
│  Weekly Laundry Pickup      [0/1]   │
│  ○ 0% Complete                      │
├──────────────────────────────────────┤
│  [ ] Remove laundry for collection  │
└──────────────────────────────────────┘
```

---

## 🔧 Troubleshooting

### Issue: Checklists not showing for staff

**Solution:**
1. Check if instances were created: Admin → Click "Create Today's Checklists"
2. Verify recurrence days include today
3. Check if checklist is Active

### Issue: Can't complete items

**Check:**
1. RLS policies applied (run migration again if needed)
2. Staff user is logged in
3. No console errors (check browser dev tools)

### Issue: Items not updating in real-time

**This is normal!** Updates happen every 30 seconds. For instant updates, manually refresh the page.

### Issue: Migration fails

**Common causes:**
- Old tables have foreign key constraints
- Add `CASCADE` to DROP TABLE statements
- Or manually drop tables first in SQL editor

---

## 📊 Database Schema Reference

### checklists (Templates)
```sql
id, shop_id, name, description, is_active, 
recurrence_type (daily|weekly|once),
recurrence_days (integer array [0-6]),
created_by, created_at, updated_at
```

### checklist_items (Template Items)
```sql
id, checklist_id, label, sort_order
```

### checklist_instances (Daily Instances)
```sql
id, checklist_id, shop_id, date,
status (pending|in_progress|completed),
total_items, completed_items,
created_at, updated_at
```

### checklist_item_completions (Who Did What)
```sql
id, instance_id, checklist_item_id,
completed_by (user_id), completed_at, notes
```

---

## ✅ Testing Checklist

- [ ] Database migration runs without errors
- [ ] Old files backed up
- [ ] New admin page loads
- [ ] Can create checklist with items
- [ ] Can select recurrence days
- [ ] Can reorder items with arrows
- [ ] Can edit existing checklist
- [ ] Can delete checklist
- [ ] "Create Today's Checklists" button works
- [ ] Staff dashboard loads
- [ ] Checklists appear for staff
- [ ] Can check/uncheck items
- [ ] Completion shows username and time
- [ ] Progress bar updates
- [ ] History dialog shows past completions
- [ ] Stats show correct numbers
- [ ] Edge function deploys successfully
- [ ] Cron job creates instances daily

---

## 🎉 Next Steps

1. **Run the migration** (most important!)
2. **Replace old files** with new versions
3. **Create test checklist** and verify it works
4. **Train your staff** on the new system
5. **Deploy edge function** for auto-creation (optional)
6. **Monitor for 1 week** to ensure stability

---

## 💡 Future Enhancements (Not Included)

- 🔔 Push notifications when new checklist assigned
- ⏰ Reminders if checklist not completed by certain time
- 📊 Advanced analytics (who's most productive)
- 📝 Required notes for certain items
- 📸 Photo attachments for task proof
- 🏆 Gamification (badges, streaks)

---

## 📞 Support

If you encounter issues:
1. Check browser console for errors
2. Check Supabase logs
3. Verify RLS policies are active
4. Test with simplified checklist first

---

**Happy Tasking! 🚀**
