'use client';

import { useAuth } from '@/context/AuthContext';
import { useSync } from '@/context/SyncContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatsCardGrid } from '@/components/shared/StatsCardGrid';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Package,
  ShoppingCart,
  TrendingUp,
  Users,
  ClipboardList,
  QrCode,
  Settings,
  LayoutDashboard,
  RotateCcw,
} from 'lucide-react';

export default function AdminDashboard() {
  const { profile, loading } = useAuth();
  const { getPendingCount } = useSync();
  const [stats, setStats] = useState({
    availableItems: 0,
    todaySales: 0,
    activeStaff: 0,
  });
  const [statsLoading, setStatsLoading] = useState(true);

  // Fetch dashboard stats
  useEffect(() => {
    if (!profile?.shop_id) return;

    const shopId = profile.shop_id as string;
    
    const fetchStats = async () => {
      try {
        // Get available items count
        const { count: itemsCount } = await supabase
          .from('inventory_items')
          .select('*', { count: 'exact', head: true })
          .eq('shop_id', shopId)
          .eq('status', 'available');

        // Get today's sales count
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const { count: salesCount } = await supabase
          .from('sales')
          .select('*', { count: 'exact', head: true })
          .eq('shop_id', shopId)
          .gte('created_at', today.toISOString());

        // Get active staff count
        const { count: staffCount } = await supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true })
          .eq('shop_id', shopId)
          .eq('role', 'staff');

        setStats({
          availableItems: itemsCount || 0,
          todaySales: salesCount || 0,
          activeStaff: staffCount || 0,
        });
      } catch (error) {
        console.error('Failed to fetch stats:', error);
      } finally {
        setStatsLoading(false);
      }
    };

    fetchStats();
  }, [profile?.shop_id]);

  const adminCards = [
    {
      title: 'Inventory Management',
      description: 'Manage stock, add new lots, view all items',
      icon: Package,
      href: '/admin/inventory',
      gradient: 'from-blue-500 to-indigo-600',
    },
    {
      title: 'Sales & Bills',
      description: 'View all sales, generate bills',
      icon: ShoppingCart,
      href: '/admin/sales',
      gradient: 'from-green-500 to-emerald-600',
    },
    {
      title: 'Returns',
      description: 'Process and track product returns',
      icon: RotateCcw,
      href: '/admin/returns',
      gradient: 'from-orange-500 to-red-600',
    },
    {
      title: 'Finances & Reports',
      description: 'Track revenue, expenses, and profits',
      icon: TrendingUp,
      href: '/admin/finances',
      gradient: 'from-purple-500 to-violet-600',
    },
    {
      title: 'Staff Management',
      description: 'Manage staff accounts and permissions',
      icon: Users,
      href: '/admin/staff',
      gradient: 'from-orange-500 to-amber-600',
    },
    {
      title: 'Attendance',
      description: 'View staff attendance logs',
      icon: ClipboardList,
      href: '/admin/attendance',
      gradient: 'from-cyan-500 to-teal-600',
    },
    {
      title: 'Checklists',
      description: 'Manage checklist templates and assignments',
      icon: ClipboardList,
      href: '/admin/checklists',
      gradient: 'from-indigo-500 to-blue-600',
    },
    {
      title: 'QR Codes',
      description: 'Manage QR codes and pre-print labels',
      icon: QrCode,
      href: '/admin/qr-codes',
      gradient: 'from-pink-500 to-rose-600',
    },
    {
      title: 'Settings',
      description: 'App configuration and preferences',
      icon: Settings,
      href: '/admin/settings',
      gradient: 'from-gray-500 to-slate-600',
    },
  ];

  // Loading skeleton
  if (loading) {
    return (
      <div className="space-y-4 md:space-y-6">
        {/* Header skeleton */}
        <div className="space-y-2">
          <div className="h-8 w-64 bg-gray-200 rounded animate-pulse" />
          <div className="h-5 w-96 bg-gray-100 rounded animate-pulse" />
        </div>

        {/* Stats skeleton */}
        <StatsCardGrid loading={true} stats={[]} />

        {/* Cards skeleton */}
        <div className="grid gap-4 md:gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i}>
              <CardHeader>
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 bg-gray-200 rounded-lg animate-pulse" />
                  <div className="space-y-2 flex-1">
                    <div className="h-5 w-32 bg-gray-200 rounded animate-pulse" />
                    <div className="h-4 w-full bg-gray-100 rounded animate-pulse" />
                  </div>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Admin Dashboard</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Welcome back, {profile?.full_name}! Manage your shop operations.
        </p>
      </div>

      {/* Quick Stats */}
      <StatsCardGrid
        loading={statsLoading}
        stats={[
          { label: 'Available Items', value: stats.availableItems },
          { label: "Today's Sales", value: stats.todaySales },
          { label: 'Active Staff', value: stats.activeStaff },
          { label: 'Pending Syncs', value: getPendingCount() },
        ]}
      />

      {/* Admin Module Cards */}
      <div className="grid gap-4 md:gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {adminCards.map((card) => {
          const Icon = card.icon;
          return (
            <Link key={card.href} href={card.href}>
              <Card className="hover:shadow-lg hover:scale-105 active:scale-95 transition-all cursor-pointer h-full">
                <CardHeader>
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-lg bg-gradient-to-br ${card.gradient} text-white shadow-md flex-shrink-0`}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-lg">{card.title}</CardTitle>
                      <CardDescription className="text-sm mt-1 line-clamp-2">{card.description}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            </Link>
          );
        })}
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Quick Actions</CardTitle>
          <CardDescription className="text-sm">Frequently used operations</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button 
            asChild 
            className="bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-600 hover:to-cyan-700 hover:scale-105 active:scale-95 transition-all"
          >
            <Link href="/admin/inventory/add-lot">Add Stock Lot</Link>
          </Button>
          <Button 
            asChild 
            variant="outline"
            className="hover:scale-105 active:scale-95 transition-all"
          >
            <Link href="/pos">Open POS</Link>
          </Button>
          <Button 
            asChild 
            variant="outline"
            className="hover:scale-105 active:scale-95 transition-all"
          >
            <Link href="/admin/finances">Add Expense</Link>
          </Button>
          <Button 
            asChild 
            variant="outline"
            className="hover:scale-105 active:scale-95 transition-all"
          >
            <Link href="/admin/sales">View Sales</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
