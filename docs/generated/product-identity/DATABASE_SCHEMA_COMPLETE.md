# Complete Database Schema Documentation

**Generated from**: `src/types/database.types.ts`  
**Purpose**: Comprehensive reference for all tables, columns, relationships, and enums  
**Last Updated**: Auto-generated from Supabase TypeScript types

---

## Table of Contents

1. [Overview](#overview)
2. [Tables](#tables)
   - [attendance_logs](#attendance_logs)
   - [categories](#categories)
   - [checklist_items](#checklist_items)
   - [checklists](#checklists)
   - [expense_categories](#expense_categories)
   - [financial_transactions](#financial_transactions)
   - [inventory_adjustments](#inventory_adjustments)
   - [inventory_items](#inventory_items)
   - [lots](#lots)
   - [profiles](#profiles)
   - [qr_codes](#qr_codes)
   - [sale_items](#sale_items)
   - [sale_returns](#sale_returns)
   - [sales](#sales)
   - [shops](#shops)
   - [sizes](#sizes)
   - [staff_checklist_assignments](#staff_checklist_assignments)
   - [staff_checklist_item_status](#staff_checklist_item_status)
   - [tax_settings](#tax_settings)
3. [Enums](#enums)
4. [Functions](#functions)
5. [Relationships Overview](#relationships-overview)

---

## Overview

**Total Tables**: 19  
**Total Enums**: 7  
**Total Functions**: 7  
**PostgreSQL Version**: 13.0.5

### Key Concepts

- **Multi-tenancy**: All tables include `shop_id` for shop isolation
- **UUID Primary Keys**: All tables use UUID for primary keys (`id`)
- **Timestamps**: Most tables include `created_at` timestamp
- **Soft Deletes**: None implemented (hard deletes)
- **Audit Trail**: Limited - some tables track `created_by`, `adjusted_by`, `processed_by`

---

## Tables

### attendance_logs

**Purpose**: Tracks staff clock-in/clock-out times and break durations

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | `uuid` | No | `gen_random_uuid()` | Primary key |
| `staff_id` | `uuid` | No | - | Foreign key to profiles |
| `shop_id` | `uuid` | No | - | Foreign key to shops |
| `date` | `date` | No | - | Date of attendance |
| `clock_in` | `timestamp` | No | - | Clock-in timestamp |
| `clock_out` | `timestamp` | Yes | `null` | Clock-out timestamp |
| `status` | `attendance_status` | No | `'open'` | Enum: 'open' or 'closed' |
| `total_break_minutes` | `integer` | No | `0` | Total break time in minutes |
| `created_at` | `timestamp` | No | `now()` | Record creation timestamp |

**Foreign Keys**:
- `staff_id` → `profiles.id`
- `shop_id` → `shops.id`

**Indexes**: Likely on `staff_id`, `shop_id`, `date`

**Use Cases**:
- Staff punch in/out tracking
- Break time calculation
- Attendance reports
- Payroll integration

---

### categories

**Purpose**: Product categories for inventory organization

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | `uuid` | No | `gen_random_uuid()` | Primary key |
| `shop_id` | `uuid` | No | - | Foreign key to shops |
| `name` | `string` | No | - | Category name |
| `description` | `string` | Yes | `null` | Optional description |
| `created_at` | `timestamp` | No | `now()` | Record creation timestamp |

**Foreign Keys**:
- `shop_id` → `shops.id`

**Relationships**:
- One-to-many with `lots` (one category can have many lots)

**Use Cases**:
- Product classification
- Inventory filtering
- Reporting by category

---

### checklist_items

**Purpose**: Individual task items within a checklist template

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | `uuid` | No | `gen_random_uuid()` | Primary key |
| `checklist_id` | `uuid` | No | - | Foreign key to checklists |
| `label` | `string` | No | - | Task description/label |
| `sort_order` | `integer` | No | `0` | Display order |

**Foreign Keys**:
- `checklist_id` → `checklists.id`

**Relationships**:
- Many-to-one with `checklists` (items belong to one checklist)
- One-to-many with `staff_checklist_item_status` (tracking completion)

**Use Cases**:
- Define task templates
- Order tasks in logical sequence
- Reusable checklist definitions

---

### checklists

**Purpose**: Checklist templates for recurring staff tasks

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | `uuid` | No | `gen_random_uuid()` | Primary key |
| `shop_id` | `uuid` | No | - | Foreign key to shops |
| `name` | `string` | No | - | Checklist name/title |
| `description` | `string` | Yes | `null` | Optional description |
| `is_active` | `boolean` | No | `true` | Active/inactive status |
| `created_by` | `uuid` | Yes | `null` | Foreign key to profiles (creator) |
| `created_at` | `timestamp` | No | `now()` | Record creation timestamp |

**Foreign Keys**:
- `shop_id` → `shops.id`
- `created_by` → `profiles.id`

**Relationships**:
- One-to-many with `checklist_items` (one checklist has many items)
- One-to-many with `staff_checklist_assignments` (assigned to staff)

**Use Cases**:
- Daily opening/closing procedures
- Cleaning schedules
- Safety checklists
- Training checklists

---

### expense_categories

**Purpose**: Categories for expense classification

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | `uuid` | No | `gen_random_uuid()` | Primary key |
| `shop_id` | `uuid` | No | - | Foreign key to shops |
| `name` | `string` | No | - | Category name |
| `description` | `string` | Yes | `null` | Optional description |
| `created_by` | `uuid` | Yes | `null` | Foreign key to profiles (creator) |
| `created_at` | `timestamp` | No | `now()` | Record creation timestamp |

**Foreign Keys**:
- `shop_id` → `shops.id`
- `created_by` → `profiles.id`

**Relationships**:
- One-to-many with `financial_transactions` (expenses use categories)

**Use Cases**:
- Expense classification
- Budget tracking by category
- Financial reporting

---

### financial_transactions

**Purpose**: Records all financial transactions (sales, expenses, adjustments)

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | `uuid` | No | `gen_random_uuid()` | Primary key |
| `shop_id` | `uuid` | No | - | Foreign key to shops |
| `type` | `financial_tx_type` | No | - | Enum: 'sale', 'expense', 'adjustment' |
| `amount` | `numeric` | No | - | Transaction amount |
| `occurred_at` | `timestamp` | No | - | When transaction occurred |
| `payment_method` | `string` | Yes | `null` | Payment method (cash, card, etc.) |
| `description` | `string` | Yes | `null` | Optional notes |
| `related_sale_id` | `uuid` | Yes | `null` | Foreign key to sales (if type=sale) |
| `expense_category_id` | `uuid` | Yes | `null` | Foreign key to expense_categories (if type=expense) |
| `created_by` | `uuid` | Yes | `null` | Foreign key to profiles (who recorded) |
| `created_at` | `timestamp` | No | `now()` | Record creation timestamp |

**Foreign Keys**:
- `shop_id` → `shops.id`
- `created_by` → `profiles.id`
- `expense_category_id` → `expense_categories.id`
- `related_sale_id` → `sales.id`

**Use Cases**:
- Cash flow tracking
- Daily closing reports
- Expense management
- Financial analytics

---

### inventory_adjustments

**Purpose**: Audit trail for inventory status changes

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | `uuid` | No | `gen_random_uuid()` | Primary key |
| `shop_id` | `uuid` | No | - | Foreign key to shops |
| `inventory_item_id` | `uuid` | No | - | Foreign key to inventory_items |
| `old_status` | `inventory_status` | No | - | Previous status |
| `new_status` | `inventory_status` | No | - | New status |
| `reason` | `string` | No | - | Reason for adjustment |
| `adjusted_by` | `uuid` | Yes | `null` | Foreign key to profiles (who adjusted) |
| `created_at` | `timestamp` | No | `now()` | When adjustment was made |

**Foreign Keys**:
- `shop_id` → `shops.id`
- `inventory_item_id` → `inventory_items.id`
- `adjusted_by` → `profiles.id`

**Use Cases**:
- Damage reporting
- Inventory audits
- Loss prevention tracking
- Staff accountability

---

### inventory_items

**Purpose**: Individual inventory units (one per QR code). Each item stores its own pricing and sale type, copied from the lot at creation time.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | `uuid` | No | `gen_random_uuid()` | Primary key |
| `shop_id` | `uuid` | No | - | Foreign key to shops |
| `lot_id` | `uuid` | No | - | Foreign key to lots (which batch) |
| `qr_code_id` | `uuid` | No | - | Foreign key to qr_codes (unique QR) |
| `status` | `inventory_status` | No | `'available'` | Enum: available, reserved, sold, damaged, returned |
| `selling_price` | `numeric` | No | - | Item selling price (copied from lot at creation, editable per-item) |
| `cost_price` | `numeric` | No | - | Item cost price (copied from lot at creation) | 
| `tax_rate` | `numeric` | No | `0` | Tax percentage (copied from lot at creation) |
| `sale_type` | `text` | Yes | `null` | Sale classification: 'festival', 'clearance', 'promotion', or null for normal. Copied from lot, editable per-item |
| `sale_reason` | `text` | Yes | `null` | Free-text description of the sale (e.g. "Summer clearance"). Copied from lot, editable per-item |
| `sale_item_id` | `uuid` | Yes | `null` | Foreign key to sale_items (if sold) |
| `sold_at` | `timestamp` | Yes | `null` | Timestamp when sold |
| `created_at` | `timestamp` | No | `now()` | Record creation timestamp |

**Foreign Keys**:
- `shop_id` → `shops.id`
- `lot_id` → `lots.id`
- `qr_code_id` → `qr_codes.id` (one-to-one)
- `sale_item_id` → `sale_items.id`

**Unique Constraints**:
- `qr_code_id` is unique (one QR per item)

**Pricing Architecture**:
- Prices are copied from the lot to each item at creation (one-way snapshot)
- Editing a lot's price bulk-updates all available items in that lot
- Individual item prices can be edited independently via EditInventoryItemDialog
- Sold items retain the price they had at time of sale (immutable after sale)
- Price flow: LOT → INVENTORY_ITEM (copy) → CART_ITEM (read) → SALE_ITEM (snapshot)

**Use Cases**:
- Track individual items
- QR code scanning at POS
- Inventory status management
- Per-item pricing overrides
- Sales linkage

---

### lots

**Purpose**: Stock batches/lots with cost and pricing information

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | `uuid` | No | `gen_random_uuid()` | Primary key |
| `shop_id` | `uuid` | No | - | Foreign key to shops |
| `quantity` | `integer` | No | - | Number of items in lot |
| `cost_price_per_unit` | `numeric` | No | - | Purchase cost per unit |
| `selling_price_default` | `numeric` | No | - | Default selling price |
| `tax_rate` | `numeric` | No | `0` | Tax percentage (e.g., 18 for 18%) |
| `date_of_stock_arrival` | `date` | No | - | When stock arrived |
| `category_id` | `uuid` | Yes | `null` | Foreign key to categories |
| `size_id` | `uuid` | Yes | `null` | Foreign key to sizes |
| `free_text_size` | `string` | Yes | `null` | Alternative to size_id |
| `created_by` | `uuid` | Yes | `null` | Foreign key to profiles (who created) |
| `created_at` | `timestamp` | No | `now()` | Record creation timestamp |

**Foreign Keys**:
- `shop_id` → `shops.id`
- `category_id` → `categories.id`
- `size_id` → `sizes.id`
- `created_by` → `profiles.id`

**Relationships**:
- One-to-many with `inventory_items` (one lot has many items)

**Use Cases**:
- Bulk stock entry
- Cost tracking
- Profit margin calculation
- Stock arrival management

---

### profiles

**Purpose**: User profiles and authentication (extends Supabase auth.users)

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | `uuid` | No | - | Primary key (matches auth.users.id) |
| `full_name` | `string` | No | - | User's full name |
| `phone` | `string` | Yes | `null` | Contact phone number |
| `role` | `user_role` | No | `'staff'` | Enum: superadmin, owner, admin, staff |
| `shop_id` | `uuid` | Yes | `null` | Foreign key to shops (null for superadmin) |
| `is_active` | `boolean` | No | `true` | Active/inactive status |
| `max_discount_percent` | `numeric` | No | `0` | Maximum discount user can apply |
| `created_at` | `timestamp` | No | `now()` | Record creation timestamp |

**Foreign Keys**:
- `shop_id` → `shops.id`

**Special Notes**:
- `id` must match Supabase `auth.users.id`
- Superadmins have `shop_id = null`
- Used for RLS policies

**Use Cases**:
- Authentication
- Authorization
- Multi-shop access control
- Staff permissions

---

### qr_codes

**Purpose**: QR code pool for inventory assignment

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | `uuid` | No | `gen_random_uuid()` | Primary key |
| `shop_id` | `uuid` | No | - | Foreign key to shops |
| `code` | `string` | No | - | QR code value (e.g., "WMN-00001") |
| `status` | `qr_status` | No | `'unused'` | Enum: unused, assigned, sold, lost |
| `assigned_at` | `timestamp` | Yes | `null` | When assigned to inventory |
| `sold_at` | `timestamp` | Yes | `null` | When item with QR was sold |
| `created_at` | `timestamp` | No | `now()` | Record creation timestamp |

**Foreign Keys**:
- `shop_id` → `shops.id`

**Unique Constraints**:
- `code` is likely unique per shop or globally

**Relationships**:
- One-to-one with `inventory_items` (when assigned)

**Use Cases**:
- Pre-generate QR codes in bulk
- Assign to inventory items
- Track QR code lifecycle
- Prevent QR exhaustion

---

### sale_items

**Purpose**: Line items within a sale (individual products sold)

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | `uuid` | No | `gen_random_uuid()` | Primary key |
| `shop_id` | `uuid` | No | - | Foreign key to shops |
| `sale_id` | `uuid` | No | - | Foreign key to sales (parent sale) |
| `inventory_item_id` | `uuid` | No | - | Foreign key to inventory_items (one-to-one) |
| `original_price` | `numeric` | No | - | Price before discount |
| `final_price` | `numeric` | No | - | Price after discount |
| `tax_amount` | `numeric` | No | `0` | Tax amount included |
| `discount_reason` | `string` | Yes | `null` | Reason for discount (if any) |
| `created_at` | `timestamp` | No | `now()` | Record creation timestamp |

**Foreign Keys**:
- `shop_id` → `shops.id`
- `sale_id` → `sales.id`
- `inventory_item_id` → `inventory_items.id` (one-to-one)

**Unique Constraints**:
- `inventory_item_id` is unique (one item can only be sold once)

**Use Cases**:
- Sales receipt line items
- Discount tracking
- Tax calculation
- Inventory linkage

---

### sale_returns

**Purpose**: Track product returns and refunds

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | `uuid` | No | `gen_random_uuid()` | Primary key |
| `shop_id` | `uuid` | No | - | Foreign key to shops |
| `original_sale_id` | `uuid` | No | - | Foreign key to sales (being returned) |
| `return_sale_id` | `uuid` | Yes | `null` | Foreign key to sales (return transaction) |
| `returned_items` | `json` | No | - | JSON array of returned item details |
| `return_reason` | `string` | Yes | `null` | Why items were returned |
| `refund_amount` | `numeric` | Yes | `null` | Total refund amount |
| `processed_by` | `uuid` | Yes | `null` | Foreign key to profiles (who processed) |
| `created_at` | `timestamp` | No | `now()` | When return was processed |

**Foreign Keys**:
- `shop_id` → `shops.id`
- `original_sale_id` → `sales.id`
- `return_sale_id` → `sales.id`
- `processed_by` → `profiles.id`

**Use Cases**:
- Process returns
- Track return reasons
- Refund management
- Inventory restoration

---

### sales

**Purpose**: Sale transactions (header/parent record)

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | `uuid` | No | `gen_random_uuid()` | Primary key |
| `shop_id` | `uuid` | No | - | Foreign key to shops |
| `bill_number` | `integer` | Yes | - | Sequential bill number (shop-specific) |
| `client_sale_id` | `string` | Yes | `null` | Offline UUID for sync |
| `payment_method` | `string` | No | - | Payment method (cash, card, upi) |
| `subtotal_amount` | `numeric` | No | - | Total before tax |
| `total_tax` | `numeric` | No | `0` | Total tax amount |
| `total_discount` | `numeric` | No | `0` | Total discount amount |
| `total_amount` | `numeric` | No | - | Final amount (subtotal + tax - discount) |
| `customer_name` | `string` | Yes | `null` | Optional customer name |
| `customer_phone` | `string` | Yes | `null` | Optional customer phone |
| `created_by` | `uuid` | Yes | `null` | Foreign key to profiles (cashier) |
| `created_at` | `timestamp` | No | `now()` | Sale timestamp |

**Foreign Keys**:
- `shop_id` → `shops.id`
- `created_by` → `profiles.id`

**Relationships**:
- One-to-many with `sale_items` (one sale has many items)
- One-to-many with `sale_returns` (can be returned)
- One-to-one with `financial_transactions` (via `related_sale_id`)

**Use Cases**:
- POS transactions
- Receipt generation
- Sales reporting
- Customer records

---

### shops

**Purpose**: Store/shop entities (multi-tenancy root)

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | `uuid` | No | `gen_random_uuid()` | Primary key |
| `shop_name` | `string` | No | - | Shop name |
| `address` | `string` | Yes | `null` | Shop address |
| `phone` | `string` | Yes | `null` | Shop phone number |
| `tax_rate` | `numeric` | No | `18` | Default tax percentage |
| `bill_prefix` | `string` | No | `'WMN'` | Prefix for bill numbers |
| `created_at` | `timestamp` | No | `now()` | Record creation timestamp |

**Relationships**:
- One-to-many with almost all tables (multi-tenancy parent)

**Use Cases**:
- Multi-shop management
- Shop-specific settings
- Data isolation
- Receipt customization

---

### sizes

**Purpose**: Predefined size values for products

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | `uuid` | No | `gen_random_uuid()` | Primary key |
| `shop_id` | `uuid` | No | - | Foreign key to shops |
| `size_name` | `string` | No | - | Size label (S, M, L, 32, etc.) |
| `sort_order` | `integer` | No | `0` | Display order |
| `created_at` | `timestamp` | No | `now()` | Record creation timestamp |

**Foreign Keys**:
- `shop_id` → `shops.id`

**Relationships**:
- One-to-many with `lots` (one size used in many lots)

**Use Cases**:
- Product size classification
- Inventory filtering
- Standardize size values

---

### staff_checklist_assignments

**Purpose**: Assigns checklist templates to staff for specific dates

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | `uuid` | No | `gen_random_uuid()` | Primary key |
| `shop_id` | `uuid` | No | - | Foreign key to shops |
| `staff_id` | `uuid` | No | - | Foreign key to profiles |
| `checklist_id` | `uuid` | No | - | Foreign key to checklists |
| `date` | `date` | No | - | Date checklist is assigned for |
| `status` | `checklist_status` | No | `'pending'` | Enum: pending, completed, partial |
| `created_at` | `timestamp` | No | `now()` | Record creation timestamp |

**Foreign Keys**:
- `shop_id` → `shops.id`
- `staff_id` → `profiles.id`
- `checklist_id` → `checklists.id`

**Relationships**:
- One-to-many with `staff_checklist_item_status` (tracks each item)

**Use Cases**:
- Daily task assignment
- Staff accountability
- Progress tracking
- Manager oversight

---

### staff_checklist_item_status

**Purpose**: Tracks completion status of individual checklist items

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | `uuid` | No | `gen_random_uuid()` | Primary key |
| `assignment_id` | `uuid` | No | - | Foreign key to staff_checklist_assignments |
| `checklist_item_id` | `uuid` | No | - | Foreign key to checklist_items |
| `is_completed` | `boolean` | Yes | `false` | Completion status |
| `completed_at` | `timestamp` | Yes | `null` | When item was completed |
| `updated_at` | `timestamp` | No | `now()` | Last update timestamp |

**Foreign Keys**:
- `assignment_id` → `staff_checklist_assignments.id`
- `checklist_item_id` → `checklist_items.id`

**Use Cases**:
- Track task completion
- Calculate checklist progress
- Timestamp completion
- Audit trail

---

### tax_settings

**Purpose**: Shop-specific tax configuration

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `shop_id` | `uuid` | No | - | Primary key & foreign key to shops |
| `default_tax_rate` | `numeric` | No | `18` | Default tax percentage |
| `is_tax_inclusive` | `boolean` | No | `false` | Whether prices include tax |
| `gst_number` | `string` | Yes | `null` | GST registration number |

**Foreign Keys**:
- `shop_id` → `shops.id` (one-to-one)

**Unique Constraints**:
- `shop_id` is unique (one setting per shop)

**Use Cases**:
- Tax calculation
- Invoice formatting
- Compliance
- Regional tax rules

---

## Enums

### attendance_status

**Values**: `'open'` | `'closed'`

**Usage**: `attendance_logs.status`

**Description**:
- `open`: Staff is currently clocked in
- `closed`: Staff has clocked out

---

### checklist_item_status

**Values**: `'pending'` | `'done'` | `'na'`

**Usage**: (Not directly used in tables, but defined for future use)

**Description**:
- `pending`: Task not yet started
- `done`: Task completed
- `na`: Task not applicable

---

### checklist_status

**Values**: `'pending'` | `'completed'` | `'partial'`

**Usage**: `staff_checklist_assignments.status`

**Description**:
- `pending`: No items completed
- `completed`: All items completed
- `partial`: Some items completed

---

### financial_tx_type

**Values**: `'sale'` | `'expense'` | `'adjustment'`

**Usage**: `financial_transactions.type`

**Description**:
- `sale`: Revenue from sales
- `expense`: Money spent (bills, salaries, etc.)
- `adjustment`: Manual corrections

---

### inventory_status

**Values**: `'available'` | `'reserved'` | `'sold'` | `'damaged'` | `'returned'`

**Usage**: `inventory_items.status`, `inventory_adjustments.old_status`, `inventory_adjustments.new_status`

**Description**:
- `available`: In stock and sellable
- `reserved`: Hold for customer/pending sale
- `sold`: Item has been sold
- `damaged`: Item is damaged/unsellable
- `returned`: Item was returned by customer

---

### qr_status

**Values**: `'unused'` | `'assigned'` | `'sold'` | `'lost'`

**Usage**: `qr_codes.status`

**Description**:
- `unused`: QR code available for assignment
- `assigned`: QR code assigned to inventory item
- `sold`: Item with this QR was sold
- `lost`: QR code lost/damaged (can't be used)

---

### user_role

**Values**: `'superadmin'` | `'owner'` | `'admin'` | `'staff'`

**Usage**: `profiles.role`

**Description**:
- `superadmin`: System administrator (multi-shop access)
- `owner`: Shop owner (full shop access)
- `admin`: Shop manager (most permissions)
- `staff`: Regular staff (limited permissions)

**Permission Hierarchy**: superadmin > owner > admin > staff

---

## Functions

### current_profile()

**Returns**: `uuid`

**Description**: Returns the current authenticated user's profile ID

**Usage**: `SELECT current_profile()`

---

### current_role()

**Returns**: `user_role` enum

**Description**: Returns the current authenticated user's role

**Usage**: `SELECT current_role()`

---

### current_shop_id()

**Returns**: `uuid`

**Description**: Returns the current authenticated user's shop ID

**Usage**: `SELECT current_shop_id()`

---

### generate_bill_number(p_shop_id)

**Arguments**:
- `p_shop_id`: `uuid` - Shop ID to generate bill number for

**Returns**: `integer`

**Description**: Generates sequential bill number for a shop

**Usage**: `SELECT generate_bill_number('shop-uuid')`

**Implementation**: Likely uses a sequence or MAX + 1 logic

---

### is_admin()

**Returns**: `boolean`

**Description**: Checks if current user has admin role or higher

**Usage**: `SELECT is_admin()`

**Permission Check**: Returns true if role is 'admin', 'owner', or 'superadmin'

---

### is_staff_or_higher()

**Returns**: `boolean`

**Description**: Checks if current user has staff role or higher

**Usage**: `SELECT is_staff_or_higher()`

**Permission Check**: Returns true for any authenticated user

---

### is_superadmin()

**Returns**: `boolean`

**Description**: Checks if current user is a superadmin

**Usage**: `SELECT is_superadmin()`

**Permission Check**: Returns true only if role is 'superadmin'

---

## Relationships Overview

### Core Entity Relationships

```
shops (root)
├── profiles (staff/users)
│   ├── attendance_logs
│   ├── checklists (created_by)
│   ├── expense_categories (created_by)
│   ├── financial_transactions (created_by)
│   ├── inventory_adjustments (adjusted_by)
│   ├── lots (created_by)
│   ├── sale_returns (processed_by)
│   ├── sales (created_by)
│   └── staff_checklist_assignments
│
├── categories
│   └── lots
│       └── inventory_items
│           ├── sale_items (one-to-one)
│           └── inventory_adjustments
│
├── sizes
│   └── lots
│
├── qr_codes
│   └── inventory_items (one-to-one)
│
├── checklists
│   ├── checklist_items
│   └── staff_checklist_assignments
│       └── staff_checklist_item_status
│
├── expense_categories
│   └── financial_transactions (type=expense)
│
├── sales
│   ├── sale_items
│   ├── sale_returns (original_sale_id)
│   ├── sale_returns (return_sale_id)
│   └── financial_transactions (related_sale_id)
│
└── tax_settings (one-to-one)
```

### Key One-to-One Relationships

- `inventory_items.qr_code_id` → `qr_codes.id` (unique)
- `sale_items.inventory_item_id` → `inventory_items.id` (unique)
- `tax_settings.shop_id` → `shops.id` (unique)

### Key One-to-Many Relationships

- One `shop` has many `profiles`, `categories`, `lots`, `sales`, etc.
- One `lot` has many `inventory_items`
- One `sale` has many `sale_items`
- One `checklist` has many `checklist_items`
- One `staff_checklist_assignment` has many `staff_checklist_item_status` records

### Circular/Complex Relationships

- `sale_returns` references both `original_sale_id` and `return_sale_id` (both point to `sales`)
- `profiles` can be `created_by`, `adjusted_by`, `processed_by` in multiple tables

---

## Database Constraints Summary

### Primary Keys
- All tables use UUID primary keys (`id` column)
- `tax_settings` uses `shop_id` as primary key

### Unique Constraints
- `inventory_items.qr_code_id` (one QR per item)
- `sale_items.inventory_item_id` (item sold once)
- `tax_settings.shop_id` (one setting per shop)
- Likely: `qr_codes.code` (unique QR values)

### Foreign Keys
- **Total**: ~50+ foreign key relationships
- **Most common**: All tables reference `shops.id`
- **Critical**: Inventory chain (lots → inventory_items → sale_items)

### Check Constraints
- Not defined in TypeScript types (may exist in database)
- Likely on: `amounts > 0`, `tax_rate >= 0`, `quantity > 0`

### Defaults
- Most IDs: `gen_random_uuid()`
- Most timestamps: `now()`
- Boolean fields: `true` or `false`
- Numeric fields: `0`

---

## RLS (Row Level Security) Policies

**Note**: RLS policies are not defined in the TypeScript types file but are likely implemented in the database.

### Expected RLS Patterns

1. **Shop Isolation**: Users can only access data for their own shop
   - Policy: `shop_id = current_shop_id()`

2. **Role-Based Access**:
   - Superadmins: Access all shops
   - Owners/Admins: Full access to their shop
   - Staff: Limited access (no delete on sales, etc.)

3. **Self-Access**: Staff can view/edit their own records
   - Policy: `staff_id = current_profile()` for `attendance_logs`

### Files with RLS Migrations
- `supabase/migrations/20241222_financial_transactions_rls.sql`
- `supabase/migrations/20241222_qr_codes_rls.sql`

---

## Data Flow Examples

### Sale Flow
```
1. Staff scans QR code → reads `qr_codes` table
2. Find inventory item: `inventory_items` WHERE `qr_code_id` = scanned_code
3. Check `lot_id` to get pricing from `lots` table
4. Create `sales` record (header)
5. Create `sale_items` records (line items)
6. Update `inventory_items.status` = 'sold'
7. Update `qr_codes.status` = 'sold'
8. Create `financial_transactions` record (type='sale')
```

### Stock Entry Flow
```
1. Admin creates `lot` record (quantity, pricing, category, size)
2. System assigns `quantity` number of `qr_codes` (status='unused' → 'assigned')
3. System creates `quantity` number of `inventory_items` (status='available')
4. Each `inventory_item` links to one `qr_code` (one-to-one)
```

### Checklist Assignment Flow
```
1. Admin creates `checklists` template (name, description)
2. Admin adds `checklist_items` to template (labels, sort order)
3. System/Admin assigns to staff: create `staff_checklist_assignments` (staff_id, date)
4. System auto-creates `staff_checklist_item_status` for each item in template
5. Staff marks items complete → update `is_completed`, `completed_at`
6. When all items done → update `staff_checklist_assignments.status` = 'completed'
```

### Attendance Flow
```
1. Staff clocks in → INSERT `attendance_logs` (clock_in, status='open')
2. Staff takes breaks → increment `total_break_minutes`
3. Staff clocks out → UPDATE `attendance_logs` (clock_out, status='closed')
```

---

## Performance Considerations

### Indexes Needed (Not in TypeScript types)

**Critical Indexes**:
- `inventory_items(qr_code_id)` - For POS scanning
- `inventory_items(status, shop_id)` - For available inventory queries
- `sales(shop_id, created_at)` - For sales reports
- `sale_items(sale_id)` - For order lookup
- `attendance_logs(staff_id, date)` - For attendance reports
- `qr_codes(code, shop_id)` - For QR scanning
- `financial_transactions(shop_id, occurred_at)` - For financial reports

**Composite Indexes**:
- `staff_checklist_assignments(staff_id, date, status)`
- `inventory_items(shop_id, status, lot_id)`

### Query Optimization Tips

1. **Pagination**: Always use `LIMIT` and `OFFSET` for large tables (sales, inventory_items)
2. **Aggregations**: Use database functions instead of client-side calculations
3. **Joins**: Prefer `EXISTS` over `JOIN` for checking existence
4. **Date Ranges**: Use indexed `created_at` columns with `>=` and `<` operators

---

## Migration Files

Based on `supabase/migrations/` folder:

| File | Purpose |
|------|---------|
| `20241222_bill_number_function.sql` | Generate sequential bill numbers |
| `20241222_expense_categories.sql` | Create expense categories table |
| `20241222_financial_transactions_rls.sql` | RLS policies for financial transactions |
| `20241222_qr_codes_rls.sql` | RLS policies for QR codes |
| `apply_settings_migration.sql` | Apply settings changes |
| `create_superadmin.sql` | Create initial superadmin user |
| `create_test_profiles.sql` | Create test users |
| `debug_database.sql` | Debug queries |
| `debug_qr_code.sql` | Debug QR code issues |
| `extract_schema.sql` | Schema extraction utility |

---

## Common Queries

### Get Available Inventory Count
```sql
SELECT COUNT(*) 
FROM inventory_items 
WHERE shop_id = 'shop-uuid' 
  AND status = 'available';
```

### Get Today's Sales Total
```sql
SELECT SUM(total_amount) 
FROM sales 
WHERE shop_id = 'shop-uuid' 
  AND created_at >= CURRENT_DATE;
```

### Get Staff Attendance Today
```sql
SELECT * 
FROM attendance_logs 
WHERE shop_id = 'shop-uuid' 
  AND date = CURRENT_DATE;
```

### Get Pending Checklists for Staff
```sql
SELECT * 
FROM staff_checklist_assignments 
WHERE staff_id = 'user-uuid' 
  AND date = CURRENT_DATE 
  AND status != 'completed';
```

### Get Low Stock Categories
```sql
SELECT c.name, COUNT(ii.id) as available_count
FROM categories c
LEFT JOIN lots l ON l.category_id = c.id
LEFT JOIN inventory_items ii ON ii.lot_id = l.id AND ii.status = 'available'
WHERE c.shop_id = 'shop-uuid'
GROUP BY c.id, c.name
HAVING COUNT(ii.id) < 10
ORDER BY available_count ASC;
```

---

## Important Notes for AI Context

### Remember These Tables

**Core Sales Tables**: `sales`, `sale_items`, `inventory_items`, `lots`, `qr_codes`

**Staff Management Tables**: `attendance_logs`, `checklists`, `checklist_items`, `staff_checklist_assignments`, `staff_checklist_item_status`

**Financial Tables**: `financial_transactions`, `expense_categories`

**Master Data Tables**: `shops`, `profiles`, `categories`, `sizes`, `tax_settings`

**Audit Tables**: `inventory_adjustments`, `sale_returns`

### Critical Relationships to Remember

1. **QR → Inventory → Sale**: `qr_codes` (one-to-one) `inventory_items` (one-to-one) `sale_items`
2. **Lot → Inventory**: One lot creates many inventory items
3. **Shop → Everything**: All tables have `shop_id` for multi-tenancy
4. **Profile → Actions**: Many tables track `created_by`, `adjusted_by`, `processed_by`

### Don't Forget

- All primary keys are UUIDs
- All tables have `shop_id` except `shops` itself
- Timestamps use `timestamp with time zone`
- RLS policies enforce shop isolation
- Bill numbers are sequential per shop
- QR codes are one-to-one with inventory items
- Staff checklists use a template system (checklists → checklist_items)

---

## TypeScript Usage Examples

### Query Type Safety

```typescript
import { Database } from '@/types/database.types';

type AttendanceLog = Database['public']['Tables']['attendance_logs']['Row'];
type AttendanceInsert = Database['public']['Tables']['attendance_logs']['Insert'];
type AttendanceUpdate = Database['public']['Tables']['attendance_logs']['Update'];

// Query with type safety
const { data } = await supabase
  .from('attendance_logs')
  .select('*')
  .eq('staff_id', userId)
  .returns<AttendanceLog[]>();

// Insert with type safety
const { data } = await supabase
  .from('attendance_logs')
  .insert<AttendanceInsert>({
    staff_id: userId,
    shop_id: shopId,
    date: '2024-01-01',
    clock_in: '09:00:00',
    // clock_out is optional
  });
```

### Enum Type Safety

```typescript
import { Database } from '@/types/database.types';

type UserRole = Database['public']['Enums']['user_role'];
type InventoryStatus = Database['public']['Enums']['inventory_status'];

const role: UserRole = 'admin'; // Type-safe
const status: InventoryStatus = 'available'; // Type-safe
```

---

**End of Documentation**

*This file is auto-generated from `src/types/database.types.ts`. To update, regenerate types using `npx supabase gen types typescript --local > src/types/database.types.ts`*
