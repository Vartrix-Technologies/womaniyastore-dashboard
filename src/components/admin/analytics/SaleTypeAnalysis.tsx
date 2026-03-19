'use client';

/**
 * Sale Type Analysis Component
 * 
 * Shows performance breakdown by sale type:
 * - Festival sales
 * - Clearance sales
 * - Promotion sales
 * - Regular sales
 * - Savings delivered to customers
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { appConfig } from '@/lib/config/app.config';

const s = appConfig.styles;
import { 
  Sparkles, 
  Tag, 
  Percent, 
  ShoppingBag,
  TrendingUp,
  Crown,
  ArrowRight,
  Users
} from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';
import { supabase } from '@/lib/supabase';

interface SaleTypeData {
  type: string;
  label: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  itemsSold: number;
  revenue: number;
  originalValue: number;
  savings: number;
  avgDiscount: number;
  reportPath: string | null;
}

interface SaleTypeAnalysisProps {
  shopId: string;
  startDate?: string | null;
  endDate?: string | null;
  dateFilter?: string; // Pass current date filter for back navigation
}

export function SaleTypeAnalysis({ shopId, startDate, endDate, dateFilter }: SaleTypeAnalysisProps) {
  const [loading, setLoading] = useState(true);
  const [saleTypeData, setSaleTypeData] = useState<SaleTypeData[]>([]);
  const [topCustomer, setTopCustomer] = useState<{ name: string; phone: string | null; orders: number; revenue: number } | null>(null);
  const [totals, setTotals] = useState({
    totalItems: 0,
    totalRevenue: 0,
    totalSavings: 0,
    saleItemsPercentage: 0,
  });

  useEffect(() => {
    if (shopId) {
      loadSaleTypeData();
    }
  }, [shopId, startDate, endDate]);

  const loadSaleTypeData = async () => {
    try {
      setLoading(true);

      // Query sale items with sale type info
      let query = supabase
        .from('sales')
        .select(`
          id,
          created_at,
          customer_name,
          customer_phone,
          total_amount,
          sale_items (
            id,
            original_price,
            final_price,
            sold_on_sale,
            sale_type
          )
        `)
        .eq('shop_id', shopId);

      if (startDate) {
        query = query.gte('created_at', startDate);
      }
      if (endDate) {
        query = query.lte('created_at', endDate);
      }

      const { data: salesData, error } = await query;

      if (error) throw error;

      // Initialize counters
      const typeMap: Record<string, { itemsSold: number; revenue: number; originalValue: number }> = {
        festival: { itemsSold: 0, revenue: 0, originalValue: 0 },
        clearance: { itemsSold: 0, revenue: 0, originalValue: 0 },
        promotion: { itemsSold: 0, revenue: 0, originalValue: 0 },
        regular: { itemsSold: 0, revenue: 0, originalValue: 0 },
      };

      // Aggregate by sale type
      const customerMap: Record<string, { orders: number; revenue: number; phone: string | null }> = {};

      salesData?.forEach((sale: any) => {
        // Track customer orders
        const customerName = sale.customer_name;
        if (customerName) {
          if (!customerMap[customerName]) {
            customerMap[customerName] = { orders: 0, revenue: 0, phone: null };
          }
          customerMap[customerName].orders += 1;
          customerMap[customerName].revenue += sale.total_amount || 0;
          if (sale.customer_phone) {
            customerMap[customerName].phone = sale.customer_phone;
          }
        }

        sale.sale_items?.forEach((item: any) => {
          const originalPrice = item.original_price || 0;
          const finalPrice = item.final_price || 0;
          
          if (item.sold_on_sale && item.sale_type) {
            const type = item.sale_type as string;
            if (typeMap[type]) {
              typeMap[type].itemsSold += 1;
              typeMap[type].revenue += finalPrice;
              typeMap[type].originalValue += originalPrice;
            }
          } else {
            typeMap.regular.itemsSold += 1;
            typeMap.regular.revenue += finalPrice;
            typeMap.regular.originalValue += originalPrice;
          }
        });
      });

      // Build display data
      const saleTypes: SaleTypeData[] = [
        {
          type: 'festival',
          label: 'Festival Sale',
          icon: <Sparkles className="h-4 w-4" />,
          color: 'text-emerald-600 dark:text-emerald-400',
          bgColor: 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800',
          reportPath: '/admin/reports/festival',
          ...typeMap.festival,
          savings: typeMap.festival.originalValue - typeMap.festival.revenue,
          avgDiscount: typeMap.festival.originalValue > 0 
            ? ((typeMap.festival.originalValue - typeMap.festival.revenue) / typeMap.festival.originalValue) * 100 
            : 0,
        },
        {
          type: 'clearance',
          label: 'Clearance Sale',
          icon: <Tag className="h-4 w-4" />,
          color: 'text-rose-600 dark:text-rose-400',
          bgColor: 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800',
          reportPath: '/admin/reports/clearance',
          ...typeMap.clearance,
          savings: typeMap.clearance.originalValue - typeMap.clearance.revenue,
          avgDiscount: typeMap.clearance.originalValue > 0 
            ? ((typeMap.clearance.originalValue - typeMap.clearance.revenue) / typeMap.clearance.originalValue) * 100 
            : 0,
        },
        {
          type: 'promotion',
          label: 'Promotion',
          icon: <Percent className="h-4 w-4" />,
          color: 'text-blue-600 dark:text-blue-400',
          bgColor: 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800',
          reportPath: '/admin/reports/promotion',
          ...typeMap.promotion,
          savings: typeMap.promotion.originalValue - typeMap.promotion.revenue,
          avgDiscount: typeMap.promotion.originalValue > 0 
            ? ((typeMap.promotion.originalValue - typeMap.promotion.revenue) / typeMap.promotion.originalValue) * 100 
            : 0,
        },
        {
          type: 'regular',
          label: 'Regular Price',
          icon: <ShoppingBag className="h-4 w-4" />,
          color: 'text-gray-600 dark:text-gray-400',
          bgColor: 'bg-gray-50 dark:bg-gray-900/30 border-gray-200 dark:border-gray-700',
          reportPath: null, // No report for regular sales
          ...typeMap.regular,
          savings: typeMap.regular.originalValue - typeMap.regular.revenue,
          avgDiscount: typeMap.regular.originalValue > 0 
            ? ((typeMap.regular.originalValue - typeMap.regular.revenue) / typeMap.regular.originalValue) * 100 
            : 0,
        },
      ].filter(t => t.itemsSold > 0);

      // Calculate totals
      const totalItems = saleTypes.reduce((sum, t) => sum + t.itemsSold, 0);
      const totalRevenue = saleTypes.reduce((sum, t) => sum + t.revenue, 0);
      const totalSavings = saleTypes.reduce((sum, t) => sum + t.savings, 0);
      const saleItems = saleTypes
        .filter(t => t.type !== 'regular')
        .reduce((sum, t) => sum + t.itemsSold, 0);

      setSaleTypeData(saleTypes);

      // Find top customer by order count
      const customerEntries = Object.entries(customerMap);
      if (customerEntries.length > 0) {
        const [topName, topData] = customerEntries.sort((a, b) => b[1].orders - a[1].orders)[0];
        setTopCustomer({ name: topName, phone: topData.phone, orders: topData.orders, revenue: topData.revenue });
      } else {
        setTopCustomer(null);
      }

      setTotals({
        totalItems,
        totalRevenue,
        totalSavings,
        saleItemsPercentage: totalItems > 0 ? (saleItems / totalItems) * 100 : 0,
      });
    } catch (error) {
      console.error('Error loading sale type data:', error);
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
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Customer Highlight */}
      {topCustomer && (
        <Card className="border-violet-200 dark:border-violet-800 bg-gradient-to-br from-violet-50/50 dark:from-violet-950/30 to-transparent">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-violet-600 dark:text-violet-400" />
              <CardTitle className="text-sm font-semibold">Top Customer</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="text-xl font-bold truncate">{topCustomer.name}</div>
                {topCustomer.phone && (
                  <div className="text-sm text-muted-foreground">{topCustomer.phone}</div>
                )}
                <div className="text-sm text-muted-foreground">
                  {topCustomer.orders} orders placed
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-xl font-bold text-violet-600 dark:text-violet-400 tabular-nums">{formatCurrency(topCustomer.revenue)}</div>
                <div className="text-sm text-muted-foreground tabular-nums">
                  total spend
                </div>
              </div>
            </div>
            <div className="mt-3 pt-2 border-t border-violet-200/50 dark:border-violet-800/50">
              <Link 
                href="#"
                className="flex items-center gap-1.5 text-xs font-medium text-violet-600 dark:text-violet-400 hover:opacity-80 transition-opacity"
              >
                <Users className="h-3.5 w-3.5" />
                Customer Insights
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 ml-1">Coming Soon</Badge>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sale Type Cards */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <TrendingUp className={`h-4 w-4 ${s.linkColor}`} />
            Sale Type Breakdown
          </CardTitle>
          <CardDescription className="text-sm">
            Performance by sale category
          </CardDescription>
        </CardHeader>
        <CardContent>
          {saleTypeData.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No sales data available for the selected period
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {saleTypeData.map((saleType) => (
                <div 
                  key={saleType.type} 
                  className={`rounded-lg border p-4 ${saleType.bgColor}`}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <span className={saleType.color}>{saleType.icon}</span>
                    <span className="text-sm font-semibold">{saleType.label}</span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Items</span>
                      <span className="text-sm font-medium tabular-nums">{saleType.itemsSold}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Revenue</span>
                      <span className="text-sm font-semibold tabular-nums">{formatCurrency(saleType.revenue)}</span>
                    </div>
                    {saleType.savings > 0 && saleType.type !== 'regular' && (
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Savings</span>
                        <span className="text-sm font-medium tabular-nums text-emerald-600 dark:text-emerald-400">
                          {formatCurrency(saleType.savings)}
                        </span>
                      </div>
                    )}
                    {saleType.avgDiscount > 0 && saleType.type !== 'regular' && (
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Avg. Discount</span>
                        <Badge variant="secondary" className="text-xs">
                          {saleType.avgDiscount.toFixed(1)}% off
                        </Badge>
                      </div>
                    )}
                    {saleType.reportPath && (
                      <div className="pt-2 mt-2 border-t border-inherit">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          asChild
                          className={`w-full justify-between ${saleType.color} hover:bg-white/30 dark:hover:bg-white/10 h-8 text-xs`}
                        >
                          <Link href={`${saleType.reportPath}${dateFilter ? `?filter=${dateFilter}` : ''}`}>
                            View Details
                            <ArrowRight className="h-3.5 w-3.5" />
                          </Link>
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
