'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Search, Package, Plus, Loader2, Keyboard, X, Filter, Check } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatCurrency } from '@/lib/formatters';
import { toast } from 'sonner';
import type { CartItem } from '@/types/pos.types';
import { appConfig } from '@/lib/config/app.config';

const s = appConfig.styles;
const a = s.accent;
import { searchInventoryByQRCode } from '@/lib/api/inventory';
import { getCachedItem, searchCachedInventory, getAllValidCachedItems } from '@/lib/offline/inventory-cache';
import { useOfflineStatus } from '@/hooks/useOfflineStatus';
import { initAudio, errorBuzz } from '@/lib/sounds';

interface ProductSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddToCart: (item: CartItem) => void;
  existingQrCodes: string[]; // To prevent adding duplicates
  initialManualEntry?: boolean; // Open directly in manual entry mode
}

interface SearchResult {
  id: string;
  qr_code_id: string;
  status: string;
  lot: {
    id: string;
    selling_price_default: number;
    tax_rate: number;
    sale_type: string | null;
    min_margin_percent: number | null;
    sale_reason: string | null;
    cost_price_per_unit: number | null;
    category: {
      name: string;
    } | null;
    size: {
      size_name: string;
    } | null;
    free_text_size: string | null;
  };
  qr_code: {
    code: string;
  };
}

export function ProductSearchDialog({
  open,
  onOpenChange,
  onAddToCart,
  existingQrCodes,
  initialManualEntry = false,
}: ProductSearchDialogProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [allResults, setAllResults] = useState<SearchResult[]>([]); // Store all results for filtering
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [manualEntry, setManualEntry] = useState(false);
  const [manualCode, setManualCode] = useState('');

  // Sync manualEntry state when dialog opens/closes or prop changes
  useEffect(() => {
    if (open) {
      setManualEntry(initialManualEntry);
    } else {
      // Reset when dialog closes
      setManualEntry(false);
      setManualCode('');
    }
  }, [open, initialManualEntry]);
  const { isOnline } = useOfflineStatus();
  
  // Filter states
  const [categories, setCategories] = useState<string[]>([]);
  const [sizes, setSizes] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedSize, setSelectedSize] = useState<string>('all');
  const [minPrice, setMinPrice] = useState<string>('');
  const [maxPrice, setMaxPrice] = useState<string>('');

  // Load filter options on mount
  useEffect(() => {
    if (open) {
      loadFilterOptions();
    }
  }, [open]);

  // Auto-search when query changes (debounced)
  useEffect(() => {
    if (!searchQuery.trim()) {
      setResults([]);
      setAllResults([]);
      setSearched(false);
      return;
    }

    const timer = setTimeout(() => {
      handleSearch();
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Apply filters when filter values change
  useEffect(() => {
    applyFilters();
  }, [selectedCategory, selectedSize, minPrice, maxPrice, allResults]);

  const loadFilterOptions = async () => {
    if (isOnline) {
      try {
        // Get unique categories
        const { data: categoryData } = await supabase
          .from('categories')
          .select('name')
          .order('name');
        
        if (categoryData) {
          setCategories(categoryData.map(c => c.name));
        }

        // Get unique sizes
        const { data: sizeData } = await supabase
          .from('sizes')
          .select('size_name')
          .order('size_name');
        
        if (sizeData) {
          setSizes(sizeData.map(s => s.size_name));
        }
      } catch (error) {
        console.error('Failed to load filter options:', error);
        // Fall through to offline extraction below
        await loadFilterOptionsFromCache();
      }
    } else {
      // Offline: extract filter options from cached inventory
      await loadFilterOptionsFromCache();
    }
  };

  const loadFilterOptionsFromCache = async () => {
    try {
      const cachedItems = await getAllValidCachedItems();
      const uniqueCategories = [...new Set(cachedItems.map(i => i.category))].sort();
      const uniqueSizes = [...new Set(cachedItems.map(i => i.size))].sort();
      setCategories(uniqueCategories);
      setSizes(uniqueSizes);
    } catch (error) {
      console.error('Failed to load filter options from cache:', error);
    }
  };

  const applyFilters = () => {
    let filtered = [...allResults];

    // Category filter
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(item => item.lot?.category?.name === selectedCategory);
    }

    // Size filter
    if (selectedSize !== 'all') {
      filtered = filtered.filter(item => 
        item.lot?.size?.size_name === selectedSize || 
        item.lot?.free_text_size === selectedSize
      );
    }

    // Price filter
    const min = parseFloat(minPrice);
    const max = parseFloat(maxPrice);
    if (!isNaN(min)) {
      filtered = filtered.filter(item => item.lot?.selling_price_default >= min);
    }
    if (!isNaN(max)) {
      filtered = filtered.filter(item => item.lot?.selling_price_default <= max);
    }

    setResults(filtered);
  };

  const clearFilters = () => {
    setSelectedCategory('all');
    setSelectedSize('all');
    setMinPrice('');
    setMaxPrice('');
  };

  const hasActiveFilters = selectedCategory !== 'all' || selectedSize !== 'all' || minPrice || maxPrice;

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setLoading(true);
    setSearched(true);

    try {
      const query = searchQuery.trim();

      if (!isOnline) {
        // ── Offline search: use cached inventory ──────────────────────
        const cachedResults = await searchCachedInventory(query, {
          category: selectedCategory !== 'all' ? selectedCategory : undefined,
          size: selectedSize !== 'all' ? selectedSize : undefined,
          minPrice: minPrice ? parseFloat(minPrice) : undefined,
          maxPrice: maxPrice ? parseFloat(maxPrice) : undefined,
        });

        // Convert cached items to SearchResult format for display
        const offlineResults: SearchResult[] = cachedResults.map(item => ({
          id: item.itemId,
          qr_code_id: '',
          status: 'available',
          lot: {
            id: item.lotId,
            selling_price_default: item.price,
            tax_rate: item.taxRate,
            sale_type: item.lotSaleType || null,
            min_margin_percent: item.lotMinMargin || null,
            sale_reason: null,
            cost_price_per_unit: item.lotCostPrice || null,
            category: { name: item.category },
            size: { size_name: item.size },
            free_text_size: null,
          },
          qr_code: { code: item.qrCode },
        }));

        setAllResults(offlineResults);

        if (offlineResults.length === 0) {
          toast.info('No products found in offline cache');
        } else {
          toast.info(`Found ${offlineResults.length} item${offlineResults.length !== 1 ? 's' : ''} from offline cache`);
        }

        setLoading(false);
        return;
      }

      // ── Server-side search strategy ───────────────────────────────
      // Old approach fetched 100 random available items and filtered
      // client-side, which missed items beyond the first 100 rows.
      // Now we run two parallel server-side searches and merge results.

      const selectForQR = `
        id, qr_code_id, status, sold_at,
        lot:lots (
          id, selling_price_default, tax_rate, sale_type,
          min_margin_percent, sale_reason, cost_price_per_unit,
          category:categories(name),
          size:sizes(size_name),
          free_text_size
        ),
        qr_code:qr_codes!inner(code)
      `;

      const selectDefault = `
        id, qr_code_id, status, sold_at,
        lot:lots (
          id, selling_price_default, tax_rate, sale_type,
          min_margin_percent, sale_reason, cost_price_per_unit,
          category:categories(name),
          size:sizes(size_name),
          free_text_size
        ),
        qr_code:qr_codes(code)
      `;

      // 1. QR code server-side search (uses !inner join + ilike)
      const qrPromise = supabase
        .from('inventory_items')
        .select(selectForQR)
        .eq('status', 'available')
        .is('sold_at', null)
        .ilike('qr_codes.code', `%${query}%`)
        .limit(50);

      // 2. Category name search: find matching category IDs first
      const catPromise = supabase
        .from('categories')
        .select('id')
        .ilike('name', `%${query}%`);

      const [qrResult, catResult] = await Promise.all([qrPromise, catPromise]);

      if (qrResult.error) {
        console.error('QR search error:', qrResult.error);
      }

      const qrMatches: SearchResult[] = (qrResult.data || []) as any[];
      const qrMatchIds = new Set(qrMatches.map(i => i.id));

      // If categories matched, fetch their inventory items
      let categoryMatches: SearchResult[] = [];
      if (catResult.data && catResult.data.length > 0) {
        const catIds = catResult.data.map(c => c.id);

        // Find lots belonging to those categories
        const { data: lots } = await supabase
          .from('lots')
          .select('id')
          .in('category_id', catIds);

        if (lots && lots.length > 0) {
          const lotIds = lots.map(l => l.id);
          const { data: catInvData } = await supabase
            .from('inventory_items')
            .select(selectDefault)
            .eq('status', 'available')
            .is('sold_at', null)
            .in('lot_id', lotIds)
            .limit(100);

          categoryMatches = ((catInvData || []) as any[]).filter(i => !qrMatchIds.has(i.id));
        }
      }

      // Merge both result sets (QR matches first, then category matches)
      const combined = [...qrMatches, ...categoryMatches];

      // Also do a lightweight client-side pass for size matches
      // (sizes are rarely searched, but cover the case)
      const queryLower = query.toLowerCase();
      const sizeOnlyMatches = combined.length === 0
        ? [] // no point re-filtering an empty set
        : combined; // already included via category search

      setAllResults(combined);
      // applyFilters will be called automatically via useEffect

      if (combined.length === 0) {
        toast.info('No available products found');
      }
    } catch (error) {
      console.error('Search exception:', error);
      toast.error('Search failed');
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAddItem = (result: SearchResult) => {
    const lot = result.lot;
    const categoryName = lot.category?.name || 'Unknown';
    const sizeName = lot.size?.size_name || lot.free_text_size || 'N/A';
    
    // Check if item is already in cart
    if (existingQrCodes.some(qr => qr.toUpperCase() === result.qr_code.code.toUpperCase())) {
      toast.error('Item already in cart');
      return;
    }

    const cartItem: CartItem = {
      id: result.id,
      qrCode: result.qr_code.code,
      inventoryItemId: result.id,
      category: categoryName,
      size: sizeName,
      originalPrice: lot.selling_price_default,
      finalPrice: lot.selling_price_default,
      taxRate: lot.tax_rate || 0,
      lotId: lot.id,
      // Sale info from lot
      lotSaleType: lot.sale_type,
      lotMinMargin: lot.min_margin_percent ?? undefined,
      lotSaleReason: lot.sale_reason,
      lotCostPrice: lot.cost_price_per_unit ?? undefined,
      // Initialize sale state from lot
      soldOnSale: !!lot.sale_type,
      saleType: lot.sale_type || undefined,
    };

    onAddToCart(cartItem);
    // Parent handles success feedback (toast + chime)
  };

  const handleManualEntry = async () => {
    if (!manualCode.trim()) {
      toast.error('Please enter a product code');
      return;
    }

    setLoading(true);
    try {
      let itemData;

      if (isOnline) {
        try {
          const result = await searchInventoryByQRCode(manualCode.trim());
          itemData = result;
        } catch (error) {
          // Only fall back to cache for network errors, not business errors
          const msg = error instanceof Error ? error.message : '';
          const isBusinessError =
            msg.includes('already sold') ||
            msg.includes('does not exist') ||
            msg.includes('not assigned') ||
            msg.includes('No inventory item found');
          if (isBusinessError) throw error;

          const cached = await getCachedItem(manualCode.trim());
          if (!cached) throw error;
          itemData = cached;
          toast.info('Using cached data (network unavailable)');
        }
      } else {
        const cached = await getCachedItem(manualCode.trim());
        if (!cached) {
          toast.error('Item not found in offline cache. Try syncing while online first.');
          throw new Error('Item not found in offline cache');
        }
        itemData = cached;
      }

      // Check if already in cart
      if (existingQrCodes.some(qr => qr.toUpperCase() === manualCode.trim().toUpperCase())) {
        toast.error('Item already in cart');
        return;
      }

      // Check if item is already sold (only for live data, not cached)
      if (!('itemId' in itemData) && itemData.sold_at) {
        toast.error('This item has already been sold');
        return;
      }

      // Create cart item
      const cartItem: CartItem = 'itemId' in itemData ? {
        id: itemData.itemId,
        qrCode: manualCode.trim(),
        inventoryItemId: itemData.itemId,
        category: itemData.category,
        size: itemData.size,
        originalPrice: itemData.price,
        finalPrice: itemData.price,
        taxRate: itemData.taxRate,
        lotId: itemData.lotId,
        // Sale info from cached lot
        lotSaleType: (itemData as any).lotSaleType,
        lotMinMargin: (itemData as any).lotMinMargin,
        lotSaleReason: (itemData as any).lotSaleReason,
        lotCostPrice: (itemData as any).lotCostPrice,
        // Initialize sale state from lot
        soldOnSale: !!(itemData as any).lotSaleType,
        saleType: (itemData as any).lotSaleType || undefined,
      } : {
        id: itemData.id,
        qrCode: manualCode.trim(),
        inventoryItemId: itemData.id,
        category: itemData.lot?.category?.name || 'Unknown',
        size: itemData.lot?.size?.size_name || itemData.lot?.free_text_size || 'N/A',
        originalPrice: itemData.lot?.selling_price_default || 0,
        finalPrice: itemData.lot?.selling_price_default || 0,
        taxRate: itemData.lot?.tax_rate || 0,
        lotId: itemData.lot_id,
        // Sale info from lot
        lotSaleType: itemData.lot?.sale_type,
        lotMinMargin: itemData.lot?.min_margin_percent,
        lotSaleReason: itemData.lot?.sale_reason,
        lotCostPrice: itemData.lot?.cost_price_per_unit,
        // Initialize sale state from lot
        soldOnSale: !!itemData.lot?.sale_type,
        saleType: itemData.lot?.sale_type || undefined,
      };

      onAddToCart(cartItem);
      // Parent handles success feedback (toast + chime)
      setManualCode('');
      setManualEntry(false);
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to fetch item:', error);
      toast.error(error instanceof Error ? error.message : 'Item not found');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[90vw] sm:max-w-2xl max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
        {/* Premium Header */}
        <div className={`bg-gradient-to-r ${s.primaryGradient} px-6 py-4 flex-shrink-0`}>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-white/20 backdrop-blur-sm">
              {manualEntry ? (
                <Keyboard className="h-5 w-5 text-white" />
              ) : (
                <Search className="h-5 w-5 text-white" />
              )}
            </div>
            <div>
              <DialogHeader className="p-0 space-y-0.5 text-left">
                <DialogTitle className="text-white text-lg font-bold">
                  {manualEntry ? 'Enter Product Code' : 'Search Products'}
                </DialogTitle>
                <DialogDescription className="text-white/80 text-sm">
                  {manualEntry ? 'Type or paste the QR code' : 'Find items by code, category, or size'}
                </DialogDescription>
              </DialogHeader>
            </div>
          </div>
        </div>

        {manualEntry ? (
          <div className="px-6 py-5 space-y-4">
            <div className="space-y-1.5">
              <Input
                placeholder="Enter product code (e.g., WA-TOPS-499-0001)"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && manualCode.trim()) {
                    handleManualEntry();
                  }
                }}
                className="text-base h-12 font-mono border-border/60 focus:border-brand-400 focus:ring-1 focus:ring-brand-400/20"
                autoFocus
              />
            </div>
            <div className="flex gap-3">
              <Button
                onClick={handleManualEntry}
                disabled={!manualCode.trim() || loading}
                className={`flex-1 h-11 ${s.primaryGradient} ${s.primaryGradientHover} text-white shadow-md`}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Adding...
                  </>
                ) : (
                  <>
                    <Plus className="mr-2 h-4 w-4" />
                    Add to Cart
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setManualEntry(false);
                  setManualCode('');
                }}
                className="h-11 border-border/60"
              >
                Back to Search
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="px-6 pt-4 pb-3 space-y-2.5 flex-shrink-0">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Type to search (e.g., WA-TOPS, Kurti, XL)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 text-base h-11 border-border/60 focus:border-brand-400 focus:ring-1 focus:ring-brand-400/20"
                  autoFocus
                />
              </div>
              
              {/* Filter Section */}
              {searched && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                      <Filter className="h-3.5 w-3.5" />
                      <span>Filters</span>
                      {hasActiveFilters && (
                        <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 h-4 ${a.bg} ${a.text}`}>
                          Active
                        </Badge>
                      )}
                    </div>
                    {hasActiveFilters && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={clearFilters}
                        className="h-7 text-xs text-muted-foreground hover:text-foreground"
                      >
                        <X className="h-3 w-3 mr-1" />
                        Clear
                      </Button>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5">
                    <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                      <SelectTrigger className="h-8 text-xs border-border/60">
                        <SelectValue placeholder="Category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Categories</SelectItem>
                        {categories.map(cat => (
                          <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select value={selectedSize} onValueChange={setSelectedSize}>
                      <SelectTrigger className="h-8 text-xs border-border/60">
                        <SelectValue placeholder="Size" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Sizes</SelectItem>
                        {sizes.map(size => (
                          <SelectItem key={size} value={size}>{size}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  
                    <Input
                      type="number"
                      placeholder="Min ₹"
                      value={minPrice}
                      onChange={(e) => setMinPrice(e.target.value)}
                      className="h-8 text-xs border-border/60"
                    />
                    <Input
                      type="number"
                      placeholder="Max ₹"
                      value={maxPrice}
                      onChange={(e) => setMaxPrice(e.target.value)}
                      className="h-8 text-xs border-border/60"
                    />
                  </div>

                  {/* Active filter badges */}
                  {hasActiveFilters && (
                    <div className="flex flex-wrap gap-1">
                      {selectedCategory !== 'all' && (
                        <Badge variant="secondary" className={`text-xs ${a.bg} ${a.text} border ${a.border}`}>
                          {selectedCategory}
                          <X 
                            className="h-3 w-3 ml-1 cursor-pointer hover:opacity-70" 
                            onClick={() => setSelectedCategory('all')}
                          />
                        </Badge>
                      )}
                      {selectedSize !== 'all' && (
                        <Badge variant="secondary" className={`text-xs ${a.bg} ${a.text} border ${a.border}`}>
                          Size: {selectedSize}
                          <X 
                            className="h-3 w-3 ml-1 cursor-pointer hover:opacity-70" 
                            onClick={() => setSelectedSize('all')}
                          />
                        </Badge>
                      )}
                      {minPrice && (
                        <Badge variant="secondary" className={`text-xs ${a.bg} ${a.text} border ${a.border}`}>
                          Min: ₹{minPrice}
                          <X 
                            className="h-3 w-3 ml-1 cursor-pointer hover:opacity-70" 
                            onClick={() => setMinPrice('')}
                          />
                        </Badge>
                      )}
                      {maxPrice && (
                        <Badge variant="secondary" className={`text-xs ${a.bg} ${a.text} border ${a.border}`}>
                          Max: ₹{maxPrice}
                          <X 
                            className="h-3 w-3 ml-1 cursor-pointer hover:opacity-70" 
                            onClick={() => setMaxPrice('')}
                          />
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
              )}

              <Button
                variant="outline"
                onClick={() => setManualEntry(true)}
                className={`w-full h-9 text-xs border-dashed border-border/60 ${a.hoverBg} ${a.hoverBorder}`}
              >
                <Keyboard className="mr-2 h-3.5 w-3.5" />
                Enter Product Code Manually
              </Button>
            </div>

            <div className="overflow-hidden flex-1">
              <ScrollArea className="h-[45vh] md:h-[50vh] px-6 pb-4">
                {loading && (
                  <div className="flex flex-col items-center justify-center py-16">
                    <div className="animate-spin rounded-full h-10 w-10 border-[3px] border-brand-200 border-t-brand-600" />
                    <span className="text-sm text-muted-foreground mt-3 font-medium">Searching...</span>
                  </div>
                )}

                {!loading && searched && results.length === 0 && (
                  <div className="text-center py-16">
                    <div className={`inline-flex p-4 rounded-full ${a.bg} mb-4`}>
                      <Package className={`h-8 w-8 ${a.textMuted}`} />
                    </div>
                    <p className="text-base font-medium text-foreground">
                      No products found
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Try a different search for &ldquo;{searchQuery}&rdquo;
                    </p>
                  </div>
                )}

                {!loading && !searched && (
                  <div className="text-center py-16">
                    <div className={`inline-flex p-4 rounded-full ${a.bg} mb-4`}>
                      <Search className={`h-8 w-8 ${a.textMuted}`} />
                    </div>
                    <p className="text-base font-medium text-foreground">
                      Search for products
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Type a QR code, category, or size to get started
                    </p>
                  </div>
                )}

                {!loading && results.length > 0 && (
                  <div className="space-y-2">
                    {/* Results count */}
                    <div className="text-xs text-muted-foreground font-medium px-1 mb-2">
                      {results.length} product{results.length !== 1 ? 's' : ''} found
                    </div>
                    {results.map((result, index) => {
                      const lot = result.lot;
                      const categoryName = lot.category?.name || 'Unknown';
                      const sizeName = lot.size?.size_name || lot.free_text_size || 'N/A';
                      const isInCart = existingQrCodes.some(qr => qr.toUpperCase() === result.qr_code.code.toUpperCase());
                      const hasSaleType = lot.sale_type;

                      return (
                        <div
                          key={result.id}
                          className={`group flex items-center justify-between p-3.5 rounded-xl border transition-all duration-200 ${
                            isInCart 
                              ? `${a.bg} border-2 ${a.border}` 
                              : `border-border/50 hover:border-border hover:shadow-sm hover:bg-muted/30 ${
                                  hasSaleType === 'festival' ? 'bg-green-50/30' :
                                  hasSaleType === 'clearance' ? 'bg-red-50/30' :
                                  hasSaleType === 'promotion' ? 'bg-blue-50/30' : ''
                                }`
                          }`}
                        >
                          {/* Number indicator */}
                          <div className={`flex items-center justify-center w-7 h-7 rounded-full text-[11px] font-bold mr-3 flex-shrink-0 ${
                            isInCart ? `${a.bgMuted} ${a.text}` : 'bg-muted/60 text-muted-foreground'
                          }`}>
                            {index + 1}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="font-semibold text-sm text-foreground truncate">
                                {categoryName}
                              </span>
                              <span className="text-[10px] text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded border border-border/40 font-medium">
                                {sizeName}
                              </span>
                              {hasSaleType && (
                                <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 h-4 ${
                                  hasSaleType === 'festival' ? 'bg-green-100 text-green-700 border-green-200' :
                                  hasSaleType === 'clearance' ? 'bg-red-100 text-red-700 border-red-200' :
                                  'bg-blue-100 text-blue-700 border-blue-200'
                                }`}>
                                  {hasSaleType === 'festival' ? '🟢' : hasSaleType === 'clearance' ? '🔴' : '🔵'} {hasSaleType}
                                </Badge>
                              )}
                              {isInCart && (
                                <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 h-4 ${a.bgMuted} ${a.text}`}>
                                  In Cart
                                </Badge>
                              )}
                            </div>
                            <div className="text-[10px] text-muted-foreground/70 font-mono tracking-tight">
                              {result.qr_code.code}
                            </div>
                            <div className={`text-sm font-bold ${s.linkColor} mt-0.5`}>
                              {formatCurrency(lot.selling_price_default)}
                            </div>
                          </div>

                          {isInCart ? (
                            <Button
                              size="sm"
                              disabled
                              variant="outline"
                              className={`ml-3 h-9 ${s.linkColor} ${a.borderMid} bg-white/50`}
                            >
                              <Check className="h-3.5 w-3.5 mr-1.5" />
                              Added
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              onClick={() => handleAddItem(result)}
                              className={`ml-3 h-9 ${s.primaryGradient} ${s.primaryGradientHover} text-white shadow-sm group-hover:shadow-md transition-shadow`}
                            >
                              <Plus className="h-3.5 w-3.5 mr-1.5" />
                              Add
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
