'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Calendar,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  LayoutDashboard,
  ListChecks,
  Sparkles,
} from 'lucide-react';
import { AttendanceCard } from '@/components/staff/AttendanceCard';
import { TaskChecklistCard, useTaskChecklists } from '@/components/staff/TaskChecklistCard';
import { AttendanceCalendar } from '@/components/staff/AttendanceCalendar';
import { useAuth } from '@/context/AuthContext';
import { appConfig } from '@/lib/config/app.config';
import { cn } from '@/lib/utils';

const s = appConfig.styles;
const a = s.accent;

export default function StaffDashboardPage() {
  const { profile } = useAuth();
  const [showCalendar, setShowCalendar] = useState(false);
  const [tasksOpen, setTasksOpen] = useState(false);
  const taskData = useTaskChecklists(tasksOpen);

  // Task aggregates (computed from hook data even when accordion is closed after first open)
  const totalItems = taskData.checklists.reduce((sum, c) => sum + c.total_items, 0);
  const completedItems = taskData.checklists.reduce((sum, c) => sum + c.completed_items, 0);
  const taskPercent = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;
  const allDone = totalItems > 0 && completedItems === totalItems;
  const hasTaskData = taskData.checklists.length > 0;

  return (
    <div className="space-y-3 md:space-y-5 lg:space-y-7 animate-content-in lg:max-w-4xl lg:mx-auto">
      {/* ─── Header ─── */}
      <div>
        <div className="flex items-center gap-3">
          <div className={`p-2 lg:p-2.5 rounded-lg bg-gradient-to-br ${s.primaryGradientStops} text-white shadow-md`}>
            <LayoutDashboard className="h-5 w-5 lg:h-6 lg:w-6" />
          </div>
          <div>
            <h1 className="text-xl lg:text-2xl font-bold tracking-tight">My Dashboard</h1>
            <p className="text-xs lg:text-sm text-muted-foreground mt-0.5">
              Welcome back, {profile?.full_name || 'Staff Member'}!
            </p>
          </div>
        </div>
      </div>

      {/* ─── Attendance ─── */}
      <AttendanceCard />

      {/* ─── Daily Tasks — Collapsible Section ─── */}
      <div className="space-y-1.5 lg:space-y-2.5">
        {/* Section header */}
        <div className="flex items-center gap-1.5 lg:gap-2">
          <div className={`p-1 lg:p-1.5 rounded bg-gradient-to-br ${s.primaryGradientStops} text-white`}>
            <ListChecks className="h-3 w-3 lg:h-4 lg:w-4" />
          </div>
          <h2 className="text-xs lg:text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Today&apos;s Tasks
          </h2>
        </div>

        {/* Accordion trigger card */}
        <Card
          className={cn(
            'overflow-hidden transition-all',
            tasksOpen && 'shadow-md',
            allDone && 'border-green-200 dark:border-green-800'
          )}
        >
          {/* Trigger button */}
          <button
            type="button"
            onClick={() => setTasksOpen(prev => !prev)}
            className={cn(
              'w-full text-left px-4 py-3 lg:px-5 lg:py-4 flex items-center gap-3 transition-colors',
              !tasksOpen && 'hover:bg-muted/30'
            )}
          >
            {/* Icon */}
            <div className={cn(
              'p-1.5 lg:p-2 rounded-md shrink-0',
              allDone
                ? 'bg-green-100 text-green-600 dark:bg-green-950/40 dark:text-green-400'
                : `${a.bg} ${a.text}`
            )}>
              <ClipboardList className="h-4 w-4 lg:h-5 lg:w-5" />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm lg:text-base font-medium truncate">
                  {allDone
                    ? 'All Tasks Complete!'
                    : hasTaskData
                      ? <>Daily Checklist <span className={a.text}>{completedItems}/{totalItems}</span></>
                      : 'Daily Checklist'
                  }
                </p>
                {hasTaskData && !allDone && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 font-bold tabular-nums shrink-0">
                    {taskPercent}%
                  </Badge>
                )}
                {allDone && (
                  <Sparkles className="h-4 w-4 text-green-500 shrink-0" />
                )}
              </div>

              {/* Mini progress bar — visible when closed & data exists */}
              {hasTaskData && !tasksOpen && (
                <div className="mt-1.5 h-1 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all duration-700',
                      allDone
                        ? 'bg-green-500'
                        : `bg-gradient-to-r ${s.primaryGradientStops}`
                    )}
                    style={{ width: `${taskPercent}%` }}
                  />
                </div>
              )}

              {/* Helper text when not yet opened and no data */}
              {!hasTaskData && !tasksOpen && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  Tap to view and check off your tasks
                </p>
              )}
            </div>

            {/* Chevron */}
            <ChevronDown className={cn(
              'h-4 w-4 lg:h-5 lg:w-5 text-muted-foreground transition-transform duration-200 shrink-0',
              tasksOpen && 'rotate-180'
            )} />
          </button>

          {/* Expanded content */}
          {tasksOpen && (
            <CardContent className="pt-0 pb-4 px-4 lg:px-5">
              <div className="border-t pt-3">
                {/* Full progress bar */}
                {hasTaskData && (
                  <div className="mb-4 space-y-1.5">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{completedItems} of {totalItems} tasks done</span>
                      <span className="font-semibold tabular-nums">{taskPercent}%</span>
                    </div>
                    <Progress
                      value={taskPercent}
                      className={cn(
                        'h-2',
                        allDone && '[&>div]:bg-green-500'
                      )}
                    />
                  </div>
                )}

                <div className="max-h-[400px] overflow-y-auto scroll-fade">
                  <TaskChecklistCard compact={true} hookData={taskData} />
                </div>
              </div>
            </CardContent>
          )}
        </Card>
      </div>

      {/* ─── Attendance History ─── */}
      <div className="space-y-1.5 lg:space-y-2.5">
        {/* Section header */}
        <div className="flex items-center gap-1.5 lg:gap-2">
          <div className="p-1 lg:p-1.5 rounded bg-gradient-to-br from-amber-400 to-orange-500 text-white">
            <Calendar className="h-3 w-3 lg:h-4 lg:w-4" />
          </div>
          <h2 className="text-xs lg:text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Attendance History
          </h2>
        </div>

        {!showCalendar ? (
          <Card
            className={cn(
              'overflow-hidden transition-all cursor-pointer hover:shadow-md',
              s.btnAnimationSubtle
            )}
            onClick={() => setShowCalendar(true)}
          >
            <div className="px-4 py-3 lg:px-5 lg:py-4 flex items-center gap-3">
              <div className="p-1.5 lg:p-2 rounded-md bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400 shrink-0">
                <Calendar className="h-4 w-4 lg:h-5 lg:w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm lg:text-base font-medium">View Attendance Calendar</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  See your attendance history, hours worked &amp; streaks
                </p>
              </div>
              <ChevronDown className="h-4 w-4 lg:h-5 lg:w-5 text-muted-foreground shrink-0" />
            </div>
          </Card>
        ) : (
          <Card className="overflow-hidden shadow-md">
            <button
              type="button"
              onClick={() => setShowCalendar(false)}
              className="w-full text-left px-4 py-3 lg:px-5 lg:py-4 flex items-center gap-3 hover:bg-muted/30 transition-colors"
            >
              <div className="p-1.5 lg:p-2 rounded-md bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400 shrink-0">
                <Calendar className="h-4 w-4 lg:h-5 lg:w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm lg:text-base font-medium">Attendance Calendar</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Your attendance history &amp; analytics
                </p>
              </div>
              <ChevronUp className="h-4 w-4 lg:h-5 lg:w-5 text-muted-foreground shrink-0" />
            </button>
            <CardContent className="pt-0 pb-4 px-2 lg:px-4">
              <div className="border-t pt-3">
                <AttendanceCalendar />
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
