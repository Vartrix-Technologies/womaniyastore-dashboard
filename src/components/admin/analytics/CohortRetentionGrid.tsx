'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Users2, AlertCircle } from 'lucide-react';
import { format, subMonths, startOfMonth } from 'date-fns';
import { supabase } from '@/lib/supabase';
import { appConfig } from '@/lib/config/app.config';

const s = appConfig.styles;

const MAX_OFFSET = 5; // show retention up to 5 months after cohort month
const MONTHS_HISTORY = 8; // look back 8 months to build cohorts

export interface CohortRetentionGridProps {
  shopId: string;
}

interface CohortRow {
  label: string; // "Jan '26"
  size: number; // # unique customers in this cohort
  retention: (number | null)[]; // [100%, m+1%, m+2%, ...] null = future month
}

function retentionColor(pct: number | null, isBase: boolean): string {
  if (isBase) return 'bg-muted text-muted-foreground';
  if (pct === null) return 'bg-transparent';
  if (pct >= 40) return 'bg-emerald-500 text-white';
  if (pct >= 25) return 'bg-emerald-300 text-emerald-900';
  if (pct >= 10) return 'bg-amber-300 text-amber-900';
  return 'bg-rose-200 text-rose-800';
}

export function CohortRetentionGrid({ shopId }: CohortRetentionGridProps) {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<CohortRow[]>([]);
  const [hasData, setHasData] = useState(true);

  useEffect(() => {
    if (shopId) loadData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shopId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const historyStart = startOfMonth(subMonths(new Date(), MONTHS_HISTORY)).toISOString();

      const { data, error } = await supabase
        .from('sales')
        .select('customer_name, created_at')
        .eq('shop_id', shopId)
        .gte('created_at', historyStart)
        .not('customer_name', 'is', null);

      if (error) throw error;

      // Build: customer → sorted list of "YYYY-MM" month strings they purchased
      const customerMonths: Record<string, Set<string>> = {};
      ;(data || []).forEach((row: any) => {
        const name = (row.customer_name as string).trim().toLowerCase();
        if (!name) return;
        const monthKey = format(new Date(row.created_at), 'yyyy-MM');
        if (!customerMonths[name]) customerMonths[name] = new Set();
        customerMonths[name].add(monthKey);
      });

      if (Object.keys(customerMonths).length < 3) {
        setHasData(false);
        return;
      }

      // For each customer, find their FIRST purchase month within our window
      const cohortMap: Record<string, Set<string>> = {}; // cohortMonth → set of customer names

      Object.entries(customerMonths).forEach(([name, months]) => {
        const sorted = [...months].sort();
        const firstMonth = sorted[0];
        if (!cohortMap[firstMonth]) cohortMap[firstMonth] = new Set();
        cohortMap[firstMonth].add(name);
      });

      // Build ordered cohort months (last MONTHS_HISTORY months minus the last MAX_OFFSET slots for data completeness)
      const now = new Date();
      const cohortLabels: string[] = [];
      for (let i = MONTHS_HISTORY - 1; i >= 0; i--) {
        cohortLabels.push(format(subMonths(now, i), 'yyyy-MM'));
      }

      const cohortRows: CohortRow[] = [];

      cohortLabels.forEach(cohortMonthKey => {
        const cohort = cohortMap[cohortMonthKey];
        if (!cohort || cohort.size === 0) return;

        const cohortDate = new Date(`${cohortMonthKey}-01`);
        const retention: (number | null)[] = [];

        for (let offset = 0; offset <= MAX_OFFSET; offset++) {
          // Month we're checking
          const checkMonth = format(
            new Date(cohortDate.getFullYear(), cohortDate.getMonth() + offset, 1),
            'yyyy-MM',
          );

          // Is this month in the future?
          const checkDate = new Date(`${checkMonth}-01`);
          if (checkDate > now) {
            retention.push(null);
            continue;
          }

          if (offset === 0) {
            retention.push(100); // by definition, all in cohort bought in cohort month
            continue;
          }

          const returned = [...cohort].filter(name =>
            customerMonths[name]?.has(checkMonth),
          ).length;
          retention.push(Math.round((returned / cohort.size) * 100));
        }

        cohortRows.push({
          label: format(cohortDate, "MMM ''yy"),
          size: cohort.size,
          retention,
        });
      });

      // Only show cohorts that have at least some data beyond offset 0
      setRows(cohortRows.filter(r => r.size >= 1));
      setHasData(cohortRows.length > 0);
    } catch (err) {
      console.error('CohortRetentionGrid error:', err);
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

  const offsetHeaders = Array.from({ length: MAX_OFFSET + 1 }, (_, i) =>
    i === 0 ? 'M+0' : `M+${i}`,
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Users2 className={`h-4 w-4 ${s.linkColor}`} />
          Customer Cohort Retention
        </CardTitle>
        <CardDescription className="text-sm">
          % of new customers who returned in subsequent months
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
            <AlertCircle className="h-8 w-8 text-muted-foreground/40" />
            <div>
              <p className="text-sm font-medium text-muted-foreground">Not enough customer data yet</p>
              <p className="text-xs text-muted-foreground/70 mt-1 max-w-xs">
                Cohort analysis needs at least 3 named customers with repeat visits.
                Collect customer names at checkout to enable this.
              </p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-1 px-1">
            <table className="w-full min-w-[420px] text-xs">
              <thead>
                <tr>
                  <th className="text-left font-semibold text-muted-foreground py-1.5 pr-3 whitespace-nowrap">
                    Cohort
                  </th>
                  <th className="text-right font-semibold text-muted-foreground py-1.5 pr-3 whitespace-nowrap">
                    Size
                  </th>
                  {offsetHeaders.map(h => (
                    <th key={h} className="text-center font-semibold text-muted-foreground py-1.5 px-1 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(row => (
                  <tr key={row.label} className="border-t">
                    <td className="py-1.5 pr-3 font-medium whitespace-nowrap">{row.label}</td>
                    <td className="py-1.5 pr-3 text-right tabular-nums text-muted-foreground">{row.size}</td>
                    {row.retention.map((pct, offset) => (
                      <td key={offset} className="py-1 px-1 text-center">
                        {pct === null ? (
                          <span className="text-muted-foreground/30">—</span>
                        ) : (
                          <span
                            className={`inline-block rounded px-1.5 py-0.5 tabular-nums font-semibold min-w-[36px] text-center ${retentionColor(pct, offset === 0)}`}
                          >
                            {pct}%
                          </span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Legend */}
            <div className="flex items-center gap-3 mt-4 flex-wrap text-[10px] text-muted-foreground border-t pt-3">
              <span className="font-medium">Retention:</span>
              {[
                { color: 'bg-emerald-500', label: '≥40%' },
                { color: 'bg-emerald-300', label: '25–39%' },
                { color: 'bg-amber-300',   label: '10–24%' },
                { color: 'bg-rose-200',    label: '<10%' },
              ].map(item => (
                <span key={item.label} className="flex items-center gap-1">
                  <span className={`w-3 h-3 rounded-sm ${item.color}`} />
                  {item.label}
                </span>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
