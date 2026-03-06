'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { ArrowLeft, Percent, DollarSign, TrendingUp, Package, Gift, ChevronDown, ChevronUp } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/formatters';

interface PromotionItem {
  id: string;
  qr_code: string;
  category: string;
  size: string;
  cost_price: number;
  original_price: number;
  sold_price: number;
  sold_at: string;
  discount_percent: number;
  profit: number;
}

interface CategorySummary {
  category: string;
  count: number;
  revenue: number;
  savings: number;
  profit: number;
}

export default function PromotionReportPage() {
  const { profile } = useAuth();
  const searchParams = useSearchParams();
  const filter = searchParams.get('filter');
  const backUrl = `/admin/sales?tab=analytics${filter ? `&filter=${filter}` : ''}`;
  
  const [loading, setLoading] = useState(true);
  const [promotionItems, setPromotionItems] = useState<PromotionItem[]>([]);
  const [categorySummary, setCategorySummary] = useState<CategorySummary[]>([]);
  const [showInsights, setShowInsights] = useState(true);
  const [stats, setStats] = useState({
    totalItems: 0,
    totalRevenue: 0,
    totalOriginalValue: 0,
    totalSavings: 0,
    totalProfit: 0,
    avgDiscount: 0,
  });

  useEffect(() => {
    if (profile?.shop_id) {
      loadPromotionData();
    }
  }, [profile?.shop_id]);

  const loadPromotionData = async () => {
    try {
      setLoading(true);
      
      if (!profile?.shop_id) return;
      const shopId = profile.shop_id as string;

      const { supabase } = await import('@/lib/supabase');
      
      // Query sale_items that were sold as promotion
      // This matches how SaleTypeAnalysis counts items
      const { data: saleItems, error } = await supabase
        .from('sale_items')
        .select(`
          id,
          original_price,
          final_price,
          inventory_items!sale_items_inventory_item_id_fkey!inner (
            id,
            qr_codes!inner (code),
            lots!inner (
              cost_price_per_unit,
              selling_price_default,
              categories (name),
              sizes (size_name),
              free_text_size,
              shop_id
            )
          ),
          sales!inner (
            created_at
          )
        `)
        .eq('sold_on_sale', true)
        .eq('sale_type', 'promotion')
        .eq('inventory_items.lots.shop_id', shopId)
        .order('sales(created_at)', { ascending: false });

      if (error) throw error;

      if (!saleItems || saleItems.length === 0) {
        setPromotionItems([]);
        setStats({
          totalItems: 0,
          totalRevenue: 0,
          totalOriginalValue: 0,
          totalSavings: 0,
          totalProfit: 0,
          avgDiscount: 0,
        });
        setLoading(false);
        return;
      }

      // Process items
      const items: PromotionItem[] = [];
      const categoryMap = new Map<string, CategorySummary>();
      let totalDiscountPercent = 0;

      saleItems.forEach((si: any) => {
        const lot = si.inventory_items.lots;
        const categoryName = lot.categories?.name || 'Uncategorized';
        const sizeName = lot.sizes?.size_name || lot.free_text_size || 'N/A';
        const costPrice = lot.cost_price_per_unit || 0;
        const originalPrice = si.original_price || lot.selling_price_default || 0;
        const soldPrice = si.final_price || 0;
        const savings = originalPrice - soldPrice;
        const discountPercent = originalPrice > 0 ? (savings / originalPrice) * 100 : 0;
        const profit = soldPrice - costPrice;

        items.push({
          id: si.id,
          qr_code: si.inventory_items.qr_codes?.code || 'N/A',
          category: categoryName,
          size: sizeName,
          cost_price: costPrice,
          original_price: originalPrice,
          sold_price: soldPrice,
          sold_at: si.sales.created_at,
          discount_percent: discountPercent,
          profit,
        });

        totalDiscountPercent += discountPercent;

        // Category summary
        if (!categoryMap.has(categoryName)) {
          categoryMap.set(categoryName, {
            category: categoryName,
            count: 0,
            revenue: 0,
            savings: 0,
            profit: 0,
          });
        }
        const cat = categoryMap.get(categoryName)!;
        cat.count++;
        cat.revenue += soldPrice;
        cat.savings += savings;
        cat.profit += profit;
      });

      setPromotionItems(items);
      setCategorySummary(Array.from(categoryMap.values()).sort((a, b) => b.count - a.count));

      // Calculate stats
      const totalRevenue = items.reduce((sum, i) => sum + i.sold_price, 0);
      const totalOriginalValue = items.reduce((sum, i) => sum + i.original_price, 0);
      const totalCost = items.reduce((sum, i) => sum + i.cost_price, 0);
      const totalSavings = totalOriginalValue - totalRevenue;
      const avgDiscount = items.length > 0 ? totalDiscountPercent / items.length : 0;

      setStats({
        totalItems: items.length,
        totalRevenue,
        totalOriginalValue,
        totalSavings,
        totalProfit: totalRevenue - totalCost,
        avgDiscount,
      });

    } catch (error) {
      console.error('Error loading promotion data:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3">
        <Button 
          variant="ghost" 
          asChild 
          className="w-fit -ml-2 text-teal-600 hover:text-teal-700 hover:bg-teal-50"
        >
          <Link href={backUrl}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Sales Hub
          </Link>
        </Button>
        
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Percent className="h-6 w-6 text-blue-600" />
            Promotion Report
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Analysis of items sold through promotional offers
          </p>
        </div>
      </div>

      {/* Executive Summary - 4 Key Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider mb-1">
              <Package className="h-3 w-3" />
              Items Sold
            </div>
            <div className="text-2xl font-bold">{stats.totalItems}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider mb-1">
              <TrendingUp className="h-3 w-3" />
              Avg. Discount
            </div>
            <div className="text-2xl font-bold text-blue-600">{stats.avgDiscount.toFixed(1)}%</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider mb-1">
              <DollarSign className="h-3 w-3" />
              Revenue
            </div>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(stats.totalRevenue)}</div>
            <div className="text-xs text-muted-foreground">
              vs {formatCurrency(stats.totalOriginalValue)} original
            </div>
          </CardContent>
        </Card>
        <Card className={stats.totalProfit >= 0 ? 'border-green-200 bg-green-50/30' : 'border-red-200 bg-red-50/30'}>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
              {stats.totalProfit >= 0 ? 'Profit' : 'Loss'}
            </div>
            <div className={`text-2xl font-bold ${stats.totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(Math.abs(stats.totalProfit))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Customer Savings Highlight */}
      {stats.totalSavings > 0 && (
        <Card className="border-blue-200 bg-blue-50/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Gift className="h-5 w-5 text-blue-600 flex-shrink-0" />
              <div>
                <div className="font-medium text-blue-900">
                  {formatCurrency(stats.totalSavings)} in customer savings
                </div>
                <div className="text-sm text-blue-700">
                  Avg. {formatCurrency(stats.totalItems > 0 ? stats.totalSavings / stats.totalItems : 0)} saved per item
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Performance Insights - Collapsible */}
      {stats.totalItems > 0 && (
        <Card className="border-blue-100">
          <CardHeader 
            className="cursor-pointer hover:bg-muted/30 transition-colors"
            onClick={() => setShowInsights(!showInsights)}
          >
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Performance Insights</CardTitle>
                <CardDescription>Category breakdown and metrics</CardDescription>
              </div>
              {showInsights ? (
                <ChevronUp className="h-5 w-5 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
          </CardHeader>
          {showInsights && (
            <CardContent className="pt-0">
              <div className="space-y-4">
                {/* Quick Stats */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-3 rounded-lg border bg-card">
                    <div className="text-sm text-muted-foreground mb-1">Avg. Sale Value</div>
                    <div className="text-xl font-bold">
                      {formatCurrency(stats.totalItems > 0 ? stats.totalRevenue / stats.totalItems : 0)}
                    </div>
                  </div>
                  <div className="p-3 rounded-lg border bg-card">
                    <div className="text-sm text-muted-foreground mb-1">Profit Margin</div>
                    <div className={`text-xl font-bold ${stats.totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {stats.totalRevenue > 0 ? ((stats.totalProfit / stats.totalRevenue) * 100).toFixed(1) : 0}%
                    </div>
                  </div>
                  <div className="p-3 rounded-lg border bg-card">
                    <div className="text-sm text-muted-foreground mb-1">Total Savings</div>
                    <div className="text-xl font-bold text-blue-600">
                      {formatCurrency(stats.totalSavings)}
                    </div>
                  </div>
                </div>

                {/* Category Performance */}
                {categorySummary.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium mb-2">By Category</h4>
                    <div className="space-y-2">
                      {categorySummary.slice(0, 5).map((cat) => (
                        <div key={cat.category} className="flex items-center justify-between p-2 rounded border bg-muted/30">
                          <div className="flex items-center gap-3">
                            <span className="font-medium text-sm">{cat.category}</span>
                            <Badge variant="outline" className="text-xs">
                              {cat.count} items
                            </Badge>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-semibold">{formatCurrency(cat.revenue)}</div>
                            <div className={`text-xs ${cat.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {cat.profit >= 0 ? '+' : ''}{formatCurrency(cat.profit)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {/* Items Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Promotional Items</CardTitle>
          <CardDescription>All items sold through promotions</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-pulse space-y-3">
                <div className="h-4 bg-muted rounded w-1/4 mx-auto"></div>
                <div className="h-3 bg-muted rounded w-1/3 mx-auto"></div>
              </div>
            </div>
          ) : promotionItems.length === 0 ? (
            <div className="text-center py-12">
              <Percent className="h-16 w-16 mx-auto text-muted-foreground mb-3" />
              <h3 className="text-lg font-semibold mb-2">No Promotional Sales</h3>
              <p className="text-muted-foreground text-sm">
                Items sold through promotions will appear here
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-2 font-medium text-muted-foreground">Item</th>
                    <th className="text-left py-2 px-2 font-medium text-muted-foreground">Size</th>
                    <th className="text-right py-2 px-2 font-medium text-muted-foreground">Original</th>
                    <th className="text-right py-2 px-2 font-medium text-muted-foreground">Sold For</th>
                    <th className="text-right py-2 px-2 font-medium text-muted-foreground">Discount</th>
                    <th className="text-left py-2 px-2 font-medium text-muted-foreground">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {promotionItems.slice(0, 50).map((item) => (
                    <tr key={item.id} className="border-b hover:bg-muted/30">
                      <td className="py-2 px-2">
                        <div className="font-medium">{item.category}</div>
                        <div className="text-xs text-muted-foreground font-mono">{item.qr_code}</div>
                      </td>
                      <td className="py-2 px-2">
                        <Badge variant="outline" className="text-xs">{item.size}</Badge>
                      </td>
                      <td className="py-2 px-2 text-right text-muted-foreground line-through">
                        {formatCurrency(item.original_price)}
                      </td>
                      <td className="py-2 px-2 text-right font-semibold text-green-600">
                        {formatCurrency(item.sold_price)}
                      </td>
                      <td className="py-2 px-2 text-right">
                        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                          {item.discount_percent.toFixed(0)}% off
                        </Badge>
                      </td>
                      <td className="py-2 px-2 text-xs text-muted-foreground">
                        {formatDate(item.sold_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {promotionItems.length > 50 && (
                <div className="text-center py-3 text-sm text-muted-foreground">
                  Showing 50 of {promotionItems.length} items
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
