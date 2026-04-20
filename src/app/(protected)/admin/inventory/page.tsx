'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Link from 'next/link';
import { Package, Plus, Search, ArrowLeft, Eye, Trash2, Download, RefreshCw, Filter, BarChart3, ShoppingCart, History, Pencil } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { CountUp } from '@/components/shared/CountUp';
import { exportToCSV, type DateFilterType } from '@/lib/utils';
import { useServerPagination, useSortableTable, useDebouncedSearch, useDateFilter } from '@/hooks';
import { DateRangeFilter } from '@/components/shared/DateRangeFilter';
import { SortableHeader } from '@/components/shared/SortableHeader';
import { InventoryItemDetailsDialog } from '@/components/shared/InventoryItemDetailsDialog';
import { PaginationControls } from '@/components/shared/PaginationControls';
import { FilterChips, type FilterChip } from '@/components/shared/FilterChips';
import { CategoryBreakdownSheet } from '@/components/shared/CategoryBreakdownSheet';
import { LotsHistorySheet } from '@/components/shared/LotsHistorySheet';
import { EditInventoryItemDialog } from '@/components/shared/EditInventoryItemDialog';
import { appConfig } from '@/lib/config';
import { getCachedStats, setCachedStats } from '@/lib/utils/stats-cache';
import type { InventoryItemForList, Category } from '@/types';
import type { CartItem } from '@/types/pos.types';
import { toast } from 'sonner';
import type { Database } from '@/types/database.types';

const s = appConfig.styles;
type InventoryStatus = Database['public']['Enums']['inventory_status'];

export default function InventoryPage() {
  return (
    <Suspense fallback={
      <div className="space-y-4 md:space-y-6">
        <div className="h-9 w-40 bg-muted animate-pulse rounded-md" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="rounded-lg border p-3 md:p-4 animate-pulse">
              <div className="h-3 w-16 bg-muted rounded mb-2" />
              <div className="h-7 w-10 bg-muted rounded" />
            </div>
          ))}
        </div>
        <div className="rounded-lg border p-4 animate-pulse space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-10 bg-muted rounded" />
          ))}
        </div>
      </div>
    }>
      <InventoryPageContent />
    </Suspense>
  );
}

function InventoryPageContent() {
  const { profile } = useAuth();
  const [inventory, setInventory] = useState<InventoryItemForList[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [tableLoading, setTableLoading] = useState(false);
  const { searchTerm, debouncedSearchTerm, setSearchTerm } = useDebouncedSearch({ delay: 500 });
  const router = useRouter();
  const searchParams = useSearchParams();

  // Hydrate from URL params
  const initialStatus = searchParams.get('status') || 'all';
  const initialCategory = searchParams.get('category') || 'all';
  const initialDateFilter = (searchParams.get('date') as DateFilterType) || 'month';
  const initialSaleType = searchParams.get('sale_type') || 'all';

  const { dateFilter, setDateFilter, customRange, setCustomRange, startDateISO, endDateISO } = useDateFilter({ initialFilter: initialDateFilter });
  const [statusFilter, setStatusFilter] = useState<string>(initialStatus);
  const [categoryFilter, setCategoryFilter] = useState<string>(initialCategory);
  const [saleTypeFilter, setSaleTypeFilter] = useState<string>(initialSaleType);
  const [categories, setCategories] = useState<Category[]>([]);
  const [breakdownOpen, setBreakdownOpen] = useState(false);
  const [lotsHistoryOpen, setLotsHistoryOpen] = useState(false);
  const [viewingItem, setViewingItem] = useState<InventoryItemForList | null>(null);
  const [editingTableItem, setEditingTableItem] = useState<InventoryItemForList | null>(null);
  const { sortBy, sortOrder, toggleSort } = useSortableTable<'qr_code' | 'category' | 'size' | 'price' | 'status' | 'date'>({
    initialSortBy: 'date'
  });
  const [totalCount, setTotalCount] = useState(0);
  const {
    currentPage,
    itemsPerPage,
    setCurrentPage,
    setItemsPerPage,
    from,
    to,
    totalPages,
    startItem,
    endItem,
    goToFirstPage,
    goToLastPage,
    goToNextPage,
    goToPrevPage,
  } = useServerPagination({ totalCount });
  const [stats, setStats] = useState(() => getCachedStats('inventory_stats', { total: 0, available: 0, sold: 0, damaged: 0 }));
  const [statsVersion, setStatsVersion] = useState(0);
  const refreshStats = useCallback(() => setStatsVersion(v => v + 1), []);

  useEffect(() => {
    if (profile?.shop_id) {
      fetchInventory();
      fetchCategories();
    } else if (profile !== undefined) {
      setInitialLoading(false);
    }
  }, [profile?.shop_id, currentPage, itemsPerPage, debouncedSearchTerm, statusFilter, categoryFilter, saleTypeFilter, dateFilter, customRange, sortBy, sortOrder]);

  const getStats = useCallback(async () => {
    if (!profile?.shop_id) return null;

    try {
      const countQuery = (status?: InventoryStatus) => {
        let q = supabase.from('inventory_items').select('*', { count: 'exact', head: true }).eq('shop_id', profile.shop_id!);
        if (status) q = q.eq('status', status);
        return q;
      };

      const [totalRes, availableRes, soldRes, damagedRes] = await Promise.all([
        countQuery(),
        countQuery('available'),
        countQuery('sold'),
        countQuery('damaged'),
      ]);

      // Only return new stats if all queries succeeded
      if (totalRes.error || availableRes.error || soldRes.error || damagedRes.error) {
        return null; // Keep previous values
      }

      return {
        total: totalRes.count ?? 0,
        available: availableRes.count ?? 0,
        sold: soldRes.count ?? 0,
        damaged: damagedRes.count ?? 0,
      };
    } catch (error) {
      // Network error / offline — return null to keep previous stats
      console.warn('Inventory stats fetch failed — keeping previous values:', error);
      return null;
    }
  }, [profile?.shop_id]);

  const fetchCategories = async () => {
    if (!profile?.shop_id) return;

    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('shop_id', profile.shop_id)
        .order('name');

      if (error) throw error;
      setCategories(data || []);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const handleDeleteItem = (item: InventoryItemForList) => {
    // Optimistic delete — remove from UI immediately, undo via toast
    const previousInventory = inventory;
    const previousStats = stats;
    const previousTotalCount = totalCount;

    // Optimistically update UI
    setInventory(prev => prev.filter(i => i.id !== item.id));
    setTotalCount(prev => Math.max(0, prev - 1));
    if (item.status === 'available') setStats(prev => ({ ...prev, total: prev.total - 1, available: prev.available - 1 }));
    else setStats(prev => ({ ...prev, total: prev.total - 1 }));

    const undoDelete = () => {
      setInventory(previousInventory);
      setStats(previousStats);
      setTotalCount(previousTotalCount);
    };

    // Perform actual deletion in background
    const doDelete = async () => {
      try {
        // Delete inventory item FIRST (it holds the FK to qr_codes)
        const { error: itemError } = await supabase
          .from('inventory_items')
          .delete()
          .eq('id', item.id);

        if (itemError) throw itemError;

        // Then delete the orphaned QR code
        if (item.qr_codes?.id) {
          const { error: qrError } = await supabase
            .from('qr_codes')
            .delete()
            .eq('id', item.qr_codes.id);

          if (qrError) throw qrError;
        }

        // Refresh stats from server to ensure accuracy
        refreshStats();
      } catch (error) {
        console.error('Error deleting item:', error);
        undoDelete();
        toast.error('Failed to delete item. Reverted.');
      }
    };

    toast('Item deleted', {
      description: `"${item.qr_codes?.code}" removed from inventory`,
      action: {
        label: 'Undo',
        onClick: () => {
          undoDelete();
          // Cancel is implicit — we don't delete on server until toast dismisses
        },
      },
      duration: 6000,
      onAutoClose: () => doDelete(),
      onDismiss: () => doDelete(),
    });
  };

  const fetchInventory = async () => {
    if (!profile?.shop_id) return;

    try {
      setTableLoading(true);

      // If searching, first find matching QR code IDs
      let matchingQrCodeIds: string[] | null = null;
      if (debouncedSearchTerm) {
        const { data: qrMatches } = await supabase
          .from('qr_codes')
          .select('id')
          .ilike('code', `%${debouncedSearchTerm}%`)
          .limit(500);

        matchingQrCodeIds = qrMatches?.map(q => q.id) || [];

        // If no QR codes match, return empty results
        if (matchingQrCodeIds.length === 0) {
          setInventory([]);
          setTotalCount(0);
          setTableLoading(false);
          setInitialLoading(false);
          return;
        }
      }

      // Build query with filters
      // Use !inner join on lots when filtering by category
      // so PostgREST excludes parent rows that don't match the filter
      const needsInnerLots = categoryFilter !== 'all';
      const lotsJoin = needsInnerLots ? 'lots!inner' : 'lots';
      let query = supabase
        .from('inventory_items')
        .select(`
          id,
          shop_id,
          status,
          sold_at,
          created_at,
          selling_price,
          cost_price,
          tax_rate,
          sale_type,
          sale_reason,
          qr_codes (code, id),
          ${lotsJoin} (
            id,
            selling_price_default,
            cost_price_per_unit,
            tax_rate,
            date_of_stock_arrival,
            vendor_name,
            sale_type,
            min_margin_percent,
            sale_reason,
            categories (id, name),
            sizes (size_name),
            free_text_size
          )
        `, { count: 'exact' })
        .eq('shop_id', profile.shop_id);

      // Apply search filter using QR code IDs
      if (matchingQrCodeIds && matchingQrCodeIds.length > 0) {
        query = query.in('qr_code_id', matchingQrCodeIds);
      }

      // Apply status filter
      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter as any);
      }

      // Apply category filter
      if (categoryFilter !== 'all') {
        query = query.eq('lots.categories.id', categoryFilter);
      }

      // Apply sale type filter (now on inventory_items.sale_type)
      if (saleTypeFilter !== 'all') {
        if (saleTypeFilter === 'normal') {
          query = query.is('sale_type', null);
        } else {
          query = query.eq('sale_type', saleTypeFilter);
        }
      }

      // Apply date filter
      if (startDateISO) {
        query = query.gte('created_at', startDateISO);
      }
      if (dateFilter !== 'year') {
        query = query.lte('created_at', endDateISO);
      }

      // Apply sorting
      let orderColumn = 'created_at';
      let skipServerSort = false;
      switch (sortBy) {
        case 'qr_code':
          // QR code is in a joined table, can't sort server-side via PostgREST
          // Will sort client-side after fetch
          skipServerSort = true;
          orderColumn = 'created_at'; // fallback for pagination consistency
          break;
        case 'price':
          orderColumn = 'selling_price';
          break;
        case 'date':
          orderColumn = 'created_at';
          break;
        case 'status':
          orderColumn = 'status';
          break;
        default:
          orderColumn = 'created_at';
      }

      // Fetch with pagination (from/to come from useServerPagination hook)
      let query2 = query;
      if (!skipServerSort) {
        query2 = query2.order(orderColumn, { ascending: sortOrder === 'asc' });
      } else {
        query2 = query2.order(orderColumn, { ascending: true }); // default order for pagination
      }
      const { data, error, count } = await query2.range(from, to);

      if (error) throw error;

      // Guard: exclude items missing lot, category, or size data
      let finalData = (data || []).filter(item =>
        item.lots &&
        item.lots.categories?.name &&
        (item.lots.sizes?.size_name || item.lots.free_text_size)
      );

      // Client-side sort for QR code column
      if (skipServerSort && sortBy === 'qr_code') {
        finalData = [...finalData].sort((a, b) => {
          const codeA = a.qr_codes?.code?.toUpperCase() || '';
          const codeB = b.qr_codes?.code?.toUpperCase() || '';
          return sortOrder === 'asc' 
            ? codeA.localeCompare(codeB)
            : codeB.localeCompare(codeA);
        });
      }

      setInventory(finalData);
      setTotalCount(count || 0);
    } catch (error) {
      console.error('Error fetching inventory:', error);
      toast.error('Failed to load inventory. Please try again.');
    } finally {
      setTableLoading(false);
      setInitialLoading(false);
    }
  };

  // Load stats separately — decoupled from table data to reduce network calls
  // Uses stale-while-revalidate: only updates if fetch returns valid data
  useEffect(() => {
    if (profile?.shop_id) {
      getStats().then(newStats => {
        if (newStats) {
          setStats(newStats);
          setCachedStats('inventory_stats', newStats);
        }
      });
    }
  }, [profile?.shop_id, statsVersion, getStats]);

  // Sync URL with filter state
  useEffect(() => {
    const params = new URLSearchParams();
    if (statusFilter !== 'all') params.set('status', statusFilter);
    if (categoryFilter !== 'all') params.set('category', categoryFilter);
    if (saleTypeFilter !== 'all') params.set('sale_type', saleTypeFilter);
    if (dateFilter !== 'year') params.set('date', dateFilter);
    const newUrl = params.toString() ? `?${params.toString()}` : '/admin/inventory';
    router.replace(newUrl, { scroll: false });
  }, [statusFilter, categoryFilter, saleTypeFilter, dateFilter, router]);

  const exportInventory = async () => {
    try {
      if (!profile?.shop_id) return;

      let query = supabase
        .from('inventory_items')
        .select(`
          *,
          qr_code:qr_codes(code),
          category:categories(name),
          lot:lots(lot_number, size, price)
        `)
        .eq('shop_id', profile.shop_id);

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter as any);
      }

      if (categoryFilter !== 'all') {
        query = query.eq('category_id', categoryFilter);
      }

      if (debouncedSearchTerm) {
        query = query.or(`qr_code.ilike.%${debouncedSearchTerm}%`);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;
      if (!data || data.length === 0) {
        toast.warning('No data to export');
        return;
      }

      const exportData = data.map(item => {
        const lot = item.lot as any;
        return {
          'QR Code': (item.qr_code as any)?.code || 'N/A',
          'Category': (item.category as any)?.name || 'N/A',
          'Size': lot?.size || 'N/A',
          'Status': item.status,
          'Price': lot?.price || 0,
          'Date': formatDate(item.created_at)
        };
      });

      exportToCSV(exportData, { filename: 'inventory' });
      toast.success(`Exported ${data.length} items`);
    } catch (error: any) {
      console.error('Export error:', error);
      toast.error('Failed to export inventory');
    }
  };

  // Keyboard navigation for pagination
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Only handle if not typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.key === 'ArrowLeft' && currentPage > 1) {
        goToPrevPage();
      } else if (e.key === 'ArrowRight' && currentPage < totalPages) {
        goToNextPage();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [currentPage, totalPages]);

  // Build filter chips for active filters
  const filterChips: FilterChip[] = [];

  const handleAddToCart = useCallback((item: InventoryItemForList) => {
    if (!item.qr_codes || !item.lots) return;

    const cartItem: CartItem = {
      id: crypto.randomUUID(),
      qrCode: item.qr_codes.code.toUpperCase(),
      inventoryItemId: item.id,
      category: item.lots.categories?.name || 'Unknown',
      size: item.lots.sizes?.size_name || item.lots.free_text_size || 'N/A',
      originalPrice: item.selling_price ?? 0,
      finalPrice: item.selling_price ?? 0,
      taxRate: item.tax_rate ?? 0,
      lotId: item.lots.id,
      lotSaleType: item.sale_type ?? item.lots.sale_type,
      lotMinMargin: item.lots.min_margin_percent,
      lotSaleReason: item.sale_reason ?? item.lots.sale_reason,
      lotCostPrice: item.cost_price ?? undefined,
    };

    // Store item in sessionStorage for POS page to pick up
    const pending = JSON.parse(sessionStorage.getItem('pos_pending_items') || '[]');
    // Avoid duplicates
    if (pending.some((p: CartItem) => p.qrCode === cartItem.qrCode)) {
      toast.info('Item already pending in cart');
      return;
    }
    pending.push(cartItem);
    sessionStorage.setItem('pos_pending_items', JSON.stringify(pending));

    setViewingItem(null);
    toast.success(`${cartItem.category} queued — redirecting to POS`, { duration: 2000 });
    router.push('/pos');
  }, [router]);

  const handleEditFromDetails = useCallback((item: InventoryItemForList) => {
    setViewingItem(null);
    setEditingTableItem(item);
  }, []);

  const handleDeleteFromDetails = useCallback(async (item: InventoryItemForList) => {
    const { error } = await supabase
      .from('inventory_items')
      .delete()
      .eq('id', item.id)
      .neq('status', 'sold');
    if (error) { toast.error('Failed to delete item'); return; }
    toast.success('Item deleted');
    setViewingItem(null);
    fetchInventory();
    refreshStats();
  }, [fetchInventory, refreshStats]);

  if (statusFilter !== 'all') filterChips.push({ label: 'Status', value: statusFilter, onClear: () => { setStatusFilter('all'); setCurrentPage(1); }, className: 'capitalize' });
  if (categoryFilter !== 'all') filterChips.push({ label: 'Category', value: categories.find(c => c.id === categoryFilter)?.name || categoryFilter, onClear: () => { setCategoryFilter('all'); setCurrentPage(1); } });
  if (saleTypeFilter !== 'all') filterChips.push({ label: 'Order Type', value: saleTypeFilter === 'normal' ? 'Normal' : saleTypeFilter === 'promotion' ? 'Promotion Sale' : saleTypeFilter === 'festival' ? 'Festival Sale' : saleTypeFilter, onClear: () => { setSaleTypeFilter('all'); setCurrentPage(1); }, className: 'capitalize' });
  if (dateFilter !== 'year' && dateFilter !== 'custom') filterChips.push({ label: 'Date', value: dateFilter, onClear: () => { setDateFilter('year'); setCurrentPage(1); }, className: 'capitalize' });

  if (initialLoading) {
    return (
      <div className="space-y-4 md:space-y-6">
        {/* Header Skeleton */}
        <div className="flex flex-col gap-3">
          <div className="h-9 w-40 bg-muted animate-pulse rounded-md" />
          <div className="space-y-2">
            <div className="h-8 w-64 bg-muted animate-pulse rounded" />
            <div className="h-4 w-80 bg-muted animate-pulse rounded" />
          </div>
        </div>

        {/* Stats Skeleton */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="rounded-lg border p-3 md:p-4 animate-pulse">
              <div className="h-3 w-16 bg-muted rounded mb-2" />
              <div className="h-7 w-10 bg-muted rounded" />
            </div>
          ))}
        </div>

        {/* Table Skeleton */}
        <div className="rounded-lg border p-4 animate-pulse space-y-3">
          <div className="h-5 w-48 bg-muted rounded" />
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-10 bg-muted rounded" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6 animate-content-in pb-24">
      {/* Header */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href="/admin" className="relative group shrink-0">
              <div className={`p-2.5 rounded-lg ${s.headerIconGradient} text-white shadow-md group-hover:shadow-lg transition-shadow`}>
                <Package className="h-6 w-6" />
              </div>
              <div className="absolute -left-1.5 -top-1.5 bg-background border rounded-full p-1 shadow-sm group-hover:scale-110 transition-transform">
                <ArrowLeft className="h-3 w-3 text-muted-foreground" />
              </div>
            </Link>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Inventory Management</h1>
              <p className="text-sm text-muted-foreground mt-0.5">Manage your stock and inventory items</p>
            </div>
          </div>
          {/* Inline action buttons — visible on large screens */}
          <div className="hidden min-[1081px]:flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLotsHistoryOpen(true)}
              className={`${s.linkColor} ${s.linkHover} ${s.btnAnimation}`}
            >
              <History className="mr-1.5 h-3.5 w-3.5" />
              Lots History
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setBreakdownOpen(true)}
              className={`${s.linkColor} ${s.linkHover} ${s.btnAnimation}`}
            >
              <BarChart3 className="mr-1.5 h-3.5 w-3.5" />
              Category Breakdown
            </Button>
            <Button
              asChild
              className={`${s.primaryGradient} ${s.primaryGradientHover} ${s.btnAnimation}`}
            >
              <Link href="/admin/inventory/add-lot">
                <Plus className="mr-2 h-4 w-4" />
                Add Stock Lot
              </Link>
            </Button>
          </div>
        </div>
        {/* Stacked action buttons — visible on mobile/tablet */}
        <div className="flex min-[1081px]:hidden flex-col sm:flex-row gap-2">
          <div className="flex gap-2 flex-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLotsHistoryOpen(true)}
              className={`flex-1 ${s.linkColor} ${s.linkHover} ${s.btnAnimation}`}
            >
              <History className="mr-1.5 h-3.5 w-3.5" />
              Lots History
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setBreakdownOpen(true)}
              className={`flex-1 ${s.linkColor} ${s.linkHover} ${s.btnAnimation}`}
            >
              <BarChart3 className="mr-1.5 h-3.5 w-3.5" />
              Category Breakdown
            </Button>
          </div>
          <Button
            asChild
            className={`w-full sm:w-auto ${s.primaryGradient} ${s.primaryGradientHover} ${s.btnAnimation}`}
          >
            <Link href="/admin/inventory/add-lot">
              <Plus className="mr-2 h-4 w-4" />
              Add Stock Lot
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats Overview — clickable toggles that filter the table */}
      <div className="space-y-1.5">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-3">
          {([
            { key: 'all' as const,       label: 'Total Items', value: stats.total,     activeClass: `${s.statsActive.total.border} ${s.statsActive.total.bg}`,         textColor: '' },
            { key: 'available' as const,  label: 'Available',   value: stats.available,  activeClass: `${s.statsActive.available.border} ${s.statsActive.available.bg}`, textColor: s.statsActive.available.text || '' },
            { key: 'sold' as const,       label: 'Sold',        value: stats.sold,       activeClass: `${s.statsActive.sold.border} ${s.statsActive.sold.bg}`,           textColor: s.statsActive.sold.text || '' },
            { key: 'damaged' as const,    label: 'Damaged',     value: stats.damaged,    activeClass: `${s.statsActive.damaged.border} ${s.statsActive.damaged.bg}`,     textColor: s.statsActive.damaged.text || '' },
          ]).map(({ key, label, value, activeClass, textColor }) => {
            const isActive = statusFilter === key;
            const anyFilterActive = statusFilter !== 'all';
            return (
              <button
                key={key}
                onClick={() => {
                  setStatusFilter(isActive && key !== 'all' ? 'all' : key);
                  setCurrentPage(1);
                }}
                className={`rounded-lg border p-3 md:p-4 text-left transition-all ${
                  isActive
                    ? `border-l-4 shadow-sm ${activeClass}`
                    : anyFilterActive
                      ? 'opacity-50 hover:opacity-80 hover:bg-muted/50'
                      : 'hover:shadow-md hover:bg-muted/50'
                } cursor-pointer`}
              >
                <div className="text-xs text-muted-foreground">{label}</div>
                <div className={`text-2xl font-bold ${textColor}`}><CountUp end={value} /></div>
              </button>
            );
          })}
        </div>
        <p className="text-[11px] text-muted-foreground/60 pl-1">
          <Filter className="inline h-3 w-3 mr-0.5 -mt-0.5" />
          Click a metric to filter the table below
        </p>
      </div>

      {/* Inventory List with Integrated Filters */}
      <Card>
        <CardHeader className="pb-3 px-4 sm:px-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Inventory Items</CardTitle>
                <CardDescription className="text-sm mt-0.5">
                  {totalCount} items{statusFilter !== 'all' ? ` (${statusFilter})` : ''}{categoryFilter !== 'all' ? ` in ${categories.find(c => c.id === categoryFilter)?.name || 'category'}` : ''}
                </CardDescription>
              </div>
              <Button
                onClick={exportInventory}
                variant="outline"
                size="sm"
              >
                <Download className="mr-1.5 h-3.5 w-3.5" />
                Export
              </Button>
            </div>

            {/* Filters row — search + category dropdown */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1 min-w-0">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by QR, category, or size..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 text-sm"
                />
              </div>
              <Select value={categoryFilter} onValueChange={(v) => { setCategoryFilter(v); setCurrentPage(1); }}>
                <SelectTrigger className="w-full sm:w-[160px]">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={saleTypeFilter} onValueChange={(v) => { setSaleTypeFilter(v); setCurrentPage(1); }}>
                <SelectTrigger className="w-full sm:w-[170px]">
                  <SelectValue placeholder="All Item Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Item Types</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="promotion">Promotion Sale</SelectItem>
                  <SelectItem value="festival">Festival Sale</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Date Range Filter */}
            <DateRangeFilter
              value={dateFilter}
              onChange={setDateFilter}
              customRange={customRange}
              onCustomRangeChange={setCustomRange}
            />

            <FilterChips
              chips={filterChips}
              onClearAll={() => { setStatusFilter('all'); setCategoryFilter('all'); setSaleTypeFilter('all'); setDateFilter('year'); setCurrentPage(1); }}
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-4 px-3 sm:px-6">

          {/* Table */}
          <div className="overflow-x-auto -mx-3 px-3 sm:-mx-6 relative">
            {/* Subtle loading overlay — keeps table visible */}
            {tableLoading && (
              <div className="absolute inset-0 bg-background/60 z-10 flex items-center justify-center rounded-md">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Loading…
                </div>
              </div>
            )}
            {inventory.length === 0 && !tableLoading ? (
              <div className="text-center py-12">
                <Package className="h-12 w-12 md:h-16 md:w-16 mx-auto text-muted-foreground mb-3" />
                <p className="text-sm md:text-base text-muted-foreground mb-4">No items found</p>
                {totalCount === 0 && (
                  <Button asChild className={`${s.primaryGradient} ${s.primaryGradientHover}`}>
                    <Link href="/admin/inventory/add-lot">
                      <Plus className="mr-2 h-4 w-4" />
                      Add Your First Stock
                    </Link>
                  </Button>
                )}
              </div>
            ) : (
              <table className="w-full min-w-[800px]">
                <thead>
                  <tr className="border-b text-xs md:text-sm">
                    <SortableHeader column="qr_code" sortBy={sortBy} sortOrder={sortOrder} onSort={toggleSort} minWidth="120px">
                      QR Code
                    </SortableHeader>
                    <SortableHeader column="category" sortBy={sortBy} sortOrder={sortOrder} onSort={toggleSort} minWidth="110px">
                      Category
                    </SortableHeader>
                    <SortableHeader column="size" sortBy={sortBy} sortOrder={sortOrder} onSort={toggleSort} minWidth="80px">
                      Size
                    </SortableHeader>
                    <SortableHeader column="status" sortBy={sortBy} sortOrder={sortOrder} onSort={toggleSort} minWidth="100px">
                      Status
                    </SortableHeader>
                    <SortableHeader column="price" sortBy={sortBy} sortOrder={sortOrder} onSort={toggleSort} minWidth="100px">
                      Price
                    </SortableHeader>
                    <SortableHeader column="date" sortBy={sortBy} sortOrder={sortOrder} onSort={toggleSort} minWidth="110px">
                      Date
                    </SortableHeader>
                    <th className="text-center py-3 px-3 font-medium min-w-[80px]">
                      <span className="whitespace-nowrap">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {inventory.map((item, idx) => {
                    // Determine sale type styling from config tokens
                    const saleType = item.sale_type ?? item.lots?.sale_type;
                    const bgClass = saleType && s.rowTint[saleType as keyof typeof s.rowTint]
                      ? s.rowTint[saleType as keyof typeof s.rowTint]
                      : '';

                    return (
                      <tr
                        key={item.id}
                        className={`border-b hover:bg-muted/50 transition-colors group animate-stagger-fade-in cursor-pointer ${bgClass}`}
                        style={{ '--row-index': idx } as React.CSSProperties}
                        onClick={() => setViewingItem(item)}
                      >
                        <td className="py-3 px-3">
                          <Badge variant="outline" className={`font-mono ${s.accent.hoverBg} ${s.accent.hoverBorder}`}>
                            {item.qr_codes?.code}
                          </Badge>
                        </td>
                        <td className="py-3 px-3 text-xs whitespace-nowrap">
                          {item.lots?.categories?.name || 'No category'}
                        </td>
                        <td className="py-3 px-3 text-xs whitespace-nowrap">
                          {item.lots?.sizes?.size_name || item.lots?.free_text_size || 'No size'}
                        </td>
                        <td className="py-3 px-3">
                          <Badge
                            variant={
                              item.status === 'available'
                                ? 'default'
                                : item.status === 'sold'
                                  ? 'secondary'
                                  : 'destructive'
                            }
                            className="text-xs capitalize whitespace-nowrap"
                          >
                            {item.status}
                          </Badge>
                        </td>
                        <td className="py-3 px-3 text-xs font-semibold whitespace-nowrap">
                          {formatCurrency(item.selling_price || 0)}
                        </td>
                        <td className="py-3 px-3 text-xs text-muted-foreground whitespace-nowrap">
                          {formatDate(item.sold_at || item.created_at)}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setViewingItem(item);
                              }}
                              className="hover:bg-blue-50 hover:text-blue-600"
                              title="View details"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {item.status === 'available' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingTableItem(item);
                                }}
                                className="hover:bg-brand-50 hover:text-brand-600"
                                title="Edit item"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                            )}
                            {item.status === 'available' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteItem(item);
                                }}
                                className="hover:bg-red-50 hover:text-red-600"
                                title="Delete item"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          <PaginationControls
            currentPage={currentPage}
            totalPages={totalPages}
            totalCount={totalCount}
            startItem={startItem}
            endItem={endItem}
            itemsPerPage={itemsPerPage}
            onPageChange={setCurrentPage}
            onItemsPerPageChange={(size) => { setItemsPerPage(size); setCurrentPage(1); }}
          />
        </CardContent>
      </Card>

      {/* Inventory Item Details Dialog */}
      <InventoryItemDetailsDialog
        item={viewingItem}
        onClose={() => setViewingItem(null)}
        onEdit={handleEditFromDetails}
        onDelete={handleDeleteFromDetails}
        onAddToCart={handleAddToCart}
      />

      {/* Edit Inventory Item Dialog — triggered from table actions */}
      <EditInventoryItemDialog
        item={editingTableItem}
        onClose={() => setEditingTableItem(null)}
        onSaved={() => { fetchInventory(); refreshStats(); }}
      />

      {/* Category Breakdown Drawer */}
      <CategoryBreakdownSheet
        open={breakdownOpen}
        onOpenChange={setBreakdownOpen}
        shopId={profile?.shop_id ?? null}
      />

      {/* Lots History Drawer */}
      <LotsHistorySheet
        open={lotsHistoryOpen}
        onOpenChange={setLotsHistoryOpen}
        shopId={profile?.shop_id ?? null}
        onDataChanged={() => { fetchInventory(); refreshStats(); }}
      />
    </div>
  );
}
