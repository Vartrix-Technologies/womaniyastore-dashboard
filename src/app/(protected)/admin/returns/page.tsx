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
import { CountUp } from '@/components/shared/CountUp';
import { SortableHeader } from '@/components/shared/SortableHeader';
import { PaginationControls } from '@/components/shared/PaginationControls';
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
  Download,
  Plus,
  Eye,
  Loader2,
  Calendar,
  Tag,
  User,
  MessageCircle,
  Send,
} from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { exportToCSV, type DateFilterType } from '@/lib/utils';
import { appConfig } from '@/lib/config/app.config';
import { BillPreviewDialog } from '@/components/shared/BillPreviewDialog';
import type { Sale } from '@/types';

const s = appConfig.styles;

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

  // Bill Preview Dialog (for viewing original sale)
  const [billPreviewSale, setBillPreviewSale] = useState<Partial<Sale> | null>(null);

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

  // Load stats separately — only depends on shop + date range, not pagination
  useEffect(() => {
    if (profile?.shop_id) {
      loadStats();
    }
  }, [profile?.shop_id, dateFilter, customRange]);

  // Load returns data
  useEffect(() => {
    if (profile?.shop_id) {
      loadReturns();
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

  // WhatsApp return receipt handler
  const handleWhatsAppReceipt = (returnRecord: ReturnWithDetails) => {
    if (!returnRecord) return;

    const billNumber = returnRecord.original_sale?.bill_number?.toString() || '-';
    const items = Array.isArray(returnRecord.returned_items)
      ? (returnRecord.returned_items as unknown as ReturnedItem[])
      : [];
    const itemsList = items.map((item, idx) => {
      const itemName = `${item.category || 'Item'} ${item.size ? `- ${item.size}` : ''}`;
      return `${idx + 1}. ${itemName} — ${formatCurrency(item.final_price)}`;
    }).join('\n');

    const message =
      `🔄 *${appConfig.billing.receiptHeader}* — Return Confirmation\n` +
      `━━━━━━━━━━━━━━━\n` +
      `📋 *Original Bill:* #${billNumber}\n` +
      `📅 *Return Date:* ${formatDate(returnRecord.created_at)}\n` +
      `⏰ *Time:* ${formatTime(returnRecord.created_at)}\n` +
      `━━━━━━━━━━━━━━━\n\n` +
      `*Items Returned:*\n${itemsList}\n\n` +
      `━━━━━━━━━━━━━━━\n` +
      `💰 *Refund Amount:* ${formatCurrency(returnRecord.refund_amount || 0)}\n` +
      (returnRecord.return_reason ? `📝 *Reason:* ${returnRecord.return_reason}\n` : '') +
      `\n━━━━━━━━━━━━━━━\n` +
      `Thank you for visiting! 🙏\n` +
      `_We value your patronage._`;

    const encodedMessage = encodeURIComponent(message);
    const customerPhone = returnRecord.original_sale?.customer_phone?.replace(/[^0-9]/g, '');

    if (navigator.share) {
      navigator.share({
        title: `Return Confirmation — Bill #${billNumber}`,
        text: message,
      }).catch((err) => {
        if (err.name !== 'AbortError') {
          const url = customerPhone
            ? `https://wa.me/${customerPhone.startsWith('91') ? customerPhone : '91' + customerPhone}?text=${encodedMessage}`
            : `https://api.whatsapp.com/send?text=${encodedMessage}`;
          window.open(url, '_blank');
        }
      });
      return;
    }

    const whatsappUrl = customerPhone
      ? `https://wa.me/${customerPhone.startsWith('91') ? customerPhone : '91' + customerPhone}?text=${encodedMessage}`
      : `https://api.whatsapp.com/send?text=${encodedMessage}`;
    window.open(whatsappUrl, '_blank');
  };

  return (
    <div className="space-y-4 md:space-y-6 animate-content-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/admin" className="relative group shrink-0">
            <div className={`p-2.5 rounded-lg ${s.headerIconGradient} text-white shadow-md group-hover:shadow-lg transition-shadow`}>
              <RotateCcw className="h-6 w-6" />
            </div>
            <div className="absolute -left-1.5 -top-1.5 bg-background border rounded-full p-1 shadow-sm group-hover:scale-110 transition-transform">
              <ArrowLeft className="h-3 w-3 text-muted-foreground" />
            </div>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Returns</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Process and track product returns
            </p>
          </div>
        </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              className={`${s.linkColor} ${s.linkHover} ${s.btnAnimation}`}
            >
              <Download className="mr-1.5 h-3.5 w-3.5" />
              Export
            </Button>
            <Button
              onClick={() => {
                resetProcessReturnDialog();
                setProcessReturnOpen(true);
              }}
              className={`${s.primaryGradient} ${s.primaryGradientHover} ${s.btnAnimation}`}
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
            value: <CountUp end={stats.totalReturns} />, 
            icon: RotateCcw 
          },
          { 
            label: 'Total Refunded', 
            value: <CountUp end={stats.totalRefundAmount} prefix="₹" />, 
            icon: DollarSign,
            valueColor: 'text-orange-600'
          },
          { 
            label: 'Items Returned', 
            value: <CountUp end={stats.totalItemsReturned} />, 
            icon: Package 
          },
          { 
            label: 'Avg. Refund', 
            value: <CountUp end={stats.averageRefund} prefix="₹" />, 
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
                    {returns.map((returnRecord, idx) => {
                      const billNumber = returnRecord.original_sale?.bill_number?.toString() || '-';
                      const itemCount = Array.isArray(returnRecord.returned_items)
                        ? (returnRecord.returned_items as unknown as ReturnedItem[]).length
                        : 0;

                      return (
                        <tr key={returnRecord.id} className="border-b last:border-0 animate-stagger-fade-in" style={{ '--row-index': idx } as React.CSSProperties}>
                          <td className="py-3">
                            <button
                              onClick={() => setViewingReturn(returnRecord)}
                              className="cursor-pointer hover:opacity-80 transition-opacity"
                            >
                              <Badge variant="outline" className={`font-mono ${s.accent.hoverBg} ${s.accent.hoverBorder}`}>
                                {billNumber}
                              </Badge>
                            </button>
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
            </>
          )}
        </CardContent>
      </Card>

      {/* Process Return Dialog */}
      <Dialog open={processReturnOpen} onOpenChange={setProcessReturnOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-2xl max-h-[90vh] overflow-y-auto">
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
              className={`${s.primaryGradient} ${s.primaryGradientHover}`}
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

      {/* View Return Details Dialog — Premium */}
      <Dialog open={!!viewingReturn} onOpenChange={() => setViewingReturn(null)}>
        <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-lg max-h-[85vh] flex flex-col p-0 overflow-hidden">
          {/* Premium header */}
          <DialogHeader className="px-5 pt-5 pb-3 shrink-0">
            <DialogTitle className="text-lg flex items-center gap-2">
              <div className={`p-1.5 rounded-md ${s.headerIconGradient} text-white shadow-sm`}>
                <RotateCcw className="h-4 w-4" />
              </div>
              Return Details
            </DialogTitle>
            <DialogDescription asChild>
              <div className="flex items-center gap-2 flex-wrap mt-1">
                {viewingReturn?.original_sale?.bill_number && (
                  <Badge variant="secondary" className="font-mono font-semibold text-xs">
                    Bill #{viewingReturn.original_sale.bill_number}
                  </Badge>
                )}
                <Badge variant="outline" className="text-xs capitalize bg-orange-100 text-orange-700 border-orange-400">
                  Refund: {formatCurrency(viewingReturn?.refund_amount || 0)}
                </Badge>
              </div>
            </DialogDescription>
          </DialogHeader>

          <Separator />

          {/* Scrollable body */}
          {viewingReturn && (
            <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-4">
              {/* Order Information */}
              <section className="space-y-2.5">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                  <Receipt className="h-3.5 w-3.5" /> Order Information
                </h3>
                <div className="rounded-lg border bg-muted/30 p-3 space-y-2 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Original Bill</span>
                    <button
                      onClick={() => {
                        if (viewingReturn.original_sale?.id) {
                          setViewingReturn(null);
                          setBillPreviewSale({
                            id: viewingReturn.original_sale.id,
                            shop_id: viewingReturn.shop_id,
                          } as Partial<Sale>);
                        }
                      }}
                      className={`font-semibold ${s.linkColor} hover:underline cursor-pointer transition-colors`}
                    >
                      #{viewingReturn.original_sale?.bill_number}
                    </button>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Customer</span>
                    <span className="font-medium">
                      {viewingReturn.original_sale?.customer_name || 'Walk-in'}
                    </span>
                  </div>
                  {viewingReturn.original_sale?.customer_phone && (
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Phone</span>
                      <span className="font-mono text-xs">{viewingReturn.original_sale.customer_phone}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Original Sale Amount</span>
                    <span className="font-medium">{formatCurrency(viewingReturn.original_sale?.total_amount || 0)}</span>
                  </div>
                </div>
              </section>

              {/* Return Details */}
              <section className="space-y-2.5">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" /> Return Details
                </h3>
                <div className="rounded-lg border p-3 space-y-2 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Return Date</span>
                    <span className="text-xs font-medium">{formatDate(viewingReturn.created_at)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Return Time</span>
                    <span className="text-xs font-medium">{formatTime(viewingReturn.created_at)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Processed By</span>
                    <span className="font-medium">{viewingReturn.processed_by_profile?.full_name || '-'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Refund Amount</span>
                    <span className={`font-bold text-base ${s.statsActive.orange.text}`}>
                      {formatCurrency(viewingReturn.refund_amount || 0)}
                    </span>
                  </div>
                </div>
              </section>

              {/* Reason */}
              {viewingReturn.return_reason && (
                <section className="space-y-2.5">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                    <MessageCircle className="h-3.5 w-3.5" /> Reason
                  </h3>
                  <div className="rounded-lg border bg-muted/30 p-3">
                    <p className="text-sm italic">&quot;{viewingReturn.return_reason}&quot;</p>
                  </div>
                </section>
              )}

              {/* Returned Items */}
              <section className="space-y-2.5">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                  <Package className="h-3.5 w-3.5" /> Returned Items
                  <Badge variant="secondary" className="text-[10px] ml-1">
                    {Array.isArray(viewingReturn.returned_items)
                      ? (viewingReturn.returned_items as unknown as ReturnedItem[]).length
                      : 0}
                  </Badge>
                </h3>
                <div className="rounded-lg border divide-y">
                  {Array.isArray(viewingReturn.returned_items) &&
                    (viewingReturn.returned_items as unknown as ReturnedItem[]).map((item, index) => (
                      <div key={index} className="p-3 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">
                            {item.category} {item.size && `- ${item.size}`}
                          </p>
                          <p className="text-xs text-muted-foreground font-mono">{item.qr_code}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-medium text-sm">{formatCurrency(item.final_price)}</p>
                          {item.original_price !== item.final_price && (
                            <p className="text-xs text-muted-foreground line-through">
                              {formatCurrency(item.original_price)}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              </section>
            </div>
          )}

          {/* Footer with actions */}
          <div className="shrink-0 border-t px-5 py-3 flex items-center justify-between gap-2">
            <Button variant="outline" size="sm" onClick={() => setViewingReturn(null)}>
              Close
            </Button>
            {viewingReturn && (
              <Button
                size="sm"
                onClick={() => handleWhatsAppReceipt(viewingReturn)}
                className="bg-[#25D366] hover:bg-[#1DA851] text-white gap-1.5"
              >
                <Send className="h-3.5 w-3.5" />
                Send Receipt
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Bill Preview Dialog — shows original sale bill */}
      <BillPreviewDialog
        open={!!billPreviewSale}
        onOpenChange={(open) => !open && setBillPreviewSale(null)}
        sale={billPreviewSale as any}
      />
    </div>
  );
}
