'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { QrCodeDetailsDialog } from '@/components/shared/QrCodeDetailsDialog';
import { QrCodeDownloadDialog } from '@/components/shared/QrCodeDownloadDialog';
import { downloadQrCode } from '@/components/shared/QrCodeCard';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { toast } from 'sonner';
import { QrCode as QrCodeIcon, Plus, Download, Search, ArrowLeft, Trash2, RefreshCw, ChevronFirst, ChevronLast, ChevronLeft, ChevronRight, Eye, Printer } from 'lucide-react';
import { exportToCSV } from '@/lib/utils';
import { useServerPagination, useSortableTable, useDebouncedSearch } from '@/hooks';
import { SortableHeader } from '@/components/shared/SortableHeader';
import type { Database } from '@/types/database.types';
import type { QrPrefix } from '@/types';
import { fetchActiveQrPrefixes } from '@/lib/api/qr-prefixes';

type QrCode = Database['public']['Tables']['qr_codes']['Row'];
type QrStatus = Database['public']['Enums']['qr_status'];

export default function QrCodesPage() {
  const router = useRouter();
  const { profile } = useAuth();
  const [qrCodes, setQrCodes] = useState<QrCode[]>([]);
  const [qrPrefixes, setQrPrefixes] = useState<QrPrefix[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const { searchTerm, debouncedSearchTerm, setSearchTerm } = useDebouncedSearch({ delay: 500 });
  const [filterStatus, setFilterStatus] = useState<QrStatus | 'all'>('all');
  const [totalCount, setTotalCount] = useState(0);
  const {
    currentPage,
    itemsPerPage,
    setCurrentPage,
    setItemsPerPage,
    from,
    to,
    totalPages,
    goToFirstPage,
    goToLastPage,
    goToNextPage,
    goToPrevPage,
  } = useServerPagination({ totalCount });
  const { sortBy, sortOrder, toggleSort } = useSortableTable<'code' | 'status' | 'created_at'>({ 
    initialSortBy: 'code',
    initialSortOrder: 'asc'
  });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const [viewingQrCode, setViewingQrCode] = useState<QrCode | null>(null);
  
  // Confirmation dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
  }>({ open: false, title: '', description: '', onConfirm: () => {} });
  
  // Download dialog state
  const [downloadDialogOpen, setDownloadDialogOpen] = useState(false);
  const [downloadCodes, setDownloadCodes] = useState<string[]>([]);
  
  // Generation form
  const [selectedPrefixId, setSelectedPrefixId] = useState<string>('');
  const [quantity, setQuantity] = useState(100);

  useEffect(() => {
    async function loadQrCodes() {
      try {
        if (!profile?.shop_id) {
          setLoading(false);
          return;
        }
        
        setLoading(true);
        console.log('Loading QR codes - Page:', currentPage, 'Per page:', itemsPerPage);
        
        // Load QR prefixes (only once)
        if (qrPrefixes.length === 0) {
          const prefixes = await fetchActiveQrPrefixes(profile.shop_id);
          setQrPrefixes(prefixes);
          if (prefixes.length > 0 && !selectedPrefixId) {
            setSelectedPrefixId(prefixes[0].id);
          }
        }
        
        // Build query with filters
        let query = supabase
          .from('qr_codes')
          .select('*', { count: 'exact' })
          .eq('shop_id', profile.shop_id);

        // Apply status filter
        if (filterStatus !== 'all') {
          query = query.eq('status', filterStatus);
        }

        // Apply search filter
        if (debouncedSearchTerm) {
          query = query.ilike('code', `%${debouncedSearchTerm}%`);
        }

        // Fetch only the current page (from/to come from useServerPagination hook)
        const { data, error, count } = await query
          .order(sortBy, { ascending: sortOrder === 'asc' })
          .range(from, to);

        if (error) throw error;
        
        console.log(`Loaded ${data?.length || 0} records for page ${currentPage} (Total: ${count})`);
        setQrCodes(data || []);
        setTotalCount(count || 0);
      } catch (error) {
        console.error('Error loading QR codes:', error);
        toast.error('Failed to load QR codes');
      } finally {
        setLoading(false);
      }
    }

    loadQrCodes();
  }, [profile?.shop_id, currentPage, itemsPerPage, debouncedSearchTerm, filterStatus, sortBy, sortOrder]);

  // Clear selection when page/filters change
  useEffect(() => {
    setSelectedIds(new Set());
  }, [currentPage, itemsPerPage, debouncedSearchTerm, filterStatus]);

  const handleGenerate = async () => {
    if (!profile?.shop_id) {
      console.error('No shop_id found in profile:', profile);
      toast.error('Shop ID not found. Please log in again.');
      return;
    }
    
    if (!selectedPrefixId) {
      toast.error('Please select a QR prefix');
      return;
    }
    
    if (quantity < 1 || quantity > 9999) {
      toast.error('Quantity must be between 1 and 9999');
      return;
    }
    
    try {
      setGenerating(true);
      const selectedPrefix = qrPrefixes.find(p => p.id === selectedPrefixId);
      console.log('=== QR Code Generation Started ===');
      console.log('Shop ID:', profile.shop_id);
      console.log('Prefix:', selectedPrefix?.prefix);
      console.log('Prefix ID:', selectedPrefixId);
      console.log('Quantity:', quantity);

      // Use the database function to generate QR codes with prefix
      const { data, error } = await (supabase.rpc as any)('generate_qr_codes_with_prefix', {
        p_shop_id: profile.shop_id,
        p_prefix_id: selectedPrefixId,
        p_quantity: quantity,
      });

      if (error) {
        console.error('Generation error:', error);
        if (error.message?.includes('exceeds')) {
          throw new Error(`Cannot generate ${quantity} codes. Sequence limit (9999) would be exceeded for prefix ${selectedPrefix?.prefix}.`);
        }
        throw error;
      }

      console.log('Generation successful. Raw data:', data);
      console.log('Data type:', typeof data);
      console.log('Is array:', Array.isArray(data));
      
      // Get first and last generated codes for detailed success message
      let firstCode: string | undefined;
      let lastCode: string | undefined;
      
      if (Array.isArray(data) && data.length > 0) {
        console.log('First item:', data[0]);
        console.log('Last item:', data[data.length - 1]);
        firstCode = data[0]?.code || data[0];
        lastCode = data[data.length - 1]?.code || data[data.length - 1];
        console.log('Extracted codes:', { firstCode, lastCode });
      }
      
      toast.success(
        `Generated ${quantity} QR codes with prefix ${selectedPrefix?.prefix}!`,
        {
          description: firstCode && lastCode ? `Range: ${firstCode} to ${lastCode}` : undefined,
          duration: 4000
        }
      );
      
      // Reset to first page to see new codes
      setCurrentPage(1);
      // The useEffect will automatically reload with the new data
      
      console.log('=== QR Code Generation Completed ===');
    } catch (error: any) {
      console.error('Error generating QR codes:', error);
      toast.error(error.message || 'Failed to generate QR codes');
    } finally {
      setGenerating(false);
    }
  };

  const handleViewDetails = (qrCode: QrCode) => {
    setViewingQrCode(qrCode);
  };

  const handleDelete = async (qrCode: QrCode) => {
    if (qrCode.status !== 'unused') {
      toast.error('Only unused QR codes can be deleted');
      return;
    }

    setConfirmDialog({
      open: true,
      title: 'Delete QR Code',
      description: `Are you sure you want to delete QR code "${qrCode.code}"? This action cannot be undone.`,
      onConfirm: async () => {
        try {
          const { error } = await supabase
            .from('qr_codes')
            .delete()
            .eq('id', qrCode.id);

          if (error) throw error;

          toast.success('QR code deleted successfully');
          
          // Reload current page
          setCurrentPage(1);
        } catch (error: any) {
          console.error('Error deleting QR code:', error);
          toast.error(error.message || 'Failed to delete QR code');
        }
      },
    });
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) {
      toast.error('No QR codes selected');
      return;
    }

    setConfirmDialog({
      open: true,
      title: 'Delete Multiple QR Codes',
      description: `Are you sure you want to delete ${selectedIds.size} QR code(s)? This action cannot be undone.`,
      onConfirm: async () => {
        try {
          setIsDeleting(true);
          const { error } = await supabase
            .from('qr_codes')
            .delete()
            .in('id', Array.from(selectedIds));

          if (error) throw error;

          toast.success(`Deleted ${selectedIds.size} QR code(s)`);
          setSelectedIds(new Set());
          setCurrentPage(1);
        } catch (error: any) {
          console.error('Error deleting QR codes:', error);
          toast.error(error.message || 'Failed to delete QR codes');
        } finally {
          setIsDeleting(false);
        }
      },
    });
  };

  const handleDeleteAllUnused = async () => {
    if (!profile?.shop_id) return;

    // Get count first
    const { count } = await supabase
      .from('qr_codes')
      .select('*', { count: 'exact', head: true })
      .eq('shop_id', profile.shop_id)
      .eq('status', 'unused');

    if (!count || count === 0) {
      toast.error('No unused QR codes to delete');
      return;
    }

    setConfirmDialog({
      open: true,
      title: 'Delete All Unused QR Codes',
      description: `Are you sure you want to delete ALL ${count} unused QR codes? This action cannot be undone.`,
      onConfirm: async () => {
        try {
          setIsDeleting(true);
          const { error } = await supabase
            .from('qr_codes')
            .delete()
            .eq('shop_id', profile.shop_id!)
            .eq('status', 'unused');

          if (error) throw error;

          toast.success(`Deleted ${count} unused QR codes`);
          setSelectedIds(new Set());
          setCurrentPage(1);
        } catch (error: any) {
          console.error('Error deleting unused QR codes:', error);
          toast.error(error.message || 'Failed to delete unused QR codes');
        } finally {
          setIsDeleting(false);
        }
      },
    });
  };

  const toggleSelection = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === qrCodes.filter(qr => qr.status === 'unused').length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(qrCodes.filter(qr => qr.status === 'unused').map(qr => qr.id)));
    }
  };

  const unusedCodesOnPage = qrCodes.filter(qr => qr.status === 'unused');
  const hasUnusedCodes = unusedCodesOnPage.length > 0;

  const manualRefresh = async () => {
    console.log('=== Manual Refresh Triggered ===');
    try {
      if (!profile?.shop_id) {
        console.error('No shop_id found:', profile);
        toast.error('Shop ID not found');
        return;
      }

      setLoading(true);
      console.log('Fetching QR codes for shop_id:', profile.shop_id);
      
      // Build query with filters
      let query = supabase
        .from('qr_codes')
        .select('*', { count: 'exact' })
        .eq('shop_id', profile.shop_id);

      if (filterStatus !== 'all') {
        query = query.eq('status', filterStatus);
      }

      if (debouncedSearchTerm) {
        query = query.ilike('code', `%${debouncedSearchTerm}%`);
      }

      const { data, error, count } = await query
        .order('code', { ascending: true })
        .range(from, to);

      if (error) {
        console.error('Refresh error:', error);
        throw error;
      }

      console.log('Total records:', count, 'Current page:', data?.length);
      if (data && data.length > 0) {
        console.log('First record:', data[0]);
        console.log('Last record:', data[data.length - 1]);
      }

      setQrCodes(data || []);
      setTotalCount(count || 0);
      toast.success(`Loaded ${data?.length || 0} of ${count} QR codes`);
      console.log('=== Manual Refresh Completed ===');
    } catch (error: any) {
      console.error('Manual refresh failed:', error);
      toast.error('Failed to refresh: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const exportQrCodes = async () => {
    // For export, we need to fetch ALL matching records
    try {
      let query = supabase
        .from('qr_codes')
        .select('*')
        .eq('shop_id', profile?.shop_id!);

      if (filterStatus !== 'all') {
        query = query.eq('status', filterStatus);
      }

      if (debouncedSearchTerm) {
        query = query.ilike('code', `%${debouncedSearchTerm}%`);
      }

      const { data, error } = await query.order('code', { ascending: true });
      
      if (error) throw error;
      if (!data || data.length === 0) {
        toast.error('No data to export');
        return;
      }

      const exportData = data.map(qr => ({
        'Code': qr.code,
        'Status': qr.status,
        'Created At': qr.created_at
      }));

      exportToCSV(exportData, { filename: 'qr-codes' });
      toast.success(`Exported ${data.length} QR codes`);
    } catch (error: any) {
      console.error('Export error:', error);
      toast.error('Failed to export QR codes');
    }
  };

  // Calculate stats from server-side data
  const getStats = async () => {
    if (!profile?.shop_id) return { total: 0, unused: 0, assigned: 0, sold: 0, lost: 0 };
    
    const { count: total } = await supabase
      .from('qr_codes')
      .select('*', { count: 'exact', head: true })
      .eq('shop_id', profile.shop_id);

    const { count: unused } = await supabase
      .from('qr_codes')
      .select('*', { count: 'exact', head: true })
      .eq('shop_id', profile.shop_id)
      .eq('status', 'unused');

    const { count: assigned } = await supabase
      .from('qr_codes')
      .select('*', { count: 'exact', head: true })
      .eq('shop_id', profile.shop_id)
      .eq('status', 'assigned');

    const { count: sold } = await supabase
      .from('qr_codes')
      .select('*', { count: 'exact', head: true })
      .eq('shop_id', profile.shop_id)
      .eq('status', 'sold');

    const { count: lost } = await supabase
      .from('qr_codes')
      .select('*', { count: 'exact', head: true })
      .eq('shop_id', profile.shop_id)
      .eq('status', 'lost');

    return {
      total: total || 0,
      unused: unused || 0,
      assigned: assigned || 0,
      sold: sold || 0,
      lost: lost || 0,
    };
  };

  const [stats, setStats] = useState({ total: 0, unused: 0, assigned: 0, sold: 0, lost: 0 });

  // Load stats separately
  useEffect(() => {
    if (profile?.shop_id) {
      getStats().then(setStats);
    }
  }, [profile?.shop_id, qrCodes]); // Reload stats when QR codes change

  // Keyboard navigation for pagination
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Only handle if not typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.key === 'ArrowLeft' && currentPage > 1) {
        goToPrevPage();
      } else if (e.key === 'ArrowRight' && currentPage < totalPages) {
        goToNextPage();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [currentPage, totalPages]);

  const startItem = totalCount === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalCount);

  if (loading) {
    return (
      <div className="space-y-4 md:space-y-6">
        {/* Header Skeleton */}
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 bg-muted animate-pulse rounded-md" />
          <div className="space-y-2">
            <div className="h-8 w-64 bg-muted animate-pulse rounded" />
            <div className="h-4 w-96 bg-muted animate-pulse rounded" />
          </div>
        </div>

        {/* Stats Skeleton */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <div className="h-4 w-20 bg-muted animate-pulse rounded mb-2" />
                <div className="h-8 w-16 bg-muted animate-pulse rounded" />
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <Button
          variant="ghost"
          onClick={() => router.push('/admin')}
          className="mb-2 -ml-2 text-teal-600 hover:text-teal-700 hover:bg-teal-50"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Dashboard
        </Button>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-teal-500 to-cyan-600 rounded-lg">
            <QrCodeIcon className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">QR Code Management</h1>
            <p className="text-sm text-muted-foreground">Generate and manage inventory QR codes</p>
          </div>
        </div>
      </div>

      {/* Stats - 2x2 mobile, 4 columns desktop */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <Card className="hover:shadow-lg transition-all cursor-pointer" onClick={() => setFilterStatus('all')}>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs">Total Codes</CardDescription>
            <CardTitle className="text-2xl">{stats.total}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="hover:shadow-lg transition-all cursor-pointer" onClick={() => setFilterStatus('unused')}>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs">Unused</CardDescription>
            <CardTitle className="text-2xl text-green-600">{stats.unused}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="hover:shadow-lg transition-all cursor-pointer" onClick={() => setFilterStatus('assigned')}>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs">Assigned</CardDescription>
            <CardTitle className="text-2xl text-blue-600">{stats.assigned}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="hover:shadow-lg transition-all cursor-pointer" onClick={() => setFilterStatus('sold')}>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs">Sold</CardDescription>
            <CardTitle className="text-2xl text-purple-600">{stats.sold}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Generate Form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Generate New QR Codes</CardTitle>
          <CardDescription>Bulk generate QR codes with managed prefixes</CardDescription>
        </CardHeader>
        <CardContent>
          {qrPrefixes.length === 0 ? (
            <div className="text-center p-8 border-2 border-dashed rounded-lg">
              <QrCodeIcon className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
              <p className="text-sm font-medium text-muted-foreground mb-2">No active QR prefixes found</p>
              <p className="text-xs text-muted-foreground mb-4">
                Create a QR prefix in Settings first before generating QR codes
              </p>
              <Button
                variant="outline"
                onClick={() => router.push('/admin/settings?tab=qr-prefixes')}
              >
                Go to Settings
              </Button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="prefixSelect" className="text-sm font-medium">QR Prefix *</Label>
                  <Select value={selectedPrefixId} onValueChange={setSelectedPrefixId}>
                    <SelectTrigger id="prefixSelect">
                      <SelectValue placeholder="Select prefix" />
                    </SelectTrigger>
                    <SelectContent>
                      {qrPrefixes.map((prefix) => (
                        <SelectItem key={prefix.id} value={prefix.id}>
                          <span className="font-mono font-bold">{prefix.prefix}</span>
                          {prefix.description && (
                            <span className="ml-2 text-muted-foreground text-xs">
                              ({prefix.description})
                            </span>
                          )}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Codes will be generated as {qrPrefixes.find(p => p.id === selectedPrefixId)?.prefix || 'PREFIX'}-0001, {qrPrefixes.find(p => p.id === selectedPrefixId)?.prefix || 'PREFIX'}-0002, ...
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="quantity" className="text-sm font-medium">Quantity *</Label>
                  <Input
                    id="quantity"
                    type="number"
                    value={quantity}
                    onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                    min={1}
                    max={9999}
                    placeholder="100"
                  />
                  <p className="text-xs text-muted-foreground">
                    Max 9999 codes per prefix
                  </p>
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <Button
                  onClick={handleGenerate}
                  disabled={generating || !selectedPrefixId}
                  className="bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-600 hover:to-cyan-700 hover:scale-105 active:scale-95 transition-all"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  {generating ? 'Generating...' : 'Generate'}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* QR Codes List */}
      <Card>
        <CardHeader>
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-lg">QR Codes</CardTitle>
                <CardDescription className="text-sm mt-1">
                  Total {totalCount} codes
                </CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                {selectedIds.size > 0 && (
                  <>
                    <Button 
                      onClick={() => {
                        const selectedCodes = qrCodes
                          .filter(qr => selectedIds.has(qr.id))
                          .map(qr => qr.code);
                        setDownloadCodes(selectedCodes);
                        setDownloadDialogOpen(true);
                      }}
                      variant="outline"
                      size="sm"
                      className="hover:scale-105 active:scale-95 transition-all"
                    >
                      <Printer className="mr-2 h-4 w-4" />
                      Print ({selectedIds.size})
                    </Button>
                    <Button 
                      onClick={handleBulkDelete}
                      disabled={isDeleting}
                      variant="destructive"
                      size="sm"
                      className="hover:scale-105 active:scale-95 transition-all"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete ({selectedIds.size})
                    </Button>
                  </>
                )}
                {filterStatus === 'unused' && (
                  <Button 
                    onClick={handleDeleteAllUnused}
                    disabled={isDeleting}
                    variant="outline"
                    size="sm"
                    className="hover:scale-105 active:scale-95 transition-all text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete All Unused
                  </Button>
                )}
                <Button 
                  onClick={() => {
                    // Get all codes on current page for download
                    const codesToDownload = qrCodes.map(qr => qr.code);
                    if (codesToDownload.length === 0) {
                      toast.error('No QR codes to download');
                      return;
                    }
                    setDownloadCodes(codesToDownload);
                    setDownloadDialogOpen(true);
                  }} 
                  variant="outline"
                  size="sm"
                  className="hover:scale-105 active:scale-95 transition-all"
                >
                  <Printer className="mr-2 h-4 w-4" />
                  Print Page
                </Button>
                <Button 
                  onClick={() => {
                    setDownloadCodes([]);
                    setDownloadDialogOpen(true);
                  }}
                  variant="outline"
                  size="sm"
                  className="hover:scale-105 active:scale-95 transition-all text-teal-600 hover:text-teal-700 hover:bg-teal-50"
                >
                  <Sparkles className="mr-2 h-4 w-4" />
                  Print Custom
                </Button>
                <Button 
                  onClick={exportQrCodes} 
                  variant="outline"
                  size="sm"
                  className="hover:scale-105 active:scale-95 transition-all"
                >
                  <Download className="mr-2 h-4 w-4" />
                  Export CSV
                </Button>
              </div>
            </div>

            {/* Filters */}
            <div className="flex flex-col gap-3">
              {/* Search */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search QR codes..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 text-sm"
                />
              </div>
              
              {/* Status Tabs */}
              <Tabs value={filterStatus} onValueChange={(v) => setFilterStatus(v as QrStatus | 'all')}>
                <TabsList className="grid w-full grid-cols-5 h-auto">
                  <TabsTrigger value="all" className="text-xs md:text-sm">All</TabsTrigger>
                  <TabsTrigger value="unused" className="text-xs md:text-sm">Unused</TabsTrigger>
                  <TabsTrigger value="assigned" className="text-xs md:text-sm">Assigned</TabsTrigger>
                  <TabsTrigger value="sold" className="text-xs md:text-sm">Sold</TabsTrigger>
                  <TabsTrigger value="lost" className="text-xs md:text-sm">Lost</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-4 sm:px-6">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[500px]">
              <thead>
                <tr className="border-b">
                  {hasUnusedCodes && (
                    <th className="text-left py-2 px-3 lg:px-4 w-12">
                      <Checkbox
                        checked={unusedCodesOnPage.length > 0 && selectedIds.size === unusedCodesOnPage.length}
                        onCheckedChange={toggleSelectAll}
                        aria-label="Select all unused codes on this page"
                      />
                    </th>
                  )}
                  <SortableHeader 
                    column="code" 
                    sortBy={sortBy} 
                    sortOrder={sortOrder} 
                    onSort={toggleSort} 
                    className="min-w-[120px] w-[35%]"
                  >
                    Code
                  </SortableHeader>
                  <SortableHeader column="status" sortBy={sortBy} sortOrder={sortOrder} onSort={toggleSort}>
                    Status
                  </SortableHeader>
                  <SortableHeader column="created_at" sortBy={sortBy} sortOrder={sortOrder} onSort={toggleSort}>
                    Created
                  </SortableHeader>
                  <th className="text-right py-2 px-3 lg:px-4 text-sm font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {qrCodes.length === 0 ? (
                  <tr>
                    <td colSpan={hasUnusedCodes ? 5 : 4} className="text-center p-8 text-muted-foreground">
                      <div className="flex flex-col items-center gap-2">
                        <QrCodeIcon className="h-12 w-12 text-muted-foreground/50" />
                        <p className="text-sm">No QR codes found</p>
                        {searchTerm && (
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => setSearchTerm('')}
                            className="hover:scale-105 active:scale-95 transition-all"
                          >
                            Clear search
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  qrCodes.map((qr) => (
                    <tr key={qr.id} className="border-b hover:bg-muted/50 transition-colors">
                      {hasUnusedCodes && (
                        <td className="py-2 px-3 lg:px-4">
                          {qr.status === 'unused' && (
                            <Checkbox
                              checked={selectedIds.has(qr.id)}
                              onCheckedChange={() => toggleSelection(qr.id)}
                              aria-label={`Select ${qr.code}`}
                            />
                          )}
                        </td>
                      )}
                      <td className="py-2 px-3 lg:px-4 font-mono font-medium text-sm break-words max-w-[150px]">{qr.code}</td>
                      <td className="py-2 px-3 lg:px-4">
                        <Badge
                          variant={
                            qr.status === 'unused'
                              ? 'default'
                              : qr.status === 'assigned'
                              ? 'secondary'
                              : qr.status === 'sold'
                              ? 'outline'
                              : 'destructive'
                          }
                          className="text-xs"
                        >
                          {qr.status}
                        </Badge>
                      </td>
                      <td className="py-2 px-3 lg:px-4 text-sm text-muted-foreground">
                        {new Date(qr.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-2 px-3 lg:px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {/* Download button - always visible */}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => downloadQrCode(qr.code)}
                            className="hover:bg-teal-50 hover:text-teal-600"
                            title="Download QR code"
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          {qr.status === 'unused' ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(qr)}
                              className="hover:bg-red-50 hover:text-red-600"
                              title="Delete QR code"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleViewDetails(qr)}
                              className="hover:bg-blue-50 hover:text-blue-600"
                              title="View details"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          
          {/* Pagination Controls */}
          {totalCount > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-4 pt-4 border-t">
              <div className="flex items-center gap-4">
                <div className="text-sm text-muted-foreground">
                  Showing {startItem} to {endItem} of <span className="font-semibold">{totalCount}</span>
                </div>
                <div className="flex items-center gap-2 ">
                  <Label htmlFor="itemsPerPage" className="text-xs text-muted-foreground whitespace-nowrap">
                    Per page:
                  </Label>
                  <Select
                    value={itemsPerPage.toString()}
                    onValueChange={(value) => {
                      setItemsPerPage(parseInt(value));
                      setCurrentPage(1); // Reset to first page when changing items per page
                    }}
                  >
                    <SelectTrigger className="w-20 h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="25">25</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                      <SelectItem value="100">100</SelectItem>
                      <SelectItem value="200">200</SelectItem>
                      <SelectItem value="500">500</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  title="First page"
                >
                  <ChevronFirst className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={goToPrevPage}
                  disabled={currentPage === 1}
                  title="Previous page"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm font-medium px-3 min-w-[100px] text-center">
                  {currentPage} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={goToNextPage}
                  disabled={currentPage === totalPages}
                  title="Next page"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  title="Last page"
                >
                  <ChevronLast className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* QR Code Details Dialog */}
      <QrCodeDetailsDialog 
        qrCode={viewingQrCode} 
        onClose={() => setViewingQrCode(null)} 
      />

      {/* Confirmation Dialog */}
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

      {/* QR Code Download/Print Dialog */}
      <QrCodeDownloadDialog
        open={downloadDialogOpen}
        onOpenChange={setDownloadDialogOpen}
        codes={downloadCodes}
        prefixes={qrPrefixes}
        title={`Print / Download QR Codes`}
      />
    </div>
  );
}
