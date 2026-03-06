'use client';

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { Package, Calendar, Tag, DollarSign, Layers } from 'lucide-react';

interface InventoryItem {
  id: string;
  status: string;
  sold_at: string | null;
  created_at: string;
  qr_codes: {
    code: string;
    id?: string;
  } | null;
  lots: {
    id: string;
    selling_price_default: number | null;
    cost_price_per_unit: number | null;
    tax_rate: number | null;
    date_of_stock_arrival: string | null;
    vendor_name: string | null;
    sale_type: string | null;
    min_margin_percent: number | null;
    sale_reason: string | null;
    categories: {
      id: string;
      name: string;
    } | null;
    sizes: {
      size_name: string;
    } | null;
    free_text_size: string | null;
  } | null;
}

interface InventoryItemDetailsDialogProps {
  item: InventoryItem | null;
  onClose: () => void;
}

export function InventoryItemDetailsDialog({ item, onClose }: InventoryItemDetailsDialogProps) {
  if (!item) return null;

  const statusColor = {
    available: 'bg-green-500',
    sold: 'bg-blue-500',
    damaged: 'bg-red-500',
    reserved: 'bg-yellow-500',
    returned: 'bg-orange-500',
  }[item.status] || 'bg-gray-500';

  const statusVariant = {
    available: 'default' as const,
    sold: 'secondary' as const,
    damaged: 'destructive' as const,
    reserved: 'outline' as const,
    returned: 'outline' as const,
  }[item.status] || 'outline' as const;

  const profitMargin = item.lots 
    ? ((item.lots.selling_price_default - item.lots.cost_price_per_unit) / item.lots.cost_price_per_unit * 100).toFixed(1)
    : '0';

  return (
    <Dialog open={!!item} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg flex items-center gap-2">
            <Package className="h-5 w-5 text-teal-600" />
            Inventory Item Details
          </DialogTitle>
          {/* <DialogDescription className="text-xs">
            {item.qr_codes?.code && (
              <span className="font-mono font-semibold">{item.qr_codes.code}</span>
            )}
          </DialogDescription> */}
        </DialogHeader>
        
        <div className="space-y-3">
          {/* Status Card */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Layers className="h-4 w-4 text-teal-600" />
                Status Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">QR Code:</span>
                <span className="font-mono font-semibold text-xs">{item.qr_codes?.code || 'N/A'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Status:</span>
                <Badge variant={statusVariant} className="capitalize">
                  {item.status}
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Added to Inventory:</span>
                <span className="text-xs">{formatDate(item.created_at)}</span>
              </div>
              {item.sold_at && (
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Sold On:</span>
                  <span className="text-xs">{formatDate(item.sold_at)}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Product Details */}
          {item.lots && (
            <Card className={item.lots.sale_type ? (item.lots.sale_type === 'festival' ? 'border-2 border-green-300 bg-green-50/30' : 'border-2 border-blue-300 bg-blue-50/30') : ''}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Tag className="h-4 w-4 text-teal-600" />
                  Product Details
                  {item.lots.sale_type && (
                    <Badge 
                      variant="outline"
                      className={`ml-auto font-semibold ${
                        item.lots.sale_type === 'festival' 
                          ? 'bg-green-100 text-green-700 border-green-400' 
                          : 'bg-blue-100 text-blue-700 border-blue-400'
                      }`}
                    >
                      {item.lots.sale_type === 'festival' ? '🟢 FESTIVAL SALE' : '🔵 PROMOTIONAL SALE'}
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Category:</span>
                  <span className="font-semibold">{item.lots.categories?.name || 'Uncategorized'}</span>
                </div>
                {(item.lots.sizes?.size_name || item.lots.free_text_size) && (
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Size:</span>
                    <span className="text-lg font-bold text-teal-600">
                      {item.lots.sizes?.size_name || item.lots.free_text_size}
                    </span>
                  </div>
                )}
                {item.lots.vendor_name && (
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Vendor:</span>
                    <span className="font-medium">{item.lots.vendor_name}</span>
                  </div>
                )}
                
                {/* Sale Details */}
                {item.lots.sale_type && (
                  <>
                    {item.lots.sale_reason && (
                      <div className="flex flex-col gap-1 pt-1">
                        <span className="text-muted-foreground">Sale Reason:</span>
                        <span className="text-xs italic bg-blue-50/50 px-2 py-1 rounded border border-blue-200">
                          "{item.lots.sale_reason}"
                        </span>
                      </div>
                    )}
                    
                    {item.lots.min_margin_percent !== null && item.lots.sale_type === 'festival' && (
                      <div className="flex justify-between items-center bg-yellow-50 px-2 py-1.5 rounded border border-yellow-200">
                        <span className="text-xs text-muted-foreground">Protected Margin:</span>
                        <span className="text-xs font-semibold text-yellow-700">
                          {item.lots.min_margin_percent}% 
                          <span className="text-muted-foreground ml-1">
                            (Min: {formatCurrency(item.lots.cost_price_per_unit * (1 + item.lots.min_margin_percent / 100))})
                          </span>
                        </span>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {/* Pricing Details */}
          {item.lots && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-teal-600" />
                  Pricing Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Cost Price:</span>
                  <span className="font-semibold text-green-600">
                    {formatCurrency(item.lots.cost_price_per_unit)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Selling Price:</span>
                  <span className="font-semibold text-lg">
                    {formatCurrency(item.lots.selling_price_default)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Tax Rate:</span>
                  <span>{item.lots.tax_rate}%</span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t">
                  <span className="text-muted-foreground">Profit Margin:</span>
                  <span className="font-semibold text-blue-600">{profitMargin}%</span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Stock Information */}
          {item.lots && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-teal-600" />
                  Stock Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Stock Arrival Date:</span>
                  <span>{formatDate(item.lots.date_of_stock_arrival)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Days in Inventory:</span>
                  <span className="font-medium">
                    {Math.floor((new Date().getTime() - new Date(item.created_at).getTime()) / (1000 * 60 * 60 * 24))} days
                  </span>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
