'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { Package, Calendar, Tag, DollarSign, Layers, ShieldCheck, ShoppingCart } from 'lucide-react';
import { appConfig } from '@/lib/config';
import type { InventoryItemForList } from '@/types';

const s = appConfig.styles;

interface InventoryItemDetailsDialogProps {
  item: InventoryItemForList | null;
  onClose: () => void;
  /** Optional callback to add this item to the POS cart. Button only shows when provided + item is available. */
  onAddToCart?: (item: InventoryItemForList) => void;
}

export function InventoryItemDetailsDialog({ item, onClose, onAddToCart }: InventoryItemDetailsDialogProps) {
  if (!item) return null;

  const statusVariant = {
    available: 'default' as const,
    sold: 'secondary' as const,
    damaged: 'destructive' as const,
    reserved: 'outline' as const,
    returned: 'outline' as const,
  }[item.status] || 'outline' as const;

  const profitMargin = item.lots && item.lots.selling_price_default != null && item.lots.cost_price_per_unit
    ? (((item.lots.selling_price_default - item.lots.cost_price_per_unit) / item.lots.cost_price_per_unit) * 100).toFixed(1)
    : '0';

  const daysInInventory = Math.floor(
    (new Date().getTime() - new Date(item.created_at).getTime()) / (1000 * 60 * 60 * 24)
  );

  return (
    <Dialog open={!!item} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-lg max-h-[85vh] flex flex-col p-0 overflow-hidden">
        {/* Premium header */}
        <DialogHeader className="px-5 pt-5 pb-3 shrink-0">
          <DialogTitle className="text-lg flex items-center gap-2">
            <div className={`p-1.5 rounded-md ${s.headerIconGradient} text-white shadow-sm`}>
              <Package className="h-4 w-4" />
            </div>
            Inventory Item Details
          </DialogTitle>
          <DialogDescription asChild>
            <div className="flex items-center gap-2 flex-wrap mt-1">
              {item.qr_codes?.code && (
                <Badge variant="secondary" className="font-mono font-semibold text-xs">
                  {item.qr_codes.code}
                </Badge>
              )}
              <Badge variant={statusVariant} className="capitalize text-xs">
                {item.status}
              </Badge>
              {item.lots?.sale_type && (
                <Badge
                  variant="outline"
                  className={`text-xs font-semibold ${
                    item.lots.sale_type === 'festival'
                      ? 'bg-green-100 text-green-700 border-green-400'
                      : item.lots.sale_type === 'clearance'
                        ? 'bg-red-100 text-red-700 border-red-400'
                        : 'bg-blue-100 text-blue-700 border-blue-400'
                  }`}
                >
                  {item.lots.sale_type === 'festival' ? '🟢 Festival' : item.lots.sale_type === 'clearance' ? '🔴 Clearance' : '🔵 Promotion'}
                </Badge>
              )}
            </div>
          </DialogDescription>
        </DialogHeader>

        <Separator />

        {/* Scrollable body */}
        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-4">
          {/* Status Information */}
          <section className="space-y-2.5">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5" /> Status Information
            </h3>
            <div className="rounded-lg border bg-muted/30 p-3 space-y-2 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Added to Inventory</span>
                <span className="text-xs font-medium">{formatDate(item.created_at)}</span>
              </div>
              {item.sold_at && (
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Sold On</span>
                  <span className="text-xs font-medium">{formatDate(item.sold_at)}</span>
                </div>
              )}
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Days in Inventory</span>
                <span className="text-xs font-medium tabular-nums">{daysInInventory} days</span>
              </div>
            </div>
          </section>

          {/* Product Details */}
          {item.lots && (
            <section className="space-y-2.5">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                <Tag className="h-3.5 w-3.5" /> Product Details
              </h3>
              <div className="rounded-lg border p-3 space-y-2 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Category</span>
                  <span className="font-semibold">{item.lots.categories?.name || 'Uncategorized'}</span>
                </div>
                {(item.lots.sizes?.size_name || item.lots.free_text_size) && (
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Size</span>
                    <span className={`text-base font-bold ${s.linkColor}`}>
                      {item.lots.sizes?.size_name || item.lots.free_text_size}
                    </span>
                  </div>
                )}
                {item.lots.vendor_name && (
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Vendor</span>
                    <span className="font-medium">{item.lots.vendor_name}</span>
                  </div>
                )}
                {/* Sale details */}
                {item.lots.sale_reason && (
                  <div className="flex flex-col gap-1 pt-1.5 border-t border-dashed">
                    <span className="text-xs text-muted-foreground">Sale Reason</span>
                    <p className="text-xs italic bg-muted/50 px-2.5 py-1.5 rounded-md border">
                      &quot;{item.lots.sale_reason}&quot;
                    </p>
                  </div>
                )}
                {item.lots.min_margin_percent !== null && item.lots.sale_type === 'festival' && (
                  <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-dashed">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <ShieldCheck className="h-3.5 w-3.5 text-amber-500" />
                      Protected Margin
                    </div>
                    <span className="text-xs font-semibold text-amber-700 tabular-nums">
                      {item.lots.min_margin_percent}%
                      {item.lots.cost_price_per_unit != null && (
                        <span className="text-muted-foreground ml-1 font-normal">
                          (Min: {formatCurrency(item.lots.cost_price_per_unit * (1 + item.lots.min_margin_percent / 100))})
                        </span>
                      )}
                    </span>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Pricing Information */}
          {item.lots && (
            <section className="space-y-2.5">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                <DollarSign className="h-3.5 w-3.5" /> Pricing Information
              </h3>
              <div className="rounded-lg border p-3 space-y-2 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Cost Price</span>
                  <span className={`font-semibold ${s.statsActive.available.text}`}>
                    {formatCurrency(item.lots.cost_price_per_unit ?? 0)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Selling Price</span>
                  <span className="font-bold text-base">
                    {formatCurrency(item.lots.selling_price_default ?? 0)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Tax Rate</span>
                  <span className="tabular-nums">{item.lots.tax_rate ?? 0}%</span>
                </div>
                <Separator />
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Profit Margin</span>
                  <span className={`font-bold ${s.statsActive.sold.text} tabular-nums`}>{profitMargin}%</span>
                </div>
              </div>
            </section>
          )}

          {/* Stock Information */}
          {item.lots && (
            <section className="space-y-2.5">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" /> Stock Information
              </h3>
              <div className="rounded-lg border bg-muted/30 p-3 space-y-2 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Stock Arrival Date</span>
                  <span className="text-xs font-medium">
                    {item.lots.date_of_stock_arrival ? formatDate(item.lots.date_of_stock_arrival) : 'N/A'}
                  </span>
                </div>
              </div>
            </section>
          )}
        </div>

        {/* Add to Cart footer */}
        {onAddToCart && item.status === 'available' && (
          <div className="shrink-0 border-t px-5 py-3">
            <Button
              onClick={() => onAddToCart(item)}
              className={`w-full ${s.primaryGradient} ${s.primaryGradientHover} text-white ${s.btnAnimation}`}
            >
              <ShoppingCart className="mr-2 h-4 w-4" />
              Add to Cart
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
