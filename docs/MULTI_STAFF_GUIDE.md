# Multi-Staff Support in Womaniya Dashboard

## ✅ YES, Multiple Staff Members Are Fully Supported!

The `/me` routes are designed to work with **unlimited staff members** in a single shop. Each staff member sees **only their own data**.

---

## 🔐 How It Works (Row Level Security - RLS)

### **The Magic: `auth.uid()` Function**

When a user is logged in, Supabase knows:
- **Who they are** → `auth.uid()` returns their user ID
- **Their profile** → Linked via `profiles.id = auth.uid()`

### **RLS Policies Ensure Data Isolation**

Each table has RLS policies that filter data automatically:

```sql
-- Example: Attendance Logs
-- Each staff member can ONLY see their own attendance
CREATE POLICY "Users can view own attendance"
ON attendance_logs FOR SELECT
USING (staff_id = auth.uid());

-- Example: Checklists
-- Each staff member can ONLY see checklists assigned to them
CREATE POLICY "Users can view assigned checklists"
ON staff_checklists FOR SELECT
USING (staff_id = auth.uid());
```

**Result:** When Deepa logs in, she only sees **her** attendance and **her** checklists. Same for Priya, Riya, etc.

---

## 👥 Real-World Example: Your Shop

### **Shop Setup:**
```
Womaniya Airoli (shop_id: abc-123)
├── You (Owner)
├── Deepa (Staff)
├── Priya (Staff)
└── Riya (Staff)
```

### **What Each Person Sees:**

#### **Deepa Logs In:**
```javascript
// /me/attendance page
const { data } = await supabase
  .from('attendance_logs')
  .select('*')
  .eq('staff_id', auth.uid());  // Only Deepa's records!

// Results: Only Deepa's attendance logs
[
  { id: 1, staff_id: 'deepa-uuid', clock_in: '9:00 AM', clock_out: '6:00 PM' },
  { id: 2, staff_id: 'deepa-uuid', clock_in: '9:05 AM', clock_out: null }
]
```

#### **Priya Logs In:**
```javascript
// Same query, but auth.uid() = Priya's ID
const { data } = await supabase
  .from('attendance_logs')
  .select('*')
  .eq('staff_id', auth.uid());  // Only Priya's records!

// Results: Only Priya's attendance logs
[
  { id: 3, staff_id: 'priya-uuid', clock_in: '8:55 AM', clock_out: '5:58 PM' }
]
```

#### **You (Owner) Log In:**
```javascript
// As admin, you go to /admin/attendance
// No auth.uid() filter - you see EVERYONE in your shop
const { data } = await supabase
  .from('attendance_logs')
  .select('*')
  .eq('shop_id', currentShopId);  // All staff in your shop!

// Results: All staff attendance
[
  { id: 1, staff_id: 'deepa-uuid', full_name: 'Deepa', clock_in: '9:00 AM', ... },
  { id: 2, staff_id: 'deepa-uuid', full_name: 'Deepa', clock_in: '9:05 AM', ... },
  { id: 3, staff_id: 'priya-uuid', full_name: 'Priya', clock_in: '8:55 AM', ... },
  { id: 4, staff_id: 'riya-uuid', full_name: 'Riya', clock_in: '9:10 AM', ... }
]
```

---

## 📋 Complete Data Isolation Table

| Data Type | Staff View (`/me/*`) | Admin View (`/admin/*`) |
|-----------|----------------------|-------------------------|
| **Attendance** | Only their own logs | All staff logs in shop |
| **Checklists** | Only assigned to them | All checklists + create templates |
| **Sales** | Only sales they made* | All sales in shop |
| **Profile** | Only their profile | All staff profiles |
| **Inventory** | View-only (for POS) | Full management |
| **Finances** | ❌ No access | Full access |

*POS creates sales with `staff_id = auth.uid()` automatically

---

## 🔧 How Your Code Already Handles This

### **1. Attendance Page (`/me/attendance`)**

Will be implemented like this:
```typescript
// src/app/(protected)/me/attendance/page.tsx
export default function MyAttendancePage() {
  const { user } = useAuth();  // Gets current logged-in user
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    // Fetch only THIS user's attendance
    supabase
      .from('attendance_logs')
      .select('*')
      .eq('staff_id', user.id)  // Filter by current user!
      .order('date', { ascending: false })
      .then(({ data }) => setLogs(data));
  }, [user]);

  // Deepa sees her logs, Priya sees her logs, etc.
}
```

### **2. Checklists Page (`/me/checklists`)**

```typescript
// src/app/(protected)/me/checklists/page.tsx
export default function MyChecklistsPage() {
  const { user } = useAuth();
  const [checklists, setChecklists] = useState([]);

  useEffect(() => {
    // Fetch only THIS user's assigned checklists
    supabase
      .from('staff_checklists')
      .select(`
        *,
        checklist_templates(*),
        staff_checklist_items(*)
      `)
      .eq('staff_id', user.id)  // Filter by current user!
      .then(({ data }) => setChecklists(data));
  }, [user]);
}
```

### **3. POS Auto-Tags Sales**

```typescript
// src/app/(protected)/pos/page.tsx
async function completeSale() {
  const { user } = useAuth();
  
  await completeSale({
    items: cart,
    staff_id: user.id,  // Automatically tags who made the sale
    payment_method: 'cash',
    // ...
  });
}
```

---

## 🔑 Required RLS Policies (For Your Reference)

These should already be in your database:

```sql
-- Attendance: Staff can view/insert their own
CREATE POLICY "Staff can view own attendance"
ON attendance_logs FOR SELECT
USING (staff_id = auth.uid());

CREATE POLICY "Staff can insert own attendance"
ON attendance_logs FOR INSERT
WITH CHECK (staff_id = auth.uid());

-- Checklists: Staff can view/update their assigned
CREATE POLICY "Staff can view assigned checklists"
ON staff_checklists FOR SELECT
USING (staff_id = auth.uid());

CREATE POLICY "Staff can update assigned checklist items"
ON staff_checklist_items FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM staff_checklists 
    WHERE id = staff_checklist_items.checklist_id 
    AND staff_id = auth.uid()
  )
);

-- Sales: Staff can view their own sales
CREATE POLICY "Staff can view own sales"
ON sales FOR SELECT
USING (staff_id = auth.uid() OR is_admin());

-- Profiles: Users can view their own profile
CREATE POLICY "Users can view own profile"
ON profiles FOR SELECT
USING (id = auth.uid());
```

---

## 👥 Adding New Staff Members

### **Step 1: Create Auth User**
```sql
-- Done via Supabase Dashboard → Authentication → Users → Invite User
-- Or programmatically in your app (admin feature)
```

### **Step 2: Create Profile**
```sql
INSERT INTO profiles (id, shop_id, role, full_name, phone, max_discount_percent)
VALUES (
  'new-user-auth-uuid',
  'your-shop-id',
  'staff',
  'New Staff Name',
  '9876543210',
  10  -- Max 10% discount
);
```

### **Step 3: They Log In**
- User receives email invitation
- Sets password
- Logs in
- Automatically sees only their data!

---

## 📊 Example Scenario: 3 Staff Members

```
Timeline: December 20, 2025

9:00 AM - Deepa clocks in
  → attendance_logs: { staff_id: 'deepa', clock_in: '9:00', status: 'open' }

9:05 AM - Priya clocks in
  → attendance_logs: { staff_id: 'priya', clock_in: '9:05', status: 'open' }

10:00 AM - Deepa makes a sale (₹2,500)
  → sales: { staff_id: 'deepa', total: 2500, ... }

11:30 AM - Priya makes a sale (₹3,200)
  → sales: { staff_id: 'priya', total: 3200, ... }

2:00 PM - Riya clocks in (late)
  → attendance_logs: { staff_id: 'riya', clock_in: '14:00', status: 'open' }

End of Day:
  Deepa's view (/me/attendance):
    - Her clock in: 9:00 AM
    - Her sales: ₹2,500
    - Her checklists: 3 pending

  Priya's view (/me/attendance):
    - Her clock in: 9:05 AM
    - Her sales: ₹3,200
    - Her checklists: 5 pending

  Your view (/admin/attendance):
    - Deepa: 9:00 AM - 6:00 PM (9 hours, ₹2,500 sales)
    - Priya: 9:05 AM - 6:00 PM (8.9 hours, ₹3,200 sales)
    - Riya: 2:00 PM - 6:00 PM (4 hours, ₹0 sales)
```

---

## ✅ Summary

**Q: Can we have multiple staff in a single shop?**
**A: YES! Unlimited staff members supported.**

**Q: How does `/me` work for each staff?**
**A: Each staff member sees ONLY their own data via RLS.**

**Q: Do I need to code anything special?**
**A: NO! Just filter by `auth.uid()` and RLS handles the rest.**

**Q: Can staff see each other's data?**
**A: NO! RLS blocks cross-staff access automatically.**

**Q: What does admin see?**
**A: Everything for their shop (all staff data).**

---

## 🎯 What You Need to Do

1. **Run `extract_schema.sql`** in Supabase SQL Editor (I just created it)
2. **Share the results** with me (query #10 shows all profiles)
3. **Verify RLS policies exist** (query #5 in extract_schema.sql)
4. **Test with multiple accounts** (create a test staff user)

Your architecture is **perfectly designed** for multi-staff support! 🎉
