'use client';

import { useState, useRef, useEffect } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { QrCode, X, Keyboard } from 'lucide-react';
import { searchInventoryByQRCode } from '@/lib/api/inventory';
import { getCachedItem, cacheScannedItem } from '@/lib/offline';
import { useOfflineStatus } from '@/hooks/useOfflineStatus';
import type { CartItem } from '@/types/pos.types';
import { toast } from 'sonner';

interface ScanQRButtonProps {
  onItemScanned: (item: CartItem) => void;
}

export function ScanQRButton({ onItemScanned }: ScanQRButtonProps) {
  const [scanning, setScanning] = useState(false);
  const [manualEntry, setManualEntry] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [loading, setLoading] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const { isOnline } = useOfflineStatus();

  useEffect(() => {
    return () => {
      // Cleanup scanner on unmount
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, []);

  const startScanning = async () => {
    setScanning(true);

    // Wait for DOM to be ready
    setTimeout(async () => {
      try {
        const scanner = new Html5Qrcode('qr-reader');
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
          },
          onScanSuccess,
          () => {} // onScanFailure - ignore scan errors
        );
      } catch (error) {
        console.error('Failed to start scanner:', error);
        toast.error('Failed to access camera');
        setScanning(false);
      }
    }, 100);
  };

  const stopScanning = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear();
        scannerRef.current = null;
      } catch (error) {
        console.error('Error stopping scanner:', error);
      }
    }
    setScanning(false);
  };

  const onScanSuccess = async (decodedText: string) => {
    if (loading) return;

    setLoading(true);
    await stopScanning();
    await processQRCode(decodedText);
  };

  const handleManualEntry = async () => {
    if (!manualCode.trim()) {
      toast.error('Please enter a product code');
      return;
    }

    setLoading(true);
    try {
      await processQRCode(manualCode.trim());
      setManualCode('');
      setManualEntry(false);
    } catch (error) {
      // Error is already handled in processQRCode
    } finally {
      setLoading(false);
    }
  };

  const processQRCode = async (code: string) => {
    try {
      let itemData;

      if (isOnline) {
        // Try online first
        try {
          const result = await searchInventoryByQRCode(code);
          itemData = result;
        } catch (error) {
          // Fall back to cache if online fails
          const cached = await getCachedInventoryItem(code);
          if (!cached) throw error;
          itemData = cached;
        }
      } else {
        // Offline - use cache only
        const cached = await getCachedInventoryItem(code);
        if (!cached) {
          toast.error('Item not found in offline cache');
          throw new Error('Item not found in offline cache');
        }
        itemData = cached;
      }

      // Create cart item
      // Handle both cached (offline) and live (online) data structures
      const cartItem: CartItem = 'itemId' in itemData ? {
        // Cached data (from IndexedDB)
        id: itemData.itemId,
        qrCode: code,
        inventoryItemId: itemData.itemId,
        category: itemData.category,
        size: itemData.size,
        originalPrice: itemData.price,
        finalPrice: itemData.price,
        taxRate: itemData.taxRate,
        lotId: itemData.lotId,
        // Sale info from cached lot
        lotSaleType: itemData.lotSaleType,
        lotMinMargin: itemData.lotMinMargin,
        lotSaleReason: itemData.lotSaleReason,
        lotCostPrice: itemData.lotCostPrice,
        // Initialize sale state from lot
        soldOnSale: !!itemData.lotSaleType,
        saleType: itemData.lotSaleType || undefined,
      } : {
        // Live data (from Supabase)
        id: itemData.id,
        qrCode: code,
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

      // Check if item is already sold
      if (itemData.sold_at || itemData.sale_id) {
        toast.error('This item has already been sold');
        throw new Error('Item already sold');
      }

      onItemScanned(cartItem);
    } catch (error) {
      console.error('Failed to fetch item:', error);
      toast.error(error instanceof Error ? error.message : 'Item not found');
      throw error;
    }
  };

  return (
    <>
      <Button
        onClick={startScanning}
        variant="outline"
        className="w-full h-auto py-4 flex-col gap-2 hover:bg-teal-50 hover:border-teal-300"
      >
        <QrCode className="h-6 w-6 text-teal-600" />
        <div className="text-center">
          <div className="font-semibold text-base">Scan QR Code</div>
          <div className="text-xs text-muted-foreground">Use camera</div>
        </div>
      </Button>

      {/* QR Scanner Dialog */}
      <Dialog open={scanning} onOpenChange={(open) => !open && stopScanning()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg">Scan QR Code</DialogTitle>
            <DialogDescription className="text-sm">
              Point your camera at the item's QR code
            </DialogDescription>
          </DialogHeader>

          <div className="relative">
            <div id="qr-reader" className="w-full"></div>
            {loading && (
              <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent" />
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={stopScanning}
              className="flex-1"
            >
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button
              onClick={() => {
                stopScanning();
                setManualEntry(true);
              }}
              variant="secondary"
              className="flex-1"
            >
              <Keyboard className="h-4 w-4 mr-2" />
              Manual Entry
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Manual Entry Dialog */}
      <Dialog open={manualEntry} onOpenChange={(open) => {
        setManualEntry(open);
        if (!open) {
          setManualCode('');
          setLoading(false);
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg">Enter Product Code</DialogTitle>
            <DialogDescription className="text-sm">
              Type or paste the product QR code
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="manual-code" className="text-sm">Product Code</Label>
              <Input
                id="manual-code"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !loading && handleManualEntry()}
                placeholder="Enter product code"
                className="text-base mt-1.5"
                autoFocus
                disabled={loading}
              />
            </div>

            <div className="flex gap-2">
              <Button
                onClick={handleManualEntry}
                disabled={loading || !manualCode.trim()}
                className="flex-1 bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-600 hover:to-cyan-700"
              >
                {loading ? 'Adding...' : 'Add to Cart'}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setManualEntry(false);
                  setManualCode('');
                  setLoading(false);
                }}
                disabled={loading}
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
