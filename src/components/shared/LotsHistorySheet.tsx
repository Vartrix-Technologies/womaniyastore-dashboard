'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { DateRangeFilter } from '@/components/shared/DateRangeFilter';
import {
  History, Download, RefreshCw, Package, Loader2,
  ChevronRight, ChevronDown, Pencil, Eye, Layers,
  Calendar, Tag, IndianRupee,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useDateFilter } from '@/hooks';
import { exportToCSV } from '@/lib/utils';
import { appConfig } from '@/lib/config';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { toast } from 'sonner';
import { EditLotDialog } from '@/components/shared/EditLotDialog';
import { EditInventoryItemDialog } from '@/components/shared/EditInventoryItemDialog';
import type { Category, Size } from '@/types';

const s = appConfig.styles;

// ─── Types ───────────────────────────────────────────────────────────────────

interface LotItem {
  id: string;
  status: string;
  sold_at: string | null;
  created_at: string;
  qr_codes: { code: string; id: string } | null;
}

interface LotEntry {
  id: string;
  category_id: string | null;
  category_name: string;
  size_name: string;
  quantity: number;
  cost_price_per_unit: number;
  selling_price_default: number;
  tax_rate: number;
  vendor_name: string | null;
  sale_type: string | null;
  sale_reason: string | null;
  min_margin_percent: number | null;
  date_of_stock_arrival: string;
  free_text_size: string | null;
  size_id: string | null;
  created_at: string;
  items: LotItem[];
  availableCount: number;
  soldCount: number;
  damagedCount: number;
}

interface DateGroup {
  date: string;       // YYYY-MM-DD
  displayDate: string; // Formatted display
  lots: LotEntry[];
  totalItems: number;
}

interface LotsHistorySheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shopId: string | null;
  /** Called after any edit so the parent table can refetch */
  onDataChanged?: () => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function LotsHistorySheet({ open, onOpenChange, shopId, onDataChanged }: LotsHistorySheetProps) {
  const [loading, setLoading] = useState(false);
  const [dateGroups, setDateGroups] = useState<DateGroup[]>([]);
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());
  const [expandedLots, setExpandedLots] = useState<Set<string>>(new Set());
  const [categories, setCategories] = useState<Category[]>([]);
  const [sizes, setSizes] = useState<Size[]>([]);

  // Edit state
  const [editingLot, setEditingLot] = useState<LotEntry | null>(null);
  const [editingItem, setEditingItem] = useState<LotItem | null>(null);
  const [editingItemLot, setEditingItemLot] = useState<LotEntry | null>(null);

  const { dateFilter, setDateFilter, customRange, setCustomRange, startDateISO, endDateISO } = useDateFilter({ initialFilter: 'month' });

  // ── Fetch reference data ─────────────────────────────────────────────────

  const fetchReferenceData = useCallback(async () => {
    if (!shopId) return;
    const [catRes, sizeRes] = await Promise.all([
      supabase.from('categories').select('*').eq('shop_id', shopId).order('name'),
      supabase.from('sizes').select('*').eq('shop_id', shopId).order('sort_order'),
    ]);
    if (catRes.data) setCategories(catRes.data);
    if (sizeRes.data) setSizes(sizeRes.data);
  }, [shopId]);

  // ── Fetch lots tree data ─────────────────────────────────────────────────

  const fetchLotsHistory = useCallback(async () => {
    if (!shopId) return;
    setLoading(true);
    try {
      let query = supabase
        .from('lots')
        .select(`
          id,
          category_id,
          size_id,
          free_text_size,
          quantity,
          cost_price_per_unit,
          selling_price_default,
          tax_rate,
          vendor_name,
          sale_type,
          sale_reason,
          min_margin_percent,
          date_of_stock_arrival,
          created_at,
          categories ( id, name ),
          sizes ( size_name )
        `)
        .eq('shop_id', shopId)
        .order('date_of_stock_arrival', { ascending: false });

      if (startDateISO) query = query.gte('date_of_stock_arrival', startDateISO);
      if (dateFilter !== 'all') query = query.lte('date_of_stock_arrival', endDateISO);

      const { data: lots, error } = await query;
      if (error) throw error;
      if (!lots || lots.length === 0) { setDateGroups([]); return; }

      // Fetch all inventory items for these lots in a single call
      const lotIds = lots.map(l => l.id);
      const { data: items, error: itemsError } = await supabase
        .from('inventory_items')
        .select(`id, status, sold_at, created_at, qr_codes ( code, id )`)
        .in('lot_id', lotIds);
      if (itemsError) throw itemsError;

      // Group items by lot_id — we need lot_id from the original query
      // Re-fetch with lot_id to map items
      const { data: itemsWithLot } = await supabase
        .from('inventory_items')
        .select(`id, lot_id, status, sold_at, created_at, qr_codes ( code, id )`)
        .in('lot_id', lotIds);

      const itemsByLot = new Map<string, LotItem[]>();
      (itemsWithLot || []).forEach((item: any) => {
        const arr = itemsByLot.get(item.lot_id) || [];
        arr.push({
          id: item.id,
          status: item.status,
          sold_at: item.sold_at,
          created_at: item.created_at,
          qr_codes: item.qr_codes,
        });
        itemsByLot.set(item.lot_id, arr);
      });

      // Build lot entries with computed stats
      const lotEntries: LotEntry[] = lots.map((lot: any) => {
        const lotItems = itemsByLot.get(lot.id) || [];
        return {
          id: lot.id,
          category_id: lot.category_id,
          category_name: lot.categories?.name || 'Uncategorized',
          size_name: lot.sizes?.size_name || lot.free_text_size || '—',
          quantity: lot.quantity,
          cost_price_per_unit: lot.cost_price_per_unit,
          selling_price_default: lot.selling_price_default,
          tax_rate: lot.tax_rate,
          vendor_name: lot.vendor_name,
          sale_type: lot.sale_type,
          sale_reason: lot.sale_reason,
          min_margin_percent: lot.min_margin_percent,
          date_of_stock_arrival: lot.date_of_stock_arrival,
          free_text_size: lot.free_text_size,
          size_id: lot.size_id,
          created_at: lot.created_at,
          items: lotItems,
          availableCount: lotItems.filter(i => i.status === 'available').length,
          soldCount: lotItems.filter(i => i.status === 'sold').length,
          damagedCount: lotItems.filter(i => i.status === 'damaged').length,
        };
      });

      // Group by date_of_stock_arrival
      const groupMap = new Map<string, LotEntry[]>();
      lotEntries.forEach(lot => {
        const dateKey = lot.date_of_stock_arrival;
        const arr = groupMap.get(dateKey) || [];
        arr.push(lot);
        groupMap.set(dateKey, arr);
      });

      const groups: DateGroup[] = Array.from(groupMap.entries())
        .sort(([a], [b]) => b.localeCompare(a))
        .map(([date, lotsInDate]) => ({
          date,
          displayDate: formatDate(date),
          lots: lotsInDate,
          totalItems: lotsInDate.reduce((sum, l) => sum + l.items.length, 0),
        }));

      setDateGroups(groups);
    } catch (err) {
      console.error('Lots history fetch error:', err);
      toast.error('Failed to load lots history');
    } finally {
      setLoading(false);
    }
  }, [shopId, dateFilter, startDateISO, endDateISO]);

  useEffect(() => {
    if (open) {
      fetchLotsHistory();
      fetchReferenceData();
    }
  }, [open, fetchLotsHistory, fetchReferenceData]);

  // ── Toggle tree nodes ────────────────────────────────────────────────────

  const toggleDate = (date: string) => {
    setExpandedDates(prev => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  };

  const toggleLot = (lotId: string) => {
    setExpandedLots(prev => {
      const next = new Set(prev);
      if (next.has(lotId)) next.delete(lotId);
      else next.add(lotId);
      return next;
    });
  };

  // ── Summary stats ────────────────────────────────────────────────────────

  const summary = useMemo(() => {
    let totalLots = 0, totalItems = 0, totalAvailable = 0, totalSold = 0;
    dateGroups.forEach(g => {
      totalLots += g.lots.length;
      g.lots.forEach(l => {
        totalItems += l.items.length;
        totalAvailable += l.availableCount;
        totalSold += l.soldCount;
      });
    });
    return { totalLots, totalItems, totalAvailable, totalSold, totalDates: dateGroups.length };
  }, [dateGroups]);

  // ── Export ───────────────────────────────────────────────────────────────

  const handleExport = () => {
    if (dateGroups.length === 0) { toast.warning('No data to export'); return; }
    const rows: Record<string, unknown>[] = [];
    dateGroups.forEach(g => {
      g.lots.forEach(l => {
        rows.push({
          'Arrival Date': g.displayDate,
          Category: l.category_name,
          Size: l.size_name,
          Quantity: l.quantity,
          'Available': l.availableCount,
          'Sold': l.soldCount,
          'Damaged': l.damagedCount,
          'Cost Price': l.cost_price_per_unit,
          'Selling Price': l.selling_price_default,
          'Tax Rate': `${l.tax_rate}%`,
          Vendor: l.vendor_name || '—',
          'Sale Type': l.sale_type || 'Normal',
        });
      });
    });
    exportToCSV(rows, { filename: 'lots-history' });
    toast.success(`Exported ${rows.length} lots`);
  };

  // ── Edit callbacks ───────────────────────────────────────────────────────

  const handleLotUpdated = () => {
    fetchLotsHistory();
    onDataChanged?.();
  };

  const handleItemUpdated = () => {
    fetchLotsHistory();
    onDataChanged?.();
  };

  // ── Status badge helper ──────────────────────────────────────────────────

  const statusBadge = (status: string) => {
    const map: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
      available: { variant: 'default', label: 'Available' },
      sold: { variant: 'secondary', label: 'Sold' },
      damaged: { variant: 'destructive', label: 'Damaged' },
    };
    const cfg = map[status] || { variant: 'outline' as const, label: status };
    return <Badge variant={cfg.variant} className="text-[10px] capitalize">{cfg.label}</Badge>;
  };

  // ── Sale type badge ──────────────────────────────────────────────────────

  const saleTypeBadge = (saleType: string | null) => {
    if (!saleType) return null;
    const map: Record<string, { className: string; label: string }> = {
      festival: { className: 'bg-green-100 text-green-700 border-green-400', label: 'Festival' },
      promotion: { className: 'bg-blue-100 text-blue-700 border-blue-400', label: 'Promotion' },
      clearance: { className: 'bg-red-100 text-red-700 border-red-400', label: 'Clearance' },
    };
    const cfg = map[saleType] || { className: '', label: saleType };
    return <Badge variant="outline" className={`text-[10px] font-semibold ${cfg.className}`}>{cfg.label}</Badge>;
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-[calc(100%-2.5rem)] sm:max-w-lg flex flex-col p-0 gap-0 rounded-l-xl sm:rounded-none">
          {/* ── Header ── */}
          <SheetHeader className="px-5 pt-5 pb-3 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className={`p-2 rounded-lg ${s.headerIconGradient} text-white shadow-sm`}>
                <History className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <SheetTitle className="text-base">Lots History</SheetTitle>
                <SheetDescription className="text-xs">
                  Stock arrival timeline — view and edit lots &amp; items
                </SheetDescription>
              </div>
              {!loading && dateGroups.length > 0 && (
                <Badge variant="secondary" className="shrink-0 text-xs tabular-nums">
                  {summary.totalLots} lots
                </Badge>
              )}
            </div>
          </SheetHeader>

          <Separator />

          {/* ── Filters ── */}
          <div className="px-5 py-3 shrink-0 space-y-2 border-b bg-muted/30">
            <DateRangeFilter
              value={dateFilter}
              onChange={setDateFilter}
              customRange={customRange}
              onCustomRangeChange={setCustomRange}
            />
          </div>

          {/* ── Summary strip ── */}
          {!loading && dateGroups.length > 0 && (
            <div className="px-5 py-2.5 shrink-0 border-b">
              <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-muted/50 border">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Total</p>
                  <p className="text-lg font-bold tabular-nums">{summary.totalItems}</p>
                </div>
                <div className="flex gap-4 text-center">
                  <div>
                    <p className="text-[10px] text-muted-foreground">Available</p>
                    <p className={`text-sm font-bold ${s.statsActive.available.text}`}>{summary.totalAvailable}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground">Sold</p>
                    <p className={`text-sm font-bold ${s.statsActive.sold.text}`}>{summary.totalSold}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground">Dates</p>
                    <p className="text-sm font-bold tabular-nums">{summary.totalDates}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Scrollable body — tree view ── */}
          <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">Loading lots history…</p>
              </div>
            ) : dateGroups.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
                <div className="rounded-full bg-muted p-4">
                  <Package className="h-8 w-8 text-muted-foreground/50" />
                </div>
                <p className="font-medium text-sm">No lots found</p>
                <p className="text-xs text-muted-foreground max-w-[220px]">
                  Add stock lots from the inventory page to see history here
                </p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {dateGroups.map((group, groupIdx) => {
                  const isDateExpanded = expandedDates.has(group.date);
                  return (
                    <div
                      key={group.date}
                      className="rounded-lg border overflow-hidden transition-all"
                      style={{ animationDelay: `${groupIdx * 30}ms` }}
                    >
                      {/* ── Level 1: Date row ── */}
                      <button
                        onClick={() => toggleDate(group.date)}
                        className={`w-full flex items-center gap-2.5 px-3.5 py-3 text-left transition-all ${s.btnAnimationSubtle} ${
                          isDateExpanded
                            ? `${s.statsActive.total.bg} ${s.statsActive.total.border} border-l-4`
                            : 'hover:bg-muted/50'
                        }`}
                      >
                        <div className="shrink-0">
                          {isDateExpanded
                            ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            : <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          }
                        </div>
                        <Calendar className={`h-4 w-4 shrink-0 ${isDateExpanded ? s.linkColor : 'text-muted-foreground'}`} />
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-semibold ${isDateExpanded ? s.linkColor : ''}`}>
                            {group.displayDate}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge variant="secondary" className="text-[10px] tabular-nums">
                            {group.lots.length} {group.lots.length === 1 ? 'lot' : 'lots'}
                          </Badge>
                          <Badge variant="outline" className="text-[10px] tabular-nums">
                            {group.totalItems} items
                          </Badge>
                        </div>
                      </button>

                      {/* ── Level 2: Lots under this date ── */}
                      {isDateExpanded && (
                        <div className="border-t bg-background">
                          {group.lots.map((lot, lotIdx) => {
                            const isLotExpanded = expandedLots.has(lot.id);
                            const margin = lot.cost_price_per_unit > 0
                              ? (((lot.selling_price_default - lot.cost_price_per_unit) / lot.cost_price_per_unit) * 100).toFixed(1)
                              : '0';
                            return (
                              <div
                                key={lot.id}
                                className="border-b last:border-b-0"
                                style={{ animationDelay: `${lotIdx * 20}ms` }}
                              >
                                {/* Lot header row */}
                                <div className="flex items-center">
                                  <button
                                    onClick={() => toggleLot(lot.id)}
                                    className={`flex-1 flex items-center gap-2 pl-8 pr-3 py-2.5 text-left transition-all hover:bg-muted/30 ${
                                      isLotExpanded ? 'bg-muted/20' : ''
                                    }`}
                                  >
                                    <div className="shrink-0">
                                      {isLotExpanded
                                        ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                                        : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                                      }
                                    </div>
                                    <Tag className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className="text-sm font-medium truncate">{lot.category_name}</span>
                                        <span className="text-[10px] text-muted-foreground">·</span>
                                        <span className="text-xs text-muted-foreground">{lot.size_name}</span>
                                        {saleTypeBadge(lot.sale_type)}
                                      </div>
                                      <div className="flex items-center gap-3 mt-0.5 text-[10px] text-muted-foreground tabular-nums">
                                        <span>{formatCurrency(lot.selling_price_default)}</span>
                                        <span className="text-green-600">{lot.availableCount} avail</span>
                                        {lot.soldCount > 0 && <span className="text-blue-600">{lot.soldCount} sold</span>}
                                      </div>
                                    </div>
                                    <Badge variant="secondary" className="text-[10px] tabular-nums shrink-0">
                                      ×{lot.items.length}
                                    </Badge>
                                  </button>

                                  {/* Edit lot button — always visible */}
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 shrink-0 mr-2 hover:text-brand-600"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setEditingLot(lot);
                                    }}
                                    title="Edit entire lot"
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </Button>
                                </div>

                                {/* ── Level 3: Items under this lot ── */}
                                {isLotExpanded && (
                                  <div className="border-t bg-muted/10">
                                    {lot.items.length === 0 ? (
                                      <p className="pl-14 pr-3 py-3 text-xs text-muted-foreground italic">
                                        No items linked to this lot
                                      </p>
                                    ) : (
                                      lot.items.map((item, itemIdx) => (
                                        <div
                                          key={item.id}
                                          className={`flex items-center pl-14 pr-3 py-2 border-b last:border-b-0 transition-all hover:bg-muted/30 ${
                                            item.status === 'sold' ? 'opacity-60' : ''
                                          }`}
                                          style={{ animationDelay: `${itemIdx * 15}ms` }}
                                        >
                                          <div className="flex-1 min-w-0 flex items-center gap-2">
                                            <span className="font-mono text-xs font-semibold tracking-wide truncate">
                                              {item.qr_codes?.code || '—'}
                                            </span>
                                            {statusBadge(item.status)}
                                          </div>
                                          <div className="flex items-center gap-1 shrink-0">
                                            {item.sold_at && (
                                              <span className="text-[10px] text-muted-foreground tabular-nums mr-1">
                                                Sold {formatDate(item.sold_at)}
                                              </span>
                                            )}
                                            {item.status === 'available' && (
                                              <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-7 w-7 hover:text-brand-600"
                                                onClick={() => {
                                                  setEditingItem(item);
                                                  setEditingItemLot(lot);
                                                }}
                                                title="Edit item"
                                              >
                                                <Pencil className="h-3 w-3" />
                                              </Button>
                                            )}
                                          </div>
                                        </div>
                                      ))
                                    )}

                                    {/* Lot mini-summary at bottom */}
                                    <div className="flex items-center justify-between pl-14 pr-3 py-2 bg-muted/20 border-t text-[10px] text-muted-foreground">
                                      <span>
                                        Cost: {formatCurrency(lot.cost_price_per_unit)} → Sell: {formatCurrency(lot.selling_price_default)}
                                        <span className="ml-1.5 font-semibold text-green-600">({margin}% margin)</span>
                                      </span>
                                      {lot.vendor_name && <span>Vendor: {lot.vendor_name}</span>}
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Footer ── */}
          <SheetFooter className="px-5 py-3 border-t shrink-0 flex-row gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchLotsHistory}
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
              disabled={loading || dateGroups.length === 0}
              className="flex-1"
            >
              <Download className="mr-1.5 h-3.5 w-3.5" />
              Export CSV
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* ── Edit Lot Dialog ── */}
      <EditLotDialog
        lot={editingLot}
        categories={categories}
        sizes={sizes}
        onClose={() => setEditingLot(null)}
        onSaved={handleLotUpdated}
      />

      {/* ── Edit Item Dialog ── */}
      <EditInventoryItemDialog
        item={editingItem}
        lot={editingItemLot}
        onClose={() => { setEditingItem(null); setEditingItemLot(null); }}
        onSaved={handleItemUpdated}
      />
    </>
  );
}
