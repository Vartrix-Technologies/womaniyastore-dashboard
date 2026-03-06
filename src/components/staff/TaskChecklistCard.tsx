'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { Calendar, CheckCircle2, Clock, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/EmptyState';
import {
  getTodaysChecklists,
  completeChecklistItem,
  uncompleteChecklistItem,
  type ChecklistInstanceWithDetails,
} from '@/lib/api/checklists-v2';

// ── Shared hook — single fetch + 30s interval ────────────────────────

export interface TaskChecklistHookData {
  checklists: ChecklistInstanceWithDetails[];
  loading: boolean;
  updatingItems: Set<string>;
  handleToggleItem: (instanceId: string, checklistItemId: string, isCompleted: boolean) => Promise<void>;
}

export function useTaskChecklists(): TaskChecklistHookData {
  const { profile } = useAuth();
  const [checklists, setChecklists] = useState<ChecklistInstanceWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingItems, setUpdatingItems] = useState<Set<string>>(new Set());

  const loadChecklists = useCallback(async () => {
    if (!profile?.shop_id) return;
    try {
      setLoading(true);
      const today = new Date().toISOString().split('T')[0];
      const data = await getTodaysChecklists(profile.shop_id, today);
      setChecklists(data);
    } catch (error) {
      console.error('Error loading checklists:', error);
      toast.error('Failed to load checklists');
    } finally {
      setLoading(false);
    }
  }, [profile?.shop_id]);

  useEffect(() => {
    if (profile?.shop_id) {
      loadChecklists();
      const interval = setInterval(loadChecklists, 30000);
      return () => clearInterval(interval);
    }
  }, [profile?.shop_id, loadChecklists]);

  const handleToggleItem = useCallback(async (
    instanceId: string,
    checklistItemId: string,
    isCompleted: boolean
  ) => {
    if (!profile?.id) return;

    const key = `${instanceId}-${checklistItemId}`;
    setUpdatingItems(prev => {
      if (prev.has(key)) return prev;
      return new Set(prev).add(key);
    });

    try {
      if (isCompleted) {
        await uncompleteChecklistItem(instanceId, checklistItemId);
        toast.success('Item marked as incomplete');
      } else {
        await completeChecklistItem(instanceId, checklistItemId, profile.id);
        toast.success('Item completed!');
      }
      await loadChecklists();
    } catch (error: any) {
      console.error('Error updating item:', error);
      toast.error(error.message || 'Failed to update item');
    } finally {
      setUpdatingItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(key);
        return newSet;
      });
    }
  }, [profile?.id, loadChecklists]);

  return { checklists, loading, updatingItems, handleToggleItem };
}

// ── Component ────────────────────────────────────────────────────────

interface TaskChecklistCardProps {
  showCompactSummary?: boolean;
  compact?: boolean;
  /** Pass shared hook data to avoid duplicate fetches when multiple instances render */
  hookData?: TaskChecklistHookData;
}

export function TaskChecklistCard({ showCompactSummary = false, compact = false, hookData }: TaskChecklistCardProps) {
  // Internal fetch — disabled when hookData is provided
  const { profile } = useAuth();
  const [internalChecklists, setInternalChecklists] = useState<ChecklistInstanceWithDetails[]>([]);
  const [internalLoading, setInternalLoading] = useState(true);
  const [internalUpdatingItems, setInternalUpdatingItems] = useState<Set<string>>(new Set());

  const hasExternalData = !!hookData;

  useEffect(() => {
    if (hasExternalData) return; // Skip when external data provided
    if (profile?.shop_id) {
      loadChecklistsInternal();
      const interval = setInterval(loadChecklistsInternal, 30000);
      return () => clearInterval(interval);
    }
  }, [profile?.shop_id, hasExternalData]);

  const loadChecklistsInternal = async () => {
    if (!profile?.shop_id) return;
    try {
      setInternalLoading(true);
      const today = new Date().toISOString().split('T')[0];
      const data = await getTodaysChecklists(profile.shop_id, today);
      setInternalChecklists(data);
    } catch (error) {
      console.error('Error loading checklists:', error);
      toast.error('Failed to load checklists');
    } finally {
      setInternalLoading(false);
    }
  };

  const handleToggleItemInternal = async (
    instanceId: string,
    checklistItemId: string,
    isCompleted: boolean
  ) => {
    if (!profile?.id) return;
    const key = `${instanceId}-${checklistItemId}`;
    if (internalUpdatingItems.has(key)) return;
    setInternalUpdatingItems(prev => new Set(prev).add(key));
    try {
      if (isCompleted) {
        await uncompleteChecklistItem(instanceId, checklistItemId);
        toast.success('Item marked as incomplete');
      } else {
        await completeChecklistItem(instanceId, checklistItemId, profile.id);
        toast.success('Item completed!');
      }
      await loadChecklistsInternal();
    } catch (error: any) {
      console.error('Error updating item:', error);
      toast.error(error.message || 'Failed to update item');
    } finally {
      setInternalUpdatingItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(key);
        return newSet;
      });
    }
  };

  // Use external hookData when provided, otherwise fall back to internal state
  const checklists = hookData?.checklists ?? internalChecklists;
  const loading = hookData ? hookData.loading : internalLoading;
  const updatingItems = hookData?.updatingItems ?? internalUpdatingItems;
  const handleToggleItem = hookData?.handleToggleItem ?? handleToggleItemInternal;

  // Compact summary for accordion trigger
  if (showCompactSummary) {
    if (loading) {
      return <Skeleton className="h-5 w-28 rounded-full" />;
    }

    if (checklists.length === 0) {
      return <Badge variant="outline" className="text-xs">No tasks today</Badge>;
    }

    const totalItems = checklists.reduce((sum, c) => sum + c.total_items, 0);
    const completedItems = checklists.reduce((sum, c) => sum + c.completed_items, 0);
    const allComplete = totalItems > 0 && completedItems === totalItems;

    return (
      <Badge variant={allComplete ? "default" : "secondary"} className="text-xs">
        {completedItems}/{totalItems} completed
      </Badge>
    );
  }

  // Original Card-based loading and empty states
  if (loading) {
    return (
      <Card>
        <CardContent className="p-4 space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-4 w-12" />
              </div>
              <Skeleton className="h-2 w-full rounded-full" />
              {Array.from({ length: 2 }).map((_, j) => (
                <div key={j} className="flex items-center gap-2 pl-1">
                  <Skeleton className="h-4 w-4 rounded" />
                  <Skeleton className="h-3 flex-1" />
                </div>
              ))}
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (checklists.length === 0) {
    if (compact) {
      return (
        <EmptyState
          icon={Calendar}
          title="All caught up! No tasks scheduled for today."
          className="py-4 h-32 flex flex-col items-center justify-center"
        />
      );
    }

    return (
      <Card>
        <CardContent className="flex items-center justify-center h-48">
          <div className="text-muted-foreground">Loading checklists...</div>
        </CardContent>
      </Card>
    );
  }

  // Compact mode rendering - no Card wrappers, border separators
  if (compact) {
    return (
      <div className="space-y-4 animate-content-in">
        {checklists.map((instance) => {
          const progress = instance.total_items > 0
            ? (instance.completed_items / instance.total_items) * 100
            : 0;

          const key = (instanceId: string, itemId: string) => `${instanceId}-${itemId}`;

          return (
            <div key={instance.id} className="space-y-3 pb-4 border-b last:border-0 last:pb-0">
              {/* Header */}
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-semibold text-base">{instance.checklist.name}</h3>
                  {instance.checklist.description && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {instance.checklist.description}
                    </p>
                  )}
                </div>
                <Badge variant={progress === 100 ? "default" : "secondary"} className="ml-2">
                  {instance.completed_items}/{instance.total_items}
                </Badge>
              </div>

              {/* Progress */}
              <div className="space-y-1.5">
                <Progress value={progress} className="h-2" />
                <p className="text-xs text-muted-foreground text-right">
                  {Math.round(progress)}% Complete
                </p>
              </div>

              {/* Items */}
              <div className="space-y-2">
                {instance.items.map((item) => {
                  const isCompleted = !!item.completion;
                  const itemKey = key(instance.id, item.id);
                  const isUpdating = updatingItems.has(itemKey);

                  return (
                    <div
                      key={item.id}
                      className={cn(
                        "flex items-start gap-3 p-2 rounded-md border bg-card transition-colors",
                        isCompleted && "bg-muted/50"
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
                          "text-sm leading-tight",
                          isCompleted && "line-through text-muted-foreground"
                        )}>
                          {item.label}
                        </p>
                        {item.completion && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Completed at {new Date(item.completion.completed_at).toLocaleTimeString()}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // Original Card mode - individual cards for each checklist
  return (
    <div className="space-y-4 animate-content-in">
      {checklists.map((instance) => {
        const progress = instance.total_items > 0 
          ? (instance.completed_items / instance.total_items) * 100 
          : 0;
        
        const statusColor = 
          instance.status === 'completed' ? 'text-green-600' :
          instance.status === 'in_progress' ? 'text-yellow-600' :
          'text-muted-foreground';

        return (
          <Card key={instance.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-lg">{instance.checklist.name}</CardTitle>
                  {instance.checklist.description && (
                    <CardDescription>{instance.checklist.description}</CardDescription>
                  )}
                </div>
                <Badge 
                  variant={
                    instance.status === 'completed' ? 'default' : 
                    instance.status === 'in_progress' ? 'secondary' : 
                    'outline'
                  }
                >
                  {instance.completed_items}/{instance.total_items}
                </Badge>
              </div>

              {/* Progress Bar */}
              <div className="space-y-2">
                <Progress value={progress} className="h-2" />
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>{Math.round(progress)}% Complete</span>
                  <span className={statusColor}>
                    {instance.status === 'completed' ? '✓ Completed' :
                     instance.status === 'in_progress' ? 'In Progress' :
                     'Not Started'}
                  </span>
                </div>
              </div>
            </CardHeader>

            <CardContent>
              <div className="space-y-3">
                {instance.items.map((item) => {
                  const isCompleted = !!item.completion;
                  const key = `${instance.id}-${item.id}`;
                  const isUpdating = updatingItems.has(key);

                  return (
                    <div
                      key={item.id}
                      className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
                        isCompleted ? 'bg-muted/50' : 'hover:bg-muted/30'
                      }`}
                    >
                      <Checkbox
                        id={item.id}
                        checked={isCompleted}
                        disabled={isUpdating}
                        onCheckedChange={() => handleToggleItem(instance.id, item.id, isCompleted)}
                        className="mt-0.5"
                      />
                      <div className="flex-1">
                        <label
                          htmlFor={item.id}
                          className={`text-sm font-medium cursor-pointer ${
                            isCompleted ? 'line-through text-muted-foreground' : ''
                          }`}
                        >
                          {item.label}
                        </label>
                        
                        {item.completion && (
                          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                            <User className="h-3 w-3" />
                            <span>
                              {item.completion.completed_by_profile?.full_name === profile?.full_name
                                ? 'You'
                                : item.completion.completed_by_profile?.full_name || 'Someone'}
                            </span>
                            <Clock className="h-3 w-3 ml-2" />
                            <span>
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

              {instance.status === 'completed' && (
                <div className="flex items-center justify-center gap-2 mt-4 p-3 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <span className="text-sm font-medium text-green-600">
                    All tasks completed! Great work! 🎉
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}

      <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
        <Clock className="h-4 w-4" />
        <span>Updates automatically every 30 seconds</span>
      </div>
    </div>
  );
}
