'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { ListChecks, Plus, Edit, Trash2, GripVertical, X, BarChart3, Calendar, Loader2, ArrowLeft, Search, ChevronUp, ChevronDown, User, Clock } from 'lucide-react';
import { Reorder, useDragControls } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { useDebouncedSearch } from '@/hooks';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { EmptyState } from '@/components/shared/EmptyState';
import { FilterChips, type FilterChip } from '@/components/shared/FilterChips';
import { StatsCardGrid } from '@/components/shared/StatsCardGrid';
import { CountUp } from '@/components/shared/CountUp';
import { Skeleton } from '@/components/ui/skeleton';
import {
  createChecklistTemplate,
  updateChecklistTemplate,
  deleteChecklistTemplate,
  getChecklistTemplates,
  addChecklistItem,
  deleteChecklistItem,
  reorderChecklistItems,
  createChecklistInstances,
  getChecklistCompletionHistory,
  getChecklistStats,
  type ChecklistTemplate,
  type ChecklistItem,
  type ChecklistCompletionHistoryItem,
  type ChecklistStats,
} from '@/lib/api/checklists-v2';
import { FieldError, fieldErrorClass, useFormErrors } from '@/components/shared/FieldError';
import { TodayChecklistProgress } from '@/components/admin/TodayChecklistProgress';
import { appConfig } from '@/lib/config/app.config';

const s = appConfig.styles;
const a = s.accent;

interface ChecklistWithItems extends ChecklistTemplate {
  items: ChecklistItem[];
}

// ── Draggable checklist item used inside the Create/Edit dialog ──
function DraggableChecklistItem({
  item,
  index,
  totalItems,
  onMoveUp,
  onMoveDown,
  onRemove,
}: {
  item: { id: string; label: string; sort_order: number };
  index: number;
  totalItems: number;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
}) {
  const dragControls = useDragControls();

  return (
    <Reorder.Item
      value={item}
      dragListener={false}
      dragControls={dragControls}
      className="flex items-center gap-2 p-3 border rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors select-none"
      whileDrag={{
        scale: 1.02,
        boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
        backgroundColor: 'var(--color-background, #fff)',
        borderColor: s.brandHex.solidRgb,
        zIndex: 50,
      }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
    >
      {/* Drag handle */}
      <div
        className={`cursor-grab active:cursor-grabbing touch-none p-1 rounded ${s.linkHover} text-muted-foreground transition-colors`}
        onPointerDown={(e) => dragControls.start(e)}
      >
        <GripVertical className="h-4 w-4" />
      </div>

      {/* Chevron up/down for keyboard / accessibility */}
      <div className="flex flex-col shrink-0">
        <button
          type="button"
          className="h-7 w-7 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:pointer-events-none transition-colors"
          onClick={onMoveUp}
          disabled={index === 0}
          aria-label="Move item up"
        >
          <ChevronUp className="h-4 w-4" />
        </button>
        <button
          type="button"
          className="h-7 w-7 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:pointer-events-none transition-colors"
          onClick={onMoveDown}
          disabled={index === totalItems - 1}
          aria-label="Move item down"
        >
          <ChevronDown className="h-4 w-4" />
        </button>
      </div>

      {/* Item number & label */}
      <span className="text-sm font-medium text-muted-foreground min-w-[24px]">{index + 1}.</span>
      <span className="flex-1 text-sm">{item.label}</span>

      {/* Remove button */}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-8 w-8 p-0 hover:bg-red-50 hover:text-red-600 transition-all hover:scale-110 active:scale-95"
        onClick={onRemove}
        aria-label={`Remove ${item.label}`}
      >
        <X className="h-4 w-4" />
      </Button>
    </Reorder.Item>
  );
}

export default function ChecklistsManagementPage() {
  const { profile } = useAuth();
  const [checklists, setChecklists] = useState<ChecklistWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const { errors: clErrors, validateFields: validateChecklist, clearFieldError: clearClError } = useFormErrors<'name' | 'items' | 'recurrence_days'>();
  const { searchTerm, debouncedSearchTerm, setSearchTerm } = useDebouncedSearch({ delay: 300 });
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');

  // Confirm dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
  }>({ open: false, title: '', description: '', onConfirm: () => { } });

  // Dialog states
  const [checklistDialog, setChecklistDialog] = useState(false);
  const [editingChecklist, setEditingChecklist] = useState<ChecklistWithItems | null>(null);
  const [historyDialog, setHistoryDialog] = useState(false);
  const [selectedChecklistForHistory, setSelectedChecklistForHistory] = useState<ChecklistWithItems | null>(null);
  const [historyData, setHistoryData] = useState<ChecklistCompletionHistoryItem[]>([]);
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);
  const [stats, setStats] = useState<ChecklistStats | null>(null);

  // View mode dialog state
  const [viewDialog, setViewDialog] = useState(false);
  const [viewingChecklist, setViewingChecklist] = useState<ChecklistWithItems | null>(null);

  // Ref for scrolling to checklists grid after create
  const checklistsGridRef = useRef<HTMLDivElement>(null);

  // Form states
  const [checklistForm, setChecklistForm] = useState({
    name: '',
    description: '',
    is_active: true,
    recurrence_type: 'daily' as 'daily' | 'weekly' | 'once',
    recurrence_days: [1, 2, 3, 4, 5, 6] as number[], // Mon-Sat by default
  });

  const [items, setItems] = useState<{ id: string; label: string; sort_order: number }[]>([]);
  const [newItemLabel, setNewItemLabel] = useState('');

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  useEffect(() => {
    if (profile?.shop_id) {
      loadChecklists();
    } else if (profile !== undefined) {
      setLoading(false);
    }
  }, [profile?.shop_id]);

  const loadChecklists = async () => {
    if (!profile?.shop_id) return;

    try {
      setLoading(true);
      const data = await getChecklistTemplates(profile.shop_id);
      setChecklists(data as any as ChecklistWithItems[]);
    } catch (error) {
      console.error('Error loading checklists:', error);
      toast.error('Failed to load checklists');
    } finally {
      setLoading(false);
    }
  };

  const handleAddChecklist = () => {
    setEditingChecklist(null);
    setChecklistForm({
      name: '',
      description: '',
      is_active: true,
      recurrence_type: 'daily',
      recurrence_days: [1, 2, 3, 4, 5, 6],
    });
    setItems([]);
    setNewItemLabel('');
    setChecklistDialog(true);
  };

  const handleEditChecklist = (checklist: ChecklistWithItems) => {
    setEditingChecklist(checklist);
    setChecklistForm({
      name: checklist.name,
      description: checklist.description || '',
      is_active: checklist.is_active,
      // Normalize 'weekly' to 'daily' since both are now "Repeat"
      recurrence_type: checklist.recurrence_type === 'once' ? 'once' : 'daily',
      recurrence_days: checklist.recurrence_days,
    });
    setItems(checklist.items.map(item => ({ ...item, id: item.id || `temp-${Date.now()}` })));
    setNewItemLabel('');
    setChecklistDialog(true);
  };

  const handleAddItem = () => {
    if (!newItemLabel.trim()) {
      toast.error('Please enter an item label');
      return;
    }

    const newItem = {
      id: `temp-${Date.now()}-${Math.random()}`,
      label: newItemLabel,
      sort_order: items.length,
    };

    setItems([...items, newItem]);
    setNewItemLabel('');
  };

  const handleRemoveItem = (id: string) => {
    setItems(items.filter(item => item.id !== id));
  };

  const handleMoveItem = (index: number, direction: 'up' | 'down') => {
    const newItems = [...items];
    const newIndex = direction === 'up' ? index - 1 : index + 1;

    if (newIndex < 0 || newIndex >= newItems.length) return;

    [newItems[index], newItems[newIndex]] = [newItems[newIndex], newItems[index]];
    newItems.forEach((item, idx) => item.sort_order = idx);

    setItems(newItems);
  };

  const handleDragReorder = (reorderedItems: typeof items) => {
    const updated = reorderedItems.map((item, idx) => ({ ...item, sort_order: idx }));
    setItems(updated);
  };

  const handleToggleDay = (day: number) => {
    if (checklistForm.recurrence_days.includes(day)) {
      setChecklistForm({
        ...checklistForm,
        recurrence_days: checklistForm.recurrence_days.filter(d => d !== day),
      });
    } else {
      setChecklistForm({
        ...checklistForm,
        recurrence_days: [...checklistForm.recurrence_days, day].sort(),
      });
    }
  };

  const handleSaveChecklist = async () => {
    const valid = validateChecklist({
      name: [!profile?.shop_id || !checklistForm.name.trim(), 'Please enter a checklist name'],
      items: [items.length === 0, 'Please add at least one item'],
      recurrence_days: [checklistForm.recurrence_days.length === 0 && checklistForm.recurrence_type !== 'once', 'Please select at least one day'],
    });
    if (!valid) return;

    setSubmitting(true);
    try {
      if (editingChecklist) {
        // Update existing checklist
        await updateChecklistTemplate(editingChecklist.id, {
          name: checklistForm.name,
          description: checklistForm.description || undefined,
          is_active: checklistForm.is_active,
          recurrence_type: checklistForm.recurrence_type,
          recurrence_days: checklistForm.recurrence_days,
        });

        // Delete old items and create new ones
        for (const item of editingChecklist.items) {
          await deleteChecklistItem(item.id);
        }

        for (const item of items) {
          await addChecklistItem(editingChecklist.id, item.label, item.sort_order);
        }

        toast.success('Checklist updated successfully');
      } else if (profile?.shop_id) {
        // Create new checklist
        await createChecklistTemplate(
          profile.shop_id,
          profile.id,
          {
            name: checklistForm.name,
            description: checklistForm.description || undefined,
            is_active: checklistForm.is_active,
            recurrence_type: checklistForm.recurrence_type,
            recurrence_days: checklistForm.recurrence_days,
            items: items.map(item => ({ label: item.label, sort_order: item.sort_order })),
          }
        );

        toast.success('Checklist created successfully');
      }

      setChecklistDialog(false);
      await loadChecklists();
      // Scroll to checklists grid so the user sees the new/updated checklist
      setTimeout(() => {
        checklistsGridRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    } catch (error: any) {
      console.error('Error saving checklist:', error);
      toast.error(error.message || 'Failed to save checklist');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteChecklist = (id: string, name: string) => {
    setConfirmDialog({
      open: true,
      title: 'Delete Checklist',
      description: `Are you sure you want to delete "${name}"? This cannot be undone.`,
      onConfirm: async () => {
        try {
          await deleteChecklistTemplate(id);
          toast.success('Checklist deleted successfully');
          await loadChecklists();
        } catch (error: any) {
          console.error('Error deleting checklist:', error);
          toast.error(error.message || 'Failed to delete checklist');
        }
      },
    });
  };

  const handleCreateTodaysInstances = async () => {
    if (!profile?.shop_id) return;

    try {
      const today = new Date().toISOString().split('T')[0];
      const dayOfWeek = new Date().getDay();

      // First, clean up orphaned instances (instances where recurrence no longer matches)
      const { data: instances } = await supabase
        .from('checklist_instances' as any)
        .select('*, checklist:checklists!inner(recurrence_type, recurrence_days)')
        .eq('shop_id', profile.shop_id)
        .eq('date', today);

      if (instances) {
        const orphanedIds = instances
          .filter((inst: any) => {
            const template = inst.checklist;
            // Keep 'once' type instances
            if (template.recurrence_type === 'once') return false;
            // Remove if today is not in recurrence_days
            return !template.recurrence_days?.includes(dayOfWeek);
          })
          .map((inst: any) => inst.id);

        if (orphanedIds.length > 0) {
          await supabase
            .from('checklist_instances' as any)
            .delete()
            .in('id', orphanedIds);
        }
      }

      // Then create new instances
      await createChecklistInstances(profile.shop_id, today);
      toast.success('Today\'s checklists created successfully');
    } catch (error: any) {
      console.error('Error creating instances:', error);
      toast.error(error.message || 'Failed to create instances');
    }
  };

  const handleViewHistory = async (checklist: ChecklistWithItems) => {
    setSelectedChecklistForHistory(checklist);
    setHistoryDialog(true);

    try {
      const endDate = new Date().toISOString().split('T')[0];
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);
      const startDateStr = startDate.toISOString().split('T')[0];

      const [history, stats] = await Promise.all([
        getChecklistCompletionHistory(checklist.id, startDateStr, endDate),
        getChecklistStats(checklist.id, 30),
      ]);

      setHistoryData(history);
      setStats(stats);
    } catch (error) {
      console.error('Error loading history:', error);
      toast.error('Failed to load history');
    }
  };

  const handleViewChecklist = (checklist: ChecklistWithItems) => {
    setViewingChecklist(checklist);
    setViewDialog(true);
  };

  // Build filter chips for active filters
  const filterChips: FilterChip[] = [];
  if (filterStatus !== 'all') filterChips.push({ label: 'Status', value: filterStatus, onClear: () => setFilterStatus('all'), className: 'capitalize' });
  if (debouncedSearchTerm) filterChips.push({ label: 'Search', value: `"${debouncedSearchTerm}"`, onClear: () => setSearchTerm('') });

  if (loading) {
    return (
      <div className="space-y-4 md:space-y-6">
        {/* Header skeleton */}
        <div className="space-y-1">
          <Skeleton className="h-8 w-40 mb-2" />
          <div className="flex items-center gap-3">
            <Skeleton className="h-11 w-11 rounded-lg" />
            <div className="space-y-2">
              <Skeleton className="h-7 w-40" />
              <Skeleton className="h-4 w-64" />
            </div>
          </div>
        </div>
        {/* Stat cards skeleton */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-3 w-20 mb-2" />
                <Skeleton className="h-8 w-12" />
              </CardHeader>
            </Card>
          ))}
        </div>
        {/* Filter card skeleton */}
        <Card>
          <CardContent className="pt-6 space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
        {/* Checklist card grid skeleton */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                  <Skeleton className="h-5 w-14 rounded-full" />
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <Skeleton className="h-3 w-24" />
                {Array.from({ length: 3 }).map((_, j) => (
                  <div key={j} className="flex items-center gap-2">
                    <Skeleton className="h-4 w-4 rounded" />
                    <Skeleton className="h-3 flex-1" />
                  </div>
                ))}
                <div className="flex gap-2 pt-2">
                  <Skeleton className="h-8 w-20" />
                  <Skeleton className="h-8 w-16" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const activeChecklists = checklists.filter(c => c.is_active);
  const inactiveChecklists = checklists.filter(c => !c.is_active);

  return (
    <div className="space-y-4 md:space-y-6 animate-content-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => window.history.back()} className="relative group shrink-0">
            <div className={`p-2.5 rounded-lg ${s.headerIconGradient} text-white shadow-md group-hover:shadow-lg transition-shadow`}>
              <ListChecks className="h-6 w-6" />
            </div>
            <div className="absolute -left-1.5 -top-1.5 bg-background border rounded-full p-1 shadow-sm group-hover:scale-110 transition-transform">
              <ArrowLeft className="h-3 w-3 text-muted-foreground" />
            </div>
          </button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Checklists</h1>
            <p className="text-sm text-muted-foreground">Manage daily and weekly task templates</p>
          </div>
        </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:gap-2">
            <Button
              onClick={handleCreateTodaysInstances}
              variant="outline"
              className={`w-full sm:w-auto ${s.btnAnimation}`}
            >
              <Calendar className="mr-2 h-4 w-4" />
              Create Today
            </Button>
            <Button
              onClick={handleAddChecklist}
              className={`w-full sm:w-auto ${s.primaryGradient} ${s.primaryGradientHover} ${s.btnAnimation}`}
            >
              <Plus className="mr-2 h-4 w-4" />
              New Checklist
            </Button>
          </div>
      </div>

      {/* ── Desktop: side-by-side stats + live progress | Mobile: stacked ── */}
      <div className="flex flex-col lg:flex-row gap-4 md:gap-6">
        {/* Left: Stats Cards — narrow on desktop */}
        <div className="lg:w-[22%] lg:min-w-[200px] lg:shrink-0">
          <StatsCardGrid
            className="lg:!grid-cols-1"
            stats={[
              {
                label: 'Total Checklists',
                value: <CountUp end={checklists.length} />,
                isActive: filterStatus === 'all',
                isDefault: true,
                activeClassName: `${s.statsActive.total.border} ${s.statsActive.total.bg}`,
                onClick: () => setFilterStatus('all'),
              },
              {
                label: 'Active',
                value: <CountUp end={activeChecklists.length} />,
                valueColor: 'text-green-600',
                isActive: filterStatus === 'active',
                activeClassName: `${s.statsActive.available.border} ${s.statsActive.available.bg}`,
                onClick: () => setFilterStatus(filterStatus === 'active' ? 'all' : 'active'),
              },
              {
                label: 'Inactive',
                value: <CountUp end={inactiveChecklists.length} />,
                valueColor: 'text-gray-600',
                isActive: filterStatus === 'inactive',
                activeClassName: `${s.statsActive.gray.border} ${s.statsActive.gray.bg}`,
                onClick: () => setFilterStatus(filterStatus === 'inactive' ? 'all' : 'inactive'),
              },
              {
                label: 'Total Items',
                value: <CountUp end={checklists.reduce((sum, c) => sum + (c.items?.length || 0), 0)} />,
                valueColor: 'text-blue-600',
              },
            ]}
            filterHint="Click a metric to filter the list below"
          />
        </div>

        {/* Right: Today's Live Progress — wider on desktop with scroll constraint */}
        <div className="lg:flex-1 lg:min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <div className={`w-1 h-5 rounded-full bg-gradient-to-b ${s.primaryGradientStops}`} />
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Today&apos;s Progress</h2>
          </div>
          <div className="lg:max-h-[340px] lg:overflow-y-auto lg:pr-1 scroll-fade">
            <TodayChecklistProgress />
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search checklists by name or description..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9 text-sm"
        />
      </div>


      <FilterChips
        chips={filterChips}
        onClearAll={() => { setFilterStatus('all'); setSearchTerm(''); }}
      />

      {/* Checklists List */}
      <div ref={checklistsGridRef} className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {checklists
          .filter(checklist => {
            // Filter by status
            if (filterStatus === 'active' && !checklist.is_active) return false;
            if (filterStatus === 'inactive' && checklist.is_active) return false;

            // Filter by search term
            if (debouncedSearchTerm) {
              const search = debouncedSearchTerm.toLowerCase();
              return (
                checklist.name.toLowerCase().includes(search) ||
                (checklist.description?.toLowerCase().includes(search) ?? false)
              );
            }

            return true;
          })
          .map((checklist, idx) => (
            <Card
              key={checklist.id}
              className={`group relative overflow-hidden transition-all hover:shadow-lg hover:-translate-y-0.5 animate-stagger-fade-in cursor-pointer ${!checklist.is_active ? 'opacity-50 grayscale-[30%]' : ''}`}
              style={{ '--row-index': idx } as React.CSSProperties}
              onClick={() => handleViewChecklist(checklist)}
            >
              {/* Top gradient accent strip */}
              <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${checklist.is_active ? s.primaryGradientStops : 'from-gray-300 to-gray-400'}`} />

              <CardHeader className="pt-5 pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className={`p-2 rounded-lg shrink-0 ${checklist.is_active ? `bg-gradient-to-br ${s.primaryGradientStops} text-white shadow-sm` : 'bg-gray-100 text-gray-400'}`}>
                      <ListChecks className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <CardTitle className="text-base font-semibold truncate">{checklist.name}</CardTitle>
                      {checklist.description && (
                        <CardDescription className="text-xs mt-0.5 line-clamp-1">{checklist.description}</CardDescription>
                      )}
                    </div>
                  </div>
                  <Badge
                    className={`shrink-0 text-[10px] px-2 py-0.5 font-medium border ${checklist.is_active
                      ? `bg-gradient-to-r ${s.primaryGradientStops} text-white border-transparent`
                      : 'bg-gray-100 text-gray-500 border-gray-200'}`}
                  >
                    {checklist.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="space-y-3 pb-4">
                {/* Schedule pill */}
                <div className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full ${a.bg} ${a.text} font-medium`}>
                  <Calendar className="h-3 w-3 shrink-0" />
                  {checklist.recurrence_type === 'once' ? 'One-time' : (
                    <>
                      Repeat
                      {' · '}
                      {checklist.recurrence_days.map(d => dayNames[d]).join(', ')}
                    </>
                  )}
                </div>

                {/* Items preview */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Items</span>
                    <span className={`text-xs font-bold ${a.text}`}>{checklist.items?.length || 0}</span>
                  </div>
                  {checklist.items?.slice(0, 3).map((item, idx) => (
                    <div key={item.id} className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold ${a.bg} ${a.text}`}>
                        {idx + 1}
                      </span>
                      <span className="truncate">{item.label}</span>
                    </div>
                  ))}
                  {(checklist.items?.length || 0) > 3 && (
                    <span className="text-[10px] text-muted-foreground/60 ml-6 italic">
                      +{(checklist.items?.length || 0) - 3} more
                    </span>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-3 mt-1 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    className={`flex-1 h-8 text-xs ${a.hoverBg} ${a.hoverBorder} ${s.btnAnimation}`}
                    onClick={(e) => { e.stopPropagation(); handleViewHistory(checklist); }}
                  >
                    <BarChart3 className="mr-1.5 h-3.5 w-3.5" />
                    History
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className={`h-8 w-8 p-0 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-600 ${s.btnAnimation}`}
                    onClick={(e) => { e.stopPropagation(); handleEditChecklist(checklist); }}
                  >
                    <Edit className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className={`h-8 w-8 p-0 hover:bg-red-50 hover:border-red-200 hover:text-red-600 ${s.btnAnimation}`}
                    onClick={(e) => { e.stopPropagation(); handleDeleteChecklist(checklist.id, checklist.name); }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}

        {checklists.filter(checklist => {
          if (filterStatus === 'active' && !checklist.is_active) return false;
          if (filterStatus === 'inactive' && checklist.is_active) return false;
          if (debouncedSearchTerm) {
            const search = debouncedSearchTerm.toLowerCase();
            return (
              checklist.name.toLowerCase().includes(search) ||
              (checklist.description?.toLowerCase().includes(search) ?? false)
            );
          }
          return true;
        }).length === 0 && (
            <EmptyState
              icon={ListChecks}
              title={searchTerm ? 'No checklists found' : checklists.length === 0 ? 'No checklists yet' : 'No matching checklists'}
              description={searchTerm ? 'Try adjusting your search' : checklists.length === 0 ? 'Create your first checklist to get started' : 'Try changing the filter'}
              className="col-span-full"
              action={checklists.length === 0 ? (
                <Button
                  onClick={handleAddChecklist}
                  className={`${s.primaryGradient} ${s.primaryGradientHover} ${s.btnAnimation}`}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Create Checklist
                </Button>
              ) : undefined}
            />
          )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={checklistDialog} onOpenChange={setChecklistDialog}>
        <DialogContent className="w-[90vw] max-w-2xl max-h-[90vh] overflow-y-auto p-0 gap-0">
          {/* Premium Gradient Header */}
          <div className={`bg-gradient-to-r ${s.primaryGradient} px-6 py-4`}>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-white/20 backdrop-blur-sm">
                {editingChecklist ? <Edit className="h-5 w-5 text-white" /> : <Plus className="h-5 w-5 text-white" />}
              </div>
              <div>
                <DialogHeader className="p-0 space-y-0.5 text-left">
                  <DialogTitle className="text-white text-lg font-bold">
                    {editingChecklist ? 'Edit Checklist' : 'New Checklist'}
                  </DialogTitle>
                  <DialogDescription className="text-white/80 text-sm">
                    {editingChecklist ? 'Update the checklist template' : 'Create a new task template for your team'}
                  </DialogDescription>
                </DialogHeader>
              </div>
            </div>
          </div>

          <div className="px-6 py-5 space-y-6">
            {/* ── Basic Information ── */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className={`w-1 h-5 rounded-full bg-gradient-to-b ${s.primaryGradientStops}`} />
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Basic Information</h3>
              </div>
              <div>
                <Label htmlFor="name" className="text-sm font-medium">Checklist Name *</Label>
                <Input
                  id="name"
                  placeholder="e.g. Daily Opening Tasks"
                  value={checklistForm.name}
                  onChange={(e) => { setChecklistForm({ ...checklistForm, name: e.target.value }); clearClError('name'); }}
                  className={`mt-1.5 focus:ring-1 ${a.focusRing} ${a.focusBorder} ${fieldErrorClass(clErrors.name)}`}
                />
                <FieldError message={clErrors.name} />
              </div>

              <div>
                <Label htmlFor="description" className="text-sm font-medium">Description <span className="text-muted-foreground font-normal">(Optional)</span></Label>
                <Input
                  id="description"
                  placeholder="Brief description of the checklist"
                  value={checklistForm.description}
                  onChange={(e) => setChecklistForm({ ...checklistForm, description: e.target.value })}
                  className={`mt-1.5 focus:ring-1 ${a.focusRing} ${a.focusBorder}`}
                />
              </div>

              <div className={`flex items-center gap-3 p-3 rounded-lg border ${a.border} ${a.bg}`}>
                <Switch
                  id="active"
                  checked={checklistForm.is_active}
                  onCheckedChange={(checked) => setChecklistForm({ ...checklistForm, is_active: checked })}
                />
                <div>
                  <Label htmlFor="active" className="text-sm font-medium cursor-pointer">Active Checklist</Label>
                  <p className="text-[11px] text-muted-foreground">Inactive checklists won&apos;t generate daily instances</p>
                </div>
              </div>
            </div>

            {/* ── Recurrence Schedule ── */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className={`w-1 h-5 rounded-full bg-gradient-to-b ${s.primaryGradientStops}`} />
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Recurrence Schedule</h3>
              </div>
              <div>
                <Label className="text-sm font-medium">Frequency</Label>
                <Select
                  value={checklistForm.recurrence_type}
                  onValueChange={(value: 'daily' | 'weekly' | 'once') =>
                    setChecklistForm({ ...checklistForm, recurrence_type: value })
                  }
                >
                  <SelectTrigger className={`mt-1.5 focus:ring-1 ${a.focusRing} ${a.focusBorder}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Repeat</SelectItem>
                    <SelectItem value="once">One-time</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {checklistForm.recurrence_type !== 'once' && (
                <div>
                  <Label className="text-sm font-medium">Active Days</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {dayNames.map((day, index) => (
                      <div
                        key={index}
                        className={`flex items-center justify-center min-w-[44px] h-10 px-3 rounded-lg border-2 cursor-pointer ${s.btnAnimation} ${checklistForm.recurrence_days.includes(index)
                            ? `${a.borderStrong} bg-gradient-to-br ${s.primaryGradientStops} text-white shadow-md`
                            : `border-border/60 ${a.hoverBorder} ${a.hoverBg}`
                          }`}
                        onClick={() => handleToggleDay(index)}
                      >
                        <span className="text-sm font-medium">{day}</span>
                      </div>
                    ))}
                  </div>
                  <FieldError message={clErrors.recurrence_days} />
                </div>
              )}
            </div>

            {/* ── Checklist Items ── */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-1 h-5 rounded-full bg-gradient-to-b ${s.primaryGradientStops}`} />
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Checklist Items</h3>
                </div>
                {items.length > 1 && (
                  <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <GripVertical className="h-3 w-3" />
                    Drag to reorder
                  </span>
                )}
              </div>

              {/* Item List — Drag-and-drop reorderable */}
              {items.length > 0 ? (
                <Reorder.Group
                  axis="y"
                  values={items}
                  onReorder={handleDragReorder}
                  className="space-y-2"
                >
                  {items.map((item, index) => (
                    <DraggableChecklistItem
                      key={item.id}
                      item={item}
                      index={index}
                      totalItems={items.length}
                      onMoveUp={() => handleMoveItem(index, 'up')}
                      onMoveDown={() => handleMoveItem(index, 'down')}
                      onRemove={() => handleRemoveItem(item.id)}
                    />
                  ))}
                </Reorder.Group>
              ) : (
                <div className={`text-center py-8 text-sm text-muted-foreground border-2 border-dashed rounded-lg ${a.border}`}>
                  No items added yet. Add your first item below.
                </div>
              )}
              <FieldError message={clErrors.items} />

              {/* Add Item */}
              <div className="flex gap-2">
                <Input
                  placeholder="Add new item..."
                  value={newItemLabel}
                  onChange={(e) => setNewItemLabel(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddItem();
                    }
                  }}
                  className={`text-sm focus:ring-1 ${a.focusRing} ${a.focusBorder}`}
                />
                <Button
                  type="button"
                  onClick={handleAddItem}
                  className={`${s.primaryGradient} ${s.primaryGradientHover} ${s.btnAnimation}`}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Premium Footer */}
          <div className="px-6 py-4 border-t bg-muted/30 flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => setChecklistDialog(false)}
              disabled={submitting}
              className={s.btnAnimation}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveChecklist}
              disabled={submitting}
              className={`${s.primaryGradient} ${s.primaryGradientHover} ${s.btnAnimation} shadow-md`}
            >
              {submitting ? (
                <>
                  <Loader2 className="animate-spin mr-2 h-4 w-4" />
                  {editingChecklist ? 'Saving...' : 'Creating...'}
                </>
              ) : (
                editingChecklist ? 'Save Changes' : 'Create Checklist'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Checklist Dialog (read-only) */}
      <Dialog open={viewDialog} onOpenChange={setViewDialog}>
        <DialogContent className="w-[90vw] max-w-lg max-h-[90vh] overflow-y-auto p-0 gap-0">
          {/* Premium Gradient Header with Edit action */}
          <div className={`bg-gradient-to-r ${s.primaryGradient} px-6 py-4`}>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-white/20 backdrop-blur-sm">
                <ListChecks className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <DialogHeader className="p-0 space-y-0.5 text-left">
                  <DialogTitle className="text-white text-lg font-bold truncate">
                    {viewingChecklist?.name}
                  </DialogTitle>
                  <DialogDescription className="text-white/80 text-sm truncate">
                    {viewingChecklist?.description || 'No description'}
                  </DialogDescription>
                </DialogHeader>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 text-white/80 hover:text-white hover:bg-white/20"
                onClick={() => {
                  setViewDialog(false);
                  if (viewingChecklist) handleEditChecklist(viewingChecklist);
                }}
              >
                <Edit className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {viewingChecklist && (
            <div className="px-6 py-5 space-y-5">
              {/* Status & Schedule */}
              <div className="flex items-center gap-2 flex-wrap">
                <Badge
                  className={`text-xs px-2.5 py-0.5 font-medium border ${viewingChecklist.is_active
                    ? `bg-gradient-to-r ${s.primaryGradientStops} text-white border-transparent`
                    : 'bg-gray-100 text-gray-500 border-gray-200'}`}
                >
                  {viewingChecklist.is_active ? 'Active' : 'Inactive'}
                </Badge>
                <div className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full ${a.bg} ${a.text} font-medium`}>
                  <Calendar className="h-3 w-3 shrink-0" />
                  {viewingChecklist.recurrence_type === 'once' ? 'One-time' : (
                    <>
                      Repeat · {viewingChecklist.recurrence_days.map(d => dayNames[d]).join(', ')}
                    </>
                  )}
                </div>
              </div>

              {/* Items List */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className={`w-1 h-5 rounded-full bg-gradient-to-b ${s.primaryGradientStops}`} />
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Items ({viewingChecklist.items?.length || 0})
                  </h3>
                </div>
                <div className="space-y-1.5">
                  {viewingChecklist.items?.map((item, idx) => (
                    <div key={item.id} className={`flex items-center gap-3 p-2.5 rounded-lg border ${a.border} bg-muted/20`}>
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${a.bg} ${a.text} shrink-0`}>
                        {idx + 1}
                      </span>
                      <span className="text-sm">{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="px-6 py-3 border-t bg-muted/30 flex justify-between items-center">
            <Button
              variant="outline"
              size="sm"
              className={`text-xs ${a.hoverBg} ${a.hoverBorder} ${s.btnAnimation}`}
              onClick={() => {
                setViewDialog(false);
                if (viewingChecklist) handleViewHistory(viewingChecklist);
              }}
            >
              <BarChart3 className="mr-1.5 h-3.5 w-3.5" />
              View History
            </Button>
            <Button
              size="sm"
              className={`${s.primaryGradient} ${s.primaryGradientHover} ${s.btnAnimation}`}
              onClick={() => {
                setViewDialog(false);
                if (viewingChecklist) handleEditChecklist(viewingChecklist);
              }}
            >
              <Edit className="mr-1.5 h-3.5 w-3.5" />
              Edit Checklist
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* History Dialog */}
      <Dialog open={historyDialog} onOpenChange={setHistoryDialog}>
        <DialogContent className="w-[90vw] max-w-xl max-h-[90vh] overflow-y-auto p-0 gap-0">
          {/* Premium Gradient Header */}
          <div className={`bg-gradient-to-r ${s.primaryGradient} px-6 py-4`}>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-white/20 backdrop-blur-sm">
                <BarChart3 className="h-5 w-5 text-white" />
              </div>
              <div>
                <DialogHeader className="p-0 space-y-0.5 text-left">
                  <DialogTitle className="text-white text-lg font-bold">Completion History</DialogTitle>
                  <DialogDescription className="text-white/80 text-sm">
                    {selectedChecklistForHistory?.name} · Last 30 days
                  </DialogDescription>
                </DialogHeader>
              </div>
            </div>
          </div>

          <div className="px-6 py-5 space-y-5">
            {/* Compact Stats Strip */}
            {stats && (
              <div className={`grid grid-cols-4 gap-px rounded-xl overflow-hidden border ${a.border}`}>
                <div className={`p-3 text-center bg-gradient-to-b ${a.gradientSubtle}`}>
                  <div className="text-lg font-bold">{stats.total}</div>
                  <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Total</div>
                </div>
                <div className="p-3 text-center bg-gradient-to-b from-green-50 to-white">
                  <div className="text-lg font-bold text-green-600">{stats.completed}</div>
                  <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Done</div>
                </div>
                <div className="p-3 text-center bg-gradient-to-b from-amber-50 to-white">
                  <div className="text-lg font-bold text-amber-600">{stats.inProgress}</div>
                  <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Partial</div>
                </div>
                <div className={`p-3 text-center bg-gradient-to-b ${a.gradientSubtle}`}>
                  <div className={`text-lg font-bold ${a.text}`}>{stats.completionRate}%</div>
                  <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Rate</div>
                </div>
              </div>
            )}

            {/* Clean Date List with Progress Bars */}
            <div className="space-y-1.5">
              {historyData.map((instance) => {
                const pct = instance.total_items > 0 ? Math.round((instance.completed_items / instance.total_items) * 100) : 0;
                const isComplete = instance.status === 'completed';
                const isPartial = instance.status === 'in_progress';
                const isExpanded = expandedHistoryId === instance.id;

                return (
                  <div key={instance.id}>
                    <button
                      type="button"
                      onClick={() => setExpandedHistoryId(isExpanded ? null : instance.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-colors ${isComplete ? 'border-green-200 bg-green-50/40' : isPartial ? 'border-amber-200 bg-amber-50/30' : 'border-border/50 hover:bg-muted/40'}`}
                    >
                      {/* Status dot */}
                      <div className={`w-2 h-2 rounded-full shrink-0 ${isComplete ? 'bg-green-500' : isPartial ? 'bg-amber-500' : 'bg-gray-300'}`} />

                      {/* Date */}
                      <span className="text-sm font-medium min-w-[90px] shrink-0 text-left">
                        {new Date(instance.date).toLocaleDateString('en-US', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>

                      {/* Progress bar */}
                      <div className="flex-1 min-w-0">
                        <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${isComplete ? 'bg-green-500' : `bg-gradient-to-r ${s.primaryGradientStops}`}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>

                      {/* Fraction */}
                      <span className={`text-xs font-semibold tabular-nums shrink-0 ${isComplete ? 'text-green-600' : isPartial ? 'text-amber-600' : 'text-muted-foreground'}`}>
                        {instance.completed_items}/{instance.total_items}
                      </span>

                      {/* Expand indicator */}
                      {instance.completions?.length > 0 && (
                        <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                      )}
                    </button>

                    {/* Expanded completion details */}
                    {isExpanded && instance.completions?.length > 0 && (
                      <div className="ml-5 mt-1 mb-2 pl-3 border-l-2 border-muted space-y-1.5">
                        {instance.completions
                          .sort((a, b) => new Date(a.completed_at).getTime() - new Date(b.completed_at).getTime())
                          .map((completion) => (
                            <div key={completion.id} className="flex items-start gap-2 py-1 text-xs">
                              <div className="w-4 h-4 rounded-full bg-green-100 flex items-center justify-center shrink-0 mt-0.5">
                                <ListChecks className="h-2.5 w-2.5 text-green-600" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-foreground truncate">
                                  {completion.checklist_item?.label || 'Unknown task'}
                                </p>
                                <div className="flex items-center gap-3 text-muted-foreground mt-0.5">
                                  <span className="flex items-center gap-1">
                                    <User className="h-3 w-3" />
                                    {completion.completed_by_profile?.full_name || 'Unknown'}
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {new Date(completion.completed_at).toLocaleTimeString('en-US', {
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })}
                                  </span>
                                </div>
                              </div>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                );
              })}

              {historyData.length === 0 && (
                <EmptyState
                  icon={BarChart3}
                  title="No history yet"
                  description="Completion records will appear here"
                />
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

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
