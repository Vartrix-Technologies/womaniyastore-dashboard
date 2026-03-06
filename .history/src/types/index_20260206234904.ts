// Application-wide types

import type { Database } from './database.types';

// Re-export database types for convenience
export type Profile = Database['public']['Tables']['profiles']['Row'];
export type Shop = Database['public']['Tables']['shops']['Row'];
export type Category = Database['public']['Tables']['categories']['Row'];
export type Size = Database['public']['Tables']['sizes']['Row'];
export type QrCode = Database['public']['Tables']['qr_codes']['Row'];
export type QrPrefix = Database['public']['Tables']['qr_prefixes']['Row'];
export type Lot = Database['public']['Tables']['lots']['Row'];
export type InventoryItem = Database['public']['Tables']['inventory_items']['Row'];
export type Sale = Database['public']['Tables']['sales']['Row'];
export type SaleItem = Database['public']['Tables']['sale_items']['Row'];
export type ExpenseCategory = Database['public']['Tables']['expense_categories']['Row'];
export type FinancialTransaction = Database['public']['Tables']['financial_transactions']['Row'];
export type AttendanceLog = Database['public']['Tables']['attendance_logs']['Row'];
export type Checklist = Database['public']['Tables']['checklists']['Row'];
export type ChecklistItem = Database['public']['Tables']['checklist_items']['Row'];
export type StaffChecklistAssignment = Database['public']['Tables']['staff_checklist_assignments']['Row'];
export type StaffChecklistItemStatus = Database['public']['Tables']['staff_checklist_item_status']['Row'];
export type InventoryAdjustment = Database['public']['Tables']['inventory_adjustments']['Row'];
export type SaleReturn = Database['public']['Tables']['sale_returns']['Row'];
export type TaxSettings = Database['public']['Tables']['tax_settings']['Row'];

// Re-export enums
export type UserRole = Database['public']['Enums']['user_role'];
export type QrStatus = Database['public']['Enums']['qr_status'];
export type InventoryStatus = Database['public']['Enums']['inventory_status'];
export type FinancialTxType = Database['public']['Enums']['financial_tx_type'];
export type AttendanceStatus = Database['public']['Enums']['attendance_status'];
export type ChecklistStatus = Database['public']['Enums']['checklist_status'];
export type ChecklistItemStatus = Database['public']['Enums']['checklist_item_status'];

// Extended types with relations
export type InventoryItemWithDetails = InventoryItem & {
  lot: Lot & {
    category: Category | null;
    size: Size | null;
  };
  qr_code: QrCode;
};

export type SaleWithItems = Sale & {
  sale_items: (SaleItem & {
    inventory_item: InventoryItemWithDetails;
  })[];
  created_by_profile: Profile | null;
};

export type AttendanceLogWithProfile = AttendanceLog & {
  staff: Profile;
};

// ============================================
// Extended Types for Admin Page Queries
// ============================================

/**
 * Inventory page - inventory items with nested lot, category, size, qr_code
 */
export interface InventoryItemForList {
  id: string;
  status: InventoryStatus;
  sold_at: string | null;
  created_at: string;
  shop_id: string;
  qr_codes: {
    code: string;
    id: string;
  } | null;
  lots: {
    id: string;
    selling_price_default: number | null;
    cost_price_per_unit: number | null;
    tax_rate: number | null;
    date_of_stock_arrival: string | null;
    vendor_name: string | null;
    sale_type: string | null;
    min_margin_percent: number | null;
    sale_reason: string | null;
    categories: { id: string; name: string } | null;
    sizes: { size_name: string } | null;
    free_text_size: string | null;
  } | null;
}

/**
 * Sales page - sales with sale_items for filtering
 */
export interface SaleForList {
  id: string;
  shop_id: string;
  bill_number: number;
  bill_prefix: string | null;
  total_amount: number;
  total_discount: number | null;
  payment_method: string;
  customer_name: string | null;
  customer_phone: string | null;
  notes: string | null;
  created_at: string;
  created_by: string | null;
  sale_items: {
    id: string;
    sale_id: string;
    inventory_item_id: string;
    original_price: number;
    final_price: number;
    discount_reason: string | null;
    tax_amount: number | null;
    sold_on_sale: boolean | null;
    sale_type: string | null;
  }[];
}

/**
 * Finances page - transactions with expense category
 */
export interface FinancialTransactionForList {
  id: string;
  shop_id: string;
  type: FinancialTxType;
  amount: number;
  description: string | null;
  occurred_at: string;
  created_by: string | null;
  expense_category_id: string | null;
  created_at: string;
  expense_category: {
    id: string;
    name: string;
  } | null;
}

/**
 * Attendance page - attendance logs with staff and editor profiles
 */
export interface AttendanceLogForList {
  id: string;
  shop_id: string;
  staff_id: string;
  date: string;
  clock_in: string | null;
  clock_out: string | null;
  total_break_minutes: number | null;
  is_manual_entry: boolean | null;
  manual_entry_reason: string | null;
  edited_at: string | null;
  edited_by: string | null;
  edit_reason: string | null;
  deleted_at: string | null;
  deleted_by: string | null;
  created_at: string;
  staff: {
    full_name: string;
    role: UserRole;
  } | null;
  edited_by_profile: {
    full_name: string;
  } | null;
}

/**
 * Staff member - simplified profile for dropdowns/lists
 */
export interface StaffMember {
  id: string;
  full_name: string;
  role: UserRole;
  email: string | null;
  shop_id: string | null;
}

/**
 * Checklists page - assignments with checklist details
 */
export interface ChecklistAssignmentForList {
  id: string;
  checklist_id: string;
  staff_id: string;
  assigned_date: string;
  items_completed: number | null;
  items_total: number | null;
  checklist: {
    recurrence_type: string;
    recurrence_days: number[] | null;
  } | null;
}

/**
 * Category stats for inventory page
 */
export interface CategoryStat {
  id: string;
  name: string;
  count?: number;
  total?: number;
  available?: number;
  sold?: number;
}

/**
 * Expense category for finances/settings
 */
export interface ExpenseCategoryForList {
  id: string;
  name: string;
  shop_id: string;
}

// Auth types
export interface AuthUser {
  id: string;
  email: string;
  profile: Profile | null;
}

export interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  error: Error | null;
}

// Online status
export interface OnlineStatus {
  isOnline: boolean;
  wasOffline: boolean;
}
