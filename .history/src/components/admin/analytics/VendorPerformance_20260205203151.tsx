'use client';

/**
 * Vendor Performance Analytics Component
 * 
 * Shows vendor-wise sales performance:
 * - Items sold per vendor
 * - Revenue per vendor
 * - Profit margin per vendor
 * - Trend comparison
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { TrendingUp, TrendingDown, Package, DollarSign, Percent, Store } from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';
import { supabase } from '@/lib/supabase';

interface VendorData {
  vendor: string;
  itemsSold: number;
  revenue: number;
  costOfGoods: number;
  profit: number;
  profitMargin: number;
}

interface VendorPerformanceProps {
  shopId: string;
  startDate?: string | null;
  endDate?: string | null;
}

export function VendorPerformance({ shopId, startDate, endDate }: VendorPerformanceProps) {
  const [loading, setLoading] = useState(true);
  const [vendorData, setVendorData] = useState<VendorData[]>([]);
  const [totals, setTotals] = useState({
    totalItems: 0,
    totalRevenue: 0,
    totalCost: 0,
    totalProfit: 0,
    avgMargin: 0,
    vendorCount: 0,
  });

  useEffect(() => {
    if (shopId) {
      loadVendorData();
    }
  }, [shopId, startDate, endDate]);

  const loadVendorData = async () => {
    try {
      setLoading(true);

      // Query sales with items and lot data (for vendor and cost)
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
                vendor_name,
                cost_price_per_unit
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

      // Aggregate by vendor
      const vendorMap: Record<string, VendorData> = {};

      salesData?.forEach((sale: any) => {
        sale.sale_items?.forEach((item: any) => {
          const lot = item.inventory_items?.lots;
          const vendorName = lot?.vendor_name || 'Unknown Vendor';
          const costPrice = lot?.cost_price_per_unit || 0;
          const finalPrice = item.final_price || 0;

          if (!vendorMap[vendorName]) {
            vendorMap[vendorName] = {
              vendor: vendorName,
              itemsSold: 0,
              revenue: 0,
              costOfGoods: 0,
              profit: 0,
              profitMargin: 0,
            };
          }

          vendorMap[vendorName].itemsSold += 1;
          vendorMap[vendorName].revenue += finalPrice;
          vendorMap[vendorName].costOfGoods += costPrice;
          vendorMap[vendorName].profit += (finalPrice - costPrice);
        });
      });

      // Calculate profit margins and sort by revenue
      const vendorArray = Object.values(vendorMap)
        .map(v => ({
          ...v,
          profitMargin: v.revenue > 0 ? (v.profit / v.revenue) * 100 : 0,
        }))
        .sort((a, b) => b.revenue - a.revenue);

      // Calculate totals
      const totalItems = vendorArray.reduce((sum, v) => sum + v.itemsSold, 0);
      const totalRevenue = vendorArray.reduce((sum, v) => sum + v.revenue, 0);
      const totalCost = vendorArray.reduce((sum, v) => sum + v.costOfGoods, 0);
      const totalProfit = vendorArray.reduce((sum, v) => sum + v.profit, 0);
      const avgMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

      setVendorData(vendorArray);
      setTotals({
        totalItems,
        totalRevenue,
        totalCost,
        totalProfit,
        avgMargin,
        vendorCount: vendorArray.length,
      });
    } catch (error) {
      console.error('Error loading vendor data:', error);
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
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map(i => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Store className="h-4 w-4" />
              <span>Vendors</span>
            </div>
            <div className="text-2xl font-bold mt-1">{totals.vendorCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Package className="h-4 w-4" />
              <span>Items Sold</span>
            </div>
            <div className="text-2xl font-bold mt-1">{totals.totalItems}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <DollarSign className="h-4 w-4" />
              <span>Total Revenue</span>
            </div>
            <div className="text-2xl font-bold mt-1 text-green-600">{formatCurrency(totals.totalRevenue)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Percent className="h-4 w-4" />
              <span>Avg. Margin</span>
            </div>
            <div className={`text-2xl font-bold mt-1 ${totals.avgMargin >= 30 ? 'text-green-600' : totals.avgMargin >= 15 ? 'text-yellow-600' : 'text-red-600'}`}>
              {totals.avgMargin.toFixed(1)}%
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Vendor Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Store className="h-5 w-5 text-teal-600" />
            Vendor Performance
          </CardTitle>
          <CardDescription>
            Revenue and profit breakdown by supplier
          </CardDescription>
        </CardHeader>
        <CardContent>
          {vendorData.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No vendor data available for the selected period
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vendor</TableHead>
                    <TableHead className="text-right">Items Sold</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">Cost</TableHead>
                    <TableHead className="text-right">Profit</TableHead>
                    <TableHead className="text-right">Margin</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vendorData.map((vendor) => (
                    <TableRow key={vendor.vendor}>
                      <TableCell className="font-medium">
                        {vendor.vendor}
                        {vendor.vendor === 'Unknown Vendor' && (
                          <Badge variant="outline" className="ml-2 text-xs">No vendor set</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">{vendor.itemsSold}</TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(vendor.revenue)}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{formatCurrency(vendor.costOfGoods)}</TableCell>
                      <TableCell className="text-right">
                        <span className={vendor.profit >= 0 ? 'text-green-600' : 'text-red-600'}>
                          {formatCurrency(vendor.profit)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {vendor.profitMargin >= 30 ? (
                            <TrendingUp className="h-4 w-4 text-green-500" />
                          ) : vendor.profitMargin < 15 ? (
                            <TrendingDown className="h-4 w-4 text-red-500" />
                          ) : null}
                          <Badge variant={
                            vendor.profitMargin >= 30 ? 'default' :
                            vendor.profitMargin >= 15 ? 'secondary' : 'destructive'
                          }>
                            {vendor.profitMargin.toFixed(1)}%
                          </Badge>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
