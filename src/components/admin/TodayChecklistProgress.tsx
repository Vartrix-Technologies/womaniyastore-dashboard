'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/EmptyState';
import { toast } from 'sonner';
import {
  Activity,
  CheckCircle2,
  ChevronDown,
  Clock,
  ListChecks,
  RefreshCw,
  User,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  getTodaysChecklists,
  createChecklistInstances,
  completeChecklistItem,
  uncompleteChecklistItem,
  type ChecklistInstanceWithDetails,
} from '@/lib/api/checklists-v2';
import { appConfig } from '@/lib/config/app.config';

const s = appConfig.styles;
const a = s.accent;

export function TodayChecklistProgress() {
  const { profile } = useAuth();
  const [checklists, setChecklists] = useState<ChecklistInstanceWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingItems, setUpdatingItems] = useState<Set<string>>(new Set());
  const [collapsed, setCollapsed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadChecklists = useCallback(async (showToast = false) => {
    if (!profile?.shop_id) return;
    try {
      const today = new Date().toISOString().split('T')[0];
      const data = await getTodaysChecklists(profile.shop_id, today);

      // If no instances exist, auto-create them
      if (data.length === 0) {
        await createChecklistInstances(profile.shop_id, today);
        const retryData = await getTodaysChecklists(profile.shop_id, today);
        setChecklists(retryData);
      } else {
        setChecklists(data);
      }

      if (showToast) toast.success('Refreshed');
    } catch (error) {
      console.error('Error loading today\'s checklists:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [profile?.shop_id]);

  useEffect(() => {
    if (!profile?.shop_id) return;
    loadChecklists();

    let interval: ReturnType<typeof setInterval> | null = null;

    const startPolling = () => {
      if (!interval) interval = setInterval(() => loadChecklists(), 60000);
    };
    const stopPolling = () => {
      if (interval) { clearInterval(interval); interval = null; }
    };

    // Only poll when tab is visible
    const onVisibility = () => {
      if (document.visibilityState === 'visible') startPolling();
      else stopPolling();
    };

    if (document.visibilityState === 'visible') startPolling();
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      stopPolling();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [profile?.shop_id, loadChecklists]);

  const handleToggleItem = useCallback(async (
    instanceId: string,
    checklistItemId: string,
    isCompleted: boolean
  ) => {
    if (!profile?.id) return;
    const key = `${instanceId}-${checklistItemId}`;
    setUpdatingItems(prev => new Set(prev).add(key));

    try {
      if (isCompleted) {
        await uncompleteChecklistItem(instanceId, checklistItemId);
      } else {
        await completeChecklistItem(instanceId, checklistItemId, profile.id);
      }
      await loadChecklists();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update item');
    } finally {
      setUpdatingItems(prev => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  }, [profile?.id, loadChecklists]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadChecklists(true);
  };

  // Aggregates
  const totalItems = checklists.reduce((sum, c) => sum + c.total_items, 0);
  const completedItems = checklists.reduce((sum, c) => sum + c.completed_items, 0);
  const overallPercent = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;
  const allComplete = totalItems > 0 && completedItems === totalItems;

  // Loading skeleton
  if (loading) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-5 rounded" />
            <Skeleton className="h-5 w-36" />
          </div>
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
        <Skeleton className="h-2 w-full rounded-full" />
        <div className="grid gap-3 md:grid-cols-2">
          {[1, 2].map(i => (
            <Card key={i}>
              <CardContent className="p-4 space-y-3">
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-2 w-full rounded-full" />
                {[1, 2].map(j => (
                  <div key={j} className="flex items-center gap-2">
                    <Skeleton className="h-4 w-4 rounded" />
                    <Skeleton className="h-3 flex-1" />
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (checklists.length === 0) {
    return (
      <Card className={`border-dashed ${a.border}`}>
        <CardContent className="py-6">
          <EmptyState
            icon={ListChecks}
            title="No tasks scheduled for today"
            description="Active checklists matching today will appear here automatically"
            className="h-auto py-2"
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3 animate-content-in">
      {/* Summary Strip */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => setCollapsed(!collapsed)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setCollapsed(!collapsed); } }}
        className={cn(
          'w-full rounded-xl border px-4 py-3 flex items-center gap-3 transition-all cursor-pointer',
          allComplete
            ? 'bg-green-50/60 border-green-200 dark:bg-green-950/20 dark:border-green-800'
            : `${a.bg} ${a.border}`,
          s.btnAnimationSubtle
        )}
      >
        {/* Pulse dot */}
        <div className="relative shrink-0">
          <div className={cn(
            'w-2.5 h-2.5 rounded-full',
            allComplete ? 'bg-green-500' : `bg-gradient-to-br ${s.primaryGradientStops}`
          )} />
          {!allComplete && (
            <div className={`absolute inset-0 w-2.5 h-2.5 rounded-full bg-gradient-to-br ${s.primaryGradientStops} animate-ping opacity-40`} />
          )}
        </div>

        {/* Label + percent */}
        <div className="flex-1 min-w-0 text-left">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">
              {allComplete ? 'All Tasks Complete!' : "Today's Progress"}
            </span>
            <span className={cn(
              'text-xs font-bold tabular-nums',
              allComplete ? 'text-green-600' : a.text
            )}>
              {completedItems}/{totalItems}
            </span>
          </div>
          {/* Progress bar */}
          <div className="mt-1.5 h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-500',
                allComplete ? 'bg-green-500' : `bg-gradient-to-r ${s.primaryGradientStops}`
              )}
              style={{ width: `${overallPercent}%` }}
            />
          </div>
        </div>

        {/* Percent badge */}
        <Badge
          variant="secondary"
          className={cn(
            'shrink-0 text-xs font-bold tabular-nums',
            allComplete && 'bg-green-100 text-green-700 border-green-200'
          )}
        >
          {overallPercent}%
        </Badge>

        {/* Refresh */}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          onClick={(e) => { e.stopPropagation(); handleRefresh(); }}
          disabled={refreshing}
        >
          <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
        </Button>

        {/* Chevron */}
        <ChevronDown className={cn(
          'h-4 w-4 text-muted-foreground shrink-0 transition-transform',
          !collapsed && 'rotate-180'
        )} />
      </div>

      {/* Expandable checklist cards */}
      {!collapsed && (
        <div className="grid gap-3 md:grid-cols-2 animate-content-in">
          {checklists.map((instance) => {
            const progress = instance.total_items > 0
              ? Math.round((instance.completed_items / instance.total_items) * 100)
              : 0;
            const isDone = instance.status === 'completed';

            return (
              <Card
                key={instance.id}
                className={cn(
                  'relative overflow-hidden transition-all',
                  isDone && 'border-green-200 dark:border-green-800'
                )}
              >
                {/* Top accent strip */}
                <div className={cn(
                  'absolute top-0 left-0 right-0 h-0.5',
                  isDone
                    ? 'bg-green-500'
                    : `bg-gradient-to-r ${s.primaryGradientStops}`
                )} />

                <CardContent className="p-4 pt-5 space-y-3">
                  {/* Checklist name + count */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2 min-w-0">
                      <div className={cn(
                        'p-1.5 rounded-md shrink-0',
                        isDone
                          ? 'bg-green-100 text-green-600'
                          : `bg-gradient-to-br ${s.primaryGradientStops} text-white`
                      )}>
                        <ListChecks className="h-3.5 w-3.5" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-sm font-semibold truncate">{instance.checklist.name}</h4>
                        {instance.checklist.description && (
                          <p className="text-[11px] text-muted-foreground truncate">{instance.checklist.description}</p>
                        )}
                      </div>
                    </div>
                    <Badge
                      variant={isDone ? 'default' : 'secondary'}
                      className={cn(
                        'shrink-0 text-[10px] font-bold tabular-nums',
                        isDone && 'bg-green-500 hover:bg-green-500'
                      )}
                    >
                      {instance.completed_items}/{instance.total_items}
                    </Badge>
                  </div>

                  {/* Progress */}
                  <div className="space-y-1">
                    <Progress value={progress} className="h-1.5" />
                    <p className="text-[10px] text-muted-foreground text-right tabular-nums">{progress}%</p>
                  </div>

                  {/* Items */}
                  <div className="space-y-1.5">
                    {instance.items.map((item) => {
                      const isCompleted = !!item.completion;
                      const itemKey = `${instance.id}-${item.id}`;
                      const isUpdating = updatingItems.has(itemKey);

                      return (
                        <div
                          key={item.id}
                          className={cn(
                            'flex items-start gap-2.5 p-2 rounded-lg border transition-colors',
                            isCompleted
                              ? 'bg-muted/40 border-muted'
                              : 'hover:bg-muted/30 border-transparent'
                          )}
                        >
                          <Checkbox
                            checked={isCompleted}
                            onCheckedChange={() => handleToggleItem(instance.id, item.id, isCompleted)}
                            disabled={isUpdating}
                            className="mt-0.5"
                          />
                          <div className="flex-1 min-w-0">
                            <p className={cn(
                              'text-sm leading-tight',
                              isCompleted && 'line-through text-muted-foreground'
                            )}>
                              {item.label}
                            </p>
                            {item.completion && (
                              <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground">
                                <User className="h-3 w-3 shrink-0" />
                                <span className="truncate">
                                  {item.completion.completed_by_profile?.full_name === profile?.full_name
                                    ? 'You'
                                    : item.completion.completed_by_profile?.full_name || 'Someone'}
                                </span>
                                <Clock className="h-3 w-3 shrink-0 ml-1" />
                                <span className="tabular-nums">
                                  {new Date(item.completion.completed_at).toLocaleTimeString('en-US', {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Done banner */}
                  {isDone && (
                    <div className="flex items-center justify-center gap-1.5 py-2 px-3 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <span className="text-xs font-medium text-green-600">All done!</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Auto-refresh hint */}
      <div className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground/60">
        <Activity className="h-3 w-3" />
        <span>Live — refreshes every 30s</span>
      </div>
    </div>
  );
}
