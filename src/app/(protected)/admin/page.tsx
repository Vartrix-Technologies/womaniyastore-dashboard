'use client';

import { useAuth } from '@/context/AuthContext';
import { useSync } from '@/context/SyncContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatsCardGrid } from '@/components/shared/StatsCardGrid';
import { CountUp } from '@/components/shared/CountUp';
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
  BarChart3,
} from 'lucide-react';
import { appConfig } from '@/lib/config/app.config';
import { getCachedStats, setCachedStats } from '@/lib/utils/stats-cache';

const s = appConfig.styles;
const a = s.accent;

export default function AdminDashboard() {
  const { profile, loading } = useAuth();
  const { getPendingCount } = useSync();
  const [stats, setStats] = useState(() => getCachedStats('admin_dashboard', {
    availableItems: 0,
    todaySales: 0,
    activeStaff: 0,
  }));
  const [statsLoading, setStatsLoading] = useState(true);

  // Fetch dashboard stats
  useEffect(() => {
    if (!profile?.shop_id) return;

    const shopId = profile.shop_id as string;
    
    const fetchStats = async () => {
      try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const [itemsRes, salesRes, staffRes] = await Promise.all([
          supabase
            .from('inventory_items')
            .select('*', { count: 'exact', head: true })
            .eq('shop_id', shopId)
            .eq('status', 'available'),
          supabase
            .from('sales')
            .select('*', { count: 'exact', head: true })
            .eq('shop_id', shopId)
            .gte('created_at', today.toISOString()),
          supabase
            .from('profiles')
            .select('*', { count: 'exact', head: true })
            .eq('shop_id', shopId)
            .eq('role', 'staff'),
        ]);

        // Only update if we got valid responses (stale-while-revalidate)
        if (!itemsRes.error && !salesRes.error && !staffRes.error) {
          const newStats = {
            availableItems: itemsRes.count || 0,
            todaySales: salesRes.count || 0,
            activeStaff: staffRes.count || 0,
          };
          setStats(newStats);
          setCachedStats('admin_dashboard', newStats);
        } else {
          console.warn('Some stats queries failed — keeping previous values');
        }
      } catch (error) {
        // Network error / offline — keep showing previous stats
        console.warn('Stats fetch failed (offline?) — keeping previous values:', error);
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
      title: 'Staff Performance',
      description: 'Sales, tasks & attendance analytics per staff',
      icon: BarChart3,
      href: '/admin/staff-performance',
      gradient: 'from-violet-500 to-purple-600',
    },
    {
      title: 'Attendance',
      description: 'View staff attendance logs',
      icon: ClipboardList,
      href: '/admin/attendance',
      gradient: a.gradientCard,
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
    // {
    //   title: 'Settings',
    //   description: 'App configuration and preferences',
    //   icon: Settings,
    //   href: '/admin/settings',
    //   gradient: 'from-gray-500 to-slate-600',
    // },
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
    <div className="space-y-4 md:space-y-6 animate-content-in">
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
          {
            label: 'Available Items',
            value: <CountUp end={stats.availableItems} />,
            isActive: true,
            isDefault: true,
            activeClassName: `${s.statsActive.total.border} ${s.statsActive.total.bg}`,
            valueColor: a.text,
          },
          {
            label: "Today's Sales",
            value: <CountUp end={stats.todaySales} />,
            isActive: true,
            isDefault: true,
            activeClassName: `${s.statsActive.total.border} ${s.statsActive.total.bg}`,
            valueColor: a.text,
          },
          {
            label: 'Active Staff',
            value: <CountUp end={stats.activeStaff} />,
            isActive: true,
            isDefault: true,
            activeClassName: `${s.statsActive.total.border} ${s.statsActive.total.bg}`,
            valueColor: a.text,
          },
          {
            label: 'Pending Syncs',
            value: <CountUp end={getPendingCount()} />,
            isActive: true,
            isDefault: true,
            activeClassName: `${s.statsActive.total.border} ${s.statsActive.total.bg}`,
            valueColor: a.text,
          },
        ]}
      />

      {/* Admin Module Cards */}
      <div className="grid gap-3 md:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {adminCards.map((card) => {
          const Icon = card.icon;
          return (
            <Link key={card.href} href={card.href}>
              <Card className={`hover:shadow-lg ${s.btnAnimation} cursor-pointer h-full bg-gradient-to-br from-background to-muted/30 border shadow-sm`}>
                <CardHeader className="h-full px-4 py-0 flex items-center justify-center">
                  <div className="flex items-center gap-3 w-full">
                    <div className={`p-2.5 rounded-xl bg-gradient-to-br ${card.gradient} text-white shadow-md flex-shrink-0`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-base font-semibold leading-tight mb-0.5">{card.title}</CardTitle>
                      <CardDescription className="text-xs leading-snug line-clamp-2">{card.description}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            </Link>
          );
        })}
      </div>

      {/* Quick Actions */}
      {/* <Card>
        <CardHeader>
          <CardTitle className="text-lg">Quick Actions</CardTitle>
          <CardDescription className="text-sm">Frequently used operations</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button 
            asChild 
            className={`${s.primaryGradient} ${s.primaryGradientHover} ${s.btnAnimation}`}
          >
            <Link href="/admin/inventory/add-lot">Add Stock Lot</Link>
          </Button>
          <Button 
            asChild 
            variant="outline"
            className={s.btnAnimation}
          >
            <Link href="/pos">Open POS</Link>
          </Button>
          <Button 
            asChild 
            variant="outline"
            className={s.btnAnimation}
          >
            <Link href="/admin/finances">Add Expense</Link>
          </Button>
          <Button 
            asChild 
            variant="outline"
            className={s.btnAnimation}
          >
            <Link href="/admin/sales">View Sales</Link>
          </Button>
        </CardContent>
      </Card> */}
    </div>
  );
}
