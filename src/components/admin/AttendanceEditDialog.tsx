'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { updateAttendanceRecord } from '@/lib/api/attendance';
import { calculateHoursFromTimeStrings } from '@/lib/utils/attendance';
import { extractISTTime, buildISTTimestamp } from '@/lib/utils/timezone';
import { toast } from 'sonner';
import { Loader2, Edit, Clock, Coffee, Timer, MessageSquare } from 'lucide-react';
import { FieldError, fieldErrorClass, useFormErrors } from '@/components/shared/FieldError';
import { appConfig } from '@/lib/config/app.config';

const s = appConfig.styles;

interface AttendanceEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  attendance: any;
  userId: string;
  onSuccess: () => void;
}

export function AttendanceEditDialog({ 
  open, 
  onOpenChange, 
  attendance, 
  userId,
  onSuccess 
}: AttendanceEditDialogProps) {
  const [clockIn, setClockIn] = useState('');
  const [clockOut, setClockOut] = useState('');
  const [breakMinutes, setBreakMinutes] = useState('0');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { errors, validateFields, clearFieldError } = useFormErrors<'reason' | 'clockOut'>();

  useEffect(() => {
    if (attendance && open) {
      // Extract IST times for the time inputs (properly converts from UTC)
      const clockInTime = extractISTTime(attendance.clock_in);
      const clockOutTime = extractISTTime(attendance.clock_out);

      setClockIn(clockInTime);
      setClockOut(clockOutTime);
      setBreakMinutes(String(attendance.total_break_minutes || 0));
      setReason('');
    }
  }, [attendance, open]);

  const handleSubmit = async () => {
    const valid = validateFields({
      reason: [!reason.trim(), 'Please provide a reason for editing'],
      clockOut: [!!clockOut && clockIn >= clockOut, 'Clock out must be after clock in'],
    });
    if (!valid) return;

    setSubmitting(true);

    try {
      // Combine date with IST times — buildISTTimestamp adds +05:30 offset
      const date = attendance.date;
      const clockInDateTime = buildISTTimestamp(date, clockIn);
      const clockOutDateTime = clockOut ? buildISTTimestamp(date, clockOut) : null;

      const { error } = await updateAttendanceRecord(
        attendance.id,
        {
          clock_in: clockInDateTime,
          clock_out: clockOutDateTime,
          total_break_minutes: parseInt(breakMinutes) || 0,
          edit_reason: reason,
        },
        userId
      );

      if (error) throw error;

      toast.success('Attendance record updated successfully');
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error updating attendance:', error);
      toast.error(error.message || 'Failed to update attendance record');
    } finally {
      setSubmitting(false);
    }
  };

  // Use shared utility for hours calculation
  const calculatedHours = calculateHoursFromTimeStrings(clockIn, clockOut, parseInt(breakMinutes) || 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Premium gradient header */}
        <DialogHeader className="px-5 pt-5 pb-3">
          <div className="flex items-start gap-3">
            <div className={`p-2.5 rounded-xl ${s.headerIconGradient} text-white shadow-lg shadow-brand-500/20 shrink-0`}>
              <Edit className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-lg">Edit Attendance</DialogTitle>
              <DialogDescription className="text-sm mt-0.5">
                Modify the attendance record
              </DialogDescription>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <Badge variant="secondary" className="text-xs">
                  {attendance?.staff?.full_name}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {attendance?.date}
                </Badge>
              </div>
            </div>
          </div>
        </DialogHeader>

        <Separator />

        {/* Scrollable body */}
        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-4">
          {/* Timing section */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <h4 className="text-sm font-medium">Timing</h4>
            </div>
            <div className="rounded-lg border bg-muted/30 p-3">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="clock_in" className="text-xs text-muted-foreground">Clock In</Label>
                  <Input
                    id="clock_in"
                    type="time"
                    value={clockIn}
                    onChange={(e) => setClockIn(e.target.value)}
                    disabled={submitting}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="clock_out" className="text-xs text-muted-foreground">Clock Out</Label>
                  <Input
                    id="clock_out"
                    type="time"
                    value={clockOut}
                    onChange={(e) => { setClockOut(e.target.value); clearFieldError('clockOut'); }}
                    disabled={submitting}
                    className={fieldErrorClass(errors.clockOut)}
                  />
                  <FieldError message={errors.clockOut} />
                  <p className="text-xs text-muted-foreground">
                    Leave empty if still in progress
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Break section */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Coffee className="h-4 w-4 text-muted-foreground" />
              <h4 className="text-sm font-medium">Break Time</h4>
            </div>
            <div className="rounded-lg border bg-muted/30 p-3">
              <div className="space-y-2">
                <Label htmlFor="break_minutes" className="text-xs text-muted-foreground">Minutes</Label>
                <Input
                  id="break_minutes"
                  type="number"
                  min="0"
                  max="480"
                  value={breakMinutes}
                  onChange={(e) => setBreakMinutes(e.target.value)}
                  disabled={submitting}
                />
              </div>
            </div>
          </div>

          {/* Calculated hours */}
          {clockIn && clockOut && (
            <div className="rounded-lg border bg-muted/30 p-3">
              <div className="flex items-center gap-2">
                <Timer className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Total Hours:</span>
                <span className="text-sm font-semibold">{calculatedHours} hrs</span>
              </div>
            </div>
          )}

          {/* Reason section */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
              <h4 className="text-sm font-medium">Reason for Edit</h4>
              <Badge variant="destructive" className="text-[10px] h-4 px-1">Required</Badge>
            </div>
            <div className="rounded-lg border bg-muted/30 p-3">
              <Textarea
                id="reason"
                placeholder="e.g., Correcting clock out time, forgot to clock out"
                value={reason}
                onChange={(e) => { setReason(e.target.value); clearFieldError('reason'); }}
                disabled={submitting}
                rows={3}
                className={fieldErrorClass(errors.reason)}
              />
              <FieldError message={errors.reason} />
            </div>
          </div>
        </div>

        <Separator />

        {/* Footer */}
        <div className="px-5 py-3 flex items-center justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
            className={s.btnAnimation}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting}
            className={`${s.primaryGradient} ${s.primaryGradientHover} text-white ${s.btnAnimation}`}
          >
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
