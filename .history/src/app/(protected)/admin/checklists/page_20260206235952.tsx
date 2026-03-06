'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { ListChecks, Plus, Edit, Trash2, GripVertical, X, BarChart3, Calendar, Loader2, ArrowLeft, Search } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { useDebouncedSearch } from '@/hooks';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
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

interface ChecklistWithItems extends ChecklistTemplate {
  items: ChecklistItem[];
}

export default function ChecklistsManagementPage() {
  const { profile } = useAuth();
  const [checklists, setChecklists] = useState<ChecklistWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const { searchTerm, debouncedSearchTerm, setSearchTerm } = useDebouncedSearch({ delay: 300 });
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');

  // Confirm dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
  }>({ open: false, title: '', description: '', onConfirm: () => {} });
  
  // Dialog states
  const [checklistDialog, setChecklistDialog] = useState(false);
  const [editingChecklist, setEditingChecklist] = useState<ChecklistWithItems | null>(null);
  const [historyDialog, setHistoryDialog] = useState(false);
  const [selectedChecklistForHistory, setSelectedChecklistForHistory] = useState<ChecklistWithItems | null>(null);
  const [historyData, setHistoryData] = useState<ChecklistCompletionHistoryItem[]>([]);
  const [stats, setStats] = useState<ChecklistStats | null>(null);

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
      recurrence_type: checklist.recurrence_type,
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
    if (!profile?.shop_id || !checklistForm.name.trim()) {
      toast.error('Please enter checklist name');
      return;
    }

    if (items.length === 0) {
      toast.error('Please add at least one item');
      return;
    }

    if (checklistForm.recurrence_days.length === 0 && checklistForm.recurrence_type !== 'once') {
      toast.error('Please select at least one day');
      return;
    }

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
      } else {
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
    } catch (error: any) {
      console.error('Error saving checklist:', error);
      toast.error(error.message || 'Failed to save checklist');    } finally {
      setSubmitting(false);    }
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading checklists...</div>
      </div>
    );
  }

  const activeChecklists = checklists.filter(c => c.is_active);
  const inactiveChecklists = checklists.filter(c => !c.is_active);

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header with Back Button */}
      <div className="space-y-1">
        <Button
          variant="ghost"
          onClick={() => window.history.back()}
          className="mb-2 -ml-2 text-teal-600 hover:text-teal-700 hover:bg-teal-50"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Dashboard
        </Button>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-teal-500 to-cyan-600 rounded-lg">
              <ListChecks className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Checklists</h1>
              <p className="text-sm text-muted-foreground">Manage daily and weekly task templates</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button 
              onClick={handleCreateTodaysInstances} 
              variant="outline"
              className="transition-all hover:scale-105 active:scale-95"
            >
              <Calendar className="mr-2 h-4 w-4" />
              Create Today
            </Button>
            <Button 
              onClick={handleAddChecklist}
              className="bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-600 hover:to-cyan-700 transition-all hover:scale-105 active:scale-95"
            >
              <Plus className="mr-2 h-4 w-4" />
              New Checklist
            </Button>
          </div>
        </div>
      </div>

      {/* Stats Cards - 2x2 mobile, 4 columns desktop */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <Card 
          className="cursor-pointer transition-all hover:shadow-lg hover:scale-105 active:scale-95"
          onClick={() => setFilterStatus('all')}
        >
          <CardHeader className="pb-2">
            <CardDescription className="text-xs">Total Checklists</CardDescription>
            <CardTitle className="text-2xl md:text-3xl">{checklists.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card 
          className="cursor-pointer transition-all hover:shadow-lg hover:scale-105 active:scale-95"
          onClick={() => setFilterStatus('active')}
        >
          <CardHeader className="pb-2">
            <CardDescription className="text-xs">Active</CardDescription>
            <CardTitle className="text-2xl md:text-3xl text-green-600">{activeChecklists.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card 
          className="cursor-pointer transition-all hover:shadow-lg hover:scale-105 active:scale-95"
          onClick={() => setFilterStatus('inactive')}
        >
          <CardHeader className="pb-2">
            <CardDescription className="text-xs">Inactive</CardDescription>
            <CardTitle className="text-2xl md:text-3xl text-gray-600">{inactiveChecklists.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="cursor-pointer transition-all hover:shadow-lg hover:scale-105 active:scale-95">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs">Total Items</CardDescription>
            <CardTitle className="text-2xl md:text-3xl text-blue-600">
              {checklists.reduce((sum, c) => sum + (c.items?.length || 0), 0)}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="pt-6 space-y-4">
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
          
          {/* Filter Tabs */}
          <Tabs value={filterStatus} onValueChange={(v) => setFilterStatus(v as 'all' | 'active' | 'inactive')}>
            <TabsList className="grid w-full grid-cols-3 h-auto">
              <TabsTrigger value="all" className="text-xs md:text-sm">All</TabsTrigger>
              <TabsTrigger value="active" className="text-xs md:text-sm">Active</TabsTrigger>
              <TabsTrigger value="inactive" className="text-xs md:text-sm">Inactive</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardContent>
      </Card>

      {/* Checklists List */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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
          .map((checklist) => (
          <Card 
            key={checklist.id} 
            className={`transition-all hover:shadow-lg ${!checklist.is_active ? 'opacity-60' : ''}`}
          >
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-lg">{checklist.name}</CardTitle>
                  {checklist.description && (
                    <CardDescription className="text-sm">{checklist.description}</CardDescription>
                  )}
                </div>
                <Badge variant={checklist.is_active ? 'default' : 'secondary'}>
                  {checklist.is_active ? 'Active' : 'Inactive'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Recurrence */}
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4" />
                {checklist.recurrence_type === 'once' ? (
                  'One-time'
                ) : (
                  <>
                    {checklist.recurrence_type === 'daily' ? 'Daily' : 'Weekly'}
                    {' • '}
                    {checklist.recurrence_days.map(d => dayNames[d]).join(', ')}
                  </>
                )}
              </div>

              {/* Items Count */}
              <div className="text-sm text-muted-foreground">
                {checklist.items?.length || 0} items
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 hover:scale-105 active:scale-95 transition-all"
                  onClick={() => handleViewHistory(checklist)}
                >
                  <BarChart3 className="mr-1 h-4 w-4" />
                  History
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="hover:scale-105 active:scale-95 transition-all hover:bg-blue-50 hover:text-blue-600"
                  onClick={() => handleEditChecklist(checklist)}
                >
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="hover:scale-105 active:scale-95 transition-all hover:bg-red-50 hover:text-red-600"
                  onClick={() => handleDeleteChecklist(checklist.id, checklist.name)}
                >
                  <Trash2 className="h-4 w-4" />
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
          <div className="col-span-full text-center py-12">
            <ListChecks className="mx-auto h-12 md:h-16 w-12 md:w-16 text-muted-foreground mb-3" />
            <h3 className="text-lg font-medium mb-2">
              {searchTerm ? 'No checklists found' : checklists.length === 0 ? 'No checklists yet' : 'No matching checklists'}
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              {searchTerm ? 'Try adjusting your search' : checklists.length === 0 ? 'Create your first checklist to get started' : 'Try changing the filter'}
            </p>
            {checklists.length === 0 && (
              <Button 
                onClick={handleAddChecklist}
                className="bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-600 hover:to-cyan-700 transition-all hover:scale-105 active:scale-95"
              >
                <Plus className="mr-2 h-4 w-4" />
                Create Checklist
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={checklistDialog} onOpenChange={setChecklistDialog}>
        <DialogContent className="w-[90vw] max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl">{editingChecklist ? 'Edit Checklist' : 'Create Checklist'}</DialogTitle>
            <DialogDescription className="text-sm">
              Set up a checklist template that can be assigned to staff
            </DialogDescription>
          </DialogHeader>
          <Separator className="my-4" />

          <div className="space-y-6">
            {/* Basic Info */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Basic Information</h3>
              <div>
                <Label htmlFor="name" className="text-sm font-medium">Checklist Name *</Label>
                <Input
                  id="name"
                  placeholder="e.g. Daily Opening Tasks"
                  value={checklistForm.name}
                  onChange={(e) => setChecklistForm({ ...checklistForm, name: e.target.value })}
                  className="mt-1.5"
                />
              </div>

              <div>
                <Label htmlFor="description" className="text-sm font-medium">Description (Optional)</Label>
                <Input
                  id="description"
                  placeholder="Brief description of the checklist"
                  value={checklistForm.description}
                  onChange={(e) => setChecklistForm({ ...checklistForm, description: e.target.value })}
                  className="mt-1.5"
                />
              </div>

              <div className="flex items-center space-x-2 pt-2">
                <Switch
                  id="active"
                  checked={checklistForm.is_active}
                  onCheckedChange={(checked) => setChecklistForm({ ...checklistForm, is_active: checked })}
                />
                <Label htmlFor="active" className="text-sm font-medium cursor-pointer">Active Checklist</Label>
              </div>
            </div>

            {/* Recurrence */}
            <div className="space-y-4 border-t pt-4">
              <h3 className="text-lg font-semibold">Recurrence Schedule</h3>
              <div>
                <Label className="text-sm font-medium">Frequency</Label>
                <Select
                  value={checklistForm.recurrence_type}
                  onValueChange={(value: 'daily' | 'weekly' | 'once') =>
                    setChecklistForm({ ...checklistForm, recurrence_type: value })
                  }
                >
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="once">One-time</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {checklistForm.recurrence_type === 'weekly' && (
                <div>
                  <Label className="text-sm font-medium">Active Days</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {dayNames.map((day, index) => (
                      <div
                        key={index}
                        className={`flex items-center justify-center min-w-[44px] h-11 px-3 rounded-lg border-2 cursor-pointer transition-all hover:scale-105 active:scale-95 ${
                          checklistForm.recurrence_days.includes(index)
                            ? 'border-teal-500 bg-gradient-to-br from-teal-500 to-cyan-600 text-white shadow-md'
                            : 'border-border hover:border-teal-300 hover:bg-teal-50'
                        }`}
                        onClick={() => handleToggleDay(index)}
                      >
                        <span className="text-sm font-medium">{day}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Items */}
            <div className="space-y-4 border-t pt-4">
              <h3 className="text-lg font-semibold">Checklist Items</h3>
              
              {/* Item List */}
              <div className="space-y-2">
                {items.map((item, index) => (
                  <div key={item.id} className="flex items-center gap-2 p-3 border rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                    <div className="flex gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 hover:bg-teal-50 hover:text-teal-600 transition-all hover:scale-110 active:scale-95"
                        onClick={() => handleMoveItem(index, 'up')}
                        disabled={index === 0}
                      >
                        ↑
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 hover:bg-teal-50 hover:text-teal-600 transition-all hover:scale-110 active:scale-95"
                        onClick={() => handleMoveItem(index, 'down')}
                        disabled={index === items.length - 1}
                      >
                        ↓
                      </Button>
                    </div>
                    <span className="text-sm font-medium text-muted-foreground min-w-[24px]">{index + 1}.</span>
                    <span className="flex-1 text-sm">{item.label}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 hover:bg-red-50 hover:text-red-600 transition-all hover:scale-110 active:scale-95"
                      onClick={() => handleRemoveItem(item.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                {items.length === 0 && (
                  <div className="text-center py-8 text-sm text-muted-foreground border-2 border-dashed rounded-lg">
                    No items added yet. Add your first item below.
                  </div>
                )}
              </div>

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
                  className="text-sm"
                />
                <Button 
                  type="button" 
                  onClick={handleAddItem}
                  className="bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-600 hover:to-cyan-700 transition-all hover:scale-105 active:scale-95"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setChecklistDialog(false)}
              disabled={submitting}
              className="transition-all hover:scale-105 active:scale-95"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSaveChecklist}
              disabled={submitting}
              className="bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-600 hover:to-cyan-700 transition-all hover:scale-105 active:scale-95"
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
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* History Dialog */}
      <Dialog open={historyDialog} onOpenChange={setHistoryDialog}>
        <DialogContent className="w-[90vw] max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl">Completion History</DialogTitle>
            <DialogDescription className="text-sm">
              {selectedChecklistForHistory?.name} • Last 30 days
            </DialogDescription>
          </DialogHeader>
          <Separator className="my-4" />

          {stats && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <Card className="transition-all hover:shadow-lg">
                <CardContent className="pt-6">
                  <div className="text-2xl md:text-3xl font-bold">{stats.total}</div>
                  <p className="text-xs text-muted-foreground mt-1">Total Instances</p>
                </CardContent>
              </Card>
              <Card className="transition-all hover:shadow-lg">
                <CardContent className="pt-6">
                  <div className="text-2xl md:text-3xl font-bold text-green-600">{stats.completed}</div>
                  <p className="text-xs text-muted-foreground mt-1">Completed</p>
                </CardContent>
              </Card>
              <Card className="transition-all hover:shadow-lg">
                <CardContent className="pt-6">
                  <div className="text-2xl md:text-3xl font-bold text-yellow-600">{stats.inProgress}</div>
                  <p className="text-xs text-muted-foreground mt-1">In Progress</p>
                </CardContent>
              </Card>
              <Card className="transition-all hover:shadow-lg">
                <CardContent className="pt-6">
                  <div className="text-2xl md:text-3xl font-bold text-blue-600">{stats.completionRate}%</div>
                  <p className="text-xs text-muted-foreground mt-1">Completion Rate</p>
                </CardContent>
              </Card>
            </div>
          )}

          <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
            {historyData.map((instance) => (
              <Card key={instance.id} className="transition-all hover:shadow-md">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">
                      {new Date(instance.date).toLocaleDateString('en-US', { 
                        weekday: 'short', 
                        year: 'numeric', 
                        month: 'short', 
                        day: 'numeric' 
                      })}
                    </CardTitle>
                    <Badge 
                      variant={
                        instance.status === 'completed' ? 'default' : 
                        instance.status === 'in_progress' ? 'secondary' : 
                        'outline'
                      }
                      className="text-xs"
                    >
                      {instance.completed_items}/{instance.total_items}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {instance.completions?.map((completion: any) => (
                      <div key={completion.id} className="flex items-start justify-between gap-3 text-sm">
                        <span className="flex-1">✓ {completion.checklist_item.label}</span>
                        <span className="text-muted-foreground text-xs whitespace-nowrap">
                          {completion.completed_by_profile.full_name} • {' '}
                          {new Date(completion.completed_at).toLocaleTimeString('en-US', { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })}
                        </span>
                      </div>
                    ))}
                    {(!instance.completions || instance.completions.length === 0) && (
                      <div className="text-sm text-muted-foreground italic">No items completed yet</div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}

            {historyData.length === 0 && (
              <div className="text-center py-12">
                <BarChart3 className="mx-auto h-12 md:h-16 w-12 md:w-16 text-muted-foreground mb-3" />
                <h3 className="text-lg font-medium mb-2">No completion history yet</h3>
                <p className="text-sm text-muted-foreground">Completed checklists will appear here</p>
              </div>
            )}
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
