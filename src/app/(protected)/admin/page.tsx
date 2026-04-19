'use client';

import { useAuth } from '@/context/AuthContext';
import { StatsCardGrid } from '@/components/shared/StatsCardGrid';
import { CountUp } from '@/components/shared/CountUp';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { formatCurrency } from '@/lib/formatters';
import {
  Package,
  ShoppingCart,
  TrendingUp,
  Users,
  ClipboardList,
  QrCode,
  RotateCcw,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  ChevronRight,
  Wrench,
  Sparkles,
  BrainCircuit,
  TrendingDown,
  type LucideIcon,
} from 'lucide-react';
import { appConfig } from '@/lib/config/app.config';
import { ChecklistProgressBanner } from '@/components/admin/ChecklistProgressBanner';
import { getCachedStats, setCachedStats } from '@/lib/utils/stats-cache';

const s = appConfig.styles;
const a = s.accent;

// ── Section / card type definitions ──────────────────────────────────────
interface ModuleCard {
  title: string;
  description: string;
  icon: LucideIcon;
  href: string;
  gradient: string;
}

interface ModuleSection {
  label: string;
  icon: LucideIcon;
  iconGradient: string;
  cards: ModuleCard[];
}

export default function AdminDashboard() {
  const { profile, loading } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState(() => getCachedStats('admin_dashboard', {
    availableItems: 0,
    todaySales: 0,
    dailyTurnover: 0,
    itemsSoldToday: 0,
  }));
  const [weeklyInsight, setWeeklyInsight] = useState<{
    thisWeek: number;
    lastWeek: number;
    percentChange: number;
    direction: 'up' | 'down' | 'flat';
  } | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  // Fetch dashboard stats + weekly insight
  useEffect(() => {
    if (!profile?.shop_id) return;

    const shopId = profile.shop_id as string;
    
    const fetchStats = async () => {
      try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Weekly insight date ranges
        const now = new Date();
        const dayOfWeek = now.getDay(); // 0=Sun
        const thisWeekStart = new Date(now);
        thisWeekStart.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1)); // Monday
        thisWeekStart.setHours(0, 0, 0, 0);

        const lastWeekStart = new Date(thisWeekStart);
        lastWeekStart.setDate(thisWeekStart.getDate() - 7);
        const lastWeekEnd = new Date(thisWeekStart); // exclusive

        const [itemsRes, salesRes, turnoverRes, itemsSoldRes, thisWeekRes, lastWeekRes, thisWeekReturnsRes, lastWeekReturnsRes] = await Promise.all([
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
            .from('sales')
            .select('total_amount')
            .eq('shop_id', shopId)
            .gte('created_at', today.toISOString()),
          supabase
            .from('sale_items')
            .select('id', { count: 'exact', head: true })
            .eq('shop_id', shopId)
            .gte('created_at', today.toISOString()),
          // This week's revenue
          supabase
            .from('sales')
            .select('total_amount')
            .eq('shop_id', shopId)
            .gte('created_at', thisWeekStart.toISOString()),
          // Last week's revenue
          supabase
            .from('sales')
            .select('total_amount')
            .eq('shop_id', shopId)
            .gte('created_at', lastWeekStart.toISOString())
            .lt('created_at', lastWeekEnd.toISOString()),
          // This week's returns
          supabase
            .from('sale_returns')
            .select('refund_amount')
            .eq('shop_id', shopId)
            .gte('created_at', thisWeekStart.toISOString()),
          // Last week's returns
          supabase
            .from('sale_returns')
            .select('refund_amount')
            .eq('shop_id', shopId)
            .gte('created_at', lastWeekStart.toISOString())
            .lt('created_at', lastWeekEnd.toISOString()),
        ]);

        // Only update if we got valid responses (stale-while-revalidate)
        if (!itemsRes.error && !salesRes.error && !turnoverRes.error && !itemsSoldRes.error) {
          const dailyTurnover = (turnoverRes.data || []).reduce(
            (sum: number, s: { total_amount: number }) => sum + (s.total_amount || 0),
            0
          );
          const newStats = {
            availableItems: itemsRes.count || 0,
            todaySales: salesRes.count || 0,
            dailyTurnover,
            itemsSoldToday: itemsSoldRes.count || 0,
          };
          setStats(newStats);
          setCachedStats('admin_dashboard', newStats);
        } else {
          console.warn('Some stats queries failed — keeping previous values');
        }

        // Weekly insight calculation (subtract returns)
        if (!thisWeekRes.error && !lastWeekRes.error) {
          const thisWeekSales = (thisWeekRes.data || []).reduce(
            (sum: number, s: { total_amount: number | null }) => sum + (s.total_amount || 0), 0
          );
          const thisWeekRefunds = (thisWeekReturnsRes.data || []).reduce(
            (sum: number, r: { refund_amount: number | null }) => sum + (r.refund_amount || 0), 0
          );
          const lastWeekSales = (lastWeekRes.data || []).reduce(
            (sum: number, s: { total_amount: number | null }) => sum + (s.total_amount || 0), 0
          );
          const lastWeekRefunds = (lastWeekReturnsRes.data || []).reduce(
            (sum: number, r: { refund_amount: number | null }) => sum + (r.refund_amount || 0), 0
          );
          const thisWeekTotal = thisWeekSales - thisWeekRefunds;
          const lastWeekTotal = lastWeekSales - lastWeekRefunds;
          const pct = lastWeekTotal > 0
            ? ((thisWeekTotal - lastWeekTotal) / lastWeekTotal) * 100
            : thisWeekTotal > 0 ? 100 : 0;
          setWeeklyInsight({
            thisWeek: thisWeekTotal,
            lastWeek: lastWeekTotal,
            percentChange: Math.round(pct),
            direction: pct > 1 ? 'up' : pct < -1 ? 'down' : 'flat',
          });
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

  // ── Module sections ──────────────────────────────────────────────────
  const sections: ModuleSection[] = [
    {
      label: 'Business',
      icon: TrendingUp,
      iconGradient: 'from-blue-500 to-indigo-600',
      cards: [
        {
          title: 'Inventory',
          description: 'Stock, lots & items',
          icon: Package,
          href: '/admin/inventory',
          gradient: 'from-blue-500 to-indigo-600',
        },
        {
          title: 'Sales & Bills',
          description: 'Transactions & analytics',
          icon: ShoppingCart,
          href: '/admin/sales',
          gradient: 'from-green-500 to-emerald-600',
        },
        {
          title: 'Finances',
          description: 'Revenue & expenses',
          icon: TrendingUp,
          href: '/admin/finances',
          gradient: 'from-purple-500 to-violet-600',
        },
      ],
    },
    {
      label: 'Staff',
      icon: Users,
      iconGradient: 'from-orange-500 to-amber-600',
      cards: [
        {
          title: 'Management',
          description: 'Accounts & permissions',
          icon: Users,
          href: '/admin/staff',
          gradient: 'from-orange-500 to-amber-600',
        },
        {
          title: 'Performance',
          description: 'Sales & task analytics',
          icon: BarChart3,
          href: '/admin/staff-performance',
          gradient: 'from-violet-500 to-purple-600',
        },
        {
          title: 'Attendance',
          description: 'Clock-in logs & hours',
          icon: ClipboardList,
          href: '/admin/attendance',
          gradient: a.gradientCard,
        },
      ],
    },
    {
      label: 'Operations',
      icon: Wrench,
      iconGradient: 'from-pink-500 to-rose-600',
      cards: [
        {
          title: 'Returns',
          description: 'Process & track returns',
          icon: RotateCcw,
          href: '/admin/returns',
          gradient: 'from-orange-500 to-red-600',
        },
        {
          title: 'QR Codes',
          description: 'Labels & pre-prints',
          icon: QrCode,
          href: '/admin/qr-codes',
          gradient: 'from-pink-500 to-rose-600',
        },
        {
          title: 'Checklists',
          description: 'Templates & assignments',
          icon: ClipboardList,
          href: '/admin/checklists',
          gradient: 'from-indigo-500 to-blue-600',
        },
      ],
    },
  ];

  // Loading skeleton
  if (loading) {
    return (
      <div className="space-y-4 md:space-y-6">
        <div className="space-y-2">
          <div className="h-8 w-64 bg-gray-200 rounded animate-pulse" />
          <div className="h-5 w-96 bg-gray-100 rounded animate-pulse" />
        </div>
        <StatsCardGrid loading={true} stats={[]} />
        <div className="h-16 bg-muted rounded-lg animate-pulse" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="space-y-2">
            <div className="h-5 w-28 bg-gray-200 rounded animate-pulse" />
            <div className="grid grid-cols-3 gap-3">
              {[1, 2, 3].map((j) => (
                <div key={j} className="h-16 bg-muted rounded-lg animate-pulse" />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3 md:space-y-5 lg:space-y-7 animate-content-in lg:max-w-5xl lg:mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold tracking-tight">Admin Dashboard</h1>
        <p className="text-muted-foreground mt-0.5 text-sm lg:text-base">
          Welcome back, {profile?.full_name}!
        </p>
      </div>

      {/* Quick Stats */}
      <StatsCardGrid
        loading={statsLoading}
        stats={[
          {
            label: 'Available Items',
            value: <CountUp end={stats.availableItems} />,
            icon: Package,
            isActive: true,
            isDefault: true,
            activeClassName: `${s.statsActive.total.border} ${s.statsActive.total.bg}`,
            valueColor: a.text,
            onClick: () => router.push('/admin/inventory'),
          },
          {
            label: "Today's Sales",
            value: <CountUp end={stats.todaySales} />,
            icon: ShoppingCart,
            isActive: true,
            isDefault: true,
            activeClassName: `${s.statsActive.total.border} ${s.statsActive.total.bg}`,
            valueColor: a.text,
            onClick: () => router.push('/admin/sales'),
          },
          {
            label: 'Daily Turnover',
            value: formatCurrency(stats.dailyTurnover),
            icon: TrendingUp,
            isActive: true,
            isDefault: true,
            activeClassName: `${s.statsActive.total.border} ${s.statsActive.total.bg}`,
            valueColor: a.text,
            onClick: () => router.push('/admin/finances'),
          },
          {
            label: 'Items Sold Today',
            value: <CountUp end={stats.itemsSoldToday} />,
            icon: BarChart3,
            isActive: true,
            isDefault: true,
            activeClassName: `${s.statsActive.total.border} ${s.statsActive.total.bg}`,
            valueColor: a.text,
            onClick: () => router.push('/admin/sales'),
          },
        ]}
      />

      {/* Today's Checklist Progress */}
      <ChecklistProgressBanner />

      {/* Weekly Insight Banner */}
      {weeklyInsight && (
        <button
          type="button"
          onClick={() => router.push('/admin/sales')}
          className={`w-full rounded-lg border px-3 lg:px-4 py-2.5 lg:py-3.5 flex items-center gap-2.5 lg:gap-3 transition-all cursor-pointer hover:shadow-md ${
            weeklyInsight.direction === 'up'
              ? 'bg-green-50/60 border-green-200 dark:bg-green-950/20 dark:border-green-800'
              : weeklyInsight.direction === 'down'
              ? 'bg-red-50/60 border-red-200 dark:bg-red-950/20 dark:border-red-800'
              : 'bg-muted/40 border-border'
          }`}
        >
          <div className={`p-1 lg:p-1.5 rounded-full ${
            weeklyInsight.direction === 'up' ? 'bg-green-100 text-green-600'
              : weeklyInsight.direction === 'down' ? 'bg-red-100 text-red-600'
              : 'bg-muted text-muted-foreground'
          }`}>
            {weeklyInsight.direction === 'up' ? <ArrowUpRight className="h-3.5 w-3.5 lg:h-5 lg:w-5" />
              : weeklyInsight.direction === 'down' ? <ArrowDownRight className="h-3.5 w-3.5 lg:h-5 lg:w-5" />
              : <Minus className="h-3.5 w-3.5 lg:h-5 lg:w-5" />}
          </div>
          <div className="flex-1 text-left min-w-0">
            <p className="text-sm lg:text-base font-medium truncate">
              This week:{' '}
              <span className={a.text}>{formatCurrency(weeklyInsight.thisWeek)}</span>
            </p>
            <p className="text-xs lg:text-sm text-muted-foreground truncate">
              {weeklyInsight.direction === 'flat'
                ? 'On par with last week'
                : `${Math.abs(weeklyInsight.percentChange)}% ${weeklyInsight.direction === 'up' ? 'higher' : 'lower'} than last week (${formatCurrency(weeklyInsight.lastWeek)})`}
            </p>
          </div>
          <ChevronRight className="h-4 w-4 lg:h-5 lg:w-5 text-muted-foreground shrink-0" />
        </button>
      )}

      {/* Grouped Module Sections */}
      {sections.map((section) => {
        const SectionIcon = section.icon;
        return (
          <div key={section.label} className="space-y-1.5 lg:space-y-2.5 py-1.5 lg:py-2">
            {/* Section header */}
            <div className="flex items-center gap-1.5 lg:gap-2">
              <div className={`p-1 lg:p-1.5 rounded bg-gradient-to-br ${section.iconGradient} text-white`}>
                <SectionIcon className="h-3 w-3 lg:h-4 lg:w-4" />
              </div>
              <h2 className="text-xs lg:text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                {section.label}
              </h2>
            </div>

            {/* Section cards — compact 3-col tiles */}
            <div className="grid grid-cols-3 gap-1.5 md:gap-2 lg:gap-3">
              {section.cards.map((card) => {
                const Icon = card.icon;
                return (
                  <Link key={card.href} href={card.href}>
                    <div className={`rounded-lg border shadow-sm hover:shadow-md ${s.btnAnimationSubtle} cursor-pointer h-full p-2 pt-3 md:p-3 lg:p-4 flex flex-col items-center text-center gap-1.5 lg:gap-2.5 sm:flex-row sm:text-left bg-card`}>
                      <div className={`p-1.5 lg:p-2.5 rounded-md bg-gradient-to-br ${card.gradient} text-white shrink-0`}>
                        <Icon className="h-4 w-4 lg:h-6 lg:w-6" />
                      </div>
                      <div className="min-w-0 w-full">
                        <p className="text-xs sm:text-sm lg:text-base font-semibold leading-tight truncate">
                          {card.title}
                        </p>
                        <p className="text-[10px] lg:text-sm text-muted-foreground leading-tight mt-0.5 hidden sm:block truncate">
                          {card.description}
                        </p>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Business Intelligence */}
      <div className="space-y-1.5 lg:space-y-2.5 py-1.5 lg:py-2">
        {/* Section header */}
        <div className="flex items-center gap-1.5 lg:gap-2">
          <div className="p-1 lg:p-1.5 rounded bg-gradient-to-br from-fuchsia-500 to-purple-600 text-white">
            <Sparkles className="h-3 w-3 lg:h-4 lg:w-4" />
          </div>
          <h2 className="text-xs lg:text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Business Intelligence
          </h2>
        </div>

        {/* Real navigation cards */}
        <div className="grid grid-cols-3 gap-1.5 md:gap-2 lg:gap-3">
          {[
            {
              title: 'Smart Insights',
              description: 'Revenue trends & alerts',
              icon: BrainCircuit,
              gradient: 'from-fuchsia-500 to-purple-600',
              href: '/admin/sales?tab=analytics&section=intelligence',
            },
            {
              title: 'Sales Heatmap',
              description: 'When customers visit',
              icon: TrendingUp,
              gradient: 'from-violet-500 to-indigo-600',
              href: '/admin/sales?tab=analytics&section=intelligence',
            },
            {
              title: 'Customer Cohorts',
              description: 'Retention over time',
              icon: TrendingDown,
              gradient: 'from-rose-500 to-pink-600',
              href: '/admin/sales?tab=analytics&section=intelligence',
            },
          ].map((card) => {
            const Icon = card.icon;
            return (
              <Link
                key={card.title}
                href={card.href}
                className="rounded-lg border shadow-sm h-full p-2 pt-3 md:p-3 lg:p-4 flex flex-col items-center text-center gap-1.5 lg:gap-2.5 sm:flex-row sm:text-left bg-card hover:bg-muted/50 hover:shadow-md transition-all group"
              >
                <div className={`p-1.5 lg:p-2.5 rounded-md bg-gradient-to-br ${card.gradient} text-white shrink-0 group-hover:scale-105 transition-transform`}>
                  <Icon className="h-4 w-4 lg:h-6 lg:w-6" />
                </div>
                <div className="min-w-0 w-full">
                  <p className="text-xs sm:text-sm lg:text-base font-semibold leading-tight truncate">
                    {card.title}
                  </p>
                  <p className="text-[10px] lg:text-sm text-muted-foreground leading-tight mt-0.5 hidden sm:block truncate">
                    {card.description}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
