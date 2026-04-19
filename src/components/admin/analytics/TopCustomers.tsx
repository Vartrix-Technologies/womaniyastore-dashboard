'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Users, Crown, Phone } from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';
import { supabase } from '@/lib/supabase';
import { appConfig } from '@/lib/config/app.config';

const s = appConfig.styles;

interface CustomerData {
  name: string;
  phone: string | null;
  visits: number;
  totalSpend: number;
  avgPerVisit: number;
}

export interface TopCustomersProps {
  shopId: string;
  startDate?: string | null;
  endDate?: string | null;
  limit?: number;
}

export function TopCustomers({ shopId, startDate, endDate, limit = 8 }: TopCustomersProps) {
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState<CustomerData[]>([]);
  const [walkInRevenue, setWalkInRevenue] = useState(0);
  const [walkInCount, setWalkInCount] = useState(0);

  useEffect(() => {
    if (shopId) loadData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shopId, startDate, endDate]);

  const loadData = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('sales')
        .select('customer_name, customer_phone, total_amount')
        .eq('shop_id', shopId);

      if (startDate) query = query.gte('created_at', startDate);
      if (endDate) query = query.lte('created_at', endDate);

      const { data: rows, error } = await query;
      if (error) throw error;

      const customerMap: Record<string, CustomerData> = {};
      let wiRevenue = 0;
      let wiCount = 0;

      (rows || []).forEach((row: { customer_name: string | null; customer_phone: string | null; total_amount: number }) => {
        if (!row.customer_name || !row.customer_name.trim()) {
          wiRevenue += row.total_amount || 0;
          wiCount += 1;
          return;
        }
        const key = row.customer_name.trim().toLowerCase();
        if (!customerMap[key]) {
          customerMap[key] = {
            name: row.customer_name.trim(),
            phone: row.customer_phone ?? null,
            visits: 0,
            totalSpend: 0,
            avgPerVisit: 0,
          };
        }
        customerMap[key].visits += 1;
        customerMap[key].totalSpend += row.total_amount || 0;
        // Keep most recent phone number if multiple
        if (row.customer_phone) {
          customerMap[key].phone = row.customer_phone;
        }
      });

      const result = Object.values(customerMap)
        .map(c => ({ ...c, avgPerVisit: c.visits > 0 ? c.totalSpend / c.visits : 0 }))
        .sort((a, b) => b.totalSpend - a.totalSpend)
        .slice(0, limit);

      setCustomers(result);
      setWalkInRevenue(wiRevenue);
      setWalkInCount(wiCount);
    } catch (error) {
      console.error('Error loading top customers:', error);
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
        <CardContent className="space-y-3">
          {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-12 w-full" />)}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Users className={`h-4 w-4 ${s.linkColor}`} />
          Top Customers
        </CardTitle>
        <CardDescription className="text-sm">
          Highest spenders in this period
        </CardDescription>
      </CardHeader>
      <CardContent>
        {customers.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm space-y-1">
            <p>No named customers yet</p>
            <p className="text-xs">Add customer names at checkout to track repeat buyers</p>
          </div>
        ) : (
          <div className="space-y-0 divide-y">
            {customers.map((customer, index) => (
              <div
                key={customer.name}
                className="py-2.5 first:pt-0 last:pb-0 flex items-center gap-3"
              >
                {/* Rank badge */}
                <div className="flex items-center justify-center w-7 h-7 rounded-full bg-muted shrink-0">
                  {index === 0 ? (
                    <Crown className="h-3.5 w-3.5 text-amber-500" />
                  ) : (
                    <span className="text-xs font-bold text-muted-foreground">#{index + 1}</span>
                  )}
                </div>

                {/* Name + phone */}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{customer.name}</div>
                  {customer.phone && (
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      <Phone className="h-2.5 w-2.5" />
                      {customer.phone}
                    </div>
                  )}
                </div>

                {/* Stats */}
                <div className="text-right shrink-0">
                  <div className="text-sm font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(customer.totalSpend)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {customer.visits} visit{customer.visits !== 1 ? 's' : ''}
                    {' · '}
                    {formatCurrency(customer.avgPerVisit)} avg
                  </div>
                </div>
              </div>
            ))}

            {/* Walk-in summary row */}
            {walkInCount > 0 && (
              <div className="py-2.5 flex items-center gap-3 opacity-60">
                <div className="flex items-center justify-center w-7 h-7 rounded-full bg-muted shrink-0">
                  <Users className="h-3 w-3 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0 text-sm text-muted-foreground">
                  Walk-in customers
                </div>
                <div className="text-right shrink-0">
                  <div className="text-sm tabular-nums text-muted-foreground">
                    {formatCurrency(walkInRevenue)}
                  </div>
                  <div className="text-xs text-muted-foreground">{walkInCount} bills</div>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
