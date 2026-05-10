'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { SyncStatusIndicator } from '@/components/shared/SyncStatusIndicator';
import { ThemePickerDialog } from '@/components/shared/ThemePickerDialog';
import { ProcessReturnDialog } from '@/components/shared/ProcessReturnDialog';
import { appConfig } from '@/lib/config';
import { LogOut, Settings, HelpCircle, Palette, Sun, Moon, Search, BookOpen, RotateCcw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { toast } from 'sonner';
import type { Profile } from '@/types';

const s = appConfig.styles;

interface TopBarProps {
  profile: Profile;
  shopName?: string;
}

export function TopBar({ profile, shopName }: TopBarProps) {
  const { signOut } = useAuth();
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [themePickerOpen, setThemePickerOpen] = useState(false);
  const [returnDialogOpen, setReturnDialogOpen] = useState(false);

  useEffect(() => setMounted(true), []);

  const isDark = mounted && resolvedTheme === 'dark';

  const handleSignOut = async () => {
    try {
      await signOut();
      toast.success('Signed out successfully');
      router.push('/login');
    } catch (error) {
      console.error('Sign out error:', error);
      toast.error('Failed to sign out');
    }
  };

  const toggleTheme = () => {
    setTheme(isDark ? 'light' : 'dark');
  };

  const initials = profile.full_name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <header
      className="sticky top-0 z-50 border-b backdrop-blur-xl transition-colors duration-200"
      style={{
        paddingTop: 'env(safe-area-inset-top, 0px)',
        background: isDark
          ? `color-mix(in srgb, var(--color-brand-950) 70%, rgba(30, 33, 38, 0.92))`
          : `color-mix(in srgb, var(--color-brand-50) 70%, rgba(255, 255, 255, 0.88))`,
        borderColor: isDark
          ? `color-mix(in srgb, var(--color-brand-800) 90%, rgba(55, 59, 66, 0.5))`
          : `color-mix(in srgb, var(--color-brand-200) 90%, rgba(226, 232, 240, 0.8))`,
        boxShadow: isDark
          ? '0 1px 2px rgba(0,0,0,0.25)'
          : '0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.02)',
      }}
    >
      <div className="container-boxed">
        <div className="flex items-center justify-between h-14">
          {/* Logo and Brand */}
          <button
            onClick={() => {
              const home = profile.role === 'superadmin' ? '/superadmin' : (profile.role === 'owner' || profile.role === 'admin') ? '/admin' : '/me';
              router.push(home);
            }}
            className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
          >
            <div className="w-9 h-9 rounded-xl overflow-hidden flex items-center justify-center">
              <img
                src={appConfig.billing.logoDarkPath}
                alt={appConfig.brand.name}
                width={36}
                height={36}
                className="w-9 h-9 object-contain dark:hidden"
              />
              <img
                src={appConfig.billing.logoPath}
                alt={appConfig.brand.name}
                width={36}
                height={36}
                className="w-9 h-9 object-contain hidden dark:block"
              />
            </div>
            <div className="flex flex-col">
              <h1 className={`text-[15px] sm:text-[14px] md:text-[15px] lg:text-[18px] font-bold tracking-tight leading-tight ${isDark ? 'text-slate-200' : 'text-foreground'}`}>
                {shopName || appConfig.brand.name}
              </h1>
            </div>
          </button>

          <div className="flex items-center gap-1">
            <TooltipProvider delayDuration={300}>
              {/* Search — opens command palette */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => window.dispatchEvent(new CustomEvent('open-command-palette'))}
                    className={`h-8 w-8 rounded-lg transition-all active:bg-brand-500/20 dark:active:bg-brand-400/20 ${s.btnAnimation}`}
                  >
                    <Search className={`h-4 w-4 ${isDark ? 'text-slate-300/70' : 'text-muted-foreground'}`} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent><p>Search (Ctrl+K)</p></TooltipContent>
              </Tooltip>

              {/* Theme Toggle */}
              {mounted && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={toggleTheme}
                      className={`h-8 w-8 rounded-lg transition-all active:bg-brand-500/20 dark:active:bg-brand-400/20 ${s.btnAnimation}`}
                    >
                      {isDark ? (
                        <Sun className="h-4 w-4 text-amber-300/70" />
                      ) : (
                        <Moon className="h-4 w-4 text-muted-foreground" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent><p>{isDark ? 'Switch to light mode' : 'Switch to dark mode'}</p></TooltipContent>
                </Tooltip>
              )}

              {/* Settings */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => router.push('/settings')}
                    className={`h-8 w-8 rounded-lg transition-all active:bg-brand-500/20 dark:active:bg-brand-400/20 ${s.btnAnimation}`}
                  >
                    <Settings className={`h-4 w-4 ${isDark ? 'text-slate-300/70' : 'text-muted-foreground'}`} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent><p>Settings</p></TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {/* Account */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className={`relative h-9 w-9 rounded-full p-0 transition-all ${s.btnAnimation}`}
                >
                  <Avatar className={`h-9 w-9 border-2 shadow-sm border-brand-500/30`}>
                    <AvatarFallback className={`font-semibold text-xs ${isDark ? 'bg-gradient-to-br from-brand-600/70 to-brand-to/70 text-slate-200' : 'bg-gradient-to-br from-brand-from to-brand-to text-white'}`}>
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-52 rounded-xl shadow-lg" align="end" sideOffset={8}>
                <DropdownMenuLabel className="pb-2">
                  <p className="text-sm font-semibold truncate">{profile.full_name}</p>
                  <p className="text-[11px] text-muted-foreground capitalize">{profile.role}</p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="gap-2 rounded-lg cursor-default focus:bg-transparent p-0">
                  <SyncStatusIndicator
                    shopId={profile.shop_id || undefined}
                    variant="full"
                    className="w-full text-xs"
                  />
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => router.push('/faqs')} className="gap-2 rounded-lg cursor-pointer">
                  <HelpCircle className="h-4 w-4 text-muted-foreground" />
                  FAQ&apos;s
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push('/guide')} className="gap-2 rounded-lg cursor-pointer">
                  <BookOpen className="h-4 w-4 text-muted-foreground" />
                  User Guide
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setThemePickerOpen(true)} className="gap-2 rounded-lg cursor-pointer">
                  <Palette className="h-4 w-4 text-muted-foreground" />
                  Theme
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setReturnDialogOpen(true)} className="gap-2 rounded-lg cursor-pointer">
                  <RotateCcw className="h-4 w-4 text-muted-foreground" />
                  Mark a Return
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleSignOut}
                  className="gap-2 rounded-lg cursor-pointer text-red-500 focus:text-red-500"
                >
                  <LogOut className="h-4 w-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Theme Picker Dialog */}
      <ThemePickerDialog open={themePickerOpen} onOpenChange={setThemePickerOpen} />

      {/* Process Return Dialog */}
      <ProcessReturnDialog open={returnDialogOpen} onOpenChange={setReturnDialogOpen} />
    </header>
  );
}
