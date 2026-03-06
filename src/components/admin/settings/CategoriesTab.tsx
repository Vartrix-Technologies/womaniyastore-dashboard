'use client';

import { useState, useRef, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Loader2, Package, GripVertical, ChevronUp, ChevronDown } from 'lucide-react';
import { Reorder, useDragControls } from 'framer-motion';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { EmptyState } from '@/components/shared/EmptyState';
import { FieldError, fieldErrorClass, useFormErrors } from '@/components/shared/FieldError';
import type { Category } from '@/types';
import { appConfig } from '@/lib/config/app.config';

const s = appConfig.styles;
const a = s.accent;

interface CategoriesTabProps {
  shopId: string;
  categories: Category[];
  onRefresh: () => Promise<void>;
}

export function CategoriesTab({ shopId, categories, onRefresh }: CategoriesTabProps) {
  // Local copy for optimistic reorder
  const [localCategories, setLocalCategories] = useState<Category[]>(categories);
  useEffect(() => { setLocalCategories(categories); }, [categories]);

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

  // Field errors
  const { errors, validateFields, clearFieldError } = useFormErrors<'name'>();

  // ── Quick add ────────────────────────────────────────────────────────

  const handleQuickAdd = async () => {
    const name = newName.trim();
    if (!name) {
      validateFields({ name: [true, 'Name is required'] });
      return;
    }
    const duplicate = categories.some(c => c.name.toLowerCase() === name.toLowerCase());
    if (duplicate) {
      validateFields({ name: [true, `"${name}" already exists`] });
      return;
    }
    clearFieldError('name');
    try {
      setAdding(true);
      const { error } = await supabase.from('categories').insert({ shop_id: shopId, name, sort_order: categories.length });
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
    const trimmed = form.name.trim();
    const duplicate = categories.some(
      c => c.name.toLowerCase() === trimmed.toLowerCase() && c.id !== editing?.id
    );
    const valid = validateFields({
      name: [!trimmed || duplicate, !trimmed ? 'Name is required' : `"${trimmed}" already exists`],
    });
    if (!valid) return;
    try {
      const { data, error } = await supabase
        .from('categories')
        .update({ name: form.name.trim(), description: form.description.trim() || null })
        .eq('id', editing!.id)
        .select();
      if (error) throw error;
      if (!data || data.length === 0) throw new Error('Permission denied – update blocked by policy');
      toast.success('Category updated');
      setDialogOpen(false);
      await onRefresh();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update');
    }
  };

  // ── Reorder (optimistic local swap → background DB persist) ──────────

  const persistOrder = (newItems: Category[]) => {
    const ordered = newItems.map((item, idx) => ({ ...item, sort_order: idx }));
    setLocalCategories(ordered);

    Promise.all(
      ordered.map((item) =>
        supabase.from('categories').update({ sort_order: item.sort_order }).eq('id', item.id)
      )
    ).then((results) => {
      const failed = results.some((r) => r.error);
      if (failed) {
        toast.error('Failed to save order');
        onRefresh();
      }
    });
  };

  const handleDragReorder = (newOrder: Category[]) => {
    persistOrder(newOrder);
  };

  const handleMove = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= localCategories.length) return;
    const newItems = [...localCategories];
    [newItems[index], newItems[newIndex]] = [newItems[newIndex], newItems[index]];
    persistOrder(newItems);
  };

  // ── Delete ────────────────────────────────────────────────────────────

  const handleDelete = async (cat: Category) => {
    // Check if any lots reference this category
    const { count, error: checkError } = await supabase
      .from('lots')
      .select('id', { count: 'exact', head: true })
      .eq('category_id', cat.id);

    if (checkError) {
      toast.error('Failed to check category usage');
      return;
    }

    const inUse = (count || 0) > 0;

    setConfirmDialog({
      open: true,
      title: 'Delete Category',
      description: inUse
        ? `"${cat.name}" is used by ${count} lot(s). Deleting may cause data issues. Continue?`
        : `Delete "${cat.name}"? No products currently use this category.`,
      onConfirm: async () => {
        try {
          const { data, error } = await supabase.from('categories').delete().eq('id', cat.id).select();
          if (error) throw error;
          if (!data || data.length === 0) throw new Error('Permission denied – delete blocked by policy');
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
              <p className="text-sm text-muted-foreground mt-1">Drag to reorder — groups your products for easy filtering in POS</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Item list */}
          {localCategories.length === 0 ? (
            <EmptyState
              icon={Package}
              title="No categories yet"
              description="Add your first category below to start organizing products"
            />
          ) : (
            <Reorder.Group
              axis="y"
              values={localCategories}
              onReorder={handleDragReorder}
              className="rounded-lg border divide-y"
            >
              {localCategories.map((cat, index) => (
                <CategoryRow
                  key={cat.id}
                  cat={cat}
                  index={index}
                  total={localCategories.length}
                  onMoveUp={() => handleMove(index, 'up')}
                  onMoveDown={() => handleMove(index, 'down')}
                  onEdit={() => handleEdit(cat)}
                  onDelete={() => handleDelete(cat)}
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
                onChange={(e) => { setNewName(e.target.value); clearFieldError('name'); }}
                onKeyDown={(e) => e.key === 'Enter' && handleQuickAdd()}
                placeholder="Type a name and press Enter..."
                className={`pl-9 h-10 border-dashed ${fieldErrorClass(errors.name)}`}
                disabled={adding}
              />
            </div>
            <FieldError message={errors.name} />
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
                onChange={(e) => { setForm({ ...form, name: e.target.value }); clearFieldError('name'); }}
                onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                autoFocus
                className={fieldErrorClass(errors.name)}
              />
              <FieldError message={errors.name} />
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
              className={`${s.primaryGradient} ${s.primaryGradientHover}`}
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

// ── Draggable row sub-component ──────────────────────────────────────────────

function CategoryRow({ cat, index, total, onMoveUp, onMoveDown, onEdit, onDelete }: {
  cat: Category;
  index: number;
  total: number;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const dragControls = useDragControls();

  return (
    <Reorder.Item
      value={cat}
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

      {/* Name + description */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{cat.name}</p>
        {cat.description && (
          <p className="text-xs text-muted-foreground truncate">{cat.description}</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0">
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
          onClick={onEdit}
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
    </Reorder.Item>
  );
}