'use client';

import { LucideIcon, Filter } from 'lucide-react';
import { appConfig } from '@/lib/config/app.config';

const s = appConfig.styles;
const a = s.accent;

export interface StatCard {
  label: string;
  value: React.ReactNode;
  icon?: LucideIcon;
  iconColor?: string;
  valueColor?: string;
  subtitle?: string;
  onClick?: () => void;
  colSpan?: number;
  /** When true, applies a strong active/selected visual treatment */
  isActive?: boolean;
  /** Mark this card as the "all / no-filter" default so it won't cause other cards to dim */
  isDefault?: boolean;
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
 * Reusable stats card grid — lightweight buttons matching the inventory/QR design.
 *
 * Renders a responsive grid of compact stat cards (2 columns mobile, 4 desktop).
 * Cards with `onClick` behave as toggle-filter buttons with active/dimming states.
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
  // Only dim non-active cards when a non-default card is selected
  const anyNonDefaultActive = stats.some(s => s.isActive && !s.isDefault);

  if (loading) {
    return (
      <div className={`grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-3 ${className || ''}`}>
        {Array.from({ length: stats.length || 4 }).map((_, i) => (
          <div key={i} className="rounded-lg border p-3 md:p-4 animate-pulse">
            <div className="h-3 w-16 bg-muted rounded mb-2" />
            <div className="h-7 w-10 bg-muted rounded" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className={`grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-3 ${className || ''}`}>
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          const isClickable = !!stat.onClick;

          const classes = [
            'rounded-lg border p-3 md:p-4 text-left transition-all',
            isClickable && 'cursor-pointer',
            stat.isActive
              ? `border-l-4 shadow-sm ${stat.activeClassName || `${a.borderLeft} ${a.bg} ${a.bgDark}`}`
              : anyNonDefaultActive
                ? 'opacity-50 hover:opacity-80 hover:bg-muted/50'
                : 'hover:shadow-md hover:bg-muted/50',
            stat.colSpan === 2 && 'lg:col-span-2',
          ].filter(Boolean).join(' ');

          return (
            <div
              key={`${stat.label}-${index}`}
              className={classes}
              onClick={stat.onClick}
              role={isClickable ? 'button' : undefined}
              tabIndex={isClickable ? 0 : undefined}
              onKeyDown={
                isClickable
                  ? (e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        stat.onClick?.();
                      }
                    }
                  : undefined
              }
            >
              {Icon ? (
                <div className="flex items-center justify-between mb-1">
                  <div className="text-xs text-muted-foreground">{stat.label}</div>
                  <Icon className={`h-4 w-4 ${stat.iconColor || 'text-muted-foreground'}`} />
                </div>
              ) : (
                <div className="text-xs text-muted-foreground">{stat.label}</div>
              )}
              <div className={`text-2xl font-bold ${stat.valueColor || ''}`}>
                {stat.value}
              </div>
              {stat.subtitle && (
                <p className="text-xs text-muted-foreground mt-1">{stat.subtitle}</p>
              )}
            </div>
          );
        })}
      </div>
      {filterHint && (
        <p className="text-[11px] text-muted-foreground/60 pl-1">
          <Filter className="inline h-3 w-3 mr-0.5 -mt-0.5" />
          {filterHint}
        </p>
      )}
    </div>
  );
}
