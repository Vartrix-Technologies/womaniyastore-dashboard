'use client';

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
import { SyncStatusIndicator } from '@/components/shared/SyncStatusIndicator';
import { appConfig, getLogoGradientClasses } from '@/lib/config';
import { LogOut, User, RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import type { Profile } from '@/types';

interface TopBarProps {
  profile: Profile;
  shopName?: string;
}

export function TopBar({ profile, shopName }: TopBarProps) {
  const { signOut } = useAuth();
  const router = useRouter();

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

  const handleRefresh = () => {
    window.location.reload();
    toast.success('Page refreshed');
  };

  const initials = profile.full_name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <header className="sticky top-0 z-50 bg-gradient-to-r from-slate-50 to-teal-50 border-b border-slate-200">
      <div className="container-boxed">
        <div className="flex items-center justify-between h-14">
          {/* Logo and Brand */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center shadow-sm">
              <span className="text-white text-lg font-bold">W</span>
            </div>
            <div>
              <h1 className="text-base font-bold leading-tight">Womaniya</h1>
              {shopName && <p className="text-[10px] text-muted-foreground leading-tight">{shopName}</p>}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Sync Status Indicator */}
            <SyncStatusIndicator 
              shopId={profile.shop_id || undefined} 
              variant="icon" 
            />

            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              className="gap-2 transition-all hover:scale-105 active:scale-95"
            >
              <RefreshCw className="h-4 w-4" />
              <span className="text-sm font-medium hidden sm:inline">Refresh</span>
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-10 w-10 rounded-full p-0 transition-all hover:scale-110 active:scale-95 hover:ring-2 hover:ring-primary/20">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-gradient-to-br from-rose-400 to-pink-500 text-white font-semibold">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end">
                <DropdownMenuLabel>
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium">{profile.full_name}</p>
                    <p className="text-xs text-muted-foreground capitalize">
                      {profile.role}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut}>
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Sign out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </header>
  );
}
