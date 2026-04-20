'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { calculateDateRange, buildPaginationRange, getPaginationInfo, type DateFilterType, type DateRange, type CustomDateRange, type PaginationInfo } from '@/lib/utils';
import { supabase } from '@/lib/supabase';

// ============================================================================
// useDateFilter Hook
// ============================================================================

export interface UseDateFilterOptions {
  initialFilter?: DateFilterType;
  onFilterChange?: (filter: DateFilterType, range: DateRange) => void;
}

export interface UseDateFilterReturn {
  dateFilter: DateFilterType;
  setDateFilter: (filter: DateFilterType) => void;
  customRange: CustomDateRange | undefined;
  setCustomRange: (range: CustomDateRange | undefined) => void;
  dateRange: DateRange;
  startDateISO: string | null;
  endDateISO: string;
}

/**
 * Hook for managing date filter state and calculating date ranges.
 * Supports both preset filters (today/week/month/all) and custom date ranges.
 * 
 * @example
 * const { dateFilter, setDateFilter, customRange, setCustomRange, startDateISO } = useDateFilter();
 * // Use startDateISO in Supabase queries: .gte('created_at', startDateISO)
 */
export function useDateFilter(options: UseDateFilterOptions = {}): UseDateFilterReturn {
  const { initialFilter = 'month', onFilterChange } = options;
  const [dateFilter, setDateFilterState] = useState<DateFilterType>(initialFilter);
  const [customRange, setCustomRangeState] = useState<CustomDateRange | undefined>(undefined);

  const dateRange = useMemo(
    () => calculateDateRange(dateFilter, customRange?.from, customRange?.to),
    [dateFilter, customRange?.from, customRange?.to],
  );

  const startDateISO = dateRange.startDate?.toISOString() ?? null;
  const endDateISO = dateRange.endDate.toISOString();

  const setDateFilter = useCallback((filter: DateFilterType) => {
    setDateFilterState(filter);
    // Clear custom range when switching to a preset
    if (filter !== 'custom') {
      setCustomRangeState(undefined);
    }
    const newRange = calculateDateRange(filter);
    onFilterChange?.(filter, newRange);
  }, [onFilterChange]);

  const setCustomRange = useCallback((range: CustomDateRange | undefined) => {
    setCustomRangeState(range);
    if (range) {
      setDateFilterState('custom');
    }
  }, []);

  return {
    dateFilter,
    setDateFilter,
    customRange,
    setCustomRange,
    dateRange,
    startDateISO,
    endDateISO,
  };
}

// ============================================================================
// useServerPagination Hook
// ============================================================================

export interface UseServerPaginationOptions {
  initialPage?: number;
  initialItemsPerPage?: number;
  totalCount: number;
}

export interface UseServerPaginationReturn extends PaginationInfo {
  currentPage: number;
  itemsPerPage: number;
  setCurrentPage: (page: number) => void;
  setItemsPerPage: (size: number) => void;
  goToFirstPage: () => void;
  goToLastPage: () => void;
  goToNextPage: () => void;
  goToPrevPage: () => void;
  resetPage: () => void;
}

/**
 * Hook for managing server-side pagination state.
 * Handles page state, items per page, navigation, and range calculation.
 * 
 * @example
 * const { currentPage, itemsPerPage, from, to, totalPages, goToNextPage, resetPage } = useServerPagination({ totalCount: 100 });
 * // Use in Supabase: .range(from, to)
 */
export function useServerPagination(options: UseServerPaginationOptions): UseServerPaginationReturn {
  const { initialPage = 1, initialItemsPerPage = 50, totalCount } = options;
  
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [itemsPerPage, setItemsPerPageState] = useState(initialItemsPerPage);

  const paginationInfo = useMemo(
    () => getPaginationInfo(currentPage, itemsPerPage, totalCount),
    [currentPage, itemsPerPage, totalCount]
  );

  // Reset to first page when total count changes significantly
  useEffect(() => {
    if (currentPage > paginationInfo.totalPages && paginationInfo.totalPages > 0) {
      setCurrentPage(paginationInfo.totalPages);
    }
  }, [currentPage, paginationInfo.totalPages]);

  const setItemsPerPage = useCallback((size: number) => {
    setItemsPerPageState(size);
    setCurrentPage(1); // Reset to first page when changing page size
  }, []);

  const goToFirstPage = useCallback(() => setCurrentPage(1), []);
  const goToLastPage = useCallback(() => setCurrentPage(paginationInfo.totalPages), [paginationInfo.totalPages]);
  const goToNextPage = useCallback(() => {
    if (currentPage < paginationInfo.totalPages) {
      setCurrentPage(currentPage + 1);
    }
  }, [currentPage, paginationInfo.totalPages]);
  const goToPrevPage = useCallback(() => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  }, [currentPage]);
  const resetPage = useCallback(() => setCurrentPage(1), []);

  return {
    currentPage,
    itemsPerPage,
    setCurrentPage,
    setItemsPerPage,
    goToFirstPage,
    goToLastPage,
    goToNextPage,
    goToPrevPage,
    resetPage,
    ...paginationInfo,
  };
}

// ============================================================================
// useSortableTable Hook
// ============================================================================

export interface UseSortableTableOptions<T extends string> {
  initialSortBy: T;
  initialSortOrder?: 'asc' | 'desc';
}

export interface UseSortableTableReturn<T extends string> {
  sortBy: T;
  sortOrder: 'asc' | 'desc';
  toggleSort: (column: T) => void;
  setSortBy: (column: T) => void;
  setSortOrder: (order: 'asc' | 'desc') => void;
  isAscending: boolean;
  getSortDirection: (column: T) => 'asc' | 'desc' | null;
}

/**
 * Hook for managing table sorting state.
 * Handles column selection and sort order toggling.
 * 
 * @example
 * const { sortBy, sortOrder, toggleSort, getSortDirection } = useSortableTable({ 
 *   initialSortBy: 'created_at' as const 
 * });
 * // In header: onClick={() => toggleSort('created_at')}
 * // In query: .order(sortBy, { ascending: sortOrder === 'asc' })
 */
export function useSortableTable<T extends string>(
  options: UseSortableTableOptions<T>
): UseSortableTableReturn<T> {
  const { initialSortBy, initialSortOrder = 'desc' } = options;
  
  const [sortBy, setSortBy] = useState<T>(initialSortBy);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>(initialSortOrder);

  const toggleSort = useCallback((column: T) => {
    if (sortBy === column) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
  }, [sortBy]);

  const isAscending = sortOrder === 'asc';

  const getSortDirection = useCallback((column: T): 'asc' | 'desc' | null => {
    return sortBy === column ? sortOrder : null;
  }, [sortBy, sortOrder]);

  return {
    sortBy,
    sortOrder,
    toggleSort,
    setSortBy,
    setSortOrder,
    isAscending,
    getSortDirection,
  };
}

// ============================================================================
// useDebouncedSearch Hook
// ============================================================================

export interface UseDebouncedSearchOptions {
  initialValue?: string;
  delay?: number;
  onSearch?: (value: string) => void;
  minLength?: number;
}

export interface UseDebouncedSearchReturn {
  searchTerm: string;
  debouncedSearchTerm: string;
  setSearchTerm: (value: string) => void;
  clearSearch: () => void;
  isSearching: boolean;
}

/**
 * Hook for managing debounced search input.
 * Provides both immediate value (for input) and debounced value (for queries).
 * 
 * @example
 * const { searchTerm, debouncedSearchTerm, setSearchTerm, clearSearch } = useDebouncedSearch({
 *   delay: 500,
 *   onSearch: (term) => loadData(term)
 * });
 * // In input: value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
 * // In useEffect dependency: [debouncedSearchTerm]
 */
export function useDebouncedSearch(options: UseDebouncedSearchOptions = {}): UseDebouncedSearchReturn {
  const { initialValue = '', delay = 500, onSearch, minLength = 0 } = options;
  
  const [searchTerm, setSearchTermState] = useState(initialValue);
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(initialValue);
  const [isSearching, setIsSearching] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Clear any existing timer
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    // If search term is too short, don't debounce
    if (searchTerm.length < minLength && searchTerm.length > 0) {
      return;
    }

    setIsSearching(searchTerm !== debouncedSearchTerm);

    timerRef.current = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
      setIsSearching(false);
      onSearch?.(searchTerm);
    }, delay);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [searchTerm, delay, minLength, onSearch, debouncedSearchTerm]);

  const setSearchTerm = useCallback((value: string) => {
    setSearchTermState(value);
  }, []);

  const clearSearch = useCallback(() => {
    setSearchTermState('');
    setDebouncedSearchTerm('');
    setIsSearching(false);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
  }, []);

  return {
    searchTerm,
    debouncedSearchTerm,
    setSearchTerm,
    clearSearch,
    isSearching,
  };
}

// ============================================================================
// useDebouncedValue Hook (generic version)
// ============================================================================

/**
 * Generic debounced value hook.
 * 
 * @example
 * const debouncedQuery = useDebouncedValue(query, 500);
 */
export function useDebouncedValue<T>(value: T, delay: number = 500): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

// ============================================================================
// useDialogForm Hook
// ============================================================================

export interface UseDialogFormOptions<T> {
  defaultValues: T;
  onSubmit: (data: T) => Promise<void> | void;
  onSuccess?: () => void;
  validate?: (data: T) => Record<string, string> | null;
  resetOnClose?: boolean;
}

export interface UseDialogFormReturn<T> {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  formData: T;
  setFormData: React.Dispatch<React.SetStateAction<T>>;
  updateField: <K extends keyof T>(field: K, value: T[K]) => void;
  errors: Record<string, string>;
  isSubmitting: boolean;
  handleSubmit: () => Promise<void>;
  reset: () => void;
}

/**
 * Hook for managing dialog state with form handling.
 * Combines open/close state with form data, validation, submission, and reset.
 * 
 * @example
 * const dialog = useDialogForm({
 *   defaultValues: { name: '', email: '' },
 *   onSubmit: async (data) => {
 *     await api.createUser(data);
 *   },
 *   onSuccess: () => toast.success('User created'),
 *   validate: (data) => {
 *     if (!data.email) return { email: 'Email is required' };
 *     return null;
 *   }
 * });
 * 
 * // In component:
 * <Dialog open={dialog.isOpen} onOpenChange={(open) => !open && dialog.close()}>
 *   <Input value={dialog.formData.name} onChange={(e) => dialog.updateField('name', e.target.value)} />
 *   <Button onClick={dialog.handleSubmit} disabled={dialog.isSubmitting}>Submit</Button>
 * </Dialog>
 */
export function useDialogForm<T extends Record<string, any>>(
  options: UseDialogFormOptions<T>
): UseDialogFormReturn<T> {
  const { defaultValues, onSubmit, onSuccess, validate, resetOnClose = true } = options;

  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState<T>(defaultValues);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const open = useCallback(() => {
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    if (resetOnClose) {
      setFormData(defaultValues);
      setErrors({});
    }
  }, [defaultValues, resetOnClose]);

  const updateField = useCallback(<K extends keyof T>(field: K, value: T[K]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error for this field when it's updated
    setErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[field as string];
      return newErrors;
    });
  }, []);

  const reset = useCallback(() => {
    setFormData(defaultValues);
    setErrors({});
    setIsSubmitting(false);
  }, [defaultValues]);

  const handleSubmit = useCallback(async () => {
    // Validate if validation function provided
    if (validate) {
      const validationErrors = validate(formData);
      if (validationErrors) {
        setErrors(validationErrors);
        return;
      }
    }

    setErrors({});
    setIsSubmitting(true);

    try {
      await onSubmit(formData);
      onSuccess?.();
      close();
    } catch (error) {
      console.error('Form submission error:', error);
      // Let the onSubmit handler deal with error toasts
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, validate, onSubmit, onSuccess, close]);

  return {
    isOpen,
    open,
    close,
    formData,
    setFormData,
    updateField,
    errors,
    isSubmitting,
    handleSubmit,
    reset,
  };
}

// ============================================================================
// useShopQuery Hook
// ============================================================================

/**
 * Hook that wraps Supabase queries to automatically apply shop_id filter.
 * Provides defense-in-depth alongside RLS policies.
 * 
 * Note: This hook is primarily for convenience. The RLS policies are the 
 * authoritative security layer. Use this when you want explicit shop_id 
 * filtering in your query logic.
 * 
 * @example
 * const { shopId, withShopFilter } = useShopQuery();
 * 
 * // Use in queries:
 * const { data } = await withShopFilter(
 *   supabase.from('sales').select('*')
 * );
 * // Automatically adds .eq('shop_id', shopId)
 * 
 * // Or access shopId directly:
 * if (shopId) {
 *   await supabase.from('inventory').select('*').eq('shop_id', shopId);
 * }
 */
export function useShopQuery() {
  const [shopId, setShopId] = useState<string | null>(null);

  useEffect(() => {
    async function loadShopId() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('shop_id')
        .eq('id', user.id)
        .single();

      if (profile) {
        setShopId(profile.shop_id);
      }
    }

    loadShopId();
  }, []);

  /**
   * Wraps a Supabase query builder to automatically add shop_id filter.
   * Maintains type inference from the original query.
   */
  const withShopFilter = useCallback(<T>(query: any): T => {
    if (!shopId) {
      console.warn('useShopQuery: shopId not loaded yet');
      return query as T;
    }
    return query.eq('shop_id', shopId) as T;
  }, [shopId]);

  return {
    shopId,
    withShopFilter,
    isReady: shopId !== null,
  };
}

// Re-export useOfflineStatus from its original location
export { useOfflineStatus } from './useOfflineStatus';

// Re-export useSyncStatus for sync state management
export { useSyncStatus, type UseSyncStatusReturn } from './useSyncStatus';
