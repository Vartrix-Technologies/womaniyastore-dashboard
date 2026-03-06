# Superadmin Dashboard

## Overview
The Superadmin role is designed for technical support and system monitoring, separate from business operations (Admin/Owner) and daily tasks (Staff).

## Access Control

### Role Hierarchy
```
Superadmin (Technical/Developer)
    ↓
Owner (Business Owner)
    ↓
Admin (Store Manager)  
    ↓
Staff (Sales Associates)
```

### Routing
- **Superadmin** → `/superadmin` (System dashboard)
- **Admin/Owner** → `/admin` (Business dashboard)
- **Staff** → `/pos` (Point of Sale)

## Superadmin Features

### Current Features ✅

**System Health Dashboard** (`/superadmin`)
- Database connection status
- Internet connectivity monitoring
- IndexedDB (offline storage) status
- Edge Functions health check
- Sync metrics (pending/failed sales)
- Quick actions for common tasks

**Sync Issues** (`/superadmin/sync-issues`)
- Moved from `/admin/sync-issues`
- View and retry failed offline sales
- Technical troubleshooting interface
- Not accessible to admin/owner anymore

**Quick Actions**
- Test database connection (ping Supabase)
- Force sync pending sales
- Access admin dashboard when needed
- View system logs (placeholder)
- Advanced tools (placeholder)

### Planned Features 🚧

**Priority 1: System Monitoring**
- [ ] Error logs viewer (`/superadmin/logs`)
- [ ] Performance metrics (API response times)
- [ ] Database query monitoring
- [ ] Edge Function execution logs

**Priority 2: Multi-Shop Management**
- [ ] Shop switcher (for multiple locations)
- [ ] Create/edit shops via UI
- [ ] Assign owners to shops
- [ ] View cross-shop analytics

**Priority 3: Data Integrity**
- [ ] Data health checks (orphaned records, etc.)
- [ ] Automated data validation
- [ ] Database backups/exports
- [ ] Data migration tools

**Priority 4: Developer Tools**
- [ ] Regenerate QR codes in bulk
- [ ] Import/export inventory data
- [ ] Reset demo/test data
- [ ] View Supabase query logs
- [ ] API testing playground

## Security

### Layout Protection
The `/superadmin` routes are protected by `layout.tsx`:
```typescript
// Only superadmin role can access
if (profile.role !== 'superadmin') {
  router.replace('/admin' or '/pos');
}
```

### Database RLS
Ensure Supabase Row Level Security policies allow superadmin access:
```sql
-- Example: Allow superadmin to view all shops
CREATE POLICY "Superadmin can view all shops"
ON shops FOR SELECT
TO authenticated
USING (
  auth.uid() IN (
    SELECT id FROM profiles WHERE role = 'superadmin'
  )
);
```

## Testing Superadmin Access

### Create Superadmin User
1. Create auth user in Supabase (or use signup)
2. Update profile role:
```sql
UPDATE profiles
SET role = 'superadmin'
WHERE id = '<user_uuid>';
```

### Test Accounts
- `superadmin@test.com` → Should see `/superadmin` dashboard
- `admin@test.com` → Should NOT access `/superadmin`, redirect to `/admin`
- `staff@test.com` → Should NOT access `/superadmin`, redirect to `/pos`

## Implementation Notes

### Why Separate from Admin?
**Admin/Owner concerns:**
- How many items sold today?
- What's the revenue this month?
- Who's on shift?
- Is inventory low?

**Superadmin concerns:**
- Is the database connected?
- Are there failed syncs?
- What errors occurred?
- Is the system performing well?

**Different users, different tools.**

### Design Philosophy
- **Admin = Business Dashboard** (sales, inventory, staff)
- **Superadmin = System Dashboard** (health, errors, technical)
- Keep interfaces focused on their audience
- Admin doesn't need to see technical errors
- Superadmin doesn't need daily sales metrics (can visit /admin if needed)

## Usage Scenarios

### Scenario 1: Client Reports "Sales Not Showing"
1. Login as superadmin
2. Check system health → Database connected ✅
3. Check sync metrics → 3 failed syncs ❌
4. Navigate to `/superadmin/sync-issues`
5. See error: "Network timeout"
6. Click "Retry Failed Syncs"
7. Problem resolved ✅

### Scenario 2: New Shop Onboarding (Future)
1. Login as superadmin
2. Go to `/superadmin/shops` (future)
3. Click "Add New Shop"
4. Enter: Name, Location, Owner email
5. System creates shop, invites owner
6. Owner receives email, sets up account
7. Shop ready for business ✅

### Scenario 3: Regular Monitoring
1. Login as superadmin weekly
2. Check system health dashboard
3. Review any failed syncs
4. Check error logs for patterns
5. Proactive maintenance ✅

## Next Steps

1. **Test current features**
   - Login with superadmin account
   - Verify routing works correctly
   - Test database connection ping
   - View sync issues

2. **Plan Phase 2 features**
   - Error logging infrastructure
   - Multi-shop support design
   - Data integrity checks

3. **Document for client**
   - Create user guide for owner/admin
   - Separate technical docs for yourself
   - Establish support procedures

## Files Modified

**Created:**
- `src/app/(protected)/superadmin/page.tsx` - Main dashboard
- `src/app/(protected)/superadmin/layout.tsx` - Access control

**Moved:**
- `src/app/(protected)/admin/sync-issues/` → `src/app/(protected)/superadmin/sync-issues/`

**Updated:**
- `src/app/page.tsx` - Routing logic for superadmin
- `src/app/(protected)/admin/page.tsx` - Removed sync-issues card

## Architecture Decision Record

**Decision:** Separate superadmin from admin/owner roles
**Date:** December 21, 2025
**Status:** Implemented

**Context:**
- Superadmin and admin had identical access
- Technical concerns mixed with business concerns
- Support/debugging difficult without technical tools

**Decision:**
- Create dedicated `/superadmin` route
- Move technical features (sync-issues) to superadmin only
- Maintain access to `/admin` for data viewing when needed

**Consequences:**
- ✅ Clear separation of concerns
- ✅ Better support experience
- ✅ Scalable for future multi-shop scenarios
- ✅ Professional system architecture
- ⚠️ Need to maintain two dashboards
- ⚠️ Must ensure proper access control

**Alternatives Considered:**
- Keep everything in `/admin` - Rejected (cluttered, confusing)
- Create tabs within admin - Rejected (access control issues)
- CLI-only tools - Rejected (not user-friendly)
