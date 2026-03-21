'use client';

import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { formatCurrency, formatDate } from '@/lib/formatters';
import {
  findSaleByBillNumber,
  getExistingReturnsForSale,
  createReturn,
} from '@/lib/api/returns';
import { toast } from 'sonner';
import { Search, Loader2, RotateCcw } from 'lucide-react';
import { appConfig } from '@/lib/config/app.config';

const s = appConfig.styles;

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
    inventory_item_id: string | null;
    original_price: number;
    final_price: number;
    discount_reason?: string;
    category_name?: string;
    size_name?: string;
    inventory_items: {
      id: string;
      status: string;
      qr_codes: { code: string };
      lots: {
        categories: { name: string } | null;
        sizes: { size_name: string } | null;
        free_text_size?: string;
      };
    } | null;
  }[];
}

interface SelectedItem {
  sale_item_id: string;
  inventory_item_id: string | null;
  qr_code: string;
  original_price: number;
  final_price: number;
  category: string;
  size: string;
}

interface ProcessReturnDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function ProcessReturnDialog({ open, onOpenChange, onSuccess }: ProcessReturnDialogProps) {
  const { profile } = useAuth();

  const [billSearchTerm, setBillSearchTerm] = useState('');
  const [searchingBill, setSearchingBill] = useState(false);
  const [foundSales, setFoundSales] = useState<SaleForReturn[]>([]);
  const [selectedSale, setSelectedSale] = useState<SaleForReturn | null>(null);
  const [alreadyReturnedItems, setAlreadyReturnedItems] = useState<string[]>([]);
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);
  const [returnReason, setReturnReason] = useState('');
  const [refundAmount, setRefundAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const resetDialog = () => {
    setBillSearchTerm('');
    setFoundSales([]);
    setSelectedSale(null);
    setAlreadyReturnedItems([]);
    setSelectedItems([]);
    setReturnReason('');
    setRefundAmount('');
  };

  const handleOpenChange = (value: boolean) => {
    if (!value) resetDialog();
    onOpenChange(value);
  };

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

  const handleSelectSale = async (sale: SaleForReturn) => {
    setSelectedSale(sale);
    setSelectedItems([]);

    try {
      const returnedItemIds = await getExistingReturnsForSale(sale.id);
      setAlreadyReturnedItems(returnedItemIds);
    } catch (error) {
      console.error('Error checking existing returns:', error);
      setAlreadyReturnedItems([]);
    }
  };

  const handleToggleItem = (item: SaleForReturn['sale_items'][0]) => {
    const itemData: SelectedItem = {
      sale_item_id: item.id,
      inventory_item_id: item.inventory_item_id,
      qr_code: item.inventory_items?.qr_codes?.code || '',
      original_price: item.original_price,
      final_price: item.final_price,
      category: item.inventory_items?.lots?.categories?.name || item.category_name || 'Unknown',
      size: item.inventory_items?.lots?.sizes?.size_name || item.inventory_items?.lots?.free_text_size || item.size_name || '',
    };

    setSelectedItems((prev) => {
      const exists = prev.find((i) => i.sale_item_id === item.id);
      if (exists) {
        return prev.filter((i) => i.sale_item_id !== item.id);
      }
      return [...prev, itemData];
    });
  };

  const calculateSuggestedRefund = () => {
    return selectedItems.reduce((sum, item) => sum + item.final_price, 0);
  };

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
      resetDialog();
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error('Error processing return:', error);
      toast.error('Failed to process return');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
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
                            <p className="font-medium">Bill #{sale.bill_number}</p>
                            <p className="text-sm text-muted-foreground">
                              {sale.customer_name || 'Walk-in'} &bull; {formatDate(sale.created_at)}
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
                  <p className="font-medium">Bill #{selectedSale.bill_number}</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedSale.customer_name || 'Walk-in'} &bull; {formatDate(selectedSale.created_at)}
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
                    const isReturned = alreadyReturnedItems.includes(item.id);
                    const isSelected = selectedItems.some(
                      (i) => i.sale_item_id === item.id
                    );
                    const category = item.inventory_items?.lots?.categories?.name || item.category_name || 'Unknown';
                    const size =
                      item.inventory_items?.lots?.sizes?.size_name ||
                      item.inventory_items?.lots?.free_text_size ||
                      item.size_name ||
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
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
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
  );
}
