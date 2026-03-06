'use client';

import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { ReactNode } from 'react';

interface SortableHeaderProps<T extends string> {
  column: T;
  sortBy: T;
  sortOrder: 'asc' | 'desc';
  onSort: (column: T) => void;
  children: ReactNode;
  align?: 'left' | 'right' | 'center';
  minWidth?: string;
  className?: string;
}

/**
 * Reusable sortable table header component with sort icons.
 * 
 * Works with the `useSortableTable` hook to provide consistent sorting UI across all tables.
 * 
 * @example
 * ```tsx
 * const { sortBy, sortOrder, toggleSort } = useSortableTable<'name' | 'date'>({ 
 *   initialSortBy: 'date' 
 * });
 * 
 * <thead>
 *   <tr>
 *     <SortableHeader column="name" sortBy={sortBy} sortOrder={sortOrder} onSort={toggleSort}>
 *       Name
 *     </SortableHeader>
 *     <SortableHeader column="date" sortBy={sortBy} sortOrder={sortOrder} onSort={toggleSort}>
 *       Date
 *     </SortableHeader>
 *   </tr>
 * </thead>
 * ```
 */
export function SortableHeader<T extends string>({
  column,
  sortBy,
  sortOrder,
  onSort,
  children,
  align = 'left',
  minWidth,
  className = '',
}: SortableHeaderProps<T>) {
  const isActive = sortBy === column;
  
  const alignClass = align === 'right' ? 'text-right justify-end' : 
                     align === 'center' ? 'text-center justify-center' : 
                     'text-left';
  
  const minWidthStyle = minWidth ? { minWidth } : undefined;
  
  return (
    <th
      className={`py-3 px-3 font-medium cursor-pointer hover:bg-muted/50 ${className}`}
      style={minWidthStyle}
      onClick={() => onSort(column)}
    >
      <div className={`flex items-center whitespace-nowrap ${alignClass}`}>
        {children}
        {isActive ? (
          sortOrder === 'asc' ? (
            <ArrowUp className="h-3 w-3 ml-1" />
          ) : (
            <ArrowDown className="h-3 w-3 ml-1" />
          )
        ) : (
          <ArrowUpDown className="h-3 w-3 ml-1 opacity-50" />
        )}
      </div>
    </th>
  );
}
