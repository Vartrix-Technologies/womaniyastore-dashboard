'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

import { TrendingUp, AlertCircle } from 'lucide-react';
import { format, subMonths, startOfMonth } from 'date-fns';
import { supabase } from '@/lib/supabase';
import { appConfig } from '@/lib/config/app.config';

const s = appConfig.styles;

// Colour palette for up to 8 category lines
const LINE_COLORS = [
  '#10b981', // emerald
  '#3b82f6', // blue
  '#f59e0b', // amber
  '#8b5cf6', // violet
  '#ef4444', // red
  '#06b6d4', // cyan
  '#ec4899', // pink
  '#84cc16', // lime
];

export interface MarginByCategoryChartProps {
  shopId: string;
  monthsBack?: number; // default 6
}

interface DataPoint {
  month: string; // "Jan '26"
  [category: string]: number | string;
}

interface TooltipEntry {
  name?: string;
  value?: number;
  color?: string;
}

function calcMargin(revenue: number, cost: number): number {
  return revenue > 0 ? ((revenue - cost) / revenue) * 100 : 0;
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: TooltipEntry[]; label?: string }) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="bg-popover text-popover-foreground border rounded-lg shadow-lg p-3 text-xs space-y-1 min-w-[160px]">
      <p className="font-semibold text-sm border-b pb-1 mb-1.5">{label}</p>
      {payload.map(entry => (
        <div key={entry.name} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
            <span className="truncate max-w-[90px]">{entry.name}</span>
          </span>
          <span className="font-bold tabular-nums" style={{ color: entry.color }}>
            {(entry.value as number).toFixed(1)}%
          </span>
        </div>
      ))}
    </div>
  );
}

export function MarginByCategoryChart({ shopId, monthsBack = 6 }: MarginByCategoryChartProps) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DataPoint[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [hasEnoughData, setHasEnoughData] = useState(true);

  useEffect(() => {
    if (shopId) loadData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shopId, monthsBack]);

  const loadData = async () => {
    setLoading(true);
    try {
      const start = startOfMonth(subMonths(new Date(), monthsBack - 1)).toISOString();

      const { data: rows, error } = await supabase
        .from('sale_items')
        .select('final_price, cost_price, category_name, created_at')
        .eq('shop_id', shopId)
        .gte('created_at', start)
        .not('cost_price', 'is', null)
        .not('category_name', 'is', null);

      if (error) throw error;

      if (!rows || rows.length < 5) {
        setHasEnoughData(false);
        return;
      }

      // Build month labels for last N months
      const monthLabels: string[] = [];
      for (let i = monthsBack - 1; i >= 0; i--) {
        monthLabels.push(format(subMonths(new Date(), i), "MMM ''yy"));
      }

      // Aggregate: month → category → { revenue, cost }
      type Bucket = { revenue: number; cost: number };
      const agg: Record<string, Record<string, Bucket>> = {};

      for (const label of monthLabels) {
        agg[label] = {};
      }

      const catSet = new Set<string>();

      ;(rows as any[]).forEach(row => {
        const monthLabel = format(new Date(row.created_at), "MMM ''yy");
        const cat = (row.category_name as string).trim();
        if (!agg[monthLabel]) return; // outside window
        if (!agg[monthLabel][cat]) agg[monthLabel][cat] = { revenue: 0, cost: 0 };
        agg[monthLabel][cat].revenue += row.final_price || 0;
        agg[monthLabel][cat].cost += row.cost_price || 0;
        catSet.add(cat);
      });

      // Keep top 8 categories by total revenue
      const catRevenue: Record<string, number> = {};
      catSet.forEach(cat => {
        catRevenue[cat] = Object.values(agg).reduce(
          (s, m) => s + (m[cat]?.revenue ?? 0), 0,
        );
      });
      const topCats = [...catSet]
        .sort((a, b) => catRevenue[b] - catRevenue[a])
        .slice(0, 8);

      const chartData: DataPoint[] = monthLabels.map(month => {
        const point: DataPoint = { month };
        topCats.forEach(cat => {
          const bucket = agg[month][cat];
          point[cat] = bucket ? parseFloat(calcMargin(bucket.revenue, bucket.cost).toFixed(1)) : 0;
        });
        return point;
      });

      setData(chartData);
      setCategories(topCats);
      setHasEnoughData(true);
    } catch (err) {
      console.error('MarginByCategoryChart error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </CardHeader>
        <CardContent><Skeleton className="h-56 w-full" /></CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <TrendingUp className={`h-4 w-4 ${s.linkColor}`} />
          Gross Margin by Category
        </CardTitle>
        <CardDescription className="text-sm">
          Are your margins holding? Last {monthsBack} months by category.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!hasEnoughData ? (
          <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
            <AlertCircle className="h-8 w-8 text-muted-foreground/40" />
            <div>
              <p className="text-sm font-medium text-muted-foreground">Not enough cost data yet</p>
              <p className="text-xs text-muted-foreground/70 mt-1 max-w-xs">
                Margin trends appear once items with cost prices have been sold.
                Add cost prices when stocking inventory.
              </p>
            </div>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) => `${v.toFixed(0)}%`}
                width={38}
                domain={[0, 'auto']}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
              {categories.map((cat, i) => (
                <Line
                  key={cat}
                  dataKey={cat}
                  stroke={LINE_COLORS[i % LINE_COLORS.length]}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                  type="monotone"
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
