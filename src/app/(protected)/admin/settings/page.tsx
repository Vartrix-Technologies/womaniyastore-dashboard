'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

/**
 * Legacy redirect: Settings have moved to /settings (accessible to all roles).
 * This page redirects any old bookmarks or links.
 */
export default function AdminSettingsRedirect() {
  const router = useRouter();
  
  useEffect(() => {
    router.replace('/settings');
  }, [router]);

  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <p className="text-muted-foreground">Redirecting to settings...</p>
    </div>
  );
}
