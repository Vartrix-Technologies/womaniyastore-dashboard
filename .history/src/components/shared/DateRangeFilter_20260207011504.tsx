'use client';

import { useRef, useState } from 'react';
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
 * Full-width layout with evenly-spaced buttons using a grid. Pair with
 * `useDateFilter` — it already returns `customRange` and `setCustomRange`.
 */
export function DateRangeFilter({
  value,
  onChange,
  customRange,
  onCustomRangeChange,
  className,
}: DateRangeFilterProps) {
  const [popoverOpen, setPopoverOpen] = useState(false);
  // Track clicks so we only auto-close after the *second* distinct date pick
  const clickCountRef = useRef(0);

  // ---- handlers ----

  const handlePresetClick = (preset: Exclude<DateFilterType, 'custom'>) => {
    onChange(preset);
    onCustomRangeChange?.(undefined);
    clickCountRef.current = 0;
  };

  const handleCustomClick = () => {
    onChange('custom');
    if (!popoverOpen) {
      clickCountRef.current = 0;
      setPopoverOpen(true);
    }
  };

  const handleCalendarSelect = (range: { from?: Date; to?: Date } | undefined) => {
    onCustomRangeChange?.(range as CustomDateRange | undefined);
    clickCountRef.current += 1;
    // Only auto-close after second click (both ends chosen as distinct action)
    if (clickCountRef.current >= 2 && range?.from && range?.to) {
      setTimeout(() => setPopoverOpen(false), 200);
      clickCountRef.current = 0;
    }
  };

  const handleClearCustom = (e: React.MouseEvent) => {
    e.stopPropagation();
    onCustomRangeChange?.(undefined);
    onChange('week');
    setPopoverOpen(false);
    clickCountRef.current = 0;
  };

  const handlePopoverChange = (open: boolean) => {
    setPopoverOpen(open);
    if (!open) clickCountRef.current = 0;
  };

  // ---- derived ----

  const isCustomActive = value === 'custom';
  const hasCustomDates = isCustomActive && !!customRange?.from;

  // Build the custom button label
  const customLabel = (() => {
    if (!hasCustomDates) return null;
    const fromStr = format(customRange!.from!, 'MMM d, yyyy');
    const toStr = customRange!.to
      ? format(customRange!.to, 'MMM d, yyyy')
      : '…';
    const fromCompact = format(customRange!.from!, 'M/d');
    const toCompact = customRange!.to ? format(customRange!.to, 'M/d') : '…';
    return { full: `${fromStr} – ${toStr}`, compact: `${fromCompact}–${toCompact}` };
  })();

  // ---- shared classes ----

  const btnBase =
    'inline-flex items-center justify-center whitespace-nowrap rounded-md px-2 py-1.5 text-xs md:text-sm font-medium transition-all select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';
  const btnActive = 'bg-background text-foreground shadow-sm';
  const btnInactive = 'text-muted-foreground hover:text-foreground/80';

  // ---- render ----

  return (
    <div
      className={cn(
        'grid w-full grid-cols-5 gap-1 rounded-lg bg-muted p-1 h-auto',
        className,
      )}
    >
      {/* Preset buttons — 4 out of 5 columns */}
      {PRESETS.map((preset) => (
        <button
          key={preset.value}
          type="button"
          onClick={() => handlePresetClick(preset.value)}
          className={cn(
            btnBase,
            value === preset.value ? btnActive : btnInactive,
          )}
        >
          {preset.label}
        </button>
      ))}

      {/* Custom date-range — 5th column */}
      <Popover open={popoverOpen} onOpenChange={handlePopoverChange}>
        <PopoverTrigger asChild>
          <button
            type="button"
            onClick={handleCustomClick}
            className={cn(
              btnBase,
              'gap-1',
              isCustomActive ? btnActive : btnInactive,
            )}
          >
            <CalendarIcon className="h-3.5 w-3.5 shrink-0" />

            {customLabel ? (
              <>
                <span className="hidden sm:inline truncate">{customLabel.full}</span>
                <span className="sm:hidden truncate">{customLabel.compact}</span>
                <span
                  role="button"
                  tabIndex={0}
                  onClick={handleClearCustom}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ')
                      handleClearCustom(e as unknown as React.MouseEvent);
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

        <PopoverContent className="w-auto p-0" align="end" sideOffset={8}>
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
