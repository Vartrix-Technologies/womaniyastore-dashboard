'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LucideIcon } from 'lucide-react';
import { ReactNode } from 'react';

export interface StatCard {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  iconColor?: string;
  valueColor?: string;
  subtitle?: string;
  onClick?: () => void;
  colSpan?: number;
  /** When true, applies a strong active/selected visual treatment */
  isActive?: boolean;
  /** Custom Tailwind classes for the active state (e.g. 'border-l-green-500 bg-green-50 dark:bg-green-950/30') */
  activeClassName?: string;
}

interface StatsCardGridProps {
  stats: StatCard[];
  loading?: boolean;
  className?: string;
  /** Optional hint text shown below the grid (e.g. "Click a metric to filter") */
  filterHint?: string;
}

/**
 * Reusable stats card grid component with support for icons, colors, and click handlers.
 * 
 * Displays a responsive grid of stat cards (2 columns on mobile, 4 on desktop).
 * 
 * @example
 * ```tsx
 * import { TrendingUp } from 'lucide-react';
 * 
 * <StatsCardGrid
 *   stats={[
 *     { label: 'Total Sales', value: 150, icon: TrendingUp, iconColor: 'text-green-600' },
 *     { label: 'Revenue', value: formatCurrency(45000), valueColor: 'text-green-600' }
 *   ]}
 * />
 * ```
 */
export function StatsCardGrid({ stats, loading = false, className, filterHint }: StatsCardGridProps) {
  const anyActive = stats.some(s => s.isActive);

  if (loading) {
    return (
      <div className={`grid gap-4 grid-cols-2 lg:grid-cols-4 ${className || ''}`}>
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader className="pb-2">
              <div className="h-4 w-24 bg-gray-100 rounded mb-2" />
              <div className="h-8 w-16 bg-gray-200 rounded" />
            </CardHeader>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className={`grid gap-3 grid-cols-2 lg:grid-cols-4 ${className || ''}`}>
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          const hasIcon = !!Icon;
          const hasSubtitle = !!stat.subtitle;
          const isClickable = !!stat.onClick;

          const cardClasses = [
            'transition-all',
            stat.isActive
              ? `border-l-4 shadow-sm ${stat.activeClassName || 'border-l-teal-500 bg-teal-50 dark:bg-teal-950/30'}`
              : [
                  'hover:shadow-lg',
                  isClickable && 'cursor-pointer hover:scale-[1.02] active:scale-[0.98]',
                  anyActive && 'opacity-50 hover:opacity-80',
                ].filter(Boolean).join(' '),
            isClickable && stat.isActive && 'cursor-pointer',
            stat.colSpan === 2 && 'lg:col-span-2',
          ].filter(Boolean).join(' ');

          return (
            <Card
              key={`${stat.label}-${index}`}
              className={cardClasses}
              onClick={stat.onClick}
            >
            {hasIcon ? (
              <>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-xs md:text-sm font-medium">{stat.label}</CardTitle>
                  {Icon && <Icon className={`h-4 w-4 ${stat.iconColor || ''}`} />}
                </CardHeader>
                <CardContent>
                  <div className={`text-lg md:text-2xl font-bold ${stat.valueColor || ''}`}>
                    {stat.value}
                  </div>
                  {hasSubtitle && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {stat.subtitle}
                    </p>
                  )}
                </CardContent>
              </>
            ) : (
              <CardHeader className="pb-2">
                <CardDescription className="text-xs">{stat.label}</CardDescription>
                <CardTitle className={`text-2xl md:text-3xl ${stat.valueColor || ''}`}>
                  {stat.value}
                </CardTitle>
                {hasSubtitle && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {stat.subtitle}
                  </p>
                )}
              </CardHeader>
            )}
          </Card>
        );
      })}
      </div>
      {filterHint && (
        <p className="text-[11px] text-muted-foreground/60 pl-1">{filterHint}</p>
      )}
    </div>
  );
}
