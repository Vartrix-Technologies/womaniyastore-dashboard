'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useRouter } from 'next/navigation';
import { ListChecks, CheckCircle2, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  getTodaysChecklists,
  createChecklistInstances,
  type ChecklistInstanceWithDetails,
} from '@/lib/api/checklists-v2';
import { appConfig } from '@/lib/config/app.config';

const s = appConfig.styles;
const a = s.accent;

export function ChecklistProgressBanner() {
  const { profile } = useAuth();
  const router = useRouter();
  const [checklists, setChecklists] = useState<ChecklistInstanceWithDetails[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!profile?.shop_id) return;
    try {
      const today = new Date().toISOString().split('T')[0];
      let data = await getTodaysChecklists(profile.shop_id, today);

      if (data.length === 0) {
        await createChecklistInstances(profile.shop_id, today);
        data = await getTodaysChecklists(profile.shop_id, today);
      }

      setChecklists(data);
    } catch (error) {
      console.error('Error loading checklist progress:', error);
    } finally {
      setLoading(false);
    }
  }, [profile?.shop_id]);

  useEffect(() => {
    if (profile?.shop_id) {
      load();
    }
  }, [profile?.shop_id, load]);

  // Don't render anything if loading or no checklists
  if (loading) {
    return (
      <div className="rounded-lg border px-3 lg:px-4 py-2.5 lg:py-3.5 flex items-center gap-2.5 lg:gap-3 animate-pulse bg-muted/30">
        <Skeleton className="h-8 w-8 rounded-md shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-1.5 w-full rounded-full" />
        </div>
        <Skeleton className="h-5 w-12 rounded-full" />
      </div>
    );
  }

  if (checklists.length === 0) return null;

  // Aggregates
  const totalItems = checklists.reduce((sum, c) => sum + c.total_items, 0);
  const completedItems = checklists.reduce((sum, c) => sum + c.completed_items, 0);
  const percent = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;
  const allDone = totalItems > 0 && completedItems === totalItems;
  const completedChecklists = checklists.filter(c => c.status === 'completed').length;

  return (
    <button
      type="button"
      onClick={() => router.push('/admin/checklists')}
      className={cn(
        'w-full rounded-lg border px-3 lg:px-4 py-2.5 lg:py-3.5 flex items-center gap-2.5 lg:gap-3 transition-all cursor-pointer hover:shadow-md',
        allDone
          ? 'bg-green-50/60 border-green-200 dark:bg-green-950/20 dark:border-green-800'
          : `${a.bg} ${a.border}`
      )}
    >
      {/* Icon */}
      <div className={cn(
        'p-1.5 lg:p-2 rounded-md shrink-0',
        allDone
          ? 'bg-green-100 text-green-600'
          : `bg-gradient-to-br ${s.primaryGradientStops} text-white`
      )}>
        {allDone
          ? <CheckCircle2 className="h-4 w-4 lg:h-5 lg:w-5" />
          : <ListChecks className="h-4 w-4 lg:h-5 lg:w-5" />
        }
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 text-left">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm lg:text-base font-medium truncate">
            {allDone
              ? 'All Tasks Complete!'
              : <>Today&apos;s Tasks: <span className={a.text}>{completedItems}/{totalItems}</span></>
            }
          </p>
          {!allDone && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 font-bold tabular-nums shrink-0">
              {percent}%
            </Badge>
          )}
        </div>

        {/* Progress bar */}
        <div className="mt-1.5 h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-700',
              allDone ? 'bg-green-500' : `bg-gradient-to-r ${s.primaryGradientStops}`
            )}
            style={{ width: `${percent}%` }}
          />
        </div>

        {/* Mini checklist status row */}
        <div className="flex items-center gap-2 mt-1.5 overflow-hidden">
          {checklists.map((c) => {
            const isDone = c.status === 'completed';
            const isPartial = c.status === 'in_progress';
            return (
              <div key={c.id} className="flex items-center gap-1 shrink-0">
                <div className={cn(
                  'w-1.5 h-1.5 rounded-full',
                  isDone ? 'bg-green-500' : isPartial ? 'bg-amber-500' : 'bg-gray-300'
                )} />
                <span className="text-[10px] lg:text-xs text-muted-foreground truncate max-w-[80px] lg:max-w-[120px]">
                  {c.checklist.name}
                </span>
              </div>
            );
          })}
          {checklists.length > 0 && (
            <span className="text-[10px] lg:text-xs text-muted-foreground shrink-0">
              · {completedChecklists}/{checklists.length} lists done
            </span>
          )}
        </div>
      </div>

      <ChevronRight className="h-4 w-4 lg:h-5 lg:w-5 text-muted-foreground shrink-0" />
    </button>
  );
}
