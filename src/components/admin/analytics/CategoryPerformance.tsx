'use client';

/**
 * Category Performance Analytics Component
 * 
 * Shows category-wise sales performance:
 * - Items sold per category
 * - Revenue per category
 * - Best performing categories
 * - Category distribution
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { LayoutGrid, Package, TrendingUp, Award } from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';
import { supabase } from '@/lib/supabase';
import { appConfig } from '@/lib/config/app.config';

const s = appConfig.styles;

interface CategoryData {
  category: string;
  categoryId: string;
  itemsSold: number;
  revenue: number;
  avgPrice: number;
  percentageOfTotal: number;
}

interface CategoryPerformanceProps {
  shopId: string;
  startDate?: string | null;
  endDate?: string | null;
}

export function CategoryPerformance({ shopId, startDate, endDate }: CategoryPerformanceProps) {
  const [loading, setLoading] = useState(true);
  const [categoryData, setCategoryData] = useState<CategoryData[]>([]);
  const [topCategory, setTopCategory] = useState<CategoryData | null>(null);

  useEffect(() => {
    if (shopId) {
      loadCategoryData();
    }
  }, [shopId, startDate, endDate]);

  const loadCategoryData = async () => {
    try {
      setLoading(true);

      // Query sales with items, lots, and categories
      let query = supabase
        .from('sales')
        .select(`
          id,
          created_at,
          sale_items (
            id,
            final_price,
            inventory_items!sale_items_inventory_item_id_fkey (
              id,
              lots (
                id,
                categories (
                  id,
                  name
                )
              )
            )
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

      // Aggregate by category
      const categoryMap: Record<string, { id: string; name: string; itemsSold: number; revenue: number }> = {};

      salesData?.forEach((sale: any) => {
        sale.sale_items?.forEach((item: any) => {
          const category = item.inventory_items?.lots?.categories;
          const categoryName = category?.name || 'Uncategorized';
          const categoryId = category?.id || 'unknown';
          const finalPrice = item.final_price || 0;

          if (!categoryMap[categoryId]) {
            categoryMap[categoryId] = {
              id: categoryId,
              name: categoryName,
              itemsSold: 0,
              revenue: 0,
            };
          }

          categoryMap[categoryId].itemsSold += 1;
          categoryMap[categoryId].revenue += finalPrice;
        });
      });

      // Calculate totals and percentages
      const totalRevenue = Object.values(categoryMap).reduce((sum, c) => sum + c.revenue, 0);
      
      const categoryArray: CategoryData[] = Object.values(categoryMap)
        .map(c => ({
          category: c.name,
          categoryId: c.id,
          itemsSold: c.itemsSold,
          revenue: c.revenue,
          avgPrice: c.itemsSold > 0 ? c.revenue / c.itemsSold : 0,
          percentageOfTotal: totalRevenue > 0 ? (c.revenue / totalRevenue) * 100 : 0,
        }))
        .sort((a, b) => b.revenue - a.revenue);

      setCategoryData(categoryArray);
      setTopCategory(categoryArray[0] || null);
    } catch (error) {
      console.error('Error loading category data:', error);
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
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-full" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Category Highlight */}
      {topCategory && (
        <Card className="border-amber-200 dark:border-amber-800 bg-gradient-to-br from-amber-50/50 dark:from-amber-950/30 to-transparent">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Award className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              <CardTitle className="text-sm font-semibold">Top Performing Category</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="text-xl font-bold truncate">{topCategory.category}</div>
                <div className="text-sm text-muted-foreground">
                  {topCategory.itemsSold} items sold &bull; {topCategory.percentageOfTotal.toFixed(1)}% of revenue
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">{formatCurrency(topCategory.revenue)}</div>
                <div className="text-sm text-muted-foreground tabular-nums">
                  Avg. {formatCurrency(topCategory.avgPrice)}/item
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Category Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <LayoutGrid className={`h-4 w-4 ${s.linkColor}`} />
            Category Performance
          </CardTitle>
          <CardDescription className="text-sm">
            Sales breakdown by product category
          </CardDescription>
        </CardHeader>
        <CardContent>
          {categoryData.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No category data available for the selected period
            </div>
          ) : (
            <div className="divide-y">
              {categoryData.map((cat, index) => (
                <div key={cat.categoryId} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs font-semibold text-muted-foreground tabular-nums w-5 shrink-0">
                        #{index + 1}
                      </span>
                      <span className="text-sm font-medium truncate">{cat.category}</span>
                      <Badge variant="outline" className="text-xs shrink-0">
                        {cat.itemsSold} items
                      </Badge>
                    </div>
                    <div className="text-right shrink-0 ml-3">
                      <span className="text-sm font-semibold tabular-nums">{formatCurrency(cat.revenue)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Progress 
                      value={cat.percentageOfTotal} 
                      className="h-2 flex-1"
                    />
                    <span className="text-xs text-muted-foreground tabular-nums w-10 text-right shrink-0">
                      {cat.percentageOfTotal.toFixed(1)}%
                    </span>
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
