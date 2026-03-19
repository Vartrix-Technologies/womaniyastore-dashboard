'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, Percent } from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';
import type { CartItem } from '@/types/pos.types';
import type { InventoryItemForList } from '@/types';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { InventoryItemDetailsDialog } from '@/components/shared/InventoryItemDetailsDialog';
import { EditInventoryItemDialog } from '@/components/shared/EditInventoryItemDialog';
import { fetchInventoryItemById } from '@/lib/api/inventory';

interface CartListProps {
  items: CartItem[];
  onRemoveItem: (qrCode: string) => void;
  onUpdatePrice: (qrCode: string, newPrice: number) => void;
  onUpdateDiscountReason: (qrCode: string, reason: string) => void;
  onUpdateSaleType: (qrCode: string, soldOnSale: boolean, saleType?: string) => void;
  onRefreshItem?: (qrCode: string, updates: Partial<CartItem>) => void;
  onClearCart?: () => void;
}

export function CartList({
  items,
  onRemoveItem,
  onUpdatePrice,
  onUpdateDiscountReason,
  onUpdateSaleType,
  onRefreshItem,
  onClearCart,
}: CartListProps) {
  const { profile } = useAuth();
  const isStaff = profile?.role === 'staff';
  const [editingPrice, setEditingPrice] = useState<Record<string, number>>({});
  const [priceWarning, setPriceWarning] = useState<{ item: CartItem; newPrice: number; percent: number } | null>(null);
  const [viewingItem, setViewingItem] = useState<InventoryItemForList | null>(null);
  const [editingItem, setEditingItem] = useState<InventoryItemForList | null>(null);
  const [loadingItemId, setLoadingItemId] = useState<string | null>(null);

  // Track which cart item QR was clicked so we can update cart after edit
  const [activeCartQr, setActiveCartQr] = useState<string | null>(null);

  const handleQrClick = async (cartItem: CartItem) => {
    if (isStaff || cartItem.isManualEntry || !cartItem.inventoryItemId) return;
    try {
      setLoadingItemId(cartItem.inventoryItemId);
      const data = await fetchInventoryItemById(cartItem.inventoryItemId);
      setActiveCartQr(cartItem.qrCode);
      setViewingItem(data as unknown as InventoryItemForList);
    } catch {
      toast.error('Failed to load item details');
    } finally {
      setLoadingItemId(null);
    }
  };

  const handleEditFromDetails = (item: InventoryItemForList) => {
    setViewingItem(null);
    setEditingItem(item);
  };

  const handleEditSaved = async () => {
    if (!editingItem?.id || !activeCartQr) {
      setEditingItem(null);
      return;
    }
    try {
      // Re-fetch updated item to get new prices
      const updated = await fetchInventoryItemById(editingItem.id);
      const newSellingPrice = updated.selling_price ?? updated.lots?.selling_price_default ?? 0;
      const cartItem = items.find(i => i.qrCode === activeCartQr);
      if (cartItem && onRefreshItem) {
        const updates: Partial<CartItem> = {};
        if (newSellingPrice !== cartItem.originalPrice) {
          updates.originalPrice = newSellingPrice;
          updates.finalPrice = newSellingPrice;
        }
        const newTaxRate = updated.tax_rate ?? updated.lots?.tax_rate ?? 0;
        if (newTaxRate !== cartItem.taxRate) {
          updates.taxRate = newTaxRate;
        }
        if (Object.keys(updates).length > 0) {
          onRefreshItem(activeCartQr, updates);
          toast.info('Cart item updated');
        }
      }
    } catch {
      // Non-critical — item was saved, just couldn't refresh
    }
    setEditingItem(null);
    setActiveCartQr(null);
  };

  const handlePriceBlur = (item: CartItem, newPrice: number) => {
    const discountPercent = ((item.originalPrice - newPrice) / item.originalPrice) * 100;
    const maxDiscount = profile?.max_discount_percent || 0;

    if (discountPercent > maxDiscount) {
      toast.error(`Discount cannot exceed ${maxDiscount}%. Requires manager approval.`);
      // Reset to original final price
      setEditingPrice(prev => ({ ...prev, [item.qrCode]: item.finalPrice }));
      return;
    }

    // Warn if new price is less than 50% of original
    if (newPrice > 0 && newPrice < item.originalPrice * 0.5) {
      setPriceWarning({ item, newPrice, percent: discountPercent });
      return;
    }

    onUpdatePrice(item.qrCode, newPrice);
  };

  const handlePriceChange = (qrCode: string, newPrice: number) => {
    setEditingPrice(prev => ({ ...prev, [qrCode]: newPrice }));
  };

  return (
    <div className="space-y-3">
      {/* Cart Header with Clear Button */}
      {items.length > 0 && onClearCart && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            {items.length} {items.length === 1 ? 'item' : 'items'} in cart
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onClearCart}
            className="text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Clear Cart
          </Button>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-border/50 bg-card shadow-sm">
        <table className="w-full min-w-[800px]">
          <thead>
            <tr className="border-b border-border/50 bg-muted/30">
              <th className="w-10"></th>
              <th className="text-left py-3.5 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Item</th>
              <th className="text-left py-3.5 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Size</th>
              <th className="text-left py-3.5 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Sale-Type</th>
              <th className="text-left py-3.5 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Original</th>
              <th className="text-left py-3.5 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Final</th>
              <th className="text-left py-3.5 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Discount</th>
              <th className="text-left py-3.5 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Reason</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const hasDiscount = item.finalPrice < item.originalPrice;
              const discountAmount = item.originalPrice - item.finalPrice;
              const discountPercent = (discountAmount / item.originalPrice) * 100;

              return (
                <tr key={item.qrCode} className={`border-b border-border/40 transition-all duration-200 group ${item.soldOnSale && item.saleType === 'festival' ? 'bg-gradient-to-r from-green-50/60 via-green-50/30 to-transparent hover:from-green-50 hover:via-green-50/50' :
                    item.soldOnSale && item.saleType === 'clearance' ? 'bg-gradient-to-r from-red-50/60 via-red-50/30 to-transparent hover:from-red-50 hover:via-red-50/50' :
                      item.soldOnSale && item.saleType === 'promotion' ? 'bg-gradient-to-r from-blue-50/60 via-blue-50/30 to-transparent hover:from-blue-50 hover:via-blue-50/50' :
                        'hover:bg-muted/40'
                  }`}>
                  {/* Delete Button - First column */}
                  <td className={`py-4 px-2 border-l-[3px] ${item.soldOnSale && item.saleType === 'festival' ? 'border-l-green-500' :
                      item.soldOnSale && item.saleType === 'clearance' ? 'border-l-red-500' :
                        item.soldOnSale && item.saleType === 'promotion' ? 'border-l-blue-500' :
                          'border-l-transparent'
                    }`}>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onRemoveItem(item.qrCode)}
                      className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10 transition-all duration-200"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>

                  {/* Item Details - Name and QR */}
                  <td className="py-4 px-4">
                    <div className="font-semibold text-sm text-foreground min-w-[120px]">{item.category}
                      {item.isManualEntry ? (
                        <div className="flex items-center gap-1 my-1">
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 border-amber-300 bg-amber-50 text-amber-700 font-medium">
                            Quick Sale
                          </Badge>
                          {item.manualNote && (
                            <span className="text-[10px] text-muted-foreground/70 truncate max-w-[120px]" title={item.manualNote}>
                              {item.manualNote}
                            </span>
                          )}
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleQrClick(item)}
                          disabled={isStaff || loadingItemId === item.inventoryItemId}
                          className={`block text-[10px] text-muted-foreground/70 font-mono tracking-tight bg-muted/40 px-2 py-0.5 my-1 rounded border border-border/30 text-left ${
                            !isStaff ? 'cursor-pointer hover:bg-muted/70 hover:border-brand-300 hover:text-foreground transition-colors' : ''
                          }`}
                          title={!isStaff ? 'Click to view/edit item details' : undefined}
                        >
                          {loadingItemId === item.inventoryItemId ? 'Loading…' : item.qrCode}
                        </button>
                      )}
                    </div>
                  </td>

                  {/* Size */}
                  <td className="py-4 px-4">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-muted/60 text-muted-foreground border border-border/40">
                      {item.size}
                    </span>
                  </td>

                  {/* Sale Type Dropdown */}
                  <td className="py-4 px-4">
                    <div className="space-y-1.5">
                      <Select
                        value={item.soldOnSale ? item.saleType : 'regular'}
                        onValueChange={(value) => {
                          if (value === 'regular') {
                            onUpdateSaleType(item.qrCode, false);
                          } else {
                            onUpdateSaleType(item.qrCode, true, value);
                          }
                        }}
                      >
                        <SelectTrigger className="h-8 text-xs w-[145px] px-2.5 border-border/60 shadow-sm hover:border-border transition-colors">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="min-w-[145px]">
                          <SelectItem value="regular" className="text-xs py-2 px-2.5 cursor-pointer">
                            <span className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-gray-400 ring-2 ring-gray-200"></span>
                              <span className="font-medium">Regular</span>
                            </span>
                          </SelectItem>
                          <SelectItem value="festival" className="text-xs py-2 px-2.5 cursor-pointer">
                            <span className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-green-500 ring-2 ring-green-200"></span>
                              <span className="font-medium">Festival</span>
                            </span>
                          </SelectItem>
                          <SelectItem value="clearance" className="text-xs py-2 px-2.5 cursor-pointer">
                            <span className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-red-500 ring-2 ring-red-200"></span>
                              <span className="font-medium">Clearance</span>
                            </span>
                          </SelectItem>
                          <SelectItem value="promotion" className="text-xs py-2 px-2.5 cursor-pointer">
                            <span className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-blue-500 ring-2 ring-blue-200"></span>
                              <span className="font-medium">Promotion</span>
                            </span>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      {/* Subtle margin warning */}
                      {item.soldOnSale && item.saleType === 'festival' && item.lotMinMargin && item.lotCostPrice && (
                        <div className="flex items-center gap-1 text-[10px] text-amber-700 bg-amber-50/80 px-2 py-0.5 rounded-md border border-amber-200/50">
                          <span className="text-[9px]">⚠</span>
                          <span className="font-medium">Min ₹{(item.lotCostPrice * (1 + item.lotMinMargin / 100)).toFixed(0)}</span>
                        </div>
                      )}
                    </div>
                  </td>

                  {/* Original Price */}
                  <td className="py-4 px-4">
                    <span className={`text-sm font-semibold ${hasDiscount ? 'line-through text-muted-foreground/60' : 'text-foreground'}`}>
                      {formatCurrency(item.originalPrice)}
                    </span>
                  </td>

                  {/* Final Price */}
                  <td className="py-4 px-4">
                    <Input
                      type="number"
                      value={editingPrice[item.qrCode] ?? item.finalPrice}
                      onChange={(e) => handlePriceChange(item.qrCode, parseFloat(e.target.value) || 0)}
                      onBlur={(e) => handlePriceBlur(item, parseFloat(e.target.value) || 0)}
                      className="h-9 w-28 font-bold text-sm shadow-sm border-border/60 focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all"
                      min={0}
                      max={item.originalPrice}
                      step={10}
                    />
                  </td>

                  {/* Discount */}
                  <td className="py-4 px-4">
                    {hasDiscount ? (
                      <div className="space-y-1">
                        <Badge variant="secondary" className="flex items-center gap-1 w-fit shadow-sm border border-border/40 font-semibold">
                          <Percent className="h-3 w-3" />
                          {discountPercent.toFixed(1)}%
                        </Badge>
                        <div className="text-[11px] text-muted-foreground/80 font-medium">
                          -{formatCurrency(discountAmount)}
                        </div>
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground/40">—</span>
                    )}
                  </td>

                  {/* Discount Reason */}
                  <td className="py-4 px-4">
                    {hasDiscount ? (
                      <Input
                        placeholder="Reason..."
                        value={item.discountReason || ''}
                        onChange={(e) => onUpdateDiscountReason(item.qrCode, e.target.value)}
                        className="h-9 text-xs w-48 shadow-sm border-border/60 placeholder:text-muted-foreground/50 focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all"
                      />
                    ) : (
                      <span className="text-sm text-muted-foreground/40">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Inventory Item Details Dialog */}
      <InventoryItemDetailsDialog
        item={viewingItem}
        onClose={() => { setViewingItem(null); setActiveCartQr(null); }}
        onEdit={handleEditFromDetails}
      />

      {/* Edit Inventory Item Dialog */}
      <EditInventoryItemDialog
        item={editingItem}
        onClose={() => { setEditingItem(null); setActiveCartQr(null); }}
        onSaved={handleEditSaved}
      />

      {/* Price Drop Warning Dialog */}
      <ConfirmDialog
        open={!!priceWarning}
        onOpenChange={(open) => {
          if (!open && priceWarning) {
            // Cancelled — reset to previous price
            setEditingPrice(prev => ({ ...prev, [priceWarning.item.qrCode]: priceWarning.item.finalPrice }));
            setPriceWarning(null);
          }
        }}
        onConfirm={() => {
          if (priceWarning) {
            onUpdatePrice(priceWarning.item.qrCode, priceWarning.newPrice);
            setPriceWarning(null);
          }
        }}
        title="Large Price Reduction"
        description={priceWarning
          ? `You're setting ${priceWarning.item.category} (${priceWarning.item.qrCode}) to ${formatCurrency(priceWarning.newPrice)} — that's ${priceWarning.percent.toFixed(1)}% off the original ${formatCurrency(priceWarning.item.originalPrice)}. Are you sure?`
          : ''}
        confirmText="Apply Price"
        variant="default"
      />
    </div>
  );
}
