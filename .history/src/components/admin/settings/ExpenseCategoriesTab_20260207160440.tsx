'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Receipt, Plus, Edit, Trash2 } from 'lucide-react';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import type { ExpenseCategoryForList } from '@/types';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
interface ExpenseCategoriesTabProps {
  shopId: string;
  expenseCategories: ExpenseCategoryForList[];
  onRefresh: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function ExpenseCategoriesTab({ shopId, expenseCategories, onRefresh }: ExpenseCategoriesTabProps) {
  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ExpenseCategoryForList | null>(null);
  const [form, setForm] = useState({ name: '' });

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
    setForm({ name: '' });
    setDialogOpen(true);
  };

  const handleEdit = (category: ExpenseCategoryForList) => {
    setEditing(category);
    setForm({ name: category.name });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error('Please enter category name');
      return;
    }

    try {
      if (editing) {
        const { error } = await supabase
          .from('expense_categories')
          .update({ name: form.name.trim() })
          .eq('id', editing.id);

        if (error) throw error;
        toast.success('Expense category updated successfully');
      } else {
        const { error } = await supabase
          .from('expense_categories')
          .insert({
            shop_id: shopId,
            name: form.name.trim(),
          });

        if (error) throw error;
        toast.success('Expense category added successfully');
      }

      setDialogOpen(false);
      await onRefresh();
    } catch (error: any) {
      console.error('Error saving expense category:', error);
      toast.error(error.message || 'Failed to save expense category');
    }
  };

  const handleDelete = (id: string) => {
    setConfirmDialog({
      open: true,
      title: 'Delete Expense Category',
      description: 'Are you sure you want to delete this expense category?',
      onConfirm: async () => {
        try {
          // Check if category is used in any expenses
          const { count } = await supabase
            .from('financial_transactions')
            .select('*', { count: 'exact', head: true })
            .eq('category_id', id);

          if (count && count > 0) {
            toast.error('Cannot delete category with existing expenses');
            return;
          }

          const { error } = await supabase
            .from('expense_categories')
            .delete()
            .eq('id', id);

          if (error) throw error;
          toast.success('Expense category deleted successfully');
          await onRefresh();
        } catch (error: any) {
          console.error('Error deleting expense category:', error);
          toast.error(error.message || 'Failed to delete expense category');
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
            <CardTitle className="text-lg">Expense Categories</CardTitle>
            <CardDescription>Manage expense categories for financial tracking</CardDescription>
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
                  <th className="text-left p-2 text-sm font-medium">Category Name</th>
                  <th className="text-right p-2 text-sm font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {expenseCategories.length === 0 ? (
                  <tr>
                    <td colSpan={2} className="text-center p-8 text-muted-foreground">
                      <div className="flex flex-col items-center gap-2">
                        <Receipt className="h-12 w-12 text-muted-foreground/50" />
                        <p className="text-sm">No expense categories found</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  expenseCategories.map((category) => (
                    <tr key={category.id} className="border-b hover:bg-muted/50 transition-colors">
                      <td className="p-2 font-medium text-sm">{category.name}</td>
                      <td className="p-2 text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEdit(category)}
                            className="hover:scale-105 active:scale-95 transition-all"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleDelete(category.id)}
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
            <DialogTitle>{editing ? 'Edit Expense Category' : 'Add Expense Category'}</DialogTitle>
            <DialogDescription>
              {editing ? 'Update expense category details' : 'Create a new expense category for financial tracking'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="expense_category_name" className="text-sm font-medium">Category Name *</Label>
              <Input
                id="expense_category_name"
                value={form.name}
                onChange={(e) => setForm({ name: e.target.value })}
                placeholder="e.g., Office Supplies, Utilities, Rent"
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
