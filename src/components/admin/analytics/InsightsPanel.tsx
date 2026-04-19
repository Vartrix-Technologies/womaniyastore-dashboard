'use client';

import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Clock, Users, Percent, Minus } from 'lucide-react';
import { subDays } from 'date-fns';
import { formatCurrency } from '@/lib/formatters';
import { supabase } from '@/lib/supabase';

interface Insight {
  id: string;
  icon: React.ElementType;
  iconColor: string;
  bgColor: string;
  borderColor: string;
  label: string;
  title: string;
  body: string;
  metric: string;
  metricColor: string;
}

export interface InsightsPanelProps {
  shopId: string;
}

const DAY_NAMES_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function InsightsPanel({ shopId }: InsightsPanelProps) {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (shopId) computeInsights();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shopId]);

  const computeInsights = async () => {
    setLoading(true);
    const now = new Date();

    const last7Start   = subDays(now, 7).toISOString();
    const prior7Start  = subDays(now, 14).toISOString();
    const prior7End    = subDays(now, 7).toISOString();
    const last30Start  = subDays(now, 30).toISOString();
    const last90Start  = subDays(now, 90).toISOString();
    const thisMonStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const lastMonStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
    const lastMonEnd   = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999).toISOString();

    try {
      const [
        last7Res,
        prior7Res,
        last30Res,
        last90Res,
        thisMonMarginRes,
        lastMonMarginRes,
      ] = await Promise.all([
        supabase.from('sales').select('total_amount').eq('shop_id', shopId).gte('created_at', last7Start),
        supabase.from('sales').select('total_amount').eq('shop_id', shopId).gte('created_at', prior7Start).lte('created_at', prior7End),
        supabase.from('sales').select('created_at, total_amount').eq('shop_id', shopId).gte('created_at', last30Start),
        supabase.from('sales').select('customer_name, created_at').eq('shop_id', shopId).gte('created_at', last90Start).not('customer_name', 'is', null),
        supabase.from('sale_items').select('final_price, cost_price').eq('shop_id', shopId).gte('created_at', thisMonStart).not('cost_price', 'is', null),
        supabase.from('sale_items').select('final_price, cost_price').eq('shop_id', shopId).gte('created_at', lastMonStart).lte('created_at', lastMonEnd).not('cost_price', 'is', null),
      ]);

      const results: Insight[] = [];

      // ── Insight 1: Revenue momentum ────────────────────────────────────────
      const last7Total  = (last7Res.data  || []).reduce((s, r: any) => s + (r.total_amount || 0), 0);
      const prior7Total = (prior7Res.data || []).reduce((s, r: any) => s + (r.total_amount || 0), 0);
      const revPct = prior7Total > 0 ? ((last7Total - prior7Total) / prior7Total) * 100 : null;

      const revPositive = revPct !== null && revPct >= 0;
      results.push({
        id: 'revenue',
        icon: revPct === null ? Minus : revPositive ? TrendingUp : TrendingDown,
        iconColor:  revPct === null ? 'text-blue-500'    : revPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400',
        bgColor:    revPct === null ? 'bg-blue-50 dark:bg-blue-950/30'    : revPositive ? 'bg-emerald-50 dark:bg-emerald-950/30' : 'bg-rose-50 dark:bg-rose-950/30',
        borderColor: revPct === null ? 'border-blue-200 dark:border-blue-800' : revPositive ? 'border-emerald-200 dark:border-emerald-800' : 'border-rose-200 dark:border-rose-800',
        label: '7-Day Revenue',
        title: revPct === null ? 'First week recording' : revPositive ? `Up ${revPct.toFixed(0)}% this week` : `Down ${Math.abs(revPct).toFixed(0)}% this week`,
        body: prior7Total > 0 ? `vs ${formatCurrency(prior7Total)} last week` : 'No prior data to compare',
        metric: formatCurrency(last7Total),
        metricColor: revPct === null ? '' : revPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400',
      });

      // ── Insight 2: Peak sales slot (last 30 days) ──────────────────────────
      const slotMap: Record<string, { revenue: number; bills: number }> = {};
      let total30 = 0;

      ;(last30Res.data || []).forEach((row: any) => {
        const d = new Date(row.created_at);
        const day = DAY_NAMES_SHORT[d.getDay()];
        const hourSlot = Math.floor(d.getHours() / 2) * 2;
        const key = `${day} ${hourSlot === 0 ? '12am' : hourSlot < 12 ? `${hourSlot}am` : hourSlot === 12 ? '12pm' : `${hourSlot - 12}pm`}–${(hourSlot + 2) === 12 ? '12pm' : (hourSlot + 2) < 12 ? `${hourSlot + 2}am` : `${(hourSlot + 2) - 12}pm`}`;
        if (!slotMap[key]) slotMap[key] = { revenue: 0, bills: 0 };
        slotMap[key].revenue += row.total_amount || 0;
        slotMap[key].bills += 1;
        total30 += row.total_amount || 0;
      });

      const peakEntry = Object.entries(slotMap).sort((a, b) => b[1].revenue - a[1].revenue)[0];
      if (peakEntry && total30 > 0) {
        const [peakLabel, peakData] = peakEntry;
        const peakPct = ((peakData.revenue / total30) * 100).toFixed(0);
        results.push({
          id: 'peak',
          icon: Clock,
          iconColor: 'text-amber-600 dark:text-amber-400',
          bgColor: 'bg-amber-50 dark:bg-amber-950/30',
          borderColor: 'border-amber-200 dark:border-amber-800',
          label: 'Peak Slot (30d)',
          title: peakLabel,
          body: `${peakPct}% of revenue · ${peakData.bills} bills`,
          metric: formatCurrency(peakData.revenue),
          metricColor: 'text-amber-600 dark:text-amber-400',
        });
      }

      // ── Insight 3: At-risk loyal customers ────────────────────────────────
      const customerDates: Record<string, string[]> = {};
      ;(last90Res.data || []).forEach((row: any) => {
        const name = (row.customer_name || '').trim();
        if (!name) return;
        if (!customerDates[name]) customerDates[name] = [];
        customerDates[name].push(row.created_at);
      });

      const cutoff = subDays(now, 30).toISOString();
      const atRisk = Object.entries(customerDates).filter(([, dates]) => {
        const sorted = [...dates].sort();
        return sorted.length >= 2 && sorted[sorted.length - 1] < cutoff;
      });
      const activeCount = Object.keys(customerDates).length;

      if (atRisk.length > 0) {
        results.push({
          id: 'atrisk',
          icon: Users,
          iconColor: 'text-orange-600 dark:text-orange-400',
          bgColor: 'bg-orange-50 dark:bg-orange-950/30',
          borderColor: 'border-orange-200 dark:border-orange-800',
          label: 'At-Risk Customers',
          title: `${atRisk.length} loyal customer${atRisk.length > 1 ? 's' : ''} gone quiet`,
          body: '2+ purchases, no visit in 30+ days',
          metric: String(atRisk.length),
          metricColor: 'text-orange-600 dark:text-orange-400',
        });
      } else if (activeCount > 0) {
        results.push({
          id: 'atrisk',
          icon: Users,
          iconColor: 'text-emerald-600 dark:text-emerald-400',
          bgColor: 'bg-emerald-50 dark:bg-emerald-950/30',
          borderColor: 'border-emerald-200 dark:border-emerald-800',
          label: 'Customer Retention',
          title: 'All regulars still active',
          body: `${activeCount} named customer${activeCount > 1 ? 's' : ''} in last 90 days`,
          metric: String(activeCount),
          metricColor: 'text-emerald-600 dark:text-emerald-400',
        });
      }

      // ── Insight 4: Gross margin health ───────────────────────────────────
      const calcMargin = (rows: any[]) => {
        let rev = 0, cost = 0;
        rows.forEach(r => { rev += r.final_price || 0; cost += r.cost_price || 0; });
        return rev > 0 ? ((rev - cost) / rev) * 100 : null;
      };

      const thisMargin = calcMargin(thisMonMarginRes.data || []);
      const lastMargin = calcMargin(lastMonMarginRes.data || []);

      if (thisMargin !== null) {
        const diff = lastMargin !== null ? thisMargin - lastMargin : null;
        const healthy = diff === null || diff >= -3;
        results.push({
          id: 'margin',
          icon: Percent,
          iconColor: healthy ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400',
          bgColor: healthy ? 'bg-emerald-50 dark:bg-emerald-950/30' : 'bg-rose-50 dark:bg-rose-950/30',
          borderColor: healthy ? 'border-emerald-200 dark:border-emerald-800' : 'border-rose-200 dark:border-rose-800',
          label: 'Gross Margin',
          title: diff !== null
            ? healthy
              ? `Margin stable at ${thisMargin.toFixed(1)}%`
              : `Margin fell ${Math.abs(diff).toFixed(1)}pp this month`
            : `This month: ${thisMargin.toFixed(1)}%`,
          body: lastMargin !== null
            ? `Last month ${lastMargin.toFixed(1)}% → this month ${thisMargin.toFixed(1)}%`
            : 'Not enough prior month data yet',
          metric: `${thisMargin.toFixed(1)}%`,
          metricColor: healthy ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400',
        });
      }

      setInsights(results);
    } catch (err) {
      console.error('InsightsPanel error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="rounded-lg border bg-card p-4 space-y-2 animate-pulse">
            <div className="h-3 w-20 bg-muted rounded" />
            <div className="h-6 w-28 bg-muted rounded" />
            <div className="h-3 w-full bg-muted rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (insights.length === 0) return null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {insights.map(insight => {
        const Icon = insight.icon;
        return (
          <div
            key={insight.id}
            className={`rounded-xl border p-4 space-y-2 ${insight.bgColor} ${insight.borderColor}`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                {insight.label}
              </span>
              <Icon className={`h-4 w-4 shrink-0 ${insight.iconColor}`} />
            </div>
            <div className={`text-xl font-bold tabular-nums ${insight.metricColor}`}>
              {insight.metric}
            </div>
            <div>
              <p className="text-sm font-semibold leading-snug">{insight.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{insight.body}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
