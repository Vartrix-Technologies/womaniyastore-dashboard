'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { QrCode, Plus, Pencil, Trash2, ExternalLink, Info } from 'lucide-react';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { updateQrPrefix, createQrPrefix, deleteQrPrefix } from '@/lib/api/qr-prefixes';
import type { QrPrefix } from '@/types';

interface QrPrefixesTabProps {
  shopId: string;
  qrPrefixes: QrPrefix[];
  onRefresh: () => Promise<void>;
}

const validateFormat = (prefix: string) => /^[A-Z0-9]+(-[A-Z0-9]+)+$/.test(prefix);

export function QrPrefixesTab({ shopId, qrPrefixes, onRefresh }: QrPrefixesTabProps) {
  const router = useRouter();
  const activeCount = qrPrefixes.filter((p) => p.is_active).length;

  // Dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<QrPrefix | null>(null);
  const [form, setForm] = useState({ prefix: '', description: '' });

  // Confirm dialog
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean; title: string; description: string; onConfirm: () => void;
  }>({ open: false, title: '', description: '', onConfirm: () => {} });

  // ── Dialog handlers ──────────────────────────────────────────────────

  const openAdd = () => {
    setEditing(null);
    setForm({ prefix: '', description: '' });
    setDialogOpen(true);
  };

  const openEdit = (qr: QrPrefix) => {
    setEditing(qr);
    setForm({ prefix: qr.prefix, description: qr.description || '' });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const prefix = form.prefix.trim();
    if (!prefix) { toast.error('Prefix is required'); return; }
    if (!validateFormat(prefix)) {
      toast.error('Use uppercase alphanumeric with hyphens (e.g. WA-499)');
      return;
    }
    try {
      if (editing) {
        await updateQrPrefix(editing.id, {
          prefix,
          description: form.description.trim() || undefined,
        });
        toast.success('Prefix updated');
      } else {
        await createQrPrefix({
          shop_id: shopId,
          prefix,
          description: form.description.trim() || undefined,
          display_order: qrPrefixes.length,
        });
        toast.success('Prefix created');
      }
      setDialogOpen(false);
      await onRefresh();
    } catch (error: any) {
      if (error.code === '23505') toast.error('This prefix already exists');
      else toast.error(error.message || 'Failed to save');
    }
  };

  // ── Toggle active ────────────────────────────────────────────────────

  const handleToggle = async (qr: QrPrefix) => {
    try {
      await updateQrPrefix(qr.id, { is_active: !qr.is_active });
      toast.success(qr.is_active ? 'Prefix deactivated' : 'Prefix activated');
      await onRefresh();
    } catch (error: any) {
      toast.error(error.message || 'Failed to toggle');
    }
  };

  // ── Delete ────────────────────────────────────────────────────────────

  const handleDelete = (qr: QrPrefix) => {
    setConfirmDialog({
      open: true,
      title: 'Delete QR Prefix',
      description: `Delete "${qr.prefix}"? This fails if QR codes are assigned to it.`,
      onConfirm: async () => {
        try {
          await deleteQrPrefix(qr.id);
          toast.success('Prefix deleted');
          await onRefresh();
        } catch (error: any) {
          if (error.code === '23503') {
            toast.error('Can\u2019t delete \u2014 QR codes are assigned. Deactivate instead.');
          } else {
            toast.error(error.message || 'Failed to delete');
          }
        }
      },
    });
  };

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <>
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                QR Prefixes
                {qrPrefixes.length > 0 && (
                  <Badge variant="secondary" className="font-normal text-xs">
                    {activeCount} active
                  </Badge>
                )}
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">Organize inventory with price-aligned QR prefixes</p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push('/admin/qr-codes')}
                className="text-xs"
              >
                <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                Generate QR Codes
              </Button>
              <Button
                size="sm"
                onClick={openAdd}
                className="bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-600 hover:to-cyan-700"
              >
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Add Prefix
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Tip banner */}
          <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-blue-50/80 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900">
            <Info className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
            <p className="text-xs text-blue-700 dark:text-blue-300">
              Align prefixes with pricing &mdash; <span className="font-mono font-semibold">WA-499</span> for
              {' \u20B9'}499 items. Format: uppercase alphanumeric with hyphens.
            </p>
          </div>

          {/* Card grid */}
          {qrPrefixes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="rounded-full bg-muted p-4 mb-4">
                <QrCode className="h-8 w-8 text-muted-foreground/60" />
              </div>
              <p className="font-medium text-sm">No prefixes yet</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-[260px]">
                Create your first prefix to start organizing QR-coded inventory
              </p>
              <Button
                size="sm"
                onClick={openAdd}
                className="mt-4 bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-600 hover:to-cyan-700"
              >
                <Plus className="mr-1.5 h-3.5 w-3.5" /> Create First Prefix
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {qrPrefixes.map((qr) => (
                <div
                  key={qr.id}
                  className={`relative rounded-xl border-2 p-4 transition-all ${
                    qr.is_active
                      ? 'border-teal-200 dark:border-teal-800 bg-teal-50/50 dark:bg-teal-950/20'
                      : 'border-muted bg-muted/30 opacity-75'
                  }`}
                >
                  {/* Header: prefix + actions */}
                  <div className="flex items-start justify-between mb-2">
                    <span className="font-mono text-base font-bold tracking-wide">{qr.prefix}</span>
                    <div className="flex items-center gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        onClick={() => openEdit(qr)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-muted-foreground hover:text-red-600"
                        onClick={() => handleDelete(qr)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-xs text-muted-foreground mb-3 min-h-[1rem] truncate">
                    {qr.description || 'No description'}
                  </p>

                  {/* Footer: status + toggle */}
                  <div className="flex items-center justify-between pt-2 border-t border-dashed">
                    <span className="text-xs font-medium text-muted-foreground">
                      {qr.is_active ? 'Active' : 'Inactive'}
                    </span>
                    <Switch
                      checked={qr.is_active}
                      onCheckedChange={() => handleToggle(qr)}
                      className="scale-90"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Prefix' : 'New QR Prefix'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Prefix <span className="text-red-400">*</span>
              </Label>
              <Input
                value={form.prefix}
                onChange={(e) => setForm({ ...form, prefix: e.target.value.toUpperCase() })}
                onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                placeholder="e.g. WA-499"
                className="font-mono h-11 text-base font-semibold tracking-wider"
                autoFocus
              />
              <p className="text-xs text-muted-foreground">Uppercase alphanumeric with hyphens</p>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Description
              </Label>
              <Input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                placeholder={`e.g. \u20B9499 Kurtas`}
                className="h-11"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={handleSave}
              className="bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-600 hover:to-cyan-700"
            >
              {editing ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmDialog.open}
        onOpenChange={(open) => setConfirmDialog({ ...confirmDialog, open })}
        onConfirm={confirmDialog.onConfirm}
        title={confirmDialog.title}
        description={confirmDialog.description}
        confirmText="Delete"
        variant="destructive"
      />
    </>
  );
}
