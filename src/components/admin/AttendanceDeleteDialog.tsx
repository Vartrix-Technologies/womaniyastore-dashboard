'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { deleteAttendanceRecord } from '@/lib/api/attendance';
import { toast } from 'sonner';
import { Loader2, AlertTriangle } from 'lucide-react';

interface AttendanceDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  attendance: any;
  userId: string;
  onSuccess: () => void;
}

export function AttendanceDeleteDialog({ 
  open, 
  onOpenChange, 
  attendance, 
  userId,
  onSuccess 
}: AttendanceDeleteDialogProps) {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleDelete = async () => {
    if (!reason.trim()) {
      toast.error('Please provide a reason for deletion');
      return;
    }

    setSubmitting(true);

    try {
      const { error } = await deleteAttendanceRecord(
        attendance.id,
        reason,
        userId
      );

      if (error) throw error;

      toast.success('Attendance record deleted successfully');
      onSuccess();
      onOpenChange(false);
      setReason('');
    } catch (error: any) {
      console.error('Error deleting attendance:', error);
      toast.error(error.message || 'Failed to delete attendance record');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Delete Attendance Record
          </DialogTitle>
          <DialogDescription>
            This action cannot be undone. The record will be marked as deleted.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Staff:</span>
              <span className="font-medium">{attendance?.staff?.full_name}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Date:</span>
              <span className="font-medium">{attendance?.date}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Clock In:</span>
              <span className="font-medium">
                {attendance?.clock_in 
                  ? new Date(attendance.clock_in.match(/[Zz+\-]/) ? attendance.clock_in : attendance.clock_in + 'Z').toLocaleTimeString('en-US', { 
                      hour: '2-digit', 
                      minute: '2-digit',
                      timeZone: 'Asia/Kolkata',
                    })
                  : '-'}
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="delete_reason">Reason for Deletion *</Label>
            <Textarea
              id="delete_reason"
              placeholder="e.g., Duplicate entry, incorrect data, staff was on leave"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={submitting}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false);
              setReason('');
            }}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button 
            variant="destructive" 
            onClick={handleDelete} 
            disabled={submitting}
          >
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Delete Record
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
