'use client';

import { useAuth } from '@/context/AuthContext';
import { useSync } from '@/context/SyncContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { RefreshCw, AlertCircle, CheckCircle2, Loader2, Trash2, X } from 'lucide-react';
import { formatCurrency, formatDate, formatTime } from '@/lib/formatters';
import { deletePendingSale } from '@/lib/offline/db';
import { useState } from 'react';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { appConfig } from '@/lib/config/app.config';

const s = appConfig.styles;

export default function SyncIssuesPage() {
  const { profile } = useAuth();
  const { pendingSales, syncing, syncNow, retryFailed, refreshPendingSales } = useSync();
  const [deleting, setDeleting] = useState<string | null>(null);

  // Confirm dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
  }>({ open: false, title: '', description: '', onConfirm: () => {} });

  // Filter pending sales by shop_id for non-superadmin users
  const filteredPendingSales = profile?.role === 'superadmin' 
    ? pendingSales 
    : pendingSales.filter(s => s.saleData?.shop_id === profile?.shop_id);

  const failedSales = filteredPendingSales.filter(s => s.status === 'failed');
  const pendingCount = filteredPendingSales.filter(s => s.status === 'pending' || s.status === 'syncing').length;

  const handleRetryAll = async () => {
    try {
      await retryFailed();
    } catch (error) {
      console.error('Retry all failed:', error);
      toast.error('Failed to retry sales');
    }
  };

  const handleSyncNow = async () => {
    try {
      await syncNow();
    } catch (error) {
      console.error('Sync failed:', error);
      toast.error('Sync failed');
    }
  };

  const handleDeleteSale = (saleId: string) => {
    setConfirmDialog({
      open: true,
      title: 'Delete Failed Sale',
      description: 'Are you sure you want to delete this failed sale? This action cannot be undone.',
      onConfirm: async () => {
        setDeleting(saleId);
        try {
          await deletePendingSale(saleId);
          await refreshPendingSales();
          toast.success('Failed sale deleted');
        } catch (error) {
          console.error('Delete failed:', error);
          toast.error('Failed to delete sale');
        } finally {
          setDeleting(null);
        }
      },
    });
  };

  const handleClearAllFailed = () => {
    setConfirmDialog({
      open: true,
      title: 'Clear All Failed Sales',
      description: `Are you sure you want to delete all ${failedSales.length} failed sales? This action cannot be undone.`,
      onConfirm: async () => {
        try {
          for (const sale of failedSales) {
            await deletePendingSale(sale.id);
          }
          await refreshPendingSales();
          toast.success(`Deleted ${failedSales.length} failed sales`);
        } catch (error) {
          console.error('Clear all failed:', error);
          toast.error('Failed to clear failed sales');
        }
      },
    });
  };

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Sync Issues</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Manage failed offline sales ({failedSales.length} failed, {pendingCount} pending)
          </p>
        </div>
        <div className="flex gap-2">
          {failedSales.length > 0 && (
            <Button 
              onClick={handleClearAllFailed} 
              variant="outline"
              className={`text-destructive hover:bg-destructive/10 ${s.btnAnimation}`}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Clear All Failed
            </Button>
          )}
          {pendingCount > 0 && (
            <Button onClick={() => setConfirmDialog({
              open: true,
              title: 'Sync Pending Sales',
              description: `Are you sure you want to sync ${pendingCount} pending sale(s) now?`,
              onConfirm: handleSyncNow,
            })} disabled={syncing} variant="outline" className={s.btnAnimation}>
              {syncing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Syncing...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Sync Now
                </>
              )}
            </Button>
          )}
          {failedSales.length > 0 && (
            <Button onClick={() => setConfirmDialog({
              open: true,
              title: 'Retry All Failed Sales',
              description: `Are you sure you want to retry all ${failedSales.length} failed sale(s)? This will attempt to re-sync them.`,
              onConfirm: handleRetryAll,
            })} disabled={syncing} className={`${s.primaryGradient} ${s.primaryGradientHover} ${s.btnAnimation}`}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Retry Failed
            </Button>
          )}
        </div>
      </div>

      {failedSales.length === 0 && pendingCount === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <CheckCircle2 className="h-16 w-16 text-green-500 mb-4" />
            <h3 className="text-lg font-semibold mb-2">All Clear!</h3>
            <p className="text-muted-foreground text-center max-w-md text-sm">
              No sync issues found. All offline sales have been successfully synced to the server.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {failedSales.map((sale, idx) => {
            const totalAmount = sale.items.reduce((sum, item) => sum + item.finalPrice, 0);
            
            return (
              <Card key={sale.id} className="border-destructive/50 animate-stagger-fade-in" style={{ '--row-index': idx } as React.CSSProperties}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <AlertCircle className="h-5 w-5 text-destructive" />
                        <CardTitle className="text-lg">Failed Sale</CardTitle>
                        <Badge variant="destructive">
                          {sale.retryCount || 0} {sale.retryCount === 1 ? 'retry' : 'retries'}
                        </Badge>
                        <Badge variant="outline">{sale.status}</Badge>
                      </div>
                      <CardDescription>
                        {formatDate(sale.occurredAt)} at {formatTime(sale.occurredAt)}
                      </CardDescription>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteSale(sale.id)}
                      disabled={deleting === sale.id}
                      className="text-destructive hover:bg-destructive/10 flex-shrink-0"
                      title="Delete this failed sale"
                    >
                      {deleting === sale.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <X className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-lg bg-destructive/10 p-4">
                    <p className="text-sm font-medium text-destructive mb-1">Error Message:</p>
                    <p className="text-sm text-muted-foreground">{sale.lastError || 'Unknown error'}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Payment Method</p>
                      <p className="font-medium capitalize">{sale.paymentMethod}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Total Amount</p>
                      <p className="font-medium">{formatCurrency(totalAmount)}</p>
                    </div>
                    {sale.customerName && (
                      <div>
                        <p className="text-muted-foreground">Customer</p>
                        <p className="font-medium">{sale.customerName}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-muted-foreground">Items</p>
                      <p className="font-medium">{sale.items.length} items</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm font-medium">Items:</p>
                    <div className="rounded-md border">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/50">
                          <tr>
                            <th className="p-2 text-left">QR Code</th>
                            <th className="p-2 text-right">Price</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sale.items.map((item, idx) => (
                            <tr key={idx} className="border-t animate-stagger-fade-in" style={{ '--row-index': idx } as React.CSSProperties}>
                              <td className="p-2">{item.qrCode}</td>
                              <td className="p-2 text-right">{formatCurrency(item.finalPrice)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Confirm Dialog */}
      <ConfirmDialog
        open={confirmDialog.open}
        onOpenChange={(open) => setConfirmDialog({ ...confirmDialog, open })}
        onConfirm={confirmDialog.onConfirm}
        title={confirmDialog.title}
        description={confirmDialog.description}
        confirmText="Delete"
        cancelText="Cancel"
        variant="destructive"
      />
    </div>
  );
}
