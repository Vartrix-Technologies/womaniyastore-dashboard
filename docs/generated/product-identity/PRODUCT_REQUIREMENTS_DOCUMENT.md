# Womaniya Dashboard - Product Requirements Document

**Document Version**: 1.0  
**Last Updated**: January 10, 2026  
**Status**: Based on Current Implementation

---

## 1. Product Vision

**Problem Statement**

Small to medium-sized clothing retail shops struggle with manual inventory tracking, inefficient point-of-sale operations, and lack of real-time visibility into sales, expenses, and staff accountability. Traditional paper-based or basic spreadsheet systems lead to inventory discrepancies, lost sales data, difficulty tracking individual items, and poor financial insights.

**Target User**

Shop owners and managers of clothing retail businesses (e.g., "Womaniya - Airoli") who need to:
- Track individual inventory items via QR codes
- Process sales quickly at point-of-sale
- Manage staff and their daily tasks
- Monitor finances (sales, expenses, profitability)
- Operate offline-first (tablets in areas with unreliable connectivity)

**Success Criteria**

- **Staff** can scan QR codes and complete sales in under 30 seconds
- **Owners/Admins** can view real-time inventory status and financial reports
- **All users** can continue working during internet outages with automatic sync when online
- **Staff** know their daily tasks via checklists and can clock in/out for attendance
- **Shop** reduces inventory discrepancies through item-level QR tracking

---

## 2. Non-Goals

This application **does NOT** aim to:

- **Multi-store chains**: While technically multi-tenant (via `shop_id`), the UI/UX is optimized for single-shop owners managing one location. Superadmin features exist but are minimal.
- **B2B/Wholesale**: Not designed for bulk orders, purchase orders, or supplier management beyond basic stock arrival tracking.
- **Customer loyalty programs**: No customer accounts, points, or membership features.
- **Advanced analytics/BI**: Basic reports and stats only. Not a data warehouse or analytics platform.
- **Apparel-specific features**: No size charts, color variants, or fashion-specific metadata beyond category and size.
- **E-commerce**: Not a webstore. Strictly in-person POS and inventory management.
- **Multi-language**: Only English is supported.
- **Payment gateway integration**: Cash/card/UPI are manual selections, not integrated processors.

---

## 3. Screen Flow / User Journey

### 3.1 Entry Points

#### Public Routes
- **`/login`**: Landing page for all users
  - Email/password authentication via Supabase Auth
  - No sign-up flow in UI (users created via superadmin or manual DB entry)
  - Redirects to `/` after successful login

#### Protected Routes (require authentication)
All protected routes enforce authentication via `app/(protected)/layout.tsx`:
- Unauthenticated users are redirected to `/login`
- Layout shows loading spinner while auth state loads
- Displays offline/online status badge
- Shows top bar (shop name, user name, sync status) and bottom navigation

---

### 3.2 Main User Flows

#### **Flow A: Staff Member Login → POS Sale**

1. **Login** (`/login`)
   - Staff enters email/password
   - System validates via Supabase Auth
   - Fetches profile from `profiles` table
   - Redirects to `/` (root protected route)

2. **Staff Dashboard** (`/` - staff role)
   - Auto-redirects staff to `/` (not `/admin`)
   - Shows 3 quick action cards:
     - "Point of Sale" → `/pos`
     - "My Attendance" → `/me` (attendance section)
     - "My Checklists" → `/me` (checklist section)

3. **Point of Sale** (`/pos`)
   - **Add items via**:
     - **QR Scanner**: Tap "Scan QR" → opens camera → scan QR code → item added to cart
     - **Search**: Tap "Search Items" → search by category/size/QR → select item → added to cart
   - **Cart management**:
     - View items in cart with category, size, QR code, original price
     - Adjust final price (if discount within staff's `max_discount_percent`)
     - Add discount reason (mandatory if discounted)
     - Remove items from cart
   - **Checkout**:
     - Tap "Checkout" button
     - Enter customer name (optional), phone (optional)
     - Select payment method (cash/card/UPI)
     - If **online**: Calls `complete_sale` Edge Function → creates `sales` + `sale_items` + updates inventory status → generates bill number
     - If **offline**: Saves to IndexedDB `pendingSales` → shows success message → syncs automatically when online
     - Displays receipt with bill number, items, totals
     - Cart cleared

4. **Exit**: Staff returns to `/pos` or `/` to continue work

**Conditional Branches**:
- **Discount exceeds limit**: Show error, prevent checkout
- **Item already in cart**: Show toast error
- **Offline mode**: Checkout saves locally, shows "Will sync when online" message
- **Sync failure**: Sale marked as "failed" in IndexedDB after 3 retries

---

#### **Flow B: Admin/Owner Login → View Sales Report**

1. **Login** (`/login`)
   - Admin enters credentials
   - System validates and fetches profile
   - Redirects to `/`

2. **Root Protected Route** (`/`)
   - Detects user role = `owner`, `admin`, or `superadmin`
   - Auto-redirects to `/admin` (admin dashboard)

3. **Admin Dashboard** (`/admin`)
   - Shows 3 stat cards:
     - Available Items (count from `inventory_items` where `status = 'available'`)
     - Today's Sales (count from `sales` where `created_at >= today`)
     - Active Staff (count from `profiles` where `role = 'staff'`)
   - Shows 8 action cards:
     - Inventory Management → `/admin/inventory`
     - Sales & Bills → `/admin/sales`
     - Finances & Reports → `/admin/finances`
     - Staff Management → `/admin/staff`
     - Attendance Tracking → `/admin/attendance`
     - QR Code Management → `/admin/qr-codes`
     - Daily Checklists → `/admin/checklists`
     - Settings → `/admin/settings`

4. **Sales & Bills** (`/admin/sales`)
   - **Filters**:
     - Date range tabs: Today / Week / Month / Custom
     - Search by customer name or phone
   - **Stats cards** (calculated from filtered data):
     - Total Sales (count)
     - Total Revenue (sum of `total_amount`)
     - Total Discount (sum of `total_discount`)
     - Average Sale (revenue / count)
   - **Table columns**:
     - Bill Number (sortable)
     - Customer Name + Phone
     - Items (count of `sale_items`)
     - Total Amount (sortable)
     - Payment Method
     - Created At (sortable)
     - Actions: View Details
   - **Pagination**: Server-side with 10/25/50/100 items per page
   - **Export**: Download filtered data as CSV

5. **View Sale Details** (`/admin/sales` → modal/dialog)
   - Shows full sale record:
     - Bill number, customer info, payment method, timestamps
     - List of sold items (category, size, QR code, original price, final price, discount reason)
     - Subtotal, tax, discount, total
   - No edit/delete capabilities (audit trail)

6. **Exit**: Admin navigates to other admin pages or logs out

**Conditional Branches**:
- **No sales found**: Shows empty state with message
- **Slow query**: Shows loading spinner
- **Export with no data**: Shows alert "No data to export"

---

#### **Flow C: Admin → Add Stock Lot**

1. **Admin Dashboard** (`/admin`) → **Inventory Management** (`/admin/inventory`)

2. **Inventory Page** (`/admin/inventory`)
   - **Tab navigation**: All Items / Add Stock Lot
   - Click "Add Stock Lot" tab

3. **Add Stock Lot Form** (`/admin/inventory` tab 2)
   - **Required fields**:
     - Category (dropdown from `categories` table)
     - Size (dropdown from `sizes` table OR free-text)
     - Quantity (number input)
     - Cost Price Per Unit (number)
     - Selling Price Default (number)
     - Date of Stock Arrival (date picker)
   - **Optional fields**:
     - Tax Rate (defaults to shop's default, e.g., 18%)
   - **Auto-assigned QR codes**:
     - System automatically assigns next available QR codes from `qr_codes` table (status = 'unused')
     - User cannot manually select QR codes in form
   - **Validation**:
     - All required fields must be filled
     - Quantity must be > 0
     - Cost and selling price must be > 0
     - Must have enough unused QR codes available

4. **Submit**:
   - If **online**: Calls `add_stock_lot` Edge Function → creates `lot` record → creates `inventory_items` records (one per quantity) → assigns QR codes → updates `qr_codes.status = 'assigned'`
   - If **offline**: Shows error "This action requires internet connection"
   - On success: Shows success toast, redirects to "All Items" tab showing newly added items

5. **Exit**: Admin returns to inventory list

**Conditional Branches**:
- **Not enough QR codes**: Error message "Insufficient QR codes. Generate more in QR Management page."
- **Offline**: Error message "Cannot add stock offline. Please connect to internet."
- **Validation errors**: Inline error messages on form fields

---

#### **Flow D: Staff → Clock In/Out Attendance**

1. **Staff Dashboard** (`/`) → **My Attendance** (card or via `/me`)

2. **My Dashboard** (`/me`)
   - Shows "Today's Attendance" card:
     - If **not clocked in**: Shows "Clock In" button + status "Not clocked in"
     - If **clocked in**: Shows:
       - Clock-in time
       - Current elapsed time (live updating)
       - Total break time
       - "Take Break" / "End Break" button
       - "Clock Out" button

3. **Clock In**:
   - Staff taps "Clock In"
   - System creates `attendance_logs` record:
     - `staff_id = current user`, `date = today`, `clock_in = now()`, `status = 'open'`
   - UI updates to show clocked-in state

4. **Take Break**:
   - Staff taps "Take Break"
   - System records break start time (client-side state)
   - Button changes to "End Break"

5. **End Break**:
   - Staff taps "End Break"
   - System calculates break duration
   - Updates `attendance_logs.total_break_minutes` (cumulative)

6. **Clock Out**:
   - Staff taps "Clock Out"
   - System updates `attendance_logs`:
     - `clock_out = now()`, `status = 'closed'`
   - Calculates total hours worked (clock_out - clock_in - breaks)
   - Shows summary: "You worked X hours Y minutes today"

7. **View History**:
   - Staff taps "View History"
   - Shows calendar view with past attendance records
   - Each date shows: clock in time, clock out time, total hours

8. **Exit**: Staff returns to dashboard

**Conditional Branches**:
- **Already clocked in today**: Cannot clock in again (button disabled)
- **Not clocked in**: Cannot clock out or take break
- **Offline**: Attendance actions require online connection (shows error)

---

#### **Flow E: Admin → Assign Daily Checklist to Staff**

1. **Admin Dashboard** (`/admin`) → **Daily Checklists** (`/admin/checklists`)

2. **Checklists Management Page** (`/admin/checklists`)
   - **Tab navigation**: Checklists / Assign to Staff / History
   - Shows list of checklist templates (from `checklists` table)

3. **Create/Edit Checklist Template** (Tab 1)
   - **Fields**:
     - Name (e.g., "Opening Checklist")
     - Description
     - Is Active (toggle)
     - Recurrence Type: Daily / Weekly / Once
     - Recurrence Days (if weekly): Select Mon-Sun
   - **Items** (from `checklist_items` table):
     - Add item (text input + "Add" button)
     - Reorder items (up/down arrows)
     - Delete item (trash icon)
   - **Submit**: Creates `checklists` record + multiple `checklist_items` records

4. **Assign to Staff** (Tab 2)
   - **Fields**:
     - Select Checklist (dropdown of active checklists)
     - Select Date (date picker, defaults to today)
     - Select Staff (multi-select from `profiles` where `role = 'staff'`)
   - **Auto-assign toggle**: "Auto-assign based on recurrence rules"
   - **Submit**: Creates `staff_checklist_assignments` records (one per staff member) + creates `staff_checklist_item_status` records (one per item per staff)

5. **Exit**: Admin returns to checklists page

**Conditional Branches**:
- **Checklist already assigned**: Shows warning "This checklist is already assigned to [Staff Name] for [Date]"
- **No active checklists**: Shows empty state "Create a checklist first"
- **No staff members**: Shows empty state "Add staff members first"

---

#### **Flow F: Staff → Complete Daily Checklist**

1. **Staff Dashboard** (`/`) → **My Checklists** section or `/me`

2. **My Dashboard** (`/me`)
   - Shows "Daily Tasks" card with today's assigned checklist
   - Displays:
     - Checklist name
     - Progress (e.g., "3/5 tasks completed")
     - List of checklist items with checkboxes

3. **Complete Task**:
   - Staff taps checkbox next to item
   - System updates `staff_checklist_item_status`:
     - `is_completed = true`, `completed_at = now()`
   - UI updates progress bar

4. **View All Tasks**:
   - Staff taps "View All" or checklist card
   - Expands to show full list with completion status
   - Can toggle items on/off

5. **Exit**: Staff returns to dashboard

**Conditional Branches**:
- **No checklist assigned today**: Shows "No tasks assigned for today"
- **All tasks completed**: Shows success message "All tasks completed! 🎉"
- **Offline**: Checklist completion requires online (shows error)

---

#### **Flow G: Admin → View Finances & Reports**

1. **Admin Dashboard** (`/admin`) → **Finances & Reports** (`/admin/finances`)

2. **Finances Page** (`/admin/finances`)
   - **Tab navigation**: Overview / Transactions / Vendor Report
   - **Filters** (shared across tabs):
     - Date range: Today / Week / Month / Custom
     - Search (transaction description)

3. **Overview Tab**:
   - **Stats cards** (from `sales` + `financial_transactions` + inventory):
     - Total Revenue (sum of sales)
     - Total Expenses (sum of expenses)
     - Net Profit (revenue - expenses)
     - Items Sold (count)
     - Average Profit Per Item (net profit / items sold)
   - **Charts**:
     - Revenue vs Expenses (bar chart, last 7/30 days)

4. **Transactions Tab**:
   - **Table** (from `financial_transactions`):
     - Date (sortable)
     - Type (sale/expense/adjustment)
     - Description
     - Amount (sortable)
     - Payment Method
     - Category (if expense)
   - **Add Expense button** → Opens dialog:
     - Amount, Payment Method, Category (from `expense_categories`), Description, Occurred At
     - Creates `financial_transactions` record with `type = 'expense'`
   - **Pagination**: Server-side

5. **Vendor Report Tab**:
   - Shows summary by vendor/category (from `lots` grouped by `category_id`)
   - Displays: Total units purchased, Total cost, Average cost per unit

6. **Export**: Downloads filtered data as CSV

7. **Exit**: Admin navigates to other pages

**Conditional Branches**:
- **No transactions**: Shows empty state
- **Invalid expense form**: Shows validation errors

---

### 3.3 Exit Points / Completion States

- **Successful Sale**: Receipt displayed, cart cleared, staff returns to POS
- **Stock Added**: Success message, redirects to inventory list
- **Attendance Clocked Out**: Summary displayed, staff can clock in next day
- **Checklist Completed**: Success animation, all items marked done
- **Report Exported**: CSV file downloaded to device
- **Logout**: User redirected to `/login`, session cleared

---

## 4. Screen Responsibilities

### 4.1 `/login` (Login Page)

**Responsible For**:
- Authenticating users via Supabase Auth (`signIn` function)
- Displaying login form (email, password, submit button)
- Showing logo and branding ("Womaniya Dashboard")
- Redirecting authenticated users to `/`
- Displaying error messages for failed login

**Must NOT**:
- Allow sign-up (no self-registration)
- Store passwords locally
- Bypass authentication checks
- Show any data before authentication

**Data Reads**: None (pre-auth)  
**Data Writes**: None (delegates to Supabase Auth)

---

### 4.2 `/` (Root Protected - Staff Dashboard)

**Responsible For**:
- Auto-redirecting admins to `/admin`
- Displaying staff-specific quick actions (POS, attendance, checklists)
- Showing welcome message with staff name
- Role-based routing logic

**Must NOT**:
- Show admin-only features to staff
- Allow access without authentication
- Display sensitive financial data
- Allow staff to manage other users

**Data Reads**: `profiles` (current user only)  
**Data Writes**: None

---

### 4.3 `/admin` (Admin Dashboard)

**Responsible For**:
- Displaying high-level shop statistics (available items, today's sales, active staff)
- Providing navigation to all admin sub-pages
- Showing shop name and user name in top bar
- Displaying offline/sync status

**Must NOT**:
- Allow staff role access (redirects to `/`)
- Show data from other shops (multi-tenancy enforcement)
- Allow editing of stats directly
- Expose superadmin-only features

**Data Reads**: `inventory_items` (count), `sales` (count), `profiles` (count)  
**Data Writes**: None

---

### 4.4 `/pos` (Point of Sale)

**Responsible For**:
- Scanning QR codes via camera (HTML5 QR Code library)
- Searching inventory items by category/size/QR code
- Managing cart state (add, remove, update price, discount reason)
- Validating staff discount limits (`max_discount_percent`)
- Checkout flow (customer info, payment method)
- Calling `complete_sale` Edge Function (online) OR saving to IndexedDB (offline)
- Displaying receipt/bill after sale
- Clearing cart after successful checkout

**Must NOT**:
- Allow negative prices or discounts
- Sell items with status != 'available'
- Allow staff to exceed their discount limit
- Bypass inventory updates
- Allow editing past sales

**Data Reads**: `inventory_items`, `qr_codes`, `categories`, `sizes`, `lots`, IndexedDB `inventoryCache`  
**Data Writes**: `sales`, `sale_items`, `inventory_items.status`, `financial_transactions`, IndexedDB `pendingSales`

---

### 4.5 `/admin/sales` (Sales & Bills)

**Responsible For**:
- Listing all sales with filters (date range, search)
- Calculating stats (total sales, revenue, discount, avg sale) from **full filtered dataset** (not paginated)
- Server-side pagination (10/25/50/100 per page)
- Sorting by bill number, amount, date
- Viewing sale details (read-only)
- Exporting filtered sales to CSV

**Must NOT**:
- Allow editing or deleting sales (audit trail)
- Show sales from other shops
- Allow staff to access (admin/owner only)
- Calculate stats from paginated data (critical bug fixed)

**Data Reads**: `sales`, `sale_items`, `inventory_items`, `qr_codes`  
**Data Writes**: None

---

### 4.6 `/admin/inventory` (Inventory Management)

**Responsible For**:
- Listing all inventory items with filters (status, category, search)
- Server-side pagination
- Sorting by QR code, category, size, price, status, date
- Viewing item details (lot info, QR code, pricing)
- Adding stock lots (form with category, size, quantity, pricing)
- Calling `add_stock_lot` Edge Function
- Auto-assigning QR codes from unused pool
- Displaying category-wise stats (available, sold counts)
- Deleting items (with confirmation)
- Exporting inventory to CSV

**Must NOT**:
- Allow duplicate QR code assignment
- Create items without lot linkage
- Allow stock addition offline
- Show items from other shops
- Allow manual QR code selection (auto-assigned only)

**Data Reads**: `inventory_items`, `lots`, `qr_codes`, `categories`, `sizes`  
**Data Writes**: `lots`, `inventory_items`, `qr_codes.status`, `inventory_adjustments`

---

### 4.7 `/admin/finances` (Finances & Reports)

**Responsible For**:
- Displaying financial overview (revenue, expenses, profit)
- Listing transactions (sales, expenses, adjustments) with filters
- Adding manual expenses (form with amount, category, description)
- Server-side pagination
- Sorting by date, amount
- Calculating stats from **full filtered dataset** (separate query, not paginated)
- Generating vendor reports (grouped by category)
- Exporting to CSV

**Must NOT**:
- Allow editing past transactions (audit trail)
- Show transactions from other shops
- Allow staff access
- Delete transactions without audit trail
- Calculate totals from paginated data (critical bug fixed)

**Data Reads**: `sales`, `financial_transactions`, `inventory_items`, `expense_categories`, `lots`  
**Data Writes**: `financial_transactions` (for manual expenses only)

---

### 4.8 `/admin/staff` (Staff Management)

**Responsible For**:
- Listing all staff members (`role = 'staff'`)
- Viewing staff details (name, phone, role, discount limit, active status)
- Editing staff profiles (name, phone, role, discount limit, active/inactive toggle)
- Toggling staff active/inactive status
- Informing admins that new staff must sign up via login page first

**Must NOT**:
- Create new auth users directly (requires Supabase signup flow)
- Delete staff accounts (data integrity)
- Show superadmin or owner accounts in list
- Allow staff to access (admin/owner only)
- Edit staff from other shops

**Data Reads**: `profiles`  
**Data Writes**: `profiles` (update only: `full_name`, `phone`, `role`, `max_discount_percent`, `is_active`)

---

### 4.9 `/admin/attendance` (Attendance Tracking)

**Responsible For**:
- Listing attendance records for all staff with filters (date range, staff, search)
- Displaying attendance stats (present, absent, late)
- Viewing individual attendance details (clock in/out times, breaks, total hours)
- Exporting attendance to CSV
- Manual attendance entry (for corrections) with reason tracking
- Editing attendance records with audit trail

**Must NOT**:
- Allow staff to edit other staff's attendance
- Delete attendance without reason
- Show attendance from other shops
- Allow backdated attendance without audit trail

**Data Reads**: `attendance_logs`, `profiles`  
**Data Writes**: `attendance_logs` (manual entry/edit with `is_manual_entry`, `manual_entry_reason`, `edited_by`)

---

### 4.10 `/admin/qr-codes` (QR Code Management)

**Responsible For**:
- Listing all QR codes with filters (status: unused/assigned/sold/lost)
- Generating new QR codes in bulk (specify quantity)
- Displaying QR code statistics (total, unused, assigned, sold, lost)
- Searching QR codes by code value
- Viewing QR code details (status, assigned item if any)
- Marking QR codes as lost (with reason)
- Exporting QR codes to CSV

**Must NOT**:
- Allow duplicate QR code values
- Allow manual editing of assigned/sold QR codes
- Delete QR codes that are assigned or sold
- Show QR codes from other shops

**Data Reads**: `qr_codes`, `inventory_items`  
**Data Writes**: `qr_codes` (create new, update status to 'lost')

---

### 4.11 `/admin/checklists` (Daily Checklists)

**Responsible For**:
- Creating checklist templates with items
- Editing checklist templates (name, description, recurrence, items)
- Reordering checklist items (sort_order)
- Toggling checklist active/inactive status
- Assigning checklists to staff for specific dates
- Auto-assigning based on recurrence rules (daily, weekly, once)
- Viewing checklist completion history and stats
- Deleting checklist templates

**Must NOT**:
- Allow editing checklists that have historical assignments (data integrity)
- Delete checklists with active assignments
- Show checklists from other shops
- Allow staff to access this page (admin only)

**Data Reads**: `checklists`, `checklist_items`, `staff_checklist_assignments`, `staff_checklist_item_status`, `profiles`  
**Data Writes**: `checklists`, `checklist_items`, `staff_checklist_assignments`, `staff_checklist_item_status`

---

### 4.12 `/admin/settings` (Shop Settings)

**Responsible For**:
- Displaying current shop settings (name, address, phone, tax rate, bill prefix)
- Managing categories (add, edit, delete)
- Managing sizes (add, edit, delete, reorder)
- Managing expense categories (add, edit, delete)
- Updating shop details
- Parallelized data loading (4 queries: shop, categories, sizes, expense_categories)

**Must NOT**:
- Allow editing other shops' settings
- Delete categories/sizes that are in use (foreign key constraints)
- Allow staff access
- Allow changing shop_id or multi-tenant boundaries

**Data Reads**: `shops`, `categories`, `sizes`, `expense_categories`  
**Data Writes**: `shops` (update), `categories`, `sizes`, `expense_categories` (CRUD)

---

### 4.13 `/me` (Staff Personal Dashboard)

**Responsible For**:
- Displaying today's attendance status (clocked in/out, hours, breaks)
- Clock in/out buttons
- Break management (take break, end break)
- Viewing attendance history (calendar view)
- Displaying assigned checklists for today
- Completing checklist items (toggle checkboxes)
- Showing checklist progress

**Must NOT**:
- Show other staff's data
- Allow editing past attendance (admin only)
- Allow editing checklist templates
- Show admin-only features

**Data Reads**: `attendance_logs` (current user), `staff_checklist_assignments`, `staff_checklist_item_status`, `checklists`, `checklist_items`  
**Data Writes**: `attendance_logs` (clock in/out, breaks), `staff_checklist_item_status` (completion)

---

### 4.14 `/superadmin` (Superadmin Dashboard)

**Responsible For**:
- Monitoring system health (Supabase connection, IndexedDB, online status)
- Viewing all shops (multi-tenant overview)
- Creating new shops
- Managing shop owners
- Running diagnostic checks
- Viewing system-wide stats

**Must NOT**:
- Be accessible to non-superadmin roles
- Modify shop-specific data without explicit shop context
- Allow superadmins to bypass RLS policies
- Show this route to shop owners/admins

**Data Reads**: All tables (multi-shop), `shops`, `profiles` (all roles)  
**Data Writes**: `shops`, `profiles` (create owners)

---

## 5. Assumptions & Open Questions

### 5.1 Explicit Assumptions

1. **Single-shop operation**: While database is multi-tenant, UI/UX assumes user manages one shop only
2. **Offline-first POS only**: Only POS checkout works offline. All other features require internet connection
3. **QR codes pre-generated**: Admin must manually generate QR codes in bulk before adding stock
4. **No returns/refunds in UI**: `sale_returns` table exists but no UI implemented
5. **Staff created externally**: Staff members must first sign up via login page, then admin edits their profile
6. **No inventory editing**: Once lot is added, cannot edit pricing or category (must delete and re-add)
7. **Bill numbers are sequential**: Generated via `generate_bill_number()` database function per shop
8. **Tax is calculated at lot level**: Stored in `lots.tax_rate`, applied to all items in that lot
9. **Discounts are manual**: No coupon system implemented (placeholder only)
10. **No real-time collaboration**: Multiple users can cause sync conflicts if editing same data
11. **PWA installed manually**: No in-app install prompt (user must add to home screen via browser)
12. **Single language**: Only English supported
13. **Manual expense entry**: No receipt scanning or automated expense tracking
14. **Attendance requires online**: Staff cannot clock in/out offline
15. **Checklists require online**: Staff cannot complete tasks offline

### 5.2 Missing or Unclear Intent

1. **Returns/Refunds**: `sale_returns` table exists but no UI flow. Intended feature?
2. **Inventory adjustments**: `inventory_adjustments` table exists for audit trail, but no admin UI to view/search these logs
3. **Tax settings**: `tax_settings` table exists but not used in current implementation (using `shops.tax_rate` and `lots.tax_rate`)
4. **Customer data**: Customer name/phone captured but no customer management or history view
5. **Staff performance**: Attendance and checklist completion tracked but no reports/analytics on staff performance
6. **Vendor management**: Vendor reports exist in finances but no vendor master data or payables tracking
7. **Low stock alerts**: No notifications or threshold settings for reorder levels
8. **Price changes**: No audit trail for price changes (lot-level pricing is immutable)
9. **Multi-location**: Superadmin can create multiple shops but no inter-shop transfers or consolidated reporting
10. **Backup/restore**: No admin UI for data export/import or backup scheduling
11. **Role permissions**: Roles are hardcoded (superadmin > owner > admin > staff) but no granular permissions matrix
12. **Failed sync resolution**: Failed sales saved in IndexedDB but no admin UI to review/manually retry
13. **QR code format**: QR codes are strings (e.g., "WMN-00001") but no validation of format or prefix enforcement
14. **Barcode support**: Only QR codes supported, no barcode scanner integration
15. **Receipt printing**: Bills displayed on screen but no thermal printer integration

### 5.3 Edge Cases & Unknowns

1. **What happens if QR code pool exhausted?** Current behavior: Error message, cannot add stock
2. **Can staff see sales history?** Current: No, only admin
3. **Can staff see other staff's attendance?** Current: No, only own + admin sees all
4. **What if staff discount exceeds limit?** Current: Blocked at checkout with error
5. **Can admin override failed sales?** Current: No UI to view or retry failed syncs
6. **What if item scanned twice?** Current: Error toast, not added to cart
7. **Can customer info be edited after sale?** Current: No, sales are immutable
8. **What if staff forgets to clock out?** Current: Attendance log stays open, no auto-close
9. **Can checklists be reassigned?** Current: No, must delete and recreate assignment
10. **What if internet drops during checkout?** Current: Falls back to offline mode, saves to IndexedDB

---

## 6. Alignment Check

### 6.1 Matches Between Vision and Code

✅ **Offline-first POS**: IndexedDB implementation with sync engine matches vision  
✅ **QR-based inventory**: Full QR lifecycle (unused → assigned → sold) implemented  
✅ **Staff accountability**: Attendance and checklist features implemented  
✅ **Financial visibility**: Sales, expenses, profit reports implemented  
✅ **Multi-tenancy**: RLS policies enforce shop_id isolation  
✅ **Role-based access**: AuthContext enforces role checks, UI adapts per role  
✅ **Tablet-optimized**: Responsive design, touch-friendly UI  
✅ **PWA manifest**: Configured for home screen installation  

### 6.2 Gaps or Mismatches

⚠️ **Service Worker missing**: PWA manifest exists but no service worker for offline asset caching  
⚠️ **Returns not implemented**: Database schema supports returns but no UI flow  
⚠️ **Tax settings table unused**: Duplicate tax configuration (shops.tax_rate vs tax_settings table)  
⚠️ **Limited offline scope**: Only POS works offline; attendance, checklists, inventory require online  
⚠️ **No customer management**: Customer data captured but not used for history/loyalty  
⚠️ **No low stock alerts**: Inventory tracking exists but no proactive notifications  
⚠️ **No receipt printing**: Digital receipts only, no thermal printer support  
⚠️ **No failed sync UI**: Failed offline sales tracked but no admin interface to resolve  
⚠️ **No inventory audit trail UI**: `inventory_adjustments` table exists but no UI to view logs  
⚠️ **No staff performance reports**: Data exists but no analytics/dashboards  
⚠️ **QR code range display issue**: Success message after generation doesn't consistently show code range  

### 6.3 Recommendations for Alignment

1. **Implement Service Worker** to cache app assets for true offline-first experience
2. **Add Returns UI** or remove `sale_returns` table to reduce technical debt
3. **Consolidate tax settings** (use one source of truth: either `shops.tax_rate` or `tax_settings`)
4. **Extend offline support** to attendance and checklists (store locally, sync later)
5. **Add Failed Sync Dashboard** for admins to review and manually retry/resolve
6. **Build Inventory Audit Trail Viewer** to surface `inventory_adjustments` data
7. **Add Low Stock Alerts** with configurable thresholds per category
8. **Customer History View** to show past purchases per customer (requires customer profile entity)
9. **Staff Performance Reports** with charts for attendance, checklists, sales metrics
10. **Receipt Printing Integration** (optional: thermal printer or PDF download)

---

## 7. QR Prefix Feature

**Status**: ✅ Implemented (January 2026)  
**Design Proposal**: See `docs/generated/design-proposals/QR_PREFIX_DESIGN_PROPOSAL.md`

### 7.1 Overview

QR Prefixes introduce a first-class entity for organizing QR codes into meaningful groups. Instead of generating random codes, shops can now create price-based or category-based prefixes that generate structured codes.

**Example**: 
- Prefix `WA-499` generates codes: `WA-499-0001`, `WA-499-0002`, `WA-499-0003`, ...
- Prefix `WA-TP-599` generates codes: `WA-TP-599-0001`, `WA-TP-599-0002`, ...

**Benefits**:
- Instant price identification from QR code
- Better inventory organization by price range or product type
- Independent sequence numbering per prefix (max 9999 per prefix)
- Professional, consistent code format

### 7.2 Data Model

**New Table: `qr_prefixes`**
```sql
CREATE TABLE qr_prefixes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  prefix VARCHAR(20) NOT NULL CHECK (prefix ~ '^[A-Z0-9]+(-[A-Z0-9]+)+$'),
  description TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (shop_id, prefix)
);
```

**Updated Table: `qr_codes`**
```sql
ALTER TABLE qr_codes
  ADD COLUMN prefix_id UUID REFERENCES qr_prefixes(id) ON DELETE RESTRICT,
  ADD COLUMN sequence_number INTEGER;

CREATE UNIQUE INDEX idx_qr_codes_prefix_sequence 
  ON qr_codes(prefix_id, sequence_number) 
  WHERE prefix_id IS NOT NULL AND sequence_number IS NOT NULL;
```

**Database Functions**:
- `generate_qr_codes_with_prefix(shop_id, prefix_id, quantity)` → Generates codes with format PREFIX-NNNN
- `get_prefix_qr_stats(shop_id, prefix_id)` → Returns usage statistics (total, unused, assigned, sold, lost)
- `migrate_legacy_qr_codes_to_default_prefix(shop_id)` → Optional migration helper (not required)

### 7.3 User Interface

#### Settings Page (`/admin/settings`)
**QR Prefixes Tab** added with:
- **Table**: Shows all prefixes (prefix, description, active status, display order, actions)
- **Add Dialog**: Create new prefix with validation
  - Prefix format: Must contain hyphen, alphanumeric + hyphens only, auto-uppercase
  - Description: Required, up to 200 characters
  - Display order: Auto-calculated
- **Edit Dialog**: Update description (prefix name immutable)
- **Toggle Active**: Enable/disable prefix availability
- **Delete**: Only allowed if no QR codes exist for prefix
- **"Generate QR Codes" Button**: Quick navigation to QR generation page

#### QR Codes Page (`/admin/qr-codes`)
**Generation Form Updated**:
- **Prefix Selector**: Required dropdown showing active prefixes
- **Quantity Input**: 1-9999 codes per batch
- **Preview**: Shows format "PREFIX-0001, PREFIX-0002, ..."
- **Success Message**: Shows exact range generated (e.g., "Range: WA-499-0001 to WA-499-0100")
- **Empty State**: If no prefixes exist, shows message with link to Settings

**Table**: 
- Displays codes in format `PREFIX-NNNN` or `SEQUENCE-NNNN`
- All existing features (search, filter, pagination, delete) work with prefixed codes

#### Add Stock Lot Page (`/admin/inventory/add-lot`)
**Prefix Integration**:
- **Prefix Selector**: New required field after category
- **Real-time QR Count**: Shows available unused codes for selected prefix
- **Validation**: Prevents submission if quantity exceeds available codes
- **Helper Text**: Reminds user to align price with prefix
- **Success Message**: Shows lot ID and exact QR codes assigned

### 7.4 Edge Function Integration

**`add_stock_lot` Function Updated**:
- Added `prefix_id` parameter (REQUIRED)
- Validates prefix exists, is active, and belongs to shop
- Filters QR codes by `prefix_id` when assigning
- Orders by `sequence_number` for sequential assignment
- Returns detailed error if insufficient QR codes available for that prefix

### 7.5 Workflow Example

**Scenario**: Add 50 items at ₹499

1. **Admin** creates prefix:
   - Go to Settings → QR Prefixes
   - Add prefix: `WA-499` (Description: "Regular items ₹499")
   - Click Save

2. **Admin** generates QR codes:
   - Go to QR Codes page
   - Select prefix: `WA-499`
   - Enter quantity: 100
   - Click Generate
   - Success: "Generated 100 QR codes with prefix WA-499! Range: WA-499-0001 to WA-499-0100"

3. **Admin** adds stock lot:
   - Go to Add Stock Lot
   - Fill form (item name, category, cost ₹300, selling price ₹499, quantity 50)
   - Select prefix: `WA-499` (shows "50 available" after 50 already used)
   - Submit
   - Success: "Successfully added 50 items to inventory. Lot ID: xxx | QR Codes assigned: 50"

4. **Staff** scans at POS:
   - Customer brings item with QR code `WA-499-0025`
   - Staff scans → item loads with ₹499 price
   - Complete sale → QR status changes to "sold"

### 7.6 Validation Rules

**Prefix Format**:
- ✅ Valid: `WA-499`, `WA-TP-599`, `WA-PREMIUM-999`, `A-1`
- ❌ Invalid: `wa-499` (lowercase), `WA499` (no hyphen), `WA-499!` (special chars)
- Auto-converts lowercase to uppercase during input
- Regex: `^[A-Z0-9]+(-[A-Z0-9]+)+$`

**Sequence Limit**:
- Maximum 9999 codes per prefix
- Format: Zero-padded 4-digit sequence (0001-9999)
- Generates error if exceeding limit
- Solution: Create new prefix (e.g., `WA-499-A`, `WA-499-B`)

**Uniqueness**:
- Prefix name unique per shop
- (prefix_id, sequence_number) unique constraint
- Cannot create duplicate sequences (database enforces)

### 7.7 Testing Guide

Comprehensive test cases documented in:
- **File**: `docs/QR_PREFIX_TESTING_GUIDE.md`
- **Sections**: Database, UI Components, Integration, Edge Cases, Performance, Security
- **Total Tests**: 80+ test cases covering all scenarios

### 7.8 User Documentation

End-user guide available at:
- **File**: `docs/QR_PREFIX_USER_GUIDE.md`
- **Audience**: Shop owners, admins, staff
- **Contents**: What/Why/How, step-by-step workflows, best practices, FAQs, troubleshooting
- **Quick Reference Card**: Common tasks and keyboard shortcuts

### 7.9 Future Enhancements

**Potential Improvements** (not currently implemented):
- Prefix analytics dashboard (usage trends, popular prefixes)
- Bulk prefix operations (generate codes for multiple prefixes at once)
- Prefix templates (pre-defined common formats)
- Edit QR code assignments after lot creation
- Prefix-based inventory reports
- Prefix suggestions based on pricing patterns
- Regenerate database types for DB function support in TypeScript

### 7.10 Implementation Notes

**Files Modified**:
- Database: 3 migration files in `supabase/migrations/`
- Backend: `supabase/functions/add-stock-lot/index.ts`
- Types: `src/types/database.types.ts`, `src/types/index.ts`
- API: New file `src/lib/api/qr-prefixes.ts`
- UI: `src/app/(protected)/admin/settings/page.tsx`
- UI: `src/app/(protected)/admin/qr-codes/page.tsx`
- UI: `src/app/(protected)/admin/inventory/add-lot/page.tsx`

**Migration Execution**:
- All migrations executed successfully in Supabase SQL Editor
- RLS policies enforce shop_id isolation
- No data migration required (new feature, no legacy data)

**Known Issues**:
- QR code range sometimes doesn't display in success toast (debugging in progress)
- Display order field initially manual, now auto-calculated

---

## Appendix: Key Technical Constraints

- **Database**: Supabase PostgreSQL with RLS policies enforcing multi-tenancy
- **Authentication**: Supabase Auth (email/password only)
- **Offline Storage**: IndexedDB via `idb` library (pending sales, inventory cache)
- **Edge Functions**: `complete_sale`, `add_stock_lot` (server-side business logic)
- **Frontend**: Next.js 16 App Router (client-side rendering for protected routes)
- **UI Library**: shadcn/ui (Radix UI + Tailwind CSS)
- **QR Scanning**: html5-qrcode library (camera-based scanning)
- **Deployment**: Static export optimized (PWA-ready)
- **Target Device**: Tablets (responsive design, touch-optimized)

---

**End of Document**
