'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { ArrowLeft, Package, TrendingUp, AlertTriangle, DollarSign } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/formatters';

interface FestivalItem {
  festival_reason: string;
  items: Array<{
    id: string;
    qr_code: string;
    category: string;
    size: string;
    cost_price: number;
    selling_price: number;
    min_margin_percent: number;
    min_required_price: number;
    is_sold: boolean;
    sold_price?: number;
    sold_at?: string;
    has_margin_violation?: boolean;
  }>;
  total_items: number;
  sold_items: number;
  unsold_items: number;
  total_revenue: number;
  violations: number;
}

export default function FestivalReportPage() {
  const { profile } = useAuth();
  const searchParams = useSearchParams();
  const filter = searchParams.get('filter');
  const backUrl = `/admin/sales?tab=analytics${filter ? `&filter=${filter}` : ''}`;
  
  const [loading, setLoading] = useState(true);
  const [festivals, setFestivals] = useState<FestivalItem[]>([]);
  const [stats, setStats] = useState({
    totalItems: 0,
    totalSold: 0,
    totalUnsold: 0,
    totalRevenue: 0,
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
      
      // Get all lots marked for festival sales with their inventory items
      const { data: lots, error } = await supabase
        .from('lots')
        .select(`
          id,
          sale_reason,
          min_margin_percent,
          cost_price_per_unit,
          selling_price_default,
          categories (
            name
          ),
          sizes (
            size_name
          ),
          free_text_size,
          inventory_items (
            id,
            status,
            qr_codes (
              code
            )
          )
        `)
        .eq('shop_id', shopId)
        .eq('sale_type', 'festival')
        .order('sale_reason');

      if (error) throw error;

      if (!lots || lots.length === 0) {
        setFestivals([]);
        setLoading(false);
        return;
      }

      // Get sale data for sold items
      const allQrCodes = lots.flatMap(lot => 
        (lot.inventory_items || []).map((item: any) => item.qr_codes?.code).filter(Boolean)
      );

      const { data: saleItems } = await supabase
        .from('sale_items')
        .select(`
          final_price,
          inventory_items!sale_items_inventory_item_id_fkey!inner (
            qr_codes!inner (
              code
            )
          ),
          sales!inner (
            created_at
          )
        `)
        .in('inventory_items.qr_codes.code', allQrCodes)
        .eq('sold_on_sale', true)
        .eq('sale_type', 'festival');

      // Create a map of sold items
      const soldItemsMap = new Map();
      saleItems?.forEach((si: any) => {
        soldItemsMap.set(si.inventory_items.qr_codes.code, {
          sold_price: si.final_price,
          sold_at: si.sales.created_at,
        });
      });

      // Group by festival reason
      const festivalMap = new Map<string, any>();

      lots.forEach((lot: any) => {
        const festivalReason = lot.sale_reason || 'Unnamed Festival';
        
        if (!festivalMap.has(festivalReason)) {
          festivalMap.set(festivalReason, {
            festival_reason: festivalReason,
            items: [],
            total_items: 0,
            sold_items: 0,
            unsold_items: 0,
            total_revenue: 0,
            violations: 0,
          });
        }

        const festival = festivalMap.get(festivalReason);
        const costPrice = lot.cost_price_per_unit;
        const minRequiredPrice = costPrice * (1 + lot.min_margin_percent / 100);
        const categoryName = lot.categories?.name || 'N/A';
        const sizeName = lot.sizes?.size_name || lot.free_text_size || 'N/A';

        (lot.inventory_items || []).forEach((item: any) => {
          const qrCode = item.qr_codes?.code;
          if (!qrCode) return; // Skip items without QR codes
          
          const soldData = soldItemsMap.get(qrCode);
          const isSold = item.status === 'sold' && soldData;
          const hasViolation = isSold && soldData.sold_price < minRequiredPrice;

          festival.items.push({
            id: item.id,
            qr_code: qrCode,
            category: categoryName,
            size: sizeName,
            cost_price: costPrice,
            selling_price: lot.selling_price_default,
            min_margin_percent: lot.min_margin_percent,
            min_required_price: minRequiredPrice,
            is_sold: isSold,
            sold_price: soldData?.sold_price,
            sold_at: soldData?.sold_at,
            has_margin_violation: hasViolation,
          });

          festival.total_items++;
          if (isSold) {
            festival.sold_items++;
            festival.total_revenue += soldData.sold_price;
            if (hasViolation) {
              festival.violations++;
            }
          } else {
            festival.unsold_items++;
          }
        });
      });

      const festivalsArray = Array.from(festivalMap.values());
      setFestivals(festivalsArray);

      // Calculate overall stats
      const totalStats = festivalsArray.reduce(
        (acc, fest) => ({
          totalItems: acc.totalItems + fest.total_items,
          totalSold: acc.totalSold + fest.sold_items,
          totalUnsold: acc.totalUnsold + fest.unsold_items,
          totalRevenue: acc.totalRevenue + fest.total_revenue,
          totalViolations: acc.totalViolations + fest.violations,
        }),
        { totalItems: 0, totalSold: 0, totalUnsold: 0, totalRevenue: 0, totalViolations: 0 }
      );

      setStats(totalStats);
    } catch (error) {
      console.error('Error loading festival data:', error);
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
            <Package className="h-6 w-6 text-green-600" />
            Festival Sales Report
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track festival items, sales performance, and margin protection
          </p>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Total Items</div>
            <div className="text-2xl font-bold">{stats.totalItems}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Sold</div>
            <div className="text-2xl font-bold text-green-600">{stats.totalSold}</div>
            <div className="text-xs text-muted-foreground">
              {stats.totalItems > 0 ? ((stats.totalSold / stats.totalItems) * 100).toFixed(1) : 0}%
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Unsold</div>
            <div className="text-2xl font-bold text-orange-600">{stats.totalUnsold}</div>
            <div className="text-xs text-muted-foreground">
              {stats.totalItems > 0 ? ((stats.totalUnsold / stats.totalItems) * 100).toFixed(1) : 0}%
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Revenue</div>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(stats.totalRevenue)}</div>
          </CardContent>
        </Card>
        <Card className={stats.totalViolations > 0 ? 'border-red-300 bg-red-50/30' : ''}>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              Violations
            </div>
            <div className={`text-2xl font-bold ${stats.totalViolations > 0 ? 'text-red-600' : ''}`}>
              {stats.totalViolations}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Festivals List */}
      {loading ? (
        <Card>
          <CardContent className="p-12">
            <div className="text-center">
              <div className="animate-pulse space-y-3">
                <div className="h-4 bg-muted rounded w-1/4 mx-auto"></div>
                <div className="h-3 bg-muted rounded w-1/3 mx-auto"></div>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : festivals.length === 0 ? (
        <Card>
          <CardContent className="p-12">
            <div className="text-center">
              <Package className="h-16 w-16 mx-auto text-muted-foreground mb-3" />
              <h3 className="text-lg font-semibold mb-2">No Festival Items</h3>
              <p className="text-sm text-muted-foreground">
                Mark inventory items for festival sales in the inventory page
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {festivals.map((festival, idx) => (
            <Card key={idx} className="border-green-200">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-green-500"></span>
                      {festival.festival_reason}
                    </CardTitle>
                    <CardDescription className="mt-1">
                      {festival.total_items} items • {festival.sold_items} sold • {festival.unsold_items} remaining
                    </CardDescription>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-muted-foreground">Revenue</div>
                    <div className="text-xl font-bold text-green-600">
                      {formatCurrency(festival.total_revenue)}
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {festival.violations > 0 && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-center gap-2 text-red-700">
                      <AlertTriangle className="h-4 w-4" />
                      <span className="text-sm font-semibold">
                        {festival.violations} margin violation{festival.violations > 1 ? 's' : ''} detected
                      </span>
                    </div>
                  </div>
                )}

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-2 font-medium text-muted-foreground">Item</th>
                        <th className="text-left py-2 px-2 font-medium text-muted-foreground">Size</th>
                        <th className="text-left py-2 px-2 font-medium text-muted-foreground">Status</th>
                        <th className="text-right py-2 px-2 font-medium text-muted-foreground">Min Price</th>
                        <th className="text-right py-2 px-2 font-medium text-muted-foreground">Sold Price</th>
                        <th className="text-left py-2 px-2 font-medium text-muted-foreground">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {festival.items.map((item) => (
                        <tr key={item.id} className={`border-b ${item.has_margin_violation ? 'bg-red-50' : ''}`}>
                          <td className="py-2 px-2">
                            <div className="font-medium">{item.category}</div>
                            <div className="text-xs text-muted-foreground font-mono">{item.qr_code}</div>
                          </td>
                          <td className="py-2 px-2">
                            <Badge variant="outline" className="text-xs">{item.size}</Badge>
                          </td>
                          <td className="py-2 px-2">
                            {item.is_sold ? (
                              <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Sold</Badge>
                            ) : (
                              <Badge variant="secondary">Available</Badge>
                            )}
                          </td>
                          <td className="py-2 px-2 text-right">
                            <div className="text-xs text-muted-foreground">
                              {formatCurrency(item.min_required_price)}
                            </div>
                            <div className="text-[10px] text-muted-foreground">
                              ({item.min_margin_percent}% margin)
                            </div>
                          </td>
                          <td className="py-2 px-2 text-right">
                            {item.is_sold ? (
                              <div className={item.has_margin_violation ? 'text-red-600 font-semibold' : 'font-semibold'}>
                                {formatCurrency(item.sold_price!)}
                                {item.has_margin_violation && (
                                  <div className="text-xs text-red-600">⚠ Below min</div>
                                )}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="py-2 px-2 text-xs text-muted-foreground">
                            {item.is_sold && item.sold_at ? formatDate(item.sold_at) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
