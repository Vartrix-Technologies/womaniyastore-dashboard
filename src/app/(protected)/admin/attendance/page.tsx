'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { DateRangeFilter } from '@/components/shared/DateRangeFilter';
import { ExportButton } from '@/components/shared/ExportButton';
import { PaginationControls } from '@/components/shared/PaginationControls';
import { FilterChips, type FilterChip } from '@/components/shared/FilterChips';
import { formatTime, formatDate } from '@/lib/formatters';
import { calculateHours } from '@/lib/utils/attendance';
import { useDateFilter, useServerPagination, useSortableTable, useDebouncedSearch } from '@/hooks';
import { SortableHeader } from '@/components/shared/SortableHeader';
import { Users, Clock, Edit, Trash2, Plus, ArrowLeft, Search, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AttendanceCalendar } from '@/components/staff/AttendanceCalendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AttendanceEditDialog } from '@/components/admin/AttendanceEditDialog';
import { AttendanceDeleteDialog } from '@/components/admin/AttendanceDeleteDialog';
import { AttendanceCreateDialog } from '@/components/admin/AttendanceCreateDialog';
import { AttendanceBulkEntryDialog } from '@/components/admin/AttendanceBulkEntryDialog';
import { Input } from '@/components/ui/input';
import { useRouter } from 'next/navigation';
import { appConfig } from '@/lib/config/app.config';
import type { AttendanceLogForList, StaffMember } from '@/types';

const s = appConfig.styles;
const a = s.accent;

export default function AdminAttendancePage() {
  const { profile, user } = useAuth();
  const router = useRouter();
  const { dateFilter, setDateFilter, customRange, setCustomRange, startDateISO, endDateISO } = useDateFilter({ initialFilter: 'week' });
  const [logs, setLogs] = useState<AttendanceLogForList[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [tableLoading, setTableLoading] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  
  // Staff selector for calendar tab
  const [selectedStaffId, setSelectedStaffId] = useState<string>('');
  
  // Dialog states
  const [editDialog, setEditDialog] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [createDialog, setCreateDialog] = useState(false);
  const [bulkEntryDialog, setBulkEntryDialog] = useState(false);
  const [selectedAttendance, setSelectedAttendance] = useState<AttendanceLogForList | null>(null);
  
  // Filter states
  const { searchTerm, debouncedSearchTerm, setSearchTerm } = useDebouncedSearch({ delay: 500 });
  const [filterStaffId, setFilterStaffId] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  
  // Sorting with hook
  const { sortBy, sortOrder, toggleSort } = useSortableTable<'date' | 'staff' | 'hours'>({ 
    initialSortBy: 'date' 
  });

  // Server-side pagination
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

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchTerm, filterStaffId, filterStatus, dateFilter, startDateISO, endDateISO]);

  useEffect(() => {
    if (profile?.shop_id) {
      loadStaff();
      loadData();
    } else if (profile !== undefined) {
      setInitialLoading(false);
    }
  }, [profile?.shop_id, dateFilter, startDateISO, endDateISO, filterStaffId, filterStatus]);

  // Reload data when pagination/sort changes (but not for initial triggers)
  useEffect(() => {
    if (profile?.shop_id && !initialLoading) {
      loadData();
    }
  }, [currentPage, itemsPerPage, sortBy, sortOrder, debouncedSearchTerm]);

  const loadStaff = async () => {
    if (!profile?.shop_id) return;
    const { data: staffData } = await supabase
      .from('profiles')
      .select('id, full_name, role, shop_id')
      .eq('shop_id', profile.shop_id)
      .not('role', 'in', '(owner,superadmin)')
      .order('full_name');

    setStaff((staffData as unknown as StaffMember[]) || []);
    if (staffData && staffData.length > 0 && !selectedStaffId) {
      setSelectedStaffId(staffData[0].id);
    }
  };

  const loadData = async () => {
    if (!profile?.shop_id) return;
    
    try {
      setTableLoading(true);

      const fromStr = startDateISO?.split('T')[0] ?? null;
      const toStr = endDateISO.split('T')[0];

      // If searching by name, find matching staff IDs first
      let matchingStaffIds: string[] | null = null;
      if (debouncedSearchTerm) {
        const { data: staffMatches } = await supabase
          .from('profiles')
          .select('id')
          .eq('shop_id', profile.shop_id)
          .not('role', 'in', '(owner,superadmin)')
          .ilike('full_name', `%${debouncedSearchTerm}%`);

        matchingStaffIds = staffMatches?.map(s => s.id) || [];
        if (matchingStaffIds.length === 0) {
          setLogs([]);
          setTotalCount(0);
          setTableLoading(false);
          setInitialLoading(false);
          return;
        }
      }

      // Build query with filters
      let query = supabase
        .from('attendance_logs')
        .select('*, staff:profiles!attendance_logs_staff_id_fkey(full_name, role), edited_by_profile:profiles!attendance_logs_edited_by_fkey(full_name)', { count: 'exact' })
        .eq('shop_id', profile.shop_id)
        .lte('date', toStr)
        .is('deleted_at', null);

      if (fromStr) {
        query = query.gte('date', fromStr);
      }

      // Apply search filter via staff IDs
      if (matchingStaffIds && matchingStaffIds.length > 0) {
        query = query.in('staff_id', matchingStaffIds);
      }

      // Apply staff filter
      if (filterStaffId !== 'all') {
        query = query.eq('staff_id', filterStaffId);
      }

      // Apply status filter
      if (filterStatus === 'in-progress') {
        query = query.is('clock_out', null);
      } else if (filterStatus === 'completed') {
        query = query.not('clock_out', 'is', null);
      } else if (filterStatus === 'manual') {
        query = query.eq('is_manual_entry', true);
      } else if (filterStatus === 'edited') {
        query = query.not('edited_at', 'is', null);
      }

      // Apply server-side sorting (hours is computed, so we sort by clock_in as proxy)
      let orderColumn = 'date';
      if (sortBy === 'staff') {
        // Can't easily sort by joined column; sort client-side below
        orderColumn = 'date';
      } else if (sortBy === 'hours') {
        orderColumn = 'clock_in';
      }
      query = query.order(orderColumn, { ascending: sortOrder === 'asc' });

      // Apply pagination
      const { data: logsData, count, error } = await query.range(from, to);

      if (error) throw error;

      // Filter out owner/superadmin logs that may have slipped through joins
      let filtered = (logsData || []).filter(
        log => log.staff?.role !== 'owner' && log.staff?.role !== 'superadmin'
      );

      // Client-side sort for staff name or hours (can't do server-side on computed/joined)
      if (sortBy === 'staff' || sortBy === 'hours') {
        filtered = [...filtered].sort((a, b) => {
          let comparison = 0;
          if (sortBy === 'staff') {
            comparison = (a.staff?.full_name || '').localeCompare(b.staff?.full_name || '');
          } else if (sortBy === 'hours') {
            const hoursA = parseFloat(calculateHours(a.clock_in, a.clock_out, a.total_break_minutes));
            const hoursB = parseFloat(calculateHours(b.clock_in, b.clock_out, b.total_break_minutes));
            comparison = hoursA - hoursB;
          }
          return sortOrder === 'asc' ? comparison : -comparison;
        });
      }

      setLogs(filtered);
      setTotalCount(count || 0);
    } catch (error) {
      console.error('Error loading attendance:', error);
    } finally {
      setTableLoading(false);
      setInitialLoading(false);
    }
  };

  const getStatusBadge = (log: any) => {
    const badges = [];
    
    if (!log.clock_out) {
      badges.push(
        <Badge key="in-progress" variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300">
          In Progress
        </Badge>
      );
    }
    
    if (log.is_manual_entry) {
      badges.push(
        <Badge key="manual" variant="outline" className="bg-blue-50 text-blue-700 border-blue-300">
          Manual
        </Badge>
      );
    }
    
    if (log.edited_at) {
      badges.push(
        <Badge key="edited" variant="outline" className="bg-orange-50 text-orange-700 border-orange-300">
          Edited
        </Badge>
      );
    }
    
    return badges.length > 0 ? <div className="flex gap-1">{badges}</div> : null;
  };

  const handleEdit = (log: any) => {
    setSelectedAttendance(log);
    setEditDialog(true);
  };

  const handleDelete = (log: any) => {
    setSelectedAttendance(log);
    setDeleteDialog(true);
  };

  const handleCreateNew = () => {
    setCreateDialog(true);
  };

  const handleRefresh = async () => {
    await loadData();
  };

  // Build filter chips for active filters
  const filterChips: FilterChip[] = [];
  if (dateFilter !== 'week') filterChips.push({ label: 'Date', value: dateFilter, onClear: () => { setDateFilter('week'); setCurrentPage(1); }, className: 'capitalize' });
  if (filterStaffId !== 'all') filterChips.push({ label: 'Staff', value: staff.find(s => s.id === filterStaffId)?.full_name || filterStaffId, onClear: () => { setFilterStaffId('all'); setCurrentPage(1); } });
  if (filterStatus !== 'all') filterChips.push({ label: 'Status', value: filterStatus, onClear: () => { setFilterStatus('all'); setCurrentPage(1); }, className: 'capitalize' });
  if (debouncedSearchTerm) filterChips.push({ label: 'Search', value: `"${debouncedSearchTerm}"`, onClear: () => { setSearchTerm(''); setCurrentPage(1); } });

  // Skeleton for initial load
  if (initialLoading) {
    return (
      <div className="space-y-4 md:space-y-6">
        <div className="h-9 w-40 bg-muted animate-pulse rounded-md" />
        <div className="space-y-2">
          <div className="h-8 w-64 bg-muted animate-pulse rounded" />
          <div className="h-4 w-80 bg-muted animate-pulse rounded" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="rounded-lg border p-3 md:p-4 animate-pulse">
              <div className="h-3 w-16 bg-muted rounded mb-2" />
              <div className="h-7 w-10 bg-muted rounded" />
            </div>
          ))}
        </div>
        <div className="rounded-lg border p-4 animate-pulse space-y-3">
          <div className="h-5 w-48 bg-muted rounded" />
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-10 bg-muted rounded" />
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
            <Clock className="h-6 w-6" />
          </div>
          <div className="absolute -left-1.5 -top-1.5 bg-background border rounded-full p-1 shadow-sm group-hover:scale-110 transition-transform">
            <ArrowLeft className="h-3 w-3 text-muted-foreground" />
          </div>
        </button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Staff Attendance</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Monitor staff attendance and work hours</p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="calendar" className="space-y-4">
        <TabsList>
          <TabsTrigger value="calendar">Calendar</TabsTrigger>
          <TabsTrigger value="logs">Attendance Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="calendar" className="space-y-4">
          {selectedStaffId ? (
            <AttendanceCalendar 
              staffId={selectedStaffId}
              staff={staff}
              onStaffChange={setSelectedStaffId}
            />
          ) : (
            <Card>
              <CardContent className="py-12">
                <div className="text-center text-muted-foreground">
                  {staff.length === 0 ? 'No staff members found' : 'Select a staff member to view their attendance calendar'}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="logs" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="space-y-4">
                {/* Title row with action buttons */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <CardTitle className="text-lg">Attendance Logs</CardTitle>
                    <CardDescription className="text-sm mt-0.5">
                      {totalCount} {totalCount === 1 ? 'record' : 'records'}{filterStaffId !== 'all' ? ` for ${staff.find(m => m.id === filterStaffId)?.full_name}` : ''}{filterStatus !== 'all' ? ` (${filterStatus})` : ''}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <ExportButton
                      data={logs.map(log => ({
                        'Date': formatDate(log.date),
                        'Staff': log.staff?.full_name,
                        'Clock In': log.clock_in ? formatTime(log.clock_in) : '-',
                        'Clock Out': log.clock_out ? formatTime(log.clock_out) : 'In progress',
                        'Break (min)': log.total_break_minutes || 0,
                        'Hours': calculateHours(log.clock_in || '', log.clock_out, log.total_break_minutes ?? 0),
                      }))}
                      filename="attendance-report"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setBulkEntryDialog(true)}
                      className={s.btnAnimation}
                    >
                      <Users className="mr-1.5 h-3.5 w-3.5" />
                      Bulk Entry
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleCreateNew}
                      className={`${s.primaryGradient} ${s.primaryGradientHover} text-white ${s.btnAnimation}`}
                    >
                      <Plus className="mr-1.5 h-3.5 w-3.5" />
                      Add Record
                    </Button>
                  </div>
                </div>

                {/* Search + Staff + Status dropdowns */}
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="relative flex-1 min-w-0">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by staff name..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9 text-sm"
                    />
                  </div>
                  <Select value={filterStaffId} onValueChange={(v) => { setFilterStaffId(v); setCurrentPage(1); }}>
                    <SelectTrigger className="w-full sm:w-[180px]">
                      <SelectValue placeholder="All Staff" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Staff</SelectItem>
                      {staff.map((member) => (
                        <SelectItem key={member.id} value={member.id}>
                          {member.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={filterStatus} onValueChange={(v) => { setFilterStatus(v); setCurrentPage(1); }}>
                    <SelectTrigger className="w-full sm:w-[160px]">
                      <SelectValue placeholder="All Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="in-progress">In Progress</SelectItem>
                      <SelectItem value="manual">Manual Entries</SelectItem>
                      <SelectItem value="edited">Edited Records</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Date range */}
                <DateRangeFilter
                  value={dateFilter}
                  onChange={setDateFilter}
                  customRange={customRange}
                  onCustomRangeChange={setCustomRange}
                />

                {/* Filter chips */}
                <FilterChips
                  chips={filterChips}
                  onClearAll={() => { setFilterStaffId('all'); setFilterStatus('all'); setSearchTerm(''); setDateFilter('week'); setCurrentPage(1); }}
                />
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Table */}
              <div className="overflow-x-auto -mx-6 px-6 relative">
                {tableLoading && (
                  <div className="absolute inset-0 bg-background/60 z-10 flex items-center justify-center rounded-md">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Loading…
                    </div>
                  </div>
                )}
                {logs.length === 0 && !tableLoading ? (
                  <div className="text-center py-12">
                    <Clock className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                    <p className="text-sm text-muted-foreground mb-1">
                      {searchTerm || filterStaffId !== 'all' || filterStatus !== 'all'
                        ? 'No attendance records match the selected filters'
                        : 'No attendance records found'
                      }
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {searchTerm || filterStaffId !== 'all' || filterStatus !== 'all'
                        ? 'Try adjusting your filters or date range'
                        : 'Click "Add Record" to create one'
                      }
                    </p>
                  </div>
                ) : (
                  <table className="w-full min-w-[800px]">
                    <thead>
                      <tr className="border-b text-xs md:text-sm">
                        <SortableHeader column="date" sortBy={sortBy} sortOrder={sortOrder} onSort={toggleSort} minWidth="100px">
                          Date
                        </SortableHeader>
                        <SortableHeader column="staff" sortBy={sortBy} sortOrder={sortOrder} onSort={toggleSort} minWidth="120px">
                          Staff
                        </SortableHeader>
                        <th className="text-left py-3 px-3 font-medium min-w-[90px]">Clock In</th>
                        <th className="text-left py-3 px-3 font-medium min-w-[90px]">Clock Out</th>
                        <th className="text-left py-3 px-3 font-medium min-w-[100px]">Status</th>
                        <SortableHeader column="hours" sortBy={sortBy} sortOrder={sortOrder} onSort={toggleSort} align="right" minWidth="80px">
                          Hours
                        </SortableHeader>
                        <th className="text-center py-3 px-3 font-medium min-w-[80px]">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {logs.map((log, idx) => {
                        const rowTint = !log.clock_out ? s.rowTint.inProgress
                          : log.is_manual_entry ? s.rowTint.manual
                          : '';
                        return (
                          <tr
                            key={log.id}
                            className={`border-b hover:bg-muted/50 transition-colors animate-stagger-fade-in ${rowTint}`}
                            style={{ '--row-index': idx } as React.CSSProperties}
                          >
                            <td className="py-3 px-3 text-sm">{formatDate(log.date)}</td>
                            <td className="py-3 px-3">
                              <div className="text-sm font-medium">{log.staff?.full_name}</div>
                              {log.edited_at && (
                                <div className="text-xs text-muted-foreground">
                                  Edited by {log.edited_by_profile?.full_name}
                                </div>
                              )}
                            </td>
                            <td className="py-3 px-3 text-sm">{log.clock_in ? formatTime(log.clock_in) : '-'}</td>
                            <td className="py-3 px-3 text-sm">
                              {log.clock_out ? (
                                formatTime(log.clock_out)
                              ) : (
                                <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300">
                                  In Progress
                                </Badge>
                              )}
                            </td>
                            <td className="py-3 px-3">
                              {getStatusBadge(log)}
                            </td>
                            <td className="py-3 px-3 text-right font-semibold text-sm">
                              {calculateHours(log.clock_in || '', log.clock_out, log.total_break_minutes ?? 0)} hrs
                            </td>
                            <td className="py-3 px-3">
                              <div className="flex items-center justify-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleEdit(log)}
                                  title="Edit attendance"
                                  className={`h-9 w-9 p-0 ${s.btnAnimation}`}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDelete(log)}
                                  title="Delete attendance"
                                  className={`h-9 w-9 p-0 text-destructive hover:text-destructive ${s.btnAnimation}`}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
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
                <span className="flex items-center gap-1.5"><span className="w-3 h-2 rounded-sm bg-gradient-to-r from-yellow-200 to-yellow-50 border-l-2 border-l-yellow-500" /> In Progress</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-2 rounded-sm bg-gradient-to-r from-purple-200 to-purple-50 border-l-2 border-l-purple-500" /> Manual Entry</span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      {editDialog && selectedAttendance && (
        <AttendanceEditDialog
          open={editDialog}
          onOpenChange={setEditDialog}
          attendance={selectedAttendance}
          userId={user!.id}
          onSuccess={handleRefresh}
        />
      )}

      {deleteDialog && selectedAttendance && (
        <AttendanceDeleteDialog
          open={deleteDialog}
          onOpenChange={setDeleteDialog}
          attendance={selectedAttendance}
          userId={user!.id}
          onSuccess={handleRefresh}
        />
      )}

      {createDialog && profile?.shop_id && (
        <AttendanceCreateDialog
          open={createDialog}
          onOpenChange={setCreateDialog}
          staff={staff}
          shopId={profile.shop_id}
          userId={user!.id}
          onSuccess={handleRefresh}
        />
      )}

      {bulkEntryDialog && profile?.shop_id && (
        <AttendanceBulkEntryDialog
          open={bulkEntryDialog}
          onOpenChange={setBulkEntryDialog}
          staff={staff}
          shopId={profile.shop_id}
          userId={user!.id}
          onSuccess={handleRefresh}
        />
      )}
    </div>
  );
}
