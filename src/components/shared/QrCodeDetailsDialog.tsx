'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/lib/supabase';
import { QrCodeCard, downloadQrCode } from '@/components/shared/QrCodeCard';
import { toast } from 'sonner';
import { Download, QrCode, Info, Package, Calendar } from 'lucide-react';
import { appConfig } from '@/lib/config';

const s = appConfig.styles;

interface QrCode {
  id: string;
  code: string;
  status: string;
  created_at: string;
}

interface QrCodeDetailsDialogProps {
  qrCode: QrCode | null;
  onClose: () => void;
}

export function QrCodeDetailsDialog({ qrCode, onClose }: QrCodeDetailsDialogProps) {
  const [loading, setLoading] = useState(false);
  const [details, setDetails] = useState<any>(null);

  useEffect(() => {
    if (qrCode) {
      fetchDetails();
    } else {
      setDetails(null);
    }
  }, [qrCode]);

  const fetchDetails = async () => {
    if (!qrCode) return;
    
    setLoading(true);
    try {
      // Optimized single query with all joins
      const { data, error } = await supabase
        .from('inventory_items')
        .select(`
          id,
          status,
          created_at,
          sold_at,
          lot_id,
          lots (
            id,
            cost_price_per_unit,
            selling_price_default,
            tax_rate,
            date_of_stock_arrival,
            free_text_size,
            category_id,
            size_id,
            categories (
              id,
              name
            ),
            sizes (
              id,
              size_name
            )
          )
        `)
        .eq('qr_code_id', qrCode.id)
        .maybeSingle();

      if (error) {
        console.error('Error fetching details:', error);
        toast.error('Failed to load details');
        setDetails(null);
      } else {
        setDetails(data);
      }
    } catch (error: any) {
      console.error('Error fetching QR details:', error);
      toast.error('Failed to load details');
      setDetails(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={!!qrCode} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-lg max-h-[85vh] flex flex-col p-0 overflow-hidden">
        {/* Premium header */}
        <DialogHeader className="px-5 pt-5 pb-3 shrink-0">
          <DialogTitle className="text-lg flex items-center gap-2">
            <div className={`p-1.5 rounded-md ${s.headerIconGradient} text-white shadow-sm`}>
              <QrCode className="h-4 w-4" />
            </div>
            QR Code Details
          </DialogTitle>
          <DialogDescription asChild>
            <div className="flex items-center gap-2 flex-wrap mt-1">
              {qrCode?.code && (
                <Badge variant="secondary" className="font-mono font-semibold text-xs">
                  {qrCode.code}
                </Badge>
              )}
              <Badge variant={qrCode?.status === 'assigned' ? 'secondary' : qrCode?.status === 'sold' ? 'outline' : 'destructive'} className="capitalize text-xs">
                {qrCode?.status}
              </Badge>
            </div>
          </DialogDescription>
        </DialogHeader>

        <Separator />

        {/* Scrollable body */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : (
          <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-4">
            {/* QR Code Image */}
            {qrCode && (
              <div className="flex flex-col items-center gap-3">
                <QrCodeCard 
                  code={qrCode.code} 
                  size={160} 
                  showDownloadButton={false}
                  className="w-fit"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => downloadQrCode(qrCode.code)}
                  className="w-full max-w-[200px]"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download QR Image
                </Button>
              </div>
            )}

            {/* Status Information */}
            <section className="space-y-2.5">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                <Info className="h-3.5 w-3.5" /> Status Information
              </h3>
              <div className="rounded-lg border bg-muted/30 p-3 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">QR Code:</span>
                  <span className="font-mono font-semibold text-xs">{qrCode?.code}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status:</span>
                  <Badge variant={qrCode?.status === 'assigned' ? 'secondary' : qrCode?.status === 'sold' ? 'outline' : 'destructive'} className="capitalize">
                    {qrCode?.status}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Created:</span>
                  <span className="text-xs">{qrCode?.created_at ? new Date(qrCode.created_at).toLocaleString() : 'N/A'}</span>
                </div>
              </div>
            </section>

            {/* Associated Product */}
            {details ? (
              <section className="space-y-2.5">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                  <Package className="h-3.5 w-3.5" /> Associated Inventory Item
                </h3>
                <div className="rounded-lg border bg-muted/30 p-3 space-y-2 text-sm">
                  {details.lots ? (
                    <>
                      {(details.lots.sizes?.size_name || details.lots.free_text_size) && (
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Size:</span>
                          <span className="text-lg font-bold text-primary">
                            {details.lots.sizes?.size_name || details.lots.free_text_size}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Category:</span>
                        <span className="font-semibold">{details.lots.categories?.name || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Cost Price:</span>
                        <span className="font-semibold text-green-600">
                          ₹{details.lots.cost_price_per_unit?.toFixed(2) || '0.00'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Selling Price:</span>
                        <span className="font-semibold">
                          ₹{details.lots.selling_price_default?.toFixed(2) || '0.00'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Tax Rate:</span>
                        <span>{details.lots.tax_rate}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Stock Arrival:</span>
                        <span>
                          {details.lots.date_of_stock_arrival 
                            ? new Date(details.lots.date_of_stock_arrival).toLocaleDateString()
                            : 'N/A'
                          }
                        </span>
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-2 text-muted-foreground text-xs">
                      No lot information available
                    </div>
                  )}
                </div>

                {/* Item Meta */}
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" /> Item History
                </h3>
                <div className="rounded-lg border bg-muted/30 p-3 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Item Status:</span>
                    <Badge variant="outline" className="capitalize">{details.status}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Added to Inventory:</span>
                    <span>{details.created_at ? new Date(details.created_at).toLocaleDateString() : 'N/A'}</span>
                  </div>
                  {details.sold_at && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Sold On:</span>
                      <span>{new Date(details.sold_at).toLocaleDateString()}</span>
                    </div>
                  )}
                </div>
              </section>
            ) : (
              <section className="space-y-2.5">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                  <Package className="h-3.5 w-3.5" /> Associated Inventory Item
                </h3>
                <div className="rounded-lg border bg-muted/30 p-6 text-center text-muted-foreground">
                  <p className="text-sm">No inventory item found for this QR code.</p>
                  <p className="text-xs mt-2">This QR code may not have been assigned to a product yet.</p>
                </div>
              </section>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
