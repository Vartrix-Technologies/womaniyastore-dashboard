'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { fetchSales } from '@/lib/api/sales';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DateFilterTabs } from '@/components/shared/DateFilterTabs';
import Link from 'next/link';
import { Search, Eye, Download, ArrowLeft, Receipt, ChevronFirst, ChevronLast, ChevronLeft, ChevronRight, BarChart3, Users } from 'lucide-react';
import { formatCurrency, formatDate, formatTime } from '@/lib/formatters';
import { exportToCSV, type DateFilterType } from '@/lib/utils';
import { useDateFilter, useServerPagination, useSortableTable, useDebouncedSearch } from '@/hooks';
import { StatsCardGrid } from '@/components/shared/StatsCardGrid';
import { SortableHeader } from '@/components/shared/SortableHeader';
import { BillPreviewDialog } from '@/components/shared/BillPreviewDialog';
import { VendorPerformance, CategoryPerformance, SaleTypeAnalysis } from '@/components/admin/analytics';
import type { Sale } from '@/types';

type SalesSortColumn = 'bill_number' | 'total_amount' | 'created_at';

export default function SalesPage() {
  const { profile } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Initialize state from URL params
  const initialTab = searchParams.get('tab') || 'transactions';
  const initialFilter = (searchParams.get('filter') as DateFilterType) || 'week';
  
  const [sales, setSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [activeTab, setActiveTab] = useState(initialTab);
  const [stats, setStats] = useState({ 
    totalSales: 0, 
    totalRevenue: 0, 
    totalDiscount: 0, 
    avgSale: 0,
  });
  const [saleTypeFilter, setSaleTypeFilter] = useState<string>('all');
  const [viewingSale, setViewingSale] = useState<Sale | null>(null);

  // Use custom hooks - initialize date filter from URL
  const { dateFilter, setDateFilter, startDateISO } = useDateFilter({ initialFilter });
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

  // Handle date filter change
  const handleDateFilterChange = (filter: DateFilterType) => {
    setDateFilter(filter);
  };

  useEffect(() => {
    if (profile?.shop_id) {
      loadSales();
    } else if (profile !== undefined) {
      // Profile loaded but no shop_id
      setLoading(false);
    }
  }, [profile?.shop_id, dateFilter, currentPage, itemsPerPage, debouncedSearchTerm, sortBy, sortOrder, saleTypeFilter]);

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

      // Apply search filter (customer name, phone, or bill number)
      if (debouncedSearchTerm) {
        const searchLower = debouncedSearchTerm.toLowerCase();
        // bill_number is BIGINT, so we cast to text for partial matching
        query = query.or(`customer_name.ilike.%${searchLower}%,customer_phone.ilike.%${searchLower}%,bill_number::text.ilike.%${searchLower}%`);
      }

      // Apply sorting and pagination (from/to come from useServerPagination hook)
      const { data, error, count } = await query
        .order(sortBy, { ascending: sortOrder === 'asc' })
        .range(from, to);

      if (error) throw error;
      
      // Filter by sale type if not 'all'
      let filteredData = data || [];
      if (saleTypeFilter !== 'all' && data) {
        filteredData = data.filter((sale: any) => {
          const items = sale.sale_items || [];
          if (saleTypeFilter === 'regular') {
            // Regular Only: ALL items must NOT be on sale
            return items.every((item: any) => !item.sold_on_sale);
          } else if (saleTypeFilter === 'mixed') {
            // Mixed: Has both sale and regular items
            const hasSaleItems = items.some((item: any) => item.sold_on_sale);
            const hasRegularItems = items.some((item: any) => !item.sold_on_sale);
            return hasSaleItems && hasRegularItems;
          } else {
            // Specific sale type: Has at least one item of that sale type
            return items.some((item: any) => item.sold_on_sale && item.sale_type === saleTypeFilter);
          }
        });
      }
      
      setSales(filteredData);
      setTotalCount(filteredData.length);

      // Fetch stats from FULL filtered dataset (not paginated)
      let statsQuery = supabase
        .from('sales')
        .select('*, sale_items(*)')
        .eq('shop_id', shopId);

      if (startDateISO) {
        statsQuery = statsQuery.gte('created_at', startDateISO);
      }
      if (debouncedSearchTerm) {
        const searchLower = debouncedSearchTerm.toLowerCase();
        statsQuery = statsQuery.or(`customer_name.ilike.%${searchLower}%,customer_phone.ilike.%${searchLower}%`);
      }

      const { data: statsData } = await statsQuery;
      
      if (statsData && statsData.length > 0) {
        const totalRevenue = statsData.reduce((sum: number, s: any) => sum + (s.total_amount || 0), 0);
        const totalDiscount = statsData.reduce((sum: number, s: any) => sum + (s.total_discount || 0), 0);
        
        setStats({
          totalSales: statsData.length,
          totalRevenue,
          totalDiscount,
          avgSale: totalRevenue / statsData.length,
        });
      } else {
        setStats({ 
          totalSales: 0, 
          totalRevenue: 0, 
          totalDiscount: 0, 
          avgSale: 0,
        });
      }
    } catch (error) {
      console.error('Error fetching sales:', error);
    } finally {
      setLoading(false);
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
        alert('No data to export');
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
      alert(`Exported ${data.length} sales`);
    } catch (error: any) {
      console.error('Export error:', error);
      alert('Failed to export sales');
    }
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
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Receipt className="h-6 w-6 text-teal-600" />
              Sales Hub
            </h1>
            <p className="text-sm text-muted-foreground mt-1">Transactions, analytics, and vendor performance</p>
          </div>
        </div>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="transactions" className="flex items-center gap-2">
            <Receipt className="h-4 w-4" />
            <span className="hidden sm:inline">Transactions</span>
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            <span className="hidden sm:inline">Analytics</span>
          </TabsTrigger>
          <TabsTrigger value="vendors" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Vendors</span>
          </TabsTrigger>
        </TabsList>

        {/* Transactions Tab */}
        <TabsContent value="transactions" className="space-y-4">
          {/* Export Button for Transactions */}
          <div className="flex justify-end">
            <Button 
              onClick={exportSales}
              variant="outline"
              className="transition-all hover:scale-105 active:scale-95"
            >
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
          </div>

          {/* Stats Cards - 2x2 on mobile */}
          <StatsCardGrid
            stats={[
              { label: 'Total Bills', value: stats.totalSales },
              { label: 'Total Revenue', value: formatCurrency(stats.totalRevenue), valueColor: 'text-green-600' },
              { label: 'Total Discount', value: formatCurrency(stats.totalDiscount), valueColor: 'text-orange-600' },
              { label: 'Average Bill', value: formatCurrency(stats.avgSale) },
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
                onClick={exportSales} 
                variant="outline"
                size="sm"
                className="hover:scale-105 active:scale-95 transition-all"
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
                <div className="w-full sm:w-[200px]">
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
              
              {/* Date Tabs */}
              <DateFilterTabs value={dateFilter} onChange={handleDateFilterChange} />
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
              <div className="text-center py-12">
                <Receipt className="h-12 w-12 md:h-16 md:w-16 mx-auto text-muted-foreground mb-3" />
                <p className="text-sm md:text-base text-muted-foreground mb-2">No sales found</p>
                <p className="text-xs text-muted-foreground">
                  Start making sales at the POS
                </p>
              </div>
            ) : (
              <table className="w-full min-w-[800px]">
                <thead>
                  <tr className="border-b text-xs md:text-sm">
                    <SortableHeader column="bill_number" sortBy={sortBy} sortOrder={sortOrder} onSort={toggleSort} minWidth="100px">
                      Bill #
                    </SortableHeader>
                    <th className="text-left py-3 px-3 font-medium min-w-[120px]">
                      <span className="whitespace-nowrap">Customer</span>
                    </th>
                    <th className="text-left py-3 px-3 font-medium min-w-[80px]">
                      <span className="whitespace-nowrap">Items</span>
                    </th>
                    <th className="text-left py-3 px-3 font-medium min-w-[100px]">
                      <span className="whitespace-nowrap">Payment</span>
                    </th>
                    <SortableHeader column="total_amount" sortBy={sortBy} sortOrder={sortOrder} onSort={toggleSort} minWidth="110px">
                      Amount
                    </SortableHeader>
                    <SortableHeader column="created_at" sortBy={sortBy} sortOrder={sortOrder} onSort={toggleSort} minWidth="130px">
                      Date & Time
                    </SortableHeader>
                    <th className="text-center py-3 px-3 font-medium min-w-[60px]">
                      <span className="whitespace-nowrap">Action</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sales.map((sale) => {
                    // Bill number is now timestamp-based (YYYYMMDDHHMMSS), no padding needed
                    const billNumber = `${sale.bill_prefix || ''}${sale.bill_number}`;
                    
                    // Check for sale types in items
                    const saleItems = sale.sale_items || [];
                    const hasFestival = saleItems.some((item: any) => item.sold_on_sale && item.sale_type === 'festival');
                    const hasClearance = saleItems.some((item: any) => item.sold_on_sale && item.sale_type === 'clearance');
                    const hasPromotion = saleItems.some((item: any) => item.sold_on_sale && item.sale_type === 'promotion');
                    
                    return (
                      <tr key={sale.id} className="border-b hover:bg-muted/50 transition-colors">
                        <td className="py-3 px-3 font-mono text-xs font-semibold whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            {billNumber}
                            {(hasFestival || hasClearance || hasPromotion) && (
                              <div className="flex items-center gap-1">
                                {hasFestival && <span className="w-1.5 h-1.5 rounded-full bg-green-500" title="Festival sale"></span>}
                                {hasClearance && <span className="w-1.5 h-1.5 rounded-full bg-red-500" title="Clearance"></span>}
                                {hasPromotion && <span className="w-1.5 h-1.5 rounded-full bg-blue-500" title="Promotion"></span>}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-xs">
                          <div className="whitespace-nowrap">{sale.customer_name || 'Walk-in'}</div>
                          {sale.customer_phone && (
                            <div className="text-xs text-muted-foreground whitespace-nowrap">{sale.customer_phone}</div>
                          )}
                        </td>
                        <td className="py-3 px-3 text-xs whitespace-nowrap">
                          {sale.sale_items?.length || 0}
                        </td>
                        <td className="py-3 px-3">
                          <Badge
                            variant={sale.payment_method === 'cash' ? 'default' : 'secondary'}
                            className="text-xs whitespace-nowrap"
                          >
                            {sale.payment_method}
                          </Badge>
                          {sale.total_discount > 0 && (
                            <div className="text-xs text-orange-600 whitespace-nowrap mt-1">
                              -{formatCurrency(sale.total_discount)}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-3 text-xs font-semibold text-green-600 whitespace-nowrap">
                          {formatCurrency(sale.total_amount)}
                        </td>
                        <td className="py-3 px-3 text-xs text-muted-foreground">
                          <div className="whitespace-nowrap">{formatDate(sale.created_at)}</div>
                          <div className="whitespace-nowrap">{formatTime(sale.created_at)}</div>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="hover:bg-blue-50 hover:text-blue-600"
                            title="View bill details"
                            onClick={() => setViewingSale(sale)}
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
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
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
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
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
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-teal-600" />
                Sales Analytics
              </CardTitle>
              <CardDescription>
                Analyze your sales performance by category, sale type, and trends
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DateFilterTabs value={dateFilter} onChange={handleDateFilterChange} />
            </CardContent>
          </Card>

          {profile?.shop_id && (
            <div className="grid gap-6 md:grid-cols-2">
              <CategoryPerformance 
                shopId={profile.shop_id as string} 
                startDate={startDateISO} 
                endDate={null} 
              />
              <SaleTypeAnalysis 
                shopId={profile.shop_id as string} 
                startDate={startDateISO} 
                endDate={null}
                dateFilter={dateFilter}
              />
            </div>
          )}
        </TabsContent>

        {/* Vendors Tab */}
        <TabsContent value="vendors" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="h-5 w-5 text-teal-600" />
                Vendor Performance
              </CardTitle>
              <CardDescription>
                Track vendor-wise sales, revenue, and profit margins
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DateFilterTabs value={dateFilter} onChange={handleDateFilterChange} />
            </CardContent>
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
    </div>
  );
}
