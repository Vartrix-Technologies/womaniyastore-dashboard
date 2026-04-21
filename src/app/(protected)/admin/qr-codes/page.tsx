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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { CountUp } from '@/components/shared/CountUp';
import { QrCodeDetailsDialog } from '@/components/shared/QrCodeDetailsDialog';
import { PickerDialog } from '@/components/shared/PickerDialog';
import { QrCodeDownloadDialog } from '@/components/shared/QrCodeDownloadDialog';
import { downloadQrCode } from '@/components/shared/QrCodeCard';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { toast } from 'sonner';
import Link from 'next/link';
import { QrCode as QrCodeIcon, Plus, Download, Search, ArrowLeft, Trash2, RefreshCw, Eye, Printer, Tags, Filter, CircleOff, ChevronDown, Settings, Settings2, ChevronsUpDown } from 'lucide-react';
import { exportToCSV } from '@/lib/utils';
import { useServerPagination, useSortableTable, useDebouncedSearch, useDateFilter } from '@/hooks';
import { DateRangeFilter } from '@/components/shared/DateRangeFilter';
import { SortableHeader } from '@/components/shared/SortableHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { PaginationControls } from '@/components/shared/PaginationControls';
import { FilterChips, type FilterChip } from '@/components/shared/FilterChips';
import type { Database } from '@/types/database.types';
import type { QrPrefix } from '@/types';
import { fetchActiveQrPrefixes } from '@/lib/api/qr-prefixes';
import { appConfig } from '@/lib/config/app.config';
import { getCachedStats, setCachedStats } from '@/lib/utils/stats-cache';

const s = appConfig.styles;
const a = s.accent;

type QrCode = Database['public']['Tables']['qr_codes']['Row'];
type QrStatus = Database['public']['Enums']['qr_status'];

export default function QrCodesPage() {
  const router = useRouter();
  const { profile } = useAuth();
  const [qrCodes, setQrCodes] = useState<QrCode[]>([]);
  const [qrPrefixes, setQrPrefixes] = useState<QrPrefix[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [tableLoading, setTableLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const { searchTerm, debouncedSearchTerm, setSearchTerm } = useDebouncedSearch({ delay: 500 });
  const { dateFilter, setDateFilter, customRange, setCustomRange, startDateISO, endDateISO } = useDateFilter({ initialFilter: 'month' });
  const [filterStatus, setFilterStatus] = useState<QrStatus | 'all'>('all');
  const [filterPrefix, setFilterPrefix] = useState<string>('all');
  const [totalCount, setTotalCount] = useState(0);
  const {
    currentPage,
    itemsPerPage,
    setCurrentPage,
    setItemsPerPage,
    from,
    to,
    totalPages,
    startItem,
    endItem,
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
  const [refreshKey, setRefreshKey] = useState(0);
  const triggerRefresh = () => setRefreshKey(k => k + 1);

  // Confirmation dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    confirmText?: string;
    variant?: 'default' | 'destructive';
    onConfirm: () => void;
  }>({ open: false, title: '', description: '', onConfirm: () => { } });

  // Download dialog state
  const [downloadDialogOpen, setDownloadDialogOpen] = useState(false);
  const [downloadCodes, setDownloadCodes] = useState<string[]>([]);

  // Generation form
  const [generateOpen, setGenerateOpen] = useState(false);
  const [prefixPickerOpen, setPrefixPickerOpen] = useState(false);
  const [selectedPrefixId, setSelectedPrefixId] = useState<string>('');
  const [quantity, setQuantity] = useState<string>('');

  useEffect(() => {
    async function loadQrCodes() {
      try {
        if (!profile?.shop_id) {
          setInitialLoading(false);
          return;
        }

        setTableLoading(true);

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

        // Apply prefix filter
        if (filterPrefix !== 'all') {
          const matchingPrefix = qrPrefixes.find(p => p.prefix === filterPrefix);
          if (matchingPrefix) {
            query = query.eq('prefix_id', matchingPrefix.id);
          }
        }

        // Apply search filter
        if (debouncedSearchTerm) {
          query = query.ilike('code', `%${debouncedSearchTerm}%`);
        }

        // Apply date filter
        if (startDateISO) {
          query = query.gte('created_at', startDateISO);
        }
        if (dateFilter !== 'year') {
          query = query.lte('created_at', endDateISO);
        }

        // Fetch only the current page (from/to come from useServerPagination hook)
        const { data, error, count } = await query
          .order(sortBy, { ascending: sortOrder === 'asc' })
          .range(from, to);

        if (error) throw error;

        setQrCodes(data || []);
        setTotalCount(count || 0);
      } catch (error) {
        console.error('Error loading QR codes:', error);
        toast.error('Failed to load QR codes');
      } finally {
        setInitialLoading(false);
        setTableLoading(false);
      }
    }

    loadQrCodes();
  }, [profile?.shop_id, currentPage, itemsPerPage, debouncedSearchTerm, filterStatus, filterPrefix, dateFilter, customRange, sortBy, sortOrder, refreshKey]);

  // Clear selection when page/filters change
  useEffect(() => {
    setSelectedIds(new Set());
  }, [currentPage, itemsPerPage, debouncedSearchTerm, filterStatus, filterPrefix, dateFilter, customRange]);

  const formatCodeRange = (first: string, last: string) => (
    <span>
      Range: {first.slice(0, -4)}<strong>{first.slice(-4)}</strong> to {last.slice(0, -4)}<strong>{last.slice(-4)}</strong>
    </span>
  );

  const handleGenerate = async () => {
    if (!profile?.shop_id) {
      toast.error('Shop ID not found. Please log in again.');
      return;
    }

    if (!selectedPrefixId) {
      toast.error('Please select a QR prefix');
      return;
    }

    const qty = parseInt(quantity);
    if (isNaN(qty) || qty < 1 || qty > 9999) {
      toast.error('Quantity must be between 1 and 9999');
      return;
    }

    try {
      setGenerating(true);
      const selectedPrefix = qrPrefixes.find(p => p.id === selectedPrefixId);
      const BATCH_SIZE = 500;

      if (qty <= BATCH_SIZE) {
        // Single batch — call RPC once
        const { data, error } = await (supabase.rpc as any)('generate_qr_codes_with_prefix', {
          p_shop_id: profile.shop_id,
          p_prefix_id: selectedPrefixId,
          p_quantity: qty,
        });

        if (error) {
          if (error.message?.includes('exceeds')) {
            throw new Error(`Cannot generate ${qty} codes. Sequence limit (9999) would be exceeded for prefix ${selectedPrefix?.prefix}.`);
          }
          throw error;
        }

        let firstCode: string | undefined;
        let lastCode: string | undefined;
        if (Array.isArray(data) && data.length > 0) {
          firstCode = data[0]?.qr_code;
          lastCode = data[data.length - 1]?.qr_code;
        }

        toast.success(
          `Generated ${qty} QR codes with prefix ${selectedPrefix?.prefix}!`,
          {
            description: firstCode && lastCode ? formatCodeRange(firstCode, lastCode) : undefined,
            duration: 4000
          }
        );
      } else {
        // Chunked generation for large batches
        const batches = Math.ceil(qty / BATCH_SIZE);
        let generated = 0;
        let firstCode: string | undefined;
        let lastCode: string | undefined;

        for (let i = 0; i < batches; i++) {
          const batchSize = Math.min(BATCH_SIZE, qty - generated);
          toast.loading(`Generating batch ${i + 1}/${batches} (${generated}/${qty})...`, { id: 'qr-gen-progress' });

          const { data, error } = await (supabase.rpc as any)('generate_qr_codes_with_prefix', {
            p_shop_id: profile.shop_id,
            p_prefix_id: selectedPrefixId,
            p_quantity: batchSize,
          });

          if (error) {
            toast.dismiss('qr-gen-progress');
            if (error.message?.includes('exceeds')) {
              throw new Error(`Batch ${i + 1} failed. Sequence limit (9999) would be exceeded for prefix ${selectedPrefix?.prefix}. ${generated} codes were generated successfully.`);
            }
            throw new Error(`Batch ${i + 1} failed: ${error.message}. ${generated} codes were generated before the error.`);
          }

          if (Array.isArray(data) && data.length > 0) {
            if (!firstCode) firstCode = data[0]?.qr_code;
            lastCode = data[data.length - 1]?.qr_code;
          }
          generated += batchSize;
        }

        toast.dismiss('qr-gen-progress');
        toast.success(
          `Generated ${generated} QR codes with prefix ${selectedPrefix?.prefix}!`,
          {
            description: firstCode && lastCode ? formatCodeRange(firstCode, lastCode) : undefined,
            duration: 4000
          }
        );
      }

      // Clear quantity input and reset to first page to see new codes
      setQuantity('');
      setCurrentPage(1);
      triggerRefresh();
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

  const handleDelete = (qrCode: QrCode) => {
    if (qrCode.status !== 'unused') {
      toast.error('Only unused QR codes can be deleted');
      return;
    }

    // Optimistic delete — remove from UI immediately
    const previousQrCodes = qrCodes;
    const previousTotalCount = totalCount;
    const previousStats = stats;

    setQrCodes(prev => prev.filter(q => q.id !== qrCode.id));
    setTotalCount(prev => Math.max(0, prev - 1));
    setStats(prev => ({ ...prev, total: prev.total - 1, unused: prev.unused - 1 }));
    setSelectedIds(prev => { const n = new Set(prev); n.delete(qrCode.id); return n; });

    const undoDelete = () => {
      setQrCodes(previousQrCodes);
      setTotalCount(previousTotalCount);
      setStats(previousStats);
    };

    const doDelete = async () => {
      try {
        const { error } = await supabase
          .from('qr_codes')
          .delete()
          .eq('id', qrCode.id);

        if (error) throw error;
      } catch (error: any) {
        console.error('Error deleting QR code:', error);
        undoDelete();
        toast.error(error.message || 'Failed to delete QR code. Reverted.');
      }
    };

    toast('QR code deleted', {
      description: `"${qrCode.code}" removed`,
      action: { label: 'Undo', onClick: undoDelete },
      duration: 6000,
      onAutoClose: () => doDelete(),
      onDismiss: () => doDelete(),
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
          triggerRefresh();
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
          triggerRefresh();
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

  const handleMarkAsLost = async (qrCode: QrCode) => {
    setConfirmDialog({
      open: true,
      title: 'Mark QR Code as Lost',
      description: `Mark "${qrCode.code}" as lost? Lost codes cannot be reassigned.`,
      confirmText: 'Mark as Lost',
      variant: 'default',
      onConfirm: async () => {
        try {
          const { error } = await supabase
            .from('qr_codes')
            .update({ status: 'lost' as QrStatus })
            .eq('id', qrCode.id);

          if (error) throw error;

          toast.success(`${qrCode.code} marked as lost`);
          // Refresh table + stats
          triggerRefresh();
        } catch (error: any) {
          console.error('Error marking as lost:', error);
          toast.error(error.message || 'Failed to update status');
        }
      },
    });
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

      if (filterPrefix !== 'all') {
        const matchingPrefix = qrPrefixes.find(p => p.prefix === filterPrefix);
        if (matchingPrefix) {
          query = query.eq('prefix_id', matchingPrefix.id);
        }
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

  // Calculate stats with parallel count queries — zero rows transferred
  const getStats = async () => {
    if (!profile?.shop_id) return null;

    try {
      const shopId = profile.shop_id;
      const countQuery = (status?: QrStatus) => {
        let q = supabase.from('qr_codes').select('*', { count: 'exact', head: true }).eq('shop_id', shopId);
        if (status) q = q.eq('status', status);
        return q;
      };

      const [totalRes, unusedRes, assignedRes, soldRes, lostRes] = await Promise.all([
        countQuery(),
        countQuery('unused'),
        countQuery('assigned'),
        countQuery('sold'),
        countQuery('lost'),
      ]);

      // Only return new stats if all queries succeeded (stale-while-revalidate)
      if (totalRes.error || unusedRes.error || assignedRes.error || soldRes.error || lostRes.error) {
        return null; // Keep previous values
      }

      return {
        total: totalRes.count ?? 0,
        unused: unusedRes.count ?? 0,
        assigned: assignedRes.count ?? 0,
        sold: soldRes.count ?? 0,
        lost: lostRes.count ?? 0,
      };
    } catch (error) {
      // Network error / offline — keep showing previous stats
      console.warn('QR stats fetch failed — keeping previous values:', error);
      return null;
    }
  };

  const [stats, setStats] = useState(() => getCachedStats('qr_stats', { total: 0, unused: 0, assigned: 0, sold: 0, lost: 0 }));

  // Load stats separately — only on shop change or explicit refresh
  // Uses stale-while-revalidate: only updates if fetch returns valid data
  useEffect(() => {
    if (profile?.shop_id) {
      getStats().then(newStats => {
        if (newStats) {
          setStats(newStats);
          setCachedStats('qr_stats', newStats);
        }
      });
    }
  }, [profile?.shop_id, refreshKey]); // Reload stats on explicit refresh (after generate/delete)

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

  // Build filter chips for active filters
  const filterChips: FilterChip[] = [];
  if (filterStatus !== 'all') filterChips.push({ label: 'Status', value: filterStatus, onClear: () => { setFilterStatus('all'); setCurrentPage(1); }, className: 'capitalize' });
  if (filterPrefix !== 'all') filterChips.push({ label: 'Prefix', value: filterPrefix, onClear: () => { setFilterPrefix('all'); setCurrentPage(1); }, className: 'font-mono' });
  if (dateFilter !== 'year' && dateFilter !== 'custom') filterChips.push({ label: 'Date', value: dateFilter, onClear: () => { setDateFilter('year'); setCurrentPage(1); }, className: 'capitalize' });

  if (initialLoading) {
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
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-2 md:gap-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="rounded-lg border p-3 md:p-4 animate-pulse">
              <div className="h-3 w-12 bg-muted rounded mb-2" />
              <div className="h-7 w-10 bg-muted rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6 animate-content-in pb-24">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.push('/admin')} className="relative group shrink-0">
          <div className={`p-2.5 rounded-lg ${s.headerIconGradient} text-white shadow-md group-hover:shadow-lg transition-shadow`}>
            <QrCodeIcon className="h-6 w-6" />
          </div>
          <div className="absolute -left-1.5 -top-1.5 bg-background border rounded-full p-1 shadow-sm group-hover:scale-110 transition-transform">
            <ArrowLeft className="h-3 w-3 text-muted-foreground" />
          </div>
        </button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">QR Code Management</h1>
          <p className="text-sm text-muted-foreground">Generate and manage inventory QR codes</p>
        </div>
      </div>

      {/* Generate Form — collapsible */}
      <Collapsible open={generateOpen} onOpenChange={setGenerateOpen}>
        <Card>
          <CardHeader className="py-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <CollapsibleTrigger className="flex items-center justify-between flex-1 text-left cursor-pointer select-none hover:opacity-75 transition-opacity">
                <div>
                  <CardTitle className="text-lg">Generate New QR Codes</CardTitle>
                  <CardDescription>Bulk generate QR codes with managed prefixes</CardDescription>
                </div>
                <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform duration-200 mr-2 ${generateOpen ? 'rotate-180' : ''}`} />
              </CollapsibleTrigger>
              <Button
                onClick={() => {
                  const codesToDownload = qrCodes.map(qr => qr.code);
                  setDownloadCodes(codesToDownload);
                  setDownloadDialogOpen(true);
                }}
                variant="outline"
                size="sm"
                className={`${s.linkColor} ${s.linkHover} shrink-0 w-full sm:w-auto`}
              >
                <Printer className="mr-1.5 h-3.5 w-3.5" />
                Print QR Codes
              </Button>
            </div>
          </CardHeader>
          <CollapsibleContent>
            <CardContent>
              {qrPrefixes.length === 0 ? (
                <EmptyState
                  icon={QrCodeIcon}
                  title="No active QR prefixes found"
                  description="Create a QR prefix in Settings first before generating QR codes"
                  className="border-2 border-dashed rounded-lg"
                  action={
                    <Button
                      variant="outline"
                      onClick={() => router.push('/settings?tab=qr-prefixes')}
                    >
                      Go to Settings
                    </Button>
                  }
                />
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-medium">QR Prefix *</Label>
                        <Link href="/settings?tab=qr-prefixes" className="text-xs text-muted-foreground hover:text-foreground hover:underline flex items-center gap-1">
                          <Settings2 className="h-3 w-3" /> Manage
                        </Link>
                      </div>
                      <Button
                        variant="outline"
                        className="w-full justify-between font-normal"
                        onClick={() => setPrefixPickerOpen(true)}
                      >
                        {selectedPrefixId ? (
                          <span>
                            <span className="font-mono font-bold">
                              {qrPrefixes.find(p => p.id === selectedPrefixId)?.prefix}
                            </span>
                            {qrPrefixes.find(p => p.id === selectedPrefixId)?.description && (
                              <span className="ml-2 text-muted-foreground text-xs">
                                ({qrPrefixes.find(p => p.id === selectedPrefixId)?.description})
                              </span>
                            )}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">Select prefix...</span>
                        )}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                      <PickerDialog
                        open={prefixPickerOpen}
                        onOpenChange={setPrefixPickerOpen}
                        title="Select QR Prefix"
                        searchPlaceholder="Search prefixes..."
                        items={qrPrefixes.map(p => ({ id: p.id, label: p.prefix, sublabel: p.description || undefined, mono: true }))}
                        selectedId={selectedPrefixId}
                        onSelect={(id) => setSelectedPrefixId(id)}
                      />
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
                        onChange={(e) => setQuantity(e.target.value)}
                        min={1}
                        max={9999}
                        placeholder="Enter quantity (1-9999)"
                      />
                      <p className="text-xs text-muted-foreground">
                        Max 9999 codes per prefix
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-4">
                    <Button
                      onClick={handleGenerate}
                      disabled={generating || !selectedPrefixId || !quantity}
                      className={`${s.primaryGradient} ${s.primaryGradientHover} ${s.btnAnimation}`}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      {generating ? 'Generating...' : 'Generate'}
                    </Button>
                    {/* <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs text-muted-foreground"
                      onClick={() => router.push('/settings?tab=qr-prefixes')}
                    >
                      <Settings className="mr-1 h-3.5 w-3.5" />
                      Manage Prefixes
                    </Button> */}
                  </div>
                </>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Stats Overview — clickable toggles that filter the table */}
      <div className="space-y-1.5">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 md:gap-3">
          {([
            { key: 'all' as const, label: 'Total', value: stats.total, activeClass: `${s.statsActive.total.border} ${s.statsActive.total.bg}`, textColor: '' },
            { key: 'unused' as const, label: 'Unused', value: stats.unused, activeClass: `${s.statsActive.unused.border} ${s.statsActive.unused.bg}`, textColor: s.statsActive.unused.text },
            { key: 'assigned' as const, label: 'Assigned', value: stats.assigned, activeClass: `${s.statsActive.assigned.border} ${s.statsActive.assigned.bg}`, textColor: s.statsActive.assigned.text },
            { key: 'sold' as const, label: 'Sold', value: stats.sold, activeClass: `${s.statsActive.purple.border} ${s.statsActive.purple.bg}`, textColor: s.statsActive.purple.text },
            { key: 'lost' as const, label: 'Lost', value: stats.lost, activeClass: `${s.statsActive.lost.border} ${s.statsActive.lost.bg}`, textColor: s.statsActive.lost.text },
          ]).map(({ key, label, value, activeClass, textColor }) => {
            const isActive = filterStatus === key;
            const anyFilterActive = filterStatus !== 'all';
            return (
              <button
                key={key}
                onClick={() => {
                  setFilterStatus(isActive && key !== 'all' ? 'all' : key);
                  setCurrentPage(1);
                }}
                className={`rounded-lg border p-3 md:p-4 text-left transition-all ${isActive
                  ? `border-l-4 shadow-sm ${activeClass}`
                  : anyFilterActive
                    ? 'opacity-50 hover:opacity-80 hover:bg-muted/50'
                    : 'hover:shadow-md hover:bg-muted/50'
                  } cursor-pointer`}
              >
                <div className="text-xs text-muted-foreground">{label}</div>
                <div className={`text-2xl font-bold ${textColor}`}><CountUp end={value} /></div>
              </button>
            );
          })}
        </div>
        <p className="text-[11px] text-muted-foreground/60 pl-1">
          <Filter className="inline h-3 w-3 mr-0.5 -mt-0.5" />
          Click a metric to filter the table below
        </p>
      </div>

      {/* QR Codes List */}
      <Card>
        <CardHeader className="pb-3">
          <div className="space-y-4">
            {/* Title row + CSV — always visible on all screen sizes */}
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="text-lg">QR Codes</CardTitle>
                <CardDescription className="text-sm mt-0.5">
                  {totalCount} codes{filterPrefix !== 'all' ? ` in ${filterPrefix}` : ''}{filterStatus !== 'all' ? ` (${filterStatus})` : ''}
                </CardDescription>
              </div>
              <Button
                onClick={exportQrCodes}
                variant="outline"
                size="sm"
                className="shrink-0"
              >
                <Download className="mr-1.5 h-3.5 w-3.5" />
                CSV
              </Button>
            </div>

            {/* Conditional selection / bulk-delete actions */}
            {(selectedIds.size > 0 || (filterStatus === 'unused' && selectedIds.size === 0)) && (
              <div className="flex flex-wrap items-center gap-2">
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
                    >
                      <Printer className="mr-1.5 h-3.5 w-3.5" />
                      Print ({selectedIds.size})
                    </Button>
                    <Button
                      onClick={handleBulkDelete}
                      disabled={isDeleting}
                      variant="destructive"
                      size="sm"
                    >
                      <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                      Delete ({selectedIds.size})
                    </Button>
                  </>
                )}
                {filterStatus === 'unused' && selectedIds.size === 0 && (
                  <Button
                    onClick={handleDeleteAllUnused}
                    disabled={isDeleting}
                    variant="outline"
                    size="sm"
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                    Delete All Unused
                  </Button>
                )}
              </div>
            )}

            {/* Filters row — search + prefix dropdown */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1 min-w-0">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search QR codes..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 text-sm"
                />
              </div>
              {qrPrefixes.length > 0 && (
                <Select value={filterPrefix} onValueChange={(v) => { setFilterPrefix(v); setCurrentPage(1); }}>
                  <SelectTrigger className="w-full sm:w-[180px]">
                    <div className="flex items-center gap-1.5">
                      <Tags className="h-3.5 w-3.5 text-muted-foreground" />
                      <SelectValue placeholder="All prefixes" />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Prefixes</SelectItem>
                    {qrPrefixes.map((p) => (
                      <SelectItem key={p.id} value={p.prefix}>
                        <span className="font-mono font-medium">{p.prefix}</span>
                        {p.description && (
                          <span className="ml-1.5 text-muted-foreground text-xs">({p.description})</span>
                        )}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              
            </div>

            {/* Date Range Filter */}
            <DateRangeFilter
              value={dateFilter}
              onChange={setDateFilter}
              customRange={customRange}
              onCustomRangeChange={setCustomRange}
            />

            <FilterChips
              chips={filterChips}
              onClearAll={() => { setFilterStatus('all'); setFilterPrefix('all'); setDateFilter('year'); setCurrentPage(1); }}
            />
          </div>
        </CardHeader>
        <CardContent className="px-4 sm:px-6">
          <div className="overflow-x-auto relative">
            {/* Subtle loading overlay — keeps table visible */}
            {tableLoading && (
              <div className="absolute inset-0 bg-background/60 z-10 flex items-center justify-center rounded-md">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Loading…
                </div>
              </div>
            )}
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
                  <EmptyState
                    icon={QrCodeIcon}
                    title="No QR codes found"
                    colSpan={hasUnusedCodes ? 5 : 4}
                    action={searchTerm ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSearchTerm('')}
                        className={s.btnAnimation}
                      >
                        Clear search
                      </Button>
                    ) : undefined}
                  />
                ) : (
                  qrCodes.map((qr, idx) => {
                    const bgClass = s.rowTint[qr.status as keyof typeof s.rowTint] || '';
                    return (
                      <tr key={qr.id} className={`border-b hover:bg-muted/50 transition-colors animate-stagger-fade-in ${bgClass}`} style={{ '--row-index': idx } as React.CSSProperties}>
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
                        <td className="py-2 px-3 lg:px-4">
                          {qr.status !== 'unused' ? (
                            <button
                              onClick={() => handleViewDetails(qr)}
                              className="cursor-pointer hover:opacity-80 transition-opacity"
                              title="View details"
                            >
                              <Badge variant="outline" className={`font-mono ${a.hoverBg} ${a.hoverBorder}`}>
                                {qr.code}
                              </Badge>
                            </button>
                          ) : (
                            <span className="font-mono font-medium text-sm break-words max-w-[150px]">{qr.code}</span>
                          )}
                        </td>
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
                              className={`${s.linkHover}`}
                              title="Download QR code"
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                            {(qr.status === 'unused' || qr.status === 'assigned') && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleMarkAsLost(qr)}
                                className="hover:bg-orange-50 hover:text-orange-600"
                                title="Mark as lost"
                              >
                                <CircleOff className="h-4 w-4" />
                              </Button>
                            )}
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
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <PaginationControls
            currentPage={currentPage}
            totalPages={totalPages}
            totalCount={totalCount}
            startItem={startItem}
            endItem={endItem}
            itemsPerPage={itemsPerPage}
            onPageChange={setCurrentPage}
            onItemsPerPageChange={(size) => { setItemsPerPage(size); setCurrentPage(1); }}
          />

          {/* Row tint legend */}
          <div className="flex items-center gap-4 flex-wrap text-xs text-muted-foreground pt-3 border-t mt-3">
            <span className="font-medium">Row colors:</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-2 rounded-sm bg-gradient-to-r from-gray-200 to-gray-50 border-l-2 border-l-gray-400" /> Unused</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-2 rounded-sm bg-gradient-to-r from-amber-200 to-amber-50 border-l-2 border-l-amber-500" /> Assigned</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-2 rounded-sm bg-gradient-to-r from-blue-200 to-blue-50 border-l-2 border-l-blue-500" /> Sold</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-2 rounded-sm bg-gradient-to-r from-red-200 to-red-50 border-l-2 border-l-red-500" /> Lost</span>
          </div>
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
        confirmText={confirmDialog.confirmText || 'Delete'}
        cancelText="Cancel"
        variant={confirmDialog.variant || 'destructive'}
      />

      {/* QR Code Download/Print Dialog */}
      <QrCodeDownloadDialog
        open={downloadDialogOpen}
        onOpenChange={setDownloadDialogOpen}
        codes={downloadCodes}
        prefixes={qrPrefixes}
        title="Print QR Codes"
      />
    </div>
  );
}
