'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { QrCode, Plus, Edit, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { updateQrPrefix, createQrPrefix, deleteQrPrefix } from '@/lib/api/qr-prefixes';
import type { QrPrefix } from '@/types';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
interface QrPrefixesTabProps {
  shopId: string;
  qrPrefixes: QrPrefix[];
  onRefresh: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const validateQrPrefixFormat = (prefix: string): boolean => {
  const formatRegex = /^[A-Z0-9]+(-[A-Z0-9]+)+$/;
  return formatRegex.test(prefix);
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function QrPrefixesTab({ shopId, qrPrefixes, onRefresh }: QrPrefixesTabProps) {
  const router = useRouter();

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<QrPrefix | null>(null);
  const [form, setForm] = useState({ prefix: '', description: '', display_order: 0 });

  // Confirm dialog
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
  }>({ open: false, title: '', description: '', onConfirm: () => {} });

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleAdd = () => {
    setEditing(null);
    setForm({ prefix: '', description: '', display_order: qrPrefixes.length });
    setDialogOpen(true);
  };

  const handleEdit = (qrPrefix: QrPrefix) => {
    setEditing(qrPrefix);
    setForm({
      prefix: qrPrefix.prefix,
      description: qrPrefix.description || '',
      display_order: qrPrefix.display_order,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.prefix.trim()) {
      toast.error('Please enter prefix name');
      return;
    }

    if (!validateQrPrefixFormat(form.prefix)) {
      toast.error('Invalid prefix format. Use uppercase alphanumeric with hyphens (e.g., WA-499, WA-TP-599)');
      return;
    }

    try {
      if (editing) {
        await updateQrPrefix(editing.id, {
          prefix: form.prefix,
          description: form.description || null,
          display_order: form.display_order,
        });
        toast.success('QR Prefix updated successfully');
      } else {
        await createQrPrefix({
          shop_id: shopId,
          prefix: form.prefix,
          description: form.description || undefined,
          display_order: form.display_order,
        });
        toast.success('QR Prefix added successfully');
      }

      setDialogOpen(false);
      await onRefresh();
    } catch (error: any) {
      console.error('Error saving QR prefix:', error);
      if (error.code === '23505') {
        toast.error('A prefix with this name already exists');
      } else {
        toast.error(error.message || 'Failed to save QR prefix');
      }
    }
  };

  const handleToggleActive = async (qrPrefix: QrPrefix) => {
    try {
      await updateQrPrefix(qrPrefix.id, {
        is_active: !qrPrefix.is_active,
      });
      toast.success(`QR Prefix ${qrPrefix.is_active ? 'deactivated' : 'activated'} successfully`);
      await onRefresh();
    } catch (error: any) {
      console.error('Error toggling QR prefix:', error);
      toast.error(error.message || 'Failed to update QR prefix');
    }
  };

  const handleDelete = (id: string) => {
    setConfirmDialog({
      open: true,
      title: 'Delete QR Prefix',
      description: 'Are you sure you want to delete this QR prefix? This will fail if any QR codes are assigned.',
      onConfirm: async () => {
        try {
          await deleteQrPrefix(id);
          toast.success('QR Prefix deleted successfully');
          await onRefresh();
        } catch (error: any) {
          console.error('Error deleting QR prefix:', error);
          if (error.code === '23503') {
            toast.error('Cannot delete prefix with assigned QR codes. Deactivate it instead.');
          } else {
            toast.error(error.message || 'Failed to delete QR prefix');
          }
        }
      },
    });
  };

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <CardTitle className="text-lg">QR Prefixes</CardTitle>
            <CardDescription>Manage QR code prefixes for better inventory organization</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => router.push('/admin/qr-codes')}
              variant="outline"
              size="sm"
              className="hover:scale-105 active:scale-95 transition-all"
            >
              <QrCode className="mr-2 h-4 w-4" />
              Generate QR Codes
            </Button>
            <Button
              onClick={handleAdd}
              size="sm"
              className="bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-600 hover:to-cyan-700 hover:scale-105 active:scale-95 transition-all"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              <strong>Tip:</strong> Keep prefix names aligned with pricing (e.g., WA-499 for ₹499 items). Format: Uppercase alphanumeric with hyphen.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2 text-sm font-medium">Prefix</th>
                  <th className="text-left p-2 text-sm font-medium">Description</th>
                  <th className="text-center p-2 text-sm font-medium">Status</th>
                  <th className="text-center p-2 text-sm font-medium">Order</th>
                  <th className="text-right p-2 text-sm font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {qrPrefixes.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center p-8 text-muted-foreground">
                      <div className="flex flex-col items-center gap-2">
                        <QrCode className="h-12 w-12 text-muted-foreground/50" />
                        <p className="text-sm">No QR prefixes found</p>
                        <p className="text-xs text-muted-foreground">Create your first prefix to start organizing QR codes</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  qrPrefixes.map((qrPrefix) => (
                    <tr key={qrPrefix.id} className="border-b hover:bg-muted/50 transition-colors">
                      <td className="p-2 font-mono font-bold text-sm">{qrPrefix.prefix}</td>
                      <td className="p-2 text-sm text-muted-foreground">{qrPrefix.description || '-'}</td>
                      <td className="p-2 text-center">
                        {qrPrefix.is_active ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-300 text-xs font-medium">
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-xs font-medium">
                            Inactive
                          </span>
                        )}
                      </td>
                      <td className="p-2 text-center text-sm text-muted-foreground">{qrPrefix.display_order}</td>
                      <td className="p-2 text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleToggleActive(qrPrefix)}
                            className="hover:scale-105 active:scale-95 transition-all"
                            title={qrPrefix.is_active ? 'Deactivate' : 'Activate'}
                          >
                            {qrPrefix.is_active ? (
                              <ToggleRight className="h-4 w-4 text-green-600" />
                            ) : (
                              <ToggleLeft className="h-4 w-4 text-gray-400" />
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEdit(qrPrefix)}
                            className="hover:scale-105 active:scale-95 transition-all"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleDelete(qrPrefix.id)}
                            className="hover:scale-105 active:scale-95 transition-all"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit QR Prefix' : 'Add QR Prefix'}</DialogTitle>
            <DialogDescription>
              {editing ? 'Update QR prefix details' : 'Create a new QR prefix for organizing inventory'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="qr_prefix_name" className="text-sm font-medium">Prefix *</Label>
              <Input
                id="qr_prefix_name"
                value={form.prefix}
                onChange={(e) => setForm({ ...form, prefix: e.target.value.toUpperCase() })}
                placeholder="e.g., WA-499, WA-TP-599"
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                Format: Uppercase alphanumeric with hyphens (e.g., WA-499, WA-TP-599)
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="qr_prefix_description" className="text-sm font-medium">Description</Label>
              <Input
                id="qr_prefix_description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="e.g., ₹499 Kurtas"
              />
              <p className="text-xs text-muted-foreground">
                Optional: Add a description to help identify the prefix
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              className="bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-600 hover:to-cyan-700"
            >
              {editing ? 'Update' : 'Add'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Dialog */}
      <ConfirmDialog
        open={confirmDialog.open}
        onOpenChange={(open) => setConfirmDialog({ ...confirmDialog, open })}
        onConfirm={confirmDialog.onConfirm}
        title={confirmDialog.title}
        description={confirmDialog.description}
        confirmText="Delete"
        cancelText="Cancel"
        variant="destructive"
      />
    </>
  );
}
