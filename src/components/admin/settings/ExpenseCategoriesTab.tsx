'use client';

import { useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Loader2, Check, X, Wallet } from 'lucide-react';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { EmptyState } from '@/components/shared/EmptyState';
import type { ExpenseCategoryForList } from '@/types';
import { appConfig } from '@/lib/config/app.config';

const s = appConfig.styles;

interface ExpenseCategoriesTabProps {
  shopId: string;
  expenseCategories: ExpenseCategoryForList[];
  onRefresh: () => Promise<void>;
}

export function ExpenseCategoriesTab({ shopId, expenseCategories, onRefresh }: ExpenseCategoriesTabProps) {
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
      const { error } = await supabase.from('expense_categories').insert({ shop_id: shopId, name });
      if (error) throw error;
      setNewName('');
      toast.success(`"${name}" added`);
      await onRefresh();
      inputRef.current?.focus();
    } catch (error: any) {
      toast.error(error.message || 'Failed to add');
    } finally {
      setAdding(false);
    }
  };

  // ── Inline edit ──────────────────────────────────────────────────────

  const startEdit = (cat: ExpenseCategoryForList) => {
    setEditingId(cat.id);
    setEditValue(cat.name);
  };

  const saveEdit = async (id: string) => {
    const name = editValue.trim();
    if (!name) { setEditingId(null); return; }
    try {
      const { error } = await supabase.from('expense_categories').update({ name }).eq('id', id);
      if (error) throw error;
      toast.success('Updated');
      setEditingId(null);
      await onRefresh();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update');
    }
  };

  // ── Delete ────────────────────────────────────────────────────────────

  const handleDelete = (cat: ExpenseCategoryForList) => {
    setConfirmDialog({
      open: true,
      title: 'Delete Expense Category',
      description: `Delete "${cat.name}"? This will fail if expenses are filed under it.`,
      onConfirm: async () => {
        try {
          const { count } = await supabase
            .from('financial_transactions')
            .select('*', { count: 'exact', head: true })
            .eq('category_id', cat.id);

          if (count && count > 0) {
            toast.error(`Can\u2019t delete \u2014 ${count} expense(s) use this category`);
            return;
          }

          const { error } = await supabase.from('expense_categories').delete().eq('id', cat.id);
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
                Expense Categories
                {expenseCategories.length > 0 && (
                  <Badge variant="secondary" className="font-normal text-xs">{expenseCategories.length}</Badge>
                )}
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">Organize expenses for better financial tracking</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Item list */}
          {expenseCategories.length === 0 ? (
            <EmptyState
              icon={Wallet}
              title="No expense categories yet"
              description="Add categories like Rent, Utilities or Office Supplies to track spending"
            />
          ) : (
            <div className="rounded-lg border divide-y">
              {expenseCategories.map((cat) => (
                <div
                  key={cat.id}
                  className="flex items-center gap-3 px-4 py-3 group hover:bg-muted/40 transition-colors"
                >
                  <div className="h-2 w-2 rounded-full bg-amber-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    {editingId === cat.id ? (
                      <div className="flex items-center gap-1">
                        <Input
                          autoFocus
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveEdit(cat.id);
                            if (e.key === 'Escape') setEditingId(null);
                          }}
                          className="h-8 text-sm"
                        />
                        <Button
                          size="icon"
                          variant="ghost"
                          className={`h-7 w-7 ${s.linkColor} shrink-0`}
                          onClick={() => saveEdit(cat.id)}
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
                      <p className="text-sm font-medium truncate">{cat.name}</p>
                    )}
                  </div>
                  {editingId !== cat.id && (
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        onClick={() => startEdit(cat)}
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
                placeholder="Type and press Enter to add..."
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
