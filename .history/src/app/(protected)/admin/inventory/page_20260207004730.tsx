'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Link from 'next/link';
import { Package, Plus, Search, ArrowLeft, ChevronRight, ChevronLeft, ChevronFirst, ChevronLast, Eye, Trash2, Download, X, RefreshCw } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { exportToCSV } from '@/lib/utils';
import { useServerPagination, useSortableTable, useDebouncedSearch, useDateFilter } from '@/hooks';
import { DateRangeFilter } from '@/components/shared/DateRangeFilter';
import { StatsCardGrid } from '@/components/shared/StatsCardGrid';
import { SortableHeader } from '@/components/shared/SortableHeader';
import { InventoryItemDetailsDialog } from '@/components/shared/InventoryItemDetailsDialog';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import type { InventoryItemForList, CategoryStat, Category } from '@/types';
import { toast } from 'sonner';

export default function InventoryPage() {
  const { profile } = useAuth();
  const [inventory, setInventory] = useState<InventoryItemForList[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [tableLoading, setTableLoading] = useState(false);
  const { searchTerm, debouncedSearchTerm, setSearchTerm } = useDebouncedSearch({ delay: 500 });
  const { dateFilter, setDateFilter, customRange, setCustomRange, startDateISO, endDateISO } = useDateFilter({ initialFilter: 'all' });
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryStats, setCategoryStats] = useState<CategoryStat[]>([]);
  const [viewingItem, setViewingItem] = useState<InventoryItemForList | null>(null);
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
  const [stats, setStats] = useState({ total: 0, available: 0, sold: 0, damaged: 0 });

  // Confirmation dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
  }>({ open: false, title: '', description: '', onConfirm: () => { } });

  useEffect(() => {
    if (profile?.shop_id) {
      fetchInventory();
      fetchCategories();
      fetchCategoryStats(); // Fetch category stats separately
    } else if (profile !== undefined) {
      setInitialLoading(false);
    }
  }, [profile?.shop_id, currentPage, itemsPerPage, debouncedSearchTerm, statusFilter, categoryFilter, dateFilter, customRange, sortBy, sortOrder]);

  const getStats = async () => {
    if (!profile?.shop_id) return { total: 0, available: 0, sold: 0, damaged: 0 };

    const { count: total } = await supabase
      .from('inventory_items')
      .select('*', { count: 'exact', head: true })
      .eq('shop_id', profile.shop_id);

    const { count: available } = await supabase
      .from('inventory_items')
      .select('*', { count: 'exact', head: true })
      .eq('shop_id', profile.shop_id)
      .eq('status', 'available');

    const { count: sold } = await supabase
      .from('inventory_items')
      .select('*', { count: 'exact', head: true })
      .eq('shop_id', profile.shop_id)
      .eq('status', 'sold');

    const { count: damaged } = await supabase
      .from('inventory_items')
      .select('*', { count: 'exact', head: true })
      .eq('shop_id', profile.shop_id)
      .eq('status', 'damaged');

    return {
      total: total || 0,
      available: available || 0,
      sold: sold || 0,
      damaged: damaged || 0,
    };
  };

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

  const handleDeleteItem = (item: any) => {
    setConfirmDialog({
      open: true,
      title: 'Delete Inventory Item',
      description: `Are you sure you want to delete item "${item.qr_codes?.code}"? This action cannot be undone.`,
      onConfirm: async () => {
        try {
          // Delete the QR code
          const { error: qrError } = await supabase
            .from('qr_codes')
            .delete()
            .eq('id', item.qr_codes?.id);

          if (qrError) throw qrError;

          // Delete the inventory item
          const { error: itemError } = await supabase
            .from('inventory_items')
            .delete()
            .eq('id', item.id);

          if (itemError) throw itemError;

          // Refresh inventory
          await fetchInventory();
        } catch (error) {
          console.error('Error deleting item:', error);
          toast.error('Failed to delete item. Please try again.');
        }
      },
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
      let query = supabase
        .from('inventory_items')
        .select(`
          id,
          shop_id,
          status,
          sold_at,
          created_at,
          qr_codes (code, id),
          lots (
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

      // Apply date filter
      if (startDateISO) {
        query = query.gte('created_at', startDateISO);
      }
      if (dateFilter !== 'all') {
        query = query.lte('created_at', endDateISO);
      }

      // Apply sorting
      let orderColumn = 'created_at';
      switch (sortBy) {
        case 'qr_code':
          orderColumn = 'qr_codes.code';
          break;
        case 'price':
          orderColumn = 'lots.selling_price_default';
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
      const { data, error, count } = await query
        .order(orderColumn, { ascending: sortOrder === 'asc' })
        .range(from, to);

      if (error) throw error;
      setInventory(data || []);
      setTotalCount(count || 0);
    } catch (error) {
      console.error('Error fetching inventory:', error);
    } finally {
      setTableLoading(false);
      setInitialLoading(false);
    }
  };

  const fetchCategoryStats = async () => {
    if (!profile?.shop_id) return;

    try {
      // Fetch ALL inventory items with category info (not paginated)
      const { data, error } = await supabase
        .from('inventory_items')
        .select(`
          id,
          status,
          lots (
            categories (id, name)
          )
        `)
        .eq('shop_id', profile.shop_id);

      if (error) throw error;

      // Calculate category stats from all data
      const statsMap = new Map();

      (data || []).forEach(item => {
        const categoryId = item.lots?.categories?.id;
        const categoryName = item.lots?.categories?.name || 'Uncategorized';

        if (!statsMap.has(categoryId)) {
          statsMap.set(categoryId, {
            id: categoryId,
            name: categoryName,
            total: 0,
            available: 0,
            sold: 0,
          });
        }

        const stat = statsMap.get(categoryId);
        stat.total++;
        if (item.status === 'available') stat.available++;
        if (item.status === 'sold') stat.sold++;
      });

      const stats = Array.from(statsMap.values())
        .sort((a, b) => b.total - a.total)
        .slice(0, 6);

      setCategoryStats(stats);
    } catch (error) {
      console.error('Error fetching category stats:', error);
    }
  };

  const calculateCategoryStats = (items: any[]) => {
    const statsMap = new Map();

    items.forEach(item => {
      const categoryId = item.lots?.categories?.id;
      const categoryName = item.lots?.categories?.name || 'Uncategorized';

      if (!statsMap.has(categoryId)) {
        statsMap.set(categoryId, {
          id: categoryId,
          name: categoryName,
          total: 0,
          available: 0,
          sold: 0,
        });
      }

      const stat = statsMap.get(categoryId);
      stat.total++;
      if (item.status === 'available') stat.available++;
      if (item.status === 'sold') stat.sold++;
    });

    const stats = Array.from(statsMap.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 6);

    setCategoryStats(stats);
  };

  // Apply sorting (already handled server-side, but keep for UI consistency)
  const sortedInventory = [...inventory];

  // Load stats separately
  useEffect(() => {
    if (profile?.shop_id) {
      getStats().then(setStats);
    }
  }, [profile?.shop_id, inventory]); // Reload stats when inventory changes

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
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
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
    <div className="space-y-4 md:space-y-6">
      {/* Header with Back Button */}
      <div className="flex flex-col gap-3">
        <Button
          variant="ghost"
          asChild
          className="w-fit -ml-2 text-teal-600 hover:text-teal-700 hover:bg-teal-50"
        >
          <Link href="/admin">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Link>
        </Button>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Inventory Management</h1>
            <p className="text-sm text-muted-foreground mt-1">Manage your stock and inventory items</p>
          </div>
          <Button
            asChild
            className="bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-600 hover:to-cyan-700 transition-all hover:scale-105 active:scale-95"
          >
            <Link href="/admin/inventory/add-lot">
              <Plus className="mr-2 h-4 w-4" />
              Add Stock Lot
            </Link>
          </Button>
        </div>
      </div>

      {/* Category Stats */}
      {categoryStats.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Category Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
              {categoryStats.map((stat) => {
                const isActive = categoryFilter === stat.id;
                const anyActive = categoryFilter !== 'all';
                return (
                  <button
                    key={stat.id}
                    className={`p-3 border rounded-lg text-left transition-all ${isActive
                        ? 'border-l-4 border-l-teal-500 bg-teal-50 shadow-sm dark:bg-teal-950/30'
                        : anyActive
                          ? 'opacity-50 hover:opacity-80 hover:bg-muted/50'
                          : 'hover:shadow-md hover:bg-teal-50'
                      } cursor-pointer`}
                    onClick={() => setCategoryFilter(isActive ? 'all' : stat.id)}
                  >
                    <div className="text-sm font-medium truncate">{stat.name}</div>
                    <div className="text-lg font-bold text-teal-600">{stat.available}</div>
                    <div className="text-xs text-muted-foreground">of {stat.total}</div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Cards - 2x2 on mobile */}
      <StatsCardGrid
        filterHint="Click a metric to filter the table below"
        stats={[
          {
            label: 'Total Items',
            value: stats.total,
            isActive: statusFilter === 'all',
            activeClassName: 'border-l-teal-500 bg-teal-50 dark:bg-teal-950/30',
            onClick: () => { setStatusFilter(statusFilter === 'all' ? 'all' : 'all'); },
          },
          {
            label: 'Available',
            value: stats.available,
            valueColor: 'text-green-600',
            isActive: statusFilter === 'available',
            activeClassName: 'border-l-green-500 bg-green-50 dark:bg-green-950/30',
            onClick: () => { setStatusFilter(statusFilter === 'available' ? 'all' : 'available'); },
          },
          {
            label: 'Sold',
            value: stats.sold,
            valueColor: 'text-blue-600',
            isActive: statusFilter === 'sold',
            activeClassName: 'border-l-blue-500 bg-blue-50 dark:bg-blue-950/30',
            onClick: () => { setStatusFilter(statusFilter === 'sold' ? 'all' : 'sold'); },
          },
          {
            label: 'Damaged',
            value: stats.damaged,
            valueColor: 'text-red-600',
            isActive: statusFilter === 'damaged',
            activeClassName: 'border-l-red-500 bg-red-50 dark:bg-red-950/30',
            onClick: () => { setStatusFilter(statusFilter === 'damaged' ? 'all' : 'damaged'); },
          },
        ]}
      />

      {/* Inventory List with Integrated Filters */}
      <Card>
        <CardHeader className="pb-3">
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

            {/* Date Range Filter */}
            <DateRangeFilter
              value={dateFilter}
              onChange={setDateFilter}
              customRange={customRange}
              onCustomRangeChange={setCustomRange}
            />

            {/* Filters row — search + status dropdown + category dropdown */}
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
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-[150px]">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="available">Available</SelectItem>
                  <SelectItem value="sold">Sold</SelectItem>
                  <SelectItem value="damaged">Damaged</SelectItem>
                </SelectContent>
              </Select>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-full sm:w-[180px]">
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
            </div>

            {/* Active filter chips — visual bridge between stats/categories and table */}
            {(statusFilter !== 'all' || categoryFilter !== 'all' || dateFilter !== 'all') && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-muted-foreground">Filtered by:</span>
                {statusFilter !== 'all' && (
                  <Badge variant="secondary" className="gap-1 pl-2 pr-1 capitalize">
                    Status: {statusFilter}
                    <button
                      onClick={() => setStatusFilter('all')}
                      className="ml-1 rounded-full hover:bg-muted-foreground/20 p-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                )}
                {categoryFilter !== 'all' && (
                  <Badge variant="secondary" className="gap-1 pl-2 pr-1">
                    Category: {categories.find(c => c.id === categoryFilter)?.name || categoryFilter}
                    <button
                      onClick={() => setCategoryFilter('all')}
                      className="ml-1 rounded-full hover:bg-muted-foreground/20 p-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                )}
                {dateFilter !== 'all' && dateFilter !== 'custom' && (
                  <Badge variant="secondary" className="gap-1 pl-2 pr-1 capitalize">
                    Date: {dateFilter}
                    <button
                      onClick={() => setDateFilter('all')}
                      className="ml-1 rounded-full hover:bg-muted-foreground/20 p-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                )}
                <button
                  onClick={() => { setStatusFilter('all'); setCategoryFilter('all'); setDateFilter('all'); }}
                  className="text-xs text-muted-foreground hover:text-foreground underline"
                >
                  Clear all
                </button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">

          {/* Table */}
          <div className="overflow-x-auto -mx-6 px-6 relative">
            {/* Subtle loading overlay — keeps table visible */}
            {tableLoading && (
              <div className="absolute inset-0 bg-background/60 z-10 flex items-center justify-center rounded-md">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Loading…
                </div>
              </div>
            )}
            {sortedInventory.length === 0 && !tableLoading ? (
              <div className="text-center py-12">
                <Package className="h-12 w-12 md:h-16 md:w-16 mx-auto text-muted-foreground mb-3" />
                <p className="text-sm md:text-base text-muted-foreground mb-4">No items found</p>
                {totalCount === 0 && (
                  <Button asChild className="bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-600 hover:to-cyan-700">
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
                  {sortedInventory.map((item) => {
                    // Determine sale type styling
                    const saleType = item.lots?.sale_type;
                    const bgClass = saleType === 'festival'
                      ? 'bg-gradient-to-r from-green-50/60 via-green-50/30 to-transparent border-l-[3px] border-l-green-500'
                      : saleType === 'clearance'
                        ? 'bg-gradient-to-r from-red-50/60 via-red-50/30 to-transparent border-l-[3px] border-l-red-500'
                        : saleType === 'promotion'
                          ? 'bg-gradient-to-r from-blue-50/60 via-blue-50/30 to-transparent border-l-[3px] border-l-blue-500'
                          : '';

                    return (
                      <tr
                        key={item.id}
                        className={`border-b hover:bg-muted/50 transition-colors group ${bgClass}`}
                      >
                        <td className="py-3 px-3 font-mono text-xs font-semibold whitespace-nowrap">
                          {item.qr_codes?.code}
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
                          {formatCurrency(item.lots?.selling_price_default || 0)}
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

          {/* Pagination Controls */}
          {totalCount > 0 && (
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
                    onValueChange={(value) => {
                      setItemsPerPage(parseInt(value));
                      setCurrentPage(1);
                    }}
                  >
                    <SelectTrigger className="w-20 h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="25">25</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                      <SelectItem value="100">100</SelectItem>
                      <SelectItem value="200">200</SelectItem>
                      <SelectItem value="500">500</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  title="First page"
                >
                  <ChevronFirst className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={goToPrevPage}
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
                  onClick={goToNextPage}
                  disabled={currentPage === totalPages}
                  title="Next page"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  title="Last page"
                >
                  <ChevronLast className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Inventory Item Details Dialog */}
      <InventoryItemDetailsDialog
        item={viewingItem}
        onClose={() => setViewingItem(null)}
      />

      {/* Confirmation Dialog */}
      <ConfirmDialog
        open={confirmDialog.open}
        onOpenChange={(open) => setConfirmDialog({ ...confirmDialog, open })}
        onConfirm={confirmDialog.onConfirm}
        title={confirmDialog.title}
        description={confirmDialog.description}
        confirmText="Delete"
        cancelText="Cancel"
        variant="destructive"
      />
    </div>
  );
}
