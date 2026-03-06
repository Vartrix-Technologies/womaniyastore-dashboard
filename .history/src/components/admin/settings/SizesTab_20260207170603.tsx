'use client';

import { useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, ChevronUp, ChevronDown, Check, X, Loader2, Layers } from 'lucide-react';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import type { Size } from '@/types';

interface SizesTabProps {
  shopId: string;
  sizes: Size[];
  onRefresh: () => Promise<void>;
}

export function SizesTab({ shopId, sizes, onRefresh }: SizesTabProps) {
  // Local copy for optimistic reorder
  const [localSizes, setLocalSizes] = useState<Size[]>(sizes);
  useEffect(() => { setLocalSizes(sizes); }, [sizes]);

  // Quick-add
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Inline edit
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

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
      const { error } = await supabase.from('sizes').insert({
        shop_id: shopId,
        size_name: name,
        sort_order: sizes.length,
      });
      if (error) throw error;
      setNewName('');
      toast.success(`"${name}" added`);
      await onRefresh();
      inputRef.current?.focus();
    } catch (error: any) {
      toast.error(error.message || 'Failed to add size');
    } finally {
      setAdding(false);
    }
  };

  // ── Inline edit ──────────────────────────────────────────────────────

  const startEdit = (size: Size) => {
    setEditingId(size.id);
    setEditValue(size.size_name);
  };

  const saveEdit = async (id: string) => {
    const name = editValue.trim();
    if (!name) { setEditingId(null); return; }
    try {
      const { error } = await supabase.from('sizes').update({ size_name: name }).eq('id', id);
      if (error) throw error;
      toast.success('Size updated');
      setEditingId(null);
      await onRefresh();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update');
    }
  };

  // ── Reorder ──────────────────────────────────────────────────────────

  const [moving, setMoving] = useState(false);

  const handleMove = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= sizes.length) return;

    // Build new order and reassign all sort_order values (handles duplicates)
    const newOrder = sizes.map((s) => s.id);
    const [moved] = newOrder.splice(index, 1);
    newOrder.splice(targetIndex, 0, moved);

    try {
      setMoving(true);
      await Promise.all(
        newOrder.map((id, i) =>
          supabase.from('sizes').update({ sort_order: i }).eq('id', id)
        )
      );
      await onRefresh();
    } catch {
      toast.error('Failed to reorder');
    } finally {
      setMoving(false);
    }
  };

  // ── Delete ────────────────────────────────────────────────────────────

  const handleDelete = (size: Size) => {
    setConfirmDialog({
      open: true,
      title: 'Delete Size',
      description: `Delete "${size.size_name}"? Products with this size won\u2019t be affected.`,
      onConfirm: async () => {
        try {
          const { error } = await supabase.from('sizes').delete().eq('id', size.id);
          if (error) throw error;
          toast.success('Size deleted');
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
                Product Sizes
                {sizes.length > 0 && (
                  <Badge variant="secondary" className="font-normal text-xs">{sizes.length}</Badge>
                )}
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">Sizes appear in this order at the POS</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Size list */}
          {sizes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="rounded-full bg-muted p-4 mb-4">
                <Layers className="h-8 w-8 text-muted-foreground/60" />
              </div>
              <p className="font-medium text-sm">No sizes yet</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-[240px]">
                Add sizes below &mdash; they&apos;ll appear at the POS in this order
              </p>
            </div>
          ) : (
            <div className="rounded-lg border divide-y">
              {sizes.map((size, index) => (
                <div
                  key={size.id}
                  className="flex items-center gap-2 px-3 py-2.5 group hover:bg-muted/40 transition-colors"
                >
                  {/* Order number */}
                  <span className="text-xs text-muted-foreground font-mono w-5 text-center shrink-0">
                    {index + 1}
                  </span>

                  {/* Reorder arrows */}
                  <div className="flex flex-col shrink-0">
                    <button
                      type="button"
                      className="h-7 w-7 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:pointer-events-none transition-colors"
                      onClick={() => handleMove(index, 'up')}
                      disabled={index === 0 || moving}
                    >
                      <ChevronUp className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      className="h-7 w-7 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:pointer-events-none transition-colors"
                      onClick={() => handleMove(index, 'down')}
                      disabled={index === sizes.length - 1 || moving}
                    >
                      <ChevronDown className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Name — inline editable */}
                  <div className="flex-1 min-w-0">
                    {editingId === size.id ? (
                      <div className="flex items-center gap-1">
                        <Input
                          autoFocus
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveEdit(size.id);
                            if (e.key === 'Escape') setEditingId(null);
                          }}
                          className="h-8 text-sm"
                        />
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-teal-600 shrink-0"
                          onClick={() => saveEdit(size.id)}
                        >
                          <Check className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-muted-foreground shrink-0"
                          onClick={() => setEditingId(null)}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <p className="text-sm font-medium truncate">{size.size_name}</p>
                    )}
                  </div>

                  {/* Actions */}
                  {editingId !== size.id && (
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        onClick={() => startEdit(size)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-muted-foreground hover:text-red-600"
                        onClick={() => handleDelete(size)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
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
                placeholder="Add a size (e.g. Small, Medium)..."
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
