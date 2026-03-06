'use client';

import { ChevronFirst, ChevronLast, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100, 200, 500];

interface PaginationControlsProps {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  startItem: number;
  endItem: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
  onItemsPerPageChange: (size: number) => void;
  /** Override default page size options [10, 25, 50, 100, 200, 500] */
  pageSizeOptions?: number[];
}

/**
 * Shared pagination controls with page navigation and items-per-page selector.
 *
 * Pairs with `useServerPagination` hook — pass its return values directly.
 *
 * @example
 * ```tsx
 * const { currentPage, totalPages, startItem, endItem, ... } = useServerPagination({ totalCount });
 *
 * <PaginationControls
 *   currentPage={currentPage} totalPages={totalPages} totalCount={totalCount}
 *   startItem={startItem} endItem={endItem} itemsPerPage={itemsPerPage}
 *   onPageChange={setCurrentPage} onItemsPerPageChange={(size) => { setItemsPerPage(size); setCurrentPage(1); }}
 * />
 * ```
 */
export function PaginationControls({
  currentPage,
  totalPages,
  totalCount,
  startItem,
  endItem,
  itemsPerPage,
  onPageChange,
  onItemsPerPageChange,
  pageSizeOptions = PAGE_SIZE_OPTIONS,
}: PaginationControlsProps) {
  if (totalCount <= 0) return null;

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-4 pt-4 border-t">
      <div className="flex items-center gap-4">
        <div className="text-sm text-muted-foreground">
          Showing {startItem} to {endItem} of <span className="font-semibold">{totalCount}</span>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="itemsPerPage" className="text-xs text-muted-foreground whitespace-nowrap">
            Per page:
          </Label>
          <Select
            value={itemsPerPage.toString()}
            onValueChange={(value) => onItemsPerPageChange(Number(value))}
          >
            <SelectTrigger className="w-20 h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {pageSizeOptions.map((size) => (
                <SelectItem key={size} value={size.toString()}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={() => onPageChange(1)}
          disabled={currentPage === 1}
          title="First page"
        >
          <ChevronFirst className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
          title="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm font-medium px-3 min-w-[100px] text-center">
          {currentPage} / {totalPages}
        </span>
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage === totalPages}
          title="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage === totalPages}
          title="Last page"
        >
          <ChevronLast className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
