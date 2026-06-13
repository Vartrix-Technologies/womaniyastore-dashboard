'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
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
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/formatters';
import { completeSale, SaleApiError } from '@/lib/api/sales';
import { addPendingSale } from '@/lib/offline/db';
import { useOfflineStatus } from '@/hooks/useOfflineStatus';
import type { CartItem } from '@/types/pos.types';
import { toast } from 'sonner';
import { Loader2, ShoppingBag, CreditCard, Banknote, Smartphone, Wallet, Package, Tag, Phone, User } from 'lucide-react';
import { saleCompleteChime } from '@/lib/sounds';
import { appConfig } from '@/lib/config/app.config';
import { supabase } from '@/lib/supabase';

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

  // ── Phone autofill from history ────────────────────────────────────
  interface CustomerSuggestion { phone: string; name: string | null }
  const [suggestions, setSuggestions] = useState<CustomerSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestionLoading, setSuggestionLoading] = useState(false);
  const phoneDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suggestionBoxRef = useRef<HTMLDivElement>(null);

  const fetchSuggestions = useCallback(async (phone: string) => {
    if (phone.length < 3) { setSuggestions([]); return; }
    setSuggestionLoading(true);
    try {
      const { data } = await supabase
        .from('sales')
        .select('customer_phone, customer_name')
        .ilike('customer_phone', `${phone}%`)
        .not('customer_phone', 'is', null)
        .order('created_at', { ascending: false })
        .limit(30);
      // Deduplicate by phone, keep most-recent name
      const seen = new Map<string, string | null>();
      for (const row of (data ?? [])) {
        const p = (row.customer_phone as string).trim();
        if (!seen.has(p)) seen.set(p, row.customer_name as string | null);
      }
      setSuggestions(Array.from(seen.entries()).slice(0, 6).map(([p, n]) => ({ phone: p, name: n })));
    } catch { /* ignore */ } finally {
      setSuggestionLoading(false);
    }
  }, []);

  const handlePhoneChange = (value: string) => {
    setCustomerPhone(value);
    setShowSuggestions(true);
    if (phoneDebounceRef.current) clearTimeout(phoneDebounceRef.current);
    phoneDebounceRef.current = setTimeout(() => fetchSuggestions(value), 300);
  };

  const handleSelectSuggestion = (s: CustomerSuggestion) => {
    setCustomerPhone(s.phone);
    if (s.name) setCustomerName(s.name);
    setSuggestions([]);
    setShowSuggestions(false);
  };

  const [customerDetailsOpen, setCustomerDetailsOpen] = useState(false);

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
      setSuggestions([]);
      setShowSuggestions(false);
      setCustomerDetailsOpen(false);
    }
  };

  return (
    <>
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
        {/* Premium Header */}
<div className={`bg-gradient-to-r ${s.primaryGradient} px-4 py-2.5 flex-shrink-0`}>
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-white/20 backdrop-blur-sm">
              <ShoppingBag className="h-4 w-4 text-white" />
            </div>
            <DialogHeader className="p-0 space-y-0 text-left">
              <DialogTitle className="text-white text-base font-bold">Complete Sale</DialogTitle>
              {!isOnline && <DialogDescription className="text-white/80 text-xs">⚠️ Offline mode — will sync later</DialogDescription>}
            </DialogHeader>
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
            <Label className="text-sm font-semibold flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-muted-foreground" />
              Payment Method
            </Label>
            <div className="grid grid-cols-4 gap-2">
              {[
                { value: 'cash',  label: 'Cash',  Icon: Banknote,   color: 'text-green-600',  activeBg: 'bg-green-50 dark:bg-green-950/40',  activeBorder: 'border-green-500' },
                { value: 'upi',   label: 'UPI',   Icon: Smartphone, color: 'text-purple-600', activeBg: 'bg-purple-50 dark:bg-purple-950/40', activeBorder: 'border-purple-500' },
                { value: 'card',  label: 'Card',  Icon: CreditCard,  color: 'text-blue-600',   activeBg: 'bg-blue-50 dark:bg-blue-950/40',   activeBorder: 'border-blue-500' },
                { value: 'other', label: 'Other', Icon: Wallet,     color: 'text-orange-600', activeBg: 'bg-orange-50 dark:bg-orange-950/40', activeBorder: 'border-orange-500' },
              ].map(({ value, label, Icon, color, activeBg, activeBorder }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setPaymentMethod(value)}
                  className={`flex flex-col items-center gap-1.5 rounded-lg border-2 py-3 text-xs font-semibold transition-all ${
                    paymentMethod === value
                      ? `${activeBg} ${activeBorder} ${color}`
                      : 'border-border/60 text-muted-foreground hover:border-border hover:bg-muted/40'
                  }`}
                >
                  <Icon className={`h-5 w-5 ${paymentMethod === value ? color : ''}`} />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Customer Details — opens nested dialog so keyboard doesn't hide suggestions */}
          <button
            type="button"
            onClick={() => setCustomerDetailsOpen(true)}
            className={`w-full flex items-center justify-between rounded-lg border px-4 py-3 text-sm transition-colors ${(customerPhone || customerName) ? `border-[hsl(var(--primary)/0.3)] bg-[hsl(var(--primary)/0.05)] hover:bg-[hsl(var(--primary)/0.1)]` : `border-border/60 hover:bg-muted/50`}`}
          >
            <span className="flex items-center gap-2 text-muted-foreground">
              <User className="h-4 w-4" />
              <span className="font-medium">Customer Details</span>
              <span className="text-xs">(Optional)</span>
            </span>
            {(customerPhone || customerName) ? (
              <span className="flex items-center gap-1.5 text-xs font-medium">
                {customerPhone && <span className="font-mono">{customerPhone}</span>}
                {customerName && <span className="text-muted-foreground">· {customerName}</span>}
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">Tap to add</span>
            )}
          </button>
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

    {/* ── Customer Details nested dialog ──────────────────────────────
        Rendered outside the main DialogContent so it sits at the top
        of the screen on mobile, above the virtual keyboard. */}
    <Dialog open={customerDetailsOpen} onOpenChange={setCustomerDetailsOpen}>
      <DialogContent className="sm:max-w-sm !top-[calc(var(--sat)+12px)] !translate-y-0 sm:!top-[50dvh] sm:!-translate-y-1/2 max-h-[85dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-4 w-4" /> Customer Details
          </DialogTitle>
          <DialogDescription>Optional — used for records &amp; repeat customer lookup</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          {/* Phone with history autofill */}
          <div className="space-y-1.5">
            <Label htmlFor="cd-phone" className="text-sm font-medium flex items-center gap-1.5">
              <Phone className="h-3.5 w-3.5" /> Mobile Number
            </Label>
            <Input
              id="cd-phone"
              type="tel"
              inputMode="numeric"
              value={customerPhone}
              onChange={(e) => handlePhoneChange(e.target.value)}
              onFocus={() => { if (customerPhone.length >= 3) setShowSuggestions(true); }}
              placeholder="10-digit mobile"
              className="h-11"
              autoComplete="off"
            />
            {customerPhone && customerPhone.replace(/\D/g, '').length > 0 && customerPhone.replace(/\D/g, '').length < 10 && (
              <p className="text-xs text-destructive">Enter at least 10 digits</p>
            )}
            {/* Suggestions rendered inline (not absolutely positioned) */}
            {showSuggestions && (suggestions.length > 0 || suggestionLoading) && (
              <div className="rounded-md border bg-popover shadow-sm overflow-hidden">
                {suggestionLoading && suggestions.length === 0 ? (
                  <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" /> Searching…
                  </div>
                ) : (
                  suggestions.map((sg) => (
                    <button
                      key={sg.phone}
                      type="button"
                      className="w-full flex items-center gap-2 px-3 py-2.5 text-sm hover:bg-accent text-left border-b last:border-b-0"
                      onPointerDown={(e) => { e.preventDefault(); handleSelectSuggestion(sg); }}
                    >
                      <Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="font-mono font-medium">{sg.phone}</span>
                      {sg.name && <span className="text-muted-foreground text-xs truncate">· {sg.name}</span>}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Name — auto-filled when a suggestion is picked */}
          <div className="space-y-1.5">
            <Label htmlFor="cd-name" className="text-sm font-medium flex items-center gap-1.5">
              <User className="h-3.5 w-3.5" /> Name
            </Label>
            <Input
              id="cd-name"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Customer name"
              className="h-11"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => { setCustomerPhone(''); setCustomerName(''); setSuggestions([]); setShowSuggestions(false); }} size="sm">
            Clear
          </Button>
          <Button
            onClick={() => {
              if (customerPhone && customerPhone.replace(/\D/g, '').length < 10) return;
              setCustomerDetailsOpen(false);
            }}
            size="sm"
            disabled={!!customerPhone && customerPhone.replace(/\D/g, '').length < 10}
          >
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}
