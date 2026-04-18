'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PickerDialog } from '@/components/shared/PickerDialog';
import { Zap, Plus, Loader2, ChevronsUpDown, Settings2 } from 'lucide-react';
import type { CartItem } from '@/types/pos.types';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { fetchCategories, fetchSizes } from '@/lib/api/inventory';
import { DEFAULT_TAX_RATE } from '@/lib/constants';
import { toast } from 'sonner';
import { appConfig } from '@/lib/config/app.config';
import Link from 'next/link';

const s = appConfig.styles;

interface QuickAddItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddToCart: (item: CartItem) => void;
}

export function QuickAddItemDialog({
  open,
  onOpenChange,
  onAddToCart,
}: QuickAddItemDialogProps) {
  const { profile } = useAuth();
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [sizes, setSizes] = useState<{ id: string; size_name: string }[]>([]);
  const [loadingRef, setLoadingRef] = useState(false);
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false);
  const [sizePickerOpen, setSizePickerOpen] = useState(false);

  // Form state
  const [categoryName, setCategoryName] = useState('');
  const [sizeName, setSizeName] = useState('');
  const [price, setPrice] = useState('');
  const [taxRate, setTaxRate] = useState(String(DEFAULT_TAX_RATE));
  const [note, setNote] = useState('');
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [creatingSize, setCreatingSize] = useState(false);

  // Fetch categories and sizes when dialog opens
  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    async function load() {
      setLoadingRef(true);
      try {
        const [cats, szs] = await Promise.all([
          fetchCategories().catch(() => []),
          fetchSizes().catch(() => []),
        ]);
        if (!cancelled) {
          setCategories(cats?.map(c => ({ id: c.id, name: c.name })) || []);
          setSizes(szs?.map(sz => ({ id: sz.id, size_name: sz.size_name || '' })).filter(sz => sz.size_name) || []);
        }
      } finally {
        if (!cancelled) setLoadingRef(false);
      }
    }
    load();

    return () => { cancelled = true; };
  }, [open]);

  const handleCreateCategory = async (name: string) => {
    if (!name || !profile?.shop_id) return;
    const existing = categories.find(c => c.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      setCategoryName(existing.name);
      setCategoryPickerOpen(false);
      return;
    }
    setCreatingCategory(true);
    try {
      const { data, error } = await supabase
        .from('categories')
        .insert({ name, shop_id: profile.shop_id })
        .select('id, name')
        .single();
      if (error) throw error;
      setCategories(prev => [...prev, data]);
      setCategoryName(data.name);
      setCategoryPickerOpen(false);
      toast.success(`Category "${data.name}" created`);
    } catch (error: any) {
      toast.error(error.message?.includes('duplicate') ? 'Category already exists' : 'Failed to create category');
    } finally {
      setCreatingCategory(false);
    }
  };

  const handleCreateSize = async (name: string) => {
    if (!name || !profile?.shop_id) return;
    const existing = sizes.find(sz => sz.size_name.toLowerCase() === name.toLowerCase());
    if (existing) {
      setSizeName(existing.size_name);
      setSizePickerOpen(false);
      return;
    }
    setCreatingSize(true);
    try {
      const { data, error } = await supabase
        .from('sizes')
        .insert({ size_name: name, shop_id: profile.shop_id })
        .select('id, size_name')
        .single();
      if (error) throw error;
      setSizes(prev => [...prev, data]);
      setSizeName(data.size_name);
      setSizePickerOpen(false);
      toast.success(`Size "${data.size_name}" created`);
    } catch (error: any) {
      toast.error(error.message?.includes('duplicate') ? 'Size already exists' : 'Failed to create size');
    } finally {
      setCreatingSize(false);
    }
  };

  const handleAdd = useCallback(() => {
    const priceNum = parseFloat(price);
    if (!categoryName) {
      toast.error('Please select or create a category');
      return;
    }
    if (!priceNum || priceNum <= 0) {
      toast.error('Please enter a valid price');
      return;
    }

    const taxRateNum = parseFloat(taxRate) || 0;

    const item: CartItem = {
      id: `manual-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      qrCode: `MANUAL-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`,
      inventoryItemId: '',
      category: categoryName,
      size: sizeName || 'N/A',
      originalPrice: priceNum,
      finalPrice: priceNum,
      taxRate: taxRateNum,
      lotId: '',
      isManualEntry: true,
      manualNote: note.trim() || undefined,
    };

    onAddToCart(item);
    handleClose();
  }, [categoryName, sizeName, price, taxRate, note, onAddToCart]);

  const handleClose = () => {
    onOpenChange(false);
    setCategoryPickerOpen(false);
    setSizePickerOpen(false);
    setCategoryName('');
    setSizeName('');
    setPrice('');
    setTaxRate(String(DEFAULT_TAX_RATE));
    setNote('');
  };

  // ── Back-button interception via history API ──
  // Push a hash entry when the dialog opens so the hardware back button closes
  // the dialog instead of navigating away. Using a URL hash (not state object)
  // means Next.js App Router doesn't intercept the navigation and close parent
  // Sheets/dialogs.
  useEffect(() => {
    if (!open) return;

    const originalHref = window.location.href;
    const hashId = 'quick-add-dialog';
    history.pushState(history.state, '', `${window.location.pathname}${window.location.search}#${hashId}`);

    const onPopState = () => {
      if (window.location.hash === `#${hashId}`) return;
      handleClose();
    };

    window.addEventListener('popstate', onPopState);
    return () => {
      window.removeEventListener('popstate', onPopState);
      if (window.location.hash === `#${hashId}`) {
        history.replaceState(history.state, '', originalHref);
      }
    };
  }, [open]);

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) handleClose();
  };

  return (
    <>
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">

        {/* ── MAIN FORM VIEW ── */}
          <>
            <DialogHeader>
              <div className="flex items-center gap-2">
                <div className={`p-2 rounded-lg ${s.headerIconGradient} text-white`}>
                  <Zap className="h-4 w-4" />
                </div>
                <div>
                  <DialogTitle>Quick Add Item</DialogTitle>
                  <DialogDescription>
                    Add an item without QR code — for untagged inventory
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-4 py-2">
              {/* Category */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">
                    Category <span className="text-destructive">*</span>
                  </Label>
                  {['admin', 'owner', 'superadmin'].includes(profile?.role || '') && (
                    <Link href="/settings?tab=categories" className="text-xs text-muted-foreground hover:text-foreground hover:underline flex items-center gap-1">
                      <Settings2 className="h-3 w-3" /> Manage
                    </Link>
                  )}
                </div>
                {loadingRef ? (
                  <div className="flex items-center gap-2 h-10 px-3 border rounded-md text-sm text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" /> Loading...
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    onClick={() => setCategoryPickerOpen(true)}
                    className="w-full justify-between font-normal text-sm"
                  >
                    {categoryName || <span className="text-muted-foreground">Select category</span>}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                )}
              </div>

              {/* Size */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Size</Label>
                  {['admin', 'owner', 'superadmin'].includes(profile?.role || '') && (
                    <Link href="/settings?tab=sizes" className="text-xs text-muted-foreground hover:text-foreground hover:underline flex items-center gap-1">
                      <Settings2 className="h-3 w-3" /> Manage
                    </Link>
                  )}
                </div>
                <Button
                  variant="outline"
                  onClick={() => setSizePickerOpen(true)}
                  className="w-full justify-between font-normal text-sm"
                >
                  {sizeName || <span className="text-muted-foreground">Select size (optional)</span>}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </div>

              {/* Price & Tax */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="qa-price" className="text-sm font-medium">
                    Price (₹) <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="qa-price"
                    type="number"
                    min={1}
                    step={10}
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="0"
                    className="text-lg font-semibold"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="qa-tax" className="text-sm font-medium">Tax %</Label>
                  <Input
                    id="qa-tax"
                    type="number"
                    min={0}
                    max={100}
                    step={0.5}
                    value={taxRate}
                    onChange={(e) => setTaxRate(e.target.value)}
                    placeholder="0"
                  />
                </div>
              </div>

              {/* Note */}
              <div className="space-y-1.5">
                <Label htmlFor="qa-note" className="text-sm font-medium">Note (optional)</Label>
                <Input
                  id="qa-note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="e.g. Blue floral print"
                />
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-3">
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                onClick={handleAdd}
                disabled={!categoryName || !price || parseFloat(price) <= 0}
                className={`${s.primaryGradient} ${s.primaryGradientHover} text-white`}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add to Cart
              </Button>
            </DialogFooter>
          </>

      </DialogContent>
    </Dialog>

    {/* ── Picker Dialogs (siblings, not nested) ── */}
    <PickerDialog
      open={categoryPickerOpen}
      onOpenChange={setCategoryPickerOpen}
      title="Select Category"
      searchPlaceholder="Search or type new..."
      items={categories.map(c => ({ id: c.id, label: c.name }))}
      selectedId={categories.find(c => c.name === categoryName)?.id}
      onSelect={(id) => {
        const cat = categories.find(c => c.id === id);
        if (cat) setCategoryName(cat.name);
      }}
      allowCreate
      onCreateNew={handleCreateCategory}
      creating={creatingCategory}
    />
    <PickerDialog
      open={sizePickerOpen}
      onOpenChange={setSizePickerOpen}
      title="Select Size"
      searchPlaceholder="Search or type new..."
      items={sizes.map(sz => ({ id: sz.id, label: sz.size_name }))}
      selectedId={sizes.find(sz => sz.size_name === sizeName)?.id}
      onSelect={(id) => {
        const sz = sizes.find(s => s.id === id);
        if (sz) setSizeName(sz.size_name);
      }}
      allowCreate
      onCreateNew={handleCreateSize}
      creating={creatingSize}
    />
    </>
  );
}
