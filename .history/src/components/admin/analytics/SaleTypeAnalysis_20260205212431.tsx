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
import { 
  Sparkles, 
  Tag, 
  Percent, 
  ShoppingBag,
  TrendingUp,
  Gift,
  ArrowRight
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
      salesData?.forEach((sale: any) => {
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
          icon: <Sparkles className="h-5 w-5" />,
          color: 'text-green-600',
          bgColor: 'bg-green-50 border-green-200',
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
          icon: <Tag className="h-5 w-5" />,
          color: 'text-red-600',
          bgColor: 'bg-red-50 border-red-200',
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
          icon: <Percent className="h-5 w-5" />,
          color: 'text-blue-600',
          bgColor: 'bg-blue-50 border-blue-200',
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
          icon: <ShoppingBag className="h-5 w-5" />,
          color: 'text-gray-600',
          bgColor: 'bg-gray-50 border-gray-200',
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
      {/* Customer Savings Highlight */}
      {totals.totalSavings > 0 && (
        <Card className="border-green-200 bg-gradient-to-br from-green-50/50 to-transparent">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Gift className="h-5 w-5 text-green-600" />
              <CardTitle className="text-base">Customer Savings</CardTitle>
            </div>
            <CardDescription>
              Total value delivered to customers through sales & discounts
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-3xl font-bold text-green-600">
                {formatCurrency(totals.totalSavings)}
              </div>
              <div className="text-right">
                <Badge className="bg-green-100 text-green-700 border-green-200">
                  {totals.saleItemsPercentage.toFixed(1)}% items on sale
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sale Type Cards */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-teal-600" />
            Sale Type Breakdown
          </CardTitle>
          <CardDescription>
            Performance by sale category
          </CardDescription>
        </CardHeader>
        <CardContent>
          {saleTypeData.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No sales data available for the selected period
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {saleTypeData.map((saleType) => (
                <Card 
                  key={saleType.type} 
                  className={`border ${saleType.bgColor}`}
                >
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-2 mb-3">
                      <span className={saleType.color}>{saleType.icon}</span>
                      <span className="font-semibold">{saleType.label}</span>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Items Sold</span>
                        <span className="font-medium">{saleType.itemsSold}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Revenue</span>
                        <span className="font-medium">{formatCurrency(saleType.revenue)}</span>
                      </div>
                      {saleType.savings > 0 && saleType.type !== 'regular' && (
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Savings Given</span>
                          <span className="font-medium text-green-600">
                            {formatCurrency(saleType.savings)}
                          </span>
                        </div>
                      )}
                      {saleType.avgDiscount > 0 && saleType.type !== 'regular' && (
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Avg. Discount</span>
                          <Badge variant="secondary">
                            {saleType.avgDiscount.toFixed(1)}% off
                          </Badge>
                        </div>
                      )}
                      {saleType.reportPath && (
                        <div className="pt-3 mt-3 border-t">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            asChild
                            className={`w-full justify-between ${saleType.color} hover:bg-white/50`}
                          >
                            <Link href={`${saleType.reportPath}${dateFilter ? `?filter=${dateFilter}` : ''}`}>
                              View Details
                              <ArrowRight className="h-4 w-4" />
                            </Link>
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
