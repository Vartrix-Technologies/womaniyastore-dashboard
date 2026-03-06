'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { ArrowLeft, Percent, DollarSign, TrendingUp, Package, Gift } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/formatters';

interface PromotionItem {
  id: string;
  qr_code: string;
  category: string;
  size: string;
  cost_price: number;
  selling_price: number;
  sold_price: number;
  sold_at: string;
  savings: number;
  discount_percent: number;
}

export default function PromotionReportPage() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [promotionItems, setPromotionItems] = useState<PromotionItem[]>([]);
  const [stats, setStats] = useState({
    totalSold: 0,
    totalRevenue: 0,
    totalOriginalValue: 0,
    totalSavings: 0,
    avgDiscount: 0,
    profitMade: 0,
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
      
      // Get all promotion sales with inventory and lot data
      const { data: saleItems, error } = await supabase
        .from('sale_items')
        .select(`
          original_price,
          final_price,
          inventory_items!sale_items_inventory_item_id_fkey!inner (
            qr_codes!inner (
              code
            ),
            lots!inner (
              cost_price_per_unit,
              selling_price_default,
              categories (
                name
              ),
              sizes (
                size_name
              ),
              free_text_size
            )
          ),
          sales!inner (
            created_at
          )
        `)
        .eq('sold_on_sale', true)
        .eq('sale_type', 'promotion')
        .eq('inventory_items.shop_id', shopId);

      if (error) throw error;

      if (!saleItems || saleItems.length === 0) {
        setPromotionItems([]);
        setStats({
          totalSold: 0,
          totalRevenue: 0,
          totalOriginalValue: 0,
          totalSavings: 0,
          avgDiscount: 0,
          profitMade: 0,
        });
        setLoading(false);
        return;
      }

      // Process promotion items
      const items: PromotionItem[] = saleItems.map((si: any) => {
        const costPrice = si.inventory_items.lots.cost_price_per_unit;
        const originalPrice = si.original_price || si.inventory_items.lots.selling_price_default;
        const soldPrice = si.final_price;
        const savings = originalPrice - soldPrice;
        const discountPercent = originalPrice > 0 ? (savings / originalPrice) * 100 : 0;

        return {
          id: si.inventory_items.qr_codes.code,
          qr_code: si.inventory_items.qr_codes.code,
          category: si.inventory_items.lots.categories?.name || 'N/A',
          size: si.inventory_items.lots.sizes?.size_name || si.inventory_items.lots.free_text_size || 'N/A',
          cost_price: costPrice,
          selling_price: originalPrice,
          sold_price: soldPrice,
          sold_at: si.sales.created_at,
          savings: savings,
          discount_percent: discountPercent,
        };
      });

      // Sort by date
      items.sort((a, b) => new Date(b.sold_at).getTime() - new Date(a.sold_at).getTime());

      setPromotionItems(items);

      // Calculate stats
      const totalRevenue = items.reduce((sum, item) => sum + item.sold_price, 0);
      const totalOriginalValue = items.reduce((sum, item) => sum + item.selling_price, 0);
      const totalCost = items.reduce((sum, item) => sum + item.cost_price, 0);
      const totalSavings = totalOriginalValue - totalRevenue;
      const avgDiscount = items.length > 0 
        ? items.reduce((sum, item) => sum + item.discount_percent, 0) / items.length 
        : 0;
      const profitMade = totalRevenue - totalCost;

      setStats({
        totalSold: items.length,
        totalRevenue,
        totalOriginalValue,
        totalSavings,
        avgDiscount,
        profitMade,
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
          <Link href="/admin/sales">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Sales Hub
          </Link>
        </Button>
        
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Percent className="h-6 w-6 text-blue-600" />
            Promotion Analytics
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track promotional sales performance and customer savings
          </p>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1">
              <Package className="h-3 w-3" />
              Items Sold
            </div>
            <div className="text-2xl font-bold">{stats.totalSold}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1">
              <DollarSign className="h-3 w-3" />
              Revenue
            </div>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(stats.totalRevenue)}</div>
            <div className="text-xs text-muted-foreground">vs {formatCurrency(stats.totalOriginalValue)} original</div>
          </CardContent>
        </Card>
        <Card className="border-blue-200 bg-blue-50/30">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1">
              <Gift className="h-3 w-3" />
              Customer Savings
            </div>
            <div className="text-2xl font-bold text-blue-600">{formatCurrency(stats.totalSavings)}</div>
          </CardContent>
        </Card>
        <Card className={stats.profitMade >= 0 ? 'border-green-200 bg-green-50/30' : 'border-red-200 bg-red-50/30'}>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1">
              <TrendingUp className="h-3 w-3" />
              {stats.profitMade >= 0 ? 'Profit Made' : 'Loss Incurred'}
            </div>
            <div className={`text-2xl font-bold ${stats.profitMade >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(Math.abs(stats.profitMade))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Impact Analysis */}
      {stats.totalSold > 0 && (
        <Card className="border-blue-200 bg-gradient-to-br from-blue-50/50 to-transparent">
          <CardHeader>
            <CardTitle className="text-base">Promotion Impact</CardTitle>
            <CardDescription>Analysis of promotional pricing effectiveness</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-3 rounded-lg border bg-card">
                <div className="text-sm text-muted-foreground mb-1">Avg. Discount Given</div>
                <div className="text-xl font-bold text-blue-600">
                  {stats.avgDiscount.toFixed(1)}%
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  per item
                </div>
              </div>
              <div className="p-3 rounded-lg border bg-card">
                <div className="text-sm text-muted-foreground mb-1">Savings Per Item</div>
                <div className="text-xl font-bold">
                  {formatCurrency(stats.totalSold > 0 ? stats.totalSavings / stats.totalSold : 0)}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  average customer benefit
                </div>
              </div>
              <div className="p-3 rounded-lg border bg-card">
                <div className="text-sm text-muted-foreground mb-1">Profit Margin</div>
                <div className={`text-xl font-bold ${stats.profitMade >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {stats.totalRevenue > 0 
                    ? ((stats.profitMade / stats.totalRevenue) * 100).toFixed(1)
                    : 0}%
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  on promotional items
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Promotion Items Table */}
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
              <h3 className="text-lg font-semibold mb-2">No Promotional Items</h3>
              <p className="text-muted-foreground text-sm">
                No items have been sold through promotions yet.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px]">
                <thead>
                  <tr className="border-b text-xs">
                    <th className="text-left py-3 px-3 font-medium">QR Code</th>
                    <th className="text-left py-3 px-3 font-medium">Category</th>
                    <th className="text-left py-3 px-3 font-medium">Size</th>
                    <th className="text-right py-3 px-3 font-medium">Original</th>
                    <th className="text-right py-3 px-3 font-medium">Sold At</th>
                    <th className="text-right py-3 px-3 font-medium">Savings</th>
                    <th className="text-left py-3 px-3 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {promotionItems.map((item) => (
                    <tr key={item.id} className="border-b hover:bg-muted/50 transition-colors">
                      <td className="py-3 px-3 font-mono text-xs">{item.qr_code}</td>
                      <td className="py-3 px-3 text-sm">{item.category}</td>
                      <td className="py-3 px-3 text-sm">{item.size}</td>
                      <td className="py-3 px-3 text-right text-sm text-muted-foreground line-through">
                        {formatCurrency(item.selling_price)}
                      </td>
                      <td className="py-3 px-3 text-right text-sm font-semibold text-green-600">
                        {formatCurrency(item.sold_price)}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <Badge 
                          variant="outline" 
                          className="bg-blue-50 text-blue-700 border-blue-200"
                        >
                          {item.discount_percent.toFixed(0)}% off
                        </Badge>
                      </td>
                      <td className="py-3 px-3 text-sm text-muted-foreground">
                        {formatDate(item.sold_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
