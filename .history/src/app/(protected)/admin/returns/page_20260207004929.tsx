'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { DateRangeFilter } from '@/components/shared/DateRangeFilter';
import { StatsCardGrid } from '@/components/shared/StatsCardGrid';
import { SortableHeader } from '@/components/shared/SortableHeader';
import { formatCurrency, formatDate, formatTime } from '@/lib/formatters';
import { useDateFilter, useServerPagination, useSortableTable, useDebouncedSearch } from '@/hooks';
import {
  fetchReturns,
  getReturnStats,
  findSaleByBillNumber,
  getSaleForReturn,
  getExistingReturnsForSale,
  createReturn,
  type ReturnWithDetails,
  type ReturnedItem,
} from '@/lib/api/returns';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  ArrowLeft,
  RotateCcw,
  Search,
  Package,
  DollarSign,
  TrendingDown,
  Receipt,
  ChevronFirst,
  ChevronLast,
  ChevronLeft,
  ChevronRight,
  Download,
  Plus,
  Eye,
  Loader2,
} from 'lucide-react';
import { exportToCSV, type DateFilterType } from '@/lib/utils';

type ReturnSortColumn = 'created_at' | 'refund_amount';

interface SaleForReturn {
  id: string;
  bill_number: number;
  customer_name?: string;
  customer_phone?: string;
  total_amount: number;
  created_at: string;
  shop_id: string;
  sale_items: {
    id: string;
    inventory_item_id: string;
    original_price: number;
    final_price: number;
    discount_reason?: string;
    inventory_items: {
      id: string;
      status: string;
      qr_codes: { code: string };
      lots: {
        categories: { name: string } | null;
        sizes: { size_name: string } | null;
        free_text_size?: string;
      };
    };
  }[];
}

interface SelectedItem {
  sale_item_id: string;
  inventory_item_id: string;
  qr_code: string;
  original_price: number;
  final_price: number;
  category: string;
  size: string;
}

export default function ReturnsPage() {
  const { profile } = useAuth();
  const { dateFilter, setDateFilter, customRange, setCustomRange, startDateISO, endDateISO } = useDateFilter({ initialFilter: 'month' });
  
  // Data state
  const [returns, setReturns] = useState<ReturnWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [stats, setStats] = useState({
    totalReturns: 0,
    totalRefundAmount: 0,
    totalItemsReturned: 0,
    averageRefund: 0,
  });

  // Process Return Dialog state
  const [processReturnOpen, setProcessReturnOpen] = useState(false);
  const [billSearchTerm, setBillSearchTerm] = useState('');
  const [searchingBill, setSearchingBill] = useState(false);
  const [foundSales, setFoundSales] = useState<SaleForReturn[]>([]);
  const [selectedSale, setSelectedSale] = useState<SaleForReturn | null>(null);
  const [alreadyReturnedItems, setAlreadyReturnedItems] = useState<string[]>([]);
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);
  const [returnReason, setReturnReason] = useState('');
  const [refundAmount, setRefundAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // View Return Details Dialog
  const [viewingReturn, setViewingReturn] = useState<ReturnWithDetails | null>(null);

  // Hooks
  const { searchTerm, debouncedSearchTerm, setSearchTerm } = useDebouncedSearch({ delay: 500 });
  const { sortBy, sortOrder, toggleSort } = useSortableTable<ReturnSortColumn>({ initialSortBy: 'created_at' });
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
  } = useServerPagination({ totalCount });

  // Load returns data
  useEffect(() => {
    if (profile?.shop_id) {
      loadReturns();
      loadStats();
    }
  }, [profile?.shop_id, dateFilter, customRange, currentPage, itemsPerPage, sortBy, sortOrder]);

  const loadReturns = async () => {
    if (!profile?.shop_id) return;
    
    try {
      setLoading(true);
      console.log('Loading returns with filters:', {
        shop_id: profile.shop_id,
        from_date: startDateISO,
        to_date: endDateISO,
        limit: itemsPerPage,
        offset: from,
      });
      const { data, count } = await fetchReturns({
        shop_id: profile.shop_id,
        from_date: startDateISO || undefined,
        to_date: endDateISO || undefined,
        limit: itemsPerPage,
        offset: from,
      });
      console.log('Loaded returns:', data.length, 'total:', count);
      setReturns(data);
      setTotalCount(count);
    } catch (error) {
      console.error('Error loading returns:', error);
      toast.error('Failed to load returns');
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    if (!profile?.shop_id) return;
    
    try {
      const statsData = await getReturnStats(profile.shop_id, startDateISO || undefined);
      setStats(statsData);
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  // Search for sale by bill number
  const handleSearchBill = async () => {
    if (!billSearchTerm.trim() || !profile?.shop_id) return;
    
    try {
      setSearchingBill(true);
      const sales = await findSaleByBillNumber(billSearchTerm.trim(), profile.shop_id);
      setFoundSales(sales as SaleForReturn[]);
      if (sales.length === 0) {
        toast.info('No sale found with that bill number');
      }
    } catch (error) {
      console.error('Error searching bill:', error);
      toast.error('Failed to search for bill');
    } finally {
      setSearchingBill(false);
    }
  };

  // Select a sale for return
  const handleSelectSale = async (sale: SaleForReturn) => {
    setSelectedSale(sale);
    setSelectedItems([]);
    
    // Check which items are already returned
    try {
      const returnedItemIds = await getExistingReturnsForSale(sale.id);
      setAlreadyReturnedItems(returnedItemIds);
    } catch (error) {
      console.error('Error checking existing returns:', error);
      setAlreadyReturnedItems([]);
    }
  };

  // Toggle item selection
  const handleToggleItem = (item: SaleForReturn['sale_items'][0]) => {
    const itemData: SelectedItem = {
      sale_item_id: item.id,
      inventory_item_id: item.inventory_item_id,
      qr_code: item.inventory_items?.qr_codes?.code || '',
      original_price: item.original_price,
      final_price: item.final_price,
      category: item.inventory_items?.lots?.categories?.name || 'Unknown',
      size: item.inventory_items?.lots?.sizes?.size_name || item.inventory_items?.lots?.free_text_size || '',
    };

    setSelectedItems((prev) => {
      const exists = prev.find((i) => i.inventory_item_id === item.inventory_item_id);
      if (exists) {
        return prev.filter((i) => i.inventory_item_id !== item.inventory_item_id);
      }
      return [...prev, itemData];
    });
  };

  // Calculate suggested refund
  const calculateSuggestedRefund = () => {
    return selectedItems.reduce((sum, item) => sum + item.final_price, 0);
  };

  // Process the return
  const handleProcessReturn = async () => {
    if (!selectedSale || selectedItems.length === 0 || !profile?.shop_id || !profile?.id) {
      toast.error('Please select items to return');
      return;
    }

    if (!returnReason.trim()) {
      toast.error('Please provide a return reason');
      return;
    }

    const refund = parseFloat(refundAmount);
    if (isNaN(refund) || refund < 0) {
      toast.error('Please enter a valid refund amount');
      return;
    }

    // Check refund doesn't exceed the value of selected items
    const maxRefund = calculateSuggestedRefund();
    if (refund > maxRefund) {
      toast.error(`Refund amount cannot exceed ${formatCurrency(maxRefund)} (selected items total)`);
      return;
    }

    try {
      setSubmitting(true);
      
      await createReturn({
        original_sale_id: selectedSale.id,
        returned_items: selectedItems.map((item) => ({
          sale_item_id: item.sale_item_id,
          inventory_item_id: item.inventory_item_id,
          qr_code: item.qr_code,
          original_price: item.original_price,
          final_price: item.final_price,
          category: item.category,
          size: item.size,
        })),
        return_reason: returnReason.trim(),
        refund_amount: refund,
        shop_id: profile.shop_id,
        processed_by: profile.id,
      });

      toast.success('Return processed successfully');
      resetProcessReturnDialog();
      setProcessReturnOpen(false);
      loadReturns();
      loadStats();
    } catch (error) {
      console.error('Error processing return:', error);
      toast.error('Failed to process return');
    } finally {
      setSubmitting(false);
    }
  };

  const resetProcessReturnDialog = () => {
    setBillSearchTerm('');
    setFoundSales([]);
    setSelectedSale(null);
    setAlreadyReturnedItems([]);
    setSelectedItems([]);
    setReturnReason('');
    setRefundAmount('');
  };

  // Export returns to CSV
  const handleExport = () => {
    if (returns.length === 0) {
      toast.info('No returns to export');
      return;
    }

    const data = returns.map((r) => ({
      'Return ID': r.id,
      'Bill Number': r.original_sale?.bill_number?.toString() || '',
      'Customer': r.original_sale?.customer_name || 'Walk-in',
      'Items Returned': Array.isArray(r.returned_items) ? (r.returned_items as unknown as ReturnedItem[]).length : 0,
      'Refund Amount': r.refund_amount || 0,
      'Return Reason': r.return_reason || '',
      'Processed By': r.processed_by_profile?.full_name || '',
      'Date': formatDate(r.created_at),
    }));

    exportToCSV(data, { filename: `returns-${dateFilter}` });
    toast.success('Export complete');
  };

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/admin">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Returns</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Process and track product returns
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button
            onClick={() => {
              resetProcessReturnDialog();
              setProcessReturnOpen(true);
            }}
            className="bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            Process Return
          </Button>
        </div>
      </div>

      {/* Date Filter */}
      <DateRangeFilter
        value={dateFilter}
        onChange={setDateFilter}
        customRange={customRange}
        onCustomRangeChange={setCustomRange}
      />

      {/* Stats */}
      <StatsCardGrid
        loading={loading}
        stats={[
          { 
            label: 'Total Returns', 
            value: stats.totalReturns, 
            icon: RotateCcw 
          },
          { 
            label: 'Total Refunded', 
            value: formatCurrency(stats.totalRefundAmount), 
            icon: DollarSign,
            valueColor: 'text-orange-600'
          },
          { 
            label: 'Items Returned', 
            value: stats.totalItemsReturned, 
            icon: Package 
          },
          { 
            label: 'Avg. Refund', 
            value: formatCurrency(stats.averageRefund), 
            icon: TrendingDown 
          },
        ]}
      />

      {/* Returns Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Return History</CardTitle>
          <CardDescription>
            All processed returns for the selected period
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : returns.length === 0 ? (
            <div className="text-center py-12">
              <RotateCcw className="h-12 w-12 mx-auto text-muted-foreground opacity-50 mb-4" />
              <h3 className="font-medium text-muted-foreground">No returns found</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Process a return to see it here
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[600px]">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="pb-3 font-medium text-muted-foreground text-sm">Bill #</th>
                      <th className="pb-3 font-medium text-muted-foreground text-sm">Customer</th>
                      <th className="pb-3 font-medium text-muted-foreground text-sm">Items</th>
                      <SortableHeader<ReturnSortColumn>
                        column="refund_amount"
                        sortBy={sortBy}
                        sortOrder={sortOrder}
                        onSort={toggleSort}
                      >
                        Refund
                      </SortableHeader>
                      <th className="pb-3 font-medium text-muted-foreground text-sm">Reason</th>
                      <SortableHeader<ReturnSortColumn>
                        column="created_at"
                        sortBy={sortBy}
                        sortOrder={sortOrder}
                        onSort={toggleSort}
                      >
                        Date
                      </SortableHeader>
                      <th className="pb-3 font-medium text-muted-foreground text-sm">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {returns.map((returnRecord) => {
                      const billNumber = returnRecord.original_sale?.bill_number?.toString() || '-';
                      const itemCount = Array.isArray(returnRecord.returned_items)
                        ? (returnRecord.returned_items as unknown as ReturnedItem[]).length
                        : 0;

                      return (
                        <tr key={returnRecord.id} className="border-b last:border-0">
                          <td className="py-3">
                            <Badge variant="outline" className="font-mono">
                              {billNumber}
                            </Badge>
                          </td>
                          <td className="py-3 text-sm">
                            {returnRecord.original_sale?.customer_name || (
                              <span className="text-muted-foreground">Walk-in</span>
                            )}
                          </td>
                          <td className="py-3">
                            <Badge variant="secondary">{itemCount} item{itemCount !== 1 ? 's' : ''}</Badge>
                          </td>
                          <td className="py-3 font-medium text-orange-600">
                            {formatCurrency(returnRecord.refund_amount || 0)}
                          </td>
                          <td className="py-3 text-sm text-muted-foreground max-w-[200px] truncate">
                            {returnRecord.return_reason || '-'}
                          </td>
                          <td className="py-3 text-sm text-muted-foreground">
                            {formatDate(returnRecord.created_at)}
                          </td>
                          <td className="py-3">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setViewingReturn(returnRecord)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <p className="text-sm text-muted-foreground">
                    Showing {startItem} to {endItem} of {totalCount} returns
                  </p>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setCurrentPage(1)}
                      disabled={currentPage === 1}
                    >
                      <ChevronFirst className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setCurrentPage(currentPage - 1)}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="px-3 text-sm">
                      {currentPage} / {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setCurrentPage(currentPage + 1)}
                      disabled={currentPage === totalPages}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setCurrentPage(totalPages)}
                      disabled={currentPage === totalPages}
                    >
                      <ChevronLast className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Process Return Dialog */}
      <Dialog open={processReturnOpen} onOpenChange={setProcessReturnOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Process Return</DialogTitle>
            <DialogDescription>
              Search for a sale by bill number and select items to return
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Step 1: Search for Bill */}
            {!selectedSale && (
              <div className="space-y-4">
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Input
                      placeholder="Enter bill number..."
                      value={billSearchTerm}
                      onChange={(e) => setBillSearchTerm(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSearchBill()}
                    />
                  </div>
                  <Button onClick={handleSearchBill} disabled={searchingBill}>
                    {searchingBill ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Search className="h-4 w-4" />
                    )}
                  </Button>
                </div>

                {/* Found Sales */}
                {foundSales.length > 0 && (
                  <div className="space-y-2">
                    <Label>Select a sale:</Label>
                    {foundSales.map((sale) => (
                      <Card
                        key={sale.id}
                        className="cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => handleSelectSale(sale)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium">
                                Bill #{sale.bill_number}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {sale.customer_name || 'Walk-in'} • {formatDate(sale.created_at)}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="font-medium">{formatCurrency(sale.total_amount)}</p>
                              <p className="text-sm text-muted-foreground">
                                {sale.sale_items.length} items
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Step 2: Select Items */}
            {selectedSale && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">
                      Bill #{selectedSale.bill_number}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {selectedSale.customer_name || 'Walk-in'} • {formatDate(selectedSale.created_at)}
                    </p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setSelectedSale(null)}>
                    Change
                  </Button>
                </div>

                <div className="space-y-2">
                  <Label>Select items to return:</Label>
                  <div className="border rounded-lg divide-y max-h-[200px] overflow-y-auto">
                    {selectedSale.sale_items.map((item) => {
                      const isReturned = alreadyReturnedItems.includes(item.inventory_item_id);
                      const isSelected = selectedItems.some(
                        (i) => i.inventory_item_id === item.inventory_item_id
                      );
                      const category = item.inventory_items?.lots?.categories?.name || 'Unknown';
                      const size =
                        item.inventory_items?.lots?.sizes?.size_name ||
                        item.inventory_items?.lots?.free_text_size ||
                        '';
                      const qrCode = item.inventory_items?.qr_codes?.code || '';

                      return (
                        <div
                          key={item.id}
                          className={`p-3 flex items-center gap-3 ${
                            isReturned ? 'opacity-50 bg-muted' : 'cursor-pointer hover:bg-muted/50'
                          }`}
                          onClick={() => !isReturned && handleToggleItem(item)}
                        >
                          <Checkbox
                            checked={isSelected}
                            disabled={isReturned}
                            onCheckedChange={() => !isReturned && handleToggleItem(item)}
                          />
                          <div className="flex-1">
                            <p className="text-sm font-medium">
                              {category} {size && `- ${size}`}
                            </p>
                            <p className="text-xs text-muted-foreground font-mono">{qrCode}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-medium">{formatCurrency(item.final_price)}</p>
                            {item.original_price !== item.final_price && (
                              <p className="text-xs text-muted-foreground line-through">
                                {formatCurrency(item.original_price)}
                              </p>
                            )}
                          </div>
                          {isReturned && (
                            <Badge variant="secondary" className="text-xs">
                              Already Returned
                            </Badge>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Return Details */}
                {selectedItems.length > 0 && (
                  <div className="space-y-4 pt-4 border-t">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Selected items:</span>
                      <span className="font-medium">{selectedItems.length} item(s)</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Suggested refund:</span>
                      <span className="font-medium">{formatCurrency(calculateSuggestedRefund())}</span>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="refund-amount">Refund Amount *</Label>
                      <Input
                        id="refund-amount"
                        type="number"
                        placeholder="Enter refund amount"
                        value={refundAmount}
                        onChange={(e) => setRefundAmount(e.target.value)}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        type="button"
                        onClick={() => setRefundAmount(calculateSuggestedRefund().toString())}
                      >
                        Use Suggested Amount
                      </Button>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="return-reason">Return Reason *</Label>
                      <Textarea
                        id="return-reason"
                        placeholder="Enter reason for return..."
                        value={returnReason}
                        onChange={(e) => setReturnReason(e.target.value)}
                        rows={3}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setProcessReturnOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleProcessReturn}
              disabled={submitting || selectedItems.length === 0 || !returnReason.trim()}
              className="bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Process Return
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Return Details Dialog */}
      <Dialog open={!!viewingReturn} onOpenChange={() => setViewingReturn(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Return Details</DialogTitle>
          </DialogHeader>

          {viewingReturn && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground text-xs">Original Bill</Label>
                  <p className="font-medium">
                    #{viewingReturn.original_sale?.bill_number}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Customer</Label>
                  <p className="font-medium">
                    {viewingReturn.original_sale?.customer_name || 'Walk-in'}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Refund Amount</Label>
                  <p className="font-medium text-orange-600">
                    {formatCurrency(viewingReturn.refund_amount || 0)}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Processed By</Label>
                  <p className="font-medium">
                    {viewingReturn.processed_by_profile?.full_name || '-'}
                  </p>
                </div>
                <div className="col-span-2">
                  <Label className="text-muted-foreground text-xs">Return Date</Label>
                  <p className="font-medium">
                    {formatDate(viewingReturn.created_at)} at {formatTime(viewingReturn.created_at)}
                  </p>
                </div>
                <div className="col-span-2">
                  <Label className="text-muted-foreground text-xs">Reason</Label>
                  <p className="font-medium">{viewingReturn.return_reason || '-'}</p>
                </div>
              </div>

              <div>
                <Label className="text-muted-foreground text-xs">Returned Items</Label>
                <div className="mt-2 border rounded-lg divide-y">
                  {Array.isArray(viewingReturn.returned_items) &&
                    (viewingReturn.returned_items as unknown as ReturnedItem[]).map((item, index) => (
                      <div key={index} className="p-3 flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium">
                            {item.category} {item.size && `- ${item.size}`}
                          </p>
                          <p className="text-xs text-muted-foreground font-mono">{item.qr_code}</p>
                        </div>
                        <p className="font-medium">{formatCurrency(item.final_price)}</p>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setViewingReturn(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
