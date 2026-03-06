'use client';

import { useAuth } from '@/context/AuthContext';
import { DateRangeFilter } from '@/components/shared/DateRangeFilter';
import { StaffPerformance } from '@/components/admin/analytics';
import { useDateFilter } from '@/hooks';
import { appConfig } from '@/lib/config/app.config';
import { ArrowLeft, Users } from 'lucide-react';
import Link from 'next/link';

const s = appConfig.styles;

export default function StaffPerformancePage() {
  const { profile, loading: authLoading } = useAuth();
  const { dateFilter, setDateFilter, customRange, setCustomRange, startDateISO, endDateISO } = useDateFilter({
    initialFilter: 'week',
  });

  if (authLoading || !profile?.shop_id) {
    return (
      <div className="space-y-4 md:space-y-6">
        <div className="space-y-2">
          <div className="h-8 w-64 bg-gray-200 rounded animate-pulse" />
          <div className="h-5 w-96 bg-gray-100 rounded animate-pulse" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="rounded-lg border p-4">
              <div className="h-4 w-20 bg-gray-100 rounded animate-pulse mb-2" />
              <div className="h-8 w-16 bg-gray-200 rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Map internal date filter to API date range type
  const apiDateRange = dateFilter === 'custom' ? 'all' as const : dateFilter as 'today' | 'week' | 'month' | 'all';

  return (
    <div className="space-y-4 md:space-y-6 animate-content-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/admin" className="relative group shrink-0">
          <div className={`p-2.5 rounded-xl ${s.headerIconGradient} text-white shadow-md group-hover:shadow-lg transition-shadow`}>
            <Users className="h-6 w-6" />
          </div>
          <div className="absolute -left-1.5 -top-1.5 bg-background border rounded-full p-1 shadow-sm group-hover:scale-110 transition-transform">
            <ArrowLeft className="h-3 w-3 text-muted-foreground" />
          </div>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Staff Performance</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Comprehensive view of staff sales, tasks, and attendance
          </p>
        </div>
      </div>

      {/* Date Filter */}
      <DateRangeFilter
        value={dateFilter}
        onChange={setDateFilter}
        customRange={customRange}
        onCustomRangeChange={setCustomRange}
      />

      {/* Performance Component */}
      <StaffPerformance
        shopId={profile.shop_id}
        dateRange={apiDateRange}
        customStart={dateFilter === 'custom' ? startDateISO : undefined}
        customEnd={dateFilter === 'custom' ? endDateISO : undefined}
      />
    </div>
  );
}
