'use client';

import { useState, useEffect } from 'react';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Pencil, Loader2, Package, IndianRupee, Tag, Layers, AlertTriangle,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatCurrency } from '@/lib/formatters';
import { appConfig } from '@/lib/config';
import { toast } from 'sonner';
import type { Category, Size } from '@/types';

const s = appConfig.styles;

// ─── Types ───────────────────────────────────────────────────────────────────

interface LotForEdit {
  id: string;
  category_id: string | null;
  category_name: string;
  size_name: string;
  size_id: string | null;
  free_text_size: string | null;
  quantity: number;
  cost_price_per_unit: number;
  selling_price_default: number;
  tax_rate: number;
  vendor_name: string | null;
  sale_type: string | null;
  sale_reason: string | null;
  min_margin_percent: number | null;
  date_of_stock_arrival: string;
  items: { id: string; status: string }[];
  availableCount: number;
  soldCount: number;
}

interface EditLotDialogProps {
  lot: LotForEdit | null;
  categories: Category[];
  sizes: Size[];
  onClose: () => void;
  onSaved: () => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function EditLotDialog({ lot, categories, sizes, onClose, onSaved }: EditLotDialogProps) {
  const [saving, setSaving] = useState(false);

  // Form fields
  const [categoryId, setCategoryId] = useState('');
  const [sizeId, setSizeId] = useState('');
  const [freeTextSize, setFreeTextSize] = useState('');
  const [vendorName, setVendorName] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [sellingPrice, setSellingPrice] = useState('');
  const [taxRate, setTaxRate] = useState('');
  const [saleType, setSaleType] = useState('');
  const [minMargin, setMinMargin] = useState('');
  const [saleReason, setSaleReason] = useState('');
  const [arrivalDate, setArrivalDate] = useState('');

  // Hydrate form when lot changes
  useEffect(() => {
    if (lot) {
      setCategoryId(lot.category_id || '');
      setSizeId(lot.size_id || '');
      setFreeTextSize(lot.free_text_size || '');
      setVendorName(lot.vendor_name || '');
      setCostPrice(String(lot.cost_price_per_unit));
      setSellingPrice(String(lot.selling_price_default));
      setTaxRate(String(lot.tax_rate));
      setSaleType(lot.sale_type || '');
      setMinMargin(lot.min_margin_percent != null ? String(lot.min_margin_percent) : '');
      setSaleReason(lot.sale_reason || '');
      setArrivalDate(lot.date_of_stock_arrival);
    }
  }, [lot]);

  if (!lot) return null;

  const costNum = Number(costPrice) || 0;
  const sellNum = Number(sellingPrice) || 0;
  const profitMargin = costNum > 0 ? (((sellNum - costNum) / costNum) * 100).toFixed(1) : '0';
  const hasSoldItems = lot.soldCount > 0;
  const hasAvailableItems = lot.availableCount > 0;

  // Don't allow editing if all items are sold — nothing actionable
  if (!hasAvailableItems && hasSoldItems) {
    return (
      <Dialog open={!!lot} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-sm p-5">
          <DialogHeader>
            <DialogTitle className="text-lg flex items-center gap-2">
              <div className={`p-1.5 rounded-md ${s.headerIconGradient} text-white shadow-sm`}>
                <Pencil className="h-4 w-4" />
              </div>
              Cannot Edit Lot
            </DialogTitle>
          </DialogHeader>
          <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">All {lot.soldCount} items in this lot are sold.</p>
              <p>Sold lot records cannot be edited. Existing sale records remain unchanged.</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={onClose} className="w-full mt-2">Close</Button>
        </DialogContent>
      </Dialog>
    );
  }

  const handleSave = async () => {
    // Validation
    if (!categoryId) { toast.error('Category is required'); return; }
    if (!costPrice || Number(costPrice) <= 0) { toast.error('Cost price must be positive'); return; }
    if (!sellingPrice || Number(sellingPrice) <= 0) { toast.error('Selling price must be positive'); return; }
    if (sellNum <= costNum) { toast.warning('Selling price should be higher than cost price'); }

    setSaving(true);
    try {
      // 1. Update the lot record
      const resolvedSizeId = (!sizeId || sizeId === 'none') ? null : sizeId;
      const lotUpdate: Record<string, unknown> = {
        category_id: categoryId || null,
        size_id: resolvedSizeId,
        free_text_size: freeTextSize || null,
        vendor_name: vendorName || null,
        cost_price_per_unit: Number(costPrice),
        selling_price_default: Number(sellingPrice),
        tax_rate: Number(taxRate) || 0,
        sale_type: saleType || null,
        min_margin_percent: minMargin ? Number(minMargin) : null,
        sale_reason: saleReason || null,
        date_of_stock_arrival: arrivalDate,
      };

      const { error: lotError, count } = await supabase
        .from('lots')
        .update(lotUpdate, { count: 'exact' })
        .eq('id', lot.id);

      if (lotError) throw lotError;
      if (count === 0) throw new Error('Update affected 0 rows — you may not have permission to edit this lot. Please run the lots RLS migration.');

      // 2. Propagate price + sale type changes to all available inventory items in this lot
      const { error: itemsError } = await supabase
        .from('inventory_items')
        .update({
          selling_price: Number(sellingPrice),
          cost_price: Number(costPrice),
          tax_rate: Number(taxRate) || 0,
          sale_type: saleType || null,
          sale_reason: saleReason || null,
        })
        .eq('lot_id', lot.id)
        .eq('status', 'available');

      if (itemsError) {
        console.error('Error updating item prices:', itemsError);
        toast.warning('Lot updated but item prices/sale type may not have synced');
      }

      toast.success(
        `Lot updated — ${lot.availableCount} available item${lot.availableCount === 1 ? '' : 's'} affected`,
        { description: `${lot.category_name} → ${categories.find(c => c.id === categoryId)?.name || 'Updated'}` }
      );
      onSaved();
      onClose();
    } catch (err: any) {
      console.error('Error updating lot:', err);
      toast.error('Failed to update lot');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!lot} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-lg max-h-[85vh] flex flex-col p-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="px-5 pt-5 pb-3 shrink-0">
          <DialogTitle className="text-lg flex items-center gap-2">
            <div className={`p-1.5 rounded-md ${s.headerIconGradient} text-white shadow-sm`}>
              <Pencil className="h-4 w-4" />
            </div>
            Edit Lot
          </DialogTitle>
          <DialogDescription asChild>
            <div className="flex items-center gap-2 flex-wrap mt-1">
              <Badge variant="secondary" className="text-xs tabular-nums">
                {lot.items.length} items in lot
              </Badge>
              {lot.availableCount > 0 && (
                <Badge variant="default" className="text-[10px]">
                  {lot.availableCount} available
                </Badge>
              )}
              {hasSoldItems && (
                <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-400 bg-amber-50">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  {lot.soldCount} sold
                </Badge>
              )}
            </div>
          </DialogDescription>
        </DialogHeader>

        <Separator />

        {/* Scrollable form body */}
        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-4">
          {hasSoldItems && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">This lot has {lot.soldCount} sold items.</p>
                <p>Changes to pricing will only apply to future sales. Existing sale records remain unchanged.</p>
              </div>
            </div>
          )}

          {/* Category */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
              <Tag className="h-3 w-3" /> Category <span className="text-red-400">*</span>
            </Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger className="text-sm">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map(cat => (
                  <SelectItem key={cat.id} value={cat.id} className="text-sm">{cat.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Size fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Size
              </Label>
              <Select value={sizeId || 'none'} onValueChange={(v) => setSizeId(v === 'none' ? '' : v)}>
                <SelectTrigger className="text-sm">
                  <SelectValue placeholder="Select size" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none" className="text-sm text-muted-foreground">No size</SelectItem>
                  {sizes.map(sz => (
                    <SelectItem key={sz.id} value={sz.id} className="text-sm">{sz.size_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Custom Size
              </Label>
              <Input
                value={freeTextSize}
                onChange={e => setFreeTextSize(e.target.value)}
                placeholder="e.g., XL, 32"
                className="text-sm"
              />
            </div>
          </div>

          {/* Vendor + Arrival Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Vendor
              </Label>
              <Input
                value={vendorName}
                onChange={e => setVendorName(e.target.value)}
                placeholder="e.g., ABC Suppliers"
                className="text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Arrival Date
              </Label>
              <Input
                type="date"
                value={arrivalDate}
                onChange={e => setArrivalDate(e.target.value)}
                className="text-sm"
              />
            </div>
          </div>

          <Separator />

          {/* Pricing section */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
              <IndianRupee className="h-3.5 w-3.5" /> Pricing
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Cost Price <span className="text-red-400">*</span>
                </Label>
                <Input
                  type="number"
                  step="0.01"
                  value={costPrice}
                  onChange={e => setCostPrice(e.target.value)}
                  className="text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Selling Price <span className="text-red-400">*</span>
                </Label>
                <Input
                  type="number"
                  step="0.01"
                  value={sellingPrice}
                  onChange={e => setSellingPrice(e.target.value)}
                  className="text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Tax Rate (GST %)
                </Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={taxRate}
                  onChange={e => setTaxRate(e.target.value)}
                  className="text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Profit Margin
                </Label>
                <div className={`h-9 px-3 py-2 rounded-md border bg-muted text-sm font-medium tabular-nums ${
                  Number(profitMargin) > 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {profitMargin}%
                </div>
              </div>
            </div>
          </section>

          <Separator />

          {/* Sale configuration */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5" /> Sale Configuration
            </h3>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => { setSaleType(''); setMinMargin(''); setSaleReason(''); }}
                className={`px-4 py-2 text-sm rounded-md border transition-all ${
                  !saleType
                    ? `${s.accent.bg} ${s.accent.borderStrong} ${s.accent.text} font-medium`
                    : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                }`}
              >
                Normal
              </button>
              <button
                type="button"
                onClick={() => setSaleType('festival')}
                className={`px-4 py-2 text-sm rounded-md border transition-all ${
                  saleType === 'festival'
                    ? 'bg-green-50 border-green-500 text-green-700 font-medium'
                    : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                }`}
              >
                Festival Sale
              </button>
              <button
                type="button"
                onClick={() => setSaleType('promotion')}
                className={`px-4 py-2 text-sm rounded-md border transition-all ${
                  saleType === 'promotion'
                    ? 'bg-blue-50 border-blue-500 text-blue-700 font-medium'
                    : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                }`}
              >
                Promo Sale
              </button>
            </div>

            {(saleType === 'festival' || saleType === 'promotion') && (
              <div className={`grid grid-cols-1 sm:grid-cols-2 gap-4 pl-4 border-l-2 ${s.accent.border}`}>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Min Margin %
                  </Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={minMargin}
                    onChange={e => setMinMargin(e.target.value)}
                    placeholder="15"
                    className="text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Sale Reason
                  </Label>
                  <Input
                    value={saleReason}
                    onChange={e => setSaleReason(e.target.value)}
                    placeholder="e.g., Diwali 2026"
                    className="text-sm"
                  />
                </div>
              </div>
            )}
          </section>

          {/* Impact summary */}
          <div className="rounded-lg border bg-muted/30 p-3 space-y-1.5 text-xs">
            <p className="font-semibold text-sm flex items-center gap-1.5">
              <Package className="h-3.5 w-3.5" /> Impact Summary
            </p>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total items in this lot</span>
              <span className="font-medium tabular-nums">{lot.items.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Available (will be affected)</span>
              <span className="font-medium text-green-600 tabular-nums">{lot.availableCount}</span>
            </div>
            {lot.soldCount > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Sold (historical records unchanged)</span>
                <span className="font-medium text-blue-600 tabular-nums">{lot.soldCount}</span>
              </div>
            )}
            {sellNum !== lot.selling_price_default && (
              <div className="flex justify-between pt-1.5 border-t border-dashed">
                <span className="text-muted-foreground">Price change</span>
                <span className="font-medium tabular-nums">
                  {formatCurrency(lot.selling_price_default)} → {formatCurrency(sellNum)}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t px-5 py-3 flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onClose} disabled={saving} className="flex-1">
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving}
            className={`flex-1 ${s.primaryGradient} ${s.primaryGradientHover} text-white ${s.btnAnimation}`}
          >
            {saving ? (
              <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Saving…</>
            ) : (
              <><Pencil className="mr-1.5 h-3.5 w-3.5" /> Save Changes</>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
