'use client';

import { useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Loader2, Package } from 'lucide-react';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import type { Category } from '@/types';

interface CategoriesTabProps {
  shopId: string;
  categories: Category[];
  onRefresh: () => Promise<void>;
}

export function CategoriesTab({ shopId, categories, onRefresh }: CategoriesTabProps) {
  // Quick-add
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Edit dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [form, setForm] = useState({ name: '', description: '' });

  // Confirm dialog
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean; title: string; description: string; onConfirm: () => void;
  }>({ open: false, title: '', description: '', onConfirm: () => {} });

  // ── Quick add ────────────────────────────────────────────────────────

  const handleQuickAdd = async () => {
    const name = newName.trim();
    if (!name) return;
    try {
      setAdding(true);
      const { error } = await supabase.from('categories').insert({ shop_id: shopId, name });
      if (error) throw error;
      setNewName('');
      toast.success(`"${name}" added`);
      await onRefresh();
      inputRef.current?.focus();
    } catch (error: any) {
      toast.error(error.message || 'Failed to add category');
    } finally {
      setAdding(false);
    }
  };

  // ── Edit ──────────────────────────────────────────────────────────────

  const handleEdit = (cat: Category) => {
    setEditing(cat);
    setForm({ name: cat.name, description: cat.description || '' });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Name is required'); return; }
    try {
      const { error } = await supabase
        .from('categories')
        .update({ name: form.name.trim(), description: form.description.trim() || null })
        .eq('id', editing!.id);
      if (error) throw error;
      toast.success('Category updated');
      setDialogOpen(false);
      await onRefresh();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update');
    }
  };

  // ── Delete ────────────────────────────────────────────────────────────

  const handleDelete = (cat: Category) => {
    setConfirmDialog({
      open: true,
      title: 'Delete Category',
      description: `Delete "${cat.name}"? Products in this category won\u2019t be affected.`,
      onConfirm: async () => {
        try {
          const { error } = await supabase.from('categories').delete().eq('id', cat.id);
          if (error) throw error;
          toast.success('Category deleted');
          await onRefresh();
        } catch (error: any) {
          toast.error(error.message || 'Failed to delete');
        }
      },
    });
  };

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <>
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                Product Categories
                {categories.length > 0 && (
                  <Badge variant="secondary" className="font-normal text-xs">{categories.length}</Badge>
                )}
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">Group your products for easy filtering in POS</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Item list */}
          {categories.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="rounded-full bg-muted p-4 mb-4">
                <Package className="h-8 w-8 text-muted-foreground/60" />
              </div>
              <p className="font-medium text-sm">No categories yet</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-[240px]">
                Add your first category below to start organizing products
              </p>
            </div>
          ) : (
            <div className="rounded-lg border divide-y">
              {categories.map((cat) => (
                <div
                  key={cat.id}
                  className="flex items-center gap-3 px-4 py-3 group hover:bg-muted/40 transition-colors"
                >
                  <div className="h-2 w-2 rounded-full bg-teal-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{cat.name}</p>
                    {cat.description && (
                      <p className="text-xs text-muted-foreground truncate">{cat.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 sm:opacity-100 transition-opacity">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-muted-foreground hover:text-foreground"
                      onClick={() => handleEdit(cat)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-muted-foreground hover:text-red-600"
                      onClick={() => handleDelete(cat)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Quick-add input */}
          <div className="flex items-center gap-2 pt-1">
            <div className="relative flex-1">
              <Plus className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                ref={inputRef}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleQuickAdd()}
                placeholder="Type a name and press Enter..."
                className="pl-9 h-10 border-dashed"
                disabled={adding}
              />
            </div>
            <Button
              size="sm"
              onClick={handleQuickAdd}
              disabled={!newName.trim() || adding}
              className="bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-600 hover:to-cyan-700 shrink-0"
            >
              {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Category</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Name <span className="text-red-400">*</span>
              </Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Description
              </Label>
              <Input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                placeholder="Optional"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={handleSave}
              className="bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-600 hover:to-cyan-700"
            >
              Update
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
