'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Settings, Store, Receipt, Tags, Ruler, ArrowLeft, QrCode } from 'lucide-react';
import type { Shop, Category, Size, QrPrefix, ExpenseCategoryForList } from '@/types';
import { fetchQrPrefixes } from '@/lib/api/qr-prefixes';

// Tab components
import { ShopDetailsTab, TaxSettingsTab } from '@/components/admin/settings/ShopTabs';
import { CategoriesTab } from '@/components/admin/settings/CategoriesTab';
import { SizesTab } from '@/components/admin/settings/SizesTab';
import { ExpenseCategoriesTab } from '@/components/admin/settings/ExpenseCategoriesTab';
import { QrPrefixesTab } from '@/components/admin/settings/QrPrefixesTab';

export default function SettingsPage() {
  const router = useRouter();
  const { profile } = useAuth();
  const [shop, setShop] = useState<Shop | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [sizes, setSizes] = useState<Size[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<ExpenseCategoryForList[]>([]);
  const [qrPrefixes, setQrPrefixes] = useState<QrPrefix[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile?.shop_id) {
      loadData();
    } else if (profile !== undefined) {
      setLoading(false);
    }
  }, [profile?.shop_id]);

  const loadData = async () => {
    if (!profile?.shop_id) return;

    try {
      setLoading(true);

      const [
        { data: shopData, error: shopError },
        { data: categoriesData, error: categoriesError },
        { data: sizesData, error: sizesError },
        { data: expenseCatsData, error: expenseCatsError }
      ] = await Promise.all([
        supabase.from('shops').select('*').eq('id', profile.shop_id).single(),
        supabase.from('categories').select('*').eq('shop_id', profile.shop_id).order('name'),
        supabase.from('sizes').select('*').eq('shop_id', profile.shop_id).order('sort_order'),
        supabase.from('expense_categories').select('*').eq('shop_id', profile.shop_id).order('name'),
      ]);

      if (shopError) throw shopError;
      if (categoriesError) throw categoriesError;
      if (sizesError) throw sizesError;
      if (expenseCatsError) throw expenseCatsError;

      setShop(shopData);
      setCategories(categoriesData || []);
      setSizes(sizesData || []);
      setExpenseCategories(expenseCatsData || []);

      const qrPrefixesData = await fetchQrPrefixes(profile.shop_id);
      setQrPrefixes(qrPrefixesData);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  /** Silently re-fetch data without showing the loading skeleton */
  const refreshData = async () => {
    if (!profile?.shop_id) return;
    try {
      const [
        { data: shopData, error: shopError },
        { data: categoriesData, error: categoriesError },
        { data: sizesData, error: sizesError },
        { data: expenseCatsData, error: expenseCatsError }
      ] = await Promise.all([
        supabase.from('shops').select('*').eq('id', profile.shop_id).single(),
        supabase.from('categories').select('*').eq('shop_id', profile.shop_id).order('name'),
        supabase.from('sizes').select('*').eq('shop_id', profile.shop_id).order('sort_order'),
        supabase.from('expense_categories').select('*').eq('shop_id', profile.shop_id).order('name'),
      ]);
      if (shopError) throw shopError;
      if (categoriesError) throw categoriesError;
      if (sizesError) throw sizesError;
      if (expenseCatsError) throw expenseCatsError;
      setShop(shopData);
      setCategories(categoriesData || []);
      setSizes(sizesData || []);
      setExpenseCategories(expenseCatsData || []);
      const qrPrefixesData = await fetchQrPrefixes(profile.shop_id);
      setQrPrefixes(qrPrefixesData);
    } catch (error) {
      console.error('Error refreshing data:', error);
    }
  };

  // ── Loading skeleton ───────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-4 md:space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 bg-muted animate-pulse rounded-md" />
          <div className="space-y-2">
            <div className="h-8 w-48 bg-muted animate-pulse rounded" />
            <div className="h-4 w-96 bg-muted animate-pulse rounded" />
          </div>
        </div>
        <div className="h-10 w-full bg-muted animate-pulse rounded" />
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

  // ── Main render ────────────────────────────────────────────────────────

  const shopId = profile?.shop_id;

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

        {shop && shopId && (
          <>
            <TabsContent value="shop">
              <ShopDetailsTab shopId={shopId} shop={shop} onRefresh={refreshData} />
            </TabsContent>

            <TabsContent value="tax">
              <TaxSettingsTab shopId={shopId} shop={shop} onRefresh={refreshData} />
            </TabsContent>

            <TabsContent value="categories">
              <CategoriesTab shopId={shopId} categories={categories} onRefresh={refreshData} />
            </TabsContent>

            <TabsContent value="sizes">
              <SizesTab shopId={shopId} sizes={sizes} onRefresh={refreshData} />
            </TabsContent>

            <TabsContent value="expense-categories">
              <ExpenseCategoriesTab shopId={shopId} expenseCategories={expenseCategories} onRefresh={refreshData} />
            </TabsContent>

            <TabsContent value="qr-prefixes">
              <QrPrefixesTab shopId={shopId} qrPrefixes={qrPrefixes} onRefresh={refreshData} />
            </TabsContent>
          </>
        )}
      </Tabs>
    </div>
  );
}
