'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { CreditCard, Banknote, Smartphone, Wallet } from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';
import { supabase } from '@/lib/supabase';
import { appConfig } from '@/lib/config/app.config';

const s = appConfig.styles;

interface PaymentMethodData {
  method: string;
  count: number;
  revenue: number;
  percentage: number;
}

export interface PaymentMethodBreakdownProps {
  shopId: string;
  startDate?: string | null;
  endDate?: string | null;
}

const METHOD_CONFIG: Record<string, {
  label: string;
  icon: React.ElementType;
  textColor: string;
  bgColor: string;
  barColor: string;
}> = {
  cash: {
    label: 'Cash',
    icon: Banknote,
    textColor: 'text-emerald-600 dark:text-emerald-400',
    bgColor: 'bg-emerald-100 dark:bg-emerald-900/30',
    barColor: 'bg-emerald-500',
  },
  upi: {
    label: 'UPI',
    icon: Smartphone,
    textColor: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-100 dark:bg-blue-900/30',
    barColor: 'bg-blue-500',
  },
  card: {
    label: 'Card',
    icon: CreditCard,
    textColor: 'text-purple-600 dark:text-purple-400',
    bgColor: 'bg-purple-100 dark:bg-purple-900/30',
    barColor: 'bg-purple-500',
  },
  other: {
    label: 'Other',
    icon: Wallet,
    textColor: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-100 dark:bg-amber-900/30',
    barColor: 'bg-amber-500',
  },
};

const KNOWN_METHODS = ['cash', 'upi', 'card'] as const;

function normaliseMethod(raw: string | null): string {
  const lower = (raw || 'other').toLowerCase().trim();
  return (KNOWN_METHODS as readonly string[]).includes(lower) ? lower : 'other';
}

export function PaymentMethodBreakdown({ shopId, startDate, endDate }: PaymentMethodBreakdownProps) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<PaymentMethodData[]>([]);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [totalBills, setTotalBills] = useState(0);

  useEffect(() => {
    if (shopId) loadData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shopId, startDate, endDate]);

  const loadData = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('sales')
        .select('payment_method, total_amount')
        .eq('shop_id', shopId);

      if (startDate) query = query.gte('created_at', startDate);
      if (endDate) query = query.lte('created_at', endDate);

      const { data: rows, error } = await query;
      if (error) throw error;

      const methodMap: Record<string, { count: number; revenue: number }> = {};
      let total = 0;

      (rows || []).forEach((row: { payment_method: string | null; total_amount: number }) => {
        const method = normaliseMethod(row.payment_method);
        if (!methodMap[method]) methodMap[method] = { count: 0, revenue: 0 };
        methodMap[method].count += 1;
        methodMap[method].revenue += row.total_amount || 0;
        total += row.total_amount || 0;
      });

      const result: PaymentMethodData[] = Object.entries(methodMap)
        .map(([method, d]) => ({
          method,
          count: d.count,
          revenue: d.revenue,
          percentage: total > 0 ? (d.revenue / total) * 100 : 0,
        }))
        .sort((a, b) => b.revenue - a.revenue);

      setData(result);
      setTotalRevenue(total);
      setTotalBills(result.reduce((s, r) => s + r.count, 0));
    } catch (error) {
      console.error('Error loading payment methods:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-56 mt-2" />
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-14 w-full" />)}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <CreditCard className={`h-4 w-4 ${s.linkColor}`} />
          Payment Methods
        </CardTitle>
        <CardDescription className="text-sm">
          Revenue split by how customers paid
        </CardDescription>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            No payment data for the selected period
          </div>
        ) : (
          <div className="space-y-4">
            {data.map(item => {
              const config = METHOD_CONFIG[item.method] ?? METHOD_CONFIG.other;
              const Icon = config.icon;
              return (
                <div key={item.method} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className={`p-1.5 rounded-md ${config.bgColor}`}>
                        <Icon className={`h-3.5 w-3.5 ${config.textColor}`} />
                      </div>
                      <span className="font-medium">{config.label}</span>
                      <span className="text-muted-foreground text-xs">{item.count} bills</span>
                    </div>
                    <div className="text-right">
                      <span className="font-semibold tabular-nums">{formatCurrency(item.revenue)}</span>
                      <span className="text-muted-foreground text-xs ml-1.5">
                        {item.percentage.toFixed(0)}%
                      </span>
                    </div>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${config.barColor}`}
                      style={{ width: `${item.percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}

            {/* Footer totals */}
            <div className="pt-2 border-t flex items-center justify-between text-xs text-muted-foreground">
              <span>{totalBills} bills total</span>
              <span className="font-semibold text-foreground tabular-nums">
                {formatCurrency(totalRevenue)}
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
