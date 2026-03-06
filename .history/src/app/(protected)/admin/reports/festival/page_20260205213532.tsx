'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Link from 'next/link';
import { ArrowLeft, Package, DollarSign, TrendingUp, ChevronDown, ChevronUp, AlertTriangle, Sparkles } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/formatters';

interface FestivalItem {
  id: string;
  qr_code: string;
  category: string;
  size: string;
  cost_price: number;
  selling_price: number;
  min_required_price: number;
  min_margin_percent: number;
  sold_price?: number;
  sold_at?: string;
  profit?: number;
  has_violation?: boolean;
  is_sold: boolean;
  festival_name: string;
}

interface FestivalSummary {
  name: string;
  total: number;
  sold: number;
  unsold: number;
  revenue: number;
  profit: number;
  violations: number;
}

export default function FestivalReportPage() {
  const { profile } = useAuth();
  const searchParams = useSearchParams();
  const filter = searchParams.get('filter');
  const backUrl = `/admin/sales?tab=analytics${filter ? `&filter=${filter}` : ''}`;
  
  const [loading, setLoading] = useState(true);
  const [festivalItems, setFestivalItems] = useState<FestivalItem[]>([]);
  const [festivalSummary, setFestivalSummary] = useState<FestivalSummary[]>([]);
  const [showInsights, setShowInsights] = useState(true);
  const [stats, setStats] = useState({
    totalItems: 0,
    totalSold: 0,
    totalUnsold: 0,
    totalRevenue: 0,
    totalProfit: 0,
    totalViolations: 0,
  });

  useEffect(() => {
    if (profile?.shop_id) {
      loadFestivalData();
    }
  }, [profile?.shop_id]);

  const loadFestivalData = async () => {
    try {
      setLoading(true);
      
      if (!profile?.shop_id) return;
      const shopId = profile.shop_id as string;

      const { supabase } = await import('@/lib/supabase');
      
      // Get ALL lots marked for festival (inventory-centric approach)
      const { data: lots, error: lotsError } = await supabase
        .from('lots')
        .select(`
          id,
          sale_reason,
          cost_price_per_unit,
          selling_price_default,
          min_margin_percent,
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
        .eq('sale_type', 'festival');

      if (lotsError) throw lotsError;

      if (!lots || lots.length === 0) {
        setFestivalItems([]);
        setStats({
          totalItems: 0,
          totalSold: 0,
          totalUnsold: 0,
          totalRevenue: 0,
          totalProfit: 0,
          totalViolations: 0,
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
          final_price,
          inventory_items!sale_items_inventory_item_id_fkey!inner (
            qr_codes!inner (code)
          ),
          sales!inner (created_at)
        `)
        .in('inventory_items.qr_codes.code', allQrCodes)
        .eq('sold_on_sale', true)
        .eq('sale_type', 'festival');

      // Create sold items map
      const soldItemsMap = new Map();
      saleItems?.forEach((si: any) => {
        soldItemsMap.set(si.inventory_items.qr_codes.code, {
          sold_price: si.final_price,
          sold_at: si.sales.created_at,
        });
      });

      // Process all items
      const items: FestivalItem[] = [];
      const festivalMap = new Map<string, FestivalSummary>();

      lots.forEach((lot: any) => {
        const festivalName = lot.sale_reason || 'Festival Sale';
        const categoryName = lot.categories?.name || 'Uncategorized';
        const sizeName = lot.sizes?.size_name || lot.free_text_size || 'N/A';
        const costPrice = lot.cost_price_per_unit;
        const sellingPrice = lot.selling_price_default;
        const minMarginPercent = lot.min_margin_percent || 0;
        const minRequiredPrice = costPrice * (1 + minMarginPercent / 100);

        // Initialize festival if not exists
        if (!festivalMap.has(festivalName)) {
          festivalMap.set(festivalName, {
            name: festivalName,
            total: 0,
            sold: 0,
            unsold: 0,
            revenue: 0,
            profit: 0,
            violations: 0,
          });
        }

        const festSummary = festivalMap.get(festivalName)!;

        (lot.inventory_items || []).forEach((item: any) => {
          const qrCode = item.qr_codes?.code;
          if (!qrCode) return;

          const soldData = soldItemsMap.get(qrCode);
          const isSold = item.status === 'sold' && soldData;
          const profit = isSold ? soldData.sold_price - costPrice : undefined;
          const hasViolation = isSold && soldData.sold_price < minRequiredPrice;

          items.push({
            id: item.id,
            qr_code: qrCode,
            category: categoryName,
            size: sizeName,
            cost_price: costPrice,
            selling_price: sellingPrice,
            min_required_price: minRequiredPrice,
            min_margin_percent: minMarginPercent,
            sold_price: soldData?.sold_price,
            sold_at: soldData?.sold_at,
            profit,
            has_violation: hasViolation,
            is_sold: isSold,
            festival_name: festivalName,
          });

          festSummary.total++;
          if (isSold) {
            festSummary.sold++;
            festSummary.revenue += soldData.sold_price;
            festSummary.profit += profit!;
            if (hasViolation) festSummary.violations++;
          } else {
            festSummary.unsold++;
          }
        });
      });

      setFestivalItems(items);
      setFestivalSummary(Array.from(festivalMap.values()).sort((a, b) => b.sold - a.sold));

      // Calculate stats
      const soldItems = items.filter(i => i.is_sold);
      const totalRevenue = soldItems.reduce((sum, i) => sum + (i.sold_price || 0), 0);
      const totalCost = soldItems.reduce((sum, i) => sum + i.cost_price, 0);
      const totalViolations = soldItems.filter(i => i.has_violation).length;

      setStats({
        totalItems: items.length,
        totalSold: soldItems.length,
        totalUnsold: items.length - soldItems.length,
        totalRevenue,
        totalProfit: totalRevenue - totalCost,
        totalViolations,
      });

    } catch (error) {
      console.error('Error loading festival data:', error);
    } finally {
      setLoading(false);
    }
  };

  const soldItems = festivalItems.filter(i => i.is_sold);
  const unsoldItems = festivalItems.filter(i => !i.is_sold);
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
            <Sparkles className="h-6 w-6 text-green-600" />
            Festival Report
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track festival inventory, sales, and margin compliance
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
            <div className="text-2xl font-bold text-green-600">{conversionRate.toFixed(1)}%</div>
            <div className="text-xs text-muted-foreground">
              of festival items sold
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
        <Card className={stats.totalViolations > 0 ? 'border-red-200 bg-red-50/30' : 'border-green-200 bg-green-50/30'}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider mb-1">
              <AlertTriangle className="h-3 w-3" />
              Violations
            </div>
            <div className={`text-2xl font-bold ${stats.totalViolations > 0 ? 'text-red-600' : 'text-green-600'}`}>
              {stats.totalViolations}
            </div>
            <div className="text-xs text-muted-foreground">
              margin breaches
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Margin Violation Alert */}
      {stats.totalViolations > 0 && (
        <Card className="border-red-200 bg-red-50/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0" />
              <div>
                <div className="font-medium text-red-900">
                  {stats.totalViolations} item{stats.totalViolations > 1 ? 's' : ''} sold below minimum margin
                </div>
                <div className="text-sm text-red-700">
                  Review pricing strategy to protect margins
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Performance Insights - Collapsible */}
      {stats.totalItems > 0 && (
        <Card className="border-green-100">
          <CardHeader 
            className="cursor-pointer hover:bg-muted/30 transition-colors"
            onClick={() => setShowInsights(!showInsights)}
          >
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Performance Insights</CardTitle>
                <CardDescription>Festival breakdown and key metrics</CardDescription>
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
                    <div className="text-sm text-muted-foreground mb-1">Total Profit</div>
                    <div className={`text-xl font-bold ${stats.totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(stats.totalProfit)}
                    </div>
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

                {/* Festival Performance */}
                {festivalSummary.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium mb-2">By Festival</h4>
                    <div className="space-y-2">
                      {festivalSummary.slice(0, 5).map((fest) => (
                        <div key={fest.name} className="flex items-center justify-between p-2 rounded border bg-muted/30">
                          <div className="flex items-center gap-3">
                            <span className="font-medium text-sm">{fest.name}</span>
                            <Badge variant="outline" className="text-xs">
                              {fest.sold}/{fest.total} sold
                            </Badge>
                            {fest.violations > 0 && (
                              <Badge variant="outline" className="text-xs bg-red-50 text-red-700 border-red-200">
                                {fest.violations} violations
                              </Badge>
                            )}
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-semibold">{formatCurrency(fest.revenue)}</div>
                            <div className={`text-xs ${fest.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {fest.profit >= 0 ? '+' : ''}{formatCurrency(fest.profit)}
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
          ) : festivalItems.length === 0 ? (
            <div className="text-center py-12">
              <Sparkles className="h-16 w-16 mx-auto text-muted-foreground mb-3" />
              <h3 className="text-lg font-semibold mb-2">No Festival Items</h3>
              <p className="text-muted-foreground text-sm">
                Mark inventory items for festival sales in the inventory page
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
                      <Sparkles className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>No festival sales yet</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-2 px-2 font-medium text-muted-foreground">Item</th>
                            <th className="text-left py-2 px-2 font-medium text-muted-foreground">Festival</th>
                            <th className="text-right py-2 px-2 font-medium text-muted-foreground">Min Price</th>
                            <th className="text-right py-2 px-2 font-medium text-muted-foreground">Sold For</th>
                            <th className="text-right py-2 px-2 font-medium text-muted-foreground">Profit</th>
                            <th className="text-left py-2 px-2 font-medium text-muted-foreground">Date</th>
                          </tr>
                        </thead>
                        <tbody>
                          {soldItems.slice(0, 50).map((item) => (
                            <tr key={item.id} className={`border-b hover:bg-muted/30 ${item.has_violation ? 'bg-red-50/50' : ''}`}>
                              <td className="py-2 px-2">
                                <div className="font-medium">{item.category}</div>
                                <div className="text-xs text-muted-foreground font-mono">{item.qr_code}</div>
                              </td>
                              <td className="py-2 px-2">
                                <Badge variant="outline" className="text-xs">{item.festival_name}</Badge>
                              </td>
                              <td className="py-2 px-2 text-right text-muted-foreground">
                                {formatCurrency(item.min_required_price)}
                                <div className="text-[10px]">({item.min_margin_percent}% margin)</div>
                              </td>
                              <td className="py-2 px-2 text-right">
                                <span className={`font-semibold ${item.has_violation ? 'text-red-600' : 'text-green-600'}`}>
                                  {formatCurrency(item.sold_price!)}
                                </span>
                                {item.has_violation && (
                                  <div className="text-[10px] text-red-600">⚠ Below min</div>
                                )}
                              </td>
                              <td className="py-2 px-2 text-right">
                                <span className={`font-semibold ${(item.profit || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  {(item.profit || 0) >= 0 ? '+' : ''}{formatCurrency(item.profit || 0)}
                                </span>
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
                      <p>All festival items have been sold!</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-2 px-2 font-medium text-muted-foreground">Item</th>
                            <th className="text-left py-2 px-2 font-medium text-muted-foreground">Festival</th>
                            <th className="text-left py-2 px-2 font-medium text-muted-foreground">Size</th>
                            <th className="text-right py-2 px-2 font-medium text-muted-foreground">Min Price</th>
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
                                <Badge variant="outline" className="text-xs bg-green-50 border-green-200 text-green-700">
                                  {item.festival_name}
                                </Badge>
                              </td>
                              <td className="py-2 px-2">
                                <Badge variant="outline" className="text-xs">{item.size}</Badge>
                              </td>
                              <td className="py-2 px-2 text-right text-muted-foreground">
                                {formatCurrency(item.min_required_price)}
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
