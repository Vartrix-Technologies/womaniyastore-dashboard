'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { fetchSales, getSalesStats } from '@/lib/api/sales';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DateRangeFilter } from '@/components/shared/DateRangeFilter';
import Link from 'next/link';
import { Search, Eye, Download, ArrowLeft, Receipt, BarChart3, Users, History, BrainCircuit } from 'lucide-react';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { formatCurrency, formatDate, formatTime } from '@/lib/formatters';
import { exportToCSV, type DateFilterType } from '@/lib/utils';
import { useDateFilter, useServerPagination, useSortableTable, useDebouncedSearch } from '@/hooks';
import { StatsCardGrid } from '@/components/shared/StatsCardGrid';
import { CountUp } from '@/components/shared/CountUp';
import { SortableHeader } from '@/components/shared/SortableHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { PaginationControls } from '@/components/shared/PaginationControls';
import { FilterChips, type FilterChip } from '@/components/shared/FilterChips';
import { BillPreviewDialog } from '@/components/shared/BillPreviewDialog';
import { VendorPerformance, CategoryPerformance, SaleTypeAnalysis, RevenueTrendChart, PaymentMethodBreakdown, TopCustomers, InsightsPanel, RevenueHeatmap, MarginByCategoryChart, CohortRetentionGrid } from '@/components/admin/analytics';
import type { SaleForList } from '@/types';
import { toast } from 'sonner';
import { appConfig } from '@/lib/config/app.config';
import { getCachedStats, setCachedStats } from '@/lib/utils/stats-cache';

const s = appConfig.styles;

type SalesSortColumn = 'bill_number' | 'total_amount' | 'created_at';

export default function SalesPage() {
  return (
    <Suspense fallback={
      <div className="space-y-4 md:space-y-6 p-4">
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        <div className="h-10 w-full bg-muted animate-pulse rounded" />
        <div className="h-64 w-full bg-muted animate-pulse rounded" />
      </div>
    }>
      <SalesPageContent />
    </Suspense>
  );
}

function SalesPageContent() {
  const { profile } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Initialize state from URL params
  const initialTab = searchParams.get('tab') || 'transactions';
  const initialFilter = (searchParams.get('filter') as DateFilterType) || 'month';
  const initialSection = searchParams.get('section') || null;
  const hasScrolled = useRef(false);
  
  const [sales, setSales] = useState<SaleForList[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [activeTab, setActiveTab] = useState(initialTab);
  const [stats, setStats] = useState(() => getCachedStats('sales_stats', { 
    totalSales: 0, 
    totalRevenue: 0, 
    totalDiscount: 0, 
    avgSale: 0,
  }));
  const [saleTypeFilter, setSaleTypeFilter] = useState<string>('all');
  const [viewingSale, setViewingSale] = useState<SaleForList | null>(null);
  const [showExportWarning, setShowExportWarning] = useState(false);

  // Use custom hooks - initialize date filter from URL
  const { dateFilter, setDateFilter, customRange, setCustomRange, startDateISO, endDateISO } = useDateFilter({ initialFilter });
  const { searchTerm, debouncedSearchTerm, setSearchTerm } = useDebouncedSearch({ delay: 500 });
  const { sortBy, sortOrder, toggleSort } = useSortableTable<SalesSortColumn>({ initialSortBy: 'created_at' });
  const { 
    currentPage, itemsPerPage, setCurrentPage, setItemsPerPage,
    from, to, totalPages, startItem, endItem 
  } = useServerPagination({ totalCount });

  // Sync URL with tab and filter state
  useEffect(() => {
    const params = new URLSearchParams();
    if (activeTab !== 'transactions') {
      params.set('tab', activeTab);
    }
    if (dateFilter !== 'week') {
      params.set('filter', dateFilter);
    }
    const newUrl = params.toString() ? `?${params.toString()}` : '/admin/sales';
    router.replace(newUrl, { scroll: false });
  }, [activeTab, dateFilter, router]);

  // Handle tab change
  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
  };

  // Auto-scroll to a specific BI section when deep-linked from homepage
  useEffect(() => {
    if (initialSection && activeTab === 'analytics' && !hasScrolled.current) {
      hasScrolled.current = true;
      requestAnimationFrame(() => {
        document.getElementById(`bi-${initialSection}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  }, [activeTab, initialSection]);

  // Handle date filter change
  const handleDateFilterChange = (filter: DateFilterType) => {
    setDateFilter(filter);
  };

  const handleCustomRangeChange = (range: import('@/lib/utils').CustomDateRange | undefined) => {
    setCustomRange(range);
  };

  // Load stats separately — depends on filters but NOT on pagination/sort
  // Stale-while-revalidate: keeps previous stats on error (offline, etc.)
  useEffect(() => {
    if (!profile?.shop_id) return;
    const shopId = profile.shop_id as string;
    getSalesStats({
      shopId,
      startDate: startDateISO ?? undefined,
      searchTerm: debouncedSearchTerm,
      saleTypeFilter,
    }).then(newStats => {
      setStats(newStats);
      setCachedStats('sales_stats', newStats);
    }).catch((error) => {
      console.warn('Sales stats fetch failed — keeping previous values:', error);
    });
  }, [profile?.shop_id, dateFilter, customRange, debouncedSearchTerm, saleTypeFilter]);

  useEffect(() => {
    if (profile?.shop_id) {
      loadSales();
    } else if (profile !== undefined) {
      // Profile loaded but no shop_id
      setLoading(false);
    }
  }, [profile?.shop_id, dateFilter, customRange, currentPage, itemsPerPage, debouncedSearchTerm, sortBy, sortOrder, saleTypeFilter]);

  const loadSales = async () => {
    try {
      setLoading(true);
      
      if (!profile?.shop_id) return;
      const shopId = profile.shop_id as string;

      // Build query with filters
      const { supabase } = await import('@/lib/supabase');
      let query = supabase
        .from('sales')
        .select(`
          *,
          sale_items (*)
        `, { count: 'exact' })
        .eq('shop_id', shopId);

      // Apply date filter
      if (startDateISO) {
        query = query.gte('created_at', startDateISO);
      }
      if (dateFilter !== 'year') {
        query = query.lte('created_at', endDateISO);
      }

      // Apply search filter (customer name, phone, or bill number)
      if (debouncedSearchTerm) {
        const searchLower = debouncedSearchTerm.toLowerCase().trim();
        const isNumericSearch = /^\d+$/.test(searchLower);
        
        if (isNumericSearch && searchLower.length >= 4) {
          // For numeric searches (min 4 digits), search bill_number prefix OR name/phone
          // Bill numbers are like 20260205123456 (YYYYMMDDHHMMSS)
          // Pad with zeros to create range for prefix matching
          const paddedMin = searchLower.padEnd(14, '0');
          const paddedMax = searchLower.padEnd(14, '9');
          query = query.or(
            `customer_name.ilike.%${searchLower}%,customer_phone.ilike.%${searchLower}%,and(bill_number.gte.${paddedMin},bill_number.lte.${paddedMax})`
          );
        } else {
          // For text searches or short numeric, only search name and phone
          query = query.or(`customer_name.ilike.%${searchLower}%,customer_phone.ilike.%${searchLower}%`);
        }
      }

      // sale_type is derived from sale_items, not a direct column on sales.
      // When a sale type filter is active, fetch the full dataset and paginate client-side
      // so totalCount and displayed rows are both correct.
      if (saleTypeFilter !== 'all') {
        const { data: allData, error: allError } = await query
          .order(sortBy, { ascending: sortOrder === 'asc' });

        if (allError) throw allError;

        const filteredData = ((allData || []) as unknown as SaleForList[]).filter((sale) => {
          const items = sale.sale_items || [];
          if (saleTypeFilter === 'regular') {
            return items.every((item) => !item.sold_on_sale);
          } else if (saleTypeFilter === 'mixed') {
            const hasSaleItems = items.some((item) => item.sold_on_sale);
            const hasRegularItems = items.some((item) => !item.sold_on_sale);
            return hasSaleItems && hasRegularItems;
          } else {
            return items.some((item) => item.sold_on_sale && item.sale_type === saleTypeFilter);
          }
        });

        setTotalCount(filteredData.length);
        setSales(filteredData.slice(from, to + 1));
      } else {
        // No sale type filter — use server-side pagination normally
        const { data, error, count } = await query
          .order(sortBy, { ascending: sortOrder === 'asc' })
          .range(from, to);

        if (error) throw error;

        setSales((data || []) as unknown as SaleForList[]);
        setTotalCount(count || 0);
      }
    } catch (error) {
      console.error('Error fetching sales:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExportClick = () => {
    if (totalCount > 10000) {
      setShowExportWarning(true);
    } else {
      exportSales();
    }
  };

  const exportSales = async () => {
    try {
      if (!profile?.shop_id) return;
      const shopId = profile.shop_id as string;

      const { supabase } = await import('@/lib/supabase');
      let query = supabase
        .from('sales')
        .select(`
          *,
          sale_items (*)
        `)
        .eq('shop_id', shopId);

      if (startDateISO) {
        query = query.gte('created_at', startDateISO);
      }

      if (debouncedSearchTerm) {
        const searchLower = debouncedSearchTerm.toLowerCase();
        query = query.or(`customer_name.ilike.%${searchLower}%,customer_phone.ilike.%${searchLower}%`);
      }

      const { data, error } = await query.order('created_at', { ascending: false });
      
      if (error) throw error;
      if (!data || data.length === 0) {
        toast.warning('No data to export');
        return;
      }

      const exportData = data.map(sale => {
        const items = sale.sale_items as any[] || [];
        const festivalCount = items.filter(item => item.sold_on_sale && item.sale_type === 'festival').length;
        const clearanceCount = items.filter(item => item.sold_on_sale && item.sale_type === 'clearance').length;
        const promotionCount = items.filter(item => item.sold_on_sale && item.sale_type === 'promotion').length;
        const regularCount = items.filter(item => !item.sold_on_sale).length;
        
        return {
          'Bill Number': sale.bill_number,
          'Customer Name': sale.customer_name || 'Walk-in',
          'Customer Phone': sale.customer_phone || 'N/A',
          'Items Count': items.length,
          'Regular Items': regularCount,
          'Festival Items': festivalCount,
          'Clearance Items': clearanceCount,
          'Promotion Items': promotionCount,
          'Payment Method': sale.payment_method,
          'Total Amount': sale.total_amount,
          'Discount': sale.total_discount || 0,
          'Date': formatDate(sale.created_at),
          'Time': formatTime(sale.created_at),
        };
      });

      exportToCSV(exportData, { filename: 'sales' });
      toast.success(`Exported ${data.length} sales`);
    } catch (error: any) {
      console.error('Export error:', error);
      toast.error('Failed to export sales');
    }
  };

  // Customer history: set search term to filter by customer
  const showCustomerHistory = (customerName: string) => {
    setSearchTerm(customerName);
    setActiveTab('transactions');
    setCurrentPage(1);
  };

  // Keyboard navigation for pagination
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.key === 'ArrowLeft' && currentPage > 1) {
        setCurrentPage(currentPage - 1);
      } else if (e.key === 'ArrowRight' && currentPage < totalPages) {
        setCurrentPage(currentPage + 1);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [currentPage, totalPages, setCurrentPage]);

  // Stats are now fetched from the full filtered dataset in loadSales()

  // Build filter chips for active filters
  const filterChips: FilterChip[] = [];
  if (saleTypeFilter !== 'all') filterChips.push({ label: 'Type', value: saleTypeFilter, onClear: () => { setSaleTypeFilter('all'); setCurrentPage(1); }, className: 'capitalize' });
  if (dateFilter !== 'year' && dateFilter !== 'custom') filterChips.push({ label: 'Date', value: dateFilter, onClear: () => { setDateFilter('year'); setCurrentPage(1); }, className: 'capitalize' });
  if (debouncedSearchTerm) filterChips.push({ label: 'Search', value: `"${debouncedSearchTerm}"`, onClear: () => { setSearchTerm(''); setCurrentPage(1); } });

  return (
    <div className="space-y-4 md:space-y-6 pb-24">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/admin" className="relative group shrink-0">
          <div className={`p-2.5 rounded-lg ${s.headerIconGradient} text-white shadow-md group-hover:shadow-lg transition-shadow`}>
            <Receipt className="h-6 w-6" />
          </div>
          <div className="absolute -left-1.5 -top-1.5 bg-background border rounded-full p-1 shadow-sm group-hover:scale-110 transition-transform">
            <ArrowLeft className="h-3 w-3 text-muted-foreground" />
          </div>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Sales Hub</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Transactions, analytics, and vendor performance</p>
        </div>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-0">
        <TabsList className="grid w-full grid-cols-3 h-11">
          <TabsTrigger value="transactions" className="flex items-center gap-2 text-sm">
            <Receipt className="h-4 w-4" />
            Transactions
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center gap-2 text-sm">
            <BarChart3 className="h-4 w-4" />
            Analytics
          </TabsTrigger>
          <TabsTrigger value="vendors" className="flex items-center gap-2 text-sm">
            <Users className="h-4 w-4" />
            Vendors
          </TabsTrigger>
        </TabsList>

      {/* Shared Date Range Filter — applies to all tabs */}
      <DateRangeFilter
        value={dateFilter}
        onChange={handleDateFilterChange}
        customRange={customRange}
        onCustomRangeChange={handleCustomRangeChange}
      />

        {/* Transactions Tab */}
        <TabsContent value="transactions" className="space-y-4">
          {/* Stats Cards - 2x2 on mobile */}
          <StatsCardGrid
            stats={[
              { label: 'Total Bills', value: <CountUp end={stats.totalSales} /> },
              { label: 'Total Revenue', value: <CountUp end={stats.totalRevenue} prefix="₹" />, valueColor: 'text-emerald-600 dark:text-emerald-400' },
              { label: 'Total Discount', value: <CountUp end={stats.totalDiscount} prefix="₹" />, valueColor: 'text-amber-600 dark:text-amber-400' },
              { label: 'Average Bill', value: <CountUp end={stats.avgSale} prefix="₹" /> },
            ]}
          />

      {/* Sales List */}
      <Card>
        <CardHeader>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Recent Bills</CardTitle>
                <CardDescription className="text-sm mt-1">
                  Total {totalCount} bills
                </CardDescription>
              </div>
              <Button 
                onClick={handleExportClick} 
                variant="outline"
                size="sm"
                className={s.btnAnimation}
              >
                <Download className="mr-2 h-4 w-4" />
                Export
              </Button>
            </div>

            {/* Filters */}
            <div className="flex flex-col gap-3">
              {/* Search and Sale Type Filter */}
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by bill number, customer name, or phone..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 text-sm"
                  />
                </div>
                <div className="w-full sm:w-[110px]">
                  <Select value={saleTypeFilter} onValueChange={setSaleTypeFilter}>
                    <SelectTrigger className="text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Sales</SelectItem>
                      <SelectItem value="regular">Regular Only</SelectItem>
                      <SelectItem value="mixed">Mixed (Sale + Regular)</SelectItem>
                      <SelectItem value="festival">
                        <span className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-green-500"></span>
                          Festival Sales
                        </span>
                      </SelectItem>
                      <SelectItem value="clearance">
                        <span className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-red-500"></span>
                          Clearance
                        </span>
                      </SelectItem>
                      <SelectItem value="promotion">
                        <span className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                          Promotions
                        </span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <FilterChips
                chips={filterChips}
                onClearAll={() => { setSaleTypeFilter('all'); setDateFilter('year'); setSearchTerm(''); setCurrentPage(1); }}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-4 sm:px-6">
          <div className="overflow-x-auto">
            {loading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="p-4 border rounded-lg animate-pulse">
                    <div className="h-4 bg-muted rounded w-1/4 mb-2"></div>
                    <div className="h-3 bg-muted rounded w-1/2"></div>
                  </div>
                ))}
              </div>
            ) : sales.length === 0 ? (
              <EmptyState
                icon={Receipt}
                title="No sales found"
                description="Start making sales at the POS"
              />
            ) : (
              <table className="w-full min-w-[800px] animate-content-in">
                <thead>
                  <tr className="border-b text-xs md:text-sm">
                    <SortableHeader column="bill_number" sortBy={sortBy} sortOrder={sortOrder} onSort={toggleSort} minWidth="100px">
                      Bill #
                    </SortableHeader>
                    <th className="text-left py-3 px-3 font-medium text-muted-foreground min-w-[120px]">
                      <span className="whitespace-nowrap">Customer</span>
                    </th>
                    <th className="text-left py-3 px-3 font-medium text-muted-foreground min-w-[80px]">
                      <span className="whitespace-nowrap">Items</span>
                    </th>
                    <th className="text-left py-3 px-3 font-medium text-muted-foreground min-w-[100px]">
                      <span className="whitespace-nowrap">Payment</span>
                    </th>
                    <SortableHeader column="total_amount" sortBy={sortBy} sortOrder={sortOrder} onSort={toggleSort} minWidth="110px">
                      Amount
                    </SortableHeader>
                    <SortableHeader column="created_at" sortBy={sortBy} sortOrder={sortOrder} onSort={toggleSort} minWidth="130px">
                      Date & Time
                    </SortableHeader>
                    <th className="text-center py-3 px-3 font-medium text-muted-foreground min-w-[60px]">
                      <span className="whitespace-nowrap">Action</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sales.map((sale, idx) => {
                    // Bill number is now timestamp-based (YYYYMMDDHHMMSS), no padding needed
                    const billNumber = `${sale.bill_prefix || ''}${sale.bill_number}`;
                    
                    // Check for sale types in items
                    const saleItems = sale.sale_items || [];
                    const hasFestival = saleItems.some((item) => item.sold_on_sale && item.sale_type === 'festival');
                    const hasClearance = saleItems.some((item) => item.sold_on_sale && item.sale_type === 'clearance');
                    const hasPromotion = saleItems.some((item) => item.sold_on_sale && item.sale_type === 'promotion');
                    const rowTint = hasFestival ? s.rowTint.festival
                      : hasClearance ? s.rowTint.clearance
                      : hasPromotion ? s.rowTint.promotion
                      : '';
                    
                    return (
                      <tr key={sale.id} className={`border-b hover:bg-muted/50 transition-colors animate-stagger-fade-in cursor-pointer ${rowTint}`} style={{ '--row-index': idx } as React.CSSProperties} onClick={() => setViewingSale(sale)}>
                        <td className="py-3 px-3">
                          <Badge variant="outline" className={`font-mono ${s.accent.hoverBg} ${s.accent.hoverBorder}`}>
                            <span className="flex items-center gap-2">
                              {billNumber}
                              {(hasFestival || hasClearance || hasPromotion) && (
                                <span className="flex items-center gap-1">
                                  {hasFestival && <span className="w-1.5 h-1.5 rounded-full bg-green-500" title="Festival sale"></span>}
                                  {hasClearance && <span className="w-1.5 h-1.5 rounded-full bg-red-500" title="Clearance"></span>}
                                  {hasPromotion && <span className="w-1.5 h-1.5 rounded-full bg-blue-500" title="Promotion"></span>}
                                </span>
                              )}
                            </span>
                          </Badge>
                        </td>
                        <td className="py-3 px-3 text-sm">
                          <div className="flex items-center gap-1">
                            <span className="whitespace-nowrap">{sale.customer_name || 'Walk-in'}</span>
                            {sale.customer_name && (
                              <button
                                onClick={(e) => { e.stopPropagation(); showCustomerHistory(sale.customer_name!); }}
                                className={`p-0.5 rounded hover:bg-muted ${s.linkColor}`}
                                title={`View all purchases by ${sale.customer_name}`}
                              >
                                <History className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                          {sale.customer_phone && (
                            <div className="text-xs text-muted-foreground whitespace-nowrap">{sale.customer_phone}</div>
                          )}
                        </td>
                        <td className="py-3 px-3 text-sm whitespace-nowrap">
                          {sale.sale_items?.length || 0}
                        </td>
                        <td className="py-3 px-3">
                          <Badge
                            variant={sale.payment_method === 'cash' ? 'default' : 'secondary'}
                            className="text-xs whitespace-nowrap"
                          >
                            {sale.payment_method}
                          </Badge>
                          {(sale.total_discount ?? 0) > 0 && (
                            <div className="text-xs text-amber-600 dark:text-amber-400 whitespace-nowrap mt-1">
                              -{formatCurrency(sale.total_discount ?? 0)}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-3 text-sm font-semibold text-emerald-600 dark:text-emerald-400 whitespace-nowrap tabular-nums">
                          {formatCurrency(sale.total_amount)}
                        </td>
                        <td className="py-3 px-3 text-muted-foreground">
                          <div className="text-sm whitespace-nowrap">{formatDate(sale.created_at)}</div>
                          <div className="text-xs whitespace-nowrap">{formatTime(sale.created_at)}</div>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="hover:bg-muted dark:hover:bg-muted"
                            title="View bill details"
                            onClick={(e) => { e.stopPropagation(); setViewingSale(sale); }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
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

          {/* Row tint legend */}
          <div className="flex items-center gap-4 flex-wrap text-xs text-muted-foreground pt-3 border-t mt-3">
            <span className="font-medium">Row colors:</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-2 rounded-sm bg-gradient-to-r from-green-200 to-green-50 border-l-2 border-l-green-500" /> Festival</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-2 rounded-sm bg-gradient-to-r from-red-200 to-red-50 border-l-2 border-l-red-500" /> Clearance</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-2 rounded-sm bg-gradient-to-r from-blue-200 to-blue-50 border-l-2 border-l-blue-500" /> Promotion</span>
          </div>
        </CardContent>
      </Card>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-6">
          {profile?.shop_id && (
            <>
              {/* Revenue Trend — full width hero chart */}
              <RevenueTrendChart
                shopId={profile.shop_id as string}
                startDate={startDateISO}
                endDate={endDateISO}
                dateFilter={dateFilter}
              />

              {/* Row 2: Payment methods + Top customers */}
              <div className="grid gap-6 lg:grid-cols-2">
                <PaymentMethodBreakdown
                  shopId={profile.shop_id as string}
                  startDate={startDateISO}
                  endDate={endDateISO}
                />
                <TopCustomers
                  shopId={profile.shop_id as string}
                  startDate={startDateISO}
                  endDate={endDateISO}
                />
              </div>

              {/* Row 3: Category breakdown + Sale type analysis */}
              <div className="grid gap-6 lg:grid-cols-2">
                <CategoryPerformance
                  shopId={profile.shop_id as string}
                  startDate={startDateISO}
                  endDate={endDateISO}
                />
                <SaleTypeAnalysis
                  shopId={profile.shop_id as string}
                  startDate={startDateISO}
                  endDate={endDateISO}
                  dateFilter={dateFilter}
                />
              </div>

              {/* ── Business Intelligence ─────────────────────── */}
              <div id="bi-intelligence" className="pt-4">
                <div className="flex items-center gap-2 mb-4">
                  <div className="p-1.5 rounded bg-gradient-to-br from-fuchsia-500 to-purple-600 text-white">
                    <BrainCircuit className="h-4 w-4" />
                  </div>
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                    Business Intelligence AI
                  </h2>
                  <div className="flex-1 h-px bg-border" />
                </div>
              </div>

              {/* Automated Insights */}
              <section id="bi-insights" className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Automated Insights
                </h3>
                <InsightsPanel shopId={profile.shop_id as string} />
              </section>

              {/* Revenue Heatmap */}
              <section id="bi-heatmap" className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  When Do You Sell?
                </h3>
                <RevenueHeatmap
                  shopId={profile.shop_id as string}
                  startDate={startDateISO}
                  endDate={endDateISO}
                />
              </section>

              {/* Long-Term Trends */}
              <section id="bi-cohorts" className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Long-Term Trends
                </h3>
                <div className="grid gap-6 lg:grid-cols-2">
                  <div className="min-w-0"><MarginByCategoryChart shopId={profile.shop_id as string} monthsBack={6} /></div>
                  <div className="min-w-0"><CohortRetentionGrid shopId={profile.shop_id as string} /></div>
                </div>
              </section>
            </>
          )}
        </TabsContent>

        {/* Vendors Tab */}
        <TabsContent value="vendors" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Users className={`h-4 w-4 ${s.linkColor}`} />
                Vendor Performance
              </CardTitle>
              <CardDescription className="text-sm">
                Track vendor-wise sales, revenue, and profit margins
              </CardDescription>
            </CardHeader>
          </Card>

          {profile?.shop_id && (
            <VendorPerformance 
              shopId={profile.shop_id as string} 
              startDate={startDateISO} 
              endDate={null} 
            />
          )}
        </TabsContent>
      </Tabs>

      {/* Bill Preview Dialog */}
      <BillPreviewDialog
        open={!!viewingSale}
        onOpenChange={(open) => !open && setViewingSale(null)}
        sale={viewingSale}
      />

      {/* Export size warning dialog */}
      <ConfirmDialog
        open={showExportWarning}
        onOpenChange={setShowExportWarning}
        title="Large Export Warning"
        description={`You are about to export ${totalCount.toLocaleString()} records. This may take a while and produce a large file. Continue?`}
        confirmText="Export Anyway"
        onConfirm={() => {
          setShowExportWarning(false);
          exportSales();
        }}
      />
    </div>
  );
}