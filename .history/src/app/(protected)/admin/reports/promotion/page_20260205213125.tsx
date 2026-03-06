'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Link from 'next/link';
import { ArrowLeft, Percent, DollarSign, TrendingUp, Package, Gift, ChevronDown, ChevronUp } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/formatters';

interface PromotionItem {
  id: string;
  qr_code: string;
  category: string;
  size: string;
  cost_price: number;
  selling_price: number;
  sold_price?: number;
  sold_at?: string;
  discount_percent?: number;
  is_sold: boolean;
}

interface CategorySummary {
  category: string;
  total: number;
  sold: number;
  unsold: number;
  revenue: number;
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
    totalSold: 0,
    totalUnsold: 0,
    totalRevenue: 0,
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
      
      // Get ALL lots marked for promotion (inventory-centric approach)
      const { data: lots, error: lotsError } = await supabase
        .from('lots')
        .select(`
          id,
          sale_reason,
          cost_price_per_unit,
          selling_price_default,
          categories (name),
          sizes (size_name),
          free_text_size,
          inventory_items (
            id,
            status,
            qr_codes (code)
          )
        `)
        .eq('shop_id', shopId)
        .eq('sale_type', 'promotion');

      if (lotsError) throw lotsError;

      if (!lots || lots.length === 0) {
        setPromotionItems([]);
        setStats({
          totalItems: 0,
          totalSold: 0,
          totalUnsold: 0,
          totalRevenue: 0,
          totalProfit: 0,
          avgDiscount: 0,
        });
        setLoading(false);
        return;
      }

      // Get QR codes for sold items lookup
      const allQrCodes = lots.flatMap(lot => 
        (lot.inventory_items || []).map((item: any) => item.qr_codes?.code).filter(Boolean)
      );

      // Get sale data for sold items
      const { data: saleItems } = await supabase
        .from('sale_items')
        .select(`
          original_price,
          final_price,
          inventory_items!sale_items_inventory_item_id_fkey!inner (
            qr_codes!inner (code)
          ),
          sales!inner (created_at)
        `)
        .in('inventory_items.qr_codes.code', allQrCodes)
        .eq('sold_on_sale', true)
        .eq('sale_type', 'promotion');

      // Create sold items map
      const soldItemsMap = new Map();
      saleItems?.forEach((si: any) => {
        soldItemsMap.set(si.inventory_items.qr_codes.code, {
          sold_price: si.final_price,
          original_price: si.original_price,
          sold_at: si.sales.created_at,
        });
      });

      // Process all items
      const items: PromotionItem[] = [];
      const categoryMap = new Map<string, CategorySummary>();

      lots.forEach((lot: any) => {
        const categoryName = lot.categories?.name || 'Uncategorized';
        const sizeName = lot.sizes?.size_name || lot.free_text_size || 'N/A';
        const costPrice = lot.cost_price_per_unit;
        const sellingPrice = lot.selling_price_default;

        // Initialize category if not exists
        if (!categoryMap.has(categoryName)) {
          categoryMap.set(categoryName, {
            category: categoryName,
            total: 0,
            sold: 0,
            unsold: 0,
            revenue: 0,
            profit: 0,
          });
        }

        const catSummary = categoryMap.get(categoryName)!;

        (lot.inventory_items || []).forEach((item: any) => {
          const qrCode = item.qr_codes?.code;
          if (!qrCode) return;

          const soldData = soldItemsMap.get(qrCode);
          const isSold = item.status === 'sold' && soldData;
          const originalPrice = soldData?.original_price || sellingPrice;
          const discountPercent = isSold && originalPrice > 0 
            ? ((originalPrice - soldData.sold_price) / originalPrice) * 100 
            : 0;

          items.push({
            id: item.id,
            qr_code: qrCode,
            category: categoryName,
            size: sizeName,
            cost_price: costPrice,
            selling_price: sellingPrice,
            sold_price: soldData?.sold_price,
            sold_at: soldData?.sold_at,
            discount_percent: discountPercent,
            is_sold: isSold,
          });

          catSummary.total++;
          if (isSold) {
            catSummary.sold++;
            catSummary.revenue += soldData.sold_price;
            catSummary.profit += (soldData.sold_price - costPrice);
          } else {
            catSummary.unsold++;
          }
        });
      });

      setPromotionItems(items);
      setCategorySummary(Array.from(categoryMap.values()).sort((a, b) => b.sold - a.sold));

      // Calculate stats
      const soldItems = items.filter(i => i.is_sold);
      const totalRevenue = soldItems.reduce((sum, i) => sum + (i.sold_price || 0), 0);
      const totalCost = soldItems.reduce((sum, i) => sum + i.cost_price, 0);
      const avgDiscount = soldItems.length > 0
        ? soldItems.reduce((sum, i) => sum + (i.discount_percent || 0), 0) / soldItems.length
        : 0;

      setStats({
        totalItems: items.length,
        totalSold: soldItems.length,
        totalUnsold: items.length - soldItems.length,
        totalRevenue,
        totalProfit: totalRevenue - totalCost,
        avgDiscount,
      });

    } catch (error) {
      console.error('Error loading promotion data:', error);
    } finally {
      setLoading(false);
    }
  };

  const soldItems = promotionItems.filter(i => i.is_sold);
  const unsoldItems = promotionItems.filter(i => !i.is_sold);
  const conversionRate = stats.totalItems > 0 ? (stats.totalSold / stats.totalItems) * 100 : 0;

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
            Track promotional inventory and sales performance
          </p>
        </div>
      </div>

      {/* Executive Summary - 4 Key Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider mb-1">
              <Package className="h-3 w-3" />
              Total Items
            </div>
            <div className="text-2xl font-bold">{stats.totalItems}</div>
            <div className="text-xs text-muted-foreground">
              {stats.totalSold} sold • {stats.totalUnsold} available
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider mb-1">
              <TrendingUp className="h-3 w-3" />
              Conversion
            </div>
            <div className="text-2xl font-bold text-blue-600">{conversionRate.toFixed(1)}%</div>
            <div className="text-xs text-muted-foreground">
              of promo items sold
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider mb-1">
              <DollarSign className="h-3 w-3" />
              Revenue
            </div>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(stats.totalRevenue)}</div>
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
                <CardDescription>Category breakdown and key metrics</CardDescription>
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
                    <div className="text-sm text-muted-foreground mb-1">Avg. Discount</div>
                    <div className="text-xl font-bold text-blue-600">{stats.avgDiscount.toFixed(1)}%</div>
                  </div>
                  <div className="p-3 rounded-lg border bg-card">
                    <div className="text-sm text-muted-foreground mb-1">Avg. Sale Value</div>
                    <div className="text-xl font-bold">
                      {formatCurrency(stats.totalSold > 0 ? stats.totalRevenue / stats.totalSold : 0)}
                    </div>
                  </div>
                  <div className="p-3 rounded-lg border bg-card">
                    <div className="text-sm text-muted-foreground mb-1">Profit Margin</div>
                    <div className={`text-xl font-bold ${stats.totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {stats.totalRevenue > 0 ? ((stats.totalProfit / stats.totalRevenue) * 100).toFixed(1) : 0}%
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
                              {cat.sold}/{cat.total} sold
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

      {/* Data Tabs - Sold vs Available */}
      <Card>
        <CardContent className="p-0">
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
              <h3 className="text-lg font-semibold mb-2">No Promotional Items</h3>
              <p className="text-muted-foreground text-sm">
                Mark inventory items for promotion in the inventory page
              </p>
            </div>
          ) : (
            <Tabs defaultValue="sold" className="w-full">
              <div className="px-4 pt-4">
                <TabsList className="grid w-full grid-cols-2 max-w-xs">
                  <TabsTrigger value="sold">
                    Sold ({stats.totalSold})
                  </TabsTrigger>
                  <TabsTrigger value="available">
                    Available ({stats.totalUnsold})
                  </TabsTrigger>
                </TabsList>
              </div>
              
              <TabsContent value="sold" className="mt-0">
                <div className="p-4">
                  {soldItems.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Gift className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>No promotional sales yet</p>
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
                          {soldItems.slice(0, 50).map((item) => (
                            <tr key={item.id} className="border-b hover:bg-muted/30">
                              <td className="py-2 px-2">
                                <div className="font-medium">{item.category}</div>
                                <div className="text-xs text-muted-foreground font-mono">{item.qr_code}</div>
                              </td>
                              <td className="py-2 px-2">
                                <Badge variant="outline" className="text-xs">{item.size}</Badge>
                              </td>
                              <td className="py-2 px-2 text-right text-muted-foreground line-through">
                                {formatCurrency(item.selling_price)}
                              </td>
                              <td className="py-2 px-2 text-right font-semibold text-green-600">
                                {formatCurrency(item.sold_price!)}
                              </td>
                              <td className="py-2 px-2 text-right">
                                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                                  {item.discount_percent?.toFixed(0)}% off
                                </Badge>
                              </td>
                              <td className="py-2 px-2 text-xs text-muted-foreground">
                                {formatDate(item.sold_at!)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {soldItems.length > 50 && (
                        <div className="text-center py-3 text-sm text-muted-foreground">
                          Showing 50 of {soldItems.length} items
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </TabsContent>
              
              <TabsContent value="available" className="mt-0">
                <div className="p-4">
                  {unsoldItems.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>All promotional items have been sold!</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-2 px-2 font-medium text-muted-foreground">Item</th>
                            <th className="text-left py-2 px-2 font-medium text-muted-foreground">Size</th>
                            <th className="text-right py-2 px-2 font-medium text-muted-foreground">Cost</th>
                            <th className="text-right py-2 px-2 font-medium text-muted-foreground">Selling Price</th>
                          </tr>
                        </thead>
                        <tbody>
                          {unsoldItems.slice(0, 50).map((item) => (
                            <tr key={item.id} className="border-b hover:bg-muted/30">
                              <td className="py-2 px-2">
                                <div className="font-medium">{item.category}</div>
                                <div className="text-xs text-muted-foreground font-mono">{item.qr_code}</div>
                              </td>
                              <td className="py-2 px-2">
                                <Badge variant="outline" className="text-xs">{item.size}</Badge>
                              </td>
                              <td className="py-2 px-2 text-right text-muted-foreground">
                                {formatCurrency(item.cost_price)}
                              </td>
                              <td className="py-2 px-2 text-right font-semibold">
                                {formatCurrency(item.selling_price)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {unsoldItems.length > 50 && (
                        <div className="text-center py-3 text-sm text-muted-foreground">
                          Showing 50 of {unsoldItems.length} items
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
