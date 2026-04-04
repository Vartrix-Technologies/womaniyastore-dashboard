'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { addStockLotSchema, type AddStockLotFormValues } from '@/lib/validations/add-stock-lot';
import { supabase } from '@/lib/supabase';
import { addStockLot } from '@/lib/api/inventory';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { ArrowLeft, Loader2, HelpCircle, Package, Check, ChevronsUpDown, Eye, ChevronLeft, Plus, AlertCircle, Settings2 } from 'lucide-react';
import Link from 'next/link';
import { appConfig } from '@/lib/config/app.config';
import { formatCurrency } from '@/lib/formatters';
import type { Category, Size, QrPrefix } from '@/types';

const s = appConfig.styles;
const a = s.accent;
import { fetchActiveQrPrefixes, getUnusedQrCodeCount } from '@/lib/api/qr-prefixes';

export default function AddStockLotPage() {
  const { profile } = useAuth();
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [sizes, setSizes] = useState<Size[]>([]);
  const [qrPrefixes, setQrPrefixes] = useState<QrPrefix[]>([]);
  const [availableQrCount, setAvailableQrCount] = useState<number>(0);
  const [submitting, setSubmitting] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  // Vendor autocomplete
  const [vendorNames, setVendorNames] = useState<string[]>([]);
  const [vendorPopoverOpen, setVendorPopoverOpen] = useState(false);
  // QR prefix autocomplete
  const [prefixPopoverOpen, setPrefixPopoverOpen] = useState(false);
  // Category & Size inline view switcher
  const [pageView, setPageView] = useState<'form' | 'category' | 'size'>('form');
  const [categorySearch, setCategorySearch] = useState('');
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [sizeSearch, setSizeSearch] = useState('');
  const [creatingSize, setCreatingSize] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm<AddStockLotFormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- z.coerce makes input≠output types; cast needed
    resolver: zodResolver(addStockLotSchema) as any,
    defaultValues: {
      prefix_id: '',
      category_id: '',
      size_id: '',
      free_text_size: '',
      vendor_name: '',
      date_of_stock_arrival: new Date().toISOString().split('T')[0],
      cost_price_per_unit: '' as unknown as number,
      selling_price_default: '' as unknown as number,
      tax_rate: '',
      quantity: '' as unknown as number,
      sale_type: '',
      min_margin_percent: '',
      sale_reason: '',
    },
  });

  // Subscribe to ALL form values so preview always reflects latest state
  const allValues = watch();
  const watchedPrefixId = allValues.prefix_id;
  const watchedQuantity = allValues.quantity;
  const watchedCostPrice = allValues.cost_price_per_unit;
  const watchedSellingPrice = allValues.selling_price_default;
  const watchedSaleType = allValues.sale_type;

  // Today's date string for max constraint on arrival date
  const todayStr = new Date().toISOString().split('T')[0];

  // Map field names to their DOM element IDs for scroll-to-error
  const fieldIdMap: Record<string, string> = {
    category_id: 'category',
    prefix_id: 'prefix',
    size_id: 'size',
    date_of_stock_arrival: 'date',
    quantity: 'quantity',
    cost_price_per_unit: 'cost_price',
    selling_price_default: 'selling_price',
    tax_rate: 'tax_rate',
    min_margin_percent: 'min_margin',
  };

  useEffect(() => {
    if (profile?.shop_id) {
      fetchCategories();
      fetchSizes();
      fetchQrPrefixes();
      fetchVendorNames();
    }
  }, [profile?.shop_id]);

  const fetchCategories = async () => {
    if (!profile?.shop_id) return;

    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('shop_id', profile.shop_id)
        .order('name');

      if (error) throw error;
      setCategories(data || []);
    } catch (error) {
      console.error('Error fetching categories:', error);
      toast.error('Failed to load categories');
    }
  };

  const fetchSizes = async () => {
    if (!profile?.shop_id) return;

    try {
      const { data, error } = await supabase
        .from('sizes')
        .select('*')
        .eq('shop_id', profile.shop_id)
        .order('sort_order');

      if (error) throw error;
      setSizes(data || []);
    } catch (error) {
      console.error('Error fetching sizes:', error);
      toast.error('Failed to load sizes');
    }
  };

  const fetchQrPrefixes = async () => {
    if (!profile?.shop_id) return;

    try {
      const data = await fetchActiveQrPrefixes(profile.shop_id);
      setQrPrefixes(data || []);
      if (data && data.length > 0) {
        setValue('prefix_id', data[0].id);
        updateAvailableQrCount(data[0].id);
      }
    } catch (error) {
      console.error('Error fetching QR prefixes:', error);
      toast.error('Failed to load QR prefixes');
    }
  };

  const updateAvailableQrCount = async (prefixId: string) => {
    if (!profile?.shop_id || !prefixId) return;

    try {
      const count = await getUnusedQrCodeCount(profile.shop_id, prefixId);
      setAvailableQrCount(count);
    } catch (error) {
      console.error('Error fetching QR count:', error);
    }
  };

  const fetchVendorNames = async () => {
    if (!profile?.shop_id) return;
    try {
      const { data, error } = await supabase
        .from('lots')
        .select('vendor_name')
        .eq('shop_id', profile.shop_id)
        .not('vendor_name', 'is', null)
        .not('vendor_name', 'eq', '')
        .order('vendor_name');
      if (error) throw error;
      const unique = [...new Set((data || []).map(d => d.vendor_name).filter(Boolean))] as string[];
      setVendorNames(unique);
    } catch (error) {
      console.error('Error fetching vendor names:', error);
    }
  };

  const handlePrefixChange = (prefixId: string) => {
    setValue('prefix_id', prefixId);
    updateAvailableQrCount(prefixId);
  };

  const handleCreateCategory = async () => {
    const name = categorySearch.trim();
    if (!name || !profile?.shop_id) return;
    const existing = categories.find(c => c.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      setValue('category_id', existing.id);
      setCategorySearch('');
      setPageView('form');
      return;
    }
    setCreatingCategory(true);
    try {
      const { data, error } = await supabase
        .from('categories')
        .insert({ name, shop_id: profile.shop_id })
        .select('*')
        .single();
      if (error) throw error;
      setCategories(prev => [...prev, data]);
      setValue('category_id', data.id);
      setCategorySearch('');
      setPageView('form');
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
    const existing = sizes.find(sz => sz.size_name.toLowerCase() === name.toLowerCase());
    if (existing) {
      setValue('size_id', existing.id);
      setSizeSearch('');
      setPageView('form');
      return;
    }
    setCreatingSize(true);
    try {
      const { data, error } = await supabase
        .from('sizes')
        .insert({ size_name: name, shop_id: profile.shop_id })
        .select('*')
        .single();
      if (error) throw error;
      setSizes(prev => [...prev, data]);
      setValue('size_id', data.id);
      setSizeSearch('');
      setPageView('form');
      toast.success(`Size "${data.size_name}" created`);
    } catch (error: any) {
      toast.error(error.message?.includes('duplicate') ? 'Size already exists' : 'Failed to create size');
    } finally {
      setCreatingSize(false);
    }
  };

  const onSubmit = async (data: AddStockLotFormValues) => {
    const quantityNum = data.quantity;
    if (quantityNum > availableQrCount) {
      const selectedPrefix = qrPrefixes.find(p => p.id === data.prefix_id);
      toast.error(
        `Insufficient QR codes. You need ${quantityNum} but only ${availableQrCount} unused codes available for prefix ${selectedPrefix?.prefix}.`,
        { duration: 5000 }
      );
      return;
    }

    try {
      setSubmitting(true);

      const requestPayload = {
        prefix_id: data.prefix_id,
        category_id: data.category_id,
        size_id: data.size_id || undefined,
        free_text_size: data.free_text_size || undefined,
        vendor_name: data.vendor_name || undefined,
        date_of_stock_arrival: data.date_of_stock_arrival,
        cost_price_per_unit: data.cost_price_per_unit,
        selling_price_default: data.selling_price_default,
        tax_rate: typeof data.tax_rate === 'number' ? data.tax_rate : undefined,
        quantity: data.quantity,
        sale_type: data.sale_type || undefined,
        min_margin_percent: typeof data.min_margin_percent === 'number' ? data.min_margin_percent : undefined,
        sale_reason: data.sale_reason || undefined,
      };

      const result = await addStockLot(requestPayload);

      const categoryName = categories.find(c => c.id === data.category_id)?.name || 'items';
      const prefixLabel = qrPrefixes.find(p => p.id === data.prefix_id)?.prefix || '';

      toast.success(`Successfully added ${result.items.length} ${categoryName} to inventory`, {
        description: `QR prefix assigned: ${prefixLabel}`,
        duration: 4000
      });
      router.push('/admin/inventory');
    } catch (error: any) {
      console.error('Error adding stock lot:', error);

      if (error.code === 'INSUFFICIENT_QR_CODES') {
        toast.error(error.error || 'Not enough unused QR codes. Please add more QR codes first.');
      } else {
        toast.error(error.error || 'Failed to add stock lot');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const costNum = Number(watchedCostPrice);
  const profitMargin = watchedSellingPrice && watchedCostPrice && costNum !== 0
    ? (((Number(watchedSellingPrice) - costNum) / costNum) * 100).toFixed(2)
    : '0';

  return (
    <div className="space-y-4 md:space-y-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/admin/inventory" className="relative group shrink-0">
          <div className={`p-2.5 rounded-lg ${s.headerIconGradient} text-white shadow-md group-hover:shadow-lg transition-shadow`}>
            <Package className="h-6 w-6" />
          </div>
          <div className="absolute -left-1.5 -top-1.5 bg-background border rounded-full p-1 shadow-sm group-hover:scale-110 transition-transform">
            <ArrowLeft className="h-3 w-3 text-muted-foreground" />
          </div>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Add Stock Lot</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Add a new batch of inventory items</p>
        </div>
      </div>

      <Card>
        {/* <CardHeader>
          <CardTitle className="text-lg">Lot Details</CardTitle>
          <CardDescription className="text-sm">Fill in the details for the new stock lot</CardDescription>
        </CardHeader> */}
        <CardContent>
          {/* Category Picker View */}
          {pageView === 'category' && (
            <div className="space-y-4 pt-2">
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => { setPageView('form'); setCategorySearch(''); }}
                >
                  <ChevronLeft className="h-5 w-5" />
                </Button>
                <p className="text-sm font-medium">Select Category</p>
              </div>
              <Command className="border rounded-lg">
                <CommandInput
                  placeholder="Search or type new..."
                  value={categorySearch}
                  onValueChange={setCategorySearch}
                  autoFocus
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
                    {categories.map((cat) => (
                      <CommandItem
                        key={cat.id}
                        value={cat.name}
                        onSelect={() => { setValue('category_id', cat.id); setPageView('form'); setCategorySearch(''); }}
                      >
                        <Check className={`mr-2 h-4 w-4 ${allValues.category_id === cat.id ? 'opacity-100' : 'opacity-0'}`} />
                        {cat.name}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </div>
          )}

          {/* Size Picker View */}
          {pageView === 'size' && (
            <div className="space-y-4 pt-2">
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => { setPageView('form'); setSizeSearch(''); }}
                >
                  <ChevronLeft className="h-5 w-5" />
                </Button>
                <p className="text-sm font-medium">Select Size</p>
              </div>
              <Command className="border rounded-lg">
                <CommandInput
                  placeholder="Search or type new..."
                  value={sizeSearch}
                  onValueChange={setSizeSearch}
                  autoFocus
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
                    {sizes.map((size) => (
                      <CommandItem
                        key={size.id}
                        value={size.size_name}
                        onSelect={() => { setValue('size_id', size.id); setPageView('form'); setSizeSearch(''); }}
                      >
                        <Check className={`mr-2 h-4 w-4 ${allValues.size_id === size.id ? 'opacity-100' : 'opacity-0'}`} />
                        {size.size_name}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </div>
          )}

          {pageView === 'form' && (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Category - autocomplete with inline create */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="category" className="text-sm">Category *</Label>
                <Link href="/settings?tab=categories" className="text-xs text-muted-foreground hover:text-foreground hover:underline flex items-center gap-1">
                  <Settings2 className="h-3 w-3" /> Manage
                </Link>
              </div>
              <Controller
                name="category_id"
                control={control}
                render={({ field }) => (
                  <Button
                    id="category"
                    type="button"
                    variant="outline"
                    onClick={() => setPageView('category')}
                    className={`w-full justify-between font-normal text-sm ${errors.category_id ? 'border-red-500' : ''}`}
                  >
                    {field.value ? (
                      <span>{categories.find(c => c.id === field.value)?.name || 'Select category'}</span>
                    ) : (
                      <span className="text-muted-foreground">Select category</span>
                    )}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                )}
              />
              {errors.category_id && <p className="text-xs text-red-500">{errors.category_id.message}</p>}
            </div>

            {/* QR Prefix — autocomplete combobox */}
            <div className="space-y-2">
              <div className="flex flex-row gap-3 items-center">
                <Label htmlFor="prefix" className="text-sm">QR Prefix *</Label>
                <Link href="/settings?tab=qr-prefixes" className="text-xs text-muted-foreground hover:text-foreground hover:underline transition-colors">
                  Can&apos;t see your QR prefix?
                </Link>
              </div>
              {qrPrefixes.length === 0 ? (
                <div className="text-sm text-muted-foreground border border-dashed rounded-md p-3">
                  No active QR prefixes found. <Link href="/settings?tab=qr-prefixes" className={`${s.linkColor} hover:underline`}>Create one in Settings</Link>
                </div>
              ) : (
                <>
                  <Controller
                    name="prefix_id"
                    control={control}
                    render={({ field }) => (
                      <Popover open={prefixPopoverOpen} onOpenChange={setPrefixPopoverOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={prefixPopoverOpen}
                            className={`w-full justify-between font-normal text-sm ${errors.prefix_id ? 'border-red-500' : ''}`}
                          >
                            {field.value ? (
                              <span>
                                <span className="font-mono font-bold">
                                  {qrPrefixes.find(p => p.id === field.value)?.prefix}
                                </span>
                                {qrPrefixes.find(p => p.id === field.value)?.description && (
                                  <span className="ml-2 text-muted-foreground text-xs">
                                    ({qrPrefixes.find(p => p.id === field.value)?.description})
                                  </span>
                                )}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">Select QR prefix...</span>
                            )}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                          <Command>
                            <CommandInput placeholder="Search prefixes..." />
                            <CommandList>
                              <CommandEmpty>No prefix found.</CommandEmpty>
                              <CommandGroup>
                                {qrPrefixes.map((prefix) => (
                                  <CommandItem
                                    key={prefix.id}
                                    value={`${prefix.prefix} ${prefix.description || ''}`}
                                    onSelect={() => {
                                      handlePrefixChange(prefix.id);
                                      setPrefixPopoverOpen(false);
                                    }}
                                  >
                                    <Check className={`mr-2 h-4 w-4 ${field.value === prefix.id ? 'opacity-100' : 'opacity-0'}`} />
                                    <span className="font-mono font-bold">{prefix.prefix}</span>
                                    {prefix.description && (
                                      <span className="ml-2 text-muted-foreground text-xs">
                                        ({prefix.description})
                                      </span>
                                    )}
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    )}
                  />
                  {errors.prefix_id && <p className="text-xs text-red-500">{errors.prefix_id.message}</p>}
                  <div className="flex items-center gap-2 text-xs">
                    <span className={availableQrCount >= (Number(watchedQuantity) || 0) ? 'text-green-600' : 'text-orange-600'}>
                      {availableQrCount} unused QR codes available
                    </span>
                    {availableQrCount < (Number(watchedQuantity) || 0) && (
                      <span className="text-orange-600">
                        • <Link href="/admin/qr-codes" className="hover:underline">Generate more</Link>
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Ensure selling price aligns with prefix for consistency (e.g., WA-499 for ₹499 items)
                  </p>
                </>
              )}
            </div>

            {/* Size and Custom Size in one row on desktop */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="size" className="text-sm">Size *</Label>
                  <Link href="/settings?tab=sizes" className="text-xs text-muted-foreground hover:text-foreground hover:underline flex items-center gap-1">
                    <Settings2 className="h-3 w-3" /> Manage
                  </Link>
                </div>
                <Controller
                  name="size_id"
                  control={control}
                  render={({ field }) => (
                    <Button
                      id="size"
                      type="button"
                      variant="outline"
                      onClick={() => setPageView('size')}
                      className={`w-full justify-between font-normal text-sm ${errors.size_id ? 'border-red-500' : ''}`}
                    >
                      {field.value ? (
                        <span>{sizes.find(sz => sz.id === field.value)?.size_name || 'Select size'}</span>
                      ) : (
                        <span className="text-muted-foreground">Select size</span>
                      )}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  )}
                />
                {errors.size_id && <p className="text-xs text-red-500">{errors.size_id.message}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="free_text_size" className="text-sm">Custom Size</Label>
                <Input
                  id="free_text_size"
                  {...register('free_text_size')}
                  placeholder="e.g., XL, 32"
                  className="text-sm"
                />
              </div>
            </div>

            {/* Vendor Name — autocomplete combobox */}
            <div className="space-y-2">
              <Label htmlFor="vendor_name" className="text-sm">Vendor Name</Label>
              <Controller
                name="vendor_name"
                control={control}
                render={({ field }) => (
                  <Popover open={vendorPopoverOpen} onOpenChange={setVendorPopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={vendorPopoverOpen}
                        className="w-full justify-between font-normal text-sm"
                      >
                        {field.value ? (
                          <span>{field.value}</span>
                        ) : (
                          <span className="text-muted-foreground">e.g., ABC Suppliers</span>
                        )}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                      <Command>
                        <CommandInput
                          placeholder="Search or type new vendor..."
                          onValueChange={(v) => field.onChange(v)}
                        />
                        <CommandList>
                          <CommandEmpty>
                            {field.value ? (
                              <button
                                type="button"
                                className="w-full px-2 py-1.5 text-sm text-left hover:bg-accent rounded"
                                onClick={() => setVendorPopoverOpen(false)}
                              >
                                Use &quot;{field.value}&quot;
                              </button>
                            ) : (
                              <span className="text-muted-foreground text-xs">Type to add new vendor</span>
                            )}
                          </CommandEmpty>
                          <CommandGroup heading="Existing Vendors">
                            {vendorNames.map((name) => (
                              <CommandItem
                                key={name}
                                value={name}
                                onSelect={(v) => {
                                  field.onChange(v);
                                  setVendorPopoverOpen(false);
                                }}
                              >
                                <Check className={`mr-2 h-4 w-4 ${field.value === name ? 'opacity-100' : 'opacity-0'}`} />
                                {name}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                )}
              />
            </div>

            {/* Date and Quantity */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="date" className="text-sm">Stock Arrival Date *</Label>
                <Input
                  id="date"
                  type="date"
                  max={todayStr}
                  {...register('date_of_stock_arrival')}
                  className={`text-sm ${errors.date_of_stock_arrival ? 'border-red-500' : ''}`}
                />
                {errors.date_of_stock_arrival && <p className="text-xs text-red-500">{errors.date_of_stock_arrival.message}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="quantity" className="text-sm">Quantity * {availableQrCount > 0 && <span className="text-xs font-normal text-muted-foreground">(max {availableQrCount})</span>}</Label>
                <Input
                  id="quantity"
                  type="number"
                  min="1"
                  max={availableQrCount > 0 ? availableQrCount : undefined}
                  {...register('quantity')}
                  className={`text-sm ${errors.quantity ? 'border-red-500' : ''}`}
                />
                {errors.quantity && <p className="text-xs text-red-500">{errors.quantity.message}</p>}
                {availableQrCount > 0 && Number(watchedQuantity) > availableQrCount && (
                  <p className="text-xs text-orange-600 flex items-center gap-1">
                    ⚠ Only {availableQrCount} QR codes available.
                    <Link href="/admin/qr-codes" className="underline">Generate more</Link>
                  </p>
                )}
              </div>
            </div>

            {/* Pricing */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cost_price" className="text-sm">Cost Price (per unit) *</Label>
                <Input
                  id="cost_price"
                  type="number"
                  step="0.01"
                  {...register('cost_price_per_unit')}
                  className={`text-sm ${errors.cost_price_per_unit ? 'border-red-500' : ''}`}
                />
                {errors.cost_price_per_unit && <p className="text-xs text-red-500">{errors.cost_price_per_unit.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="selling_price" className="text-sm">Selling Price *</Label>
                <Input
                  id="selling_price"
                  type="number"
                  step="0.01"
                  {...register('selling_price_default')}
                  className={`text-sm ${errors.selling_price_default ? 'border-red-500' : ''}`}
                />
                {errors.selling_price_default && <p className="text-xs text-red-500">{errors.selling_price_default.message}</p>}
              </div>
            </div>

            {/* Tax Rate and Profit Margin */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="tax_rate" className="text-sm">Tax Rate (GST %)</Label>
                <Input
                  id="tax_rate"
                  type="number"
                  step="0.01"
                  {...register('tax_rate')}
                  className={`text-sm ${errors.tax_rate ? 'border-red-500' : ''}`}
                />
                {errors.tax_rate && <p className="text-xs text-red-500">{errors.tax_rate.message}</p>}
              </div>
              <div className="space-y-2">
                <Label className="text-sm">Profit Margin</Label>
                <div className={`h-9 px-3 py-2 rounded-md border bg-muted text-sm font-medium ${s.linkColor}`}>
                  {profitMargin}%
                </div>
              </div>
            </div>

            {/* Sale Configuration */}
            <div className="space-y-3 pt-2 border-t">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Sale Configuration (Optional)</Label>
                <p className="text-xs text-muted-foreground">Mark this lot for pre-planned sales (Festival/Promotion). Clearance is marked later at POS.</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => { setValue('sale_type', ''); setValue('min_margin_percent', ''); setValue('sale_reason', ''); }}
                    className={`px-4 py-2 text-sm rounded-md border transition-all ${!watchedSaleType
                      ? `${a.bg} ${a.borderStrong} ${a.text} font-medium`
                      : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                      }`}
                  >
                    Not on Sale
                  </button>
                  <button
                    type="button"
                    onClick={() => setValue('sale_type', 'festival')}
                    className={`px-4 py-2 text-sm rounded-md border transition-all ${watchedSaleType === 'festival'
                      ? 'bg-green-50 border-green-500 text-green-700 font-medium'
                      : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                      }`}
                  >
                    Festival Sale
                  </button>
                  <button
                    type="button"
                    onClick={() => setValue('sale_type', 'promotion')}
                    className={`px-4 py-2 text-sm rounded-md border transition-all ${watchedSaleType === 'promotion'
                      ? 'bg-blue-50 border-blue-500 text-blue-700 font-medium'
                      : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                      }`}
                  >
                    Promotional Sale
                  </button>
                </div>
              </div>

              {/* Show margin and reason fields if festival or promotion selected */}
              {(watchedSaleType === 'festival' || watchedSaleType === 'promotion') && (
                <div className={`grid grid-cols-1 sm:grid-cols-2 gap-4 pl-4 border-l-2 ${a.border}`}>
                  <div className="space-y-2">
                    <Label htmlFor="min_margin" className="text-sm">
                      Min Margin % {watchedSaleType === 'festival' && '(Recommended)'}
                    </Label>
                    <Input
                      id="min_margin"
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      {...register('min_margin_percent')}
                      placeholder="15"
                      className={`text-sm ${errors.min_margin_percent ? 'border-red-500' : ''}`}
                    />
                    {errors.min_margin_percent && <p className="text-xs text-red-500">{errors.min_margin_percent.message}</p>}
                    <p className="text-xs text-muted-foreground">
                      {watchedSaleType === 'festival'
                        ? 'Prevents selling below this margin at POS'
                        : 'Optional protection for promotional items'}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sale_reason" className="text-sm">Sale Reason</Label>
                    <Input
                      id="sale_reason"
                      {...register('sale_reason')}
                      placeholder="e.g., Diwali Festival 2026"
                      className="text-sm"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Preview / Submit */}
            {!showPreview ? (
              <div className="space-y-2 pt-4">
                {Object.keys(errors).length > 0 && (
                  <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-md px-3 py-2">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>
                      Please fix {Object.keys(errors).length} {Object.keys(errors).length === 1 ? 'error' : 'errors'} above before previewing
                    </span>
                  </div>
                )}
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button
                    type="button"
                    onClick={handleSubmit(
                      () => setShowPreview(true),
                      (fieldErrors) => {
                        const errorCount = Object.keys(fieldErrors).length;
                        toast.error(
                          `Please fix ${errorCount} ${errorCount === 1 ? 'error' : 'errors'} before previewing`,
                          { description: 'Required fields are highlighted in red' }
                        );
                        // Scroll to first error field (use ID map for Controller fields)
                        const firstErrorKey = Object.keys(fieldErrors)[0];
                        const domId = fieldIdMap[firstErrorKey] || firstErrorKey;
                        const el = document.getElementById(domId) ||
                                   document.querySelector(`[name="${firstErrorKey}"]`);
                        if (el) {
                          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                          if (el instanceof HTMLElement) el.focus();
                        }
                      }
                    )}
                    disabled={submitting}
                    className={`flex-1 ${s.primaryGradient} ${s.primaryGradientHover} transition-all ${s.btnAnimation}`}
                  >
                    <Eye className="mr-2 h-4 w-4" />
                    Preview &amp; Add
                  </Button>
                  <Button type="button" variant="outline" asChild className={`sm:w-auto transition-all ${s.btnAnimation}`}>
                    <Link href="/admin/inventory">Cancel</Link>
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4 pt-4">
                <Separator />
                <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <Eye className="h-4 w-4" /> Lot Preview
                    <span className="ml-auto flex items-center gap-1 text-[10px] font-normal text-muted-foreground">
                      <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                      Live
                    </span>
                  </h3>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                    <span className="text-muted-foreground">QR Prefix</span>
                    <span className="font-mono font-bold">{qrPrefixes.find(p => p.id === allValues.prefix_id)?.prefix || '—'}</span>

                    <span className="text-muted-foreground">Category</span>
                    <span>{categories.find(c => c.id === allValues.category_id)?.name || '—'}</span>

                    <span className="text-muted-foreground">Size</span>
                    <span>{allValues.free_text_size || sizes.find(sz => sz.id === allValues.size_id)?.size_name || '—'}</span>

                    <span className="text-muted-foreground">Vendor</span>
                    <span>{allValues.vendor_name || '—'}</span>

                    <span className="text-muted-foreground">Arrival Date</span>
                    <span>{allValues.date_of_stock_arrival || '—'}</span>

                    <span className="text-muted-foreground">Quantity</span>
                    <span className="font-semibold">{allValues.quantity || '—'}</span>

                    <span className="text-muted-foreground">Cost Price</span>
                    <span>{formatCurrency(Number(allValues.cost_price_per_unit) || 0)}</span>

                    <span className="text-muted-foreground">Selling Price</span>
                    <span className="font-semibold">{formatCurrency(Number(allValues.selling_price_default) || 0)}</span>

                    <span className="text-muted-foreground">Tax Rate</span>
                    <span>{allValues.tax_rate || 0}%</span>

                    {allValues.sale_type && (
                      <>
                        <span className="text-muted-foreground">Sale Type</span>
                        <span><Badge variant="secondary" className="text-xs">{allValues.sale_type}</Badge></span>

                        {allValues.min_margin_percent && (
                          <>
                            <span className="text-muted-foreground">Min Margin</span>
                            <span>{allValues.min_margin_percent}%</span>
                          </>
                        )}
                        {allValues.sale_reason && (
                          <>
                            <span className="text-muted-foreground">Sale Reason</span>
                            <span>{allValues.sale_reason}</span>
                          </>
                        )}
                      </>
                    )}

                    <span className="text-muted-foreground">Profit Margin</span>
                    <span className={`font-semibold ${Number(allValues.selling_price_default) > Number(allValues.cost_price_per_unit) ? 'text-green-600' : 'text-red-600'
                      }`}>
                      {Number(allValues.cost_price_per_unit) > 0
                        ? `${(((Number(allValues.selling_price_default) - Number(allValues.cost_price_per_unit)) / Number(allValues.cost_price_per_unit)) * 100).toFixed(1)}%`
                        : '—'}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button
                    type="submit"
                    disabled={submitting}
                    className={`flex-1 ${s.primaryGradient} ${s.primaryGradientHover} transition-all ${s.btnAnimation}`}
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Adding Lot...
                      </>
                    ) : (
                      <>
                        <Package className="mr-2 h-4 w-4" />
                        Confirm &amp; Add Lot
                      </>
                    )}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setShowPreview(false)} className={`sm:w-auto transition-all ${s.btnAnimation}`}>
                    <ChevronLeft className="mr-1 h-4 w-4" />
                    Back to Edit
                  </Button>
                </div>
              </div>
            )}
          </form>
          )}
        </CardContent>
      </Card>

      {/* Help Accordion */}
      <Accordion type="single" collapsible className="border rounded-lg">
        <AccordionItem value="help" className="border-none">
          <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/50 transition-colors">
            <div className="flex items-center gap-2 text-sm font-medium">
              <HelpCircle className={`h-4 w-4 ${s.linkColor}`} />
              How it works
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4">
            <div className="text-sm text-muted-foreground space-y-2">
              <p>• Select a QR prefix to organize your inventory (e.g., WA-499 for ₹499 items)</p>
              <p>• Fill in the lot details including category, size, pricing, and quantity</p>
              <p>• The system will automatically assign unused QR codes from the selected prefix</p>
              <p>• All items will be marked as "available" and ready for sale</p>
              <p>• If there aren't enough QR codes for the selected prefix, generate more first</p>
              <p>• Profit margin is calculated automatically based on cost and selling price</p>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
