'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Calendar as CalendarIcon, X, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
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
  { value: 'year', label: 'This Year' },
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
  // Buffered range — only committed to parent on "Apply"
  const [pendingRange, setPendingRange] = useState<CustomDateRange | undefined>(undefined);

  // Sync buffer from parent when popover opens (e.g. re-opening with existing range)
  useEffect(() => {
    if (popoverOpen) {
      setPendingRange(customRange);
    }
  }, [popoverOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- handlers ----

  const handlePresetClick = (preset: Exclude<DateFilterType, 'custom'>) => {
    onChange(preset);
    onCustomRangeChange?.(undefined);
    setPendingRange(undefined);
  };

  const handleCustomClick = () => {
    onChange('custom');
    if (!popoverOpen) {
      setPopoverOpen(true);
    }
  };

  /** Calendar selection is buffered locally — no fetch until Apply */
  const handleCalendarSelect = (range: { from?: Date; to?: Date } | undefined) => {
    setPendingRange(range as CustomDateRange | undefined);
  };

  /** Commit the buffered range to parent and close the popover */
  const handleApply = () => {
    onCustomRangeChange?.(pendingRange);
    setPopoverOpen(false);
  };

  const handleClearCustom = (e: React.MouseEvent) => {
    e.stopPropagation();
    onCustomRangeChange?.(undefined);
    setPendingRange(undefined);
    onChange('week');
    setPopoverOpen(false);
  };

  const handlePopoverChange = (open: boolean) => {
    setPopoverOpen(open);
    // If user dismissed without applying, revert buffer
    if (!open) setPendingRange(customRange);
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
    'inline-flex h-[calc(100%-1px)] items-center justify-center whitespace-nowrap rounded-md border border-transparent px-2 py-1.5 sm:py-0 text-sm font-medium transition-[color,box-shadow] select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';
  const btnActive = 'bg-background text-foreground shadow-sm';
  const btnInactive = 'text-muted-foreground hover:text-foreground/80';

  // ---- render ----

  return (
    <div
      className={cn(
        'inline-grid w-full grid-cols-4 sm:grid-cols-5 gap-0.5 rounded-lg bg-muted text-muted-foreground p-[3px]',
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

      {/* Custom date-range — spans 2 cols on mobile for breathing room */}
      <Popover open={popoverOpen} onOpenChange={handlePopoverChange}>
        <PopoverTrigger asChild>
          <button
            type="button"
            onClick={handleCustomClick}
            className={cn(
              btnBase,
              'gap-1 col-span-4 sm:col-span-1 w-full',
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
            defaultMonth={pendingRange?.from ?? customRange?.from ?? new Date()}
            selected={pendingRange as { from: Date; to?: Date } | undefined}
            onSelect={handleCalendarSelect}
            numberOfMonths={2}
            disabled={{ after: new Date() }}
          />
          {/* Apply button — prevents premature fetch on first click */}
          <div className="px-3 pb-3 pt-1 flex items-center justify-between gap-2">
            <p className="text-[11px] text-muted-foreground truncate">
              {pendingRange?.from
                ? `${format(pendingRange.from, 'MMM d')}${pendingRange.to ? ` – ${format(pendingRange.to, 'MMM d')}` : ' – pick end date'}`
                : 'Pick a date range'}
            </p>
            <Button
              size="sm"
              onClick={handleApply}
              disabled={!pendingRange?.from}
              className="h-7 px-3 text-xs gap-1"
            >
              <Check className="h-3 w-3" />
              Apply
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
