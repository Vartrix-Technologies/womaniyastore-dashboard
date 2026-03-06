'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  TrendingUp,
  Edit,
  Trash2,
  CalendarDays,
  Timer,
  Target,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { CountUp } from '@/components/shared/CountUp';
import {
  getMonthlyAttendance,
  getAttendanceStats,
  MonthlyAttendanceRecord,
  AttendanceStats,
} from '@/lib/api/attendance';
import { useAuth } from '@/context/AuthContext';
import { AttendanceEditDialog } from '@/components/admin/AttendanceEditDialog';
import { AttendanceDeleteDialog } from '@/components/admin/AttendanceDeleteDialog';
import { appConfig } from '@/lib/config';

const s = appConfig.styles;

interface AttendanceCalendarProps {
  staffId?: string;
  staff?: any[];
  onStaffChange?: (staffId: string) => void;
}

export function AttendanceCalendar({ staffId, staff, onStaffChange }: AttendanceCalendarProps) {
  const { user, profile } = useAuth();
  const targetUserId = staffId || user?.id;
  const isAdminView = !!staffId && !!staff;
  const canEdit = profile?.role === 'admin' || profile?.role === 'owner';

  const [currentDate, setCurrentDate] = useState(new Date());
  const [attendanceRecords, setAttendanceRecords] = useState<MonthlyAttendanceRecord[]>([]);
  const [stats, setStats] = useState<AttendanceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<MonthlyAttendanceRecord | null>(null);
  const [detailsDialog, setDetailsDialog] = useState(false);
  const [editDialog, setEditDialog] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState(false);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1;

  useEffect(() => {
    if (targetUserId) loadMonthData();
  }, [targetUserId, year, month]);

  const loadMonthData = async () => {
    if (!targetUserId) return;
    setLoading(true);

    const [recordsResult, statsResult] = await Promise.all([
      getMonthlyAttendance(targetUserId, year, month),
      getAttendanceStats(targetUserId, year, month),
    ]);

    if (!recordsResult.error) setAttendanceRecords(recordsResult.data || []);
    if (!statsResult.error) setStats(statsResult.data);
    setLoading(false);
  };

  // ── Navigation ───────────────────────────────────────────────

  const goToPreviousMonth = () => {
    setCurrentDate(new Date(year, month - 2, 1));
    setSelectedDate(null);
  };
  const goToNextMonth = () => {
    setCurrentDate(new Date(year, month, 1));
    setSelectedDate(null);
  };
  const goToCurrentMonth = () => {
    setCurrentDate(new Date());
    setSelectedDate(null);
  };

  // ── Helpers ──────────────────────────────────────────────────

  const getDaysInMonth = () => new Date(year, month, 0).getDate();
  const getFirstDayOfMonth = () => new Date(year, month - 1, 1).getDay();

  const getAttendanceForDate = (day: number): MonthlyAttendanceRecord | undefined => {
    const dateStr = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
    return attendanceRecords.find((r) => r.date === dateStr);
  };

  const handleDayClick = (attendance: MonthlyAttendanceRecord | null) => {
    if (attendance) {
      setSelectedDate(attendance);
      setDetailsDialog(true);
    }
  };

  const handleEdit = () => {
    setDetailsDialog(false);
    setEditDialog(true);
  };
  const handleDelete = () => {
    setDetailsDialog(false);
    setDeleteDialog(true);
  };
  const handleSuccess = () => {
    loadMonthData();
    setSelectedDate(null);
  };

  const formatHours = (hours: number | undefined) => {
    if (!hours) return '--';
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return `${h}h ${m}m`;
  };

  const formatHoursCompact = (hours: number | undefined) => {
    if (!hours || hours <= 0) return '';
    return `${hours.toFixed(1)}h`;
  };

  const formatTime = (isoString: string | null) => {
    if (!isoString) return '--:--';
    const date = new Date(isoString.match(/[Zz+\-]/) ? isoString : isoString + 'Z');
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Kolkata',
    });
  };

  const formatTimeShort = (isoString: string | null) => {
    if (!isoString) return '';
    const date = new Date(isoString.match(/[Zz+\-]/) ? isoString : isoString + 'Z');
    return date
      .toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZone: 'Asia/Kolkata',
      })
      .toLowerCase();
  };

  // ── Heatmap colours based on hours ───────────────────────────

  const getHoursColor = (record: MonthlyAttendanceRecord) => {
    if (record.status !== 'closed')
      return 'bg-amber-100/80 dark:bg-amber-900/25 border-amber-300 dark:border-amber-700';
    const h = record.hours_worked || 0;
    if (h >= 8) return 'bg-emerald-200 dark:bg-emerald-900/40 border-emerald-400 dark:border-emerald-700';
    if (h >= 6) return 'bg-emerald-100 dark:bg-emerald-900/25 border-emerald-300 dark:border-emerald-700';
    if (h >= 4) return 'bg-emerald-50 dark:bg-emerald-900/15 border-emerald-200 dark:border-emerald-800';
    return 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800';
  };

  // ── Derived analytics ────────────────────────────────────────

  const attendancePercent = stats
    ? Math.round((stats.total_days_present / stats.total_days_in_month) * 100)
    : 0;

  const calculateStreak = () => {
    if (!attendanceRecords.length) return 0;
    const sorted = [...attendanceRecords].sort((a, b) => b.date.localeCompare(a.date));
    let streak = 1;
    for (let i = 1; i < sorted.length; i++) {
      const prev = new Date(sorted[i - 1].date);
      const curr = new Date(sorted[i].date);
      const diffDays = (prev.getTime() - curr.getTime()) / (1000 * 60 * 60 * 24);
      if (Math.round(diffDays) === 1) streak++;
      else break;
    }
    return streak;
  };

  // ── Calendar cells ───────────────────────────────────────────

  const renderCalendar = () => {
    const daysInMonth = getDaysInMonth();
    const firstDay = getFirstDayOfMonth();
    const days = [];

    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="aspect-square" />);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const attendance = getAttendanceForDate(day);
      const isToday =
        day === new Date().getDate() &&
        month === new Date().getMonth() + 1 &&
        year === new Date().getFullYear();

      days.push(
        <button
          key={day}
          onClick={() => handleDayClick(attendance || null)}
          disabled={!attendance}
          className={`aspect-square rounded-lg border text-left transition-all flex flex-col justify-between p-1 md:p-1.5 relative group ${
            attendance
              ? `${getHoursColor(attendance)} hover:shadow-md hover:scale-[1.02] cursor-pointer`
              : 'border-transparent hover:bg-muted/40 disabled:cursor-default'
          } ${isToday ? 'ring-2 ring-primary ring-offset-1' : ''}`}
        >
          <span
            className={`text-[11px] md:text-xs font-medium leading-none ${
              isToday ? 'text-primary font-bold' : attendance ? '' : 'text-muted-foreground'
            }`}
          >
            {day}
          </span>
          {attendance && (
            <div className="flex flex-col items-start gap-0">
              <span className="text-[10px] md:text-xs font-bold leading-tight">
                {formatHoursCompact(attendance.hours_worked)}
              </span>
              <span className="text-[8px] md:text-[10px] text-muted-foreground leading-tight hidden md:block">
                {formatTimeShort(attendance.clock_in)}
              </span>
            </div>
          )}
          {/* Pulsing dot for in-progress sessions */}
          {attendance && attendance.status !== 'closed' && (
            <div className="absolute top-0.5 right-0.5 md:top-1 md:right-1 w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-amber-500 animate-pulse" />
          )}
        </button>,
      );
    }

    return days;
  };

  // ── Render ───────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* ── Header: Staff selector + Month navigation ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        {isAdminView && staff ? (
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className={`p-1.5 rounded-md ${s.headerIconGradient} text-white shadow-sm shrink-0`}>
              <CalendarIcon className="h-4 w-4" />
            </div>
            <Select value={staffId} onValueChange={onStaffChange}>
              <SelectTrigger className="w-full sm:w-[250px] h-9">
                <SelectValue placeholder="Select staff member" />
              </SelectTrigger>
              <SelectContent>
                {staff.map((member: any) => (
                  <SelectItem key={member.id} value={member.id}>
                    {member.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <div className={`p-1.5 rounded-md ${s.headerIconGradient} text-white shadow-sm`}>
              <CalendarIcon className="h-4 w-4" />
            </div>
            <h2 className="font-semibold">Attendance Calendar</h2>
          </div>
        )}

        <div className="flex items-center gap-1.5 w-full sm:w-auto justify-center sm:justify-end">
          <Button variant="outline" size="sm" onClick={goToCurrentMonth} className="h-8 text-xs">
            Today
          </Button>
          <Button variant="outline" size="icon" onClick={goToPreviousMonth} className="h-8 w-8">
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <span className="min-w-[120px] text-center font-semibold text-sm">
            {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </span>
          <Button variant="outline" size="icon" onClick={goToNextMonth} className="h-8 w-8">
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* ── Analytics strip ── */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-[88px] rounded-lg" />
          ))}
        </div>
      ) : stats ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 animate-content-in">
          {/* Attendance rate */}
          <div className="rounded-lg border p-3 space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <CalendarDays className="h-3.5 w-3.5" />
              Attendance
            </div>
            <div className="text-xl font-bold">
              <CountUp end={stats.total_days_present} />
              <span className="text-sm font-normal text-muted-foreground">
                /{stats.total_days_in_month}
              </span>
            </div>
            <div className="w-full bg-muted rounded-full h-1.5">
              <div
                className="h-1.5 rounded-full bg-gradient-to-r from-brand-from to-brand-to transition-all"
                style={{ width: `${attendancePercent}%` }}
              />
            </div>
            <div className="text-[10px] text-muted-foreground">{attendancePercent}% rate</div>
          </div>

          {/* Total hours */}
          <div className="rounded-lg border p-3 space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Timer className="h-3.5 w-3.5" />
              Total Hours
            </div>
            <div className="text-xl font-bold">
              <CountUp end={stats.total_hours_worked} decimals={1} />
              <span className="text-sm font-normal text-muted-foreground">h</span>
            </div>
            <div className="text-[10px] text-muted-foreground">this month</div>
          </div>

          {/* Average daily */}
          <div className="rounded-lg border p-3 space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <TrendingUp className="h-3.5 w-3.5" />
              Avg Daily
            </div>
            <div className="text-xl font-bold">
              <CountUp end={stats.average_hours_per_day} decimals={1} />
              <span className="text-sm font-normal text-muted-foreground">h</span>
            </div>
            <div className="text-[10px] text-muted-foreground">per working day</div>
          </div>

          {/* Streak */}
          <div className="rounded-lg border p-3 space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Target className="h-3.5 w-3.5" />
              Streak
            </div>
            <div className="text-xl font-bold">
              <CountUp end={calculateStreak()} />
              <span className="text-sm font-normal text-muted-foreground"> days</span>
            </div>
            <div className="text-[10px] text-muted-foreground">consecutive</div>
          </div>
        </div>
      ) : null}

      {/* ── Calendar grid ── */}
      <Card>
        <CardContent className="p-3 md:p-4">
          {loading ? (
            <div className="space-y-2">
              <div className="grid grid-cols-7 gap-1.5 mb-2">
                {Array.from({ length: 7 }).map((_, i) => (
                  <Skeleton key={`dh-${i}`} className="h-5 mx-auto w-8" />
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1.5">
                {Array.from({ length: 35 }).map((_, i) => (
                  <Skeleton key={`dc-${i}`} className="aspect-square rounded-lg" />
                ))}
              </div>
            </div>
          ) : (
            <div className="animate-content-in">
              {/* Day headers */}
              <div className="grid grid-cols-7 gap-1.5 mb-2">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                  <div
                    key={d}
                    className="text-center text-[10px] md:text-xs font-semibold text-muted-foreground py-1 uppercase tracking-wider"
                  >
                    {d}
                  </div>
                ))}
              </div>

              {/* Calendar cells */}
              <div className="grid grid-cols-7 gap-1.5">{renderCalendar()}</div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Legend ── */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[10px] md:text-xs text-muted-foreground">
        <span className="font-medium text-foreground">Legend:</span>
        <span className="flex items-center gap-1.5">
          <span className="w-4 h-3 rounded-sm bg-emerald-200 dark:bg-emerald-900/40 border border-emerald-400" /> 8h+
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-4 h-3 rounded-sm bg-emerald-100 dark:bg-emerald-900/25 border border-emerald-300" />{' '}
          6–8h
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-4 h-3 rounded-sm bg-emerald-50 dark:bg-emerald-900/15 border border-emerald-200" />{' '}
          &lt;6h
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-4 h-3 rounded-sm bg-amber-100 dark:bg-amber-900/25 border border-amber-300" /> In
          Progress
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-primary ring-1 ring-primary ring-offset-1" /> Today
        </span>
      </div>

      {/* ── Premium Day-Details Dialog ── */}
      {detailsDialog && selectedDate && (
        <Dialog open={detailsDialog} onOpenChange={setDetailsDialog}>
          <DialogContent className="sm:max-w-md max-w-[calc(100%-2rem)] p-0 overflow-hidden">
            {/* Header */}
            <DialogHeader className="px-5 pt-5 pb-3">
              <DialogTitle className="text-lg flex items-center gap-2">
                <div className={`p-1.5 rounded-md ${s.headerIconGradient} text-white shadow-sm`}>
                  <Clock className="h-4 w-4" />
                </div>
                {new Date(selectedDate.date + 'T00:00:00').toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'short',
                  day: 'numeric',
                })}
              </DialogTitle>
              <DialogDescription asChild>
                <div className="flex items-center gap-2 flex-wrap mt-1">
                  <Badge
                    variant={selectedDate.status === 'closed' ? 'default' : 'secondary'}
                    className="text-xs"
                  >
                    {selectedDate.status === 'closed' ? 'Completed' : 'In Progress'}
                  </Badge>
                  {(selectedDate as any).is_manual_entry && (
                    <Badge
                      variant="outline"
                      className="bg-blue-50 text-blue-700 border-blue-300 text-xs"
                    >
                      Manual
                    </Badge>
                  )}
                  {(selectedDate as any).edited_at && (
                    <Badge
                      variant="outline"
                      className="bg-orange-50 text-orange-700 border-orange-300 text-xs"
                    >
                      Edited
                    </Badge>
                  )}
                </div>
              </DialogDescription>
            </DialogHeader>

            <Separator />

            {/* Body */}
            <div className="px-5 py-4 space-y-4">
              {/* Hours — prominent display */}
              <div className="rounded-lg bg-muted/40 p-4 text-center space-y-1">
                <div className="text-3xl font-bold tracking-tight">
                  {formatHours(selectedDate.hours_worked)}
                </div>
                <div className="text-xs text-muted-foreground">Total Hours Worked</div>
              </div>

              {/* Timing section */}
              <section className="space-y-2.5">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" /> Timing
                </h3>
                <div className="rounded-lg border bg-muted/30 p-3 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Clock In</span>
                    <span className="font-semibold">{formatTime(selectedDate.clock_in)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Clock Out</span>
                    <span className="font-semibold">
                      {selectedDate.clock_out ? formatTime(selectedDate.clock_out) : 'Not yet'}
                    </span>
                  </div>
                  {selectedDate.total_break_minutes > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Break Time</span>
                      <span className="font-medium">{selectedDate.total_break_minutes} min</span>
                    </div>
                  )}
                </div>
              </section>

              {/* Manual entry notice */}
              {(selectedDate as any).is_manual_entry && (
                <div className="rounded-lg border border-blue-200 bg-blue-50/50 dark:bg-blue-900/10 p-3 space-y-1">
                  <Badge variant="outline" className="bg-blue-100 text-blue-700 text-xs">
                    Manual Entry
                  </Badge>
                  {(selectedDate as any).manual_entry_reason && (
                    <p className="text-xs text-muted-foreground">
                      {(selectedDate as any).manual_entry_reason}
                    </p>
                  )}
                </div>
              )}

              {/* Edited notice */}
              {(selectedDate as any).edited_at && (
                <div className="rounded-lg border border-orange-200 bg-orange-50/50 dark:bg-orange-900/10 p-3 space-y-1">
                  <Badge variant="outline" className="bg-orange-100 text-orange-700 text-xs">
                    Edited
                  </Badge>
                  {(selectedDate as any).edit_reason && (
                    <p className="text-xs text-muted-foreground">
                      {(selectedDate as any).edit_reason}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Action footer */}
            {canEdit && (
              <>
                <Separator />
                <div className="px-5 py-3 flex items-center justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={handleEdit} className={s.btnAnimation}>
                    <Edit className="mr-1.5 h-3.5 w-3.5" /> Edit
                  </Button>
                  <Button variant="destructive" size="sm" onClick={handleDelete} className={s.btnAnimation}>
                    <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Delete
                  </Button>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>
      )}

      {/* Edit Dialog */}
      {editDialog && selectedDate && user && (
        <AttendanceEditDialog
          open={editDialog}
          onOpenChange={setEditDialog}
          attendance={selectedDate}
          userId={user.id}
          onSuccess={handleSuccess}
        />
      )}

      {/* Delete Dialog */}
      {deleteDialog && selectedDate && user && (
        <AttendanceDeleteDialog
          open={deleteDialog}
          onOpenChange={setDeleteDialog}
          attendance={selectedDate}
          userId={user.id}
          onSuccess={handleSuccess}
        />
      )}
    </div>
  );
}
