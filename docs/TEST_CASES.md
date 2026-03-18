# Womaniya Dashboard — Comprehensive Test Document

> **Version**: 1.0  
> **Last Updated**: 2026-03-09  
> **App**: Womaniya Dashboard (Retail POS + Inventory + Staff Management PWA)  
> **Target Devices**: Android tablets (primary), mobile phones, desktop browsers  
> **Browsers**: Chrome (primary), Edge, Safari (iOS PWA)

---

## How to Use This Document

- Each test case has a unique ID like **2.1.1.1** (Module.Section.Group.Case)
- **Perform each test** and mark: ✅ Pass / ❌ Fail / ⚠️ Partial / ⏭️ Skipped
- On failure, report the **test case ID** + screenshot/video + device info
- Test with **two roles minimum**: admin (owner) and staff, unless specified
- Test on **both tablet and phone** for UI/UX cases
- **Expected Result** is provided for each case — compare actual vs expected

### Severity Legend

| Tag | Meaning |
|-----|---------|
| 🔴 **CRITICAL** | App-breaking, data loss, security issue |
| 🟠 **HIGH** | Feature broken, workflow blocked |
| 🟡 **MEDIUM** | Feature works but UX is poor |
| 🟢 **LOW** | Cosmetic, minor polish |

---

## Table of Contents

1. [Authentication & Authorization](#1-authentication--authorization)
2. [Navigation & Layout](#2-navigation--layout)
3. [Admin Dashboard](#3-admin-dashboard)
4. [Point of Sale (POS)](#4-point-of-sale-pos)
5. [Inventory Management](#5-inventory-management)
6. [Add Stock Lot](#6-add-stock-lot)
7. [Sales Hub](#7-sales-hub)
8. [Returns Management](#8-returns-management)
9. [QR Code Management](#9-qr-code-management)
10. [Finances / Expense Tracking](#10-finances--expense-tracking)
11. [Staff Management](#11-staff-management)
12. [Staff Performance Analytics](#12-staff-performance-analytics)
13. [Attendance Management](#13-attendance-management)
14. [Checklists / Task Management](#14-checklists--task-management)
15. [Reports](#15-reports)
16. [Staff Dashboard (My Dashboard)](#16-staff-dashboard-my-dashboard)
17. [Settings](#17-settings)
18. [Superadmin Panel](#18-superadmin-panel)
19. [Sync Issues](#19-sync-issues)
20. [User Guide & FAQs](#20-user-guide--faqs)
21. [Offline / PWA Features](#21-offline--pwa-features)
22. [Cross-Cutting UI/UX Tests](#22-cross-cutting-uiux-tests)
23. [Security & Access Control](#23-security--access-control)
24. [Performance & Edge Cases](#24-performance--edge-cases)

---

## 1. Authentication & Authorization

### 1.1 Login Page (`/login`)

#### 1.1.1 Form Rendering

| # | Test Case | Steps | Expected Result | Severity |
|---|-----------|-------|-----------------|----------|
| 1.1.1.1 | Page loads correctly | Navigate to `/login` | Login form is displayed with email field, password field, "Remember email" checkbox, and "Sign In" button | 🔴 |
| 1.1.1.2 | Email field is auto-focused | Open login page fresh | Email input has focus; keyboard appears on mobile/tablet | 🟡 |
| 1.1.1.3 | Password field has show/hide toggle | Look at password field | Eye icon is visible next to password field | 🟢 |
| 1.1.1.4 | Toggle password visibility | Click the eye icon on password field | Password toggles between hidden (dots) and visible (plain text); icon changes between Eye and EyeOff | 🟢 |
| 1.1.1.5 | "Remember email" checkbox present | Look at login form | Checkbox labeled "Remember email" is visible and unchecked by default | 🟢 |

#### 1.1.2 Login — Validation

| # | Test Case | Steps | Expected Result | Severity |
|---|-----------|-------|-----------------|----------|
| 1.1.2.1 | Submit with empty email | Leave email empty, click "Sign In" | Inline error appears under email field: field is required | 🟠 |
| 1.1.2.2 | Submit with empty password | Enter email, leave password empty, click "Sign In" | Inline error appears under password field: field is required | 🟠 |
| 1.1.2.3 | Submit with both empty | Click "Sign In" without entering anything | Both fields show inline errors | 🟠 |
| 1.1.2.4 | Submit with invalid email format | Enter "notanemail", enter password, click "Sign In" | Error shown (inline or toast) indicating invalid email | 🟠 |
| 1.1.2.5 | Submit with wrong credentials | Enter valid format email + wrong password, click "Sign In" | Toast error appears with auth failure message; form fields remain (not cleared) | 🟠 |

#### 1.1.3 Login — Success Flow

| # | Test Case | Steps | Expected Result | Severity |
|---|-----------|-------|-----------------|----------|
| 1.1.3.1 | Successful login as admin/owner | Enter valid admin credentials, click "Sign In" | Button shows spinner + "Signing in…"; on success, redirects to `/admin` | 🔴 |
| 1.1.3.2 | Successful login as staff | Enter valid staff credentials, click "Sign In" | Button shows spinner + "Signing in…"; on success, redirects to `/pos` | 🔴 |
| 1.1.3.3 | Successful login as superadmin | Enter superadmin credentials, click "Sign In" | Redirects to `/superadmin` | 🔴 |
| 1.1.3.4 | Button disabled during submission | Click "Sign In" with valid credentials | Button becomes disabled + shows spinner; cannot click again | 🟠 |
| 1.1.3.5 | "Remember email" saves email | Check "Remember email", login successfully, logout, return to login | Email field is pre-filled with previously entered email | 🟡 |
| 1.1.3.6 | "Remember email" unchecked doesn't save | Uncheck "Remember email", login, logout, return to login | Email field is empty | 🟡 |

#### 1.1.4 Login — Redirects

| # | Test Case | Steps | Expected Result | Severity |
|---|-----------|-------|-----------------|----------|
| 1.1.4.1 | Already logged-in user visits `/login` | While logged in, navigate to `/login` | Automatically redirected to role-based home route (not shown login form) | 🟠 |
| 1.1.4.2 | Root URL redirect (unauthenticated) | Navigate to `/` while logged out | Redirected to `/login` | 🔴 |
| 1.1.4.3 | Root URL redirect (authenticated) | Navigate to `/` while logged in | Redirected to role-based home (admin→`/admin`, staff→`/pos`, superadmin→`/superadmin`) | 🔴 |
| 1.1.4.4 | Must-change-password redirect | Login with account that has `must_change_password=true` | Redirected to `/change-password` instead of home route | 🔴 |

### 1.2 Change Password (`/change-password`)

#### 1.2.1 Form Rendering

| # | Test Case | Steps | Expected Result | Severity |
|---|-----------|-------|-----------------|----------|
| 1.2.1.1 | Page loads for required user | Login with `must_change_password=true` account | Change password form shown with: New Password, Confirm Password, strength meter, rules list, Update button | 🔴 |
| 1.2.1.2 | Redirect if not required | Login with normal account, navigate to `/change-password` | Redirected to home route (not shown change password form) | 🟠 |
| 1.2.1.3 | Both password fields have show/hide toggle | Inspect the two password fields | Both have eye icon toggle for visibility | 🟢 |

#### 1.2.2 Password Validation

| # | Test Case | Steps | Expected Result | Severity |
|---|-----------|-------|-----------------|----------|
| 1.2.2.1 | Strength meter — very weak | Type "abc" in new password | Strength shows "Very Weak" (red); most rules show ✗ | 🟡 |
| 1.2.2.2 | Strength meter — weak | Type "abcdefgh" (8 chars, lowercase only) | Strength shows "Weak"; only length rule shows ✓ | 🟡 |
| 1.2.2.3 | Strength meter — fair | Type "Abcdefg1" | Strength shows "Fair"; length + uppercase + lowercase + number ✓ | 🟡 |
| 1.2.2.4 | Strength meter — strong | Type "Abcdefg1!" (8+ chars, upper, lower, digit, special) | Strength shows "Strong" (green); all rules show ✓ | 🟡 |
| 1.2.2.5 | Passwords don't match | Enter "Password1!" and "Password2!" | Error message: passwords must match; Update button disabled or shows error on submit | 🟠 |
| 1.2.2.6 | Password too weak to submit | Enter matching but weak passwords (e.g., "abc" / "abc") | Cannot submit; error indicates minimum strength required | 🟠 |

#### 1.2.3 Password Change — Success

| # | Test Case | Steps | Expected Result | Severity |
|---|-----------|-------|-----------------|----------|
| 1.2.3.1 | Successful password change | Enter strong matching passwords, click "Update Password" | Button shows spinner; on success, toast confirmation, redirected to role-based home | 🔴 |
| 1.2.3.2 | Subsequent login uses new password | After changing password, logout, login with NEW password | Login succeeds; not redirected to change-password again | 🔴 |
| 1.2.3.3 | Old password no longer works | After changing, logout, try old password | Login fails with error | 🔴 |

### 1.3 Sign Out

| # | Test Case | Steps | Expected Result | Severity |
|---|-----------|-------|-----------------|----------|
| 1.3.1 | Sign out from avatar dropdown | Click avatar in TopBar → click "Sign out" (red) | Redirected to `/login`; session cleared | 🔴 |
| 1.3.2 | After sign out, cannot access protected pages | Sign out, then navigate to `/admin` | Redirected to `/login` | 🔴 |
| 1.3.3 | Sign out clears local cache | Sign out, check localStorage | Profile cache is cleared (no stale data) | 🟠 |

---

## 2. Navigation & Layout

### 2.1 Top Bar (Header)

| # | Test Case | Steps | Expected Result | Severity |
|---|-----------|-------|-----------------|----------|
| 2.1.1 | TopBar displays on all protected pages | Navigate to any protected page | Sticky header with logo, shop name, search icon, theme toggle, settings icon, avatar | 🟠 |
| 2.1.2 | Logo click navigates to home | Click brand logo in TopBar | Navigates to role-based home route | 🟡 |
| 2.1.3 | Logo switches for theme | Toggle dark/light mode | Logo changes between `womaniya_logo_darkbg.png` (dark) and `womaniya_logo_lightbg.png` (light) | 🟢 |
| 2.1.4 | Theme toggle works | Click sun/moon icon in TopBar | Theme switches between light and dark; all page elements update | 🟡 |
| 2.1.5 | Settings icon navigates to Settings | Click settings (gear) icon | Navigates to `/settings` | 🟡 |
| 2.1.6 | Avatar dropdown opens | Click avatar/account icon | Dropdown shows: user name, role, Sync status, FAQ link, Guide link, Theme picker, Sign out | 🟠 |
| 2.1.7 | Search icon opens command palette | Click search icon in TopBar | Command palette overlay opens with search input | 🟡 |

### 2.2 Bottom Navigation

| # | Test Case | Steps | Expected Result | Severity |
|---|-----------|-------|-----------------|----------|
| 2.2.1 | BottomNav shows on protected pages | Open any protected page | Fixed bottom bar with Home and POS icons | 🟠 |
| 2.2.2 | Home button navigates correctly | Click Home icon | Navigates to role-based home route | 🟠 |
| 2.2.3 | POS button navigates correctly | Click POS icon | Navigates to `/pos` | 🟠 |
| 2.2.4 | Active item is highlighted | Navigate to POS, check BottomNav | POS icon has gradient background + white text (active state) | 🟢 |
| 2.2.5 | Auto-hide on scroll down | Scroll down on a long page | BottomNav hides after ~3 seconds of no interaction | 🟡 |
| 2.2.6 | Show on scroll up | After auto-hide, scroll up | BottomNav reappears | 🟡 |
| 2.2.7 | Pin/unpin toggle | Click pin button (chevron icon) at bottom-right | BottomNav stays permanently visible (pinned); icon changes | 🟡 |

### 2.3 Command Palette

| # | Test Case | Steps | Expected Result | Severity |
|---|-----------|-------|-----------------|----------|
| 2.3.1 | Open with keyboard shortcut | Press `Ctrl+K` (Windows) or `⌘K` (Mac) | Command palette overlay opens | 🟡 |
| 2.3.2 | Open via search icon | Click search icon in TopBar | Command palette opens | 🟡 |
| 2.3.3 | Search filters results | Type "invent" in search | Shows "Inventory" as a result | 🟡 |
| 2.3.4 | Role-based filtering (admin) | Open as admin, check available items | Shows all admin pages (Dashboard, Inventory, Sales, etc.) | 🟠 |
| 2.3.5 | Role-based filtering (staff) | Open as staff, check available items | Only shows: POS, My Dashboard, Settings, FAQs, Guide | 🟠 |
| 2.3.6 | Navigation works | Select "Inventory" from results | Palette closes; navigates to `/admin/inventory` | 🟡 |
| 2.3.7 | Appearance commands | Type "dark" or "light" | Shows theme toggle commands | 🟢 |
| 2.3.8 | Close on Escape | Open palette, press Escape | Palette closes; previous page content visible | 🟢 |
| 2.3.9 | Close on outside click | Open palette, click outside the palette dialog | Palette closes | 🟢 |

### 2.4 Offline / Online Banners

| # | Test Case | Steps | Expected Result | Severity |
|---|-----------|-------|-----------------|----------|
| 2.4.1 | Offline banner appears | Disable network (airplane mode / DevTools) | Yellow warning banner shown indicating offline status | 🟠 |
| 2.4.2 | Online restored banner | Re-enable network after being offline | Green "Back online" notification appears briefly | 🟡 |
| 2.4.3 | Sync warning badge | Have pending offline sales, go online | TopBar shows sync count badge indicating pending syncs | 🟡 |

---

## 3. Admin Dashboard

### 3.1 Page Load (`/admin`)

| # | Test Case | Steps | Expected Result | Severity |
|---|-----------|-------|-----------------|----------|
| 3.1.1 | Dashboard loads for admin | Login as admin, navigate to `/admin` | Page shows stats cards, weekly insight, module cards | 🔴 |
| 3.1.2 | Dashboard blocked for staff | Login as staff, navigate to `/admin` | Redirected away or access denied | 🔴 |
| 3.1.3 | Loading state shown | Observe page on initial load | Stats show loading skeletons/spinners before data loads, then animate with CountUp | 🟡 |

### 3.2 Stats Cards

| # | Test Case | Steps | Expected Result | Severity |
|---|-----------|-------|-----------------|----------|
| 3.2.1 | Available Items stat | Check first stat card | Shows count of available inventory items with Package icon | 🟠 |
| 3.2.2 | Today's Sales stat | Check second stat card | Shows count of today's sales with ShoppingCart icon | 🟠 |
| 3.2.3 | Daily Turnover stat | Check third stat card | Shows today's revenue formatted as currency (₹) with TrendingUp icon | 🟠 |
| 3.2.4 | Items Sold Today stat | Check fourth stat card | Shows count of items sold today with BarChart3 icon | 🟠 |
| 3.2.5 | CountUp animation | Refresh page, observe stats | Numbers animate from 0 to actual value (smooth count-up) | 🟢 |
| 3.2.6 | Stats reflect real data | Complete a sale, return to dashboard | Stats update to reflect the new sale | 🟠 |

### 3.3 Weekly Insight

| # | Test Case | Steps | Expected Result | Severity |
|---|-----------|-------|-----------------|----------|
| 3.3.1 | Weekly comparison shown | Check weekly insight section | Shows percentage change vs previous week | 🟡 |
| 3.3.2 | Positive change indicator | When this week > last week | Green up arrow with positive percentage | 🟢 |
| 3.3.3 | Negative change indicator | When this week < last week | Red down arrow with negative percentage | 🟢 |

### 3.4 Module Navigation Cards

| # | Test Case | Steps | Expected Result | Severity |
|---|-----------|-------|-----------------|----------|
| 3.4.1 | All module cards displayed | Scroll through dashboard | 3 sections (Business, Staff, Operations) with cards: Inventory, POS, Sales, Returns, Staff, Staff Performance, Attendance, QR Codes, Checklists, Finances, Settings | 🟠 |
| 3.4.2 | Card click navigates | Click "Inventory" card | Navigates to `/admin/inventory` | 🟠 |
| 3.4.3 | Cards have icons and descriptions | Inspect any module card | Shows gradient icon, label, and short description | 🟢 |
| 3.4.4 | All cards navigate correctly | Click each card one by one | Each navigates to correct route (verify against expected routes) | 🟠 |

---

## 4. Point of Sale (POS)

### 4.1 POS Page Load (`/pos`)

| # | Test Case | Steps | Expected Result | Severity |
|---|-----------|-------|-----------------|----------|
| 4.1.1 | POS loads for all roles | Login as staff or admin, navigate to `/pos` | POS page shows: header with item count, Scan QR button, Search Products button, cart area, checkout section | 🔴 |
| 4.1.2 | Empty cart state | Open POS with no items in cart | Cart area shows empty state message; Checkout button is disabled or hidden | 🟡 |

### 4.2 QR Scanner

| # | Test Case | Steps | Expected Result | Severity |
|---|-----------|-------|-----------------|----------|
| 4.2.1 | Open scanner dialog | Click "Scan QR" button | Camera scanner dialog opens with viewfinder, Cancel button, and "Type Code" option | 🔴 |
| 4.2.2 | Camera permission — allowed | Allow camera access when prompted | Camera feed appears in scanner viewfinder | 🔴 |
| 4.2.3 | Camera permission — denied | Deny camera permission | Toast error: specific message about permission denied; dialog handles gracefully | 🟠 |
| 4.2.4 | Successful QR scan (online) | Scan a valid QR code for an available item | Beep sound plays; item added to cart; success toast; scanner can continue | 🔴 |
| 4.2.5 | Scan already-sold item | Scan QR of an item with status "sold" | Error toast: "Already sold"; item NOT added to cart | 🟠 |
| 4.2.6 | Scan non-existent QR | Scan a QR code not in the system | Error buzz sound; error toast: "Not found" | 🟠 |
| 4.2.7 | Scan duplicate (already in cart) | Scan same QR code twice | Second scan shows error/warning that item is already in cart | 🟠 |
| 4.2.8 | Loading overlay during processing | Scan a QR code | Spinner overlay appears over camera feed while processing; clears after result | 🟡 |
| 4.2.9 | Manual QR entry | Click "Type Code" in scanner dialog → enter QR code → submit | Processes the typed code same as scanned; adds to cart if valid | 🟠 |
| 4.2.10 | Manual QR entry — Enter key | Type code, press Enter | Triggers lookup (same as clicking Add/Search button) | 🟡 |
| 4.2.11 | Cancel scanner | Click "Cancel" in scanner dialog | Dialog closes; camera stops; returns to POS page | 🟡 |
| 4.2.12 | Double-scan prevention | Scan two QR codes very rapidly | Only one item added (processing guard prevents double-fire) | 🟠 |

### 4.3 Product Search Dialog

| # | Test Case | Steps | Expected Result | Severity |
|---|-----------|-------|-----------------|----------|
| 4.3.1 | Open search dialog | Click "Search Products" button | Dialog opens with search input, filters (Category, Size, Price range), results list | 🟠 |
| 4.3.2 | Search with debounce | Type "silk" in search | Results appear after ~500ms with matching products; no request per keystroke | 🟡 |
| 4.3.3 | Filter by category | Select a category from dropdown | Results filter to show only that category | 🟡 |
| 4.3.4 | Filter by size | Select a size from dropdown | Results filter to show only that size | 🟡 |
| 4.3.5 | Filter by price range | Enter min=500 and max=1000 | Only products in ₹500–₹1000 range shown | 🟡 |
| 4.3.6 | Add item from search results | Click "Add" button next to a product | Item added to cart; success toast; chime sound | 🟠 |
| 4.3.7 | Duplicate in cart — disabled button | Item already in cart, look at search results | "Add" button disabled + shows "Already in Cart" label for that item | 🟡 |
| 4.3.8 | Sale type badges | Look at items with sale_type set | "Sale" / "Festival" / "Promotion" badges visible on applicable items | 🟢 |
| 4.3.9 | Empty search results | Search for nonexistent term like "xyzabc123" | Empty state message: "No results found" or similar | 🟡 |
| 4.3.10 | Close dialog | Click X or click outside dialog | Dialog closes; cart retains any previously added items | 🟡 |

### 4.4 Cart Operations

| # | Test Case | Steps | Expected Result | Severity |
|---|-----------|-------|-----------------|----------|
| 4.4.1 | Item shows in cart | Add an item via scan or search | Cart list shows item with: QR code, category, size, price | 🔴 |
| 4.4.2 | Item count badge updates | Add 3 items | Header shows "3" in item count badge | 🟡 |
| 4.4.3 | Remove item from cart | Click remove/delete on a cart item | Item removed; undo toast appears: "Item removed. Undo?"; sound feedback | 🟠 |
| 4.4.4 | Undo remove | Click "Undo" on the remove toast | Item restored back to cart | 🟡 |
| 4.4.5 | Inline price editing | Click/edit price field on a cart item | Can change the final price per item | 🟠 |
| 4.4.6 | Discount reason | Enter text in discount reason field for an item | Text saved; visible in checkout summary | 🟡 |
| 4.4.7 | Clear entire cart | Click "Clear Cart" button | Confirmation dialog: "Are you sure? This will remove all X items."; confirm clears all items | 🟠 |
| 4.4.8 | Clear cart — cancel | Click "Clear Cart" → click Cancel in confirmation | Cart remains unchanged | 🟡 |
| 4.4.9 | Cart persistence (same session) | Add items, navigate to Settings, come back to POS | Cart items still present (sessionStorage) | 🟠 |
| 4.4.10 | Cart restore on page reload | Add items, close/refresh browser tab | Toast on reload: "Restore previous cart?" with option to restore | 🟡 |
| 4.4.11 | Cart summary calculation | Add multiple items with different prices | Subtotal, discount, tax, total calculated correctly | 🔴 |

### 4.5 Checkout Dialog

| # | Test Case | Steps | Expected Result | Severity |
|---|-----------|-------|-----------------|----------|
| 4.5.1 | Open checkout | Click "Checkout" with items in cart | CheckoutDialog opens with: items list, price summary, payment method selection, customer fields | 🔴 |
| 4.5.2 | Items listed correctly | Inspect items in checkout dialog | Each item shows: QR code, category, size, original price → final price | 🔴 |
| 4.5.3 | Price summary correct | Check subtotal, discount, tax, grand total | All amounts calculated correctly; grand total = subtotal - discount + tax | 🔴 |
| 4.5.4 | Payment method selection | Click Cash, then UPI, then Card | Each option highlights when selected; icons change (Banknote, Smartphone, CreditCard) | 🟠 |
| 4.5.5 | Customer name (optional) | Leave customer name empty | Checkout should still succeed | 🟡 |
| 4.5.6 | Customer phone (optional) | Enter a phone number | Phone saved with sale record | 🟡 |
| 4.5.7 | Complete sale — online | Click "Complete Sale" with network available | Button shows spinner + "Processing…"; button disabled; sale completes; success toast | 🔴 |
| 4.5.8 | Duplicate QR guard | Somehow have duplicate QR in cart | Error before submission: duplicate QR codes detected | 🟠 |
| 4.5.9 | Margin protection (festival sale) | Add festival item, lower price below min margin | Warning/error about margin violation before completing sale | 🟠 |
| 4.5.10 | Post-sale: Bill Preview shown | After successful sale | BillPreviewDialog automatically opens with receipt details | 🟠 |
| 4.5.11 | Post-sale: Cart cleared | After successful sale, close bill preview | Cart is empty; item count shows 0 | 🔴 |
| 4.5.12 | Cancel/close buttons disabled during processing | While "Processing…" is showing | Cancel and close (X) buttons are disabled; user cannot dismiss during sale | 🟠 |
| 4.5.13 | Complete sale — offline | Turn off network, then complete sale | Sale saved to IndexedDB as pending; success toast mentioning offline queue | 🔴 |

### 4.6 Bill Preview Dialog

| # | Test Case | Steps | Expected Result | Severity |
|---|-----------|-------|-----------------|----------|
| 4.6.1 | Bill shows shop details | Inspect bill header | Shop name, address, phone displayed | 🟡 |
| 4.6.2 | Bill number displayed | Check bill number on receipt | Format: `{prefix}-{number}` (e.g., "WOM-123") | 🟡 |
| 4.6.3 | Item details in bill | Check items section | Each item with QR code, category, size, original price, final price, discount | 🟡 |
| 4.6.4 | Print action | Click Print button | Browser print dialog opens with receipt formatted for printing | 🟠 |
| 4.6.5 | Download as PDF | Click Download button | PDF file downloads containing the bill receipt | 🟠 |
| 4.6.6 | Share action | Click Share button (if Web Share API supported) | Native share dialog opens | 🟡 |
| 4.6.7 | WhatsApp share | Click WhatsApp button | Opens WhatsApp with pre-formatted bill text | 🟡 |
| 4.6.8 | Sale type badges | Bill for items with sale types | Festival (green), Clearance (red), Promotion (blue) badges visible per item | 🟢 |

---

## 5. Inventory Management

### 5.1 Page Load (`/admin/inventory`)

| # | Test Case | Steps | Expected Result | Severity |
|---|-----------|-------|-----------------|----------|
| 5.1.1 | Page loads with stats + table | Navigate to `/admin/inventory` | Shows 4 stats cards (Total, Available, Sold, Damaged) + data table + filters | 🔴 |
| 5.1.2 | Loading skeleton shown | Observe page on initial load | Table shows skeleton/loading rows while data is fetching | 🟡 |
| 5.1.3 | Stats show accurate counts | Compare stats cards to table data | Counts match actual inventory data | 🟠 |

### 5.2 Stats Cards (Clickable Filters)

| # | Test Case | Steps | Expected Result | Severity |
|---|-----------|-------|-----------------|----------|
| 5.2.1 | Click "Available" stat | Click the Available stats card | Table filters to show only available items; card shows active/highlighted state | 🟠 |
| 5.2.2 | Click "Sold" stat | Click the Sold stats card | Table filters to show only sold items | 🟠 |
| 5.2.3 | Click "Damaged" stat | Click the Damaged stats card | Table filters to show only damaged items | 🟠 |
| 5.2.4 | Click "Total Items" stat | Click Total Items card | Clears status filter; shows all items | 🟠 |
| 5.2.5 | CountUp animation | Refresh page | All stat numbers animate from 0 to value | 🟢 |

### 5.3 Search & Filters

| # | Test Case | Steps | Expected Result | Severity |
|---|-----------|-------|-----------------|----------|
| 5.3.1 | Search by QR code | Type partial QR code in search box | Table filters to items matching the QR prefix | 🟠 |
| 5.3.2 | Search debounce | Type quickly in search box | No request fires per keystroke; waits for typing pause (~500ms) | 🟡 |
| 5.3.3 | Status filter dropdown | Select "damaged" from status dropdown | Table shows only damaged items | 🟠 |
| 5.3.4 | Category filter dropdown | Select a category | Table shows only items in that category | 🟡 |
| 5.3.5 | Sale type filter | Select "Festival" from sale type dropdown | Only festival items shown | 🟡 |
| 5.3.6 | Date range filter | Set a custom date range | Only items with stock arrival in that range shown | 🟡 |
| 5.3.7 | Filter chips displayed | Apply multiple filters | Active filter chips shown below filters with X to clear each | 🟡 |
| 5.3.8 | Clear individual filter | Click X on a filter chip | That filter cleared; other filters remain | 🟡 |
| 5.3.9 | URL sync — filters in URL | Apply filters, check browser URL | URL params include filter state (e.g., `?status=available&category=silk`) | 🟡 |
| 5.3.10 | URL sync — reload preserves | Apply filters, reload page | Same filters active after reload (read from URL) | 🟡 |
| 5.3.11 | URL sync — shareable | Copy URL with filters, open in new tab | Same filter state applied in new tab | 🟡 |
| 5.3.12 | Pagination resets on filter change | Go to page 3, then apply a filter | Page resets to 1 with new filter results | 🟡 |

### 5.4 Data Table

| # | Test Case | Steps | Expected Result | Severity |
|---|-----------|-------|-----------------|----------|
| 5.4.1 | Columns displayed | Check table headers | QR Code, Category, Size, Price, Status, Date, Actions columns visible | 🟠 |
| 5.4.2 | Sort by QR Code | Click QR Code column header | Rows sort alphabetically; click again reverses sort; arrow indicator shown | 🟡 |
| 5.4.3 | Sort by Price | Click Price column header | Rows sort by price ascending/descending | 🟡 |
| 5.4.4 | Sort by Status | Click Status column header | Rows sort by status | 🟡 |
| 5.4.5 | Sort by Date | Click Date column header | Rows sort by stock arrival date | 🟡 |
| 5.4.6 | Status badges color-coded | Look at Status column | Available (default), Sold (secondary/gray), Damaged (destructive/red) badges | 🟢 |
| 5.4.7 | QR Code clickable | Click a QR code in the table | Opens InventoryItemDetailsDialog with full item details | 🟡 |
| 5.4.8 | Empty state | Clear all items or apply impossible filter combination | Empty state illustration + message shown (not blank table) | 🟡 |
| 5.4.9 | Keyboard pagination | Press left/right arrow keys | Previous/next page navigated | 🟢 |

### 5.5 Pagination

| # | Test Case | Steps | Expected Result | Severity |
|---|-----------|-------|-----------------|----------|
| 5.5.1 | Pagination controls shown | Have >50 items | First / Prev / Next / Last buttons + page info + page size selector shown | 🟡 |
| 5.5.2 | Page info text | Check pagination area | "Showing X to Y of Z" text correctly displayed | 🟡 |
| 5.5.3 | Next page | Click Next button | Next page of results loaded; page info updates | 🟡 |
| 5.5.4 | Previous page | Click Prev button (when not on page 1) | Previous page loaded | 🟡 |
| 5.5.5 | First / Last page | Click First/Last buttons | Navigates to first/last page respectively | 🟡 |
| 5.5.6 | Boundary — first page | On page 1, check First and Prev buttons | Both disabled (cannot go before page 1) | 🟡 |
| 5.5.7 | Boundary — last page | On last page, check Next and Last buttons | Both disabled | 🟡 |
| 5.5.8 | Change page size | Select "25" from page size dropdown (default 50) | Results reload with 25 per page; page resets to 1; more pages available | 🟡 |
| 5.5.9 | No pagination when empty | Apply filter that returns 0 results | Pagination controls hidden | 🟢 |

### 5.6 Row Actions

| # | Test Case | Steps | Expected Result | Severity |
|---|-----------|-------|-----------------|----------|
| 5.6.1 | Actions dropdown opens | Click actions (⋮) button on a row | Dropdown shows: View Details, Edit Item, Edit Lot, Lot History, Add to Cart, Delete | 🟠 |
| 5.6.2 | View Details | Click "View Details" | InventoryItemDetailsDialog opens with full read-only info | 🟡 |
| 5.6.3 | Edit Item — open dialog | Click "Edit Item" | EditInventoryItemDialog opens with status, selling price, cost price, tax rate fields | 🟠 |
| 5.6.4 | Edit Item — change status | Change status from "available" to "damaged", enter reason, save | Button shows spinner + "Saving…"; status updates in table after save; success toast | 🟠 |
| 5.6.4a | Edit Item — change price | Change selling price for an available item, save | Item price updates; selling price column reflects new price; success toast | 🟠 |
| 5.6.4b | Edit Item — sold item prices read-only | Open edit for a sold item | Price fields are disabled (sold items retain price at time of sale) | 🟠 |
| 5.6.5 | Edit Item — save disabled when no changes | Open edit dialog, don't change anything | Save button is disabled (no unnecessary saves) | 🟡 |
| 5.6.6 | Edit Item — reason required for damaged | Select "damaged" but leave reason empty | Cannot save; error shown that reason is required | 🟠 |
| 5.6.7 | Edit Lot — open dialog | Click "Edit Lot" | EditLotDialog opens with lot fields pre-populated | 🟠 |
| 5.6.8 | Edit Lot — change price | Change selling price, save | Lot template updated AND all available items' prices bulk-updated; success toast | 🟠 |
| 5.6.8a | Edit Lot — sold items unchanged | Edit lot price when lot has sold items | Sold items retain their original price; only available items get new price | 🟠 |
| 5.6.9 | Edit Lot — profit margin display | Change cost or selling price | Live profit margin percentage shown and recalculated | 🟡 |
| 5.6.10 | Edit Lot — sold items warning | Edit a lot that has sold items | Warning message: "Some items already sold" | 🟡 |
| 5.6.11 | Edit Lot — validation | Remove category (required), try to save | Error on category field; cannot save | 🟡 |
| 5.6.12 | Lot History | Click "Lot History" | Sheet slides in from right showing all items in the same lot | 🟡 |
| 5.6.13 | Lot History — sheet width | Check sheet size on mobile | `w-[calc(100%-2.5rem)]` on mobile, `sm:max-w-lg` on desktop | 🟢 |
| 5.6.14 | Add to Cart — available item | Click "Add to Cart" for available item | Navigates to POS with item added to cart | 🟡 |
| 5.6.15 | Add to Cart — not shown for sold | Check actions for a sold item | "Add to Cart" option is hidden or disabled | 🟡 |
| 5.6.16 | Delete item | Click "Delete" | Item removed from table; undo toast with 5-second window | 🟠 |
| 5.6.17 | Delete — undo | Click "Undo" on delete toast within 5 seconds | Item restored in table | 🟡 |

### 5.7 CSV Export

| # | Test Case | Steps | Expected Result | Severity |
|---|-----------|-------|-----------------|----------|
| 5.7.1 | Export button visible | Check page header area | Export/Download CSV button present | 🟡 |
| 5.7.2 | Export filtered data | Apply filters, click Export | Downloaded CSV contains only filtered results | 🟠 |
| 5.7.3 | Export loading state | Click Export with many rows | Button shows loading state during export | 🟡 |

---

## 6. Add Stock Lot

### 6.1 Page Load (`/admin/inventory/add-lot`)

| # | Test Case | Steps | Expected Result | Severity |
|---|-----------|-------|-----------------|----------|
| 6.1.1 | Form loads with all fields | Navigate to add-lot page | Form shows: QR Prefix, Category, Size, Vendor, Date, Quantity, Cost Price, Selling Price, Tax Rate, Sale Type, Min Margin, Sale Reason | 🔴 |
| 6.1.2 | Default values | Check field defaults | Stock Arrival Date = today; other fields empty/unselected | 🟡 |

### 6.2 Field Behavior

| # | Test Case | Steps | Expected Result | Severity |
|---|-----------|-------|-----------------|----------|
| 6.2.1 | QR Prefix — searchable combobox | Click QR Prefix field | Dropdown opens with search; shows existing prefixes; each shows available QR count | 🟠 |
| 6.2.2 | QR Prefix — available count | Select a prefix | Available QR code count shown for that prefix | 🟠 |
| 6.2.3 | Category — dropdown | Click Category field | Dropdown shows shop's categories | 🟠 |
| 6.2.4 | Size — dropdown + free text | Click Size field | Dropdown of predefined sizes + option to enter free text size | 🟡 |
| 6.2.5 | Vendor Name — autocomplete | Start typing vendor name | Suggestions from existing vendor names appear | 🟡 |
| 6.2.6 | Quantity — exceeds available QR | Enter quantity > available QR codes for selected prefix | Error: not enough QR codes available | 🟠 |
| 6.2.7 | Live profit margin | Enter cost=100, selling=150 | Profit margin shows 50% (calculated live) | 🟡 |
| 6.2.8 | Profit margin updates | Change selling to 200 | Profit margin updates to 100% | 🟡 |

### 6.3 Validation (Zod Schema)

| # | Test Case | Steps | Expected Result | Severity |
|---|-----------|-------|-----------------|----------|
| 6.3.1 | Required: QR Prefix | Submit without selecting QR Prefix | Inline error: QR Prefix is required | 🟠 |
| 6.3.2 | Required: Category | Submit without selecting Category | Inline error: Category is required | 🟠 |
| 6.3.3 | Required: Quantity >= 1 | Enter 0 or negative number | Inline error: must be at least 1 and integer | 🟠 |
| 6.3.4 | Required: Cost Price positive | Enter 0 or negative | Inline error: must be positive | 🟠 |
| 6.3.5 | Selling > Cost refinement | Enter cost=200, selling=100 | Inline error: selling price must be higher than cost | 🟠 |
| 6.3.6 | Tax Rate range | Enter 101 or -1 | Inline error: must be 0–100 | 🟡 |
| 6.3.7 | Multiple errors at once | Submit completely empty form | All required fields show inline errors simultaneously | 🟠 |
| 6.3.8 | Errors clear on correction | Fix a field that had an error | Error for that specific field clears | 🟡 |

### 6.4 Submit & Success

| # | Test Case | Steps | Expected Result | Severity |
|---|-----------|-------|-----------------|----------|
| 6.4.1 | Preview before submit | Fill all fields, check preview | Summary card shows all entered values + calculated fields | 🟡 |
| 6.4.2 | Successful submission | Fill valid data, submit | Button shows spinner; calls Edge Function `add-stock-lot`; success toast; redirects to inventory page | 🔴 |
| 6.4.3 | Form disabled during submit | While submitting | All fields and submit button disabled; cannot change values or double-submit | 🟠 |
| 6.4.4 | New items appear in inventory | After successful add, check inventory | New items visible with correct QR codes, category, size, price | 🔴 |
| 6.4.5 | API error handling | Simulate server error | Toast error with message; form fields retained (not cleared) so user can retry | 🟠 |

---

## 7. Sales Hub

### 7.1 Page Load (`/admin/sales`)

| # | Test Case | Steps | Expected Result | Severity |
|---|-----------|-------|-----------------|----------|
| 7.1.1 | Page loads with 3 tabs | Navigate to `/admin/sales` | Tabs: Transactions, Analytics, Vendors visible | 🔴 |
| 7.1.2 | Transactions tab active by default | Check initial tab | Transactions tab selected; shows stats + table | 🟠 |

### 7.2 Transactions Tab — Stats

| # | Test Case | Steps | Expected Result | Severity |
|---|-----------|-------|-----------------|----------|
| 7.2.1 | Total Bills stat | Check stat | Correct count of sales in current filter period | 🟠 |
| 7.2.2 | Revenue stat | Check stat | Correct sum of total_amount | 🟠 |
| 7.2.3 | Discount stat | Check stat | Correct sum of total_discount | 🟡 |
| 7.2.4 | Avg Bill stat | Check stat | Revenue / Total Bills — correct calculation | 🟡 |

### 7.3 Transactions Tab — Filters

| # | Test Case | Steps | Expected Result | Severity |
|---|-----------|-------|-----------------|----------|
| 7.3.1 | Search by bill number | Type bill number in search | Matching transactions shown | 🟠 |
| 7.3.2 | Search by customer name | Type customer name | Matching transactions shown | 🟡 |
| 7.3.3 | Search by phone | Type customer phone | Matching transactions shown | 🟡 |
| 7.3.4 | Sale type filter | Select "Festival" | Only festival sales shown | 🟡 |
| 7.3.5 | Date range filter | Set custom date range | Only sales in that range shown | 🟡 |
| 7.3.6 | URL sync filters | Apply filters, check URL | URL contains filter params | 🟡 |

### 7.4 Transactions Tab — Table

| # | Test Case | Steps | Expected Result | Severity |
|---|-----------|-------|-----------------|----------|
| 7.4.1 | Columns shown correctly | Check table headers | Bill #, Customer, Items, Amount, Discount, Payment, Date, Actions | 🟠 |
| 7.4.2 | Sort by Bill # | Click Bill # header | Rows sort by bill number | 🟡 |
| 7.4.3 | Sort by Amount | Click Amount header | Rows sort by sale amount | 🟡 |
| 7.4.4 | Sort by Date | Click Date header | Rows sort by sale date | 🟡 |
| 7.4.5 | Payment badge | Check Payment column | Cash/UPI/Card shown as badge | 🟢 |
| 7.4.6 | View Bill action | Click "View Bill" in actions | BillPreviewDialog opens with full receipt | 🟠 |
| 7.4.7 | Server-side pagination | Have >50 sales | Pagination controls shown; clicking Next loads new data from server | 🟡 |

### 7.5 Transactions — CSV Export

| # | Test Case | Steps | Expected Result | Severity |
|---|-----------|-------|-----------------|----------|
| 7.5.1 | Export button exists | Check page | Export/CSV button visible | 🟡 |
| 7.5.2 | Export filtered data | Apply filter, export | CSV contains only filtered results | 🟠 |
| 7.5.3 | Large export warning | Export >10,000 rows | Warning dialog: "Large export may take a while" | 🟡 |
| 7.5.4 | Export loading state | Click export | Button shows loading spinner during generation | 🟡 |

### 7.6 Analytics Tab

| # | Test Case | Steps | Expected Result | Severity |
|---|-----------|-------|-----------------|----------|
| 7.6.1 | Tab switch | Click "Analytics" tab | Analytics view loads with sub-components | 🟡 |
| 7.6.2 | Sale type analysis | Check sale type section | Breakdown by type: Regular, Festival, Clearance, Promotion with counts + revenue | 🟡 |
| 7.6.3 | Category performance | Check category section | Revenue and count per product category | 🟡 |
| 7.6.4 | Staff performance | Check staff section | Per-staff sales metrics | 🟡 |
| 7.6.5 | Deep-link to Festival report | Click festival detail link | Navigates to `/admin/reports/festival` | 🟡 |
| 7.6.6 | Deep-link to Clearance report | Click clearance detail link | Navigates to `/admin/reports/clearance` | 🟡 |
| 7.6.7 | Deep-link to Promotion report | Click promotion detail link | Navigates to `/admin/reports/promotion` | 🟡 |

### 7.7 Vendors Tab

| # | Test Case | Steps | Expected Result | Severity |
|---|-----------|-------|-----------------|----------|
| 7.7.1 | Tab switch | Click "Vendors" tab | Vendor performance analytics shown | 🟡 |
| 7.7.2 | Vendor data displayed | Check vendor metrics | Per-vendor sales data: count, revenue, etc. | 🟡 |

---

## 8. Returns Management

### 8.1 Page Load (`/admin/returns`)

| # | Test Case | Steps | Expected Result | Severity |
|---|-----------|-------|-----------------|----------|
| 8.1.1 | Page loads with stats + history | Navigate to `/admin/returns` | Stats cards (Total Returns, Refunded, Items Returned, Avg Refund) + returns table | 🔴 |
| 8.1.2 | "Process Return" button visible | Check page header | Button to initiate a return process is visible | 🟠 |

### 8.2 Process Return Dialog

| # | Test Case | Steps | Expected Result | Severity |
|---|-----------|-------|-----------------|----------|
| 8.2.1 | Open dialog | Click "Process Return" | Multi-step dialog opens at Step 1: Search Bill | 🟠 |
| 8.2.2 | Step 1: Search bill number | Enter a valid bill number | Matching sale found and displayed | 🟠 |
| 8.2.3 | Step 1: Enter key triggers search | Type bill number, press Enter | Search triggered (same as clicking search button) | 🟡 |
| 8.2.4 | Step 1: Invalid bill number | Enter non-existent bill number | Error: no sale found with that bill number | 🟡 |
| 8.2.5 | Step 2: Select sale | Sale found, move to step 2 | Sale details shown with list of items | 🟠 |
| 8.2.6 | Step 3: Select items | Check items to return | Checkboxes for each item; only non-returned items selectable | 🟠 |
| 8.2.7 | Step 3: Already-returned items | Some items already returned | Those items' checkboxes disabled with "Already Returned" indicator | 🟡 |
| 8.2.8 | Step 4: Enter return reason | Enter text in reason field | Text captured; required field | 🟠 |
| 8.2.9 | Step 4: Enter refund amount | Enter refund amount | Amount captured; validated: must be ≤ sum of selected items' prices | 🟠 |
| 8.2.10 | Step 4: Refund exceeds max | Enter amount higher than total of selected items | Error: refund cannot exceed item total | 🟠 |
| 8.2.11 | Step 5: Submit return | Confirm return | Button shows spinner; return record created; inventory items set back to "available"; success toast | 🔴 |
| 8.2.12 | Validation: No items selected | Try to proceed without selecting any items | Error: at least one item must be selected | 🟠 |
| 8.2.13 | Validation: Empty reason | Try to submit without entering reason | Error: reason is required | 🟡 |
| 8.2.14 | Post-return: Items available again | After return, check inventory for returned items | Items status changed to "available" | 🔴 |

### 8.3 Returns History Table

| # | Test Case | Steps | Expected Result | Severity |
|---|-----------|-------|-----------------|----------|
| 8.3.1 | Table columns | Check table | Return ID, Bill #, Items, Refund Amount, Reason, Date, Actions | 🟡 |
| 8.3.2 | Date filter | Apply date range | Only returns in that range shown | 🟡 |
| 8.3.3 | Pagination | Have >50 returns | Pagination controls shown and functional | 🟡 |
| 8.3.4 | CSV Export | Click export | Returns data downloaded as CSV | 🟡 |
| 8.3.5 | View return details | Click view action | Dialog shows full return details with item list | 🟡 |
| 8.3.6 | WhatsApp receipt | Click WhatsApp action | Opens WhatsApp with formatted return receipt | 🟡 |
| 8.3.7 | View original bill | Click "View Bill" action | BillPreviewDialog opens for the original sale | 🟡 |

---

## 9. QR Code Management

### 9.1 Page Load (`/admin/qr-codes`)

| # | Test Case | Steps | Expected Result | Severity |
|---|-----------|-------|-----------------|----------|
| 9.1.1 | Page loads correctly | Navigate to `/admin/qr-codes` | Stats cards, generate section, QR codes table, filters | 🔴 |
| 9.1.2 | Stats: Total, Available, Assigned, Lost | Check stat cards | Counts match actual QR code data | 🟠 |

### 9.2 Generate QR Codes

| # | Test Case | Steps | Expected Result | Severity |
|---|-----------|-------|-----------------|----------|
| 9.2.1 | Prefix selector | Click prefix dropdown | Searchable combobox shows existing prefixes | 🟠 |
| 9.2.2 | Quantity input | Enter quantity | Number input accepts positive integers | 🟡 |
| 9.2.3 | Generate — small batch | Select prefix, enter qty=10, click Generate | Loading state on button; QR codes generated; success toast; table updates | 🔴 |
| 9.2.4 | Generate — large batch (>500) | Enter qty=600 | Batch generation mode with progress indicator | 🟡 |
| 9.2.5 | Button disabled during generation | While generating | Generate button disabled + spinner shown | 🟡 |

### 9.3 Filters & Search

| # | Test Case | Steps | Expected Result | Severity |
|---|-----------|-------|-----------------|----------|
| 9.3.1 | Search by QR code | Type QR code text | Matching codes shown | 🟠 |
| 9.3.2 | Status filter | Select "available" | Only available codes shown | 🟡 |
| 9.3.3 | Prefix filter | Select a specific prefix | Only codes with that prefix shown | 🟡 |
| 9.3.4 | Date range filter | Set custom date range | Only codes created in range shown | 🟡 |
| 9.3.5 | Filters URL-synced | Apply filters, check URL | URL includes filter params | 🟡 |

### 9.4 Table & Actions

| # | Test Case | Steps | Expected Result | Severity |
|---|-----------|-------|-----------------|----------|
| 9.4.1 | Columns displayed | Check table headers | Code, Prefix, Status, Created, Actions | 🟡 |
| 9.4.2 | Status badges | Check Status column | Available (green), Assigned (blue), Used (gray), Lost (red) | 🟢 |
| 9.4.3 | Sort by Code | Click Code header | Codes sort alphabetically | 🟡 |
| 9.4.4 | Sort by Created | Click Created header | Codes sort by creation date | 🟡 |
| 9.4.5 | View Details | Click "View Details" on a code | Details dialog: code, status, created date; if assigned: item details | 🟡 |
| 9.4.6 | Mark as Lost | Click "Mark as Lost" | Status changes to "lost"; success toast | 🟠 |
| 9.4.7 | Delete single code | Click Delete with confirmation | Code deleted; table updates | 🟠 |
| 9.4.8 | Bulk select checkboxes | Click checkboxes on multiple rows | Selected rows highlighted; bulk actions become available | 🟡 |
| 9.4.9 | Bulk delete selected | Select multiple codes, click "Delete Selected" | Confirmation; all selected codes deleted | 🟠 |
| 9.4.10 | CSV Export | Click export | Filtered QR codes downloaded as CSV | 🟡 |

### 9.5 QR Code Download Dialog

| # | Test Case | Steps | Expected Result | Severity |
|---|-----------|-------|-----------------|----------|
| 9.5.1 | Open download dialog | Click Download on a QR code or selection | Download dialog opens with format options | 🟡 |
| 9.5.2 | PDF output option | Select PDF format | Paper size (A3/A4/A5/Letter), codes per row, QR size, margins options appear | 🟡 |
| 9.5.3 | ZIP output option | Select ZIP format | Resolution options appear: Standard/High/Ultra HD | 🟡 |
| 9.5.4 | QR styling options | Change dot style, color preset | Live QR preview updates in real-time | 🟡 |
| 9.5.5 | Download PDF | Configure and click download | PDF file generated and downloaded with QR codes in grid layout | 🟠 |
| 9.5.6 | Download ZIP | Configure and click download | ZIP file downloaded with individual QR images | 🟠 |
| 9.5.7 | Progress bar for large batches | Download 50+ QR codes | Progress bar visible during generation | 🟡 |
| 9.5.8 | Button disabled during download | While processing | Download button disabled with spinner | 🟡 |

---

## 10. Finances / Expense Tracking

### 10.1 Page Load (`/admin/finances`)

| # | Test Case | Steps | Expected Result | Severity |
|---|-----------|-------|-----------------|----------|
| 10.1.1 | Page loads with stats + expense table | Navigate to `/admin/finances` | 6 stats cards (Revenue, Expenses, Net Profit, Sales Count, Avg Sale, Inventory Value) + expense list | 🔴 |
| 10.1.2 | Stats accuracy | Compare stats to known data | Revenue, Expenses, Profit calculated correctly | 🟠 |

### 10.2 Add Expense

| # | Test Case | Steps | Expected Result | Severity |
|---|-----------|-------|-----------------|----------|
| 10.2.1 | Open Add Expense dialog | Click "Add Expense" button | Dialog opens with: Amount, Description, Category, Date fields | 🟠 |
| 10.2.2 | Amount required | Submit with empty amount | Inline error: amount is required | 🟠 |
| 10.2.3 | Amount must be positive | Enter 0 or negative | Error: must be positive | 🟡 |
| 10.2.4 | Date defaults to today | Open add dialog | Date field pre-filled with today's date | 🟡 |
| 10.2.5 | Category — select existing | Select from dropdown | Category assigned | 🟡 |
| 10.2.6 | Category — create new inline | Click "Create new" option, enter new name | New category created and assigned to expense | 🟡 |
| 10.2.7 | Enter key on new category input | Type new category name, press Enter | Category created (Enter triggers add) | 🟡 |
| 10.2.8 | Successful add | Fill valid data, submit | Button shows spinner + "Saving…"; expense added to table; success toast; dialog closes; fields cleared | 🔴 |
| 10.2.9 | Stats update after add | Add an expense | Expenses stat and Net Profit stat update to reflect new expense | 🟠 |

### 10.3 Edit Expense

| # | Test Case | Steps | Expected Result | Severity |
|---|-----------|-------|-----------------|----------|
| 10.3.1 | Open Edit dialog | Click Edit on an expense row | Dialog opens with fields pre-populated with existing values | 🟠 |
| 10.3.2 | Change amount and save | Change amount, click Save | Button shows spinner; expense updated in table; success toast | 🟠 |
| 10.3.3 | No changes — behavior | Open edit, don't change, close | No unnecessary save; dialog closes cleanly | 🟡 |

### 10.4 Delete Expense

| # | Test Case | Steps | Expected Result | Severity |
|---|-----------|-------|-----------------|----------|
| 10.4.1 | Delete with undo | Click Delete on an expense | Expense removed from table immediately; undo toast appears for 5 seconds | 🟠 |
| 10.4.2 | Undo delete | Click "Undo" within 5 seconds | Expense restored in table | 🟡 |
| 10.4.3 | Delete after undo window | Don't click Undo, wait 5 seconds | Expense permanently deleted | 🟡 |

### 10.5 Filters & Table

| # | Test Case | Steps | Expected Result | Severity |
|---|-----------|-------|-----------------|----------|
| 10.5.1 | Search by description | Type in search box | Expenses filtered by description text | 🟡 |
| 10.5.2 | Category filter | Select expense category | Only that category's expenses shown | 🟡 |
| 10.5.3 | Date range filter | Set custom range | Only expenses in range | 🟡 |
| 10.5.4 | Sort by Amount | Click Amount header | Sort ascending/descending | 🟡 |
| 10.5.5 | Sort by Date | Click Date header | Sort ascending/descending | 🟡 |
| 10.5.6 | Category breakdown | Check breakdown section | Chart/list showing expense totals per category | 🟡 |
| 10.5.7 | CSV Export | Click export | Filtered expenses downloaded as CSV | 🟡 |
| 10.5.8 | Pagination | Have >50 expenses | Pagination working correctly | 🟡 |

---

## 11. Staff Management

### 11.1 Page Load (`/admin/staff`)

| # | Test Case | Steps | Expected Result | Severity |
|---|-----------|-------|-----------------|----------|
| 11.1.1 | Page loads with stats + table | Navigate to `/admin/staff` | 4 stats cards (Total, Active, Admins, Staff) + staff table | 🔴 |
| 11.1.2 | Default filter is "All" | Check initial state | No status filter active; "All" tab/card highlighted; all staff shown | 🟠 |

### 11.2 Stats Cards (Clickable Filters)

| # | Test Case | Steps | Expected Result | Severity |
|---|-----------|-------|-----------------|----------|
| 11.2.1 | Click "Active" stat | Click Active card | Table filters to active staff only; card highlighted | 🟡 |
| 11.2.2 | Click "Admins" stat | Click Admins card | Table shows only admin-role members | 🟡 |
| 11.2.3 | Click "Staff" stat | Click Staff card | Table shows only staff-role members | 🟡 |
| 11.2.4 | Click "Total" stat | Click Total card | Clears filters; shows all staff | 🟡 |

### 11.3 Search & Filters

| # | Test Case | Steps | Expected Result | Severity |
|---|-----------|-------|-----------------|----------|
| 11.3.1 | Search by name | Type staff name | Matching staff members shown | 🟡 |
| 11.3.2 | Search by phone | Type phone number | Matching staff shown | 🟡 |
| 11.3.3 | Status filter dropdown | Select "inactive" | Only inactive staff shown | 🟡 |
| 11.3.4 | Role filter dropdown | Select "admin" | Only admins shown | 🟡 |

### 11.4 Staff Table

| # | Test Case | Steps | Expected Result | Severity |
|---|-----------|-------|-----------------|----------|
| 11.4.1 | Columns displayed | Check headers | Name, Phone, Role, Status, Max Discount, Actions | 🟡 |
| 11.4.2 | Sort by Name | Click Name header | Staff sorted alphabetically | 🟡 |
| 11.4.3 | Role badges | Check Role column | Owner/admin/staff shown as color-coded badges | 🟢 |
| 11.4.4 | Status badges | Check Status column | Active (green) / Inactive (red) badges | 🟢 |
| 11.4.5 | Empty state | Apply filter returning 0 | "No staff members found" empty state shown | 🟡 |

### 11.5 Edit Staff

| # | Test Case | Steps | Expected Result | Severity |
|---|-----------|-------|-----------------|----------|
| 11.5.1 | Open Edit dialog | Click Edit on a staff member | Dialog opens with: Full Name, Phone, Role, Max Discount fields pre-populated | 🟠 |
| 11.5.2 | Edit name and save | Change name, click Save | Spinner on save button; name updates in table; success toast | 🟠 |
| 11.5.3 | Change role | Change from "staff" to "admin" | Role updates; staff member now has admin access | 🟠 |
| 11.5.4 | Owner role locked | Open edit for owner | Role field disabled/locked (cannot change owner role) | 🟡 |
| 11.5.5 | Max discount update | Change max discount %, save | Value updates; affects POS discount limits for that staff | 🟠 |

### 11.6 Activate/Deactivate Staff

| # | Test Case | Steps | Expected Result | Severity |
|---|-----------|-------|-----------------|----------|
| 11.6.1 | Deactivate staff | Click Deactivate on active staff member | ConfirmDialog appears with destructive styling; confirm → status changes to Inactive; success toast | 🟠 |
| 11.6.2 | Activate staff | Click Activate on inactive staff member | ConfirmDialog appears; confirm → status changes to Active; success toast | 🟠 |
| 11.6.3 | Deactivated staff cannot login | Deactivate a staff, try logging in as them | Login fails or access denied | 🔴 |

### 11.7 User Management (Superadmin/Owner Only)

| # | Test Case | Steps | Expected Result | Severity |
|---|-----------|-------|-----------------|----------|
| 11.7.1 | Visibility — superadmin | Login as superadmin | User Management section visible with cross-shop user list | 🔴 |
| 11.7.2 | Visibility — owner | Login as owner | User Management visible for own shop users only | 🟠 |
| 11.7.3 | Visibility — admin | Login as admin | User Management section NOT visible | 🔴 |
| 11.7.4 | Create User — open dialog | Click "Create User" | Dialog with: Email, Password (show/hide), Full Name, Phone, Role, Shop (superadmin only), Max Discount | 🟠 |
| 11.7.5 | Create User — email required | Submit without email | Inline error | 🟠 |
| 11.7.6 | Create User — password required | Submit without password | Inline error | 🟠 |
| 11.7.7 | Create User — successful | Fill all required fields, submit | Spinner on button; user created; success toast; form fields cleared; user appears in list | 🔴 |
| 11.7.8 | Create User — form clears on success | After successful creation | Email, password, name, phone fields all reset to empty | 🟡 |
| 11.7.9 | Copy credentials | After creating user, click copy button | Email + password copied to clipboard; toast confirmation | 🟡 |
| 11.7.10 | Reset Password | Click "Reset Password" on a user | Dialog opens; enter new password; submit → spinner; success toast | 🟠 |
| 11.7.11 | Toggle user active status | Click activate/deactivate on a user | Confirmation dialog; status toggles; success toast | 🟠 |
| 11.7.12 | User list shows relevant info | Check user cards | Each card: name, email, role badge, shop, active status, must_change_password flag | 🟡 |

---

## 12. Staff Performance Analytics

### 12.1 Page Load (`/admin/staff-performance`)

| # | Test Case | Steps | Expected Result | Severity |
|---|-----------|-------|-----------------|----------|
| 12.1.1 | Page loads with date filter | Navigate to page | Date range selector + performance analytics shown | 🟠 |
| 12.1.2 | Per-staff metrics | Check analytics | Each staff member shows: sales count, revenue, average bill, items sold | 🟡 |
| 12.1.3 | Date filter changes data | Change date range | Metrics update to reflect selected period | 🟡 |
| 12.1.4 | Loading state | Apply new date filter | Loading indicator while fetching new data | 🟡 |

---

## 13. Attendance Management

### 13.1 Page Load (`/admin/attendance`)

| # | Test Case | Steps | Expected Result | Severity |
|---|-----------|-------|-----------------|----------|
| 13.1.1 | Page loads with 2 tabs | Navigate to `/admin/attendance` | Calendar and Logs tabs visible | 🔴 |
| 13.1.2 | Calendar tab shows attendance | Click Calendar tab | Per-staff attendance calendar view displayed | 🟡 |
| 13.1.3 | Logs tab shows table | Click Logs tab | Attendance log table with CRUD capabilities | 🟡 |

### 13.2 Logs — Table

| # | Test Case | Steps | Expected Result | Severity |
|---|-----------|-------|-----------------|----------|
| 13.2.1 | Columns displayed | Check Logs tab table | Date, Staff, Clock In, Clock Out, Status, Hours, Actions | 🟡 |
| 13.2.2 | Sort by Date | Click Date header | Logs sort by date | 🟡 |
| 13.2.3 | Status badges | Check Status column | In Progress (yellow), Manual (blue), Edited (purple) badges | 🟢 |
| 13.2.4 | Hours calculation | Check Hours column | Shows calculated working hours (clock out - clock in - breaks) | 🟠 |
| 13.2.5 | Open session shows "—" | Check Clock Out for active session | Shows "—" instead of time (not clocked out yet) | 🟢 |

### 13.3 Logs — Filters

| # | Test Case | Steps | Expected Result | Severity |
|---|-----------|-------|-----------------|----------|
| 13.3.1 | Search by staff name | Type name in search | Matching logs shown | 🟡 |
| 13.3.2 | Staff filter dropdown | Select specific staff member | Only that member's logs shown | 🟡 |
| 13.3.3 | Status filter | Select "manual" | Only manual entries shown | 🟡 |
| 13.3.4 | Date range filter | Set custom range | Only logs in that range shown | 🟡 |

### 13.4 Create Attendance

| # | Test Case | Steps | Expected Result | Severity |
|---|-----------|-------|-----------------|----------|
| 13.4.1 | Open Create dialog | Click "Add Attendance" or similar | Dialog opens with: Staff (select), Date, Clock In, Clock Out, Break Minutes, Reason fields | 🟠 |
| 13.4.2 | Staff required | Submit without selecting staff | Error: staff is required | 🟠 |
| 13.4.3 | Date defaults to today (IST) | Check date field default | Today's date in IST timezone | 🟡 |
| 13.4.4 | Clock In defaults to 09:00 | Check clock in default | Pre-filled with 09:00 | 🟡 |
| 13.4.5 | Clock Out optional | Submit without clock out | Should succeed (open session) | 🟡 |
| 13.4.6 | Clock Out must be after Clock In | Set clock out before clock in | Error: must be after clock in | 🟠 |
| 13.4.7 | Reason required | Submit without reason | Error: reason is required (audit trail) | 🟠 |
| 13.4.8 | Duplicate day check | Create for same staff + same date | Error: attendance already exists for that date | 🟠 |
| 13.4.9 | Successful create | Fill valid data, submit | Spinner on button; attendance log created; success toast; dialog closes; table updates | 🔴 |
| 13.4.10 | Form resets on close | Open dialog, type in fields, close (cancel), reopen | Fields reset to defaults (not stale data from previous interaction) | 🟡 |

### 13.5 Edit Attendance

| # | Test Case | Steps | Expected Result | Severity |
|---|-----------|-------|-----------------|----------|
| 13.5.1 | Open Edit dialog | Click Edit on a log entry | Dialog opens with fields pre-populated | 🟠 |
| 13.5.2 | Edit reason required | Change a field, leave edit reason empty | Error: edit reason is required (audit trail) | 🟠 |
| 13.5.3 | Successful edit | Change break minutes, enter reason, save | Spinner; log updates with new values; edits fields set (`edited_at`, `edited_by`, `edit_reason`) | 🟠 |
| 13.5.4 | Edited badge appears | After editing | Status shows "Edited" (purple) badge | 🟡 |

### 13.6 Delete Attendance

| # | Test Case | Steps | Expected Result | Severity |
|---|-----------|-------|-----------------|----------|
| 13.6.1 | Delete confirmation | Click Delete on a log | Confirmation dialog showing staff name and date | 🟠 |
| 13.6.2 | Confirm delete | Click confirm | Soft delete (sets `deleted_at`, `deleted_by`); row removed from table; success toast | 🟠 |
| 13.6.3 | Cancel delete | Click cancel in confirmation | No changes; dialog closes | 🟡 |

### 13.7 Bulk Entry

| # | Test Case | Steps | Expected Result | Severity |
|---|-----------|-------|-----------------|----------|
| 13.7.1 | Open Bulk Entry dialog | Click "Bulk Entry" button | Dialog opens with staff checkboxes + shared time fields | 🟠 |
| 13.7.2 | Select multiple staff | Check 3 staff members | All 3 checkboxes checked | 🟡 |
| 13.7.3 | Submit bulk | Enter times, reason, submit | Attendance created for all selected staff; success toast | 🟠 |
| 13.7.4 | Skip duplicates | Some selected staff already have attendance for date | Those are skipped with appropriate message; non-duplicates created | 🟡 |

### 13.8 Export & Pagination

| # | Test Case | Steps | Expected Result | Severity |
|---|-----------|-------|-----------------|----------|
| 13.8.1 | CSV Export | Click export | Filtered attendance logs exported as CSV | 🟡 |
| 13.8.2 | Pagination | Have >50 logs | Pagination controls working | 🟡 |

---

## 14. Checklists / Task Management

### 14.1 Page Load (`/admin/checklists`)

| # | Test Case | Steps | Expected Result | Severity |
|---|-----------|-------|-----------------|----------|
| 14.1.1 | Page loads | Navigate to `/admin/checklists` | Template list + create button visible | 🔴 |

### 14.2 Template Management

| # | Test Case | Steps | Expected Result | Severity |
|---|-----------|-------|-----------------|----------|
| 14.2.1 | Create template — open dialog | Click "Create Checklist" | Dialog with: Title, Items (dynamic list), Recurrence Type, Recurrence Days | 🟠 |
| 14.2.2 | Title required | Submit without title | Error: title required | 🟠 |
| 14.2.3 | Add items | Type item name, press Enter or click Add | Item added to list | 🟠 |
| 14.2.4 | Remove item | Click X/remove on an item | Item removed from list | 🟡 |
| 14.2.5 | Drag-and-drop reorder | Drag an item to new position using grip handle | Item moves to new position; order saved | 🟡 |
| 14.2.6 | Up/Down arrow reorder | Click up/down arrows on an item | Item moves up/down in list (accessibility alternative) | 🟡 |
| 14.2.7 | Recurrence — Daily | Select "Daily" | Template will generate instances every day | 🟠 |
| 14.2.8 | Recurrence — Weekly | Select "Weekly" | Day selection checkboxes appear (Mon–Sun) | 🟠 |
| 14.2.9 | Recurrence — Once | Select "Once" | Template generates single instance | 🟡 |
| 14.2.10 | Successful create | Fill title + items + recurrence, submit | Spinner; template created; success toast; appears in list | 🔴 |
| 14.2.11 | Form resets on close | Fill fields, cancel, reopen | Fields are reset (not showing previous stale data) | 🟡 |

### 14.3 Template Actions

| # | Test Case | Steps | Expected Result | Severity |
|---|-----------|-------|-----------------|----------|
| 14.3.1 | Edit template | Click Edit on template | Dialog opens pre-populated; can change title, items, recurrence | 🟠 |
| 14.3.2 | Save edit | Make changes, save | Spinner; template updated; success toast | 🟠 |
| 14.3.3 | Delete template | Click Delete | Confirmation dialog; confirm → template deleted | 🟠 |
| 14.3.4 | Active/Inactive toggle | Click toggle switch | Template status changes; inactive templates don't generate instances | 🟠 |

### 14.4 Checklist Instances

| # | Test Case | Steps | Expected Result | Severity |
|---|-----------|-------|-----------------|----------|
| 14.4.1 | Create Today's Instances | Click "Create Today's Instances" button | Instances generated from active templates; success toast | 🟠 |
| 14.4.2 | Completion history | Click "History" on a checklist | Dialog shows past completions with % complete and who completed | 🟡 |

### 14.5 Filters

| # | Test Case | Steps | Expected Result | Severity |
|---|-----------|-------|-----------------|----------|
| 14.5.1 | Search by name | Type checklist name | Matching checklists filtered | 🟡 |
| 14.5.2 | Status filter | Select "Active" or "Inactive" | Only matching status shown | 🟡 |

---

## 15. Reports

### 15.1 Festival Sales Report (`/admin/reports/festival`)

| # | Test Case | Steps | Expected Result | Severity |
|---|-----------|-------|-----------------|----------|
| 15.1.1 | Page loads | Navigate to festival report | Stats cards + category breakdown + item table | 🟠 |
| 15.1.2 | Stats: Items Sold, Revenue, Original Value, Profit | Check stats | Correct counts and amounts for festival sales | 🟠 |
| 15.1.3 | Margin violations highlighted | Check item table | Items sold below minimum margin highlighted in red | 🟡 |
| 15.1.4 | Margin Violations stat | Check stat card | Count of below-margin items | 🟡 |
| 15.1.5 | Category breakdown | Check breakdown section | Revenue per category for festival sales | 🟡 |
| 15.1.6 | Loading skeletons | Initial page load | Skeletons shown while data loads | 🟢 |
| 15.1.7 | Empty state | No festival sales exist | Appropriate "No data" message shown | 🟡 |
| 15.1.8 | Back navigation | Click back button | Returns to previous page with filters preserved | 🟡 |

### 15.2 Clearance Sales Report (`/admin/reports/clearance`)

| # | Test Case | Steps | Expected Result | Severity |
|---|-----------|-------|-----------------|----------|
| 15.2.1 | Stats: Items, Revenue, Cost, Profit/Loss, Recovery Rate | Check stats | Correct metrics; profit can be negative for clearance | 🟠 |
| 15.2.2 | Items at Loss/Profit | Check stat | Correct counts of loss vs profit items | 🟡 |
| 15.2.3 | Category breakdown | Check breakdown | Per-category clearance metrics | 🟡 |

### 15.3 Promotion Sales Report (`/admin/reports/promotion`)

| # | Test Case | Steps | Expected Result | Severity |
|---|-----------|-------|-----------------|----------|
| 15.3.1 | Stats: Items, Revenue, Savings, Profit, Avg Discount | Check stats | Correct promotion metrics | 🟠 |
| 15.3.2 | Category breakdown | Check breakdown | Per-category promotion data | 🟡 |

---

## 16. Staff Dashboard (My Dashboard)

### 16.1 Page Load (`/me`)

| # | Test Case | Steps | Expected Result | Severity |
|---|-----------|-------|-----------------|----------|
| 16.1.1 | Page loads for staff | Login as staff, navigate to `/me` | Shows AttendanceCard, TaskChecklistCard, AttendanceCalendar | 🔴 |
| 16.1.2 | Admin redirected | Login as admin, navigate to `/me` | Redirected to `/admin` | 🟠 |

### 16.2 Attendance Card

| # | Test Case | Steps | Expected Result | Severity |
|---|-----------|-------|-----------------|----------|
| 16.2.1 | Clock In button shown | Before clocking in today | "Clock In" button visible with LogIn icon | 🔴 |
| 16.2.2 | Clock In action | Click "Clock In" | Button shows loading spinner; disabled during action; success toast; button changes to "Clock Out" | 🔴 |
| 16.2.3 | Live timer | After clocking in | Timer starts counting elapsed time (HH:MM:SS format), updating every second | 🟠 |
| 16.2.4 | Clock Out button shown | After clocking in | "Clock Out" button visible with LogOut icon | 🔴 |
| 16.2.5 | Clock Out — confirmation | Click "Clock Out" | Confirmation dialog shows elapsed time; asks to confirm | 🟠 |
| 16.2.6 | Clock Out — confirm | Confirm in dialog | Spinner on button; attendance closed; success toast; status shows "Completed" | 🔴 |
| 16.2.7 | Clock Out — cancel | Cancel in dialog | No action taken; timer continues | 🟡 |
| 16.2.8 | Status badge — In Progress | While clocked in, not clocked out | Yellow "In Progress" badge shown | 🟢 |
| 16.2.9 | Status badge — Completed | After clocking out | "Completed" badge shown | 🟢 |
| 16.2.10 | Stale attendance detection | Have yesterday's open (not clocked out) attendance | Warning/special handling for stale attendance | 🟠 |
| 16.2.11 | Loading skeleton | Initial page load | Skeleton placeholder shown while fetching attendance data | 🟡 |
| 16.2.12 | Error toast on failure | Simulate API error (e.g., network off during clock-in) | Toast error; button re-enabled so user can retry | 🟠 |

### 16.3 Task Checklist Card

| # | Test Case | Steps | Expected Result | Severity |
|---|-----------|-------|-----------------|----------|
| 16.3.1 | Today's checklists shown | Have active checklists for today | Checklist items grouped by template with progress bars | 🟠 |
| 16.3.2 | Toggle item complete | Click checkbox on a task item | Item marked complete; optimistic update (checkbox fills immediately); loading indicator briefly shown | 🟠 |
| 16.3.3 | Toggle item incomplete | Uncheck a completed item | Item marked incomplete; progress updates | 🟡 |
| 16.3.4 | Progress bar updates | Complete items | % bar fills proportionally | 🟡 |
| 16.3.5 | Auto-refresh | Wait 30 seconds on page | Checklists refresh automatically (if another staff member completed items) | 🟡 |
| 16.3.6 | Empty state | No tasks assigned for today | "No tasks for today" message | 🟡 |
| 16.3.7 | Expandable sections | Click on a checklist header | Items expand/collapse | 🟢 |

### 16.4 Attendance Calendar

| # | Test Case | Steps | Expected Result | Severity |
|---|-----------|-------|-----------------|----------|
| 16.4.1 | Calendar shows current month | Check calendar view | Current month displayed with attendance markers | 🟡 |
| 16.4.2 | Days with attendance marked | Check marked days | Days when staff attended visually indicated | 🟡 |

---

## 17. Settings

### 17.1 Page Load (`/settings`)

| # | Test Case | Steps | Expected Result | Severity |
|---|-----------|-------|-----------------|----------|
| 17.1.1 | Page loads with tabs | Navigate to `/settings` | Tab bar or dropdown shown with settings sections | 🟠 |
| 17.1.2 | Tab URL sync | Check URL after switching tabs | `?tab=` parameter in URL matches active tab | 🟡 |
| 17.1.3 | Mobile — dropdown tab selector | On phone screen | Tab selector is dropdown (not horizontal scroll) | 🟡 |
| 17.1.4 | Desktop — horizontal tabs | On wide screen | Tabs shown as horizontal bar | 🟡 |

### 17.2 Role-Based Tab Visibility

| # | Test Case | Steps | Expected Result | Severity |
|---|-----------|-------|-----------------|----------|
| 17.2.1 | Admin sees all admin tabs | Login as admin/owner | Shop Details, Tax, Categories, Sizes, Expense Categories, QR Prefixes, About, App & Install tabs visible | 🟠 |
| 17.2.2 | Staff sees limited tabs | Login as staff | Only About, App & Install tabs visible (no admin tabs) | 🟠 |

### 17.3 Shop Details Tab

| # | Test Case | Steps | Expected Result | Severity |
|---|-----------|-------|-----------------|----------|
| 17.3.1 | Fields pre-populated | Open Shop Details tab | Shop Name, Address, Phone, Bill Prefix filled with current values | 🟡 |
| 17.3.2 | Save disabled when clean | Don't change anything | Save button disabled | 🟡 |
| 17.3.3 | Save enabled when dirty | Change shop name | Save button becomes enabled | 🟡 |
| 17.3.4 | Shop name required | Clear shop name, try to save | Error: required | 🟠 |
| 17.3.5 | Successful save | Change address, save | Spinner on button; success toast; data persisted | 🟠 |

### 17.4 Categories Tab

| # | Test Case | Steps | Expected Result | Severity |
|---|-----------|-------|-----------------|----------|
| 17.4.1 | List categories | Open Categories tab | All shop categories listed with edit/delete actions | 🟡 |
| 17.4.2 | Quick add — type and Enter | Type name in input, press Enter | Category added; input clears; success toast | 🟠 |
| 17.4.3 | Quick add — duplicate detection | Add a category name that already exists | Error: duplicate name | 🟡 |
| 17.4.4 | Edit category | Click Edit on a category | Edit dialog/inline: change name + description; Save | 🟡 |
| 17.4.5 | Edit — duplicate detection | Change name to existing category name | Error: duplicate name | 🟡 |
| 17.4.6 | Delete category | Click Delete | Confirmation dialog; confirm → deleted; success toast | 🟠 |
| 17.4.7 | Drag-and-drop reorder | Drag a category to new position | Order updates; persisted to database | 🟡 |
| 17.4.8 | Up/Down arrow reorder | Click up/down arrows | Category moves up/down; order persisted | 🟡 |
| 17.4.9 | Empty state | No categories exist | "No categories" empty state shown | 🟡 |
| 17.4.10 | Input clears on success | Add a category successfully | Input field clears to empty | 🟡 |

### 17.5 Sizes Tab

| # | Test Case | Steps | Expected Result | Severity |
|---|-----------|-------|-----------------|----------|
| 17.5.1 | List sizes | Open Sizes tab | All shop sizes listed | 🟡 |
| 17.5.2 | Quick add | Type name, press Enter | Size added; input clears; toast | 🟡 |
| 17.5.3 | Delete size | Click Delete | Size removed | 🟡 |
| 17.5.4 | Empty state | No sizes | "No sizes configured" shown | 🟡 |

### 17.6 Expense Categories Tab

| # | Test Case | Steps | Expected Result | Severity |
|---|-----------|-------|-----------------|----------|
| 17.6.1 | List expense categories | Open tab | All expense categories listed | 🟡 |
| 17.6.2 | Quick add + Enter key | Type name, press Enter | Category added; input clears | 🟡 |
| 17.6.3 | Edit inline | Click Edit, change name, press Enter | Name updated; success toast | 🟡 |
| 17.6.4 | Delete | Click Delete | Category removed | 🟡 |

### 17.7 QR Prefixes Tab

| # | Test Case | Steps | Expected Result | Severity |
|---|-----------|-------|-----------------|----------|
| 17.7.1 | List QR prefixes | Open tab | All prefixes listed with details | 🟡 |
| 17.7.2 | Edit prefix | Click Edit, change, press Enter | Prefix updated | 🟡 |

### 17.8 Tax Settings Tab

| # | Test Case | Steps | Expected Result | Severity |
|---|-----------|-------|-----------------|----------|
| 17.8.1 | Current tax rate shown | Open Tax tab | Default tax rate displayed | 🟡 |
| 17.8.2 | Change tax rate | Enter new rate, save | Spinner; rate updated; success toast; affects new lot calculations | 🟠 |

### 17.9 About & App/Install Tabs

| # | Test Case | Steps | Expected Result | Severity |
|---|-----------|-------|-----------------|----------|
| 17.9.1 | About tab shows info | Open About | App version, PWA info, branding displayed | 🟢 |
| 17.9.2 | PWA Install prompt | Open App & Install tab | Install button shown (if not already installed); cache management options | 🟡 |
| 17.9.3 | Install as PWA | Click Install (on supported device) | Browser PWA install prompt appears | 🟡 |

---

## 18. Superadmin Panel

### 18.1 Page Load (`/superadmin`)

| # | Test Case | Steps | Expected Result | Severity |
|---|-----------|-------|-----------------|----------|
| 18.1.1 | Only superadmin can access | Login as admin, navigate to `/superadmin` | Access denied / redirected away | 🔴 |
| 18.1.2 | Superadmin sees panel | Login as superadmin | System Health tab + User Management tab visible | 🔴 |

### 18.2 System Health

| # | Test Case | Steps | Expected Result | Severity |
|---|-----------|-------|-----------------|----------|
| 18.2.1 | Database connection check | Check health indicator | Green indicator when database connected; red if not | 🟠 |
| 18.2.2 | Internet status | Check indicator | Shows Online/Offline correctly | 🟡 |
| 18.2.3 | IndexedDB check | Check indicator | Green if local database accessible | 🟡 |
| 18.2.4 | Edge Function check | Check indicator | Green if edge functions responding | 🟡 |
| 18.2.5 | Sync metrics | Check metrics | Shows pending + failed sync counts (matching actual data) | 🟠 |

### 18.3 Quick Actions

| # | Test Case | Steps | Expected Result | Severity |
|---|-----------|-------|-----------------|----------|
| 18.3.1 | Navigate to Sync Issues | Click "Sync Issues" action | Navigates to `/superadmin/sync-issues` | 🟡 |
| 18.3.2 | Export DB as JSON | Click "Export" | JSON file downloads containing database tables | 🟠 |
| 18.3.3 | Navigate to Admin Dashboard | Click "Admin Dashboard" | Navigates to `/admin` | 🟡 |

### 18.4 User Management (Cross-Shop)

| # | Test Case | Steps | Expected Result | Severity |
|---|-----------|-------|-----------------|----------|
| 18.4.1 | See all shops' users | Check user list as superadmin | Users from all shops visible | 🟠 |
| 18.4.2 | CRUD operations | Create, edit, reset password, toggle, delete users | All operations work across shops | 🟠 |

---

## 19. Sync Issues

### 19.1 Page Load (`/superadmin/sync-issues`)

| # | Test Case | Steps | Expected Result | Severity |
|---|-----------|-------|-----------------|----------|
| 19.1.1 | Page accessible to superadmin | Login as superadmin, navigate | Failed/pending sales list shown | 🟠 |
| 19.1.2 | Only superadmin access | Login as non-superadmin, navigate | Access denied | 🔴 |

### 19.2 Sync Actions

| # | Test Case | Steps | Expected Result | Severity |
|---|-----------|-------|-----------------|----------|
| 19.2.1 | Retry All | Click "Retry All" | Attempts to sync all pending sales; success/failure reported per sale | 🟠 |
| 19.2.2 | Sync Now | Click "Sync Now" | Manual sync triggered immediately | 🟡 |
| 19.2.3 | Delete individual | Click delete on a specific failed sale | That sale removed from queue | 🟡 |
| 19.2.4 | Clear All Failed | Click "Clear All" | All failed sales removed from queue | 🟡 |
| 19.2.5 | Status indicators | Check sale statuses | Pending (yellow), Failed (red), Syncing (blue) badges | 🟢 |
| 19.2.6 | Sale details | Click on a failed sale | Shows items, amounts, error messages for that sale | 🟡 |

---

## 20. User Guide & FAQs

### 20.1 User Guide (`/guide`)

| # | Test Case | Steps | Expected Result | Severity |
|---|-----------|-------|-----------------|----------|
| 20.1.1 | Guide loads | Navigate to `/guide` | Multi-phase accordion structure visible | 🟡 |
| 20.1.2 | Accordion expand/collapse | Click a phase header | Section expands with steps/tips; click again collapses | 🟡 |
| 20.1.3 | Accessible to all roles | Login as staff, navigate to `/guide` | Guide page accessible | 🟡 |

### 20.2 FAQs (`/faqs`)

| # | Test Case | Steps | Expected Result | Severity |
|---|-----------|-------|-----------------|----------|
| 20.2.1 | FAQs load | Navigate to `/faqs` | Category tabs + FAQ accordion items visible | 🟡 |
| 20.2.2 | Category tabs filter | Click different category tab (POS, Inventory, etc.) | Only FAQs for that category shown | 🟡 |
| 20.2.3 | Search FAQs | Type in search box | FAQs filter to match search text across Q&A | 🟡 |
| 20.2.4 | Accordion items | Click a FAQ question | Answer expands; click again collapses | 🟡 |
| 20.2.5 | Accessible to all roles | Login as staff | FAQs page accessible | 🟡 |

---

## 21. Offline / PWA Features

### 21.1 Service Worker & PWA

| # | Test Case | Steps | Expected Result | Severity |
|---|-----------|-------|-----------------|----------|
| 21.1.1 | Service worker registered | Open DevTools → Application → Service Workers | Service worker is registered and active | 🟠 |
| 21.1.2 | Offline page served | Turn off network, navigate to unvisited page | Offline HTML page (`offline.html`) shown instead of browser error | 🟡 |
| 21.1.3 | Manifest accessible | Check DevTools → Application → Manifest | App manifest loads with correct name, icons, theme color | 🟢 |
| 21.1.4 | PWA installable | Check install banner or Settings → App & Install | Install prompt available on compatible device/browser | 🟡 |

### 21.2 Offline POS Flow

| # | Test Case | Steps | Expected Result | Severity |
|---|-----------|-------|-----------------|----------|
| 21.2.1 | Scan QR while offline | Turn off network, scan a previously-cached item | Item found from IndexedDB cache; "Using cached data" toast; added to cart | 🔴 |
| 21.2.2 | Scan uncached QR while offline | Turn off network, scan a never-seen item | Error: item not found in offline cache | 🟠 |
| 21.2.3 | Complete sale offline | Turn off network, add items, checkout | Sale saved to IndexedDB as pending; success toast mentioning offline | 🔴 |
| 21.2.4 | Offline sale syncs on reconnect | Complete offline sale, turn network on | SyncContext detects online; picks up pending sale; syncs successfully; sale appears in Sales Hub | 🔴 |
| 21.2.5 | Cart persists during offline | Add items offline, navigate away, come back | Cart restored from sessionStorage/localStorage | 🟡 |

### 21.3 Sync Behavior

| # | Test Case | Steps | Expected Result | Severity |
|---|-----------|-------|-----------------|----------|
| 21.3.1 | Auto-sync interval | Have pending sales, stay online | Sync attempt happens approximately every 30 seconds | 🟠 |
| 21.3.2 | Max retry (3 attempts) | Force a sync failure (e.g., data conflict) | Retried up to 3 times; after 3 failures, moved to `failedSales` | 🟠 |
| 21.3.3 | Retry count tracking | Check pending sale after 1 failure | `retryCount` incremented to 1 | 🟡 |
| 21.3.4 | Pending count in UI | Have 3 pending sales | SyncStatusIndicator shows "3" pending count | 🟡 |
| 21.3.5 | Failed count in UI | Have 2 failed sales | SyncStatusIndicator shows "2" failed count | 🟡 |

### 21.4 Inventory Pre-Caching

| # | Test Case | Steps | Expected Result | Severity |
|---|-----------|-------|-----------------|----------|
| 21.4.1 | Auto-caching runs | Stay online for 15+ minutes | IndexedDB `inventoryCache` store populated with available inventory | 🟡 |
| 21.4.2 | Cache validity | Check cache age | Old cache cleared after 24 hours | 🟡 |
| 21.4.3 | Cache has correct fields | Inspect IndexedDB `inventoryCache` | Each entry has: qrCode, itemId, lotId, price, category, size, taxRate, shopId | 🟡 |

---

## 22. Cross-Cutting UI/UX Tests

### 22.1 Loading States (All Modules)

| # | Test Case | Steps | Expected Result | Severity |
|---|-----------|-------|-----------------|----------|
| 22.1.1 | CTA button spinner — Login | Click "Sign In" | Button shows `Loader2` spinning icon + "Signing in…" text; button disabled | 🟠 |
| 22.1.2 | CTA button spinner — Save (any dialog) | Click Save in any edit dialog | Button shows spinner + "Saving…"; both Save and Cancel disabled | 🟠 |
| 22.1.3 | CTA button spinner — Create User | Click Create User in User Management | Button shows spinner + "Creating…" text; button disabled | 🟠 |
| 22.1.4 | CTA button spinner — Checkout | Click "Complete Sale" in CheckoutDialog | Shows spinner + "Processing…"; all buttons disabled | 🟠 |
| 22.1.5 | CTA button spinner — Clock In/Out | Click Clock In or Clock Out | Button disabled with spinner during API call | 🟠 |
| 22.1.6 | CTA button spinner — Generate QR | Click Generate in QR management | Spinner on generate button during creation | 🟡 |
| 22.1.7 | Full-page loading — any data page | Navigate to Inventory / Sales / Staff / etc. | Centered `Loader2` spinner visible while initial data fetches | 🟡 |
| 22.1.8 | Table loading skeleton | Navigate to any table page (Inventory, Sales, etc.) | Skeleton rows (gray animation) shown while table data loads | 🟡 |
| 22.1.9 | No double-clicks allowed | Rapidly click any CTA button twice | Only one action triggered; button disabled on first click | 🟠 |

### 22.2 Form Input Clearing After Success

| # | Test Case | Steps | Expected Result | Severity |
|---|-----------|-------|-----------------|----------|
| 22.2.1 | Create User form clears | Successfully create user | All fields (email, password, name, phone, role) reset to empty | 🟡 |
| 22.2.2 | Add Category input clears | Successfully add category | Name input clears to empty | 🟡 |
| 22.2.3 | Add Size input clears | Successfully add size | Name input clears to empty | 🟡 |
| 22.2.4 | Add Expense Category clears | Successfully add expense category | Input clears | 🟡 |
| 22.2.5 | Add Expense dialog clears | Successfully add expense | Dialog closes; reopening shows default values (not previous entry) | 🟡 |
| 22.2.6 | Edit dialog close resets | Open edit dialog, change values, close without saving, reopen | Shows original values (not previously-unsaved changes) | 🟡 |
| 22.2.7 | Attendance create resets | Successfully create attendance, reopen dialog | Fields reset to defaults (today's date, 09:00 clock-in, empty reason) | 🟡 |
| 22.2.8 | Checklist create resets | Successfully create checklist, reopen dialog | Title empty, items list empty | 🟡 |

### 22.3 Dialog/Popup Behavior

| # | Test Case | Steps | Expected Result | Severity |
|---|-----------|-------|-----------------|----------|
| 22.3.1 | Overlay backdrop | Open any dialog | Background dimmed with `bg-black/35 backdrop-blur-sm` | 🟢 |
| 22.3.2 | Close on outside click (Dialog) | Open a regular Dialog, click outside on overlay | Dialog closes (Radix default behavior) | 🟡 |
| 22.3.3 | Cannot close ConfirmDialog on outside click | Open a confirmation dialog (e.g., delete), click outside | Dialog stays open (AlertDialog does not dismiss on overlay click) | 🟠 |
| 22.3.4 | Close on Escape (Dialog) | Open dialog, press Escape | Dialog closes | 🟡 |
| 22.3.5 | X close button | Open any dialog | X button visible in top-right; clicking closes dialog | 🟡 |
| 22.3.6 | Dialog animation | Open and close a dialog | Open: fade + zoom-in animation; Close: fade + zoom-out animation | 🟢 |
| 22.3.7 | Sheet slide animation | Open a Lot History or Category Breakdown Sheet | Sheet slides in from right; closes sliding back out | 🟢 |

### 22.4 Dialog Scrolling on Mobile/Tablet with Keyboard

| # | Test Case | Steps | Expected Result | Severity |
|---|-----------|-------|-----------------|----------|
| 22.4.1 | Dialog scrolls when keyboard open | On tablet, open Add Expense dialog, tap Amount field | Keyboard opens; dialog content scrolls to keep focused field visible and not hidden behind keyboard | 🟠 |
| 22.4.2 | Edit Staff dialog — keyboard | On tablet, open Edit Staff, tap Name field | Keyboard opens; dialog adjusts; all fields accessible by scrolling | 🟠 |
| 22.4.3 | Create User dialog — keyboard | On tablet, open Create User, tap Email field | Dialog scrolls properly; no field hidden behind keyboard | 🟠 |
| 22.4.4 | Attendance Create — keyboard | On tablet, open Create Attendance, tap Reason field | Dialog scrolls to keep Reason textarea visible above keyboard | 🟠 |
| 22.4.5 | Checkout dialog — keyboard | On phone, open Checkout, tap Customer Name | Dialog scrolls; customer fields visible; payment options still accessible | 🟠 |
| 22.4.6 | Login form — keyboard on phone | On phone, tap email field | Keyboard opens; form stays visible; "Sign In" button scrollable into view | 🟡 |
| 22.4.7 | Change Password — keyboard | On phone, tap password field | Strength meter and rules visible while typing (not pushed off-screen) | 🟡 |
| 22.4.8 | Add Lot form — keyboard on tablet | On tablet, tap Quantity field (positioned lower in form) | Form scrolls to keep field visible; preview panel still accessible | 🟡 |
| 22.4.9 | Returns — bill search keyboard | On tablet, open Process Return, tap bill number field | Field visible above keyboard; Enter key triggers search | 🟡 |
| 22.4.10 | Search dialogs — keyboard | On phone, open Product Search dialog, keyboard appears | Search input visible; results scroll behind keyboard without overlapping search | 🟡 |

### 22.5 Toast Notifications

| # | Test Case | Steps | Expected Result | Severity |
|---|-----------|-------|-----------------|----------|
| 22.5.1 | Success toast | Complete any successful action | Green success toast with checkmark icon; auto-dismisses | 🟡 |
| 22.5.2 | Error toast | Trigger any error (e.g., network off during save) | Red error toast with X icon; shows error message | 🟠 |
| 22.5.3 | Info toast | Trigger info scenario (e.g., "No changes to save") | Blue info toast | 🟡 |
| 22.5.4 | Undo toast | Delete an expense or inventory item | Toast with "Undo" action button; clickable within ~5 seconds | 🟡 |
| 22.5.5 | Toast doesn't block UI | Receive a toast | Toast appears in corner; does not block page content or buttons | 🟡 |
| 22.5.6 | Multiple toasts stack | Trigger 3 actions rapidly | Toasts stack without overlapping; dismissing individually | 🟢 |

### 22.6 Empty States

| # | Test Case | Steps | Expected Result | Severity |
|---|-----------|-------|-----------------|----------|
| 22.6.1 | Inventory empty state | Filter with impossible criteria | Illustration + "No items found" message (not blank table) | 🟡 |
| 22.6.2 | Staff empty state | Search for non-existent name | "No staff members found" message | 🟡 |
| 22.6.3 | Sales empty state | Filter for period with no sales | "No sales found" message | 🟡 |
| 22.6.4 | QR Codes empty state | Filter returning 0 | "No QR codes found" | 🟡 |
| 22.6.5 | Settings — categories empty | Delete all categories | "No categories" message | 🟢 |
| 22.6.6 | Settings — sizes empty | Delete all sizes | "No sizes configured" message | 🟢 |
| 22.6.7 | Staff tasks empty (My Dashboard) | No tasks assigned for today | "No tasks for today" message | 🟡 |

### 22.7 Theme & Dark Mode

| # | Test Case | Steps | Expected Result | Severity |
|---|-----------|-------|-----------------|----------|
| 22.7.1 | Toggle dark mode | Click sun/moon in TopBar | Entire app switches theme; all elements readable | 🟡 |
| 22.7.2 | Theme persists on reload | Switch to dark, reload page | Dark mode still active | 🟡 |
| 22.7.3 | Theme color picker | Open ThemePickerDialog from avatar dropdown | 6 color palettes shown; selecting one changes brand colors | 🟢 |
| 22.7.4 | Theme applies to all pages | Switch theme, navigate across pages | Consistent theming on every page | 🟢 |
| 22.7.5 | Dialogs respect theme | Open any dialog in dark mode | Dialog background, text, borders match dark theme | 🟢 |
| 22.7.6 | Toasts respect theme | Trigger toast in dark mode | Toast styling matches current theme | 🟢 |

### 22.8 Responsive Design

| # | Test Case | Steps | Expected Result | Severity |
|---|-----------|-------|-----------------|----------|
| 22.8.1 | Phone layout (< 640px) | Open app on phone / resize to narrow | Single column layout; dialogs full-width; nav icons only (no labels); table columns reduced | 🟠 |
| 22.8.2 | Tablet layout (768px+) | Open on tablet | 2-column grids; medium-sized dialogs; more table columns visible | 🟠 |
| 22.8.3 | Desktop layout (1024px+) | Open on desktop | Multi-column grids; lg: breakpoint styles; full table columns | 🟡 |
| 22.8.4 | Dialog width — phone | Open a dialog on phone | Dialog takes nearly full width: `max-w-[calc(100%-2rem)]` | 🟡 |
| 22.8.5 | Dialog width — desktop | Open a dialog on desktop | Dialog is `sm:max-w-lg` (centered, not full width) | 🟡 |
| 22.8.6 | Sheet width — phone | Open Lot History or Breakdown sheet on phone | Sheet width: `w-[calc(100%-2.5rem)]` with rounded left corner | 🟡 |
| 22.8.7 | Sheet width — desktop | Same on desktop | Sheet: `sm:max-w-lg` | 🟡 |
| 22.8.8 | Stats cards — phone | Check stats grid on phone | 2 columns: `grid-cols-2` | 🟡 |
| 22.8.9 | Stats cards — desktop | Check stats grid on desktop | 4 columns: `lg:grid-cols-4` | 🟡 |
| 22.8.10 | Table hidden columns — phone | Check Inventory table on phone | Some columns hidden (e.g., `hidden md:table-cell`) | 🟡 |
| 22.8.11 | Settings tabs — phone | Open Settings on phone | Dropdown tab selector instead of horizontal tabs | 🟡 |
| 22.8.12 | Bottom nav safe area | Open on phone with notch/home bar | BottomNav has safe-area padding (content not behind system UI) | 🟡 |
| 22.8.13 | EmptyState icon scaling | Check empty state on phone vs desktop | Icon scales from `h-12 w-12` to `md:h-16 md:w-16`; text from `text-sm` to `md:text-base` | 🟢 |

### 22.9 Sound Feedback

| # | Test Case | Steps | Expected Result | Severity |
|---|-----------|-------|-----------------|----------|
| 22.9.1 | Scan beep on success | Successfully scan QR in POS | Beep sound plays | 🟢 |
| 22.9.2 | Error buzz on scan failure | Scan invalid QR | Error buzz sound plays | 🟢 |
| 22.9.3 | Item add chime | Add item to cart | Chime sound plays | 🟢 |
| 22.9.4 | Sounds init on interaction | Ensure device has audio; interact with scanner first time | Audio initialized on first user click (Chrome autoplay policy) | 🟢 |

---

## 23. Security & Access Control

### 23.1 Route Protection

| # | Test Case | Steps | Expected Result | Severity |
|---|-----------|-------|-----------------|----------|
| 23.1.1 | Unauthenticated → admin routes | While logged out, navigate to `/admin` | Redirected to `/login` | 🔴 |
| 23.1.2 | Unauthenticated → POS | While logged out, navigate to `/pos` | Redirected to `/login` | 🔴 |
| 23.1.3 | Unauthenticated → settings | Navigate to `/settings` | Redirected to `/login` | 🔴 |
| 23.1.4 | Staff → admin routes | Login as staff, navigate to `/admin/inventory` | Access denied or redirected to `/pos` | 🔴 |
| 23.1.5 | Staff → staff management | Login as staff, navigate to `/admin/staff` | Access denied | 🔴 |
| 23.1.6 | Staff → finances | Login as staff, navigate to `/admin/finances` | Access denied | 🔴 |
| 23.1.7 | Admin → superadmin panel | Login as admin, navigate to `/superadmin` | Access denied | 🔴 |
| 23.1.8 | Staff → superadmin panel | Login as staff, navigate to `/superadmin` | Access denied | 🔴 |

### 23.2 Role-Based Actions

| # | Test Case | Steps | Expected Result | Severity |
|---|-----------|-------|-----------------|----------|
| 23.2.1 | Admin cannot create users | Login as admin (not owner), check Staff Management | No "Create User" button visible | 🔴 |
| 23.2.2 | Owner can create users | Login as owner | "Create User" button visible and functional | 🟠 |
| 23.2.3 | Staff cannot access admin actions | Login as staff, check all menus | No admin-only options available | 🔴 |
| 23.2.4 | Inactive staff blocked | Deactivate a staff member; try to login as them | Login fails or access denied | 🔴 |

### 23.3 Data Isolation

| # | Test Case | Steps | Expected Result | Severity |
|---|-----------|-------|-----------------|----------|
| 23.3.1 | Shop data isolation | Login as admin of Shop A | Only see Shop A's inventory, sales, staff, etc. (not Shop B's data) | 🔴 |
| 23.3.2 | Superadmin cross-shop | Login as superadmin | Can see data from all shops in User Management | 🟠 |
| 23.3.3 | Owner sees own shop only (User Mgmt) | Login as owner | User Management shows only own shop's users | 🟠 |

---

## 24. Performance & Edge Cases

### 24.1 Large Data Sets

| # | Test Case | Steps | Expected Result | Severity |
|---|-----------|-------|-----------------|----------|
| 24.1.1 | Inventory with 10,000+ items | Load inventory page with large dataset | Page loads without timeout; pagination works; no browser freeze | 🟠 |
| 24.1.2 | Sales with 5,000+ transactions | Load sales page | Page loads; filtering responsive; pagination works | 🟠 |
| 24.1.3 | CSV export — large dataset | Export 10,000 rows | Export completes (may show warning); file downloads correctly | 🟡 |
| 24.1.4 | QR code bulk generation — 1000 | Generate 1000 QR codes | Batch mode works; progress shown; all codes generated | 🟡 |
| 24.1.5 | QR download — 200 codes as PDF | Download 200 QR codes as PDF | Progress bar; PDF generated with all codes in grid | 🟡 |

### 24.2 Concurrent Actions

| # | Test Case | Steps | Expected Result | Severity |
|---|-----------|-------|-----------------|----------|
| 24.2.1 | Two staff scan same QR | Staff A and Staff B scan the same QR almost simultaneously | One succeeds, other gets "Already sold" error (no double-sale) | 🔴 |
| 24.2.2 | Edit same item simultaneously | Admin A and Admin B edit same inventory item | Last save wins; no data corruption | 🟠 |

### 24.3 Session & State

| # | Test Case | Steps | Expected Result | Severity |
|---|-----------|-------|-----------------|----------|
| 24.3.1 | Session expiry handling | Let session expire (wait or manipulate token) | Redirected to login; not stuck on broken page | 🟠 |
| 24.3.2 | Tab switching and profile refresh | Switch browser tabs away and back | Profile re-validated on visibility regain (AuthContext behavior) | 🟡 |
| 24.3.3 | Multiple tabs open | Open app in 2 tabs, logout from one | Second tab detects logout on next interaction or auto-refresh | 🟠 |
| 24.3.4 | Browser back button | Navigate deep into app, hit browser back | Navigates back correctly; no blank pages or errors | 🟡 |
| 24.3.5 | Page refresh preserves filters | Apply filters on Inventory, refresh page | Same filters active (URL-synced filters) | 🟡 |

### 24.4 Error Recovery

| # | Test Case | Steps | Expected Result | Severity |
|---|-----------|-------|-----------------|----------|
| 24.4.1 | Network error mid-save | Start saving, disconnect network before response | Toast error; button spinner stops; can retry | 🟠 |
| 24.4.2 | Error boundary — app level | Force a JavaScript error | Error page with error message, "Try Again" and "Go to Home" buttons | 🟠 |
| 24.4.3 | Error boundary — protected area | Force error inside admin section | Error page with "Try Again" and "Go to Dashboard" buttons | 🟠 |
| 24.4.4 | Loading states clear on error | API call fails | Loading spinner/skeleton clears; page shows error state (not stuck loading forever) | 🟠 |
| 24.4.5 | 404 page | Navigate to `/nonexistent-route` | Custom Not Found page displayed (not blank) | 🟡 |

### 24.5 Timezone Handling (IST)

| # | Test Case | Steps | Expected Result | Severity |
|---|-----------|-------|-----------------|----------|
| 24.5.1 | Attendance timestamps in IST | Create attendance, check clock-in time | Time shown in IST (Asia/Kolkata, UTC+5:30), not UTC | 🟠 |
| 24.5.2 | Sale timestamp in IST | Complete sale, check sale date/time in Sales Hub | Displayed in IST | 🟡 |
| 24.5.3 | Date filters use IST | Apply "today" filter | Correctly captures today's IST date (not UTC midnight boundary issue) | 🟠 |
| 24.5.4 | Attendance stale detection | At 12:01 AM IST with open yesterday's attendance | Correctly detects as stale (uses IST date comparison) | 🟡 |

### 24.6 Not-Found & Edge Routes

| # | Test Case | Steps | Expected Result | Severity |
|---|-----------|-------|-----------------|----------|
| 24.6.1 | `/admin/settings` redirect | Navigate to `/admin/settings` | Redirects to `/settings` | 🟡 |
| 24.6.2 | Invalid route | Navigate to `/admin/nonexistent` | 404 / Not Found page | 🟡 |
| 24.6.3 | Direct URL to report | Navigate directly to `/admin/reports/festival` | Report page loads (back button works) | 🟡 |

---

## Appendix A: Test Environment Setup

### Prerequisites
1. **Accounts**: At least 4 test accounts — superadmin, owner, admin, staff
2. **Test data**: Shop with categories, sizes, QR prefixes, inventory items, a few completed sales
3. **Devices**: Android tablet (primary), Android phone, desktop browser (Chrome)
4. **Network toggle**: Ability to switch airplane mode or disable WiFi for offline testing

### Test Data Preparation
1. Create 2+ categories (e.g., "Silk", "Cotton")
2. Create 2+ sizes (e.g., "Free", "Large")
3. Generate 50+ QR codes with 2 different prefixes
4. Add 2+ stock lots (10+ items each)
5. Complete 5+ sales (mix of cash/UPI/card, with/without customer info)
6. Process 1+ return
7. Add 5+ expenses across 2+ categories
8. Create 2+ checklists (1 daily, 1 weekly)
9. Have 1+ active attendance session for a staff member

### Browser DevTools Tips for Testers
- **Offline mode**: DevTools → Network → check "Offline"
- **Responsive mode**: DevTools → Toggle device toolbar (Ctrl+Shift+M)
- **IndexedDB inspection**: DevTools → Application → IndexedDB
- **Console errors**: DevTools → Console tab (watch for red errors)
- **Network requests**: DevTools → Network tab (watch for failed requests)

---

## Appendix B: Test Case Summary

| Module | Section Count | Test Cases | Critical | High | Medium | Low |
|--------|--------------|------------|----------|------|--------|-----|
| 1. Authentication | 4 | 22 | 10 | 6 | 5 | 1 |
| 2. Navigation | 4 | 18 | 0 | 5 | 9 | 4 |
| 3. Admin Dashboard | 4 | 14 | 2 | 5 | 0 | 7 |
| 4. POS | 6 | 38 | 8 | 15 | 12 | 3 |
| 5. Inventory | 7 | 39 | 1 | 11 | 24 | 3 |
| 6. Add Stock Lot | 4 | 17 | 3 | 8 | 5 | 1 |
| 7. Sales Hub | 7 | 24 | 1 | 4 | 17 | 2 |
| 8. Returns | 3 | 21 | 3 | 7 | 10 | 1 |
| 9. QR Codes | 5 | 22 | 1 | 6 | 14 | 1 |
| 10. Finances | 5 | 19 | 1 | 5 | 12 | 1 |
| 11. Staff Mgmt | 7 | 26 | 4 | 9 | 10 | 3 |
| 12. Staff Performance | 1 | 4 | 0 | 1 | 3 | 0 |
| 13. Attendance | 8 | 26 | 1 | 10 | 13 | 2 |
| 14. Checklists | 5 | 16 | 1 | 5 | 8 | 2 |
| 15. Reports | 3 | 10 | 0 | 3 | 6 | 1 |
| 16. Staff Dashboard | 4 | 19 | 3 | 4 | 7 | 5 |
| 17. Settings | 9 | 25 | 0 | 5 | 17 | 3 |
| 18. Superadmin | 4 | 12 | 2 | 5 | 4 | 1 |
| 19. Sync Issues | 2 | 8 | 1 | 1 | 5 | 1 |
| 20. Guide & FAQs | 2 | 8 | 0 | 0 | 7 | 1 |
| 21. Offline/PWA | 4 | 16 | 3 | 3 | 9 | 1 |
| 22. Cross-Cutting UI/UX | 9 | 47 | 0 | 11 | 27 | 9 |
| 23. Security | 3 | 12 | 8 | 4 | 0 | 0 |
| 24. Performance & Edge | 6 | 22 | 1 | 10 | 9 | 2 |
| **TOTAL** | — | **485** | **54** | **147** | **237** | **47** |
