'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { SyncProvider } from '@/context/SyncContext';
import { useOfflineStatus } from '@/hooks/useOfflineStatus';
import { useSync } from '@/context/SyncContext';
import { supabase } from '@/lib/supabase';
import { Badge } from '@/components/ui/badge';
import { WifiOff, Wifi, AlertCircle } from 'lucide-react';
import { FloatingPOSButton } from '@/components/tablet/FloatingPOSButton';
import { TopBar } from '@/components/tablet/TopBar';
import { PwaInstallBanner } from '@/components/shared/PwaInstallBanner';
import { CommandPalette } from '@/components/shared/CommandPalette';
import { BrandLoader } from '@/components/shared/BrandLoader';

function ProtectedContent({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { isOnline, wasOffline } = useOfflineStatus();
  const { getFailedCount, inventoryCaching } = useSync();
  const [shopName, setShopName] = useState<string | undefined>(undefined);

  useEffect(() => {
    console.log('[ProtectedLayout] auth check', { loading, hasUser: !!user, hasProfile: !!profile, pathname });
    if (loading) return;
    if (!user) {
      console.log('[ProtectedLayout] No user → /login');
      router.replace('/login');
    } else if (!profile) {
      // User session exists but profile couldn't load (stale token, RLS error, etc.)
      console.log('[ProtectedLayout] No profile → /login');
      router.replace('/login');
    }
  }, [user, profile, loading, router, pathname]);

  // Fetch shop name when profile is available
  useEffect(() => {
    async function fetchShopName() {
      if (profile?.shop_id) {
        const { data } = await supabase
          .from('shops')
          .select('shop_name')
          .eq('id', profile.shop_id)
          .single();
        if (data) setShopName(data.shop_name);
      }
    }
    fetchShopName();
  }, [profile?.shop_id]);

  // Show loading state
  if (loading) {
    return <BrandLoader message="Loading your dashboard..." />;
  }

  // Don't render if not authenticated
  if (!user || !profile) {
    return null;
  }

  // Filter sync counts by shop for non-superadmin users
  const failedCount = profile.role === 'superadmin' 
    ? getFailedCount() 
    : getFailedCount(profile.shop_id || undefined);

  return (
    <div className="min-h-screen bg-background">
      {/* PWA Install Banner */}
      <PwaInstallBanner />

      {/* Top Bar */}
      <TopBar profile={profile} shopName={shopName} />

      {/* Command Palette (Ctrl+K) */}
      <CommandPalette profile={profile} />

      {/* Online/Offline Status Banner */}
      {!isOnline && (
        <div className="bg-orange-500 text-white px-4 py-3 flex items-center gap-2 sticky top-14 z-40">
          <WifiOff className="h-5 w-5" />
          <span className="text-sm font-medium">
            You are offline. Sales will be synced when back online.
          </span>
        </div>
      )}

      {wasOffline && isOnline && (
        <div className="bg-green-500 text-white px-4 py-3 flex items-center gap-2 sticky top-14 z-40">
          <Wifi className="h-5 w-5" />
          <span className="text-sm font-medium">
            Back online! Syncing pending sales & refreshing inventory cache...
          </span>
        </div>
      )}

      {/* Failed Sync Warning */}
      {failedCount > 0 && (
        <div className="bg-destructive text-destructive-foreground px-4 py-3 flex items-center gap-2 sticky top-14 z-40">
          <AlertCircle className="h-5 w-5" />
          <span className="text-sm font-medium">
            {failedCount} sale(s) failed to sync. Check Sync Issues.
          </span>
        </div>
      )}

      {/* Main Content */}
      <main className="container-boxed py-6 pb-8">
        {children}
      </main>

      {/* Floating POS FAB */}
      <FloatingPOSButton role={profile.role} />
    </div>
  );
}

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SyncProvider>
      <ProtectedContent>{children}</ProtectedContent>
    </SyncProvider>
  );
}
