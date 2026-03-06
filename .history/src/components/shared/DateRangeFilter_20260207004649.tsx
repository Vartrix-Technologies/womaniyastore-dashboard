'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { Calendar as CalendarIcon, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import type { DateFilterType, CustomDateRange } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Preset definitions
// ---------------------------------------------------------------------------
const PRESETS: { value: Exclude<DateFilterType, 'custom'>; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'all', label: 'All Time' },
];

// ---------------------------------------------------------------------------
// Shared Tailwind classes – mirrors shadcn TabsList / TabsTrigger visuals
// ---------------------------------------------------------------------------
const triggerBase =
  'inline-flex items-center justify-center whitespace-nowrap rounded-md px-2.5 py-1.5 text-xs md:text-sm font-medium transition-all select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';
const triggerActive = 'bg-background text-foreground shadow-sm';
const triggerInactive = 'hover:text-foreground/80';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
interface DateRangeFilterProps {
  /** Current active filter (preset or 'custom') */
  value: DateFilterType;
  /** Callback when any preset or "Custom" is selected */
  onChange: (value: DateFilterType) => void;
  /** Calendar date range state – required when custom is used */
  customRange?: CustomDateRange;
  /** Callback when the calendar range changes */
  onCustomRangeChange?: (range: CustomDateRange | undefined) => void;
  /** Additional wrapper className */
  className?: string;
}

/**
 * Unified date-range filter: four quick presets (Today / Week / Month / All)
 * plus a **Custom** button that opens a calendar popover for arbitrary ranges.
 *
 * Drop-in replacement for the previous `DateFilterTabs`. Pair with
 * `useDateFilter` — it already returns `customRange` and `setCustomRange`.
 *
 * @example
 * ```tsx
 * const { dateFilter, setDateFilter, customRange, setCustomRange } = useDateFilter();
 *
 * <DateRangeFilter
 *   value={dateFilter}
 *   onChange={setDateFilter}
 *   customRange={customRange}
 *   onCustomRangeChange={setCustomRange}
 * />
 * ```
 */
export function DateRangeFilter({
  value,
  onChange,
  customRange,
  onCustomRangeChange,
  className,
}: DateRangeFilterProps) {
  const [popoverOpen, setPopoverOpen] = useState(false);

  // ---- handlers ----

  const handlePresetClick = (preset: Exclude<DateFilterType, 'custom'>) => {
    onChange(preset);
    onCustomRangeChange?.(undefined);
  };

  const handleCustomClick = () => {
    onChange('custom');
    if (!popoverOpen) setPopoverOpen(true);
  };

  const handleCalendarSelect = (range: { from?: Date; to?: Date } | undefined) => {
    onCustomRangeChange?.(range as CustomDateRange | undefined);
    // Auto-close once both ends are picked
    if (range?.from && range?.to) {
      setTimeout(() => setPopoverOpen(false), 200);
    }
  };

  const handleClearCustom = (e: React.MouseEvent) => {
    e.stopPropagation();
    onCustomRangeChange?.(undefined);
    onChange('week'); // revert to sensible default
    setPopoverOpen(false);
  };

  // ---- derived ----

  const isCustomActive = value === 'custom';
  const hasCustomDates = isCustomActive && !!customRange?.from;

  // ---- render ----

  return (
    <div
      className={cn(
        'inline-flex flex-wrap items-center gap-1 rounded-lg bg-muted p-1 text-muted-foreground',
        className,
      )}
    >
      {/* Preset buttons */}
      {PRESETS.map((preset) => (
        <button
          key={preset.value}
          type="button"
          onClick={() => handlePresetClick(preset.value)}
          className={cn(
            triggerBase,
            value === preset.value ? triggerActive : triggerInactive,
          )}
        >
          {preset.label}
        </button>
      ))}

      {/* Subtle separator */}
      <div className="mx-0.5 hidden h-4 w-px bg-border sm:block" />

      {/* Custom date-range trigger + popover */}
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            onClick={handleCustomClick}
            className={cn(
              triggerBase,
              'gap-1.5',
              isCustomActive ? triggerActive : triggerInactive,
            )}
          >
            <CalendarIcon className="h-3.5 w-3.5 shrink-0" />

            {hasCustomDates ? (
              <>
                {/* Desktop: readable dates */}
                <span className="hidden sm:inline">
                  {format(customRange.from!, 'MMM d, yyyy')}
                  {customRange.to
                    ? ` – ${format(customRange.to, 'MMM d, yyyy')}`
                    : ' – …'}
                </span>
                {/* Mobile: compact */}
                <span className="sm:hidden">
                  {format(customRange.from!, 'M/d')}
                  {customRange.to ? `–${format(customRange.to, 'M/d')}` : '–…'}
                </span>

                {/* Clear button */}
                <span
                  role="button"
                  tabIndex={0}
                  onClick={handleClearCustom}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') handleClearCustom(e as unknown as React.MouseEvent);
                  }}
                  className="ml-0.5 inline-flex items-center rounded-full p-0.5 hover:bg-muted-foreground/20"
                >
                  <X className="h-3 w-3" />
                </span>
              </>
            ) : (
              'Custom'
            )}
          </button>
        </PopoverTrigger>

        <PopoverContent className="w-auto p-0" align="start" sideOffset={8}>
          <div className="p-3 pb-0">
            <p className="text-xs text-muted-foreground">
              Select start &amp; end dates
            </p>
          </div>
          <Calendar
            mode="range"
            defaultMonth={customRange?.from ?? new Date()}
            selected={customRange as { from: Date; to?: Date } | undefined}
            onSelect={handleCalendarSelect}
            numberOfMonths={2}
            disabled={{ after: new Date() }}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
