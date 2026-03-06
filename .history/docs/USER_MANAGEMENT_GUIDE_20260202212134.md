# Staff User Management Implementation

## Overview

This implementation adds the ability for **superadmins only** to create and manage user accounts. Users created this way are required to change their password on first login.

## Files Created

### 1. SQL Migration
**File:** `supabase/migrations/20260125_user_management.sql`

Adds to the `profiles` table:
- `must_change_password` (boolean, default false) - Flag for mandatory password change
- `password_changed_at` (timestamptz) - Tracks when password was last changed  
- `created_by` (uuid) - References the superadmin who created the account

Also includes:
- Index for efficient lookup of users needing password change
- RLS policies for users to clear their own flag
- Database function `mark_password_changed()` for clearing the flag

### 2. Edge Function
**File:** `supabase/functions/create-user/index.ts`

A secure Supabase Edge Function that handles:
- **Create User** (`action: 'create'`) - Creates auth user + profile with temp password
- **Reset Password** (`action: 'reset_password'`) - Resets user's password, sets change flag
- **List Users** (`action: 'list_users'`) - Lists all users for a shop (excludes superadmins)
- **Toggle Active** (`action: 'toggle_active'`) - Activates/deactivates user accounts

Security:
- Only callable by authenticated superadmins
- Uses Supabase Admin API for user creation
- Validates all inputs, prevents superadmin creation via this endpoint
- Rollback on profile creation failure

### 3. Change Password Page
**File:** `src/app/change-password/page.tsx`

A standalone page for users to change their temporary password:
- Beautiful UI matching the login page design
- Password strength indicator (Very Weak → Strong)
- Real-time validation feedback
- Requirements checklist (8+ chars, uppercase, lowercase, numbers, symbols)
- Verifies current password before allowing change
- Clears `must_change_password` flag after successful change

### 4. AuthContext Update
**File:** `src/context/AuthContext.tsx`

Enhanced to:
- Export `mustChangePassword` boolean
- Automatically redirect to `/change-password` when flag is true
- Works with existing authentication flow

### 5. UserManagement Component
**File:** `src/components/admin/UserManagement.tsx`

A complete UI component for superadmins featuring:
- User list with avatars, roles, status badges
- Create user dialog with:
  - Form validation
  - Auto-generated secure passwords
  - Role selection (staff/admin/owner)
  - Shop selection
  - Max discount percent setting
  - Password copy-to-clipboard
- Reset password dialog with password generator
- Activate/deactivate users
- Refresh user list

### 6. Superadmin Dashboard Update
**File:** `src/app/(protected)/superadmin/page.tsx`

Added:
- Tabs UI for System Health and User Management
- Users icon imported
- UserManagement component integrated
- Passes current shop_id for filtering (optional)

### 7. UI Component
**File:** `src/components/ui/skeleton.tsx`

New shadcn/ui Skeleton component for loading states.

### 8. TypeScript Types Update
**File:** `src/types/database.types.ts`

Updated `profiles` table types to include:
- `must_change_password: boolean`
- `password_changed_at: string | null`
- `created_by: string | null`

## User Flow

### Creating a New Staff Member

1. Superadmin navigates to `/superadmin` → "User Management" tab
2. Clicks "Create User" button
3. Fills in form:
   - Full name (required)
   - Email (required)
   - Phone (optional)
   - Temporary password (auto-generated, or custom)
   - Role (staff/admin/owner)
   - Shop assignment
   - Max discount %
4. Clicks "Create User"
5. Toast shows success with the temporary password to share
6. User appears in list with "Password Change Required" badge

### Staff First Login

1. Staff receives email and temp password from superadmin
2. Logs in at `/login` with temp credentials
3. Automatically redirected to `/change-password`
4. Enters temp password + new password (8+ chars, strong)
5. After successful change, redirected to home page
6. Normal access to the app begins

### Password Reset (Offboarding/Forgot)

1. Superadmin opens User Management
2. Clicks "..." menu on user → "Reset Password"
3. New temp password auto-generated (or custom)
4. Copy password to share with user
5. User must change password on next login

### Deactivating Users

1. Superadmin opens User Management  
2. Clicks "..." menu → "Deactivate"
3. User account becomes inactive
4. Can be reactivated the same way

## Deployment Steps

1. **Run Migration:**
   ```bash
   supabase migration up
   ```
   Or apply manually in Supabase dashboard SQL editor using `20260125_user_management.sql`

2. **Deploy Edge Function:**
   ```bash
   supabase functions deploy create-user
   ```

3. **Deploy Frontend:**
   Regular Next.js deployment process

## Security Considerations

- Only superadmins can create users (verified in Edge Function)
- Passwords are never stored - handled by Supabase Auth
- Temp passwords are shown once and should be shared securely
- Users cannot skip password change - enforced at auth context level
- Superadmin accounts cannot be created/modified via this system
- All operations use RLS where applicable

## Testing Checklist

- [ ] Superadmin can create new user
- [ ] New user appears in list with correct status
- [ ] New user can login with temp password
- [ ] New user is redirected to change password page
- [ ] New user cannot navigate away from change password
- [ ] Password strength validation works
- [ ] After password change, user can access app normally
- [ ] Superadmin can reset user password
- [ ] Superadmin can deactivate/reactivate users
- [ ] Non-superadmin cannot access create-user Edge Function
