# Womaniya Dashboard — Complete Feature Documentation

> **Version:** 1.0  
> **Platform:** Progressive Web App (PWA) — works on tablets, phones, and desktops  
> **Technology:** Next.js, Supabase, Tailwind CSS  
> **Locale:** India (₹ INR, IST timezone, en-IN formatting)

---

## Table of Contents

1. [Getting Started](#1-getting-started)
2. [Authentication & Security](#2-authentication--security)
3. [Navigation & App Shell](#3-navigation--app-shell)
4. [Point of Sale (POS)](#4-point-of-sale-pos)
5. [Inventory Management](#5-inventory-management)
6. [Adding Stock (Add Stock Lot)](#6-adding-stock-add-stock-lot)
7. [QR Code Management](#7-qr-code-management)
8. [Sales & Bills](#8-sales--bills)
9. [Returns](#9-returns)
10. [Finances & Expenses](#10-finances--expenses)
11. [Staff Management](#11-staff-management)
12. [Staff Performance Analytics](#12-staff-performance-analytics)
13. [Attendance Management](#13-attendance-management)
14. [Checklists & Daily Tasks](#14-checklists--daily-tasks)
15. [Settings & Configuration](#15-settings--configuration)
16. [Reports (Clearance, Festival, Promotion)](#16-reports-clearance-festival-promotion)
17. [Staff Dashboard (My Dashboard)](#17-staff-dashboard-my-dashboard)
18. [Superadmin System Dashboard](#18-superadmin-system-dashboard)
19. [PWA & Offline Support](#19-pwa--offline-support)
20. [Keyboard Shortcuts & Tips](#20-keyboard-shortcuts--tips)

---

## Role Reference

The application supports four user roles, each with different access levels:

| Role | Home Route | Access Level |
|------|-----------|--------------|
| **Superadmin** | `/superadmin` | Full system access — user management across shops, system health, database export/import, sync management |
| **Owner** | `/admin` | Full shop operations — all admin features, staff management |
| **Admin** | `/admin` | Shop management — inventory, sales, finances, attendance, checklists, QR codes, returns, settings |
| **Staff** | `/pos` | POS operations — sell products, view own attendance, complete assigned checklists |

---

## 1. Getting Started

### Installing the App (PWA)

Womaniya Dashboard is a Progressive Web App. After your first visit:

1. **Chrome/Edge (Android & Desktop):** A banner appears at the bottom of the screen after 3 seconds: *"Install Womaniya for a better experience."* Tap **Install** to add the app to your home screen / taskbar.
2. **Safari (iOS):** The banner shows iOS-specific instructions — tap the Share icon, then **Add to Home Screen**.
3. The banner can be dismissed and will reappear after 7 days.

Once installed, the app launches in full-screen mode with your brand's theme color.

### First Login

1. Navigate to the app URL.
2. Enter your **email** and **password** (minimum 6 characters).
3. The app remembers your last-used email address.
4. After login, you are redirected to your role-based home page.

### Forced Password Change

If you were assigned a temporary password by your superadmin, you will see the **Change Password** screen immediately after login:

1. Enter your **current password** to verify identity.
2. Enter a **new password** meeting all requirements:
   - At least 8 characters
   - At least one uppercase letter
   - At least one lowercase letter
   - At least one number
   - At least one special character (e.g., `!@#$%`)
3. A **password strength indicator** (5 levels) shows real-time feedback.
4. Confirm the new password.
5. Click **Change Password** — you will be redirected to your home page.

---

## 2. Authentication & Security

### Login Page

| UI Element | Description |
|-----------|-------------|
| Email field | Pre-filled with last used email (stored in browser) |
| Password field | Minimum 6 characters, show/hide toggle |
| Sign In button | Gradient-styled primary action |
| Particle background | Animated background for branding |

**Rules & Validations:**
- Both email and password are required.
- Invalid credentials show an error toast notification.
- If the user's account is deactivated (`is_active = false`), they are signed out with an error message.
- After login, users with `must_change_password = true` are redirected to `/change-password`.

### Session Management
- Profile data is cached in `localStorage` with a 24-hour TTL for fast load on return visits.
- When the browser tab regains focus (e.g., switching back to the app after using another app), the session is re-validated silently.
- A 6-second safety timeout prevents the app from getting stuck on the loading screen.
- If the profile fetch takes longer than 5 seconds, the cached version is used.

### Roles & Permissions
- **`hasRole(role)`** — checks if the current user has the specified role.
- **`isAdmin`** — true for `admin`, `owner`, and `superadmin`.
- **`isStaff`** — true for `staff` role only.
- **`isSuperadmin`** — true for `superadmin` role only.
- Deactivated accounts are detected on every session refresh and the user is immediately signed out.

---

## 3. Navigation & App Shell

### Top Bar (All Roles)

A sticky top navigation bar present on all protected pages:

| Element | Description |
|---------|-------------|
| **Logo + Shop Name** | Clickable — navigates to your home page. Shows the "W" logo letter. |
| **Search Button** | Opens the Command Palette (see below) |
| **Theme Toggle** | Switch between light and dark mode |
| **Settings Link** | Navigates to the Settings page |
| **Avatar Dropdown** | Shows: user name, role badge, sync status indicator, FAQs link, Theme Picker, Sign Out button |

### Bottom Navigation Bar (Staff & Admin)

A bottom nav bar with two items:

| Tab | Icon | Route |
|-----|------|-------|
| **Home** | Home icon | Your role's home page |
| **POS** | ShoppingCart icon | `/pos` |

**Behavior:**
- Auto-hides after 3 seconds of inactivity.
- Reappears when scrolling up or when the mouse moves near the bottom of the screen.
- Has a **pin/unpin toggle** — when pinned, it stays visible at all times.
- The active tab is highlighted with the brand gradient.

### Command Palette

**Keyboard Shortcut:** `Ctrl + K` (or `Cmd + K` on Mac)

A searchable command palette for quick navigation:

| Feature | Description |
|---------|-------------|
| **Search** | Fuzzy search across all navigation items using name and keywords |
| **Role-filtered** | Only shows navigation items relevant to your role |
| **Theme Toggle** | Quick access to toggle dark/light mode |
| **Theme Picker** | Change the brand accent color |

**Available Commands (Admin/Owner):**
- Dashboard, POS, Inventory, Add Stock Lot, Sales, Returns, Finances, QR Codes, Attendance, Checklists, Staff Management, Staff Performance, Settings

**Available Commands (Staff):**
- Dashboard, POS, My Dashboard, Settings

### Online/Offline Indicators

- **Offline Banner:** A yellow banner appears at the top when the device loses internet: *"You are offline. Changes will sync when back online."*
- **Online Banner:** A green banner appears briefly when connectivity is restored: *"Back online! Syncing..."*
- **Failed Sync Warning:** An orange banner appears if there are failed sync operations, with a link to view details.

---

## 4. Point of Sale (POS)

**Route:** `/pos`  
**Roles:** All roles (Staff, Admin, Owner, Superadmin)  
**Purpose:** Scan or search for products, build a cart, and complete sales.

### Page Layout

| Section | Description |
|---------|-------------|
| **Header** | "Point of Sale" title with POS icon |
| **Action Buttons** | "Search Products" button + "Scan QR Code" button |
| **Cart Area** | Shows cart items with inline editing, or empty state with helpful message |
| **Cart Summary** | Subtotal, Discount, Tax (GST), Grand Total |
| **Checkout Button** | Opens the checkout dialog |

### Adding Items to Cart

**Method 1 — QR Code Scanning:**
1. Tap **Scan QR Code** (camera icon button).
2. Grant camera permission when prompted.
3. Point the camera at a product's QR code label.
4. The app uses the rear camera by default (environment-facing).
5. On successful scan:
   - A **beep sound** plays.
   - The product is fetched from the server (or offline cache if offline).
   - The item is added to the cart automatically.
6. On error (item not found, already sold, already in cart):
   - An **error buzz** sound plays.
   - An error toast message appears.
7. **Manual Entry Fallback:** If the camera isn't working, tap "Enter QR Code Manually" to type the code.

**Method 2 — Product Search:**
1. Tap **Search Products**.
2. A search dialog opens with:
   - A search field (auto-searches after 500ms of typing).
   - Filter dropdowns for **Category** and **Size**.
   - Results showing: QR code, category, size, price, availability status.
3. Tap a product to add it to the cart.
4. **Offline Search:** When offline, the search uses a locally cached inventory (IndexedDB).

**Method 3 — From Inventory Page:**
- Admin users can tap "Add to Cart" on any item in the Inventory Management page.
- The item is queued in `sessionStorage` and you are redirected to the POS page.
- A toast confirms: *"[Category] queued — redirecting to POS"*.

### Cart List

| Column | Description |
|--------|-------------|
| **QR Code** | Monospace badge showing the product's QR code |
| **Category** | Product category name |
| **Size** | Product size (from lot or free text) |
| **Original Price** | The default selling price from the lot |
| **Final Price** | **Editable** — you can change the selling price per item |
| **Sale Type** | Dropdown: Regular, Festival, Clearance, Promotion |
| **Discount Reason** | Text field (appears when final price differs from original) |
| **Remove** | Delete button to remove item from cart |

**Pricing Rules:**
- **Max Discount Enforcement:** Each staff member has a `max_discount_percent` set in their profile. If you try to set a final price that exceeds your discount limit, you receive an error: *"Your maximum allowed discount is X%."*
- **Price Drop Warning:** If the discount exceeds 50% of the original price, a yellow warning icon appears next to the price.
- **Festival Margin Rule:** For items with a `min_margin_percent` set on their lot, the checkout process validates that the final price respects this minimum margin (only for festival sale type).

**Sale Types & Row Colors:**
- **Regular** — No row tinting
- **Festival** — Green-tinted row (`bg-gradient-to-r from-green-50`)
- **Clearance** — Red-tinted row (`bg-gradient-to-r from-red-50`)
- **Promotion** — Blue-tinted row (`bg-gradient-to-r from-blue-50`)

**Cart Persistence:**
- The cart is saved to `localStorage` after every change.
- If you leave the POS page and come back, you'll see a prompt: *"You have X items from a previous session. Restore cart?"* with Restore and Discard options.
- **Clear Cart** button removes all items and clears localStorage.

### Cart Summary

| Line | Calculation |
|------|-------------|
| **Subtotal** | Sum of all items' original prices |
| **Discount** | Subtotal minus sum of all items' final prices |
| **Tax (GST)** | Calculated per item based on each item's `taxRate` from its lot |
| **Grand Total** | Sum of all items' final prices + tax |

### Checkout Dialog

1. Click **Checkout** to open the completion dialog.
2. The dialog shows:
   - **Order Summary:** Item count, grand total.
   - **Duplicate QR Guard:** If any QR code appears more than once, checkout is blocked.
   - **Payment Method:** Select from Cash, UPI, Card, or Other.
   - **Customer Name:** Optional text field.
   - **Customer Phone:** Optional text field.
3. Click **Complete Sale**.
4. **Online Mode:** The sale is sent to the Supabase Edge Function (`complete-sale`) which:
   - Creates the sale record with a timestamp-based bill number (YYYYMMDDHHMMSS).
   - Creates sale_items for each cart item.
   - Updates inventory item statuses to `sold`.
   - Updates QR code statuses to `sold`.
   - Returns the bill number.
5. **Offline Mode:** The sale is saved to IndexedDB as a pending sale, and will sync when connectivity returns.
6. After completion, a **Bill Preview Dialog** opens showing the receipt.
7. The cart is cleared.

**Error Handling:**
- `SaleApiError` with specific error codes (e.g., `ITEM_ALREADY_SOLD`, `QR_CODE_NOT_FOUND`) show descriptive error messages.
- Network errors in offline mode trigger the IndexedDB fallback.

---

## 5. Inventory Management

**Route:** `/admin/inventory`  
**Roles:** Admin, Owner, Superadmin  
**Purpose:** View, search, filter, edit, and manage all inventory items.

### Header & Actions

| Button | Description |
|--------|-------------|
| **Lots History** | Opens a side sheet showing all stock lots with details |
| **Category Breakdown** | Opens a side sheet with category-wise item counts and values |
| **Add Stock Lot** | Navigates to the Add Stock Lot page |
| **Export** | Downloads current filtered data as CSV |

### Stats Cards (Clickable Filters)

Four stat cards at the top, each clickable to filter the table:

| Stat | Description | Click Action |
|------|-------------|--------------|
| **Total Items** | Count of all inventory items | Show all items |
| **Available** | Items with status `available` | Filter to available only |
| **Sold** | Items with status `sold` | Filter to sold only |
| **Damaged** | Items with status `damaged` | Filter to damaged only |

The active filter card is highlighted with a colored left border and tinted background.
A hint below the cards reads: *"Click a metric to filter the table below"*.

### Filters & Search

| Filter | Description |
|--------|-------------|
| **Search** | Search by QR code, category name, or size (server-side, debounced 500ms) |
| **Category Dropdown** | Filter by a specific category |
| **Order Type Dropdown** | Filter by: Normal, Promotion Sale, Festival Sale |
| **Date Range Filter** | Filter by: Today, This Week, This Month, All Time, or Custom date range |
| **Filter Chips** | Active filters shown as removable chips; "Clear All" button to reset |

### Inventory Table

| Column | Sortable | Description |
|--------|----------|-------------|
| **QR Code** | Yes | Clickable badge — opens Item Details dialog |
| **Category** | Yes | Category name from the lot |
| **Size** | Yes | Size name or free-text size |
| **Status** | Yes | Badge: Available (green), Sold (gray), Damaged (red) |
| **Price** | Yes | Default selling price from the lot |
| **Date** | Yes | Sold date (if sold) or creation date |
| **Actions** | — | View (eye), Edit (pencil, available items only), Delete (trash, available items only) |

**Row Tinting:** Rows are tinted by sale type — Festival (green), Clearance (red), Promotion (blue).

**Pagination:** Server-side pagination with configurable items per page (10, 25, 50, 100).

### Item Actions

- **View Details:** Opens an `InventoryItemDetailsDialog` showing all item metadata — QR code, category, size, lot info (vendor, cost price, selling price, tax rate, arrival date, sale type, min margin), status history, and an "Add to Cart" button for available items.
- **Edit Item:** Opens an `EditInventoryItemDialog` for editing the item's lot properties (category, size, prices, vendor, etc.). Only available for items with `available` status.
- **Delete Item:** Confirmation dialog → optimistic delete with a 5-second undo toast. Permanently deletes from database if not undone.
- **Add to Cart:** Queues the item in `sessionStorage` and redirects to POS.

### Side Sheets

- **Category Breakdown Sheet:** Shows a table of all categories with counts (total, available, sold, damaged) and total value.
- **Lots History Sheet:** Shows all lots with: ID, category, vendor, quantity, cost/selling prices, date, sale type. Supports editing and deleting lots.

---

## 6. Adding Stock (Add Stock Lot)

**Route:** `/admin/inventory/add-lot`  
**Roles:** Admin, Owner, Superadmin  
**Purpose:** Create a new batch of inventory items by defining lot details and assigning QR codes.

### Form Fields

| Field | Required | Description |
|-------|----------|-------------|
| **Category** | Yes | Select from shop's categories |
| **QR Prefix** | Yes | Autocomplete combobox — select a QR prefix. Shows available unused QR count. Links to Settings if no prefixes exist. |
| **Size** | No | Select from shop's sizes |
| **Custom Size** | No | Free-text size (if none of the preset sizes apply) |
| **Vendor Name** | No | Autocomplete from previously used vendor names |
| **Date of Stock Arrival** | Yes | Date picker, defaults to today |
| **Cost Price per Unit** | Yes | The purchase cost of each item (₹) |
| **Selling Price** | Yes | The retail price to display (₹). Hint: align with QR prefix (e.g., WA-499 for ₹499 items) |
| **Tax Rate** | No | GST percentage (e.g., 5, 12, 18) |
| **Quantity** | Yes | Number of items in this lot (1–9999). Must not exceed available unused QR codes. |

**Advanced Options (Accordion — expand to see):**

| Field | Description |
|-------|-------------|
| **Sale Type** | Optional: Festival, Clearance, or Promotion. Sets this lot's items for special pricing. |
| **Min Margin %** | For festival sales — minimum profit margin that must be maintained during POS checkout. |
| **Sale Reason** | Free-text description of why items are on sale. |

### Preview & Submit

- A **Preview** button shows a summary card with: category, prefix, quantity, cost/selling prices, profit margin percentage, and all other fields.
- The **profit margin** is calculated: `((Selling Price - Cost Price) / Cost Price) × 100`.
- On submit:
  1. Validates that enough unused QR codes exist for the selected prefix.
  2. Creates a `lot` record in the database.
  3. Assigns unused QR codes (with the selected prefix) to new `inventory_items`.
  4. Redirects to the Inventory page with a success toast: *"Successfully added X items to inventory"*.

### Validation Rules

- If quantity exceeds available unused QR codes: *"Insufficient QR codes. You need X but only Y unused codes available."*
- All monetary values must be non-negative numbers.
- A link to generate more QR codes appears when supply is low.

---

## 7. QR Code Management

**Route:** `/admin/qr-codes`  
**Roles:** Admin, Owner, Superadmin  
**Purpose:** Generate, view, print, download, and manage QR codes used for inventory tracking.

### Generate QR Codes (Collapsible Section)

| Field | Description |
|-------|-------------|
| **QR Prefix** | Autocomplete combobox from active prefixes. If none exist, shows link to Settings. |
| **Quantity** | Number of codes to generate (1–9999) |
| **Generate Button** | Creates QR codes in batches of 500 via the `generate_qr_codes_with_prefix` database function |

Generated codes follow the pattern: `PREFIX-0001`, `PREFIX-0002`, etc.

A button to **Manage Prefixes** links to Settings → QR Prefixes tab.

### Stats Cards (Clickable Filters)

Five stat cards:

| Stat | Click Action |
|------|--------------|
| **Total** | Show all QR codes |
| **Unused** | Filter to unused only |
| **Assigned** | Filter to assigned (linked to inventory) |
| **Sold** | Filter to sold |
| **Lost** | Filter to lost/marked as lost |

### Filters & Search

| Filter | Description |
|--------|-------------|
| **Search** | Search by QR code text |
| **Prefix Dropdown** | Filter by a specific QR prefix |
| **Date Range** | Today, Week, Month, All, Custom |
| **Filter Chips** | Active filters as removable chips |

### QR Codes Table

| Column | Sortable | Description |
|--------|----------|-------------|
| **Code** | Yes | QR code text — clickable for assigned/sold codes (opens details) |
| **Status** | Yes | Badge: Unused, Assigned, Sold, Lost |
| **Created** | Yes | Creation date |
| **Actions** | — | Download QR image, Mark as Lost, Delete (unused only), View Details |

**Row Tinting:** Unused (gray), Assigned (amber), Sold (blue), Lost (red).

**Keyboard Navigation:** Use `←` / `→` arrow keys to navigate between pages.

### Bulk Operations

| Action | Description |
|--------|-------------|
| **Select All** | Checkbox in header selects all unused codes on the current page |
| **Bulk Print** | Print/download selected QR codes as images |
| **Bulk Delete** | Delete all selected unused codes (with confirmation) |
| **Delete All Unused** | When filtering by "Unused", a button to delete all unused codes |

### QR Code Dialogs

- **QR Code Details Dialog:** Shows the full QR code, its status history, linked inventory item details (if assigned/sold).
- **QR Code Download Dialog:** Print-optimized layout of QR code images for physical labels.

---

## 8. Sales & Bills

**Route:** `/admin/sales`  
**Roles:** Admin, Owner, Superadmin  
**Purpose:** View all sales transactions, analytics, and vendor performance.

### Three Tabs

#### Tab 1: Transactions

**Stats Cards:**

| Stat | Description |
|------|-------------|
| **Total Bills** | Number of sales in the filtered period |
| **Revenue** | Total sales amount |
| **Discount** | Total discount given |
| **Average** | Average sale amount |

**Filters:**
- **Search:** By bill number, customer name, or phone number.
- **Sale Type:** Regular, Mixed (multiple types in one bill), Festival, Clearance, Promotion.
- **Date Range:** Today, Week, Month, All Time, Custom.
- **Filter Chips:** Removable chips + Clear All.

**Sales Table:**

| Column | Sortable | Description |
|--------|----------|-------------|
| **Bill #** | Yes | Clickable badge — opens Bill Preview. Colored dots indicate sale types contained in the bill (green=Festival, red=Clearance, blue=Promotion). Bill number format: `PREFIX` + `YYYYMMDDHHMMSS`. |
| **Customer** | Yes | Customer name (or "Walk-in"). Clickable history icon to see all purchases by this customer. |
| **Items** | — | Count of items in the sale |
| **Payment** | — | Badge: Cash, UPI, Card, Other. Shows discount amount if any. |
| **Amount** | Yes | Total sale amount in green |
| **Date** | Yes | Date and time |
| **Actions** | — | Eye icon to view bill details |

**Row Color Legend:**
- Festival → green tint
- Clearance → red tint
- Promotion → blue tint

**Export:** Downloads all filtered sales as CSV. Warning dialog if exporting more than a threshold of records.

**Bill Preview Dialog:** Shows a receipt-style view of the sale — bill number, date, items with prices, discounts, payment method, total, customer info, and a WhatsApp share button.

#### Tab 2: Analytics

Two side-by-side analysis cards:

- **Category Performance:** Revenue, cost, and profit breakdown by product category for the selected period.
- **Sale Type Analysis:** Breakdown of items sold by type (Regular, Festival, Clearance, Promotion) with links to detailed report pages.

#### Tab 3: Vendors

- **Vendor Performance:** Revenue, items sold, and profit margins tracked per vendor (from lot data). Helps identify which suppliers produce the best-selling items.

---

## 9. Returns

**Route:** `/admin/returns`  
**Roles:** Admin, Owner, Superadmin  
**Purpose:** Process product returns against original sales and track refund history.

### Processing a Return

1. Click **Process Return** button.
2. **Step 1 — Find the Sale:**
   - Enter the bill number in the search field.
   - Press Enter or click Search.
   - A list of matching sales appears (bill number, customer, date, amount, item count).
   - Click a sale to select it.
3. **Step 2 — Select Items to Return:**
   - All items from the original sale are listed with checkboxes.
   - Items already returned in a previous return are grayed out with an "Already Returned" badge.
   - Check the items being returned.
4. **Step 3 — Return Details:**
   - **Suggested Refund:** Auto-calculated as the sum of selected items' final prices.
   - **Refund Amount:** Enter the actual refund amount. A "Use Suggested Amount" button auto-fills it. Refund cannot exceed the selected items' total.
   - **Return Reason:** Required text field explaining why the items are being returned.
5. Click **Process Return** to complete.

**Rules:**
- At least one item must be selected.
- A return reason is required.
- Refund amount must be ≥ 0 and ≤ the total of selected items.
- The inventory items' statuses are restored to `available` after return.

### Stats Cards

| Stat | Description |
|------|-------------|
| **Total Returns** | Count of returns in the period |
| **Total Refunded** | Sum of all refund amounts (₹), shown in orange |
| **Items Returned** | Total items returned |
| **Avg. Refund** | Average refund amount per return |

### Returns Table

| Column | Sortable | Description |
|--------|----------|-------------|
| **Bill #** | — | Original sale's bill number (clickable) |
| **Customer** | — | Customer name or "Walk-in" |
| **Items** | — | Count of returned items |
| **Refund** | Yes | Refund amount in orange |
| **Reason** | — | Truncated return reason |
| **Date** | Yes | Return date |
| **Actions** | — | View details button |

### Return Details Dialog

A premium dialog showing:
- **Order Information:** Original bill number (clickable link to bill preview), customer, phone, original sale amount.
- **Return Details:** Date, time, processed by, refund amount (highlighted).
- **Reason:** Quoted return reason.
- **Returned Items:** List with QR code, category, size, price (with strikethrough if discounted).

### WhatsApp Receipt

- **Send Receipt** button in the return details dialog.
- Generates a formatted text message with return details.
- Uses `navigator.share()` on supported devices, falls back to WhatsApp deep link.
- If the customer's phone number is available, opens a direct WhatsApp chat.

---

## 10. Finances & Expenses

**Route:** `/admin/finances`  
**Roles:** Admin, Owner, Superadmin  
**Purpose:** Track revenue, expenses, and net profit. Manage expense records.

### Summary Stats

Six stat cards across the top:

| Stat | Description |
|------|-------------|
| **Revenue** | Total sales revenue for the period |
| **Expenses** | Total expenses recorded |
| **Net Profit** | Revenue minus Expenses |
| **Sales Count** | Number of sales transactions |
| **Avg. Sale** | Average sale amount |
| **Inventory Value** | Total value of available inventory (selling prices) |

### Date Filtering

- **Date Range:** Today, This Week, This Month, All Time, Custom date range.
- Filter chips show active filters with removal buttons.
- URL-synced — filter state persists in the URL query string.

### Add Expense

A collapsible "Add Expense" form:

| Field | Required | Description |
|-------|----------|-------------|
| **Amount** | Yes | Expense amount in ₹ |
| **Category** | Yes | Select from existing expense categories, or type a new name and click **+ Create** to add a new category inline |
| **Description** | No | Free-text description of the expense |
| **Date** | Yes | Date of the expense (defaults to today) |

Click **Add Expense** to save. The expense appears in the table immediately.

### Expenses Table

| Column | Sortable | Description |
|--------|----------|-------------|
| **Date** | Yes | Expense date |
| **Category** | — | Expense category name |
| **Description** | — | Expense details |
| **Amount** | Yes | Amount in ₹ |
| **Actions** | — | Edit and Delete buttons |

- **Edit:** Opens inline editing for the expense record.
- **Delete:** Optimistic delete with a 5-second undo toast.

### Category Breakdown

A visualization showing expense totals broken down by category, helping identify where money is being spent.

---

## 11. Staff Management

**Route:** `/admin/staff`  
**Roles:** Admin, Owner, Superadmin  
**Purpose:** View and manage staff members, update roles and permissions.

### Stats Cards (Clickable Filters)

| Stat | Click Action |
|------|--------------|
| **Total Staff** | Show all |
| **Active** | Filter to active members |
| **Admins** | Filter to admin/owner roles |
| **Staff** | Filter to staff role |

### Search & Filters

- **Search:** By name or phone number (debounced 300ms).
- **Status Filter:** All, Active, Inactive (via stats card clicks).
- **Role Filter:** All, Admin, Owner, Staff (via stats card clicks).
- **Filter Chips:** Active filters as removable chips.

### Staff Table

| Column | Sortable | Description |
|--------|----------|-------------|
| **Name** | Yes | Full name |
| **Phone** | Yes | Phone number |
| **Role** | Yes | Badge: Superadmin, Owner, Admin, Staff |
| **Max Discount** | Yes | Maximum discount percentage this staff member can apply |
| **Status** | Yes | Badge: Active (green) or Inactive (gray) |
| **Actions** | — | Active/Inactive toggle switch + dropdown menu with "Edit Details" |

### Editing Staff

Open the Edit dialog (via dropdown menu → Edit Details):

| Field | Description |
|-------|-------------|
| **Full Name** | Required |
| **Phone** | Optional, validated format (+91XXXXXXXXXX) |
| **Role** | Dropdown: Staff, Admin, Owner (+ Superadmin if you are superadmin) |
| **Max Discount Percent** | 0–100, controls maximum discount the staff member can apply in POS |

**Toggle Active/Inactive:**
- Use the switch in the Actions column.
- Confirmation dialog: *"Are you sure you want to deactivate [Name]? They will be locked out immediately."*
- Cannot toggle your own account.

### Adding New Staff

- **Superadmins** see an "Add Staff" button that opens the `UserManagement` component for creating new Supabase auth users.
- **Admins/Owners** see a grayed-out button with a tooltip: *"Contact your superadmin to add new staff members."*
- New users must be created through the superadmin interface (Supabase Auth user creation).

---

## 12. Staff Performance Analytics

**Route:** `/admin/staff-performance`  
**Roles:** Admin, Owner, Superadmin  
**Purpose:** View comprehensive performance metrics per staff member — sales, tasks, attendance.

### Layout

- **Date Filter:** Dropdown: Today, This Week, This Month, All Time, Custom.
- **Staff Performance Component:** A dedicated analytics component showing per-staff metrics:
  - **Sales Performance:** Revenue generated, number of sales, average sale amount per staff member.
  - **Task Completion:** Checklists completed vs assigned, completion rate.
  - **Attendance:** Hours worked, punctuality, days present.

The performance data is fetched based on the selected date range and the shop's staff roster.

---

## 13. Attendance Management

**Route:** `/admin/attendance`  
**Roles:** Admin, Owner, Superadmin  
**Purpose:** Track, create, edit, and manage staff attendance records.

### Two Views

#### Calendar View
- A per-staff attendance calendar showing days worked.
- Select a staff member from a dropdown to view their calendar.
- Visual indicators for different attendance statuses.

#### Logs Table View

**Filters:**
- **Staff Dropdown:** Filter by specific staff member.
- **Status Filter:** In Progress, Completed, Manual, Edited.
- **Date Range:** Today, Week, Month, All, Custom.
- **Search:** Search by staff name.
- **Filter Chips:** Active filters as removable chips.

**Attendance Logs Table:**

| Column | Sortable | Description |
|--------|----------|-------------|
| **Date** | — | Log date |
| **Staff** | — | Staff member name. Shows "Edited by [name]" if the record was modified. |
| **Clock In** | — | Clock-in time |
| **Clock Out** | — | Clock-out time, or yellow "In Progress" badge |
| **Status** | — | Badge: In Progress (yellow), Completed (green), Manual (purple), Edited |
| **Hours** | — | Calculated hours worked (clock-out - clock-in - breaks) |
| **Actions** | — | Edit and Delete buttons |

**Row Tinting:**
- In Progress → yellow tint
- Manual Entry → purple tint

### Attendance Actions

| Button | Description |
|--------|-------------|
| **Create Entry** | Opens a dialog to create a new attendance record for any staff member |
| **Bulk Entry** | Opens a dialog to create attendance records for multiple staff members at once |
| **Edit** | Modify clock-in/out times and breaks for an existing record |
| **Delete** | Remove an attendance record (with confirmation) |
| **Export** | Download attendance data as CSV |

### Create/Edit Dialogs

- **Create:** Select staff, set date, clock-in time, clock-out time (optional), break minutes.
- **Bulk Entry:** Select multiple staff members, set the same date and times for all.
- **Edit:** Modify times and break duration. The record is marked as "Edited" with the editor's name.
- **Delete:** Confirmation dialog with the staff member's name and date.

---

## 14. Checklists & Daily Tasks

**Route:** `/admin/checklists`  
**Roles:** Admin, Owner, Superadmin  
**Purpose:** Create and manage task checklist templates that generate daily/weekly instances for staff to complete.

### Stats Cards

| Stat | Click Filters |
|------|---------------|
| **Total Checklists** | Show all |
| **Active** | Show active only |
| **Inactive** | Show inactive only |
| **Total Items** | (Not clickable) Sum of all items across checklists |

### Checklist Cards (Grid Layout)

Each checklist is displayed as a card with:

| Element | Description |
|---------|-------------|
| **Color Strip** | Top accent strip — brand gradient for active, gray for inactive |
| **Icon** | Checklist icon with brand or gray background |
| **Name** | Checklist title |
| **Description** | Optional description (truncated) |
| **Status Badge** | Active or Inactive |
| **Schedule Pill** | Shows: Daily · Mon, Tue, ... / Weekly · Mon, Wed / One-time |
| **Items Preview** | First 3 items with numbered circles, "+N more" if applicable |
| **Action Buttons:** | **History** (view completion records), **Edit** (pencil), **Delete** (trash) |

### Creating/Editing a Checklist

A premium dialog with gradient header:

**Basic Information:**
| Field | Required | Description |
|-------|----------|-------------|
| **Checklist Name** | Yes | e.g., "Daily Opening Tasks" |
| **Description** | No | Brief description |
| **Active Toggle** | — | Inactive checklists don't generate daily instances |

**Recurrence Schedule:**
| Field | Description |
|-------|-------------|
| **Frequency** | Daily, Weekly, or One-time |
| **Active Days** | Day-of-week selector (Mon–Sun) — clickable day pills. Not shown for One-time. |

**Checklist Items:**
- Items are displayed in a **drag-and-drop reorderable list** (using framer-motion `Reorder`).
- Each item shows: numbered order, label text, up/down arrows, remove button.
- **Drag to reorder** hint appears when multiple items exist.
- **Add new item:** Text field + Add button (or press Enter).

### Create Today's Instances

- The **Create Today** button generates checklist instances for all active checklists that should run today (based on their recurrence days).
- Staff members can then see and complete these instances in their My Dashboard.

### Completion History

Click **History** on a checklist card to see:
- **Stats Grid:** Total instances, Completed, Partial, Completion Rate (%).
- **Date List:** Each date shows:
  - Status dot (green=complete, amber=partial, gray=pending)
  - Date label
  - Progress bar
  - Fraction (e.g., 3/5)
  - Expandable detail: who completed each item and when

---

## 15. Settings & Configuration

**Route:** `/settings`  
**Roles:** All roles (tabs vary by role)

### Shared Tabs (All Roles)

#### About Tab
- App name, version, and branding information.
- Credits and support contact.

#### App & Install Tab
- PWA installation status and instructions.
- Service worker status.
- Online/offline status.
- Cache management (for advanced users).

### Admin-Only Tabs (Admin, Owner, Superadmin)

#### Shop Details
- Edit shop name and other shop-level settings.
- View shop ID.

#### Tax Settings
- Configure default tax rates for the shop.
- Used as default for new lots if no specific tax rate is set.

#### Categories
- **View:** List of all product categories with sort order.
- **Add:** Create new categories.
- **Edit:** Rename categories.
- **Reorder:** Change the display sort order.
- **Delete:** Remove categories (with validation — cannot delete if items are linked).

#### Sizes
- **View:** List of all sizes with sort order.
- **Add:** Create new sizes (e.g., S, M, L, XL, XXL, Free Size).
- **Edit:** Rename sizes.
- **Reorder:** Change display order.
- **Delete:** Remove sizes.

#### Expense Categories
- **View:** List of expense categories (e.g., Rent, Utilities, Salaries).
- **Add:** Create new expense categories.
- **Edit:** Rename.
- **Delete:** Remove (with validation).

#### QR Prefixes
- **View:** List of QR prefixes with descriptions and status (active/inactive).
- **Add:** Create new prefixes (e.g., "WA" for Womaniya). Each prefix generates codes like WA-0001, WA-0002.
- **Edit:** Update prefix description or toggle active/inactive.
- **Deactivate:** Prevent a prefix from being used in new QR generation or stock lots.

### Tab Navigation

- **Desktop:** Horizontal tab bar with icons.
- **Mobile:** Dropdown selector with all tabs listed. Admin tabs are separated by a divider labeled "Admin".
- The active tab is stored in the URL query string (`?tab=categories`), so deep links and bookmarks work.

---

## 16. Reports (Clearance, Festival, Promotion)

These are dedicated report pages accessible from the Sales → Analytics tab.

### Clearance Report

**Route:** `/admin/reports/clearance`

Shows all items sold as clearance with:
- **Stats:** Total items, Revenue, Total Cost, Profit/Loss, Recovery Rate (%), Items at Loss, Items at Profit.
- **Category Summary:** Table breaking down clearance sales by category.
- **Item Table:** QR code, category, size, cost price, original price, sold price, profit/loss.
- **Insights:** Collapsible section with business insights about clearance performance.

### Festival Report

**Route:** `/admin/reports/festival`

Shows all items sold during festival sales:
- **Stats:** Total items, Revenue, Original Value, Total Profit, Violations count, Average Savings.
- **Margin Violations:** Highlights items sold below their `min_margin_percent` (the minimum profit margin set on the lot). These violations are flagged with a warning icon.
- **Category Summary:** By-category breakdown with violation counts.
- **Item Table:** QR code, category, size, cost, original, sold price, profit, min required price, violation flag.

### Promotion Report

**Route:** `/admin/reports/promotion`

Shows all items sold as promotions:
- **Stats:** Total items, Revenue, Original Value, Total Savings, Total Profit, Average Discount %.
- **Category Summary:** By-category with revenue, savings, and profit.
- **Item Table:** QR code, category, size, cost, original, sold price, discount %, profit.

All three reports:
- Load data from `sale_items` joined with `inventory_items`, `lots`, `categories`, `sizes`, and `sales`.
- Include a **Back** button linking to the Sales Analytics tab.
- Share the same card-based layout with collapsible insights.

---

## 17. Staff Dashboard (My Dashboard)

**Route:** `/me`  
**Roles:** Staff (Admin/Owner/Superadmin are redirected to `/admin`)  
**Purpose:** Staff members' personal dashboard showing attendance and assigned tasks.

### Layout

Two-column grid (single column on mobile):

#### Attendance Card (Left)
- Shows today's attendance status.
- **Clock In** button if not yet clocked in.
- **Clock Out** button if currently clocked in.
- Displays current session duration.
- Links to attendance history.

#### Daily Tasks Card (Right)
- **Compact Summary** in header: Shows completion count (e.g., "3/5").
- **Task List:** All assigned checklist items for today.
  - Each item has a checkbox to mark complete.
  - Completed items show a checkmark and the completer's name/time.
  - Items are grouped by checklist template.

#### Attendance History (Full Width)
- **View History** button expands a calendar component.
- `AttendanceCalendar` shows a monthly calendar view with:
  - Color-coded days: Present (green), Absent, Manual entry (purple), In progress (yellow).
  - Clickable days to see details.

---

## 18. Superadmin System Dashboard

**Route:** `/superadmin`  
**Roles:** Superadmin only  
**Purpose:** System-wide monitoring, health checks, database management, and user administration.

### Two Tabs

#### System Health Tab

**System Status Panel:**

| Component | Actions |
|-----------|---------|
| **Database Connection** | "Test Connection" button — tests Supabase response time |
| **Internet Connection** | Shows Online/Offline with appropriate icon |
| **Offline Storage (IndexedDB)** | "Recheck" button — verifies IndexedDB availability |
| **Edge Functions** | "Test Function" button — health check on the `complete-sale` edge function |

Each component shows a status badge: Healthy (green), Error (red), Offline (gray), Unknown (outline).

**Sync Metrics:**

| Metric | Description |
|--------|-------------|
| **Pending Syncs** | Count of sales waiting to sync (warning if > 0) |
| **Failed Syncs** | Count of failed sync attempts (error if > 0). Links to Sync Issues page. |

**Quick Actions:**

| Action | Description |
|--------|-------------|
| **Sync Issues** | View and retry failed syncs — shows failed count badge if > 0 |
| **Export Database** | Download entire shop data as JSON backup (shop, inventory, QR codes, sales, profiles) |
| **Import Database** | Restore from JSON backup (coming soon) |
| **Admin Dashboard** | Link to the regular admin dashboard |
| **System Logs** | Coming soon |
| **Advanced Tools** | Coming soon |

**Action Required Section:**
- Appears when pending or failed syncs exist.
- Orange alert box with **Force Sync Now** button and **View Issues** link.

#### User Management Tab

Full `UserManagement` component for creating and managing Supabase auth users across shops:
- Create new users with email/password.
- Assign roles and shops.
- Reset passwords (triggers `must_change_password`).
- Activate/deactivate accounts.

### Sync Issues Page

**Route:** `/superadmin/sync-issues`

Shows all pending and failed offline sales:

- **Summary:** "X failed, Y pending" in the header.
- **Action Buttons:** Clear All Failed, Sync Now, Retry Failed.
- **Failed Sale Cards:** Each shows:
  - Failed status with retry count.
  - Date and time of the sale attempt.
  - Error details.
  - Items with prices.
  - Delete button (with confirmation).
- **All Clear State:** Checkmark with "No sync issues found" when everything is synced.

---

## 19. PWA & Offline Support

### Progressive Web App Features

| Feature | Description |
|---------|-------------|
| **Installable** | Add to home screen on mobile and desktop |
| **Full-screen Mode** | Launches without browser chrome when installed |
| **Offline Page** | Shows a branded offline message when the network is unavailable and the page isn't cached |
| **Service Worker** | Caches static assets for fast repeat loads |
| **Theme Color** | Status bar matches the app's brand color |

### Offline POS Workflow

1. When the device goes offline, a yellow banner appears: *"You are offline."*
2. **Scanning/searching** uses the locally cached inventory (synced to IndexedDB during online sessions).
3. **Completing a sale** saves the sale data to IndexedDB as a "pending" sale.
4. When connectivity returns:
   - The `SyncContext` automatically detects pending sales.
   - Each pending sale is submitted to the server.
   - Successful syncs update the sale status.
   - Failed syncs increment the retry count and can be managed from the Sync Issues page.
5. The **SyncStatusIndicator** in the avatar dropdown shows:
   - Green: All synced.
   - Yellow: Pending syncs.
   - Red: Failed syncs.

### IndexedDB Storage

- **Database Name:** Configured in `appConfig.internal.idbName`.
- **Stores:**
  - Pending sales (cart items, customer info, payment method).
  - Inventory cache (for offline scanning and search).
- Data is preserved across browser sessions until synced or manually cleared.

---

## 20. Keyboard Shortcuts & Tips

### Global Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl + K` / `Cmd + K` | Open Command Palette |
| `←` / `→` Arrow Keys | Navigate between table pages (QR Codes page) |

### Tips for Efficient Use

1. **Quick Navigation:** Use `Ctrl + K` and start typing the page name. The fuzzy search finds pages by name or keywords.
2. **Stats Card Filtering:** Click any stat card to instantly filter the table below. Click again to clear the filter.
3. **QR Code Workflow:** Generate QR codes → Print labels → Physically attach to items → Add Stock Lot (assigns codes to items) → Scan at POS to sell.
4. **Cart Persistence:** Your POS cart is saved automatically. If you accidentally navigate away, your items are preserved.
5. **Offline Sales:** Don't worry about internet outages during busy hours. Sales are saved locally and sync automatically when connectivity returns.
6. **Dark Mode:** Toggle via the sun/moon icon in the top bar, or use the Command Palette.
7. **Theme Customization:** Open the Theme Picker from the avatar dropdown to change the brand accent color across the entire app.
8. **Search Everything:** Most tables have a search bar that works server-side. Use it to quickly find items by QR code, name, phone number, etc.
9. **Export Data:** Every major table (Inventory, Sales, QR Codes, Attendance, Returns) supports CSV export for external analysis.
10. **WhatsApp Sharing:** Sale receipts and return confirmations can be shared directly to WhatsApp — useful for sending receipts to customers.
11. **Festival Margin Protection:** Set `min_margin_percent` on lots during stock addition to prevent staff from selling below cost during festival sales.
12. **Debounced Search:** All search fields wait 300–500ms after you stop typing before querying the server, reducing unnecessary API calls.
13. **URL-Synced Filters:** On many pages (Inventory, Sales, Settings), your filter selections are stored in the URL. You can bookmark a filtered view or share the URL.
14. **Undo Deletes:** Deleting inventory items and expenses gives you a 5-second undo window via the toast notification.

---

## Appendix: Data Model Overview

| Table | Description |
|-------|-------------|
| `shops` | Shop details (name, address, settings) |
| `profiles` | User profiles (name, phone, role, max_discount, shop_id, is_active, must_change_password) |
| `categories` | Product categories per shop |
| `sizes` | Product sizes per shop |
| `qr_prefixes` | QR code prefix definitions (e.g., "WA", "WB") |
| `qr_codes` | Individual QR codes with status (unused → assigned → sold / lost) |
| `lots` | Stock lot batches (vendor, prices, tax, sale type, margins) |
| `inventory_items` | Individual items linked to lots and QR codes |
| `sales` | Sale transactions (bill number, totals, payment, customer) |
| `sale_items` | Line items within each sale (prices, discounts, sale type) |
| `sale_returns` | Return records linking back to original sales |
| `financial_transactions` | Expense records with categories |
| `expense_categories` | Expense category definitions |
| `attendance_logs` | Staff clock-in/out records with breaks |
| `checklists` | Checklist templates with recurrence settings |
| `checklist_items` | Individual tasks within a checklist template |
| `checklist_instances` | Generated instances of checklists for specific dates |
| `checklist_item_completions` | Completion records for individual tasks |
| `tax_settings` | Shop-level tax configuration |

---

## Appendix: Currency & Locale

- **Currency:** Indian Rupee (₹ INR)
- **Number Format:** Indian notation (e.g., ₹1,23,456.78)
- **Timezone:** Asia/Kolkata (IST, UTC+5:30)
- **Date Format:** DD Mon YYYY (e.g., 15 Jan 2025)
- **Time Format:** 12-hour with AM/PM

---

*Document generated from source code analysis of the Womaniya Dashboard application.*
