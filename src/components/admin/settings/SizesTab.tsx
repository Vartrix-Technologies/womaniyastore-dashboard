'use client';

import { useState, useRef, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, ChevronUp, ChevronDown, Check, X, Loader2, Layers, GripVertical } from 'lucide-react';
import { Reorder, useDragControls } from 'framer-motion';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { EmptyState } from '@/components/shared/EmptyState';
import type { Size } from '@/types';
import { appConfig } from '@/lib/config/app.config';

const s = appConfig.styles;

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
    const duplicate = sizes.some(sz => sz.size_name.toLowerCase() === name.toLowerCase());
    if (duplicate) {
      toast.error(`"${name}" already exists`);
      return;
    }
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
    const duplicate = sizes.some(sz => sz.size_name.toLowerCase() === name.toLowerCase() && sz.id !== id);
    if (duplicate) {
      toast.error(`"${name}" already exists`);
      return;
    }
    try {
      const { data, error } = await supabase.from('sizes').update({ size_name: name }).eq('id', id).select();
      if (error) throw error;
      if (!data || data.length === 0) throw new Error('Permission denied – update blocked by policy');
      toast.success('Size updated');
      setEditingId(null);
      await onRefresh();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update');
    }
  };

  // ── Reorder (optimistic local swap → background DB persist) ──────────

  const persistOrder = (newItems: Size[]) => {
    const ordered = newItems.map((item, idx) => ({ ...item, sort_order: idx }));
    setLocalSizes(ordered);

    Promise.all(
      ordered.map((item) =>
        supabase.from('sizes').update({ sort_order: item.sort_order }).eq('id', item.id)
      )
    ).then((results) => {
      const failed = results.some((r) => r.error);
      if (failed) {
        toast.error('Failed to save order');
        onRefresh();
      }
    });
  };

  const handleDragReorder = (newOrder: Size[]) => {
    persistOrder(newOrder);
  };

  const handleMove = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= localSizes.length) return;
    const newItems = [...localSizes];
    [newItems[index], newItems[newIndex]] = [newItems[newIndex], newItems[index]];
    persistOrder(newItems);
  };

  // ── Delete ────────────────────────────────────────────────────────────

  const handleDelete = async (size: Size) => {
    // Check if any lots reference this size
    const { count, error: checkError } = await supabase
      .from('lots')
      .select('id', { count: 'exact', head: true })
      .eq('size_id', size.id);

    if (checkError) {
      toast.error('Failed to check size usage');
      return;
    }

    const inUse = (count || 0) > 0;

    setConfirmDialog({
      open: true,
      title: 'Delete Size',
      description: inUse
        ? `"${size.size_name}" is used by ${count} lot(s). Deleting may cause data issues. Continue?`
        : `Delete "${size.size_name}"? No products currently use this size.`,
      onConfirm: async () => {
        try {
          const { data, error } = await supabase.from('sizes').delete().eq('id', size.id).select();
          if (error) throw error;
          if (!data || data.length === 0) throw new Error('Permission denied – delete blocked by policy');
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
              <p className="text-sm text-muted-foreground mt-1">Drag to reorder — sizes appear in this order at the POS</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Size list */}
          {localSizes.length === 0 ? (
            <EmptyState
              icon={Layers}
              title="No sizes yet"
              description="Add sizes below — they'll appear at the POS in this order"
            />
          ) : (
            <Reorder.Group
              axis="y"
              values={localSizes}
              onReorder={handleDragReorder}
              className="rounded-lg border divide-y"
            >
              {localSizes.map((size, index) => (
                <SizeRow
                  key={size.id}
                  size={size}
                  index={index}
                  total={localSizes.length}
                  isEditing={editingId === size.id}
                  editValue={editValue}
                  onEditValueChange={setEditValue}
                  onStartEdit={() => startEdit(size)}
                  onSaveEdit={() => saveEdit(size.id)}
                  onCancelEdit={() => setEditingId(null)}
                  onMoveUp={() => handleMove(index, 'up')}
                  onMoveDown={() => handleMove(index, 'down')}
                  onDelete={() => handleDelete(size)}
                />
              ))}
            </Reorder.Group>
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
              className={`${s.primaryGradient} ${s.primaryGradientHover} shrink-0`}
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

// ── Draggable row sub-component ──────────────────────────────────────────────

function SizeRow({ size, index, total, isEditing, editValue, onEditValueChange, onStartEdit, onSaveEdit, onCancelEdit, onMoveUp, onMoveDown, onDelete }: {
  size: Size;
  index: number;
  total: number;
  isEditing: boolean;
  editValue: string;
  onEditValueChange: (v: string) => void;
  onStartEdit: () => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
}) {
  const dragControls = useDragControls();

  return (
    <Reorder.Item
      value={size}
      dragListener={false}
      dragControls={dragControls}
      className="flex items-center gap-2 px-3 py-2.5 group hover:bg-muted/40 transition-colors select-none"
      whileDrag={{
        scale: 1.02,
        boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
        backgroundColor: 'var(--color-background, #fff)',
        zIndex: 50,
      }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
    >
      {/* Drag handle */}
      <div
        className={`cursor-grab active:cursor-grabbing touch-none p-1 rounded ${s.linkHover} text-muted-foreground transition-colors`}
        onPointerDown={(e) => dragControls.start(e)}
      >
        <GripVertical className="h-4 w-4" />
      </div>

      {/* Reorder arrows */}
      <div className="flex flex-col shrink-0">
        <button
          type="button"
          className="h-7 w-7 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:pointer-events-none transition-colors"
          onClick={onMoveUp}
          disabled={index === 0}
        >
          <ChevronUp className="h-4 w-4" />
        </button>
        <button
          type="button"
          className="h-7 w-7 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:pointer-events-none transition-colors"
          onClick={onMoveDown}
          disabled={index === total - 1}
        >
          <ChevronDown className="h-4 w-4" />
        </button>
      </div>

      {/* Order number */}
      <span className="text-xs text-muted-foreground font-mono w-5 text-center shrink-0">
        {index + 1}
      </span>

      {/* Name — inline editable */}
      <div className="flex-1 min-w-0">
        {isEditing ? (
          <div className="flex items-center gap-1">
            <Input
              autoFocus
              value={editValue}
              onChange={(e) => onEditValueChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onSaveEdit();
                if (e.key === 'Escape') onCancelEdit();
              }}
              className="h-8 text-sm"
            />
            <Button
              size="icon"
              variant="ghost"
              className={`h-7 w-7 ${s.linkColor} shrink-0`}
              onClick={onSaveEdit}
            >
              <Check className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-muted-foreground shrink-0"
              onClick={onCancelEdit}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : (
          <p className="text-sm font-medium truncate">{size.size_name}</p>
        )}
      </div>

      {/* Actions */}
      {!isEditing && (
        <div className="flex items-center gap-1 shrink-0">
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={onStartEdit}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-muted-foreground hover:text-red-600"
            onClick={onDelete}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </Reorder.Item>
  );
}