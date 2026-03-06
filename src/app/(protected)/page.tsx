'use client';

import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ShoppingCart, Clock, ClipboardCheck } from 'lucide-react';
import Link from 'next/link';
import { appConfig } from '@/lib/config/app.config';

const s = appConfig.styles;

export default function StaffDashboardPage() {
  const { profile, loading } = useAuth();
  const router = useRouter();
  const hasRedirectedRef = useRef(false);

  const isAdmin = profile && ['owner', 'admin', 'superadmin'].includes(profile.role);

  // Auto-redirect admins to admin dashboard (only once using ref to survive HMR)
  useEffect(() => {
    if (loading || !profile || hasRedirectedRef.current) return;
    
    if (isAdmin) {
      hasRedirectedRef.current = true;
      router.replace('/admin');
    }
  }, [profile, loading, isAdmin, router]);

  const quickActions = [
    {
      title: 'Point of Sale',
      description: 'Scan items and complete sales',
      href: '/pos',
      icon: ShoppingCart,
      gradient: `${s.primaryGradientStops}`,
    },
    {
      title: 'My Attendance',
      description: 'Clock in/out and view hours',
      href: '/me/attendance',
      icon: Clock,
      gradient: 'from-green-500 to-emerald-600',
    },
    {
      title: 'My Checklists',
      description: 'View and complete assigned tasks',
      href: '/me/checklists',
      icon: ClipboardCheck,
      gradient: 'from-purple-500 to-violet-600',
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
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <div className="h-4 w-24 bg-gray-100 rounded animate-pulse mb-2" />
                <div className="h-8 w-16 bg-gray-200 rounded animate-pulse" />
              </CardHeader>
            </Card>
          ))}
        </div>

        {/* Cards skeleton */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
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
  
  // Don't render if redirecting admins
  if (isAdmin && !hasRedirectedRef.current) {
    return null;
  }

  return (
    <div className="space-y-4 md:space-y-6 animate-content-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">
          Welcome back, {profile?.full_name}!
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {new Date().toLocaleDateString('en-IN', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </p>
      </div>

      {/* Today's Stats */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="pb-2">
            <CardDescription className="text-sm">Sales Today</CardDescription>
            <CardTitle className="text-3xl">-</CardTitle>
          </CardHeader>
        </Card>
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="pb-2">
            <CardDescription className="text-sm">Hours Worked</CardDescription>
            <CardTitle className="text-3xl">-</CardTitle>
          </CardHeader>
        </Card>
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="pb-2">
            <CardDescription className="text-sm">Tasks Pending</CardDescription>
            <CardTitle className="text-3xl">-</CardTitle>
          </CardHeader>
        </Card>
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="pb-2">
            <CardDescription className="text-sm">Tasks Completed</CardDescription>
            <CardTitle className="text-3xl">-</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {quickActions.map((action) => {
          const Icon = action.icon;
          return (
            <Link key={action.href} href={action.href}>
              <Card className={`hover:shadow-lg ${s.btnAnimation} cursor-pointer h-full`}>
                <CardHeader>
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-lg bg-gradient-to-br ${action.gradient} text-white shadow-md`}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <div className="flex-1">
                      <CardTitle className="text-lg">{action.title}</CardTitle>
                      <CardDescription className="text-sm mt-1">{action.description}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            </Link>
          );
        })}
      </div>

      {/* Today's Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Today's Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Your performance metrics and task completion will appear here
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
