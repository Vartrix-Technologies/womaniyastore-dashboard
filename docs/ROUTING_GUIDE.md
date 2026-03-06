# Womaniya Dashboard - Route Structure & Access Control

## 📍 **Complete Route Map (By Role)**

### 🔓 **Public Routes** (No Auth Required)
```
/login → Login page
```

### 👤 **Staff Routes** (`role: 'staff'`)
```
/ (Root)
├── Dashboard with quick actions:
│   ├── Go to POS
│   ├── My Attendance
│   └── My Checklists

/pos
└── Point of Sale system (scan QR, checkout)

/me/attendance
└── Clock in/out, view own hours

/me/checklists
└── View assigned daily tasks

❌ CANNOT ACCESS: /admin/* (all admin routes blocked)
```

### 👑 **Admin/Owner Routes** (`role: 'admin' | 'owner'`)
```
/ (Root)
└── Auto-redirects to → /admin

/admin (Admin Dashboard)
├── Quick links to all admin features

/admin/inventory
├── View all inventory items
└── Filter by category, size, status

/admin/inventory/add-lot
└── Add new stock with QR assignment

/admin/sales
├── View sales history
└── Filter by date, staff, payment method

/admin/sales/[saleId]
└── Detailed sale view

/admin/finances
├── Revenue charts
├── Expense tracking
└── Profit reports

/admin/attendance
└── View all staff attendance logs

/admin/checklists
└── Manage checklist templates & assignments

/admin/staff
├── View all staff
├── Add/edit staff accounts
└── Set roles & discount limits

/admin/qr-codes
├── Generate QR codes in bulk
└── Print labels

/admin/settings
├── Shop information
├── Tax settings
├── Categories & sizes
└── Business hours

/admin/sync-issues
└── Review failed offline sales

✅ ALSO HAS ACCESS TO: All staff routes (/pos, /me/*)
```

### 🦸 **Superadmin Routes** (`role: 'superadmin'`)
```
✅ ALL routes above

PLUS:
├── Cross-shop data access
├── Developer tools
└── System-wide settings
```

---

## 🔐 **Access Control Logic**

### **Route Protection Hierarchy**

```
1. Public Routes (/login)
   ├── No auth required
   └── Redirects to / if already logged in

2. Protected Routes (all others)
   ├── Requires: Authenticated user
   ├── Requires: Valid profile in database
   └── Handled by: (protected)/layout.tsx

3. Admin Routes (/admin/*)
   ├── Requires: Admin/Owner/Superadmin role
   ├── Blocks: Staff users
   └── Handled by: (protected)/admin/layout.tsx

4. Staff Routes (/me/*)
   ├── Requires: Any authenticated user
   └── Shows own data only
```

---

## 🎯 **Login Flow (Based on Role)**

### **When Staff Logs In:**
```
/login 
  → Sign in successful
  → Load profile (role: 'staff')
  → Redirect to /
  → Staff dashboard shows (NOT redirected to /admin)
  → Can access: /, /pos, /me/*
  → Cannot access: /admin/*
```

### **When Admin Logs In:**
```
/login
  → Sign in successful
  → Load profile (role: 'admin')
  → Redirect to /
  → Auto-redirect from / to /admin
  → Admin dashboard shows
  → Can access: ALL routes
```

---

## 🐛 **Troubleshooting Access Issues**

### **"Infinite Loading on /admin"**

**Cause:** Profile role is not `admin`, `owner`, or `superadmin`

**Check:**
1. Open browser console (F12)
2. Look for: `"❌ Access denied. User role: staff"`
3. This means your user has role `staff`

**Fix:**
```sql
-- In Supabase SQL Editor
UPDATE profiles 
SET role = 'admin' 
WHERE email = 'your@email.com';
```

### **"Login redirects to / but not /admin"**

**Expected behavior if role is `staff`**

**If you're admin:**
1. Check browser console
2. Should see: `"🔄 Root page: Redirecting admin to /admin"`
3. If not, check your profile role in Supabase

### **"Access Denied" message**

**Cause:** Staff user tried to access admin route

**Solution:** This is correct behavior! Staff users should not access admin pages.

---

## 🔧 **How to Change User Role**

### **Option 1: Supabase Studio (Recommended)**
1. Go to Supabase → Table Editor
2. Open `profiles` table
3. Find your user row
4. Edit `role` column
5. Choose: `admin`, `owner`, `staff`, or `superadmin`
6. Save changes
7. Log out and log back in

### **Option 2: SQL Query**
```sql
-- Make user an admin
UPDATE profiles 
SET role = 'admin' 
WHERE id = 'YOUR_USER_ID';

-- Make user an owner
UPDATE profiles 
SET role = 'owner' 
WHERE id = 'YOUR_USER_ID';

-- Make user staff
UPDATE profiles 
SET role = 'staff' 
WHERE id = 'YOUR_USER_ID';
```

---

## 📊 **Role Comparison Table**

| Feature | Staff | Admin | Owner | Superadmin |
|---------|-------|-------|-------|------------|
| View own dashboard (/) | ✅ | ✅ | ✅ | ✅ |
| Use POS (/pos) | ✅ | ✅ | ✅ | ✅ |
| Clock in/out | ✅ | ✅ | ✅ | ✅ |
| View own checklists | ✅ | ✅ | ✅ | ✅ |
| **Admin Dashboard** | ❌ | ✅ | ✅ | ✅ |
| Manage inventory | ❌ | ✅ | ✅ | ✅ |
| View sales history | ❌ | ✅ | ✅ | ✅ |
| Access finances | ❌ | ✅ | ✅ | ✅ |
| Manage staff | ❌ | ✅ | ✅ | ✅ |
| Change settings | ❌ | ✅ | ✅ | ✅ |
| Cross-shop access | ❌ | ❌ | ❌ | ✅ |
| Max discount | Limited | High | Unlimited | Unlimited |

---

## 🎬 **Example User Journeys**

### **Deepa (Staff) - Opening Shift**
```
1. Opens app → /login
2. Logs in → Redirects to /
3. Sees staff dashboard with 4 cards:
   - Point of Sale (her main work)
   - My Attendance
   - My Checklists
   - ❌ No "Admin Dashboard" card
4. Taps "My Attendance" → /me/attendance
5. Clocks in
6. Taps "Point of Sale" → /pos
7. Starts scanning items and making sales
```

### **You (Admin) - Managing Shop**
```
1. Opens app → /login
2. Logs in → Redirects to / 
3. Auto-redirects to /admin (admin dashboard)
4. Sees 9 admin feature cards
5. Taps "Inventory Management" → /admin/inventory
6. Views all items, filters by category
7. Taps "Add New Lot" → /admin/inventory/add-lot
8. Adds 50 new items with auto QR assignment
9. Taps "Sales History" → /admin/sales
10. Reviews today's revenue
```

---

## ✅ **Current Status**

- ✅ Login working
- ✅ Role-based access control implemented
- ✅ Auto-redirect for admins
- ✅ Access denied for staff on admin routes
- ✅ Console logging for debugging
- ⚠️ Need to verify your profile role in Supabase

**Next:** Check your profile role and update it to `admin` if needed!
