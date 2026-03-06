'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, ShoppingCart, ChevronUp, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { appConfig } from '@/lib/config/app.config';
import type { UserRole } from '@/types';

const s = appConfig.styles;

interface BottomNavProps {
  role: UserRole;
  currentPath: string;
}

const AUTO_HIDE_DELAY = 3000; // ms before auto-hiding

export function BottomNav({ role, currentPath }: BottomNavProps) {
  const pathname = usePathname();
  const [visible, setVisible] = useState(true);
  const [pinned, setPinned] = useState(false); // mobile toggle pin
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastScrollY = useRef(0);
  const navRef = useRef<HTMLDivElement>(null);

  // Determine home route based on role
  const getHomeRoute = () => {
    if (role === 'superadmin') return '/superadmin';
    if (role === 'owner' || role === 'admin') return '/admin';
    return '/me'; // Staff dashboard
  };

  // 2 fixed navigation items for all users
  const navItems = [
    { 
      href: getHomeRoute(), 
      label: 'Home', 
      icon: Home,
      isHome: true,
    },
    { 
      href: '/pos', 
      label: 'POS', 
      icon: ShoppingCart,
      isHome: false,
    },
  ];

  // Reset and start the auto-hide timer
  const resetHideTimer = useCallback(() => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    setVisible(true);
    hideTimerRef.current = setTimeout(() => {
      if (!pinned) setVisible(false);
    }, AUTO_HIDE_DELAY);
  }, [pinned]);

  // Scroll-based show/hide: show on scroll up, hide on scroll down
  useEffect(() => {
    const handleScroll = () => {
      if (pinned) return;
      const currentScrollY = window.scrollY;
      if (currentScrollY < lastScrollY.current - 10) {
        // Scrolling UP — show
        resetHideTimer();
      } else if (currentScrollY > lastScrollY.current + 10) {
        // Scrolling DOWN — hide
        if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
        setVisible(false);
      }
      lastScrollY.current = currentScrollY;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [pinned, resetHideTimer]);

  // Desktop: show on mouse near bottom of viewport
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (pinned) return;
      const threshold = 48; // px from bottom edge
      if (e.clientY >= window.innerHeight - threshold) {
        resetHideTimer();
      }
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [pinned, resetHideTimer]);

  // Show briefly on page load then start hide timer
  useEffect(() => {
    resetHideTimer();
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [pathname, resetHideTimer]);

  // When pinned changes, update visibility
  useEffect(() => {
    if (pinned) {
      setVisible(true);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    } else {
      resetHideTimer();
    }
  }, [pinned, resetHideTimer]);

  const togglePin = () => setPinned((prev) => !prev);

  return (
    <>
      {/* Toggle tab — always visible at bottom-right */}
      <button
        onClick={togglePin}
        className={cn(
          'fixed right-4 z-50 p-2 rounded-t-lg border border-b-0 border-border bg-background shadow-md',
          'transition-all duration-300 ease-in-out',
          'hover:bg-muted active:scale-95',
          visible ? 'bottom-[68px]' : 'bottom-0'
        )}
        aria-label={visible ? 'Hide navigation' : 'Show navigation'}
      >
        {visible ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {/* Bottom navigation bar */}
      <nav
        ref={navRef}
        className={cn(
          'fixed left-0 right-0 bg-background border-t border-border z-50 shadow-lg',
          'transition-transform duration-300 ease-in-out',
          visible ? 'translate-y-0 bottom-0' : 'translate-y-full bottom-0'
        )}
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="container-boxed">
          <div className="grid grid-cols-2 gap-3 p-1">
            {navItems.map(({ href, label, icon: Icon, isHome }) => {
              const isActive = isHome 
                ? (pathname === '/me' || pathname === '/admin' || pathname === '/superadmin' || pathname.startsWith('/admin') && !pathname.startsWith('/admin/settings') && pathname !== '/admin/inventory' && pathname !== '/admin/sales' && pathname !== '/admin/finances' && pathname !== '/admin/qr-codes' && pathname !== '/admin/staff' && pathname !== '/admin/attendance' && pathname !== '/admin/checklists' && pathname !== '/admin/sync-issues')
                : pathname === href || pathname.startsWith(href + '/') || pathname.startsWith(href + '?');

              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    'flex flex-col items-center justify-center gap-1.5 p-3 rounded-lg relative',
                    'transition-all duration-200',
                    s.btnAnimation,
                    isActive
                      ? `text-white font-semibold bg-gradient-to-br ${s.headerIconGradient} shadow-md`
                      : 'text-muted-foreground hover:text-foreground hover:bg-gray-100 dark:hover:bg-gray-800'
                  )}
                >
                  <Icon className="h-6 w-6" />
                  <span className="text-xs font-medium">{label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </nav>
    </>
  );
}
