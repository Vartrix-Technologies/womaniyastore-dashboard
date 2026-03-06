'use client';

import { X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export interface FilterChip {
  /** Label shown before the colon (e.g. "Status", "Category") */
  label: string;
  /** Display value shown after the colon */
  value: string;
  /** Called when the chip's X button is clicked */
  onClear: () => void;
  /** Extra Tailwind classes on the Badge (e.g. 'capitalize', 'font-mono') */
  className?: string;
}

interface FilterChipsProps {
  /** Array of active filter chips to display */
  chips: FilterChip[];
  /** Called when "Clear all" is clicked */
  onClearAll: () => void;
}

/**
 * Dismissible filter chip bar — shows active filters with individual clear buttons
 * and a "Clear all" link.
 *
 * Renders nothing when `chips` is empty.
 *
 * @example
 * ```tsx
 * const chips: FilterChip[] = [];
 * if (statusFilter !== 'all') chips.push({ label: 'Status', value: statusFilter, onClear: () => setStatusFilter('all'), className: 'capitalize' });
 * if (debouncedSearchTerm) chips.push({ label: 'Search', value: `"${debouncedSearchTerm}"`, onClear: () => setSearchTerm('') });
 *
 * <FilterChips chips={chips} onClearAll={() => { setStatusFilter('all'); setSearchTerm(''); }} />
 * ```
 */
export function FilterChips({ chips, onClearAll }: FilterChipsProps) {
  if (chips.length === 0) return null;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs text-muted-foreground">Filtered by:</span>
      {chips.map((chip) => (
        <Badge
          key={`${chip.label}-${chip.value}`}
          variant="secondary"
          className={`gap-1 pl-2 pr-1 ${chip.className || ''}`}
        >
          {chip.label}: {chip.value}
          <button
            onClick={chip.onClear}
            className="ml-1 rounded-full hover:bg-muted-foreground/20 p-0.5"
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}
      <button
        onClick={onClearAll}
        className="text-xs text-muted-foreground hover:text-foreground underline"
      >
        Clear all
      </button>
    </div>
  );
}
