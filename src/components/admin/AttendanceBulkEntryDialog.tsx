'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/lib/supabase';
import { createManualAttendance } from '@/lib/api/attendance';
import { buildISTTimestamp, getISTDateString } from '@/lib/utils/timezone';
import { appConfig } from '@/lib/config';
import { toast } from 'sonner';
import { Loader2, Users, Clock, AlertCircle, CheckCircle2, CalendarDays, Timer, MessageSquare, Wand2 } from 'lucide-react';

const s = appConfig.styles;

interface StaffMember {
  id: string;
  full_name: string;
  role: string;
}

interface StaffEntry {
  staffId: string;
  staffName: string;
  selected: boolean;
  clockIn: string;
  clockOut: string;
  breakMinutes: string;
  hasExisting: boolean;
  existingId?: string;
}

interface AttendanceBulkEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  staff: StaffMember[];
  shopId: string;
  userId: string;
  onSuccess: () => void;
}

export function AttendanceBulkEntryDialog({ 
  open, 
  onOpenChange, 
  staff, 
  shopId,
  userId,
  onSuccess 
}: AttendanceBulkEntryDialogProps) {
  const [date, setDate] = useState(getISTDateString());
  const [reason, setReason] = useState('Daily manual attendance entry');
  const [submitting, setSubmitting] = useState(false);
  const [checkingExisting, setCheckingExisting] = useState(false);
  const [entries, setEntries] = useState<StaffEntry[]>([]);
  
  // Default times
  const [defaultClockIn, setDefaultClockIn] = useState('09:00');
  const [defaultClockOut, setDefaultClockOut] = useState('18:00');
  const [defaultBreakMinutes, setDefaultBreakMinutes] = useState('60');

  // Initialize entries when staff changes
  useEffect(() => {
    if (staff.length > 0) {
      setEntries(
        staff.map((member) => ({
          staffId: member.id,
          staffName: member.full_name,
          selected: true,
          clockIn: defaultClockIn,
          clockOut: defaultClockOut,
          breakMinutes: defaultBreakMinutes,
          hasExisting: false,
        }))
      );
    }
  }, [staff]);

  // Check for existing attendance when date changes
  useEffect(() => {
    if (date && shopId && staff.length > 0) {
      checkExistingAttendance();
    }
  }, [date, shopId, staff]);

  const checkExistingAttendance = async () => {
    setCheckingExisting(true);
    try {
      const { data: existing } = await supabase
        .from('attendance_logs')
        .select('id, staff_id')
        .eq('shop_id', shopId)
        .eq('date', date)
        .is('deleted_at', null);

      const existingMap = new Map(existing?.map((e) => [e.staff_id, e.id]) || []);

      setEntries((prev) =>
        prev.map((entry) => ({
          ...entry,
          hasExisting: existingMap.has(entry.staffId),
          existingId: existingMap.get(entry.staffId),
          selected: !existingMap.has(entry.staffId) && entry.selected,
        }))
      );
    } catch (error) {
      console.error('Error checking existing attendance:', error);
    } finally {
      setCheckingExisting(false);
    }
  };

  const applyDefaultsToAll = () => {
    setEntries((prev) =>
      prev.map((entry) => ({
        ...entry,
        clockIn: defaultClockIn,
        clockOut: defaultClockOut,
        breakMinutes: defaultBreakMinutes,
      }))
    );
    toast.success('Defaults applied to all staff');
  };

  const toggleSelectAll = (checked: boolean) => {
    setEntries((prev) =>
      prev.map((entry) => ({
        ...entry,
        selected: entry.hasExisting ? false : checked,
      }))
    );
  };

  const toggleEntry = (staffId: string) => {
    setEntries((prev) =>
      prev.map((entry) =>
        entry.staffId === staffId && !entry.hasExisting
          ? { ...entry, selected: !entry.selected }
          : entry
      )
    );
  };

  const updateEntry = (staffId: string, field: 'clockIn' | 'clockOut' | 'breakMinutes', value: string) => {
    setEntries((prev) =>
      prev.map((entry) =>
        entry.staffId === staffId ? { ...entry, [field]: value } : entry
      )
    );
  };

  const handleSubmit = async () => {
    const selectedEntries = entries.filter((e) => e.selected && !e.hasExisting);

    if (selectedEntries.length === 0) {
      toast.error('Please select at least one staff member');
      return;
    }

    if (!reason.trim()) {
      toast.error('Please provide a reason for manual entry');
      return;
    }

    for (const entry of selectedEntries) {
      if (entry.clockOut && entry.clockIn >= entry.clockOut) {
        toast.error(`Invalid times for ${entry.staffName}: Clock out must be after clock in`);
        return;
      }
    }

    setSubmitting(true);

    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    for (const entry of selectedEntries) {
      try {
        const clockInDateTime = buildISTTimestamp(date, entry.clockIn);
        const clockOutDateTime = entry.clockOut ? buildISTTimestamp(date, entry.clockOut) : null;

        const { error } = await createManualAttendance(
          {
            staff_id: entry.staffId,
            shop_id: shopId,
            date,
            clock_in: clockInDateTime,
            clock_out: clockOutDateTime,
            total_break_minutes: parseInt(entry.breakMinutes) || 0,
            manual_entry_reason: reason,
          },
          userId
        );

        if (error) {
          errorCount++;
          errors.push(`${entry.staffName}: ${error.message}`);
        } else {
          successCount++;
        }
      } catch (error: any) {
        errorCount++;
        errors.push(`${entry.staffName}: ${error.message}`);
      }
    }

    setSubmitting(false);

    if (successCount > 0) {
      toast.success(`Successfully created ${successCount} attendance record${successCount > 1 ? 's' : ''}`);
      onSuccess();
    }

    if (errorCount > 0) {
      toast.error(`Failed to create ${errorCount} record${errorCount > 1 ? 's' : ''}`, {
        description: errors.slice(0, 3).join(', '),
      });
    }

    if (errorCount === 0) {
      onOpenChange(false);
    }
  };

  const selectedCount = entries.filter((e) => e.selected && !e.hasExisting).length;
  const existingCount = entries.filter((e) => e.hasExisting).length;
  const availableCount = entries.filter((e) => !e.hasExisting).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-[700px] max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
        {/* ── Header ── */}
        <DialogHeader className="px-5 pt-5 pb-3 shrink-0">
          <div className="flex items-start gap-3">
            <div className={`p-2.5 rounded-xl ${s.headerIconGradient} text-white shadow-lg shadow-brand-500/20 shrink-0`}>
              <Users className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-lg">Bulk Attendance Entry</DialogTitle>
              <DialogDescription className="text-sm mt-0.5">
                Create attendance records for multiple staff at once
              </DialogDescription>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <Badge variant="outline" className="text-xs">
                  {staff.length} Staff
                </Badge>
                {existingCount > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    {existingCount} already recorded
                  </Badge>
                )}
                {checkingExisting && (
                  <Badge variant="outline" className="text-xs text-muted-foreground">
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    Checking...
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </DialogHeader>

        <Separator />

        {/* ── Scrollable Body ── */}
        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-4">

          {/* Date Section */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Date</h4>
              <span className="text-red-400 text-xs">*</span>
            </div>
            <div className="rounded-lg border bg-muted/30 p-3">
              <Input
                id="bulk-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                disabled={submitting}
                max={getISTDateString()}
              />
            </div>
          </section>

          {/* Default Times Section */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Timer className="h-4 w-4 text-muted-foreground" />
                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Default Times</h4>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={applyDefaultsToAll}
                disabled={submitting}
                className={`text-xs h-7 ${s.btnAnimation}`}
              >
                <Wand2 className="h-3 w-3 mr-1.5" />
                Apply to All
              </Button>
            </div>
            <div className="rounded-lg border bg-muted/30 p-3">
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Clock In</Label>
                  <Input
                    type="time"
                    value={defaultClockIn}
                    onChange={(e) => setDefaultClockIn(e.target.value)}
                    disabled={submitting}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Clock Out</Label>
                  <Input
                    type="time"
                    value={defaultClockOut}
                    onChange={(e) => setDefaultClockOut(e.target.value)}
                    disabled={submitting}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Break (min)</Label>
                  <Input
                    type="number"
                    min="0"
                    max="480"
                    value={defaultBreakMinutes}
                    onChange={(e) => setDefaultBreakMinutes(e.target.value)}
                    disabled={submitting}
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Staff List Section */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Staff Members</h4>
                <Badge variant="outline" className="text-[10px] h-4 px-1.5 font-mono">
                  {selectedCount}/{availableCount}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="select-all"
                  checked={selectedCount === availableCount && selectedCount > 0}
                  onCheckedChange={(checked) => toggleSelectAll(checked as boolean)}
                  disabled={submitting}
                />
                <Label htmlFor="select-all" className="text-xs cursor-pointer text-muted-foreground">
                  Select All
                </Label>
              </div>
            </div>

            <div className="rounded-lg border overflow-hidden">
              <div className="max-h-[220px] overflow-y-auto divide-y">
                {entries.map((entry) => (
                  <div
                    key={entry.staffId}
                    className={`p-3 flex items-center gap-3 transition-colors ${
                      entry.hasExisting
                        ? 'bg-muted/40 opacity-50'
                        : entry.selected
                          ? 'bg-brand-50/40 dark:bg-brand-950/20'
                          : 'hover:bg-muted/30'
                    }`}
                  >
                    <Checkbox
                      checked={entry.selected}
                      onCheckedChange={() => toggleEntry(entry.staffId)}
                      disabled={entry.hasExisting || submitting}
                    />
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm truncate">{entry.staffName}</span>
                        {entry.hasExisting && (
                          <Badge variant="outline" className="text-[10px] h-4 px-1.5 bg-green-50 text-green-600 border-green-200 dark:bg-green-950/30 dark:text-green-400 dark:border-green-800">
                            <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" />
                            Done
                          </Badge>
                        )}
                      </div>
                    </div>

                    {!entry.hasExisting && (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Input
                          type="time"
                          value={entry.clockIn}
                          onChange={(e) => updateEntry(entry.staffId, 'clockIn', e.target.value)}
                          disabled={submitting || !entry.selected}
                          className="w-[95px] h-7 text-xs"
                        />
                        <span className="text-muted-foreground text-xs">–</span>
                        <Input
                          type="time"
                          value={entry.clockOut}
                          onChange={(e) => updateEntry(entry.staffId, 'clockOut', e.target.value)}
                          disabled={submitting || !entry.selected}
                          className="w-[95px] h-7 text-xs"
                        />
                        <Input
                          type="number"
                          placeholder="Brk"
                          value={entry.breakMinutes}
                          onChange={(e) => updateEntry(entry.staffId, 'breakMinutes', e.target.value)}
                          disabled={submitting || !entry.selected}
                          className="w-[55px] h-7 text-xs"
                          min="0"
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Reason Section */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Reason for Manual Entry</h4>
              <span className="text-red-400 text-xs">*</span>
            </div>
            <div className="rounded-lg border bg-muted/30 p-3">
              <Textarea
                id="bulk-reason"
                placeholder="e.g., Daily manual entry, system was down, retroactive correction"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                disabled={submitting}
                rows={2}
              />
            </div>
          </section>

          {/* Summary */}
          {selectedCount > 0 && (
            <div className="flex items-center gap-2 p-3 rounded-lg border border-brand-200 bg-brand-50/50 dark:border-brand-800 dark:bg-brand-950/30 text-sm">
              <AlertCircle className="h-4 w-4 text-brand-600 dark:text-brand-400 shrink-0" />
              <span className="text-brand-700 dark:text-brand-300">
                Will create <strong>{selectedCount}</strong> attendance record{selectedCount > 1 ? 's' : ''} for{' '}
                <strong>{date}</strong>
              </span>
            </div>
          )}
        </div>

        <Separator />

        {/* ── Footer ── */}
        <div className="px-5 py-3 flex items-center justify-end gap-2 shrink-0">
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
            disabled={submitting || selectedCount === 0}
            className={`${s.primaryGradient} ${s.primaryGradientHover} text-white ${s.btnAnimation}`}
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Clock className="mr-2 h-4 w-4" />
                Create {selectedCount} Record{selectedCount > 1 ? 's' : ''}
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
