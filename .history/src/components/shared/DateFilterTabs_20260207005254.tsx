'use client';

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { DateFilterType } from '@/lib/utils';

interface DateFilterTabsProps {
  value: DateFilterType;
  onChange: (value: DateFilterType) => void;
  className?: string;
}

/**
 * Date filter tabs component with preset periods (Today, Week, Month, All Time).
 * 
 * Used with the `useDateFilter` hook to provide consistent date filtering UI.
 * 
 * @example
 * ```tsx
 * const { dateFilter, setDateFilter } = useDateFilter({ initialFilter: 'week' });
 * 
 * <DateFilterTabs value={dateFilter} onChange={setDateFilter} />
 * ```
 */
export function DateFilterTabs({ value, onChange, className }: DateFilterTabsProps) {
  return (
    <Tabs value={value} onValueChange={(v) => onChange(v as DateFilterType)}>
      <TabsList className={`grid w-full grid-cols-4 h-auto ${className || ''}`}>
        <TabsTrigger value="today" className="text-xs md:text-sm">Today</TabsTrigger>
        <TabsTrigger value="week" className="text-xs md:text-sm">Week</TabsTrigger>
        <TabsTrigger value="month" className="text-xs md:text-sm">Month</TabsTrigger>
        <TabsTrigger value="all" className="text-xs md:text-sm">All Time</TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
