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
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Zap, Plus, Loader2, Check, ChevronsUpDown, Settings2 } from 'lucide-react';
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

  // Form state
  const [categoryName, setCategoryName] = useState('');
  const [categorySearch, setCategorySearch] = useState('');
  const [categoryPopoverOpen, setCategoryPopoverOpen] = useState(false);
  const [sizeName, setSizeName] = useState('');
  const [sizeSearch, setSizeSearch] = useState('');
  const [sizePopoverOpen, setSizePopoverOpen] = useState(false);
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

  const handleCreateCategory = async () => {
    const name = categorySearch.trim();
    if (!name || !profile?.shop_id) return;
    if (categories.some(c => c.name.toLowerCase() === name.toLowerCase())) {
      setCategoryName(categories.find(c => c.name.toLowerCase() === name.toLowerCase())!.name);
      setCategoryPopoverOpen(false);
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
      setCategoryPopoverOpen(false);
      toast.success(`Category "${data.name}" created`);
    } catch (error: any) {
      toast.error(error.message?.includes('duplicate') ? 'Category already exists' : 'Failed to create category');
    } finally {
      setCreatingCategory(false);
    }
  };

  const handleCreateSize = async () => {
    const name = sizeSearch.trim();
    if (!name || !profile?.shop_id) return;
    if (sizes.some(sz => sz.size_name.toLowerCase() === name.toLowerCase())) {
      setSizeName(sizes.find(sz => sz.size_name.toLowerCase() === name.toLowerCase())!.size_name);
      setSizePopoverOpen(false);
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
      setSizePopoverOpen(false);
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
    setCategoryName('');
    setCategorySearch('');
    setSizeName('');
    setSizeSearch('');
    setPrice('');
    setTaxRate(String(DEFAULT_TAX_RATE));
    setNote('');
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        {/* Header */}
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
          {/* Category - autocomplete combobox */}
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
              <Popover modal={false} open={categoryPopoverOpen} onOpenChange={setCategoryPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={categoryPopoverOpen}
                    className="w-full justify-between font-normal text-sm"
                  >
                    {categoryName || <span className="text-muted-foreground">Select category</span>}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent usePortal={false} className="w-[--radix-popover-trigger-width] p-0" align="start">
                  <Command>
                    <CommandInput
                      placeholder="Search or type new..."
                      value={categorySearch}
                      onValueChange={setCategorySearch}
                    />
                    <CommandList>
                      <CommandEmpty>
                        {categorySearch.trim() ? (
                          <button
                            type="button"
                            className="w-full px-2 py-1.5 text-sm text-left hover:bg-accent rounded flex items-center gap-2"
                            onClick={handleCreateCategory}
                            disabled={creatingCategory}
                          >
                            {creatingCategory ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                            Create &quot;{categorySearch.trim()}&quot;
                          </button>
                        ) : (
                          <span className="text-muted-foreground text-xs">Type to search or create</span>
                        )}
                      </CommandEmpty>
                      <CommandGroup>
                        {categories.map((c) => (
                          <CommandItem
                            key={c.id}
                            value={c.name}
                            onSelect={(v) => {
                              setCategoryName(v);
                              setCategoryPopoverOpen(false);
                            }}
                          >
                            <Check className={`mr-2 h-4 w-4 ${categoryName === c.name ? 'opacity-100' : 'opacity-0'}`} />
                            {c.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            )}
          </div>

          {/* Size - autocomplete combobox */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Size</Label>
              {['admin', 'owner', 'superadmin'].includes(profile?.role || '') && (
                <Link href="/settings?tab=sizes" className="text-xs text-muted-foreground hover:text-foreground hover:underline flex items-center gap-1">
                  <Settings2 className="h-3 w-3" /> Manage
                </Link>
              )}
            </div>
            <Popover modal={false} open={sizePopoverOpen} onOpenChange={setSizePopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={sizePopoverOpen}
                  className="w-full justify-between font-normal text-sm"
                >
                  {sizeName || <span className="text-muted-foreground">Select size (optional)</span>}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent usePortal={false} className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command>
                  <CommandInput
                    placeholder="Search or type new..."
                    value={sizeSearch}
                    onValueChange={setSizeSearch}
                  />
                  <CommandList>
                    <CommandEmpty>
                      {sizeSearch.trim() ? (
                        <button
                          type="button"
                          className="w-full px-2 py-1.5 text-sm text-left hover:bg-accent rounded flex items-center gap-2"
                          onClick={handleCreateSize}
                          disabled={creatingSize}
                        >
                          {creatingSize ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                          Create &quot;{sizeSearch.trim()}&quot;
                        </button>
                      ) : (
                        <span className="text-muted-foreground text-xs">Type to search or create</span>
                      )}
                    </CommandEmpty>
                    <CommandGroup>
                      {sizes.map((sz) => (
                        <CommandItem
                          key={sz.id}
                          value={sz.size_name}
                          onSelect={(v) => {
                            setSizeName(v);
                            setSizePopoverOpen(false);
                          }}
                        >
                          <Check className={`mr-2 h-4 w-4 ${sizeName === sz.size_name ? 'opacity-100' : 'opacity-0'}`} />
                          {sz.size_name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
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
      </DialogContent>
    </Dialog>
  );
}
