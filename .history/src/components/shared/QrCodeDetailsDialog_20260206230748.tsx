'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { QrCodeCard, downloadQrCode } from '@/components/shared/QrCodeCard';
import { toast } from 'sonner';
import { Download } from 'lucide-react';

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
      <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg">QR Code Details</DialogTitle>
          <DialogDescription className="text-xs">
            {/* <span className="font-mono font-semibold">{qrCode?.code}</span> */}
          </DialogDescription>
        </DialogHeader>
        
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : (
          <div className="space-y-3">
            {/* QR Code Image */}
            {qrCode && (
              <div className="flex justify-center">
                <QrCodeCard 
                  code={qrCode.code} 
                  size={160} 
                  showDownloadButton={false}
                  className="w-fit"
                />
              </div>
            )}

            {/* Download Button */}
            {qrCode && (
              <div className="flex justify-center">
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

            {/* QR Code Status */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Status Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">QR Code:</span>
                  <span className="font-mono font-semibold text-xs">{qrCode?.code}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status:</span>
                  <Badge variant={qrCode?.status === 'assigned' ? 'secondary' : qrCode?.status === 'sold' ? 'outline' : 'destructive'}>
                    {qrCode?.status}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Created:</span>
                  <span className="text-xs">{qrCode?.created_at ? new Date(qrCode.created_at).toLocaleString() : 'N/A'}</span>
                </div>
              </CardContent>
            </Card>

            {/* Associated Product */}
            {details ? (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Associated Inventory Item</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1.5 text-sm">
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
                  <div className="border-t pt-2 mt-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Item Status:</span>
                      <Badge variant="outline">{details.status}</Badge>
                    </div>
                    <div className="flex justify-between mt-2">
                      <span className="text-muted-foreground">Added to Inventory:</span>
                      <span>{details.created_at ? new Date(details.created_at).toLocaleDateString() : 'N/A'}</span>
                    </div>
                    {details.sold_at && (
                      <div className="flex justify-between mt-2">
                        <span className="text-muted-foreground">Sold On:</span>
                        <span>{new Date(details.sold_at).toLocaleDateString()}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="bg-muted/50">
                <CardContent className="py-8 text-center text-muted-foreground">
                  <p className="text-sm">No inventory item found for this QR code.</p>
                  <p className="text-xs mt-2">This QR code may not have been assigned to a product yet.</p>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
