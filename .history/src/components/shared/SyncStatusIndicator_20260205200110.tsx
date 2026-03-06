'use client';

/**
 * Sync Status Indicator Component
 * 
 * Displays sync status with pending/failed counts.
 * Can be used in TopBar, POS header, or any location.
 * 
 * Features:
 * - Shows pending count badge
 * - Indicates offline/syncing/error states
 * - Clickable to navigate to sync issues (optional)
 * - Animates during sync
 */

import { useSyncStatus } from '@/hooks/useSyncStatus';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Cloud,
  CloudOff,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface SyncStatusIndicatorProps {
  shopId?: string;
  variant?: 'icon' | 'badge' | 'full';
  showLabel?: boolean;
  onClick?: () => void;
  className?: string;
}

export function SyncStatusIndicator({
  shopId,
  variant = 'icon',
  showLabel = false,
  onClick,
  className,
}: SyncStatusIndicatorProps) {
  const {
    isOnline,
    syncing,
    status,
    pendingCount,
    failedCount,
    totalPending,
    statusMessage,
    syncNow,
  } = useSyncStatus(shopId);

  // Determine icon and colors based on status
  const getStatusIcon = () => {
    if (!isOnline) return <CloudOff className="h-4 w-4" />;
    if (syncing) return <Loader2 className="h-4 w-4 animate-spin" />;
    if (failedCount > 0) return <AlertCircle className="h-4 w-4" />;
    if (pendingCount > 0) return <RefreshCw className="h-4 w-4" />;
    return <Cloud className="h-4 w-4" />;
  };

  const getStatusColor = () => {
    if (!isOnline) return 'text-orange-500';
    if (syncing) return 'text-blue-500';
    if (failedCount > 0) return 'text-red-500';
    if (pendingCount > 0) return 'text-yellow-500';
    return 'text-green-500';
  };

  const getBadgeVariant = (): 'default' | 'secondary' | 'destructive' | 'outline' => {
    if (failedCount > 0) return 'destructive';
    if (!isOnline) return 'secondary';
    if (pendingCount > 0) return 'default';
    return 'outline';
  };

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else if (pendingCount > 0 && isOnline && !syncing) {
      syncNow();
    }
  };

  // Simple icon variant
  if (variant === 'icon') {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClick}
              className={cn('relative', getStatusColor(), className)}
              disabled={syncing}
            >
              {getStatusIcon()}
              {totalPending > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                  {totalPending > 9 ? '9+' : totalPending}
                </span>
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{statusMessage}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Badge variant
  if (variant === 'badge') {
    if (totalPending === 0 && isOnline) {
      return null; // Don't show badge when all synced
    }

    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge 
              variant={getBadgeVariant()} 
              className={cn('cursor-pointer gap-1', className)}
              onClick={handleClick}
            >
              {getStatusIcon()}
              {totalPending > 0 && <span>{totalPending}</span>}
              {showLabel && <span className="hidden sm:inline">{status}</span>}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p>{statusMessage}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Full variant with label
  return (
    <div 
      className={cn(
        'flex items-center gap-2 px-3 py-1.5 rounded-lg cursor-pointer transition-colors',
        !isOnline && 'bg-orange-100 dark:bg-orange-900/20',
        failedCount > 0 && 'bg-red-100 dark:bg-red-900/20',
        syncing && 'bg-blue-100 dark:bg-blue-900/20',
        pendingCount > 0 && isOnline && !syncing && 'bg-yellow-100 dark:bg-yellow-900/20',
        totalPending === 0 && isOnline && 'bg-green-100 dark:bg-green-900/20',
        className
      )}
      onClick={handleClick}
    >
      <span className={getStatusColor()}>{getStatusIcon()}</span>
      <span className="text-sm font-medium">{statusMessage}</span>
      {totalPending > 0 && (
        <Badge variant={getBadgeVariant()} className="ml-1">
          {totalPending}
        </Badge>
      )}
    </div>
  );
}
