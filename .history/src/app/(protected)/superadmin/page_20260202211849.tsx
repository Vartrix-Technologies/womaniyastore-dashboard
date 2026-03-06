'use client';

import { useAuth } from '@/context/AuthContext';
import { useSync } from '@/context/SyncContext';
import { useOfflineStatus } from '@/hooks/useOfflineStatus';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UserManagement } from '@/components/admin/UserManagement';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import {
  Database,
  Activity,
  AlertCircle,
  CheckCircle,
  XCircle,
  Wifi,
  WifiOff,
  Server,
  HardDrive,
  RefreshCw,
  Settings,
  ShieldCheck,
  Zap,
  BarChart3,
  Download,
  Upload,
  Users,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { openDB } from 'idb';

interface QuickAction {
  title: string;
  description: string;
  icon: any;
  href?: string;
  action?: () => void;
  color: string;
  badge?: number | null;
  disabled?: boolean;
  loading?: boolean;
}

export default function SuperadminDashboard() {
  const { profile } = useAuth();
  const { getPendingCount, getFailedCount, syncNow } = useSync();
  const { isOnline } = useOfflineStatus();
  
  const [testing, setTesting] = useState(false);
  const [dbStatus, setDbStatus] = useState<'unknown' | 'connected' | 'error'>('unknown');
  const [edgeFunctionStatus, setEdgeFunctionStatus] = useState<'unknown' | 'healthy' | 'error'>('unknown');
  const [indexedDBStatus, setIndexedDBStatus] = useState<'unknown' | 'healthy' | 'error'>('unknown');
  const [lastTest, setLastTest] = useState<Date | null>(null);
  const [exporting, setExporting] = useState(false);

  const pendingCount = getPendingCount();
  const failedCount = getFailedCount();

  // Check IndexedDB on mount
  useEffect(() => {
    checkIndexedDB();
  }, []);

  // Test IndexedDB availability and functionality
  const checkIndexedDB = async () => {
    try {
      if (!('indexedDB' in window)) {
        setIndexedDBStatus('error');
        return;
      }

      const db = await openDB('womaniya-dashboard', 2);
      await db.close();
      setIndexedDBStatus('healthy');
    } catch (error) {
      console.error('IndexedDB check failed:', error);
      setIndexedDBStatus('error');
    }
  };

  // Test Supabase connection
  const testDatabaseConnection = async () => {
    setTesting(true);
    try {
      const startTime = Date.now();
      const { data, error } = await supabase.from('shops').select('count').limit(1).single();
      const responseTime = Date.now() - startTime;
      
      if (error && error.code !== 'PGRST116') {
        setDbStatus('error');
        toast.error(`Database Error: ${error.message}`);
      } else {
        setDbStatus('connected');
        toast.success(`Database connected (${responseTime}ms)`);
      }
      setLastTest(new Date());
    } catch (err) {
      setDbStatus('error');
      toast.error('Failed to connect to database');
    } finally {
      setTesting(false);
    }
  };

  // Test Edge Function (complete-sale) with health check
  const testEdgeFunction = async () => {
    setTesting(true);
    try {
      const startTime = Date.now();
      
      // Health check: invoke with minimal test payload
      const { data, error } = await supabase.functions.invoke('complete-sale', {
        body: { test: true, health_check: true }
      });
      
      const responseTime = Date.now() - startTime;
      
      // Edge function should return error for test payload, but being reachable means it's healthy
      if (error && error.message.includes('NetworkError')) {
        setEdgeFunctionStatus('error');
        toast.error('Edge function not reachable');
      } else {
        setEdgeFunctionStatus('healthy');
        toast.success(`Edge function healthy (${responseTime}ms)`);
      }
      
      setLastTest(new Date());
    } catch (err: any) {
      setEdgeFunctionStatus('error');
      toast.error(`Edge function error: ${err.message}`);
    } finally {
      setTesting(false);
    }
  };

  // Force sync all pending sales
  const handleForceSync = async () => {
    if (!isOnline) {
      toast.error('Cannot sync while offline');
      return;
    }
    
    setTesting(true);
    try {
      await syncNow();
      toast.success('Sync completed');
    } catch (error) {
      toast.error('Sync failed');
    } finally {
      setTesting(false);
    }
  };

  // Export database to JSON
  const handleExportDatabase = async () => {
    if (!profile?.shop_id) {
      toast.error('No shop selected');
      return;
    }

    setExporting(true);
    try {
      const exportData: any = {
        exported_at: new Date().toISOString(),
        shop_id: profile.shop_id,
        version: '1.0',
      };

      // Export shop data
      const { data: shop, error: shopError } = await supabase
        .from('shops')
        .select('*')
        .eq('id', profile.shop_id)
        .single();
      
      if (shopError) throw shopError;
      exportData.shop = shop;

      // Export inventory
      const { data: inventory, error: invError } = await supabase
        .from('inventory_items')
        .select('*')
        .eq('shop_id', profile.shop_id);
      
      if (invError) throw invError;
      exportData.inventory = inventory;

      // Export stock lots (skip if table doesn't exist)
      // const { data: lots, error: lotsError } = await supabase
      //   .from('stock_lots')
      //   .select('*')
      //   .eq('shop_id', profile.shop_id);
      // 
      // if (lotsError) throw lotsError;
      // exportData.stock_lots = lots;

      // Export QR codes
      const { data: qrCodes, error: qrError } = await supabase
        .from('qr_codes')
        .select('*')
        .eq('shop_id', profile.shop_id);
      
      if (qrError) throw qrError;
      exportData.qr_codes = qrCodes;

      // Export sales
      const { data: sales, error: salesError } = await supabase
        .from('sales')
        .select('*')
        .eq('shop_id', profile.shop_id);
      
      if (salesError) throw salesError;
      exportData.sales = sales;

      // Export profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .eq('shop_id', profile.shop_id);
      
      if (profilesError) throw profilesError;
      exportData.profiles = profiles;

      // Create and download JSON file
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `womaniya-backup-${shop.shop_name}-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success('Database exported successfully');
    } catch (error: any) {
      console.error('Export failed:', error);
      toast.error(`Export failed: ${error.message}`);
    } finally {
      setExporting(false);
    }
  };

  // Import database from JSON
  const handleImportDatabase = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = async (e: any) => {
      const file = e.target.files[0];
      if (!file) return;

      try {
        const text = await file.text();
        const importData = JSON.parse(text);

        if (!importData.shop_id || !importData.version) {
          toast.error('Invalid backup file format');
          return;
        }

        toast.info('Database import feature will be implemented with restore logic and conflict resolution');
        // TODO: Implement restore logic with:
        // 1. Backup current data
        // 2. Clear existing data (optional)
        // 3. Insert imported data
        // 4. Handle ID conflicts
        // 5. Verify integrity
      } catch (error: any) {
        toast.error(`Import failed: ${error.message}`);
      }
    };

    input.click();
  };

  const systemStatus = [
    {
      label: 'Database Connection',
      status: dbStatus === 'connected' ? 'healthy' : dbStatus === 'error' ? 'error' : 'unknown',
      icon: Database,
      action: testDatabaseConnection,
      actionLabel: 'Test Connection',
    },
    {
      label: 'Internet Connection',
      status: isOnline ? 'healthy' : 'offline',
      icon: isOnline ? Wifi : WifiOff,
    },
    {
      label: 'Offline Storage (IndexedDB)',
      status: indexedDBStatus,
      icon: HardDrive,
      action: checkIndexedDB,
      actionLabel: 'Recheck',
    },
    {
      label: 'Edge Functions',
      status: edgeFunctionStatus,
      icon: Server,
      action: testEdgeFunction,
      actionLabel: 'Test Function',
    },
  ];

  const syncMetrics = [
    {
      label: 'Pending Syncs',
      value: pendingCount,
      status: pendingCount === 0 ? 'good' : 'warning',
      icon: RefreshCw,
      href: pendingCount > 0 ? '/superadmin/sync-issues' : undefined,
    },
    {
      label: 'Failed Syncs',
      value: failedCount,
      status: failedCount === 0 ? 'good' : 'error',
      icon: AlertCircle,
      href: failedCount > 0 ? '/superadmin/sync-issues' : undefined,
    },
  ];

  const quickActions = [
    {
      title: 'Sync Issues',
      description: 'View and retry failed syncs',
      icon: AlertCircle,
      href: '/superadmin/sync-issues',
      gradient: 'from-red-500 to-rose-600',
      badge: failedCount > 0 ? failedCount : null,
    },
    {
      title: 'Export Database',
      description: 'Download shop data as JSON backup',
      icon: Download,
      action: handleExportDatabase,
      gradient: 'from-green-500 to-emerald-600',
      loading: exporting,
    },
    {
      title: 'Import Database',
      description: 'Restore from JSON backup (Coming Soon)',
      icon: Upload,
      action: handleImportDatabase,
      gradient: 'from-blue-500 to-indigo-600',
      disabled: true,
    },
    {
      title: 'Admin Dashboard',
      description: 'View shop operations and data',
      icon: BarChart3,
      href: '/admin',
      gradient: 'from-cyan-500 to-teal-600',
    },
    {
      title: 'System Logs',
      description: 'View error logs (Coming Soon)',
      icon: Activity,
      href: '#',
      gradient: 'from-purple-500 to-violet-600',
      disabled: true,
    },
    {
      title: 'Advanced Tools',
      description: 'Developer utilities (Coming Soon)',
      icon: Zap,
      href: '#',
      gradient: 'from-orange-500 to-amber-600',
      disabled: true,
    },
  ];

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-md">
          <ShieldCheck className="h-6 w-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">System Dashboard</h1>
          <p className="text-muted-foreground text-sm">
            Superadmin • {profile?.full_name}
          </p>
        </div>
      </div>

      {/* Tabs for different sections */}
      <Tabs defaultValue="system" className="w-full">
        <TabsList className="grid w-full grid-cols-2 lg:w-auto lg:inline-flex">
          <TabsTrigger value="system" className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            System Health
          </TabsTrigger>
          <TabsTrigger value="users" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            User Management
          </TabsTrigger>
        </TabsList>

        {/* System Health Tab */}
        <TabsContent value="system" className="space-y-4 md:space-y-6 mt-4">
          {/* System Health Status */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Activity className="h-5 w-5" />
                System Health
              </CardTitle>
              <CardDescription className="text-sm">
            Real-time status of all system components
            {lastTest && (
              <span className="ml-2 text-xs">
                • Last tested {lastTest.toLocaleTimeString()}
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {systemStatus.map((item) => (
            <div
              key={item.label}
              className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border rounded-lg gap-3"
            >
              <div className="flex items-center gap-3">
                <item.icon className="h-5 w-5 text-muted-foreground" />
                <span className="font-medium text-sm sm:text-base">{item.label}</span>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                {item.status === 'healthy' && (
                  <Badge variant="default" className="bg-green-500">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Healthy
                  </Badge>
                )}
                {item.status === 'error' && (
                  <Badge variant="destructive">
                    <XCircle className="h-3 w-3 mr-1" />
                    Error
                  </Badge>
                )}
                {item.status === 'offline' && (
                  <Badge variant="secondary">
                    <WifiOff className="h-3 w-3 mr-1" />
                    Offline
                  </Badge>
                )}
                {item.status === 'unknown' && (
                  <Badge variant="outline">Unknown</Badge>
                )}
                {item.action && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={item.action}
                    disabled={testing}
                    className="hover:scale-105 active:scale-95 transition-all"
                  >
                    {item.actionLabel}
                  </Button>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Sync Metrics */}
      <div className="grid gap-4 grid-cols-2">
        {syncMetrics.map((metric) => (
          <Card key={metric.label} className="hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{metric.label}</CardTitle>
              <metric.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="flex items-end justify-between">
                <div>
                  <div className="text-2xl font-bold">{metric.value}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {metric.status === 'good' && '✓ All clear'}
                    {metric.status === 'warning' && '⚠ Needs attention'}
                    {metric.status === 'error' && '✗ Action required'}
                  </p>
                </div>
                {metric.href && metric.value > 0 && (
                  <Link href={metric.href}>
                    <Button size="sm" variant="outline">View</Button>
                  </Link>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {quickActions.map((action) => {
            const CardWrapper = action.href && !action.disabled ? Link : 'div';
            const isClickable = action.action || (action.href && !action.disabled);
            
            return (
              <Card
                key={action.title}
                className={
                  action.disabled 
                    ? 'opacity-50 cursor-not-allowed' 
                    : isClickable
                    ? 'cursor-pointer hover:shadow-lg hover:scale-105 active:scale-95 transition-all'
                    : ''
                }
                onClick={action.action && !action.disabled && !action.loading ? action.action : undefined}
              >
                {action.href && !action.disabled ? (
                  <CardWrapper href={action.href}>
                    <CardHeader>
                      <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-lg bg-gradient-to-br ${action.gradient} text-white shadow-md flex-shrink-0`}>
                          <action.icon className={`h-6 w-6 ${action.loading ? 'animate-spin' : ''}`} />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <CardTitle className="text-lg">{action.title}</CardTitle>
                            {action.badge && (
                              <Badge variant="destructive" className="flex-shrink-0">{action.badge}</Badge>
                            )}
                          </div>
                          <CardDescription className="text-sm mt-1">{action.description}</CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                  </CardWrapper>
                ) : (
                  <CardHeader>
                    <div className="flex items-center gap-4">
                      <div className={`p-3 rounded-lg bg-gradient-to-br ${action.gradient} text-white shadow-md flex-shrink-0`}>
                        <action.icon className={`h-6 w-6 ${action.loading ? 'animate-spin' : ''}`} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <CardTitle className="text-lg">{action.title}</CardTitle>
                          {action.badge && (
                            <Badge variant="destructive" className="flex-shrink-0">{action.badge}</Badge>
                          )}
                        </div>
                        <CardDescription className="text-sm mt-1">{action.description}</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                )}
              </Card>
            );
          })}
        </div>
      </div>

      {/* Admin Actions */}
      {(pendingCount > 0 || failedCount > 0) && (
        <Card className="border-orange-200 bg-orange-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-900">
              <AlertCircle className="h-5 w-5" />
              Action Required
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendingCount > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-orange-900">
                  {pendingCount} sales waiting to sync
                </span>
                <Button
                  size="sm"
                  onClick={handleForceSync}
                  disabled={!isOnline || testing}
                  className="bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-600 hover:to-cyan-700 hover:scale-105 active:scale-95 transition-all"
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${testing ? 'animate-spin' : ''}`} />
                  Force Sync Now
                </Button>
              </div>
            )}
            {failedCount > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-orange-900">
                  {failedCount} sales failed to sync
                </span>
                <Link href="/superadmin/sync-issues">
                  <Button size="sm" variant="destructive">
                    View Issues
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
