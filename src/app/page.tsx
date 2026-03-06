'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { getHomeRoute } from '@/context/AuthContext';
import { BrandLoader } from '@/components/shared/BrandLoader';

/**
 * Root Landing Page — pure redirect hub.
 *
 * This page should NEVER be visible for more than ~1-2 seconds.
 * Auth state is resolved by AuthContext (with cached profile for speed).
 * Once loading=false, we redirect based on user/profile.
 */
export default function RootPage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const hasRedirected = useRef(false);

  useEffect(() => {
    console.log('[RootPage] render', { loading, hasUser: !!user, hasProfile: !!profile });

    if (loading) return;
    if (hasRedirected.current) return;

    if (!user) {
      hasRedirected.current = true;
      console.log('[RootPage] No user → /login');
      router.replace('/login');
    } else if (profile) {
      hasRedirected.current = true;
      const dest = getHomeRoute(profile);
      console.log(`[RootPage] Redirecting to ${dest} (role=${profile.role})`);
      router.replace(dest);
    } else {
      // user exists but profile is null — stale session
      hasRedirected.current = true;
      console.warn('[RootPage] User session exists but profile null — /login');
      router.replace('/login');
    }
  }, [user, profile, loading, router]);

  return <BrandLoader message="Preparing your workspace..." />;
}
