'use client';

import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { BrandLoader } from '@/components/shared/BrandLoader';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { profile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!profile) {
        router.replace('/login');
        return;
      }

      if (!['admin', 'owner', 'superadmin'].includes(profile.role)) {
        router.replace('/');
        return;
      }
    }
  }, [loading, profile, router]);

  if (loading) {
    return <BrandLoader message="Loading admin panel..." />;
  }

  if (!profile || !['admin', 'owner', 'superadmin'].includes(profile.role)) {
    return null;
  }

  return <>{children}</>;
}
