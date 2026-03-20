'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { ShoppingCart, Home } from 'lucide-react';
import { cn } from '@/lib/utils';
import { appConfig } from '@/lib/config/app.config';
import type { UserRole } from '@/types';

const s = appConfig.styles;

interface FloatingPOSButtonProps {
  role: UserRole;
}

export function FloatingPOSButton({ role }: FloatingPOSButtonProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [showPulse, setShowPulse] = useState(false);

  const isOnPOS = pathname === '/pos' || pathname.startsWith('/pos/') || pathname.startsWith('/pos?');

  // Determine home route based on role
  const getHomeRoute = () => {
    if (role === 'superadmin') return '/superadmin';
    if (role === 'owner' || role === 'admin') return '/admin';
    return '/me';
  };

  // Show a subtle pulse on first visit (once per session)
  useEffect(() => {
    const key = 'fab-pulse-shown';
    if (!sessionStorage.getItem(key)) {
      setShowPulse(true);
      sessionStorage.setItem(key, '1');
      const timer = setTimeout(() => setShowPulse(false), 3000);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleClick = () => {
    if (isOnPOS) {
      router.push(getHomeRoute());
    } else {
      router.push('/pos');
    }
  };

  const Icon = isOnPOS ? Home : ShoppingCart;
  const label = isOnPOS ? 'Go Home' : 'Open POS';

  return (
    <button
      onClick={handleClick}
      aria-label={label}
      className={cn(
        // Size & shape
        'fixed z-50 flex items-center justify-center',
        'h-14 w-14 rounded-full',
        // Position — bottom-right with safe-area support
        'right-5 bottom-5',
        // Gradient background
        `bg-gradient-to-br ${s.headerIconGradient}`,
        // Shadow & ring
        'shadow-lg shadow-brand-500/30',
        // Interaction
        'cursor-pointer hover:scale-105 hover:shadow-xl hover:shadow-brand-500/40 active:scale-110 transition-all duration-200',
        // Pulse ring on first visit
        showPulse && 'animate-pulse ring-4 ring-brand-400/40'
      )}
      style={{ bottom: `max(1.25rem, env(safe-area-inset-bottom, 0px))` }}
    >
      <Icon className="h-6 w-6 text-white" />
    </button>
  );
}
