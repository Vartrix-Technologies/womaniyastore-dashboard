# File Review: components/staff

**Folder:** `src/components/staff/`
**Files:** 3 active (AttendanceCalendar.tsx, AttendanceCard.tsx, TaskChecklistCard.tsx)
**Total Lines:** ~1,086 (excluding page-old.tsx)
**Last Updated:** 2026-01-01

---

## Folder Overview

Staff-facing components for personal attendance tracking and daily task management. Used on the `/me` dashboard and admin attendance pages.

---

## 1. File Responsibilities

### AttendanceCalendar.tsx (496 lines)

**Primary Responsibility:** Monthly calendar view of attendance records with day details and statistics.

**Key Features:**
- Month navigation (prev/next/today)
- Visual calendar grid with attendance status indicators
- Stats sidebar (days present, avg hours, total hours)
- Day click → details panel
- Admin mode with staff selector
- Edit/Delete actions for admins

**Does NOT:**
- Create attendance records (use admin dialogs)
- Show multiple staff simultaneously
- Export attendance data

### AttendanceCard.tsx (195 lines)

**Primary Responsibility:** Today's clock in/out widget with live elapsed time counter.

**Key Features:**
- Current attendance status display
- Clock in/out buttons
- Live elapsed time counter (updates every second)
- Net hours calculation (subtracts breaks)
- Shift completion message

**Does NOT:**
- Show history (use AttendanceCalendar)
- Allow time corrections
- Handle break tracking

### TaskChecklistCard.tsx (395 lines)

**Primary Responsibility:** Daily checklist display with item completion tracking.

**Key Features:**
- Three display modes: full card, compact, summary badge
- Real-time completion toggle
- Progress bar with percentage
- Auto-refresh every 30 seconds
- Shows who completed each item
- Completion timestamp display

**Does NOT:**
- Create checklists (admin function)
- Edit checklist items
- Show historical completion

---

## 2. Execution Flows

### AttendanceCalendar - Monthly Data Loading

```
Component mounts / month changes → loadMonthData()
  → Parallel fetch:
      - getMonthlyAttendance(userId, year, month)
      - getAttendanceStats(userId, year, month)
  → Set attendanceRecords and stats state
  → Render calendar grid with status indicators
```

**Calendar Grid Rendering:**
```
getDaysInMonth() → get total days
getFirstDayOfMonth() → get starting weekday
For each day:
  → getAttendanceForDate(day) → find matching record
  → Apply styling: green (closed), yellow (open), border (today)
  → handleDayClick → show details panel
```

### AttendanceCard - Live Timer

```
Component mounts → loadTodayAttendance()
  → If attendance exists and status='open':
      → setInterval every 1 second
      → Calculate elapsed = now - clock_in - breaks
      → Format as HH:MM:SS
  → If status='closed':
      → Calculate final elapsed (static)
```

**Clock In Flow:**
```
User clicks Clock In → handleClockIn()
  → clockIn(userId, shopId) API call
  → On success: toast, update attendance state
  → Timer effect activates
```

**Clock Out Flow:**
```
User clicks Clock Out → handleClockOut()
  → clockOut(attendanceId) API call
  → On success: toast, update attendance state
  → Timer stops, shows final time
```

### TaskChecklistCard - Item Toggle

```
User clicks checkbox → handleToggleItem(instanceId, itemId, isCompleted)
  → Add to updatingItems set (prevents double-click)
  → If isCompleted: uncompleteChecklistItem()
  → If not completed: completeChecklistItem(instanceId, itemId, userId)
  → On success: toast, loadChecklists() to refresh
  → Remove from updatingItems set
```

**Auto-Refresh:**
```
useEffect → setInterval every 30 seconds → loadChecklists()
// Shows real-time updates from other staff completing items
```

---

## 3. Business Rules & Assumptions

### Explicit Business Rules

| Rule | Implementation | File |
|------|----------------|------|
| One attendance per staff per day | API enforces | AttendanceCard |
| Break time subtracted from hours | `netMinutes = total - breakMinutes` | AttendanceCard, Calendar |
| Checklists refresh every 30 seconds | `setInterval(loadChecklists, 30000)` | TaskChecklistCard |
| Admin can edit any staff's attendance | `canEdit = role === 'admin' \|\| 'owner'` | AttendanceCalendar |
| Clock out status = 'closed' | Badge shows "Clocked Out" | AttendanceCard |
| Items can be uncompleted | `uncompleteChecklistItem()` available | TaskChecklistCard |

### Implicit Assumptions
- User is authenticated with valid profile
- Shop ID exists for all staff
- Attendance records have unique date per staff
- Checklist instances created for today before viewing
- Profile full_name exists for completion display

### Display Mode Props (TaskChecklistCard)

| Prop | Value | Behavior |
|------|-------|----------|
| `showCompactSummary` | `true` | Badge only: "3/5 completed" |
| `compact` | `true` | No Card wrapper, border separators |
| Both `false` | default | Full Card per checklist |

---

## 4. Risks & Edge Cases

### High Priority

| Risk | Impact | File | Mitigation |
|------|--------|------|------------|
| Timer memory leak | Stale intervals | AttendanceCard | useEffect cleanup returns clearInterval |
| Double-click completion | Duplicate API calls | TaskChecklistCard | updatingItems Set prevents |
| Timezone display issues | Wrong times shown | AttendanceCalendar | Uses toLocaleTimeString |

### Medium Priority

| Risk | Impact | File | Mitigation |
|------|--------|------|------------|
| No attendance loaded | Blank card | AttendanceCard | Shows "Not Started" state |
| Admin view no staff | Empty calendar | AttendanceCalendar | Handles empty staff array |
| Checklist API error | Stuck loading | TaskChecklistCard | Error toast, but loading may persist |

### Low Priority

| Risk | Impact | File | Mitigation |
|------|--------|------|------------|
| Month boundary navigation | Wrong days shown | AttendanceCalendar | Standard Date API handling |
| Very long checklist name | Overflow | TaskChecklistCard | Truncation in compact mode |
| Staff selector empty | Unusable | AttendanceCalendar | First staff auto-selected |

---

## 5. Comment Suggestions (Selective)

### AttendanceCalendar - Lines ~44-55
```typescript
// Parallel data fetch for month view
// Stats and records are independent - no reason to await sequentially
const [recordsResult, statsResult] = await Promise.all([
  getMonthlyAttendance(targetUserId, year, month),
  getAttendanceStats(targetUserId, year, month),
]);
```

### AttendanceCalendar - Lines ~21-26
```typescript
// Admin vs Staff view detection:
// If both staffId (prop) and staff list provided → Admin viewing any staff
// Otherwise → Staff viewing their own attendance
const isAdminView = !!staffId && !!staff;
const canEdit = profile?.role === 'admin' || profile?.role === 'owner';
```

### AttendanceCard - Lines ~23-41
```typescript
// Live timer effect: Updates every second while clocked in
// Calculates net time = elapsed - break minutes
// Uses Math.max(0, ...) to prevent negative display
// Interval cleanup prevents memory leak on unmount or status change
```

### TaskChecklistCard - Lines ~58-68
```typescript
// Optimistic UI prevented in favor of server truth
// updatingItems Set tracks in-flight requests
// On success: Full reload ensures consistency across concurrent users
// 30-second auto-refresh handles updates from other staff
```

### TaskChecklistCard - Lines ~35-40
```typescript
// Auto-refresh interval shows real-time checklist updates
// Without this, staff wouldn't see items completed by coworkers
// 30 seconds balances freshness vs API load
const interval = setInterval(loadChecklists, 30000);
return () => clearInterval(interval);
```

---

## 6. Refactor Signals

### AttendanceCalendar - Component Size

496 lines is substantial. Consider extracting:
- `CalendarGrid` - Pure calendar rendering
- `AttendanceStats` - Stats sidebar
- `AttendanceDayDetails` - Selected day panel
- `useMonthlyAttendance` - Data fetching hook

### AttendanceCard - Timer Hook

Extract live timer logic:
```typescript
// hooks/useElapsedTime.ts
export function useElapsedTime(
  startTime: string | null,
  breakMinutes: number,
  isRunning: boolean
): string
```

### TaskChecklistCard - Duplicate Empty State

Lines 115-127 and 135-143 both check `checklists.length === 0` with different rendering. This appears to be leftover from a refactor.

### Type Safety

```typescript
// AttendanceCalendar uses MonthlyAttendanceRecord from API
// Good: Imported from lib/api/attendance

// TaskChecklistCard uses ChecklistInstanceWithDetails
// Good: Imported from lib/api/checklists-v2

// AttendanceCard uses TodayAttendance
// Good: Imported from lib/api/attendance
```

### Shared Attendance Utilities

Both AttendanceCard and AttendanceCalendar have similar:
- `formatTime(isoString)` functions
- Hours calculation logic
- Break time subtraction

Extract to:
```typescript
// lib/utils/attendance-format.ts
export function formatAttendanceTime(iso: string | null): string
export function calculateNetHours(clockIn: string, clockOut: string | null, breakMinutes: number): number
```

---

## Summary Assessment

| Aspect | Rating | Notes |
|--------|--------|-------|
| Readability | ✅ Good | Clear component responsibilities |
| Maintainability | ⚠️ Moderate | AttendanceCalendar could be split |
| Real-time Updates | ✅ Excellent | Live timer, auto-refresh |
| Error Handling | ⚠️ Moderate | Some loading states could persist on error |
| UX | ✅ Good | Visual feedback, status indicators |
| Type Safety | ✅ Good | Imported types from API modules |

---

## 7. Critic Section: Premium & Modern Assessment

### What Works Well ✅

| Component | Why It's Good |
|-----------|---------------|
| **Live Elapsed Timer** | Updates every second—staff sees real-time hours |
| **Auto-Refresh Checklists** | 30-second refresh catches team updates |
| **Calendar Month View** | Visual attendance at a glance |
| **Admin Mode in Calendar** | Manager can view any staff member |

### What Feels Dated or Unpolished ❌

| Issue | Component | Premium Comparison |
|-------|-----------|-------------------|
| **496 lines in AttendanceCalendar** | Calendar | Should split into sub-components |
| **Plain clock in/out buttons** | AttendanceCard | Could be more prominent, animated |
| **No break tracking** | AttendanceCard | "Start break" / "End break" buttons |
| **Text-only calendar** | AttendanceCalendar | Could show hours bars per day |
| **No streak/gamification** | AttendanceCard | "5-day streak!" motivates |
| **No quick view of week** | AttendanceCalendar | Week view often more useful |

### Missing Premium Features

1. **Visual Hours in Calendar**
   ```
   ┌─────────────────────────────────────────────────────┐
   │ JANUARY 2026                                        │
   │ Mon   Tue   Wed   Thu   Fri   Sat   Sun            │
   │ ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐        │
   │ │███│ │███│ │██ │ │███│ │███│ │   │ │   │        │
   │ │8hr│ │8hr│ │6hr│ │8hr│ │8hr│ │OFF│ │OFF│        │
   │ └───┘ └───┘ └───┘ └───┘ └───┘ └───┘ └───┘        │
   └─────────────────────────────────────────────────────┘
   ```

2. **Break Tracking**
   ```
   ┌────────────────────────────────────────────────────┐
   │ TODAY'S ATTENDANCE                                 │
   │                                                    │
   │ ⏱️ Working: 4h 32m                                 │
   │                                                    │
   │ [Start Break]  or  [Clock Out]                    │
   │                                                    │
   │ Breaks today: 30 min (1 break)                    │
   └────────────────────────────────────────────────────┘
   ```

3. **Attendance Streak**
   ```
   🔥 12 days on time!
   Keep it up for a 2-week streak badge
   ```

4. **Week View Toggle**
   - Easier to see recent pattern
   - Less overwhelming than full month

### Comparison to Staff Time Tracking Apps

| App | Feature You're Missing |
|-----|----------------------|
| **Deputy** | Break prompts, shift swapping, geolocation |
| **Clockify** | Weekly view, project tracking, integrations |
| **Hubstaff** | Activity levels, screenshots (optional) |
| **TimeCamp** | Automatic tracking, productivity scores |

### Priority Improvements (Effort vs Impact)

| Improvement | Effort | Impact | Priority |
|-------------|--------|--------|----------|
| Extract AttendanceCalendar sub-components | Medium | High | **P1** |
| Extract useElapsedTime hook | Low | Medium | **P1** |
| Add break start/end buttons | Medium | Medium | **P2** |
| Visual hours bars in calendar | Medium | Medium | **P2** |
| Week view toggle | Medium | Low | **P3** |
| Attendance streak gamification | Low | Low | **P3** |

### Key Quote for Your Team
> "The live timer in AttendanceCard is excellent—it's the kind of detail that makes staff feel their time is being tracked fairly. But AttendanceCalendar at 496 lines is too large. Split it into CalendarGrid, StatsPanel, and DayDetails, and you'll have a maintainable codebase. Also consider adding break tracking—it's expected in any time tracking app."
