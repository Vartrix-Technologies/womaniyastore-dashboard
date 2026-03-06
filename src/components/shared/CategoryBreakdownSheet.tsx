'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Download, RefreshCw, Package, Loader2, BarChart3,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { exportToCSV } from '@/lib/utils';
import { appConfig } from '@/lib/config';
import { toast } from 'sonner';

const s = appConfig.styles;

interface CategoryBreakdownItem {
  id: string;
  name: string;
  total: number;
  available: number;
  sold: number;
  damaged: number;
}

interface CategoryBreakdownSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shopId: string | null;
}

export function CategoryBreakdownSheet({ open, onOpenChange, shopId }: CategoryBreakdownSheetProps) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<CategoryBreakdownItem[]>([]);

  const fetchBreakdown = useCallback(async () => {
    if (!shopId) return;
    setLoading(true);
    try {
      // Only fetch currently available items — live inventory snapshot
      const { data: items, error } = await supabase
        .from('inventory_items')
        .select(`
          id,
          status,
          lots ( categories ( id, name ) )
        `)
        .eq('shop_id', shopId)
        .eq('status', 'available');

      if (error) throw error;

      const map = new Map<string, CategoryBreakdownItem>();

      (items || []).forEach((item: any) => {
        const catId = item.lots?.categories?.id || 'uncategorized';
        const catName = item.lots?.categories?.name || 'Uncategorized';

        if (!map.has(catId)) {
          map.set(catId, { id: catId, name: catName, total: 0, available: 0, sold: 0, damaged: 0 });
        }
        const stat = map.get(catId)!;
        stat.total++;
        stat.available++;
      });

      setData(Array.from(map.values()).sort((a, b) => b.total - a.total));
    } catch (err) {
      console.error('Category breakdown error:', err);
      toast.error('Failed to load category breakdown');
    } finally {
      setLoading(false);
    }
  }, [shopId]);

  useEffect(() => {
    if (open) fetchBreakdown();
  }, [open, fetchBreakdown]);

  const grandTotal = data.reduce((sum, d) => sum + d.total, 0);

  const handleExport = () => {
    if (data.length === 0) {
      toast.warning('No data to export');
      return;
    }
    const rows = data.map((d) => ({
      Category: d.name,
      Total: d.total,
      Available: d.available,
      Sold: d.sold,
      Damaged: d.damaged,
      'Available %': d.total > 0 ? `${((d.available / d.total) * 100).toFixed(1)}%` : '0%',
    }));
    exportToCSV(rows, { filename: 'category-breakdown' });
    toast.success(`Exported ${data.length} categories`);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[calc(100%-2.5rem)] sm:max-w-lg flex flex-col p-0 gap-0 rounded-l-xl sm:rounded-none">
        {/* Header */}
        <SheetHeader className="px-5 pt-5 pb-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-lg ${s.headerIconGradient} text-white shadow-sm`}>
              <BarChart3 className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <SheetTitle className="text-base">Category Breakdown</SheetTitle>
              <SheetDescription className="text-xs">
                Live inventory available in store
              </SheetDescription>
            </div>
            {!loading && data.length > 0 && (
              <Badge variant="secondary" className="shrink-0 text-xs tabular-nums">
                {data.length} categories
              </Badge>
            )}
          </div>
        </SheetHeader>

        <Separator />

        {/* Scrollable body */}
        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">Loading categories…</p>
            </div>
          ) : data.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
              <div className="rounded-full bg-muted p-4">
                <Package className="h-8 w-8 text-muted-foreground/50" />
              </div>
              <p className="font-medium text-sm">No inventory data</p>
              <p className="text-xs text-muted-foreground max-w-[220px]">
                Add stock lots to see the category breakdown here
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Grand total summary */}
              <div className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-muted/50 border">
                <div>
                  <p className="text-xs text-muted-foreground">Available in Store</p>
                  <p className="text-xl font-bold tabular-nums">{grandTotal}</p>
                </div>
                <Badge variant="secondary" className="text-xs">
                  Live Snapshot
                </Badge>
              </div>

              {/* Category cards */}
              {data.map((cat, idx) => {
                const pct = grandTotal > 0 ? (cat.total / grandTotal) * 100 : 0;
                const barColor = s.categoryBarColors[idx % s.categoryBarColors.length];

                return (
                  <div
                    key={cat.id}
                    className="rounded-lg border p-3 space-y-2.5 transition-all hover:shadow-sm"
                  >
                    {/* Name + total share */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className={`h-2.5 w-2.5 rounded-full shrink-0 ${barColor}`} />
                        <p className="text-sm font-medium truncate">{cat.name}</p>
                      </div>
                      <div className="text-right shrink-0 ml-3">
                        <span className="text-sm font-bold tabular-nums">{cat.total}</span>
                        <span className="text-[10px] text-muted-foreground ml-1">
                          ({pct.toFixed(0)}%)
                        </span>
                      </div>
                    </div>

                    {/* Progress bar: share of total inventory */}
                    <div className="space-y-1">
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[10px] text-muted-foreground tabular-nums">
                        <span>{cat.available} items</span>
                        <span>{pct.toFixed(0)}% of inventory</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <SheetFooter className="px-5 py-3 border-t shrink-0 flex-row gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchBreakdown}
            disabled={loading}
            className="flex-1"
          >
            <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={loading || data.length === 0}
            className="flex-1"
          >
            <Download className="mr-1.5 h-3.5 w-3.5" />
            Export CSV
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
