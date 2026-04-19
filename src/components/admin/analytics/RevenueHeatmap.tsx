'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Grid3x3 } from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';
import { supabase } from '@/lib/supabase';
import { appConfig } from '@/lib/config/app.config';

const s = appConfig.styles;

// Day columns: Mon→Sun (display order)
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
// Map JS getDay() (0=Sun,1=Mon...6=Sat) → our day index (0=Mon...6=Sun)
const JS_TO_IDX = [6, 0, 1, 2, 3, 4, 5];

// 12 two-hour slots: 0→"12am", 1→"2am", ..., 11→"10pm"
const SLOT_LABELS = [
  '12am', '2am', '4am', '6am', '8am', '10am',
  '12pm', '2pm', '4pm', '6pm', '8pm', '10pm',
];

type Cell = { revenue: number; bills: number };

function buildGrid(rows: { created_at: string; total_amount: number }[]): Cell[][] {
  // grid[dayIdx][slotIdx]
  const grid: Cell[][] = Array.from({ length: 7 }, () =>
    Array.from({ length: 12 }, () => ({ revenue: 0, bills: 0 })),
  );
  for (const row of rows) {
    const d = new Date(row.created_at);
    const dayIdx = JS_TO_IDX[d.getDay()];
    const slotIdx = Math.floor(d.getHours() / 2);
    grid[dayIdx][slotIdx].revenue += row.total_amount || 0;
    grid[dayIdx][slotIdx].bills += 1;
  }
  return grid;
}

export interface RevenueHeatmapProps {
  shopId: string;
  startDate?: string | null;
  endDate?: string | null;
}

interface TooltipState {
  x: number;
  y: number;
  day: string;
  slot: string;
  revenue: number;
  bills: number;
}

export function RevenueHeatmap({ shopId, startDate, endDate }: RevenueHeatmapProps) {
  const [loading, setLoading] = useState(true);
  const [grid, setGrid] = useState<Cell[][]>([]);
  const [maxRevenue, setMaxRevenue] = useState(1);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (shopId) loadData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shopId, startDate, endDate]);

  const loadData = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('sales')
        .select('created_at, total_amount')
        .eq('shop_id', shopId);
      if (startDate) query = query.gte('created_at', startDate);
      if (endDate) query = query.lte('created_at', endDate);

      const { data, error } = await query;
      if (error) throw error;

      const g = buildGrid((data || []) as { created_at: string; total_amount: number }[]);
      const max = Math.max(...g.flat().map(c => c.revenue), 1);
      setGrid(g);
      setMaxRevenue(max);
    } catch (err) {
      console.error('RevenueHeatmap error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleMouseEnter = (
    e: React.MouseEvent<HTMLDivElement>,
    dayIdx: number,
    slotIdx: number,
    cell: Cell,
  ) => {
    if (cell.revenue === 0) { setTooltip(null); return; }
    const rect = e.currentTarget.getBoundingClientRect();
    const containerRect = containerRef.current?.getBoundingClientRect();
    if (!containerRect) return;
    setTooltip({
      x: rect.left - containerRect.left + rect.width / 2,
      y: rect.top - containerRect.top - 8,
      day: DAYS[dayIdx],
      slot: `${SLOT_LABELS[slotIdx]}–${SLOT_LABELS[slotIdx + 1] ?? '12am'}`,
      revenue: cell.revenue,
      bills: cell.bills,
    });
  };

  const hasData = grid.length > 0 && grid.some(row => row.some(c => c.revenue > 0));

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </CardHeader>
        <CardContent><Skeleton className="h-52 w-full" /></CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Grid3x3 className={`h-4 w-4 ${s.linkColor}`} />
          Revenue Heatmap
        </CardTitle>
        <CardDescription className="text-sm">
          When do customers visit? Darker = more revenue in that slot.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <div className="h-40 flex items-center justify-center text-muted-foreground text-sm">
            No data for the selected period
          </div>
        ) : (
          <div ref={containerRef} className="relative select-none overflow-x-auto">
            {/* Main grid */}
            <div className="min-w-[340px]">
              {/* Day-of-week header row */}
              <div className="flex mb-1">
                {/* left label spacer */}
                <div className="w-10 shrink-0" />
                {DAYS.map(day => (
                  <div
                    key={day}
                    className="flex-1 text-center text-[10px] font-semibold text-muted-foreground uppercase tracking-wide py-0.5"
                  >
                    {day}
                  </div>
                ))}
              </div>

              {/* Time slot rows */}
              {SLOT_LABELS.map((slotLabel, slotIdx) => (
                <div key={slotLabel} className="flex items-center mb-0.5">
                  {/* Time label */}
                  <div className="w-10 shrink-0 text-[10px] text-muted-foreground text-right pr-2 leading-none">
                    {slotLabel}
                  </div>
                  {/* Cells */}
                  {DAYS.map((_, dayIdx) => {
                    const cell = grid[dayIdx]?.[slotIdx] ?? { revenue: 0, bills: 0 };
                    const intensity = cell.revenue / maxRevenue;
                    const alpha = intensity > 0 ? Math.max(0.08, intensity * 0.88) : 0;
                    const bright = intensity > 0.55;
                    return (
                      <div
                        key={dayIdx}
                        className="flex-1 mx-0.5 h-7 rounded cursor-pointer transition-transform hover:scale-110 hover:z-10 relative"
                        style={{
                          backgroundColor:
                            alpha > 0
                              ? `rgba(16, 185, 129, ${alpha.toFixed(2)})`
                              : 'transparent',
                          border: alpha > 0 ? 'none' : '1px solid hsl(var(--border))',
                        }}
                        onMouseEnter={e => handleMouseEnter(e, dayIdx, slotIdx, cell)}
                        onMouseLeave={() => setTooltip(null)}
                      >
                        {/* Bill count badge on active cells */}
                        {cell.bills > 0 && (
                          <span
                            className={`absolute inset-0 flex items-center justify-center text-[9px] font-bold tabular-nums leading-none ${bright ? 'text-white' : 'text-emerald-800 dark:text-emerald-200'}`}
                          >
                            {cell.bills > 99 ? '99+' : cell.bills}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>

            {/* Tooltip */}
            {tooltip && (
              <div
                className="pointer-events-none absolute z-20 bg-popover text-popover-foreground border rounded-lg shadow-lg px-3 py-2 text-xs -translate-x-1/2 -translate-y-full"
                style={{ left: tooltip.x, top: tooltip.y }}
              >
                <p className="font-semibold mb-1">{tooltip.day} · {tooltip.slot}</p>
                <p className="tabular-nums text-emerald-600 dark:text-emerald-400 font-bold">
                  {formatCurrency(tooltip.revenue)}
                </p>
                <p className="text-muted-foreground">{tooltip.bills} bill{tooltip.bills !== 1 ? 's' : ''}</p>
              </div>
            )}

            {/* Legend */}
            <div className="flex items-center gap-2 mt-3 text-[10px] text-muted-foreground">
              <span>Less</span>
              <div className="flex gap-0.5">
                {[0.08, 0.22, 0.40, 0.60, 0.80].map(a => (
                  <div
                    key={a}
                    className="w-4 h-3 rounded-sm"
                    style={{ backgroundColor: `rgba(16, 185, 129, ${a})` }}
                  />
                ))}
              </div>
              <span>More</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
