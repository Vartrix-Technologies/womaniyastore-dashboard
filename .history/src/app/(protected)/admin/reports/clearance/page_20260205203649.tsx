'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { ArrowLeft, TrendingDown, DollarSign, Percent, Package } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/formatters';

interface ClearanceItem {
  id: string;
  qr_code: string;
  category: string;
  size: string;
  cost_price: number;
  selling_price: number;
  sold_price: number;
  sold_at: string;
  loss_amount: number;
  loss_percent: number;
}

export default function ClearanceReportPage() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [clearanceItems, setClearanceItems] = useState<ClearanceItem[]>([]);
  const [stats, setStats] = useState({
    totalCleared: 0,
    totalRevenue: 0,
    totalCost: 0,
    totalLoss: 0,
    avgLossPercent: 0,
    itemsAtLoss: 0,
    itemsAtProfit: 0,
  });

  useEffect(() => {
    if (profile?.shop_id) {
      loadClearanceData();
    }
  }, [profile?.shop_id]);

  const loadClearanceData = async () => {
    try {
      setLoading(true);
      
      if (!profile?.shop_id) return;
      const shopId = profile.shop_id as string;

      const { supabase } = await import('@/lib/supabase');
      
      // Get all clearance sales with inventory and lot data
      const { data: saleItems, error } = await supabase
        .from('sale_items')
        .select(`
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
        .eq('sale_type', 'clearance')
        .eq('inventory_items.shop_id', shopId);

      if (error) throw error;

      if (!saleItems || saleItems.length === 0) {
        setClearanceItems([]);
        setStats({
          totalCleared: 0,
          totalRevenue: 0,
          totalCost: 0,
          totalLoss: 0,
          avgLossPercent: 0,
          itemsAtLoss: 0,
          itemsAtProfit: 0,
        });
        setLoading(false);
        return;
      }

      // Process clearance items
      const items: ClearanceItem[] = saleItems.map((si: any) => {
        const costPrice = si.inventory_items.lots.cost_price_per_unit;
        const soldPrice = si.final_price;
        const lossAmount = costPrice - soldPrice;
        const lossPercent = (lossAmount / costPrice) * 100;

        return {
          id: si.inventory_items.qr_codes.code,
          qr_code: si.inventory_items.qr_codes.code,
          category: si.inventory_items.lots.categories?.name || 'N/A',
          size: si.inventory_items.lots.sizes?.size_name || si.inventory_items.lots.free_text_size || 'N/A',
          cost_price: costPrice,
          selling_price: si.inventory_items.lots.selling_price_default,
          sold_price: soldPrice,
          sold_at: si.sales.created_at,
          loss_amount: lossAmount,
          loss_percent: lossPercent,
        };
      });

      // Sort by date in JavaScript since we can't order by nested field
      items.sort((a, b) => new Date(b.sold_at).getTime() - new Date(a.sold_at).getTime());

      setClearanceItems(items);

      // Calculate stats
      const totalRevenue = items.reduce((sum, item) => sum + item.sold_price, 0);
      const totalCost = items.reduce((sum, item) => sum + item.cost_price, 0);
      const totalLoss = totalCost - totalRevenue;
      const avgLossPercent = items.length > 0 
        ? items.reduce((sum, item) => sum + item.loss_percent, 0) / items.length 
        : 0;
      const itemsAtLoss = items.filter(item => item.loss_amount > 0).length;
      const itemsAtProfit = items.filter(item => item.loss_amount <= 0).length;

      setStats({
        totalCleared: items.length,
        totalRevenue,
        totalCost,
        totalLoss,
        avgLossPercent,
        itemsAtLoss,
        itemsAtProfit,
      });
    } catch (error) {
      console.error('Error loading clearance data:', error);
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
            <TrendingDown className="h-6 w-6 text-red-600" />
            Clearance Analytics
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track clearance performance, losses, and inventory liquidation
          </p>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1">
              <Package className="h-3 w-3" />
              Items Cleared
            </div>
            <div className="text-2xl font-bold">{stats.totalCleared}</div>
            <div className="text-xs text-muted-foreground mt-1">
              {stats.itemsAtLoss} at loss • {stats.itemsAtProfit} at profit
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1">
              <DollarSign className="h-3 w-3" />
              Revenue
            </div>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(stats.totalRevenue)}</div>
            <div className="text-xs text-muted-foreground">vs {formatCurrency(stats.totalCost)} cost</div>
          </CardContent>
        </Card>
        <Card className={stats.totalLoss > 0 ? 'border-red-300 bg-red-50/30' : 'border-green-300 bg-green-50/30'}>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
              {stats.totalLoss > 0 ? 'Total Loss' : 'Net Profit'}
            </div>
            <div className={`text-2xl font-bold ${stats.totalLoss > 0 ? 'text-red-600' : 'text-green-600'}`}>
              {formatCurrency(Math.abs(stats.totalLoss))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1">
              <Percent className="h-3 w-3" />
              Avg Loss %
            </div>
            <div className={`text-2xl font-bold ${stats.avgLossPercent > 0 ? 'text-red-600' : 'text-green-600'}`}>
              {stats.avgLossPercent.toFixed(1)}%
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Impact Analysis */}
      {stats.totalCleared > 0 && (
        <Card className="border-blue-200 bg-gradient-to-br from-blue-50/50 to-transparent">
          <CardHeader>
            <CardTitle className="text-base">Clearance Impact</CardTitle>
            <CardDescription>Financial analysis of clearance sales</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-3 rounded-lg border bg-card">
                <div className="text-sm text-muted-foreground mb-1">Recovery Rate</div>
                <div className="text-xl font-bold">
                  {((stats.totalRevenue / stats.totalCost) * 100).toFixed(1)}%
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  of cost recovered
                </div>
              </div>
              <div className="p-3 rounded-lg border bg-card">
                <div className="text-sm text-muted-foreground mb-1">Avg Discount</div>
                <div className="text-xl font-bold text-orange-600">
                  {stats.totalCleared > 0 
                    ? (((stats.totalCost - stats.totalRevenue) / stats.totalCost) * 100).toFixed(1)
                    : 0}%
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  from cost price
                </div>
              </div>
              <div className="p-3 rounded-lg border bg-card">
                <div className="text-sm text-muted-foreground mb-1">Loss Ratio</div>
                <div className="text-xl font-bold">
                  {stats.totalCleared > 0 
                    ? `${stats.itemsAtLoss}:${stats.itemsAtProfit}`
                    : '0:0'}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  loss to profit items
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Clearance Items Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Clearance Items</CardTitle>
          <CardDescription>All items sold through clearance</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-pulse space-y-3">
                <div className="h-4 bg-muted rounded w-1/4 mx-auto"></div>
                <div className="h-3 bg-muted rounded w-1/3 mx-auto"></div>
              </div>
            </div>
          ) : clearanceItems.length === 0 ? (
            <div className="text-center py-12">
              <TrendingDown className="h-16 w-16 mx-auto text-muted-foreground mb-3" />
              <h3 className="text-lg font-semibold mb-2">No Clearance Sales</h3>
              <p className="text-sm text-muted-foreground">
                Clearance sales will appear here once items are sold at clearance
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-3 font-medium text-muted-foreground">Item</th>
                    <th className="text-left py-3 px-3 font-medium text-muted-foreground">Size</th>
                    <th className="text-right py-3 px-3 font-medium text-muted-foreground">Cost</th>
                    <th className="text-right py-3 px-3 font-medium text-muted-foreground">Original</th>
                    <th className="text-right py-3 px-3 font-medium text-muted-foreground">Sold For</th>
                    <th className="text-right py-3 px-3 font-medium text-muted-foreground">Loss/Profit</th>
                    <th className="text-left py-3 px-3 font-medium text-muted-foreground">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {clearanceItems.map((item) => (
                    <tr key={item.id} className="border-b hover:bg-muted/30">
                      <td className="py-3 px-3">
                        <div className="font-medium">{item.category}</div>
                        <div className="text-xs text-muted-foreground font-mono">{item.qr_code}</div>
                      </td>
                      <td className="py-3 px-3">
                        <Badge variant="outline" className="text-xs">{item.size}</Badge>
                      </td>
                      <td className="py-3 px-3 text-right text-muted-foreground">
                        {formatCurrency(item.cost_price)}
                      </td>
                      <td className="py-3 px-3 text-right text-muted-foreground line-through">
                        {formatCurrency(item.selling_price)}
                      </td>
                      <td className="py-3 px-3 text-right font-semibold">
                        {formatCurrency(item.sold_price)}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className={`font-semibold ${item.loss_amount > 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {item.loss_amount > 0 ? '-' : '+'}{formatCurrency(Math.abs(item.loss_amount))}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {item.loss_amount > 0 ? '-' : '+'}{Math.abs(item.loss_percent).toFixed(1)}%
                        </div>
                      </td>
                      <td className="py-3 px-3 text-xs text-muted-foreground">
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
