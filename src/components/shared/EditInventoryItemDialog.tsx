'use client';

import { useState, useEffect } from 'react';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Pencil, Loader2, Tag, AlertTriangle,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatCurrency } from '@/lib/formatters';
import { appConfig } from '@/lib/config';
import { toast } from 'sonner';

const s = appConfig.styles;

// ─── Types (exported for modular reuse) ──────────────────────────────────────

export interface EditableInventoryItem {
  id: string;
  status: string;
  sold_at: string | null;
  created_at: string;
  shop_id?: string;
  qr_codes: { code: string; id: string } | null;
  lots?: {
    id: string;
    selling_price_default: number | null;
    cost_price_per_unit: number | null;
    tax_rate: number | null;
    vendor_name: string | null;
    sale_type: string | null;
    sale_reason: string | null;
    min_margin_percent: number | null;
    date_of_stock_arrival: string | null;
    categories: { id: string; name: string } | null;
    sizes: { size_name: string } | null;
    free_text_size: string | null;
  } | null;
}

interface EditInventoryItemDialogProps {
  /** The item to edit — pass an InventoryItemForList directly from the table or a LotItem + lot context */
  item: EditableInventoryItem | null;
  /** Optional lot context override for callers from LotsHistorySheet — if omitted, derived from item.lots */
  lot?: { id: string; category_name: string; size_name: string; selling_price_default: number; cost_price_per_unit: number } | null;
  onClose: () => void;
  onSaved: () => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function EditInventoryItemDialog({ item, lot: lotProp, onClose, onSaved }: EditInventoryItemDialogProps) {
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string>('available');
  const [reason, setReason] = useState('');

  // Derive lot context from prop or from item.lots
  const lotCtx = lotProp ?? (item?.lots ? {
    id: item.lots.id,
    category_name: item.lots.categories?.name || 'Uncategorized',
    size_name: item.lots.sizes?.size_name || item.lots.free_text_size || '—',
    selling_price_default: item.lots.selling_price_default ?? 0,
    cost_price_per_unit: item.lots.cost_price_per_unit ?? 0,
  } : null);

  useEffect(() => {
    if (item) {
      setStatus(item.status);
      setReason('');
    }
  }, [item]);

  if (!item || !lotCtx) return null;

  const statusChanged = status !== item.status;
  const hasChanges = statusChanged;

  const handleSave = async () => {
    if (statusChanged && status === 'damaged' && !reason.trim()) {
      toast.error('Please provide a reason for marking as damaged');
      return;
    }

    setSaving(true);
    try {
      // Status change via edge function (for audit trail)
      const { data, error } = await supabase.functions.invoke('adjust-inventory', {
        body: {
          inventory_item_id: item.id,
          new_status: status,
          reason: reason || `Status changed to ${status}`,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success(`Item ${item.qr_codes?.code || ''} updated`, {
        description: `Status → ${status}`,
      });
      onSaved();
      onClose();
    } catch (err: any) {
      console.error('Error updating item:', err);
      toast.error(err.message || 'Failed to update item');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!item} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-sm max-h-[85vh] flex flex-col p-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="px-5 pt-5 pb-3 shrink-0">
          <DialogTitle className="text-lg flex items-center gap-2">
            <div className={`p-1.5 rounded-md ${s.headerIconGradient} text-white shadow-sm`}>
              <Pencil className="h-4 w-4" />
            </div>
            Edit Item Status
          </DialogTitle>
          <DialogDescription asChild>
            <div className="flex items-center gap-2 flex-wrap mt-1">
              {item.qr_codes?.code && (
                <Badge variant="secondary" className="font-mono font-semibold text-xs">
                  {item.qr_codes.code}
                </Badge>
              )}
              <Badge variant="default" className="capitalize text-[10px]">{item.status}</Badge>
            </div>
          </DialogDescription>
        </DialogHeader>

        <Separator />

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-4">
          {/* Current lot context */}
          <div className="rounded-lg border bg-muted/30 p-3 space-y-1.5 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground text-xs">Category</span>
              <span className="font-medium text-xs">{lotCtx.category_name}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground text-xs">Size</span>
              <span className="font-medium text-xs">{lotCtx.size_name}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground text-xs">Selling Price</span>
              <span className="font-medium text-xs tabular-nums">{formatCurrency(lotCtx.selling_price_default)}</span>
            </div>
          </div>

          {/* Status change */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
              <Tag className="h-3 w-3" /> Status
            </Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="available" className="text-sm">Available</SelectItem>
                <SelectItem value="damaged" className="text-sm">Damaged</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Reason (for status changes) */}
          {statusChanged && (
            <div className="space-y-1.5">
              <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                <AlertTriangle className="h-3 w-3" /> Reason
                {status === 'damaged' && <span className="text-red-400">*</span>}
              </Label>
              <Input
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder={status === 'damaged' ? 'Describe the damage…' : 'Reason for status change'}
                className="text-sm"
              />
            </div>
          )}

          {statusChanged && status === 'damaged' && (
            <div className="flex items-start gap-2 rounded-lg border border-red-300 bg-red-50 p-3 text-xs text-red-800">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <p>Marking this item as damaged will remove it from available inventory. This action is logged for audit.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t px-5 py-3 flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onClose} disabled={saving} className="flex-1">
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving || !hasChanges}
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
