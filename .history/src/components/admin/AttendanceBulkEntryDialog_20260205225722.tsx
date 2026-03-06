'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';
import { createManualAttendance } from '@/lib/api/attendance';
import { toast } from 'sonner';
import { Loader2, Users, Clock, AlertCircle, CheckCircle2 } from 'lucide-react';

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
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
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
        staff.map((s) => ({
          staffId: s.id,
          staffName: s.full_name,
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
          // Auto-deselect if already has attendance
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

    // Validate times
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
        const clockInDateTime = `${date}T${entry.clockIn}:00.000Z`;
        const clockOutDateTime = entry.clockOut ? `${date}T${entry.clockOut}:00.000Z` : null;

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Bulk Attendance Entry
          </DialogTitle>
          <DialogDescription>
            Quickly add attendance records for multiple staff members at once
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Date and Defaults Section */}
          <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
            <div className="space-y-2">
              <Label htmlFor="bulk-date">Date *</Label>
              <Input
                id="bulk-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                disabled={submitting}
                max={new Date().toISOString().split('T')[0]}
              />
            </div>
            <div className="flex items-end">
              {checkingExisting && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Checking existing...
                </div>
              )}
            </div>
          </div>

          {/* Default Times */}
          <div className="p-4 border rounded-lg space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Default Times</Label>
              <Button variant="outline" size="sm" onClick={applyDefaultsToAll} disabled={submitting}>
                Apply to All
              </Button>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Clock In</Label>
                <Input
                  type="time"
                  value={defaultClockIn}
                  onChange={(e) => setDefaultClockIn(e.target.value)}
                  disabled={submitting}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Clock Out</Label>
                <Input
                  type="time"
                  value={defaultClockOut}
                  onChange={(e) => setDefaultClockOut(e.target.value)}
                  disabled={submitting}
                />
              </div>
              <div className="space-y-1">
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

          {/* Staff List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Staff Members</Label>
              <div className="flex items-center gap-4">
                {existingCount > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {existingCount} already recorded
                  </Badge>
                )}
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="select-all"
                    checked={selectedCount === entries.filter((e) => !e.hasExisting).length && selectedCount > 0}
                    onCheckedChange={(checked) => toggleSelectAll(checked as boolean)}
                    disabled={submitting}
                  />
                  <Label htmlFor="select-all" className="text-xs cursor-pointer">
                    Select All
                  </Label>
                </div>
              </div>
            </div>

            <div className="border rounded-lg divide-y max-h-[250px] overflow-y-auto">
              {entries.map((entry) => (
                <div
                  key={entry.staffId}
                  className={`p-3 flex items-center gap-3 ${
                    entry.hasExisting ? 'bg-muted/50 opacity-60' : ''
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
                        <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Has Record
                        </Badge>
                      )}
                    </div>
                  </div>

                  {!entry.hasExisting && (
                    <div className="flex items-center gap-2">
                      <Input
                        type="time"
                        value={entry.clockIn}
                        onChange={(e) => updateEntry(entry.staffId, 'clockIn', e.target.value)}
                        disabled={submitting || !entry.selected}
                        className="w-[100px] h-8 text-xs"
                      />
                      <span className="text-muted-foreground">-</span>
                      <Input
                        type="time"
                        value={entry.clockOut}
                        onChange={(e) => updateEntry(entry.staffId, 'clockOut', e.target.value)}
                        disabled={submitting || !entry.selected}
                        className="w-[100px] h-8 text-xs"
                      />
                      <Input
                        type="number"
                        placeholder="Break"
                        value={entry.breakMinutes}
                        onChange={(e) => updateEntry(entry.staffId, 'breakMinutes', e.target.value)}
                        disabled={submitting || !entry.selected}
                        className="w-[60px] h-8 text-xs"
                        min="0"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Reason */}
          <div className="space-y-2">
            <Label htmlFor="bulk-reason">Reason for Manual Entry *</Label>
            <Textarea
              id="bulk-reason"
              placeholder="e.g., Daily manual entry, system was down, retroactive correction"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={submitting}
              rows={2}
            />
          </div>

          {/* Summary */}
          {selectedCount > 0 && (
            <div className="flex items-center gap-2 p-3 bg-blue-50 text-blue-700 rounded-lg text-sm">
              <AlertCircle className="h-4 w-4" />
              <span>
                Will create <strong>{selectedCount}</strong> attendance record{selectedCount > 1 ? 's' : ''} for{' '}
                <strong>{date}</strong>
              </span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || selectedCount === 0}>
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
