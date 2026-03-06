'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardDescription, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Settings, Store, Receipt, Tags, Ruler, QrCode, Wallet, Info, Smartphone, ArrowLeft } from 'lucide-react';
import { BrandLoader } from '@/components/shared/BrandLoader';
import type { Shop, Category, Size, QrPrefix, ExpenseCategoryForList } from '@/types';
import { fetchQrPrefixes } from '@/lib/api/qr-prefixes';
import { appConfig } from '@/lib/config/app.config';

const s = appConfig.styles;
const a = s.accent;

// Admin-only tab components
import { ShopDetailsTab, TaxSettingsTab } from '@/components/admin/settings/ShopTabs';
import { CategoriesTab } from '@/components/admin/settings/CategoriesTab';
import { SizesTab } from '@/components/admin/settings/SizesTab';
import { ExpenseCategoriesTab } from '@/components/admin/settings/ExpenseCategoriesTab';
import { QrPrefixesTab } from '@/components/admin/settings/QrPrefixesTab';

// Shared tab components (visible to all roles)
import { AboutTab } from '@/components/shared/settings/AboutTab';
import { AppStatusTab } from '@/components/shared/settings/AppStatusTab';

/** Tabs visible to ALL roles */
const SHARED_TABS = [
  { value: 'about', label: 'About', icon: Info },
  { value: 'app-status', label: 'App & Install', icon: Smartphone },
];

/** Tabs visible only to admin/owner/superadmin */
const ADMIN_TABS = [
  { value: 'shop', label: 'Shop Details', icon: Store },
  { value: 'tax', label: 'Tax Settings', icon: Receipt },
  { value: 'categories', label: 'Categories', icon: Tags },
  { value: 'sizes', label: 'Sizes', icon: Ruler },
  { value: 'expense-categories', label: 'Expenses', icon: Wallet },
  { value: 'qr-prefixes', label: 'QR Prefixes', icon: QrCode },
];

const DEFAULT_TAB = 'about';

function SettingsPageContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { profile } = useAuth();
  const [shop, setShop] = useState<Shop | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [sizes, setSizes] = useState<Size[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<ExpenseCategoryForList[]>([]);
  const [qrPrefixes, setQrPrefixes] = useState<QrPrefix[]>([]);
  const [loading, setLoading] = useState(true);

  const isAdmin = profile?.role && ['admin', 'owner', 'superadmin'].includes(profile.role);
  const allTabs = isAdmin ? [...SHARED_TABS, ...ADMIN_TABS] : SHARED_TABS;
  const validTabValues = allTabs.map(t => t.value);

  // Read active tab from URL (fallback to default)
  const tabParam = searchParams.get('tab') || DEFAULT_TAB;
  const activeTab = validTabValues.includes(tabParam) ? tabParam : DEFAULT_TAB;

  const setActiveTab = useCallback((value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value === DEFAULT_TAB) {
      params.delete('tab');
    } else {
      params.set('tab', value);
    }
    const qs = params.toString();
    router.replace(`${pathname}${qs ? `?${qs}` : ''}`, { scroll: false });
  }, [searchParams, pathname, router]);

  useEffect(() => {
    if (profile?.shop_id && isAdmin) {
      loadData();
    } else if (profile !== undefined) {
      setLoading(false);
    }
  }, [profile?.shop_id, isAdmin]);

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
        supabase.from('categories').select('*').eq('shop_id', profile.shop_id).order('sort_order'),
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
        supabase.from('categories').select('*').eq('shop_id', profile.shop_id).order('sort_order'),
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
    return <BrandLoader message="Loading settings..." fullScreen={false} />;
  }

  // ── Main render ────────────────────────────────────────────────────────

  const shopId = profile?.shop_id;
  const homeRoute = profile?.role === 'superadmin' ? '/superadmin' 
    : ['admin', 'owner'].includes(profile?.role || '') ? '/admin' 
    : '/me';

  return (
    <div className="space-y-4 md:space-y-6 animate-content-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.push(homeRoute)} className="relative group shrink-0">
          <div className={`p-2.5 rounded-lg ${s.headerIconGradient} text-white shadow-md group-hover:shadow-lg transition-shadow`}>
            <Settings className="h-6 w-6" />
          </div>
          <div className="absolute -left-1.5 -top-1.5 bg-background border rounded-full p-1 shadow-sm group-hover:scale-110 transition-transform">
            <ArrowLeft className="h-3 w-3 text-muted-foreground" />
          </div>
        </button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
          <p className="text-sm text-muted-foreground">
            {isAdmin ? 'Manage app, shop settings, categories, and sizes' : 'App information and status'}
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        {/* Mobile: dropdown — all options visible in one tap */}
        <div className="sm:hidden">
          <Select value={activeTab} onValueChange={setActiveTab}>
            <SelectTrigger className={`w-full h-11 ${a.border} ${a.borderDark}`}>
              <SelectValue placeholder="Select section" />
            </SelectTrigger>
            <SelectContent>
              {/* Shared tabs */}
              {SHARED_TABS.map(({ value, label, icon: Icon }) => (
                <SelectItem key={value} value={value}>
                  <span className="flex items-center gap-2">
                    <Icon className="h-4 w-4" />
                    {label}
                  </span>
                </SelectItem>
              ))}
              
              {/* Separator + Admin tabs */}
              {isAdmin && (
                <>
                  <div className="px-2 py-1.5 border-t mt-1 pt-1">
                    <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Admin</span>
                  </div>
                  {ADMIN_TABS.map(({ value, label, icon: Icon }) => (
                    <SelectItem key={value} value={value}>
                      <span className="flex items-center gap-2">
                        <Icon className="h-4 w-4" />
                        {label}
                      </span>
                    </SelectItem>
                  ))}
                </>
              )}
            </SelectContent>
          </Select>
        </div>

        {/* Desktop: tab bar with active accent */}
        <TabsList className="hidden sm:inline-flex flex-wrap">
          {SHARED_TABS.map(({ value, label, icon: Icon }) => (
            <TabsTrigger
              key={value}
              value={value}
              className={`border border-transparent ${a.tabActive}`}
            >
              <Icon className="mr-2 h-4 w-4" />
              {label}
            </TabsTrigger>
          ))}
          
          {isAdmin && (
            <>
              <div className="w-px h-6 bg-border mx-1 self-center" />
              {ADMIN_TABS.map(({ value, label, icon: Icon }) => (
                <TabsTrigger
                  key={value}
                  value={value}
                  className={`border border-transparent ${a.tabActive}`}
                >
                  <Icon className="mr-2 h-4 w-4" />
                  {label}
                </TabsTrigger>
              ))}
            </>
          )}
        </TabsList>

        {/* ── Shared Tabs (All Roles) ─────────────────────────── */}
        <TabsContent value="app-status">
          <AppStatusTab />
        </TabsContent>

        <TabsContent value="about">
          <AboutTab />
        </TabsContent>

        {/* ── Admin-Only Tabs ─────────────────────────────────── */}
        {isAdmin && shop && shopId && (
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

export default function SettingsPage() {
  return (
    <Suspense>
      <SettingsPageContent />
    </Suspense>
  );
}
