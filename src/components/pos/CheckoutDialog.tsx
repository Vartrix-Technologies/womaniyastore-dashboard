'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/formatters';
import { completeSale, SaleApiError } from '@/lib/api/sales';
import { addPendingSale } from '@/lib/offline/db';
import { useOfflineStatus } from '@/hooks/useOfflineStatus';
import type { CartItem } from '@/types/pos.types';
import { toast } from 'sonner';
import { Loader2, ShoppingBag, CreditCard, Banknote, Smartphone, Wallet, Package, Tag } from 'lucide-react';
import { saleCompleteChime } from '@/lib/sounds';
import { appConfig } from '@/lib/config/app.config';

const s = appConfig.styles;
const a = s.accent;

import type { CompleteSaleResponse } from '@/lib/api/sales';

interface CheckoutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: CartItem[];
  onComplete: (completedSale?: CompleteSaleResponse['sale']) => void;
}

export function CheckoutDialog({
  open,
  onOpenChange,
  items,
  onComplete,
}: CheckoutDialogProps) {
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [processing, setProcessing] = useState(false);
  const { isOnline } = useOfflineStatus();

  const subtotal = items.reduce((sum, item) => sum + item.originalPrice, 0);
  const total = items.reduce((sum, item) => sum + item.finalPrice, 0);
  const discount = subtotal - total;
  const tax = items.reduce((sum, item) => {
    const taxAmount = (item.finalPrice * item.taxRate) / 100;
    return sum + taxAmount;
  }, 0);
  const grandTotal = total + tax;

  const handleComplete = async () => {
    if (items.length === 0) return;

    // ── Guardrail: reject duplicate QR codes (case-insensitive) ────
    // Skip manual entries for duplicate check (they have generated unique IDs)
    const trackedItems = items.filter(i => !i.isManualEntry);
    const qrCodesUpper = trackedItems.map((i) => i.qrCode.toUpperCase());
    const uniqueQrCodes = new Set(qrCodesUpper);
    if (uniqueQrCodes.size !== qrCodesUpper.length) {
      const duplicates = qrCodesUpper.filter((qr, idx) => qrCodesUpper.indexOf(qr) !== idx);
      toast.error(`Duplicate items detected: ${[...new Set(duplicates)].join(', ')}. Remove duplicates before completing the sale.`);
      return;
    }

    // ── Guardrail: verify total matches sum of item prices ──────────
    const computedTotal = items.reduce((sum, item) => sum + item.finalPrice, 0);
    if (!Number.isFinite(computedTotal) || computedTotal <= 0) {
      toast.error('Invalid item prices detected. Please clear cart and re-add items.');
      return;
    }
    if (Math.abs(computedTotal - total) > 0.01) {
      toast.error('Cart total mismatch detected. Please clear and re-add items.');
      return;
    }

    // Validate margin protection for festival sales
    for (const item of items) {
      if (item.soldOnSale && item.saleType === 'festival' && item.lotMinMargin && item.lotCostPrice) {
        const minPrice = item.lotCostPrice * (1 + item.lotMinMargin / 100);
        if (item.finalPrice < minPrice) {
          toast.error(`Festival item "${item.category}" price (₹${item.finalPrice}) is below minimum margin. Min required: ₹${minPrice.toFixed(2)}`);
          setProcessing(false);
          return;
        }
      }
    }

    setProcessing(true);

    try {
      const saleData = {
        client_sale_id: `sale-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        items: items.map((item) => ({
          qr_code: item.isManualEntry ? '' : item.qrCode,
          original_price: item.originalPrice,
          final_price: item.finalPrice,
          cost_price: item.costPrice,
          discount_reason: item.discountReason,
          // Sale information from cart
          sold_on_sale: item.soldOnSale || false,
          sale_type: item.saleType,
          // Manual entry fields
          is_manual: item.isManualEntry || false,
          category_name: item.isManualEntry ? item.category : undefined,
          size_name: item.isManualEntry ? item.size : undefined,
          tax_rate: item.isManualEntry ? item.taxRate : undefined,
          manual_note: item.isManualEntry ? item.manualNote : undefined,
        })),
        payment_method: paymentMethod,
        customer_name: customerName || undefined,
        customer_phone: customerPhone || undefined,
        occurred_at: new Date().toISOString(),
      };

      if (isOnline) {
        try {
          // Try to complete sale online
          const result = await completeSale(saleData);
          // Bill number is now timestamp-based (YYYYMMDDHHMMSS), no padding needed
          const billNumber = `${result.sale.bill_prefix || ''}${result.sale.bill_number}`;
          saleCompleteChime();
          toast.success(`Sale completed! Bill #${billNumber}`);
          onComplete(result.sale);
        } catch (error) {
          // SaleApiError = server responded with an error → NEVER save offline
          if (error instanceof SaleApiError) {
            toast.error(error.message);
            setProcessing(false);
            return;
          }
          
          // Double-check: only save offline if network is genuinely down
          // If navigator.onLine is true, the server saw the request → do NOT save offline
          if (navigator.onLine) {
            console.error('Sale failed (network up, not saving offline):', error);
            toast.error('Something went wrong. Please try again later.');
            setProcessing(false);
            return;
          }

          // Network is genuinely down → safe to save offline
          console.error('Network down, saving sale offline:', error);
          
          await addPendingSale({
            id: saleData.client_sale_id,
            createdAt: saleData.occurred_at,
            items: saleData.items.map(item => ({
              qrCode: item.qr_code,
              originalPrice: item.original_price,
              finalPrice: item.final_price,
              costPrice: item.cost_price,
              discountReason: item.discount_reason,
              soldOnSale: item.sold_on_sale,
              saleType: item.sale_type,
              isManualEntry: item.is_manual || false,
              categoryName: item.category_name,
              sizeName: item.size_name,
              taxRate: item.tax_rate,
              manualNote: item.manual_note,
            })),
            paymentMethod: saleData.payment_method,
            customerName: saleData.customer_name,
            customerPhone: saleData.customer_phone,
            status: 'pending',
            occurredAt: saleData.occurred_at,
          });

          toast.warning('Sale saved offline. Will sync when connection is restored.');
          onComplete();
        }
      } else {
        // Offline - save to IndexedDB
        await addPendingSale({
          id: saleData.client_sale_id,
          createdAt: saleData.occurred_at,
          items: saleData.items.map(item => ({
            qrCode: item.qr_code,
            originalPrice: item.original_price,
            finalPrice: item.final_price,
            costPrice: item.cost_price,
            discountReason: item.discount_reason,
            soldOnSale: item.sold_on_sale,
            saleType: item.sale_type,
            isManualEntry: item.is_manual || false,
            categoryName: item.category_name,
            sizeName: item.size_name,
            taxRate: item.tax_rate,
            manualNote: item.manual_note,
          })),
          paymentMethod: saleData.payment_method,
          customerName: saleData.customer_name,
          customerPhone: saleData.customer_phone,
          status: 'pending',
          occurredAt: saleData.occurred_at,
        });

        toast.success('Sale saved! Will sync when back online.');
        onComplete();
      }
    } catch (error) {
      console.error('Checkout error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to complete sale');
    } finally {
      setProcessing(false);
    }
  };

  const handleClose = () => {
    if (!processing) {
      onOpenChange(false);
      // Reset form
      setPaymentMethod('cash');
      setCustomerName('');
      setCustomerPhone('');
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
        {/* Premium Header */}
        <div className={`bg-gradient-to-r ${s.primaryGradient} px-6 py-5`}>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-white/20 backdrop-blur-sm">
              <ShoppingBag className="h-5 w-5 text-white" />
            </div>
            <div>
              <DialogHeader className="p-0 space-y-0.5 text-left">
                <DialogTitle className="text-white text-lg font-bold">Complete Sale</DialogTitle>
                <DialogDescription className="text-white/80 text-sm">
                  {isOnline ? `Review ${items.length} item${items.length !== 1 ? 's' : ''} and confirm` : '⚠️ Offline mode — will sync later'}
                </DialogDescription>
              </DialogHeader>
            </div>
          </div>
        </div>

        <div className="space-y-4 px-6 py-5 overflow-y-auto flex-1">
          {/* Items List */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Package className="h-4 w-4 text-muted-foreground" />
              Items ({items.length})
            </div>
            <div className="rounded-lg border border-border/60 overflow-hidden divide-y divide-border/40">
              {items.map((item, index) => {
                const hasDiscount = item.finalPrice < item.originalPrice;
                const discountPercent = hasDiscount ? ((item.originalPrice - item.finalPrice) / item.originalPrice * 100) : 0;
                return (
                  <div key={item.qrCode} className={`flex items-center gap-3 px-3 py-2.5 text-sm ${
                    item.soldOnSale && item.saleType === 'festival' ? 'bg-green-50/50' :
                    item.soldOnSale && item.saleType === 'clearance' ? 'bg-red-50/50' :
                    item.soldOnSale && item.saleType === 'promotion' ? 'bg-blue-50/50' :
                    index % 2 === 0 ? 'bg-muted/20' : ''
                  }`}>
                    <div className={`flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold ${
                      item.soldOnSale ? (
                        item.saleType === 'festival' ? 'bg-green-100 text-green-700' :
                        item.saleType === 'clearance' ? 'bg-red-100 text-red-700' :
                        'bg-blue-100 text-blue-700'
                      ) : `${a.bg} ${a.text}`
                    }`}>
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-foreground truncate">{item.category}</span>
                        {item.size && (
                          <span className="text-[10px] text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded border border-border/40">{item.size}</span>
                        )}
                        {item.soldOnSale && item.saleType && (
                          <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 h-4 ${
                            item.saleType === 'festival' ? 'bg-green-100 text-green-700 border-green-200' :
                            item.saleType === 'clearance' ? 'bg-red-100 text-red-700 border-red-200' :
                            'bg-blue-100 text-blue-700 border-blue-200'
                          }`}>
                            {item.saleType === 'festival' ? '🟢' : item.saleType === 'clearance' ? '🔴' : '🔵'} {item.saleType}
                          </Badge>
                        )}
                      </div>
                      <div className="text-[10px] text-muted-foreground/70 font-mono">
                        {item.isManualEntry ? (
                          <span className="text-amber-600 font-sans font-medium">Quick Sale{item.manualNote ? ` · ${item.manualNote}` : ''}</span>
                        ) : (
                          item.qrCode
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-semibold text-foreground">{formatCurrency(item.finalPrice)}</div>
                      {hasDiscount && (
                        <div className="text-[10px] text-green-600 font-medium">
                          -{discountPercent.toFixed(0)}% off
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Price Summary */}
          <div className={`rounded-lg border-2 ${a.border} bg-gradient-to-r ${a.gradientSubtle} dark:from-brand-950/40 dark:to-brand-900/30 p-4 space-y-2.5`}>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground dark:text-slate-400">Subtotal ({items.length} items)</span>
              <span className="font-medium dark:text-slate-200">{formatCurrency(subtotal)}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="flex items-center gap-1.5 text-muted-foreground dark:text-slate-400">
                  <Tag className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                  Discount
                </span>
                <span className="font-semibold text-green-600 dark:text-green-400">-{formatCurrency(discount)}</span>
              </div>
            )}
            {tax > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground dark:text-slate-400">Tax (GST)</span>
                <span className="font-medium dark:text-slate-200">{formatCurrency(tax)}</span>
              </div>
            )}
            <Separator className={a.border} />
            <div className="flex justify-between items-center">
              <span className="text-base font-bold dark:text-white">Grand Total</span>
              <span className={`text-xl font-bold ${a.text} dark:text-white`}>{formatCurrency(grandTotal)}</span>
            </div>
          </div>

          {/* Payment Method */}
          <div className="space-y-2">
            <Label htmlFor="payment-method" className="text-sm font-semibold flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-muted-foreground" />
              Payment Method
            </Label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger id="payment-method" className="h-12 border-border/60">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">
                  <span className="flex items-center gap-2"><Banknote className="h-4 w-4 text-green-600" /> Cash</span>
                </SelectItem>
                <SelectItem value="upi">
                  <span className="flex items-center gap-2"><Smartphone className="h-4 w-4 text-purple-600" /> UPI</span>
                </SelectItem>
                <SelectItem value="card">
                  <span className="flex items-center gap-2"><CreditCard className="h-4 w-4 text-blue-600" /> Card</span>
                </SelectItem>
                <SelectItem value="other">
                  <span className="flex items-center gap-2"><Wallet className="h-4 w-4 text-orange-600" /> Other</span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Customer Details (Optional) */}
          <div className="space-y-3">
            <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Customer Details (Optional)</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="customer-name" className="text-xs text-muted-foreground">Name</Label>
                <Input
                  id="customer-name"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Customer name"
                  className="h-10 border-border/60"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="customer-phone" className="text-xs text-muted-foreground">Phone</Label>
                <Input
                  id="customer-phone"
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="10-digit mobile"
                  className="h-10 border-border/60"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Premium Footer */}
        <div className="border-t border-border/60 bg-muted/30 px-6 py-4">
          <DialogFooter className="gap-2 sm:gap-3">
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={processing}
              className="flex-1 sm:flex-none"
            >
              Cancel
            </Button>
            <Button
              onClick={handleComplete}
              disabled={processing}
              className={`flex-1 sm:flex-none min-w-[160px] ${s.primaryGradient} ${s.primaryGradientHover} text-white shadow-md`}
            >
              {processing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <ShoppingBag className="mr-2 h-4 w-4" />
                  Complete — {formatCurrency(grandTotal)}
                </>
              )}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
