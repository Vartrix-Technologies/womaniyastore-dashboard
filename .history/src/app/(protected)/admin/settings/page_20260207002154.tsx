'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Settings, Store, Receipt, Tags, Ruler, Plus, Edit, Trash2, ArrowLeft, QrCode, ToggleLeft, ToggleRight } from 'lucide-react';
import type { Shop, Category, Size, QrPrefix, ExpenseCategoryForList } from '@/types';
import { fetchQrPrefixes, createQrPrefix, updateQrPrefix, deleteQrPrefix } from '@/lib/api/qr-prefixes';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';

export default function SettingsPage() {
  const router = useRouter();
  const { profile } = useAuth();
  const [shop, setShop] = useState<Shop | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [sizes, setSizes] = useState<Size[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<ExpenseCategoryForList[]>([]);
  const [qrPrefixes, setQrPrefixes] = useState<QrPrefix[]>([]);
  const [loading, setLoading] = useState(true);

  // Confirm dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
  }>({ open: false, title: '', description: '', onConfirm: () => {} });

  // Dialog states
  const [categoryDialog, setCategoryDialog] = useState(false);
  const [sizeDialog, setSizeDialog] = useState(false);
  const [expenseCategoryDialog, setExpenseCategoryDialog] = useState(false);
  const [qrPrefixDialog, setQrPrefixDialog] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editingSize, setEditingSize] = useState<Size | null>(null);
  const [editingExpenseCategory, setEditingExpenseCategory] = useState<ExpenseCategoryForList | null>(null);
  const [editingQrPrefix, setEditingQrPrefix] = useState<QrPrefix | null>(null);

  // Form states
  const [shopForm, setShopForm] = useState({
    shop_name: '',
    address: '',
    phone: '',
    tax_rate: 0,
    bill_prefix: '',
  });

  const [categoryForm, setCategoryForm] = useState({
    name: '',
    description: '',
  });

  const [sizeForm, setSizeForm] = useState({
    size_name: '',
    sort_order: 0,
  });

  const [expenseCategoryForm, setExpenseCategoryForm] = useState({
    name: '',
  });

  const [qrPrefixForm, setQrPrefixForm] = useState({
    prefix: '',
    description: '',
    display_order: 0,
  });

  useEffect(() => {
    if (profile?.shop_id) {
      loadData();
    } else if (profile !== undefined) {
      // Profile loaded but no shop_id
      setLoading(false);
    }
  }, [profile?.shop_id]);

  const loadData = async () => {
    if (!profile?.shop_id) return;

    try {
      setLoading(true);

      // Parallelize all data fetches for faster load
      const [
        { data: shopData, error: shopError },
        { data: categoriesData, error: categoriesError },
        { data: sizesData, error: sizesError },
        { data: expenseCatsData, error: expenseCatsError }
      ] = await Promise.all([
        supabase
          .from('shops')
          .select('*')
          .eq('id', profile.shop_id)
          .single(),
        supabase
          .from('categories')
          .select('*')
          .eq('shop_id', profile.shop_id)
          .order('name'),
        supabase
          .from('sizes')
          .select('*')
          .eq('shop_id', profile.shop_id)
          .order('sort_order'),
        supabase
          .from('expense_categories')
          .select('*')
          .eq('shop_id', profile.shop_id)
          .order('name')
      ]);

      if (shopError) throw shopError;
      if (categoriesError) throw categoriesError;
      if (sizesError) throw sizesError;
      if (expenseCatsError) throw expenseCatsError;

      setShop(shopData);
      setShopForm({
        shop_name: shopData.shop_name,
        address: shopData.address || '',
        phone: shopData.phone || '',
        tax_rate: shopData.tax_rate,
        bill_prefix: shopData.bill_prefix,
      });
      setCategories(categoriesData || []);
      setSizes(sizesData || []);
      setExpenseCategories(expenseCatsData || []);
      
      // Load QR Prefixes
      const qrPrefixesData = await fetchQrPrefixes(profile.shop_id);
      setQrPrefixes(qrPrefixesData);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveShop = async () => {
    if (!profile?.shop_id) return;

    try {
      const { error } = await supabase
        .from('shops')
        .update({
          shop_name: shopForm.shop_name,
          address: shopForm.address || null,
          phone: shopForm.phone || null,
          tax_rate: shopForm.tax_rate,
          bill_prefix: shopForm.bill_prefix,
        })
        .eq('id', profile.shop_id);

      if (error) throw error;
      toast.success('Shop settings updated successfully');
      await loadData();
    } catch (error: any) {
      console.error('Error updating shop:', error);
      toast.error(error.message || 'Failed to update shop settings');
    }
  };

  const handleAddCategory = () => {
    setEditingCategory(null);
    setCategoryForm({ name: '', description: '' });
    setCategoryDialog(true);
  };

  const handleEditCategory = (category: Category) => {
    setEditingCategory(category);
    setCategoryForm({
      name: category.name,
      description: category.description || '',
    });
    setCategoryDialog(true);
  };

  const handleSaveCategory = async () => {
    if (!profile?.shop_id || !categoryForm.name.trim()) {
      toast.error('Please enter category name');
      return;
    }

    try {
      if (editingCategory) {
        const { error } = await supabase
          .from('categories')
          .update({
            name: categoryForm.name,
            description: categoryForm.description || null,
          })
          .eq('id', editingCategory.id);

        if (error) throw error;
        toast.success('Category updated successfully');
      } else {
        const { error } = await supabase
          .from('categories')
          .insert({
            shop_id: profile.shop_id,
            name: categoryForm.name,
            description: categoryForm.description || null,
          });

        if (error) throw error;
        toast.success('Category added successfully');
      }

      setCategoryDialog(false);
      await loadData();
    } catch (error: any) {
      console.error('Error saving category:', error);
      toast.error(error.message || 'Failed to save category');
    }
  };

  const handleDeleteCategory = (id: string) => {
    setConfirmDialog({
      open: true,
      title: 'Delete Category',
      description: 'Are you sure you want to delete this category?',
      onConfirm: async () => {
        try {
          const { error } = await supabase
            .from('categories')
            .delete()
            .eq('id', id);

          if (error) throw error;
          toast.success('Category deleted successfully');
          await loadData();
        } catch (error: any) {
          console.error('Error deleting category:', error);
          toast.error(error.message || 'Failed to delete category');
        }
      },
    });
  };

  const handleAddSize = () => {
    setEditingSize(null);
    setSizeForm({ size_name: '', sort_order: sizes.length });
    setSizeDialog(true);
  };

  const handleEditSize = (size: Size) => {
    setEditingSize(size);
    setSizeForm({
      size_name: size.size_name,
      sort_order: size.sort_order,
    });
    setSizeDialog(true);
  };

  const handleSaveSize = async () => {
    if (!profile?.shop_id || !sizeForm.size_name.trim()) {
      toast.error('Please enter size name');
      return;
    }

    try {
      if (editingSize) {
        const { error } = await supabase
          .from('sizes')
          .update({
            size_name: sizeForm.size_name,
            sort_order: sizeForm.sort_order,
          })
          .eq('id', editingSize.id);

        if (error) throw error;
        toast.success('Size updated successfully');
      } else {
        const { error } = await supabase
          .from('sizes')
          .insert({
            shop_id: profile.shop_id,
            size_name: sizeForm.size_name,
            sort_order: sizeForm.sort_order,
          });

        if (error) throw error;
        toast.success('Size added successfully');
      }

      setSizeDialog(false);
      await loadData();
    } catch (error: any) {
      console.error('Error saving size:', error);
      toast.error(error.message || 'Failed to save size');
    }
  };

  const handleDeleteSize = (id: string) => {
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
          await loadData();
        } catch (error: any) {
          console.error('Error deleting size:', error);
          toast.error(error.message || 'Failed to delete size');
        }
      },
    });
  };

  // Expense Category handlers
  const handleAddExpenseCategory = () => {
    setEditingExpenseCategory(null);
    setExpenseCategoryForm({ name: '' });
    setExpenseCategoryDialog(true);
  };

  const handleEditExpenseCategory = (category: ExpenseCategoryForList) => {
    setEditingExpenseCategory(category);
    setExpenseCategoryForm({ name: category.name });
    setExpenseCategoryDialog(true);
  };

  const handleSaveExpenseCategory = async () => {
    if (!profile?.shop_id || !expenseCategoryForm.name.trim()) {
      toast.error('Please enter category name');
      return;
    }

    try {
      if (editingExpenseCategory) {
        const { error } = await supabase
          .from('expense_categories')
          .update({ name: expenseCategoryForm.name.trim() })
          .eq('id', editingExpenseCategory.id);

        if (error) throw error;
        toast.success('Expense category updated successfully');
      } else {
        const { error } = await supabase
          .from('expense_categories')
          .insert({
            shop_id: profile.shop_id,
            name: expenseCategoryForm.name.trim(),
          });

        if (error) throw error;
        toast.success('Expense category added successfully');
      }

      setExpenseCategoryDialog(false);
      await loadData();
    } catch (error: any) {
      console.error('Error saving expense category:', error);
      toast.error(error.message || 'Failed to save expense category');
    }
  };

  const handleDeleteExpenseCategory = (id: string) => {
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
          await loadData();
        } catch (error: any) {
          console.error('Error deleting expense category:', error);
          toast.error(error.message || 'Failed to delete expense category');
        }
      },
    });
  };

  // QR Prefix handlers
  const handleAddQrPrefix = () => {
    setEditingQrPrefix(null);
    setQrPrefixForm({ 
      prefix: '', 
      description: '', 
      display_order: qrPrefixes.length 
    });
    setQrPrefixDialog(true);
  };

  const handleEditQrPrefix = (qrPrefix: QrPrefix) => {
    setEditingQrPrefix(qrPrefix);
    setQrPrefixForm({
      prefix: qrPrefix.prefix,
      description: qrPrefix.description || '',
      display_order: qrPrefix.display_order,
    });
    setQrPrefixDialog(true);
  };

  const validateQrPrefixFormat = (prefix: string): boolean => {
    const formatRegex = /^[A-Z0-9]+(-[A-Z0-9]+)+$/;
    return formatRegex.test(prefix);
  };

  const handleSaveQrPrefix = async () => {
    if (!profile?.shop_id || !qrPrefixForm.prefix.trim()) {
      toast.error('Please enter prefix name');
      return;
    }

    // Validate format
    if (!validateQrPrefixFormat(qrPrefixForm.prefix)) {
      toast.error('Invalid prefix format. Use uppercase alphanumeric with hyphens (e.g., WA-499, WA-TP-599)');
      return;
    }

    try {
      if (editingQrPrefix) {
        await updateQrPrefix(editingQrPrefix.id, {
          prefix: qrPrefixForm.prefix,
          description: qrPrefixForm.description || null,
          display_order: qrPrefixForm.display_order,
        });
        toast.success('QR Prefix updated successfully');
      } else {
        await createQrPrefix({
          shop_id: profile.shop_id,
          prefix: qrPrefixForm.prefix,
          description: qrPrefixForm.description || undefined,
          display_order: qrPrefixForm.display_order,
        });
        toast.success('QR Prefix added successfully');
      }

      setQrPrefixDialog(false);
      await loadData();
    } catch (error: any) {
      console.error('Error saving QR prefix:', error);
      if (error.code === '23505') {
        toast.error('A prefix with this name already exists');
      } else {
        toast.error(error.message || 'Failed to save QR prefix');
      }
    }
  };

  const handleToggleQrPrefixActive = async (qrPrefix: QrPrefix) => {
    try {
      await updateQrPrefix(qrPrefix.id, {
        is_active: !qrPrefix.is_active,
      });
      toast.success(`QR Prefix ${qrPrefix.is_active ? 'deactivated' : 'activated'} successfully`);
      await loadData();
    } catch (error: any) {
      console.error('Error toggling QR prefix:', error);
      toast.error(error.message || 'Failed to update QR prefix');
    }
  };

  const handleDeleteQrPrefix = (id: string) => {
    setConfirmDialog({
      open: true,
      title: 'Delete QR Prefix',
      description: 'Are you sure you want to delete this QR prefix? This will fail if any QR codes are assigned.',
      onConfirm: async () => {
        try {
          await deleteQrPrefix(id);
          toast.success('QR Prefix deleted successfully');
          await loadData();
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

  if (loading) {
    return (
      <div className="space-y-4 md:space-y-6">
        {/* Header Skeleton */}
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 bg-muted animate-pulse rounded-md" />
          <div className="space-y-2">
            <div className="h-8 w-48 bg-muted animate-pulse rounded" />
            <div className="h-4 w-96 bg-muted animate-pulse rounded" />
          </div>
        </div>
        {/* Tabs Skeleton */}
        <div className="h-10 w-full bg-muted animate-pulse rounded" />
        {/* Content Skeleton */}
        <Card>
          <CardHeader>
            <div className="h-6 w-32 bg-muted animate-pulse rounded mb-2" />
            <div className="h-4 w-64 bg-muted animate-pulse rounded" />
          </CardHeader>
          <CardContent className="space-y-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="h-4 w-24 bg-muted animate-pulse rounded" />
                <div className="h-10 w-full bg-muted animate-pulse rounded" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <Button
          variant="ghost"
          onClick={() => router.push('/admin')}
          className="mb-2 -ml-2 text-teal-600 hover:text-teal-700 hover:bg-teal-50"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Dashboard
        </Button>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-teal-500 to-cyan-600 rounded-lg">
            <Settings className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
            <p className="text-sm text-muted-foreground">Manage shop settings, categories, and sizes</p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="shop" className="space-y-4">
        <div className="overflow-x-auto">
          <TabsList className="inline-flex w-auto min-w-full">
            {profile?.role !== 'staff' && (
              <>
                <TabsTrigger value="shop" className="flex-shrink-0">
                  <Store className="mr-2 h-4 w-4" />
                  <span className="hidden sm:inline">Shop Details</span>
                  <span className="sm:hidden">Shop</span>
                </TabsTrigger>
                <TabsTrigger value="tax" className="flex-shrink-0">
                  <Receipt className="mr-2 h-4 w-4" />
                  <span className="hidden sm:inline">Tax Settings</span>
                  <span className="sm:hidden">Tax</span>
                </TabsTrigger>
                <TabsTrigger value="categories" className="flex-shrink-0">
                  <Tags className="mr-2 h-4 w-4" />
                  <span className="hidden sm:inline">Categories</span>
                  <span className="sm:hidden">Items</span>
                </TabsTrigger>
                <TabsTrigger value="sizes" className="flex-shrink-0">
                  <Ruler className="mr-2 h-4 w-4" />
                  <span className="hidden sm:inline">Sizes</span>
                  <span className="sm:hidden">Sizes</span>
                </TabsTrigger>
                <TabsTrigger value="expense-categories" className="flex-shrink-0">
                  <Receipt className="mr-2 h-4 w-4" />
                  <span className="hidden sm:inline">Expense Categories</span>
                  <span className="sm:hidden">Expenses</span>
                </TabsTrigger>
                <TabsTrigger value="qr-prefixes" className="flex-shrink-0">
                  <QrCode className="mr-2 h-4 w-4" />
                  <span className="hidden sm:inline">QR Prefixes</span>
                  <span className="sm:hidden">QR</span>
                </TabsTrigger>
              </>
            )}
            {profile?.role === 'staff' && (
              <div className="p-4 text-center w-full">
                <p className="text-sm text-muted-foreground">Staff settings coming soon</p>
              </div>
            )}
          </TabsList>
        </div>

        <TabsContent value="shop">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Shop Information</CardTitle>
              <CardDescription>Update your shop details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="shop_name" className="text-sm font-medium">Shop Name *</Label>
                  <Input
                    id="shop_name"
                    value={shopForm.shop_name}
                    onChange={(e) => setShopForm({ ...shopForm, shop_name: e.target.value })}
                    placeholder="Enter shop name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-sm font-medium">Phone</Label>
                  <Input
                    id="phone"
                    value={shopForm.phone}
                    onChange={(e) => setShopForm({ ...shopForm, phone: e.target.value })}
                    placeholder="Contact number"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="address" className="text-sm font-medium">Address</Label>
                <Input
                  id="address"
                  value={shopForm.address}
                  onChange={(e) => setShopForm({ ...shopForm, address: e.target.value })}
                  placeholder="Shop address"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bill_prefix" className="text-sm font-medium">Bill Number Prefix</Label>
                <Input
                  id="bill_prefix"
                  value={shopForm.bill_prefix}
                  onChange={(e) => setShopForm({ ...shopForm, bill_prefix: e.target.value })}
                  placeholder="e.g., WMY"
                />
              </div>
              <Button 
                onClick={handleSaveShop}
                className="bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-600 hover:to-cyan-700 hover:scale-105 active:scale-95 transition-all"
              >
                Save Changes
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tax">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Tax Configuration</CardTitle>
              <CardDescription>Set tax rate for sales</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="tax_rate" className="text-sm font-medium">Tax Rate (%) *</Label>
                <Input
                  id="tax_rate"
                  type="number"
                  min={0}
                  max={100}
                  step={0.01}
                  value={shopForm.tax_rate}
                  onChange={(e) => setShopForm({ ...shopForm, tax_rate: parseFloat(e.target.value) })}
                  placeholder="0.00"
                />
                <p className="text-xs text-muted-foreground">Enter the tax percentage applied to sales</p>
              </div>
              <Button 
                onClick={handleSaveShop}
                className="bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-600 hover:to-cyan-700 hover:scale-105 active:scale-95 transition-all"
              >
                Save Changes
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="categories">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <div>
                <CardTitle className="text-lg">Product Categories</CardTitle>
                <CardDescription>Manage product categories</CardDescription>
              </div>
              <Button 
                onClick={handleAddCategory}
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
                      <th className="text-left p-2 text-sm font-medium">Name</th>
                      <th className="text-left p-2 text-sm font-medium">Description</th>
                      <th className="text-right p-2 text-sm font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categories.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="text-center p-8 text-muted-foreground">
                          <div className="flex flex-col items-center gap-2">
                            <Tags className="h-12 w-12 text-muted-foreground/50" />
                            <p className="text-sm">No categories found</p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      categories.map((category) => (
                        <tr key={category.id} className="border-b hover:bg-muted/50 transition-colors">
                          <td className="p-2 font-medium text-sm">{category.name}</td>
                          <td className="p-2 text-sm text-muted-foreground">{category.description || '-'}</td>
                          <td className="p-2 text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleEditCategory(category)}
                                className="hover:scale-105 active:scale-95 transition-all"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleDeleteCategory(category.id)}
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
        </TabsContent>

        <TabsContent value="sizes">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <div>
                <CardTitle className="text-lg">Product Sizes</CardTitle>
                <CardDescription>Manage product sizes</CardDescription>
              </div>
              <Button 
                onClick={handleAddSize}
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
                                onClick={() => handleEditSize(size)}
                                className="hover:scale-105 active:scale-95 transition-all"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleDeleteSize(size.id)}
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
        </TabsContent>

        <TabsContent value="expense-categories">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <div>
                <CardTitle className="text-lg">Expense Categories</CardTitle>
                <CardDescription>Manage expense categories for financial tracking</CardDescription>
              </div>
              <Button 
                onClick={handleAddExpenseCategory}
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
                                onClick={() => handleEditExpenseCategory(category)}
                                className="hover:scale-105 active:scale-95 transition-all"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleDeleteExpenseCategory(category.id)}
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
        </TabsContent>

        <TabsContent value="qr-prefixes">
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
                  onClick={handleAddQrPrefix}
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
                                onClick={() => handleToggleQrPrefixActive(qrPrefix)}
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
                                onClick={() => handleEditQrPrefix(qrPrefix)}
                                className="hover:scale-105 active:scale-95 transition-all"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleDeleteQrPrefix(qrPrefix.id)}
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
        </TabsContent>
      </Tabs>

      {/* Category Dialog */}
      <Dialog open={categoryDialog} onOpenChange={setCategoryDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCategory ? 'Edit Category' : 'Add Category'}</DialogTitle>
            <DialogDescription>
              {editingCategory ? 'Update category details' : 'Create a new product category'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="category_name" className="text-sm font-medium">Name *</Label>
              <Input
                id="category_name"
                value={categoryForm.name}
                onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                placeholder="e.g., Sarees"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category_description" className="text-sm font-medium">Description</Label>
              <Input
                id="category_description"
                value={categoryForm.description}
                onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
                placeholder="Optional description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCategoryDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSaveCategory}
              className="bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-600 hover:to-cyan-700"
            >
              {editingCategory ? 'Update' : 'Add'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Size Dialog */}
      <Dialog open={sizeDialog} onOpenChange={setSizeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingSize ? 'Edit Size' : 'Add Size'}</DialogTitle>
            <DialogDescription>
              {editingSize ? 'Update size details' : 'Create a new product size'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="size_name" className="text-sm font-medium">Size Name *</Label>
              <Input
                id="size_name"
                value={sizeForm.size_name}
                onChange={(e) => setSizeForm({ ...sizeForm, size_name: e.target.value })}
                placeholder="e.g., Small, Medium, Large"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sort_order" className="text-sm font-medium">Sort Order</Label>
              <Input
                id="sort_order"
                type="number"
                value={sizeForm.sort_order}
                onChange={(e) => setSizeForm({ ...sizeForm, sort_order: parseInt(e.target.value) })}
                placeholder="0"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSizeDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSaveSize}
              className="bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-600 hover:to-cyan-700"
            >
              {editingSize ? 'Update' : 'Add'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Expense Category Dialog */}
      <Dialog open={expenseCategoryDialog} onOpenChange={setExpenseCategoryDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingExpenseCategory ? 'Edit Expense Category' : 'Add Expense Category'}</DialogTitle>
            <DialogDescription>
              {editingExpenseCategory ? 'Update expense category details' : 'Create a new expense category for financial tracking'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="expense_category_name" className="text-sm font-medium">Category Name *</Label>
              <Input
                id="expense_category_name"
                value={expenseCategoryForm.name}
                onChange={(e) => setExpenseCategoryForm({ name: e.target.value })}
                placeholder="e.g., Office Supplies, Utilities, Rent"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExpenseCategoryDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSaveExpenseCategory}
              className="bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-600 hover:to-cyan-700"
            >
              {editingExpenseCategory ? 'Update' : 'Add'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* QR Prefix Dialog */}
      <Dialog open={qrPrefixDialog} onOpenChange={setQrPrefixDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingQrPrefix ? 'Edit QR Prefix' : 'Add QR Prefix'}</DialogTitle>
            <DialogDescription>
              {editingQrPrefix ? 'Update QR prefix details' : 'Create a new QR prefix for organizing inventory'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="qr_prefix_name" className="text-sm font-medium">Prefix *</Label>
              <Input
                id="qr_prefix_name"
                value={qrPrefixForm.prefix}
                onChange={(e) => setQrPrefixForm({ ...qrPrefixForm, prefix: e.target.value.toUpperCase() })}
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
                value={qrPrefixForm.description}
                onChange={(e) => setQrPrefixForm({ ...qrPrefixForm, description: e.target.value })}
                placeholder="e.g., ₹499 Kurtas"
              />
              <p className="text-xs text-muted-foreground">
                Optional: Add a description to help identify the prefix
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setQrPrefixDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSaveQrPrefix}
              className="bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-600 hover:to-cyan-700"
            >
              {editingQrPrefix ? 'Update' : 'Add'}
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
    </div>
  );
}
