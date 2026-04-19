'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { TrendingUp, TrendingDown, Minus, BarChart2 } from 'lucide-react';
import {
  format,
  subDays,
  subMonths,
  addDays,
  getDaysInMonth,
  differenceInDays,
} from 'date-fns';
import { formatCurrency } from '@/lib/formatters';
import { supabase } from '@/lib/supabase';
import { appConfig } from '@/lib/config/app.config';
import type { DateFilterType } from '@/lib/utils';

const s = appConfig.styles;

interface SaleRow {
  created_at: string;
  total_amount: number;
}

interface ChartPoint {
  label: string;
  current: number;
  prior: number;
  currentBills: number;
  priorBills: number;
}

export interface RevenueTrendChartProps {
  shopId: string;
  startDate?: string | null;
  endDate?: string | null;
  dateFilter: DateFilterType;
}

// --- Helper: compute the prior comparison period date range ---
function getComparisonRange(
  dateFilter: DateFilterType,
  startDateISO: string | null | undefined,
  endDateISO: string | null | undefined,
): { priorStart: string; priorEnd: string } {
  const now = new Date();

  if (dateFilter === 'today') {
    const yd = subDays(now, 1);
    return {
      priorStart: new Date(yd.getFullYear(), yd.getMonth(), yd.getDate(), 0, 0, 0).toISOString(),
      priorEnd: new Date(yd.getFullYear(), yd.getMonth(), yd.getDate(), 23, 59, 59, 999).toISOString(),
    };
  }

  if (dateFilter === 'week') {
    const d = now.getDay();
    const currentStart = startDateISO
      ? new Date(startDateISO)
      : new Date(now.getFullYear(), now.getMonth(), now.getDate() - (d === 0 ? 6 : d - 1));
    const priorStart = subDays(currentStart, 7);
    const priorEnd = new Date(currentStart.getFullYear(), currentStart.getMonth(), currentStart.getDate() - 1, 23, 59, 59, 999);
    return { priorStart: priorStart.toISOString(), priorEnd: priorEnd.toISOString() };
  }

  if (dateFilter === 'month') {
    const currentStart = startDateISO
      ? new Date(startDateISO)
      : new Date(now.getFullYear(), now.getMonth(), 1);
    const priorStart = subMonths(currentStart, 1);
    // Last day of prior month
    const priorEnd = new Date(currentStart.getFullYear(), currentStart.getMonth(), 0, 23, 59, 59, 999);
    return { priorStart: priorStart.toISOString(), priorEnd: priorEnd.toISOString() };
  }

  if (dateFilter === 'year') {
    const year = startDateISO ? new Date(startDateISO).getFullYear() : now.getFullYear();
    return {
      priorStart: new Date(year - 1, 0, 1).toISOString(),
      priorEnd: new Date(year - 1, 11, 31, 23, 59, 59, 999).toISOString(),
    };
  }

  // custom: shift backward by same duration
  if (startDateISO && endDateISO) {
    const start = new Date(startDateISO);
    const end = new Date(endDateISO);
    const durationDays = differenceInDays(end, start) + 1;
    const priorEnd = new Date(start.getFullYear(), start.getMonth(), start.getDate() - 1, 23, 59, 59, 999);
    const priorStart = subDays(start, durationDays);
    return { priorStart: priorStart.toISOString(), priorEnd: priorEnd.toISOString() };
  }

  return {
    priorStart: subDays(now, 14).toISOString(),
    priorEnd: subDays(now, 7).toISOString(),
  };
}

// --- Helper: map a sale's created_at to its X-axis bucket label ---
function getSaleLabel(
  createdAt: string,
  dateFilter: DateFilterType,
  startDateISO: string | null | undefined,
  endDateISO: string | null | undefined,
): string {
  const date = new Date(createdAt);
  switch (dateFilter) {
    case 'today':
      return format(date, 'ha'); // "9AM", "2PM"
    case 'week':
      return format(date, 'EEE'); // "Mon", "Tue"
    case 'month':
      return format(date, 'd'); // "1", "15"
    case 'year':
      return format(date, 'MMM'); // "Jan", "Feb"
    default: {
      // custom
      if (startDateISO && endDateISO) {
        const duration = differenceInDays(new Date(endDateISO), new Date(startDateISO));
        if (duration > 90) return format(date, 'MMM yyyy');
        if (duration > 31) {
          // Week bucket — Monday of that week
          const dow = date.getDay();
          const monday = subDays(date, dow === 0 ? 6 : dow - 1);
          return format(monday, 'MMM d');
        }
      }
      return format(date, 'MMM d');
    }
  }
}

// --- Helper: generate the canonical ordered list of X-axis labels for the current period ---
function generateLabels(
  dateFilter: DateFilterType,
  startDateISO: string | null | undefined,
  endDateISO: string | null | undefined,
): string[] {
  const now = new Date();

  switch (dateFilter) {
    case 'today':
      // 24 hours: "12AM", "1AM", ..., "11PM"
      return Array.from({ length: 24 }, (_, i) => format(new Date(2000, 0, 1, i), 'ha'));

    case 'week': {
      const d = now.getDay();
      const start = startDateISO
        ? new Date(startDateISO)
        : new Date(now.getFullYear(), now.getMonth(), now.getDate() - (d === 0 ? 6 : d - 1));
      return Array.from({ length: 7 }, (_, i) => format(addDays(start, i), 'EEE'));
    }

    case 'month': {
      const start = startDateISO
        ? new Date(startDateISO)
        : new Date(now.getFullYear(), now.getMonth(), 1);
      const days = getDaysInMonth(start);
      return Array.from({ length: days }, (_, i) => String(i + 1));
    }

    case 'year':
      return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    default: {
      if (!startDateISO || !endDateISO) return [];
      const start = new Date(startDateISO);
      const end = new Date(endDateISO);
      const duration = differenceInDays(end, start);

      if (duration <= 31) {
        return Array.from({ length: duration + 1 }, (_, i) => format(addDays(start, i), 'MMM d'));
      }
      if (duration <= 90) {
        // Weekly buckets — use Monday as bucket start
        const labels: string[] = [];
        const dow = start.getDay();
        let curr = subDays(start, dow === 0 ? 6 : dow - 1);
        while (curr <= end) {
          labels.push(format(curr, 'MMM d'));
          curr = addDays(curr, 7);
        }
        return labels;
      }
      // Monthly buckets
      const labels: string[] = [];
      let curr = new Date(start.getFullYear(), start.getMonth(), 1);
      while (curr <= end) {
        labels.push(format(curr, 'MMM yyyy'));
        curr = new Date(curr.getFullYear(), curr.getMonth() + 1, 1);
      }
      return labels;
    }
  }
}

// --- Helper: build the final chart data array with zeros filled for empty buckets ---
function buildChartData(
  currentSales: SaleRow[],
  priorSales: SaleRow[],
  dateFilter: DateFilterType,
  startDateISO: string | null | undefined,
  endDateISO: string | null | undefined,
): ChartPoint[] {
  const labels = generateLabels(dateFilter, startDateISO, endDateISO);

  const currentMap = new Map<string, { revenue: number; bills: number }>(
    labels.map(l => [l, { revenue: 0, bills: 0 }]),
  );
  const priorMap = new Map<string, { revenue: number; bills: number }>(
    labels.map(l => [l, { revenue: 0, bills: 0 }]),
  );

  for (const sale of currentSales) {
    const label = getSaleLabel(sale.created_at, dateFilter, startDateISO, endDateISO);
    const bucket = currentMap.get(label);
    if (bucket) {
      bucket.revenue += sale.total_amount || 0;
      bucket.bills += 1;
    }
  }

  for (const sale of priorSales) {
    const label = getSaleLabel(sale.created_at, dateFilter, startDateISO, endDateISO);
    const bucket = priorMap.get(label);
    if (bucket) {
      bucket.revenue += sale.total_amount || 0;
      bucket.bills += 1;
    }
  }

  return labels.map(label => ({
    label,
    current: currentMap.get(label)?.revenue ?? 0,
    prior: priorMap.get(label)?.revenue ?? 0,
    currentBills: currentMap.get(label)?.bills ?? 0,
    priorBills: priorMap.get(label)?.bills ?? 0,
  }));
}

function getPeriodLabels(dateFilter: DateFilterType): { current: string; prior: string } {
  switch (dateFilter) {
    case 'today':  return { current: 'Today',      prior: 'Yesterday'  };
    case 'week':   return { current: 'This Week',   prior: 'Last Week'  };
    case 'month':  return { current: 'This Month',  prior: 'Last Month' };
    case 'year':   return { current: 'This Year',   prior: 'Last Year'  };
    default:       return { current: 'This Period', prior: 'Prior Period' };
  }
}

// --- Custom Recharts tooltip ---
interface TooltipEntry {
  dataKey?: string | number;
  value?: number;
  color?: string;
  payload?: ChartPoint;
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: TooltipEntry[]; label?: string }) {
  if (!active || !payload || payload.length === 0) return null;

  const currentEntry = payload.find(p => p.dataKey === 'current');
  const priorEntry = payload.find(p => p.dataKey === 'prior');
  const point = (currentEntry?.payload ?? priorEntry?.payload) as ChartPoint | undefined;

  return (
    <div className="bg-popover text-popover-foreground border rounded-lg shadow-lg p-3 text-xs space-y-1.5 min-w-[170px]">
      <p className="font-semibold text-sm mb-1.5 border-b pb-1">{label}</p>
      {currentEntry && (
        <div className="flex items-center justify-between gap-4">
          <span className="text-emerald-600 dark:text-emerald-400 font-medium">This period</span>
          <div className="text-right">
            <div className="font-bold tabular-nums">{formatCurrency(currentEntry.value as number)}</div>
            <div className="text-muted-foreground">{point?.currentBills ?? 0} bill{(point?.currentBills ?? 0) !== 1 ? 's' : ''}</div>
          </div>
        </div>
      )}
      {priorEntry && (
        <div className="flex items-center justify-between gap-4">
          <span className="text-muted-foreground">Prior period</span>
          <div className="text-right">
            <div className="tabular-nums text-muted-foreground">{formatCurrency(priorEntry.value as number)}</div>
            <div className="text-muted-foreground">{point?.priorBills ?? 0} bill{(point?.priorBills ?? 0) !== 1 ? 's' : ''}</div>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Main component ---
export function RevenueTrendChart({ shopId, startDate, endDate, dateFilter }: RevenueTrendChartProps) {
  const [loading, setLoading] = useState(true);
  const [chartData, setChartData] = useState<ChartPoint[]>([]);
  const [totals, setTotals] = useState({ current: 0, prior: 0 });

  useEffect(() => {
    if (shopId) loadData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shopId, startDate, endDate, dateFilter]);

  const loadData = async () => {
    setLoading(true);
    try {
      const { priorStart, priorEnd } = getComparisonRange(dateFilter, startDate, endDate);

      let currentQuery = supabase
        .from('sales')
        .select('created_at, total_amount')
        .eq('shop_id', shopId);
      if (startDate) currentQuery = currentQuery.gte('created_at', startDate);
      if (endDate) currentQuery = currentQuery.lte('created_at', endDate);

      const priorQuery = supabase
        .from('sales')
        .select('created_at, total_amount')
        .eq('shop_id', shopId)
        .gte('created_at', priorStart)
        .lte('created_at', priorEnd);

      const [{ data: currentData }, { data: priorData }] = await Promise.all([
        currentQuery,
        priorQuery,
      ]);

      const current = (currentData || []) as SaleRow[];
      const prior = (priorData || []) as SaleRow[];

      setChartData(buildChartData(current, prior, dateFilter, startDate, endDate));
      setTotals({
        current: current.reduce((s, r) => s + (r.total_amount || 0), 0),
        prior: prior.reduce((s, r) => s + (r.total_amount || 0), 0),
      });
    } catch (error) {
      console.error('Error loading revenue trend:', error);
    } finally {
      setLoading(false);
    }
  };

  const { current: currentLabel, prior: priorLabel } = getPeriodLabels(dateFilter);
  const pctChange = totals.prior > 0 ? ((totals.current - totals.prior) / totals.prior) * 100 : null;
  const hasData = chartData.some(p => p.current > 0 || p.prior > 0);

  // For month view with many days, thin out X-axis labels
  const xTickFormatter = (label: string): string => {
    if (dateFilter === 'month' && chartData.length > 20) {
      const day = parseInt(label, 10);
      return day === 1 || day % 5 === 0 ? label : '';
    }
    if (dateFilter === 'today' && chartData.length >= 24) {
      const hour = parseInt(label, 10);
      return hour === 0 || hour % 3 === 0 ? label : '';
    }
    return label;
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <BarChart2 className={`h-4 w-4 ${s.linkColor}`} />
              Revenue Trend
            </CardTitle>
            <CardDescription className="text-sm mt-1">
              {currentLabel} vs {priorLabel}
            </CardDescription>
          </div>
          {pctChange !== null && (
            <div className={`flex items-center gap-1 text-sm font-semibold shrink-0 ${
              pctChange > 0  ? 'text-emerald-600 dark:text-emerald-400' :
              pctChange < 0  ? 'text-rose-600 dark:text-rose-400' :
                               'text-muted-foreground'
            }`}>
              {pctChange > 0 ? <TrendingUp className="h-4 w-4" /> :
               pctChange < 0 ? <TrendingDown className="h-4 w-4" /> :
                               <Minus className="h-4 w-4" />}
              {Math.abs(pctChange).toFixed(1)}% vs {priorLabel.toLowerCase()}
            </div>
          )}
        </div>

        {/* Summary totals */}
        <div className="flex items-center gap-6 mt-1 text-sm">
          <div>
            <span className="text-muted-foreground text-xs uppercase tracking-wide">{currentLabel}</span>
            <div className="font-bold text-emerald-600 dark:text-emerald-400 tabular-nums text-lg">
              {formatCurrency(totals.current)}
            </div>
          </div>
          <div>
            <span className="text-muted-foreground text-xs uppercase tracking-wide">{priorLabel}</span>
            <div className="font-semibold text-muted-foreground tabular-nums text-lg">
              {formatCurrency(totals.prior)}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {!hasData ? (
          <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
            No revenue data for this period
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={chartData} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="hsl(var(--border))"
                vertical={false}
              />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={xTickFormatter}
              />
              <YAxis
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) =>
                  v >= 100000 ? `${(v / 100000).toFixed(0)}L` :
                  v >= 1000   ? `${(v / 1000).toFixed(0)}k`  :
                  String(v)
                }
                width={40}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                formatter={(value: string) => value === 'current' ? currentLabel : priorLabel}
                wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
              />
              <Bar
                dataKey="current"
                name="current"
                fill="hsl(142.1 76.2% 36.3%)"
                radius={[3, 3, 0, 0]}
                maxBarSize={48}
                opacity={0.9}
              />
              <Line
                dataKey="prior"
                name="prior"
                stroke="hsl(var(--muted-foreground))"
                strokeWidth={2}
                strokeDasharray="5 4"
                dot={false}
                type="monotone"
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
