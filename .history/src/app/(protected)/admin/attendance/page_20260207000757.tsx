'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { DateRangePicker } from '@/components/shared/DateRangePicker';
import { ExportButton } from '@/components/shared/ExportButton';
import { StatsCardGrid } from '@/components/shared/StatsCardGrid';
import { EmptyState } from '@/components/shared/EmptyState';
import { formatTime, formatDate } from '@/lib/formatters';
import { calculateHours } from '@/lib/utils';
import { useServerPagination, useSortableTable, useDebouncedSearch } from '@/hooks';
import { SortableHeader } from '@/components/shared/SortableHeader';
import { DateRange } from 'react-day-picker';
import { Users, Clock, Calendar as CalendarIcon, Edit, Trash2, Plus, ArrowLeft, Search, ChevronLeft, ChevronRight, ChevronFirst, ChevronLast, RefreshCw, ClipboardList, UserCheck, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { AttendanceCalendar } from '@/components/staff/AttendanceCalendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AttendanceEditDialog } from '@/components/admin/AttendanceEditDialog';
import { AttendanceDeleteDialog } from '@/components/admin/AttendanceDeleteDialog';
import { AttendanceCreateDialog } from '@/components/admin/AttendanceCreateDialog';
import { AttendanceBulkEntryDialog } from '@/components/admin/AttendanceBulkEntryDialog';
import { Input } from '@/components/ui/input';
import { useRouter } from 'next/navigation';
import type { AttendanceLogForList, StaffMember } from '@/types';

export default function AdminAttendancePage() {
  const { profile, user } = useAuth();
  const router = useRouter();
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: new Date(new Date().setDate(new Date().getDate() - 7)),
    to: new Date(),
  });
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

  // Stats computed from the complete dataset (fetched separately)
  const [stats, setStats] = useState({
    totalRecords: 0,
    avgHours: '0.0',
    inProgress: 0,
    manualEntries: 0,
  });

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchTerm, filterStaffId, filterStatus, dateRange]);

  useEffect(() => {
    if (profile?.shop_id && dateRange?.from && dateRange?.to) {
      loadStaff();
      loadData();
      loadStats();
    } else if (profile !== undefined) {
      setInitialLoading(false);
    }
  }, [profile?.shop_id, dateRange, filterStaffId, filterStatus]);

  // Reload data when pagination/sort changes (but not for initial triggers)
  useEffect(() => {
    if (profile?.shop_id && dateRange?.from && dateRange?.to && !initialLoading) {
      loadData();
    }
  }, [currentPage, itemsPerPage, sortBy, sortOrder, debouncedSearchTerm]);

  const loadStaff = async () => {
    if (!profile?.shop_id) return;
    const { data: staffData } = await supabase
      .from('profiles')
      .select('*')
      .eq('shop_id', profile.shop_id)
      .not('role', 'in', '(owner,superadmin)')
      .order('full_name');

    setStaff(staffData || []);
    if (staffData && staffData.length > 0 && !selectedStaffId) {
      setSelectedStaffId(staffData[0].id);
    }
  };

  const loadStats = async () => {
    if (!profile?.shop_id || !dateRange?.from || !dateRange?.to) return;

    try {
      const fromStr = dateRange.from.toISOString().split('T')[0];
      const toDate = new Date(dateRange.to);
      toDate.setHours(23, 59, 59, 999);
      const toStr = toDate.toISOString().split('T')[0];

      // Fetch all logs for stats (unfiltered by staff/status for overview)
      const { data } = await supabase
        .from('attendance_logs')
        .select('clock_in, clock_out, total_break_minutes, is_manual_entry, staff:profiles!attendance_logs_staff_id_fkey(role)')
        .eq('shop_id', profile.shop_id)
        .gte('date', fromStr)
        .lte('date', toStr)
        .is('deleted_at', null);

      const filtered = (data || []).filter(
        log => log.staff?.role !== 'owner' && log.staff?.role !== 'superadmin'
      );

      const totalRecords = filtered.length;
      const inProgress = filtered.filter(l => !l.clock_out).length;
      const manualEntries = filtered.filter(l => l.is_manual_entry).length;

      let totalHours = 0;
      filtered.forEach(l => {
        totalHours += parseFloat(calculateHours(l.clock_in, l.clock_out, l.total_break_minutes ?? 0));
      });
      const avgHours = totalRecords > 0 ? (totalHours / totalRecords).toFixed(1) : '0.0';

      setStats({ totalRecords, avgHours, inProgress, manualEntries });
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const loadData = async () => {
    if (!profile?.shop_id || !dateRange?.from || !dateRange?.to) return;
    
    try {
      setTableLoading(true);

      const fromStr = dateRange.from.toISOString().split('T')[0];
      const toDate = new Date(dateRange.to);
      toDate.setHours(23, 59, 59, 999);
      const toStr = toDate.toISOString().split('T')[0];

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
        .gte('date', fromStr)
        .lte('date', toStr)
        .is('deleted_at', null);

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
    await loadStats();
  };

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
    <div className="space-y-4 md:space-y-6">
      {/* Back Button */}
      <Button
        variant="ghost"
        onClick={() => router.push('/admin')}
        className="text-teal-600 hover:text-teal-700 hover:bg-teal-50 transition-all"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Dashboard
      </Button>

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Staff Attendance</h1>
          <p className="text-muted-foreground mt-1">Monitor staff attendance and work hours</p>
        </div>
      </div>

      {/* Stats Cards */}
      <StatsCardGrid
        stats={[
          {
            label: 'Total Records',
            value: stats.totalRecords,
            icon: ClipboardList,
            iconColor: 'text-teal-500',
          },
          {
            label: 'Avg Hours/Day',
            value: `${stats.avgHours}h`,
            icon: Clock,
            iconColor: 'text-blue-500',
            valueColor: 'text-blue-600',
          },
          {
            label: 'In Progress',
            value: stats.inProgress,
            icon: UserCheck,
            iconColor: 'text-yellow-500',
            valueColor: 'text-yellow-600',
            isActive: filterStatus === 'in-progress',
            activeClassName: 'border-l-yellow-500 bg-yellow-50 dark:bg-yellow-950/30',
            onClick: () => setFilterStatus(filterStatus === 'in-progress' ? 'all' : 'in-progress'),
          },
          {
            label: 'Manual Entries',
            value: stats.manualEntries,
            icon: AlertCircle,
            iconColor: 'text-orange-500',
            valueColor: 'text-orange-600',
            isActive: filterStatus === 'manual',
            activeClassName: 'border-l-orange-500 bg-orange-50 dark:bg-orange-950/30',
            onClick: () => setFilterStatus(filterStatus === 'manual' ? 'all' : 'manual'),
          },
        ]}
      />

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
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm text-muted-foreground">
              Showing {totalCount > 0 ? startItem : 0} – {endItem} of {totalCount} {totalCount === 1 ? 'record' : 'records'}
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant="outline"
                onClick={() => setBulkEntryDialog(true)}
              >
                <Users className="mr-2 h-4 w-4" />
                Bulk Entry
              </Button>
              <Button 
                onClick={handleCreateNew}
                className="bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-600 hover:to-cyan-700 text-white hover:scale-105 active:scale-95 transition-all"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Attendance
              </Button>
            </div>
          </div>

          {/* Filters Row */}
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-4">
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="Search by staff name..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>

                {/* Filters */}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                  <div className="w-full">
                    <Label className="text-sm font-medium mb-2 block">Date Range</Label>
                    <div className="max-w-full overflow-hidden">
                      <DateRangePicker dateRange={dateRange} onDateRangeChange={setDateRange} />
                    </div>
                  </div>

                  <div className="w-full">
                    <Label className="text-sm font-medium mb-2 block">Filter by Staff</Label>
                    <Select value={filterStaffId} onValueChange={setFilterStaffId}>
                      <SelectTrigger>
                        <SelectValue placeholder="All staff" />
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
                  </div>

                  <div className="w-full">
                    <Label className="text-sm font-medium mb-2 block">Filter by Status</Label>
                    <Select value={filterStatus} onValueChange={setFilterStatus}>
                      <SelectTrigger>
                        <SelectValue placeholder="All status" />
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

                  <div className="flex items-end w-full">
                    <Button
                      onClick={() => {
                        setSearchTerm('');
                        setFilterStaffId('all');
                        setFilterStatus('all');
                      }}
                      variant="outline"
                      className="w-full hover:scale-105 active:scale-95 transition-all"
                    >
                      Clear Filters
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Logs Table */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Attendance Logs ({totalCount})</CardTitle>
                <ExportButton 
                  data={logs.map(log => ({
                    'Date': formatDate(log.date),
                    'Staff': log.staff?.full_name,
                    'Clock In': formatTime(log.clock_in),
                    'Clock Out': log.clock_out ? formatTime(log.clock_out) : 'In progress',
                    'Break (min)': log.total_break_minutes || 0,
                    'Hours': calculateHours(log.clock_in, log.clock_out, log.total_break_minutes),
                  }))} 
                  filename="attendance-report" 
                />
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto relative">
                {/* Subtle loading overlay */}
                {tableLoading && (
                  <div className="absolute inset-0 bg-background/60 z-10 flex items-center justify-center rounded-md">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Loading…
                    </div>
                  </div>
                )}
                <div className="min-w-[800px]">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <SortableHeader column="date" sortBy={sortBy} sortOrder={sortOrder} onSort={toggleSort}>
                        Date
                      </SortableHeader>
                      <SortableHeader column="staff" sortBy={sortBy} sortOrder={sortOrder} onSort={toggleSort}>
                        Staff
                      </SortableHeader>
                      <th className="text-left p-2 text-sm font-medium">Clock In</th>
                      <th className="text-left p-2 text-sm font-medium">Clock Out</th>
                      <th className="text-left p-2 text-sm font-medium">Status</th>
                      <SortableHeader column="hours" sortBy={sortBy} sortOrder={sortOrder} onSort={toggleSort} align="right">
                        Hours
                      </SortableHeader>
                      <th className="text-right p-2 text-sm font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.length === 0 && !tableLoading ? (
                      <EmptyState
                        icon={Clock}
                        title={searchTerm || filterStaffId !== 'all' || filterStatus !== 'all'
                          ? 'No attendance records match the selected filters'
                          : 'No attendance records found'
                        }
                        description={searchTerm || filterStaffId !== 'all' || filterStatus !== 'all'
                          ? 'Try adjusting your filters or date range'
                          : 'Click "Add Attendance" to create a record'
                        }
                        colSpan={7}
                      />
                    ) : (
                      logs.map((log) => (
                        <tr key={log.id} className="border-b hover:bg-muted/50 transition-colors">
                          <td className="p-2">{formatDate(log.date)}</td>
                          <td className="p-2">
                            <div className="font-medium">{log.staff?.full_name}</div>
                            {log.edited_at && (
                              <div className="text-xs text-muted-foreground">
                                Edited by {log.edited_by_profile?.full_name}
                              </div>
                            )}
                          </td>
                          <td className="p-2">{formatTime(log.clock_in)}</td>
                          <td className="p-2">
                            {log.clock_out ? (
                              formatTime(log.clock_out)
                            ) : (
                              <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300">
                                In Progress
                              </Badge>
                            )}
                          </td>
                          <td className="p-2">
                            {getStatusBadge(log)}
                          </td>
                          <td className="p-2 text-right font-semibold">
                            {calculateHours(log.clock_in, log.clock_out, log.total_break_minutes)} hrs
                          </td>
                          <td className="p-2">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEdit(log)}
                                title="Edit attendance"
                                className="h-11 hover:scale-105 active:scale-95 transition-all"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(log)}
                                title="Delete attendance"
                                className="h-11 text-destructive hover:text-destructive hover:scale-105 active:scale-95 transition-all"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
                </div>
              </div>

              {/* Pagination Controls */}
              {sortedLogs.length > 0 && (
                <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>Show</span>
                    <Select
                      value={itemsPerPage.toString()}
                      onValueChange={(value) => {
                        setItemsPerPage(Number(value));
                        setCurrentPage(1);
                      }}
                    >
                      <SelectTrigger className="w-20">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="10">10</SelectItem>
                        <SelectItem value="25">25</SelectItem>
                        <SelectItem value="50">50</SelectItem>
                        <SelectItem value="100">100</SelectItem>
                        <SelectItem value="200">200</SelectItem>
                      </SelectContent>
                    </Select>
                    <span>
                      of {sortedLogs.length} records
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={goToFirstPage}
                      disabled={currentPage === 1}
                      className="h-9"
                    >
                      <ChevronFirst className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={goToPreviousPage}
                      disabled={currentPage === 1}
                      className="h-9"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm text-muted-foreground px-2">
                      Page {currentPage} of {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={goToNextPage}
                      disabled={currentPage === totalPages}
                      className="h-9"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={goToLastPage}
                      disabled={currentPage === totalPages}
                      className="h-9"
                    >
                      <ChevronLast className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
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
          onSuccess={loadData}
        />
      )}

      {deleteDialog && selectedAttendance && (
        <AttendanceDeleteDialog
          open={deleteDialog}
          onOpenChange={setDeleteDialog}
          attendance={selectedAttendance}
          userId={user!.id}
          onSuccess={loadData}
        />
      )}

      {createDialog && profile?.shop_id && (
        <AttendanceCreateDialog
          open={createDialog}
          onOpenChange={setCreateDialog}
          staff={staff}
          shopId={profile.shop_id}
          userId={user!.id}
          onSuccess={loadData}
        />
      )}

      {bulkEntryDialog && profile?.shop_id && (
        <AttendanceBulkEntryDialog
          open={bulkEntryDialog}
          onOpenChange={setBulkEntryDialog}
          staff={staff}
          shopId={profile.shop_id}
          userId={user!.id}
          onSuccess={loadData}
        />
      )}
    </div>
  );
}
