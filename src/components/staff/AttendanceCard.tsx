'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Clock, LogIn, LogOut, Coffee, AlertTriangle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { clockIn, clockOut, getTodayAttendance, TodayAttendance } from '@/lib/api/attendance';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { formatTimeIST, getISTDateString, isBeforeToday } from '@/lib/utils/timezone';

export function AttendanceCard() {
  const { user, profile } = useAuth();
  const [attendance, setAttendance] = useState<TodayAttendance | null>(null);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [elapsedTime, setElapsedTime] = useState<string>('00:00:00');
  const [showClockOutConfirm, setShowClockOutConfirm] = useState(false);

  // Fetch today's attendance on mount
  useEffect(() => {
    if (user?.id) {
      loadTodayAttendance();
    }
  }, [user?.id]);

  // Update elapsed time every second
  useEffect(() => {
    if (attendance && attendance.status === 'open' && attendance.clock_in) {
      const interval = setInterval(() => {
        const clockIn = new Date(attendance.clock_in);
        const now = new Date();
        const diffMs = now.getTime() - clockIn.getTime();
        const diffMinutes = Math.floor(diffMs / (1000 * 60));
        const breakMinutes = attendance.total_break_minutes || 0;
        const netMinutes = Math.max(0, diffMinutes - breakMinutes);

        const hours = Math.floor(netMinutes / 60);
        const minutes = netMinutes % 60;
        const seconds = Math.floor((diffMs / 1000) % 60);

        setElapsedTime(
          `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
        );
      }, 1000);

      return () => clearInterval(interval);
    } else if (attendance && attendance.status === 'closed' && attendance.clock_in && attendance.clock_out) {
      // Calculate total time for closed attendance
      const clockIn = new Date(attendance.clock_in);
      const clockOut = new Date(attendance.clock_out);
      const diffMs = clockOut.getTime() - clockIn.getTime();
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      const breakMinutes = attendance.total_break_minutes || 0;
      const netMinutes = Math.max(0, diffMinutes - breakMinutes);

      const hours = Math.floor(netMinutes / 60);
      const minutes = netMinutes % 60;

      setElapsedTime(`${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:00`);
    }
  }, [attendance]);

  const loadTodayAttendance = async () => {
    if (!user?.id) return;

    const { data, error } = await getTodayAttendance(user.id);
    if (!error && data) {
      setAttendance(data);
    }
    setInitialLoading(false);
  };

  const handleClockIn = async () => {
    if (!user?.id || !profile?.shop_id) {
      toast.error('User information missing');
      return;
    }

    setLoading(true);
    const { data, error } = await clockIn(user.id, profile.shop_id);

    if (error) {
      toast.error(error.message || 'Failed to clock in');
    } else if (data) {
      toast.success('Clocked in successfully');
      setAttendance({
        id: data.id,
        clock_in: data.clock_in,
        clock_out: data.clock_out,
        status: data.status,
        total_break_minutes: data.total_break_minutes,
        date: data.date,
      });
    }

    setLoading(false);
  };

  const handleClockOut = async () => {
    if (!attendance?.id) return;

    setLoading(true);
    const { data, error } = await clockOut(attendance.id);

    if (error) {
      toast.error(error.message || 'Failed to clock out');
    } else if (data) {
      toast.success('Clocked out successfully');
      setAttendance({
        id: data.id,
        clock_in: data.clock_in,
        clock_out: data.clock_out,
        status: data.status,
        total_break_minutes: data.total_break_minutes,
        date: data.date,
      });
      // If this was a stale session, reload to check for today's record
      if (isStaleSession) {
        setTimeout(() => loadTodayAttendance(), 500);
      }
    }

    setLoading(false);
  };

  // Check if current attendance is from a previous day (stale session)
  const isStaleSession = attendance && isBeforeToday(attendance.date);

  const formatTime = (isoString: string | null) => formatTimeIST(isoString);

  if (initialLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Attendance
          </CardTitle>
          <CardDescription>Loading today&apos;s record...</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-16" />
            </div>
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-6 w-20" />
            </div>
          </div>
          <div className="pt-4">
            <Skeleton className="h-11 w-full rounded-md" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="animate-content-in">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Attendance
        </CardTitle>
        <CardDescription>
          {isStaleSession
            ? `⚠️ You forgot to clock out on ${attendance?.date}. Please clock out first.`
            : attendance ? 'Today\'s attendance record' : 'No attendance record for today'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stale Session Warning */}
        {isStaleSession && (
          <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-3 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-yellow-800">
              <p className="font-medium">Unclosed session from {attendance?.date}</p>
              <p className="text-yellow-700 mt-0.5">Please clock out of this session before clocking in for today.</p>
            </div>
          </div>
        )}

        {/* Status Badge */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Status:</span>
          {attendance ? (
            <Badge variant={attendance.status === 'open' ? 'default' : 'secondary'}>
              {attendance.status === 'open' ? 'Clocked In' : 'Clocked Out'}
            </Badge>
          ) : (
            <Badge variant="outline">Not Started</Badge>
          )}
        </div>

        {/* Time Information */}
        {attendance && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Clock In:</span>
              <span className="font-medium">{formatTime(attendance.clock_in)}</span>
            </div>
            {attendance.clock_out && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Clock Out:</span>
                <span className="font-medium">{formatTime(attendance.clock_out)}</span>
              </div>
            )}
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Hours Worked:</span>
              <span className="font-mono text-lg font-bold text-primary">{elapsedTime}</span>
            </div>
            {attendance.total_break_minutes > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-1">
                  <Coffee className="h-3 w-3" />
                  Break Time:
                </span>
                <span className="font-medium">{attendance.total_break_minutes} min</span>
              </div>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="pt-4">
          {!attendance ? (
            <Button onClick={handleClockIn} disabled={loading} className="w-full" size="lg">
              <LogIn className="mr-2 h-5 w-5" />
              Clock In
            </Button>
          ) : attendance.status === 'open' ? (
            <Button onClick={() => setShowClockOutConfirm(true)} disabled={loading} variant="destructive" className="w-full" size="lg">
              <LogOut className="mr-2 h-5 w-5" />
              Clock Out
            </Button>
          ) : (
            <div className="text-center py-4">
              <p className="text-sm text-muted-foreground">You have completed your shift for today</p>
            </div>
          )}
        </div>
      </CardContent>

      {/* Clock-out confirmation */}
      <ConfirmDialog
        open={showClockOutConfirm}
        onOpenChange={setShowClockOutConfirm}
        onConfirm={handleClockOut}
        title="Clock Out"
        description={`Are you sure you want to clock out? You've worked ${elapsedTime} so far today.`}
        confirmText="Clock Out"
        cancelText="Cancel"
        variant="destructive"
      />
    </Card>
  );
}
