// Shared Checklist Pool API Functions
// Updated: 2024-12-31

import { supabase } from '@/lib/supabase';

// ==========================================
// TYPES
// ==========================================

export interface ChecklistTemplate {
  id: string;
  shop_id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  recurrence_type: 'daily' | 'weekly' | 'once';
  recurrence_days: number[]; // 0=Sunday, 1=Monday, ..., 6=Saturday
  created_at: string;
  updated_at: string;
}

export interface ChecklistItem {
  id: string;
  checklist_id: string;
  label: string;
  sort_order: number;
}

export interface ChecklistInstance {
  id: string;
  checklist_id: string;
  shop_id: string;
  date: string;
  status: 'pending' | 'in_progress' | 'completed';
  total_items: number;
  completed_items: number;
  created_at: string;
  updated_at: string;
}

export interface ChecklistItemCompletion {
  id: string;
  instance_id: string;
  checklist_item_id: string;
  completed_by: string;
  completed_at: string;
  notes: string | null;
}

export interface ChecklistInstanceWithDetails extends ChecklistInstance {
  checklist: ChecklistTemplate;
  items: (ChecklistItem & { 
    completion?: ChecklistItemCompletion & {
      completed_by_profile?: {
        full_name: string;
      };
    };
  })[];
}

export interface ChecklistCompletionHistoryItem extends ChecklistInstance {
  completions: (ChecklistItemCompletion & {
    checklist_item?: { label: string };
    completed_by_profile?: { full_name: string };
  })[];
}

export interface ChecklistStats {
  total: number;
  completed: number;
  inProgress: number;
  pending: number;
  completionRate: number;
}

// ==========================================
// ADMIN: TEMPLATE MANAGEMENT
// ==========================================

/**
 * Create a new checklist template with items
 */
export async function createChecklistTemplate(
  shopId: string,
  createdBy: string,
  template: {
    name: string;
    description?: string;
    is_active?: boolean;
    recurrence_type: 'daily' | 'weekly' | 'once';
    recurrence_days: number[];
    items: { label: string; sort_order: number }[];
  }
) {
  // Create checklist template
  const { data: checklist, error: checklistError } = await supabase
    .from('checklists')
    .insert({
      shop_id: shopId,
      name: template.name,
      description: template.description || null,
      is_active: template.is_active ?? true,
      recurrence_type: template.recurrence_type,
      recurrence_days: template.recurrence_days,
      created_by: createdBy,
    })
    .select()
    .single();

  if (checklistError) throw checklistError;

  // Create checklist items
  if (template.items.length > 0) {
    const { error: itemsError } = await supabase
      .from('checklist_items')
      .insert(
        template.items.map((item) => ({
          checklist_id: checklist.id,
          label: item.label,
          sort_order: item.sort_order,
        }))
      );

    if (itemsError) throw itemsError;
  }

  return checklist;
}

/**
 * Update checklist template
 */
export async function updateChecklistTemplate(
  checklistId: string,
  updates: {
    name?: string;
    description?: string;
    is_active?: boolean;
    recurrence_type?: 'daily' | 'weekly' | 'once';
    recurrence_days?: number[];
  }
) {
  const { data, error } = await supabase
    .from('checklists')
    .update(updates)
    .eq('id', checklistId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Delete checklist template
 */
export async function deleteChecklistTemplate(checklistId: string) {
  const { error } = await supabase
    .from('checklists')
    .delete()
    .eq('id', checklistId);

  if (error) throw error;
}

/**
 * Get all checklist templates for a shop
 */
export async function getChecklistTemplates(shopId: string) {
  const { data, error } = await supabase
    .from('checklists')
    .select('*, items:checklist_items(*)')
    .eq('shop_id', shopId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

/**
 * Add item to checklist template
 */
export async function addChecklistItem(
  checklistId: string,
  label: string,
  sortOrder: number
) {
  const { data, error } = await supabase
    .from('checklist_items')
    .insert({
      checklist_id: checklistId,
      label,
      sort_order: sortOrder,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Update checklist item
 */
export async function updateChecklistItem(
  itemId: string,
  updates: { label?: string; sort_order?: number }
) {
  const { data, error } = await supabase
    .from('checklist_items')
    .update(updates)
    .eq('id', itemId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Delete checklist item
 */
export async function deleteChecklistItem(itemId: string) {
  const { error } = await supabase
    .from('checklist_items')
    .delete()
    .eq('id', itemId);

  if (error) throw error;
}

/**
 * Reorder checklist items
 */
export async function reorderChecklistItems(
  items: { id: string; sort_order: number }[]
) {
  const updates = items.map((item) =>
    supabase
      .from('checklist_items')
      .update({ sort_order: item.sort_order })
      .eq('id', item.id)
  );

  await Promise.all(updates);
}

// ==========================================
// STAFF: DAILY CHECKLISTS
// ==========================================

/**
 * Get today's checklist instances for a shop (staff view)
 */
export async function getTodaysChecklists(shopId: string, date: string = new Date().toISOString().split('T')[0]) {
  const { data, error } = await supabase
    .from('checklist_instances' as any)
    .select(`
      *,
      checklist:checklists!inner(
        id,
        name,
        description,
        recurrence_type,
        recurrence_days,
        is_active
      )
    `)
    .eq('shop_id', shopId)
    .eq('date', date)
    .eq('checklist.is_active', true)
    .order('created_at', { ascending: true });

  if (error) throw error;

  // Filter out instances that don't match their template's current recurrence schedule
  const dayOfWeek = new Date(date).getDay(); // 0=Sunday, 1=Monday, etc.
  const validInstances = (data || []).filter((instance: any) => {
    const template = instance.checklist;
    
    // For 'once' type, always show (manually created)
    if (template.recurrence_type === 'once') return true;
    
    // For daily/weekly, check if today is in the recurrence_days
    return template.recurrence_days && template.recurrence_days.includes(dayOfWeek);
  });

  // Get items and completions for each instance
  const instancesWithDetails: ChecklistInstanceWithDetails[] = [];
  
  for (const instance of validInstances as any[]) {
    // Get all items for this checklist
    const { data: items, error: itemsError } = await supabase
      .from('checklist_items')
      .select('*')
      .eq('checklist_id', instance.checklist_id)
      .order('sort_order');

    if (itemsError) throw itemsError;

    // Get completions for this instance
    const { data: completions, error: completionsError } = await supabase
      .from('checklist_item_completions' as any)
      .select(`
        *,
        completed_by_profile:profiles!checklist_item_completions_completed_by_fkey(
          full_name
        )
      `)
      .eq('instance_id', instance.id);

    if (completionsError) throw completionsError;

    // Merge items with their completions
    const itemsWithCompletions = items.map((item) => ({
      ...item,
      completion: (completions as any)?.find((c: any) => c.checklist_item_id === item.id),
    }));

    instancesWithDetails.push({
      ...instance,
      checklist: instance.checklist,
      items: itemsWithCompletions,
    } as any);
  }

  return instancesWithDetails;
}

/**
 * Complete a checklist item (staff action)
 */
export async function completeChecklistItem(
  instanceId: string,
  checklistItemId: string,
  completedBy: string,
  notes?: string
) {
  const { data, error } = await supabase
    .from('checklist_item_completions' as any)
    .insert({
      instance_id: instanceId,
      checklist_item_id: checklistItemId,
      completed_by: completedBy,
      notes: notes || null,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Uncomplete a checklist item (remove completion)
 */
export async function uncompleteChecklistItem(
  instanceId: string,
  checklistItemId: string
) {
  const { error } = await supabase
    .from('checklist_item_completions' as any)
    .delete()
    .eq('instance_id', instanceId)
    .eq('checklist_item_id', checklistItemId);

  if (error) throw error;
}

// ==========================================
// ADMIN: INSTANCE MANAGEMENT
// ==========================================

/**
 * Manually create checklist instances for a specific date
 */
export async function createChecklistInstances(shopId: string, date: string) {
  const { data, error } = await supabase.rpc('create_daily_checklist_instances' as any, {
    shop_id_param: shopId,
    date_param: date,
  });

  if (error) throw error;
  return data;
}

/**
 * Get completion history for a checklist template
 */
export async function getChecklistCompletionHistory(
  checklistId: string,
  startDate: string,
  endDate: string
) {
  const { data, error } = await supabase
    .from('checklist_instances' as any)
    .select(`
      *,
      completions:checklist_item_completions(
        *,
        checklist_item:checklist_items(label),
        completed_by_profile:profiles!checklist_item_completions_completed_by_fkey(full_name)
      )
    `)
    .eq('checklist_id', checklistId)
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date', { ascending: false });

  if (error) throw error;
  return data;
}

/**
 * Get completion stats for a checklist
 */
export async function getChecklistStats(checklistId: string, days: number = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  const startDateStr = startDate.toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('checklist_instances' as any)
    .select('status, date')
    .eq('checklist_id', checklistId)
    .gte('date', startDateStr);

  if (error) throw error;

  const total = data?.length || 0;
  const completed = (data as any)?.filter((d: any) => d.status === 'completed').length || 0;
  const inProgress = (data as any)?.filter((d: any) => d.status === 'in_progress').length || 0;
  const pending = (data as any)?.filter((d: any) => d.status === 'pending').length || 0;

  return {
    total,
    completed,
    inProgress,
    pending,
    completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
  };
}
