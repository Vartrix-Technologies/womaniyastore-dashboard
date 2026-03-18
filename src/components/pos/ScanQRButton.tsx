'use client';

import { useState, useRef, useEffect } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Button } from '@/components/ui/button';
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
import { appConfig } from '@/lib/config/app.config';

const s = appConfig.styles;
const a = s.accent;
import { scanBeep, errorBuzz, initAudio } from '@/lib/sounds';

interface ScanQRButtonProps {
  onItemScanned: (item: CartItem) => void;
  onManualEntry?: () => void;
}

export function ScanQRButton({ onItemScanned, onManualEntry }: ScanQRButtonProps) {
  const [scanning, setScanning] = useState(false);
  const [loading, setLoading] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const processingRef = useRef(false); // ref-based guard: prevents double-fire from fast callbacks
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
    initAudio(); // Must happen in click handler so Chrome allows audio
    
    // Pre-check camera permissions before opening the scanner dialog
    try {
      // First check if the browser supports getUserMedia
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        toast.error('Camera not supported in this browser. Try installing the app first.');
        return;
      }

      // Request camera permission explicitly — this triggers the browser prompt
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      // Release the stream immediately — html5-qrcode will request its own
      stream.getTracks().forEach(track => track.stop());
    } catch (permError: unknown) {
      const errName = permError instanceof DOMException ? permError.name : '';
      if (errName === 'NotAllowedError') {
        toast.error('Camera permission denied. Please allow camera access in your browser/device settings and try again.', {
          duration: 6000,
        });
      } else if (errName === 'NotFoundError') {
        toast.error('No camera found on this device.');
      } else if (errName === 'NotReadableError') {
        toast.error('Camera is in use by another app. Close other camera apps and try again.');
      } else {
        toast.error('Could not access camera. Make sure the app has camera permissions.');
      }
      console.error('[Camera] Permission check failed:', permError);
      return;
    }

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
        toast.error('Failed to start camera scanner. Try closing other apps using the camera.');
        setScanning(false);
      }
    }, 100);
  };

  const stopScanning = async () => {
    const scanner = scannerRef.current;
    scannerRef.current = null;
    if (scanner) {
      try {
        const state = scanner.getState();
        // Only stop if actually scanning (state 2 = SCANNING)
        if (state === 2) {
          await scanner.stop();
        }
        scanner.clear();
      } catch (error) {
        console.error('Error stopping scanner:', error);
      }
    }
    setScanning(false);
    setLoading(false);
    // NOTE: processingRef is NOT reset here — only onScanSuccess's finally block
    // resets it. This prevents a second html5-qrcode callback from slipping through
    // while scanner.stop() is completing.
  };

  const onScanSuccess = async (decodedText: string) => {
    // Use ref guard — state updates are async and html5-qrcode fires fast
    if (processingRef.current) return;
    processingRef.current = true;

    scanBeep(); // Immediate auditory feedback: QR code detected
    setLoading(true);
    await stopScanning();

    try {
      await processQRCode(decodedText);
    } finally {
      setLoading(false);
      processingRef.current = false;
    }
  };



  const processQRCode = async (code: string) => {
    try {
      let itemData;
      let isFromCache = false;

      if (isOnline) {
        // Try online first
        try {
          const result = await searchInventoryByQRCode(code);
          itemData = result;
          
          // Cache the item for future offline use
          if (result.lot) {
            cacheScannedItem({
              inventoryItem: result,
              qrCode: { code },
              lot: result.lot,
              category: result.lot?.category,
              size: result.lot?.size,
            }).catch(console.warn); // Non-blocking
          }
        } catch (error) {
          // Only fall back to cache for NETWORK errors.
          // Business errors (already sold, not found, etc.) must propagate.
          const msg = error instanceof Error ? error.message : '';
          const isBusinessError =
            msg.includes('already sold') ||
            msg.includes('does not exist') ||
            msg.includes('not assigned') ||
            msg.includes('No inventory item found');
          if (isBusinessError) throw error;

          // Network failure — try cache
          const cached = await getCachedItem(code);
          if (!cached) throw error;
          itemData = cached;
          isFromCache = true;
          toast.info('Using cached data (network unavailable)');
        }
      } else {
        // Offline - use cache only
        const cached = await getCachedItem(code);
        if (!cached) {
          toast.error('Item not found in offline cache. Scan while online first.');
          throw new Error('Item not found in offline cache');
        }
        itemData = cached;
        isFromCache = true;
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
        lotSaleType: (itemData as any).lotSaleType,
        lotMinMargin: (itemData as any).lotMinMargin ?? undefined,
        lotSaleReason: (itemData as any).lotSaleReason,
        lotCostPrice: (itemData as any).lotCostPrice ?? undefined,
        // Initialize sale state from lot
        soldOnSale: !!(itemData as any).lotSaleType,
        saleType: (itemData as any).lotSaleType || undefined,
      } : {
        // Live data (from Supabase)
        id: itemData.id,
        qrCode: code,
        inventoryItemId: itemData.id,
        category: itemData.lot?.category?.name || 'Unknown',
        size: itemData.lot?.size?.size_name || itemData.lot?.free_text_size || 'N/A',
        originalPrice: itemData.selling_price || 0,
        finalPrice: itemData.selling_price || 0,
        taxRate: itemData.tax_rate || 0,
        lotId: itemData.lot_id,
        // Sale info from lot
        lotSaleType: itemData.sale_type ?? itemData.lot?.sale_type,
        lotMinMargin: itemData.lot?.min_margin_percent ?? undefined,
        lotSaleReason: itemData.sale_reason ?? itemData.lot?.sale_reason,
        lotCostPrice: itemData.cost_price ?? undefined,
        // Initialize sale state from item-level sale_type (with lot fallback)
        soldOnSale: !!(itemData.sale_type ?? itemData.lot?.sale_type),
        saleType: (itemData.sale_type ?? itemData.lot?.sale_type) || undefined,
      };

      // Sold-items are already rejected:
      //   - Live path: searchInventoryByQRCode throws "already sold" before we get here
      //   - Cache path: only used for network failures; cache was created when item was available

      // Parent handles success feedback (toast + chime)
      onItemScanned(cartItem);
    } catch (error) {
      console.error('Failed to fetch item:', error);
      const msg = error instanceof Error ? error.message : '';
      errorBuzz();
      if (!msg.includes('offline cache')) {
        toast.error(msg || 'Item not found');
      }
    }
  };

  return (
    <>
      <Button
        onClick={startScanning}
        variant="outline"
        className={`w-full h-auto py-4 flex-col gap-2 ${a.hoverBg} ${a.hoverBorder}`}
      >
        <QrCode className={`h-6 w-6 ${s.linkColor}`} />
        <div className="text-center">
          <div className="font-semibold text-base">Scan QR Code</div>
          <div className="text-xs text-muted-foreground">Use camera</div>
        </div>
      </Button>

      {/* QR Scanner Dialog */}
      <Dialog open={scanning} onOpenChange={(open) => !open && stopScanning()}>
        <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden">
          {/* Premium Header */}
          <div className={`bg-gradient-to-r ${s.primaryGradient} px-6 py-4`}>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-white/20 backdrop-blur-sm">
                <QrCode className="h-5 w-5 text-white" />
              </div>
              <div>
                <DialogHeader className="p-0 space-y-0.5 text-left">
                  <DialogTitle className="text-white text-lg font-bold">Scan QR Code</DialogTitle>
                  <DialogDescription className="text-white/80 text-sm">
                    Point your camera at the item&apos;s QR code
                  </DialogDescription>
                </DialogHeader>
              </div>
            </div>
          </div>

          <div className="px-6 py-5 space-y-4">
            <div className="relative rounded-xl overflow-hidden border-2 border-border/40 shadow-inner bg-black/5">
              <div id="qr-reader" className="w-full"></div>
              {loading && (
                <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center">
                  <div className="flex flex-col items-center gap-3">
                    <div className="animate-spin rounded-full h-10 w-10 border-[3px] border-brand-200 border-t-brand-600" />
                    <span className="text-sm text-muted-foreground font-medium">Processing...</span>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={stopScanning}
                className="flex-1 h-11 border-border/60"
              >
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button
                onClick={() => {
                  stopScanning();
                  onManualEntry?.();
                }}
                variant="secondary"
                className={`flex-1 h-11 ${a.bg} ${a.text} border ${a.border} hover:${a.bgMuted}`}
              >
                <Keyboard className="h-4 w-4 mr-2" />
                Type Code
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
