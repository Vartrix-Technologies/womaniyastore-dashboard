'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Ruler, Plus, Edit, Trash2 } from 'lucide-react';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import type { Size } from '@/types';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
interface SizesTabProps {
  shopId: string;
  sizes: Size[];
  onRefresh: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function SizesTab({ shopId, sizes, onRefresh }: SizesTabProps) {
  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Size | null>(null);
  const [form, setForm] = useState({ size_name: '', sort_order: 0 });

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
    setForm({ size_name: '', sort_order: sizes.length });
    setDialogOpen(true);
  };

  const handleEdit = (size: Size) => {
    setEditing(size);
    setForm({
      size_name: size.size_name,
      sort_order: size.sort_order,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.size_name.trim()) {
      toast.error('Please enter size name');
      return;
    }

    try {
      if (editing) {
        const { error } = await supabase
          .from('sizes')
          .update({
            size_name: form.size_name,
            sort_order: form.sort_order,
          })
          .eq('id', editing.id);

        if (error) throw error;
        toast.success('Size updated successfully');
      } else {
        const { error } = await supabase
          .from('sizes')
          .insert({
            shop_id: shopId,
            size_name: form.size_name,
            sort_order: form.sort_order,
          });

        if (error) throw error;
        toast.success('Size added successfully');
      }

      setDialogOpen(false);
      await onRefresh();
    } catch (error: any) {
      console.error('Error saving size:', error);
      toast.error(error.message || 'Failed to save size');
    }
  };

  const handleDelete = (id: string) => {
    setConfirmDialog({
      open: true,
      title: 'Delete Size',
      description: 'Are you sure you want to delete this size?',
      onConfirm: async () => {
        try {
          const { error } = await supabase
            .from('sizes')
            .delete()
            .eq('id', id);

          if (error) throw error;
          toast.success('Size deleted successfully');
          await onRefresh();
        } catch (error: any) {
          console.error('Error deleting size:', error);
          toast.error(error.message || 'Failed to delete size');
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
            <CardTitle className="text-lg">Product Sizes</CardTitle>
            <CardDescription>Manage product sizes</CardDescription>
          </div>
          <Button
            onClick={handleAdd}
            size="sm"
            className="bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-600 hover:to-cyan-700 hover:scale-105 active:scale-95 transition-all"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add
          </Button>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2 text-sm font-medium">Size Name</th>
                  <th className="text-left p-2 text-sm font-medium">Sort Order</th>
                  <th className="text-right p-2 text-sm font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sizes.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="text-center p-8 text-muted-foreground">
                      <div className="flex flex-col items-center gap-2">
                        <Ruler className="h-12 w-12 text-muted-foreground/50" />
                        <p className="text-sm">No sizes found</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  sizes.map((size) => (
                    <tr key={size.id} className="border-b hover:bg-muted/50 transition-colors">
                      <td className="p-2 font-medium text-sm">{size.size_name}</td>
                      <td className="p-2 text-sm text-muted-foreground">{size.sort_order}</td>
                      <td className="p-2 text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEdit(size)}
                            className="hover:scale-105 active:scale-95 transition-all"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleDelete(size.id)}
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
            <DialogTitle>{editing ? 'Edit Size' : 'Add Size'}</DialogTitle>
            <DialogDescription>
              {editing ? 'Update size details' : 'Create a new product size'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="size_name" className="text-sm font-medium">Size Name *</Label>
              <Input
                id="size_name"
                value={form.size_name}
                onChange={(e) => setForm({ ...form, size_name: e.target.value })}
                placeholder="e.g., Small, Medium, Large"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sort_order" className="text-sm font-medium">Sort Order</Label>
              <Input
                id="sort_order"
                type="number"
                value={form.sort_order}
                onChange={(e) => setForm({ ...form, sort_order: parseInt(e.target.value) })}
                placeholder="0"
              />
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
