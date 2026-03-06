'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { BrandLoader } from '@/components/shared/BrandLoader';

export default function SuperadminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { profile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && profile && profile.role !== 'superadmin') {
      // Non-superadmin trying to access - redirect to appropriate page
      router.replace(profile.role === 'staff' ? '/pos' : '/admin');
    }
  }, [profile, loading, router]);

  // Show loading state
  if (loading) {
    return <BrandLoader message="Loading system dashboard..." />;
  }

  // Don't render if not superadmin
  if (!profile || profile.role !== 'superadmin') {
    return null;
  }

  return <>{children}</>;
}
