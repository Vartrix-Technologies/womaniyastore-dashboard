'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScanQRButton } from '@/components/pos/ScanQRButton';
import { CartList } from '@/components/pos/CartList';
import { CartSummary } from '@/components/pos/CartSummary';
import { CheckoutDialog } from '@/components/pos/CheckoutDialog';
import { ProductSearchDialog } from '@/components/pos/ProductSearchDialog';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { QrCode, Trash2, Search, ShoppingBag, Tag } from 'lucide-react';
import type { CartItem } from '@/types/pos.types';
import { toast } from 'sonner';

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
  const [clearCartDialogOpen, setClearCartDialogOpen] = useState(false);
  const [couponCode, setCouponCode] = useState('');

  // Load cart from localStorage on mount
  useEffect(() => {
    const savedCart = loadCartFromStorage();
    if (savedCart.length > 0) {
      setCart(savedCart);
      
      // Only show toast once per page load (survives StrictMode, resets on refresh)
      if (!hasShownRestoreToastThisSession) {
        hasShownRestoreToastThisSession = true;
        toast.info(`Restored ${savedCart.length} item${savedCart.length > 1 ? 's' : ''} from previous session`);
      }
    }
    setCartLoaded(true);
  }, []);

  // Save cart to localStorage whenever it changes (after initial load)
  useEffect(() => {
    if (cartLoaded) {
      saveCartToStorage(cart);
    }
  }, [cart, cartLoaded]);

  const handleQRScanned = useCallback((item: CartItem) => {
    // Check if item already in cart
    setCart(prevCart => {
      if (prevCart.some((i) => i.qrCode === item.qrCode)) {
        toast.error('Item already in cart');
        return prevCart;
      }
      toast.success(`Added ${item.category} to cart`);
      return [...prevCart, item];
    });
  }, []);

  const handleAddFromSearch = useCallback((item: CartItem) => {
    setCart(prevCart => {
      if (prevCart.some((i) => i.qrCode === item.qrCode)) {
        toast.error('Item already in cart');
        return prevCart;
      }
      return [...prevCart, item];
    });
  }, []);

  const handleRemoveItem = useCallback((qrCode: string) => {
    setCart(prevCart => prevCart.filter((i) => i.qrCode !== qrCode));
    toast.info('Item removed from cart');
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

  const handleCheckoutComplete = () => {
    setCart([]);
    setCouponCode('');
    setCheckoutOpen(false);
    // Reset restore flag so new cart items get toast on next session
    sessionStorage.removeItem(CART_RESTORED_KEY);
    hasShownRestoreToast.current = false;
  };

  const handleClearCart = () => {
    if (cart.length === 0) return;
    
    if (confirm('Are you sure you want to clear the cart?')) {
      setCart([]);
      setCouponCode('');
      // Reset restore flag so new cart items get toast on next session
      sessionStorage.removeItem(CART_RESTORED_KEY);
      hasShownRestoreToast.current = false;
      toast.info('Cart cleared');
    }
  };

  const handleApplyCoupon = () => {
    if (!couponCode.trim()) {
      toast.error('Please enter a coupon code');
      return;
    }
    // Placeholder for coupon validation logic
    toast.info('Coupon validation coming soon');
  };

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShoppingBag className="h-6 w-6 text-teal-600" />
            Make a Purchase
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Scan items or search to add to cart</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        {/* Scan & Cart Section */}
        <div className="lg:col-span-2 space-y-4">
          {/* Search & Scan Actions */}
          <Card>
            <CardContent className="p-4 space-y-3">
              {/* Action Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Search Button */}
                <Button
                  onClick={() => setSearchOpen(true)}
                  variant="outline"
                  className="h-auto py-4 flex-col gap-2 hover:bg-teal-50 hover:border-teal-300"
                >
                  <Search className="h-6 w-6 text-teal-600" />
                  <div className="text-center">
                    <div className="font-semibold text-base">Search Products</div>
                    <div className="text-xs text-muted-foreground">Browse inventory</div>
                  </div>
                </Button>

                {/* Scan QR */}
                <div className="flex-1">
                  <ScanQRButton onItemScanned={handleQRScanned} />
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
              {cart.length === 0 ? (
                <div className="text-center py-8 md:py-12">
                  <QrCode className="h-12 w-12 md:h-16 md:w-16 mx-auto text-muted-foreground mb-3" />
                  <p className="text-sm text-muted-foreground">
                    Scan a QR code or search to add items
                  </p>
                </div>
              ) : (
                <CartList
                  items={cart}
                  onRemoveItem={handleRemoveItem}
                  onUpdatePrice={handleUpdatePrice}
                  onUpdateDiscountReason={handleUpdateDiscountReason}
                  onUpdateSaleType={handleUpdateSaleType}
                  onClearCart={handleClearCart}
                />
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
              {/* Coupon Input */}
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <Tag className="h-4 w-4 text-teal-600" />
                  Have a coupon?
                </label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Enter code"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                    className="flex-1 text-sm"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleApplyCoupon}
                    disabled={!couponCode.trim()}
                  >
                    Apply
                  </Button>
                </div>
              </div>

              <div className="border-t pt-4">
                <CartSummary items={cart} couponCode={couponCode} />
              </div>
              
              <Button
                className="w-full h-12 text-base bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-600 hover:to-cyan-700"
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

      {/* Product Search Dialog */}
      <ProductSearchDialog
        open={searchOpen}
        onOpenChange={setSearchOpen}
        onAddToCart={handleAddFromSearch}
        existingQrCodes={cart.map((item) => item.qrCode)}
      />

      {/* Checkout Dialog */}
      <CheckoutDialog
        open={checkoutOpen}
        onOpenChange={setCheckoutOpen}
        items={cart}
        couponCode={couponCode}
        onComplete={handleCheckoutComplete}
      />
    </div>
  );
}
