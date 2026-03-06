/**
 * Staff Performance API
 * 
 * Aggregation queries for staff-level analytics:
 * - Sales performance (count, revenue, items, avg sale value)
 * - Checklist completion (items completed, rate)
 * - Returns processed
 * - Attendance summary
 * 
 * All data already exists in the database — this module
 * provides the aggregation layer for the admin view.
 */

import { supabase } from '@/lib/supabase';

// ==========================================
// TYPES
// ==========================================

export interface StaffSalesPerformance {
  staffId: string;
  staffName: string;
  saleCount: number;
  totalRevenue: number;
  totalItems: number;
  avgSaleValue: number;
  totalDiscount: number;
}

export interface StaffChecklistPerformance {
  staffId: string;
  staffName: string;
  itemsCompleted: number;
}

export interface StaffReturnsPerformance {
  staffId: string;
  staffName: string;
  returnsProcessed: number;
  totalRefunded: number;
}

export interface StaffAttendanceSummary {
  staffId: string;
  staffName: string;
  daysPresent: number;
  totalHoursWorked: number;
}

export interface StaffPerformanceSummary {
  staffId: string;
  staffName: string;
  role: string;
  // Sales
  saleCount: number;
  totalRevenue: number;
  totalItems: number;
  avgSaleValue: number;
  totalDiscount: number;
  // Checklists
  checklistItemsCompleted: number;
  // Returns
  returnsProcessed: number;
  totalRefunded: number;
  // Attendance
  daysPresent: number;
  totalHoursWorked: number;
}

// ==========================================
// DATE HELPERS
// ==========================================

function getDateRangeFilter(dateRange: 'today' | 'week' | 'month' | 'all', customStart?: string, customEnd?: string) {
  const now = new Date();
  let start: string | null = null;
  let end: string | null = null;

  switch (dateRange) {
    case 'today': {
      const today = new Date(now);
      today.setHours(0, 0, 0, 0);
      start = today.toISOString();
      break;
    }
    case 'week': {
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);
      weekAgo.setHours(0, 0, 0, 0);
      start = weekAgo.toISOString();
      break;
    }
    case 'month': {
      const monthAgo = new Date(now);
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      monthAgo.setHours(0, 0, 0, 0);
      start = monthAgo.toISOString();
      break;
    }
    case 'all':
    default:
      if (customStart) start = customStart;
      if (customEnd) end = customEnd;
      break;
  }

  return { start, end };
}

// ==========================================
// SALES PERFORMANCE
// ==========================================

export async function getStaffSalesPerformance(
  shopId: string,
  dateRange: 'today' | 'week' | 'month' | 'all' = 'week',
  customStart?: string,
  customEnd?: string,
): Promise<StaffSalesPerformance[]> {
  const { start, end } = getDateRangeFilter(dateRange, customStart, customEnd);

  // Fetch sales with creator profile and item count
  let query = supabase
    .from('sales')
    .select(`
      id,
      created_by,
      total_amount,
      total_discount,
      created_at,
      created_by_profile:profiles!sales_created_by_fkey(id, full_name),
      sale_items(id)
    `)
    .eq('shop_id', shopId)
    .not('created_by', 'is', null);

  if (start) query = query.gte('created_at', start);
  if (end) query = query.lte('created_at', end);

  const { data, error } = await query;
  if (error) throw error;

  // Aggregate by staff
  const staffMap = new Map<string, StaffSalesPerformance>();

  (data || []).forEach((sale: any) => {
    const staffId = sale.created_by;
    const staffName = sale.created_by_profile?.full_name || 'Unknown';

    if (!staffMap.has(staffId)) {
      staffMap.set(staffId, {
        staffId,
        staffName,
        saleCount: 0,
        totalRevenue: 0,
        totalItems: 0,
        avgSaleValue: 0,
        totalDiscount: 0,
      });
    }

    const entry = staffMap.get(staffId)!;
    entry.saleCount += 1;
    entry.totalRevenue += sale.total_amount || 0;
    entry.totalDiscount += sale.total_discount || 0;
    entry.totalItems += sale.sale_items?.length || 0;
  });

  // Calculate averages
  const result = Array.from(staffMap.values()).map(s => ({
    ...s,
    avgSaleValue: s.saleCount > 0 ? s.totalRevenue / s.saleCount : 0,
  }));

  // Sort by revenue desc
  return result.sort((a, b) => b.totalRevenue - a.totalRevenue);
}

// ==========================================
// CHECKLIST PERFORMANCE
// ==========================================

export async function getStaffChecklistPerformance(
  shopId: string,
  dateRange: 'today' | 'week' | 'month' | 'all' = 'week',
  customStart?: string,
  customEnd?: string,
): Promise<StaffChecklistPerformance[]> {
  const { start, end } = getDateRangeFilter(dateRange, customStart, customEnd);

  // Get instances for this shop within date range
  let instanceQuery = supabase
    .from('checklist_instances')
    .select('id')
    .eq('shop_id', shopId);

  if (start) {
    const startDate = start.split('T')[0];
    instanceQuery = instanceQuery.gte('date', startDate);
  }
  if (end) {
    const endDate = end.split('T')[0];
    instanceQuery = instanceQuery.lte('date', endDate);
  }

  const { data: instances, error: instanceError } = await instanceQuery;
  if (instanceError) throw instanceError;

  if (!instances || instances.length === 0) return [];

  const instanceIds = instances.map(i => i.id);

  // Get completions for those instances
  const { data: completions, error: completionError } = await supabase
    .from('checklist_item_completions')
    .select(`
      completed_by,
      completed_by_profile:profiles!checklist_item_completions_completed_by_fkey(id, full_name)
    `)
    .in('instance_id', instanceIds);

  if (completionError) throw completionError;

  // Aggregate by staff
  const staffMap = new Map<string, StaffChecklistPerformance>();

  (completions || []).forEach((c: any) => {
    const staffId = c.completed_by;
    const staffName = c.completed_by_profile?.full_name || 'Unknown';

    if (!staffMap.has(staffId)) {
      staffMap.set(staffId, { staffId, staffName, itemsCompleted: 0 });
    }

    staffMap.get(staffId)!.itemsCompleted += 1;
  });

  return Array.from(staffMap.values()).sort((a, b) => b.itemsCompleted - a.itemsCompleted);
}

// ==========================================
// RETURNS PERFORMANCE
// ==========================================

export async function getStaffReturnsPerformance(
  shopId: string,
  dateRange: 'today' | 'week' | 'month' | 'all' = 'week',
  customStart?: string,
  customEnd?: string,
): Promise<StaffReturnsPerformance[]> {
  const { start, end } = getDateRangeFilter(dateRange, customStart, customEnd);

  let query = supabase
    .from('sale_returns')
    .select(`
      processed_by,
      refund_amount,
      created_at,
      processed_by_profile:profiles!sale_returns_processed_by_fkey(id, full_name)
    `)
    .eq('shop_id', shopId)
    .not('processed_by', 'is', null);

  if (start) query = query.gte('created_at', start);
  if (end) query = query.lte('created_at', end);

  const { data, error } = await query;
  if (error) throw error;

  const staffMap = new Map<string, StaffReturnsPerformance>();

  (data || []).forEach((r: any) => {
    const staffId = r.processed_by;
    const staffName = r.processed_by_profile?.full_name || 'Unknown';

    if (!staffMap.has(staffId)) {
      staffMap.set(staffId, { staffId, staffName, returnsProcessed: 0, totalRefunded: 0 });
    }

    const entry = staffMap.get(staffId)!;
    entry.returnsProcessed += 1;
    entry.totalRefunded += r.refund_amount || 0;
  });

  return Array.from(staffMap.values()).sort((a, b) => b.returnsProcessed - a.returnsProcessed);
}

// ==========================================
// ATTENDANCE SUMMARY
// ==========================================

export async function getStaffAttendanceSummary(
  shopId: string,
  dateRange: 'today' | 'week' | 'month' | 'all' = 'week',
  customStart?: string,
  customEnd?: string,
): Promise<StaffAttendanceSummary[]> {
  const { start, end } = getDateRangeFilter(dateRange, customStart, customEnd);

  let query = supabase
    .from('attendance_logs')
    .select(`
      staff_id,
      clock_in,
      clock_out,
      total_break_minutes,
      deleted_at,
      staff:profiles!attendance_logs_staff_id_fkey(id, full_name)
    `)
    .eq('shop_id', shopId)
    .is('deleted_at', null);

  if (start) query = query.gte('clock_in', start);
  if (end) query = query.lte('clock_in', end);

  const { data, error } = await query;
  if (error) throw error;

  const staffMap = new Map<string, StaffAttendanceSummary>();
  const staffDays = new Map<string, Set<string>>();

  (data || []).forEach((log: any) => {
    const staffId = log.staff_id;
    const staffName = log.staff?.full_name || 'Unknown';

    if (!staffMap.has(staffId)) {
      staffMap.set(staffId, { staffId, staffName, daysPresent: 0, totalHoursWorked: 0 });
      staffDays.set(staffId, new Set());
    }

    // Track unique days
    const date = log.clock_in?.split('T')[0];
    if (date) staffDays.get(staffId)!.add(date);

    // Calculate hours worked
    if (log.clock_in && log.clock_out) {
      const clockIn = new Date(log.clock_in).getTime();
      const clockOut = new Date(log.clock_out).getTime();
      const breakMs = (log.total_break_minutes || 0) * 60 * 1000;
      const workedMs = clockOut - clockIn - breakMs;
      if (workedMs > 0) {
        staffMap.get(staffId)!.totalHoursWorked += workedMs / (1000 * 60 * 60);
      }
    }
  });

  // Set unique days count
  staffMap.forEach((entry, staffId) => {
    entry.daysPresent = staffDays.get(staffId)?.size || 0;
    entry.totalHoursWorked = Math.round(entry.totalHoursWorked * 10) / 10;
  });

  return Array.from(staffMap.values()).sort((a, b) => b.totalHoursWorked - a.totalHoursWorked);
}

// ==========================================
// COMBINED SUMMARY
// ==========================================

/**
 * Fetch all staff performance metrics in parallel and merge into a single summary per staff.
 */
export async function getStaffPerformanceSummary(
  shopId: string,
  dateRange: 'today' | 'week' | 'month' | 'all' = 'week',
  customStart?: string,
  customEnd?: string,
): Promise<StaffPerformanceSummary[]> {
  // Run all queries in parallel
  const [sales, checklists, returns, attendance] = await Promise.all([
    getStaffSalesPerformance(shopId, dateRange, customStart, customEnd),
    getStaffChecklistPerformance(shopId, dateRange, customStart, customEnd),
    getStaffReturnsPerformance(shopId, dateRange, customStart, customEnd),
    getStaffAttendanceSummary(shopId, dateRange, customStart, customEnd),
  ]);

  // Also get all staff profiles for the shop (to include those with 0 activity)
  const { data: staffProfiles } = await supabase
    .from('profiles')
    .select('id, full_name, role')
    .eq('shop_id', shopId)
    .eq('is_active', true)
    .in('role', ['staff', 'admin', 'owner']);

  // Build combined map seeded with all active staff
  const summaryMap = new Map<string, StaffPerformanceSummary>();

  (staffProfiles || []).forEach(p => {
    summaryMap.set(p.id, {
      staffId: p.id,
      staffName: p.full_name,
      role: p.role,
      saleCount: 0,
      totalRevenue: 0,
      totalItems: 0,
      avgSaleValue: 0,
      totalDiscount: 0,
      checklistItemsCompleted: 0,
      returnsProcessed: 0,
      totalRefunded: 0,
      daysPresent: 0,
      totalHoursWorked: 0,
    });
  });

  // Merge sales data
  sales.forEach(s => {
    const entry = summaryMap.get(s.staffId);
    if (entry) {
      entry.saleCount = s.saleCount;
      entry.totalRevenue = s.totalRevenue;
      entry.totalItems = s.totalItems;
      entry.avgSaleValue = s.avgSaleValue;
      entry.totalDiscount = s.totalDiscount;
    } else {
      summaryMap.set(s.staffId, {
        staffId: s.staffId,
        staffName: s.staffName,
        role: 'staff',
        saleCount: s.saleCount,
        totalRevenue: s.totalRevenue,
        totalItems: s.totalItems,
        avgSaleValue: s.avgSaleValue,
        totalDiscount: s.totalDiscount,
        checklistItemsCompleted: 0,
        returnsProcessed: 0,
        totalRefunded: 0,
        daysPresent: 0,
        totalHoursWorked: 0,
      });
    }
  });

  // Merge checklist data
  checklists.forEach(c => {
    const entry = summaryMap.get(c.staffId);
    if (entry) entry.checklistItemsCompleted = c.itemsCompleted;
  });

  // Merge returns data
  returns.forEach(r => {
    const entry = summaryMap.get(r.staffId);
    if (entry) {
      entry.returnsProcessed = r.returnsProcessed;
      entry.totalRefunded = r.totalRefunded;
    }
  });

  // Merge attendance data
  attendance.forEach(a => {
    const entry = summaryMap.get(a.staffId);
    if (entry) {
      entry.daysPresent = a.daysPresent;
      entry.totalHoursWorked = a.totalHoursWorked;
    }
  });

  // Sort by total revenue desc, then by sale count
  return Array.from(summaryMap.values()).sort((a, b) => {
    if (b.totalRevenue !== a.totalRevenue) return b.totalRevenue - a.totalRevenue;
    return b.saleCount - a.saleCount;
  });
}
