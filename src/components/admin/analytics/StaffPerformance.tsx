'use client';

/**
 * Staff Performance Analytics Component
 * 
 * Shows per-staff performance metrics:
 * - Sales count & revenue
 * - Items sold
 * - Checklist items completed
 * - Returns processed
 * - Attendance (days & hours)
 * 
 * Follows the same pattern as VendorPerformance, CategoryPerformance, etc.
 */

import { useState, useEffect, useCallback } from 'react';

import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import {
  ShoppingCart,
  ClipboardCheck,
  RotateCcw,
  Clock,
  TrendingUp,
  ChevronRight,
  CalendarDays,
  Package,
} from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';
import { appConfig } from '@/lib/config/app.config';
import {
  getStaffPerformanceSummary,
  type StaffPerformanceSummary,
} from '@/lib/api/staff-performance';

const s = appConfig.styles;
const a = s.accent;

interface StaffPerformanceProps {
  shopId: string;
  dateRange?: 'today' | 'week' | 'month' | 'all';
  customStart?: string | null;
  customEnd?: string | null;
}

export function StaffPerformance({ shopId, dateRange = 'week', customStart, customEnd }: StaffPerformanceProps) {
  const [loading, setLoading] = useState(true);
  const [staffData, setStaffData] = useState<StaffPerformanceSummary[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<StaffPerformanceSummary | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getStaffPerformanceSummary(
        shopId,
        dateRange,
        customStart ?? undefined,
        customEnd ?? undefined,
      );
      setStaffData(data);
    } catch (error) {
      console.error('Error loading staff performance:', error);
    } finally {
      setLoading(false);
    }
  }, [shopId, dateRange, customStart, customEnd]);

  useEffect(() => {
    if (shopId) loadData();
  }, [shopId, loadData]);

  const handleStaffClick = (staff: StaffPerformanceSummary) => {
    setSelectedStaff(staff);
    setSheetOpen(true);
  };

  // Loading skeleton
  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-4 w-56" />
        <div className="space-y-3">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Staff Table */}
      <div className="text-sm text-muted-foreground">
        Tap a row for detailed breakdown
      </div>
      {staffData.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          No staff activity data available for the selected period
        </div>
      ) : (
        <div className="overflow-x-auto overflow-y-visible">
          {/* Desktop Table */}
          <Table className="hidden md:table">
            <TableHeader>
              <TableRow>
                <TableHead>Staff</TableHead>
                <TableHead className="text-right">Sales</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
                <TableHead className="text-right">Items</TableHead>
                <TableHead className="text-right">Avg Sale</TableHead>
                <TableHead className="text-right">Tasks</TableHead>
                <TableHead className="text-right">Hours</TableHead>
                <TableHead className="w-8"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {staffData.map((staff) => (
                <TableRow
                  key={staff.staffId}
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => handleStaffClick(staff)}
                >
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className={`flex items-center justify-center h-8 w-8 rounded-full bg-gradient-to-br ${a.gradientLight} text-white text-xs font-bold shrink-0`}>
                        {staff.staffName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-sm">{staff.staffName}</p>
                        <p className="text-xs text-muted-foreground capitalize">{staff.role}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-medium">{staff.saleCount}</TableCell>
                  <TableCell className="text-right font-medium text-green-600">
                    {formatCurrency(staff.totalRevenue)}
                  </TableCell>
                  <TableCell className="text-right">{staff.totalItems}</TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {staff.avgSaleValue > 0 ? formatCurrency(staff.avgSaleValue) : '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    {staff.checklistItemsCompleted > 0 ? (
                      <Badge variant="secondary" className="text-xs">
                        {staff.checklistItemsCompleted}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {staff.totalHoursWorked > 0 ? `${staff.totalHoursWorked}h` : '—'}
                  </TableCell>
                  <TableCell>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {/* Mobile Card List */}
          <div className="md:hidden space-y-2 py-1">
            {staffData.map((staff) => (
              <button
                key={staff.staffId}
                type="button"
                onClick={() => handleStaffClick(staff)}
                className={`w-full text-left rounded-lg border p-3 hover:bg-muted/50 transition-all ${s.btnAnimationSubtle}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className={`flex items-center justify-center h-8 w-8 rounded-full bg-gradient-to-br ${a.gradientLight} text-white text-xs font-bold shrink-0`}>
                      {staff.staffName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium text-sm">{staff.staffName}</p>
                      <p className="text-xs text-muted-foreground capitalize">{staff.role}</p>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-xs text-muted-foreground">Sales</p>
                    <p className="text-sm font-bold">{staff.saleCount}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Revenue</p>
                    <p className="text-sm font-bold text-green-600">
                      {formatCurrency(staff.totalRevenue)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Tasks</p>
                    <p className="text-sm font-bold">{staff.checklistItemsCompleted}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Staff Detail Sheet */}
      <StaffDetailSheet
        staff={selectedStaff}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />
    </div>
  );
}

// ==========================================
// Staff Detail Sheet (Slide-in Drawer)
// ==========================================

function StaffDetailSheet({
  staff,
  open,
  onOpenChange,
}: {
  staff: StaffPerformanceSummary | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!staff) return null;

  const metrics = [
    {
      section: 'Sales Performance',
      icon: ShoppingCart,
      items: [
        { label: 'Sales Made', value: String(staff.saleCount), highlight: staff.saleCount > 0 },
        { label: 'Total Revenue', value: formatCurrency(staff.totalRevenue), highlight: true, color: 'text-green-600' },
        { label: 'Items Sold', value: String(staff.totalItems) },
        { label: 'Avg Sale Value', value: staff.avgSaleValue > 0 ? formatCurrency(staff.avgSaleValue) : '—' },
        { label: 'Total Discounts', value: staff.totalDiscount > 0 ? formatCurrency(staff.totalDiscount) : '—', color: 'text-orange-600' },
      ],
    },
    {
      section: 'Operational',
      icon: ClipboardCheck,
      items: [
        { label: 'Checklist Items Done', value: String(staff.checklistItemsCompleted), highlight: staff.checklistItemsCompleted > 0 },
        { label: 'Returns Processed', value: String(staff.returnsProcessed) },
        { label: 'Total Refunded', value: staff.totalRefunded > 0 ? formatCurrency(staff.totalRefunded) : '—', color: 'text-red-600' },
      ],
    },
    {
      section: 'Attendance',
      icon: CalendarDays,
      items: [
        { label: 'Days Present', value: String(staff.daysPresent), highlight: staff.daysPresent > 0 },
        { label: 'Hours Worked', value: staff.totalHoursWorked > 0 ? `${staff.totalHoursWorked}h` : '—' },
      ],
    },
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-[calc(100%-2.5rem)] sm:max-w-md rounded-l-xl sm:rounded-none flex flex-col p-0 gap-0"
      >
        {/* Header */}
        <div className="p-4 md:p-6">
          <SheetHeader className="text-left">
            <div className="flex items-center gap-3">
              <div className={`flex items-center justify-center h-12 w-12 rounded-xl bg-gradient-to-br ${s.headerIconGradient} text-white text-lg font-bold shadow-md`}>
                {staff.staffName.charAt(0).toUpperCase()}
              </div>
              <div>
                <SheetTitle className="text-lg">{staff.staffName}</SheetTitle>
                <SheetDescription className="capitalize">{staff.role}</SheetDescription>
              </div>
            </div>
          </SheetHeader>
        </div>

        <Separator />

        {/* Metrics */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
          {metrics.map(({ section, icon: Icon, items }) => (
            <div key={section}>
              <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground flex items-center gap-1.5 mb-3">
                <Icon className="h-3.5 w-3.5" />
                {section}
              </h3>
              <div className="space-y-2">
                {items.map(({ label, value, highlight, color }) => (
                  <div
                    key={label}
                    className={`flex items-center justify-between rounded-lg p-2.5 ${
                      highlight ? `${a.bg} ${a.border} border` : 'bg-muted/30'
                    }`}
                  >
                    <span className="text-sm text-muted-foreground">{label}</span>
                    <span className={`text-sm font-bold ${color || ''}`}>{value}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}

export { StaffPerformance as default };
