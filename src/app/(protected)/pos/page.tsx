'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScanQRButton } from '@/components/pos/ScanQRButton';
import { CartList } from '@/components/pos/CartList';
import { CartSummary } from '@/components/pos/CartSummary';
import { CheckoutDialog } from '@/components/pos/CheckoutDialog';
import { ProductSearchDialog } from '@/components/pos/ProductSearchDialog';
import { QuickAddItemDialog } from '@/components/pos/QuickAddItemDialog';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { BillPreviewDialog } from '@/components/shared/BillPreviewDialog';
import { EmptyState } from '@/components/shared/EmptyState';
import { Skeleton } from '@/components/ui/skeleton';
import { QrCode, Trash2, Search, ShoppingBag, ArrowLeft, Zap } from 'lucide-react';
import type { CartItem } from '@/types/pos.types';
import type { Sale } from '@/types';
import { toast } from 'sonner';
import { initAudio, successChime, errorBuzz } from '@/lib/sounds';
import { appConfig } from '@/lib/config/app.config';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';

const s = appConfig.styles;
const a = s.accent;

const CART_STORAGE_KEY = 'womaniya-pos-cart';

// Module-level flag to track if restore toast was shown
// Survives React StrictMode remounts but resets on page reload
let hasShownRestoreToastThisSession = false;

// Helper to safely load cart from localStorage
function loadCartFromStorage(): CartItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const saved = localStorage.getItem(CART_STORAGE_KEY);
    if (!saved) return [];
    const parsed = JSON.parse(saved);
    // Validate it's an array
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    // Invalid JSON or other error - clear corrupted data
    localStorage.removeItem(CART_STORAGE_KEY);
    return [];
  }
}

// Helper to save cart to localStorage
function saveCartToStorage(cart: CartItem[]): void {
  if (typeof window === 'undefined') return;
  try {
    if (cart.length === 0) {
      localStorage.removeItem(CART_STORAGE_KEY);
    } else {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    }
  } catch (error) {
    console.error('Failed to save cart to localStorage:', error);
  }
}

export default function POSPage() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartLoaded, setCartLoaded] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchManualEntry, setSearchManualEntry] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [clearCartDialogOpen, setClearCartDialogOpen] = useState(false);
  const [billPreviewSale, setBillPreviewSale] = useState<Sale | null>(null);
  const cartRef = useRef<CartItem[]>([]);

  // Load cart from localStorage on mount
  useEffect(() => {
    const savedCart = loadCartFromStorage();
    if (savedCart.length > 0) {
      setCart(savedCart);
      cartRef.current = savedCart;
      
      // Only show toast once per page load (survives StrictMode, resets on refresh)
      if (!hasShownRestoreToastThisSession) {
        hasShownRestoreToastThisSession = true;
        toast.info(`Restored ${savedCart.length} item${savedCart.length > 1 ? 's' : ''} from previous session`);
      }
    }
    setCartLoaded(true);

    // Pick up pending items queued from inventory page (Add to Cart)
    try {
      const pendingRaw = sessionStorage.getItem('pos_pending_items');
      if (pendingRaw) {
        sessionStorage.removeItem('pos_pending_items');
        const pendingItems: CartItem[] = JSON.parse(pendingRaw);
        const currentQrs = new Set((savedCart.length > 0 ? savedCart : []).map(i => i.qrCode));
        const newItems = pendingItems.filter(p => !currentQrs.has(p.qrCode));
        if (newItems.length > 0) {
          const merged = [...(savedCart.length > 0 ? savedCart : []), ...newItems];
          setCart(merged);
          cartRef.current = merged;
          saveCartToStorage(merged);
          toast.success(`Added ${newItems.length} item${newItems.length > 1 ? 's' : ''} to cart`);
        }
      }
    } catch {
      // Ignore malformed sessionStorage data
    }
  }, []);

  // Keep cartRef in sync & persist to localStorage whenever cart changes
  useEffect(() => {
    if (cartLoaded) {
      cartRef.current = cart;
      saveCartToStorage(cart);
    }
  }, [cart, cartLoaded]);

  // ── Single authority for cart-add + feedback ───────────────────────
  // Uses cartRef (synchronous read) so we never put side-effects inside
  // a React state updater (which StrictMode invokes twice).
  const addToCart = useCallback((item: CartItem, source: 'scan' | 'search') => {
    // Normalize QR code to uppercase — physical QR labels and DB may differ in case
    const normalizedItem = { ...item, qrCode: item.qrCode.toUpperCase() };

    if (cartRef.current.some((i) => i.qrCode === normalizedItem.qrCode)) {
      errorBuzz();
      toast.error('Item already in cart');
      return;
    }
    // Optimistically update ref for rapid-fire protection, then state
    const newCart = [...cartRef.current, normalizedItem];
    cartRef.current = newCart;
    setCart(newCart);

    // Delay chime after scan so it doesn't overlap with scanBeep
    if (source === 'scan') {
      setTimeout(() => successChime(), 400);
    } else {
      successChime();
    }
    toast.success(`Added ${normalizedItem.category} to cart`);
  }, []);

  const handleQRScanned = useCallback(
    (item: CartItem) => addToCart(item, 'scan'),
    [addToCart],
  );
  const handleAddFromSearch = useCallback(
    (item: CartItem) => addToCart(item, 'search'),
    [addToCart],
  );
  const handleAddFromQuickAdd = useCallback(
    (item: CartItem) => addToCart(item, 'search'),
    [addToCart],
  );

  const handleRemoveItem = useCallback((qrCode: string) => {
    // Read from ref to avoid putting side-effects inside a state updater
    // (StrictMode calls updaters twice → would fire 2 toasts)
    const removedItem = cartRef.current.find(i => i.qrCode === qrCode);
    const newCart = cartRef.current.filter(i => i.qrCode !== qrCode);
    cartRef.current = newCart;
    setCart(newCart);

    if (removedItem) {
      toast('Item removed from cart', {
        description: removedItem.qrCode,
        action: {
          label: 'Undo',
          onClick: () => {
            // Guard against double-undo: only re-add if not already in cart
            if (!cartRef.current.some(i => i.qrCode === removedItem.qrCode)) {
              const restored = [...cartRef.current, removedItem];
              cartRef.current = restored;
              setCart(restored);
            }
          },
        },
        duration: 5000,
      });
    }
  }, []);

  const handleUpdatePrice = useCallback((qrCode: string, newPrice: number) => {
    setCart(prevCart =>
      prevCart.map((item) =>
        item.qrCode === qrCode ? { ...item, finalPrice: newPrice } : item
      )
    );
  }, []);

  const handleUpdateDiscountReason = useCallback((qrCode: string, reason: string) => {
    setCart(prevCart =>
      prevCart.map((item) =>
        item.qrCode === qrCode ? { ...item, discountReason: reason } : item
      )
    );
  }, []);

  const handleUpdateSaleType = useCallback((qrCode: string, soldOnSale: boolean, saleType?: string) => {
    setCart(prevCart =>
      prevCart.map((item) =>
        item.qrCode === qrCode ? { ...item, soldOnSale, saleType: soldOnSale ? saleType : undefined } : item
      )
    );
  }, []);

  const handleCheckoutComplete = (completedSale?: { id: string; bill_number: number; bill_prefix: string; total_amount: number; created_at: string }) => {
    cartRef.current = [];
    setCart([]);
    setCheckoutOpen(false);
    // Show bill preview for online sales
    if (completedSale) {
      setBillPreviewSale({
        id: completedSale.id,
        bill_number: completedSale.bill_number,
        bill_prefix: completedSale.bill_prefix,
        total_amount: completedSale.total_amount,
        created_at: completedSale.created_at,
      } as unknown as Sale);
    }
  };

  const handleClearCart = () => {
    if (cart.length === 0) return;
    setClearCartDialogOpen(true);
  };

  const confirmClearCart = () => {
    cartRef.current = [];
    setCart([]);
    setClearCartDialogOpen(false);
    toast.info('Cart cleared');
  };

  // Memoize QR codes array to prevent unnecessary ProductSearchDialog re-renders
  const existingQrCodes = useMemo(() => cart.map((item) => item.qrCode), [cart]);

  const { profile } = useAuth();
  const router = useRouter();
  const homeRoute = profile?.role === 'superadmin' ? '/superadmin'
    : ['admin', 'owner'].includes(profile?.role || '') ? '/admin'
    : '/me';

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.push(homeRoute)} className="relative group shrink-0">
          <div className={`p-2.5 rounded-lg ${s.headerIconGradient} text-white shadow-md group-hover:shadow-lg transition-shadow`}>
            <ShoppingBag className="h-6 w-6" />
          </div>
          <div className="absolute -left-1.5 -top-1.5 bg-background border rounded-full p-1 shadow-sm group-hover:scale-110 transition-transform">
            <ArrowLeft className="h-3 w-3 text-muted-foreground" />
          </div>
        </button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Make a Purchase</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Scan items or search to add to cart</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        {/* Scan & Cart Section */}
        <div className="lg:col-span-2 space-y-4">
          {/* Search & Scan Actions */}
          <Card>
            <CardContent className="p-4 space-y-3">
              {/* Action Buttons */}
              <div className="space-y-3">
                {/* Scan QR - Full width on mobile, first row */}
                <div>
                  <ScanQRButton
                    onItemScanned={handleQRScanned}
                    onManualEntry={() => {
                      setSearchManualEntry(true);
                      setSearchOpen(true);
                    }}
                  />
                </div>

                {/* Search + Quick Add - Side by side, full row on all screens */}
                <div className="grid grid-cols-2 sm:grid-cols-2 gap-3">
                  {/* Search Button */}
                  <Button
                    onClick={() => { initAudio(); setSearchOpen(true); }}
                    variant="outline"
                    className={`h-auto py-4 flex-col gap-2 ${a.hoverBg} ${a.hoverBorder}`}
                  >
                    <Search className={`h-6 w-6 ${s.linkColor}`} />
                    <div className="text-center">
                      <div className="font-semibold text-base">Search Products</div>
                      <div className="text-xs text-muted-foreground">Browse inventory</div>
                    </div>
                  </Button>

                  {/* Quick Add (Manual Entry) */}
                  <Button
                    onClick={() => { initAudio(); setQuickAddOpen(true); }}
                    variant="outline"
                    className="h-auto py-4 flex-col gap-2 border-dashed border-amber-300 hover:bg-amber-50 hover:border-amber-400"
                  >
                    <Zap className="h-6 w-6 text-amber-600" />
                    <div className="text-center">
                      <div className="font-semibold text-base">Quick Add</div>
                      <div className="text-xs text-muted-foreground">No QR code needed</div>
                    </div>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Cart Items */}
          <Card>
            {/* <CardHeader>
              <CardTitle className="text-lg">Cart ({cart.length} items)</CardTitle>
            </CardHeader> */}
            <CardContent>
              {!cartLoaded ? (
                <div className="space-y-3 py-4">
                  {Array.from({ length: 2 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <Skeleton className="h-12 w-12 rounded" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-2/3" />
                        <Skeleton className="h-3 w-1/3" />
                      </div>
                      <Skeleton className="h-5 w-16" />
                    </div>
                  ))}
                </div>
              ) : cart.length === 0 ? (
                <EmptyState
                  icon={QrCode}
                  title="Scan a QR code or search to add items"
                  className="py-8 md:py-12"
                />
              ) : (
                <div className="animate-content-in">
                  <CartList
                  items={cart}
                  onRemoveItem={handleRemoveItem}
                  onUpdatePrice={handleUpdatePrice}
                  onUpdateDiscountReason={handleUpdateDiscountReason}
                  onUpdateSaleType={handleUpdateSaleType}
                  onClearCart={handleClearCart}
                />
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Summary & Checkout */}
        <div className="space-y-4">
          <Card className="lg:sticky lg:top-20">
            <CardHeader>
              <CardTitle className="text-lg">Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <CartSummary items={cart} />
              
              <Button
                className={`w-full h-12 text-base ${s.primaryGradient} ${s.primaryGradientHover}`}
                size="lg"
                disabled={cart.length === 0}
                onClick={() => setCheckoutOpen(true)}
              >
                Complete Sale
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Quick Add Dialog */}
      <QuickAddItemDialog
        open={quickAddOpen}
        onOpenChange={setQuickAddOpen}
        onAddToCart={handleAddFromQuickAdd}
      />

      {/* Product Search Dialog */}
      <ProductSearchDialog
        open={searchOpen}
        onOpenChange={(open) => {
          setSearchOpen(open);
          if (!open) setSearchManualEntry(false);
        }}
        onAddToCart={handleAddFromSearch}
        existingQrCodes={existingQrCodes}
        initialManualEntry={searchManualEntry}
      />

      {/* Checkout Dialog */}
      <CheckoutDialog
        open={checkoutOpen}
        onOpenChange={setCheckoutOpen}
        items={cart}
        onComplete={handleCheckoutComplete}
      />

      {/* Clear Cart Confirmation Dialog */}
      <ConfirmDialog
        open={clearCartDialogOpen}
        onOpenChange={setClearCartDialogOpen}
        onConfirm={confirmClearCart}
        title="Clear Cart"
        description="Are you sure you want to clear all items from the cart? This action cannot be undone."
        confirmText="Clear Cart"
        variant="destructive"
      />

      {/* Bill Preview after successful sale */}
      <BillPreviewDialog
        open={!!billPreviewSale}
        onOpenChange={(open) => { if (!open) setBillPreviewSale(null); }}
        sale={billPreviewSale}
      />
    </div>
  );
}
