'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { DateRangePicker } from '@/components/shared/DateRangePicker';
import { ExportButton } from '@/components/shared/ExportButton';
import { formatTime, formatDate } from '@/lib/formatters';
import { calculateHours } from '@/lib/utils';
import { useServerPagination, useSortableTable, useDebouncedSearch } from '@/hooks';
import { SortableHeader } from '@/components/shared/SortableHeader';
import { DateRange } from 'react-day-picker';
import { Users, Clock, Calendar as CalendarIcon, Edit, Trash2, Plus, ArrowLeft, Search, ChevronLeft, ChevronRight, ChevronFirst, ChevronLast } from 'lucide-react';
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

export default function AdminAttendancePage() {
  const { profile, user } = useAuth();
  const router = useRouter();
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: new Date(new Date().setDate(new Date().getDate() - 7)),
    to: new Date(),
  });
  const [logs, setLogs] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Staff selector for calendar tab
  const [selectedStaffId, setSelectedStaffId] = useState<string>('');
  
  // Dialog states
  const [editDialog, setEditDialog] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [createDialog, setCreateDialog] = useState(false);
  const [bulkEntryDialog, setBulkEntryDialog] = useState(false);
  const [selectedAttendance, setSelectedAttendance] = useState<any>(null);
  
  // Filter states
  const { searchTerm, debouncedSearchTerm, setSearchTerm } = useDebouncedSearch({ delay: 500 });
  const [filterStaffId, setFilterStaffId] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  
  // Sorting with hook
  const { sortBy, sortOrder, toggleSort } = useSortableTable<'date' | 'staff' | 'hours'>({ 
    initialSortBy: 'date' 
  });


  useEffect(() => {
    if (profile?.shop_id && dateRange?.from && dateRange?.to) {
      loadData();
    } else if (profile !== undefined) {
      setLoading(false);
    }
  }, [profile?.shop_id, dateRange, filterStaffId, filterStatus]);

  const loadData = async () => {
    if (!profile?.shop_id || !dateRange?.from || !dateRange?.to) return;
    
    try {
      setLoading(true);

      const fromDate = dateRange.from.toISOString();
      const toDate = new Date(dateRange.to);
      toDate.setHours(23, 59, 59, 999);

      // Load staff (exclude owner and superadmin)
      const { data: staffData } = await supabase
        .from('profiles')
        .select('*')
        .eq('shop_id', profile.shop_id)
        .not('role', 'in', '(owner,superadmin)')
        .order('full_name');

      setStaff(staffData || []);
      
      // Set first staff as default for calendar view
      if (staffData && staffData.length > 0 && !selectedStaffId) {
        setSelectedStaffId(staffData[0].id);
      }

      // Load attendance logs (exclude owner and superadmin, exclude deleted)
      let query = supabase
        .from('attendance_logs')
        .select('*, staff:profiles!attendance_logs_staff_id_fkey(full_name, role), edited_by_profile:profiles!attendance_logs_edited_by_fkey(full_name)')
        .eq('shop_id', profile!.shop_id)
        .gte('date', dateRange.from.toISOString().split('T')[0])
        .lte('date', toDate.toISOString().split('T')[0])
        .is('deleted_at', null); // Exclude deleted records

      // Apply filters
      if (filterStaffId !== 'all') {
        query = query.eq('staff_id', filterStaffId);
      }

      if (filterStatus === 'in-progress') {
        query = query.is('clock_out', null);
      } else if (filterStatus === 'completed') {
        query = query.not('clock_out', 'is', null);
      } else if (filterStatus === 'manual') {
        query = query.eq('is_manual_entry', true);
      } else if (filterStatus === 'edited') {
        query = query.not('edited_at', 'is', null);
      }

      query = query.order('date', { ascending: false });

      const { data: logsData } = await query;

      // Filter out owner and superadmin logs
      const filteredLogs = (logsData || []).filter(
        log => log.staff?.role !== 'owner' && log.staff?.role !== 'superadmin'
      );

      setLogs(filteredLogs);
    } catch (error) {
      console.error('Error loading attendance:', error);
    } finally {
      setLoading(false);
    }
  };

  // Use shared utility - now imported from @/lib/utils
  // calculateHours is imported at the top

  const getStatusBadge = (log: any) => {
    const badges = [];
    
    // Main status
    if (!log.clock_out) {
      badges.push(
        <Badge key="in-progress" variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300">
          In Progress
        </Badge>
      );
    }
    
    // Manual entry
    if (log.is_manual_entry) {
      badges.push(
        <Badge key="manual" variant="outline" className="bg-blue-50 text-blue-700 border-blue-300">
          Manual
        </Badge>
      );
    }
    
    // Edited
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

  // Filter logs based on search
  const filteredLogs = logs.filter((log) => {
    if (debouncedSearchTerm) {
      const searchLower = debouncedSearchTerm.toLowerCase();
      return log.staff?.full_name?.toLowerCase().includes(searchLower);
    }
    return true;
  });

  // Sort logs
  const sortedLogs = [...filteredLogs].sort((a, b) => {
    let comparison = 0;
    
    if (sortBy === 'date') {
      comparison = new Date(a.date).getTime() - new Date(b.date).getTime();
    } else if (sortBy === 'staff') {
      comparison = (a.staff?.full_name || '').localeCompare(b.staff?.full_name || '');
    } else if (sortBy === 'hours') {
      const hoursA = parseFloat(calculateHours(a.clock_in, a.clock_out, a.total_break_minutes));
      const hoursB = parseFloat(calculateHours(b.clock_in, b.clock_out, b.total_break_minutes));
      comparison = hoursA - hoursB;
    }
    
    return sortOrder === 'asc' ? comparison : -comparison;
  });

  // Pagination with hook
  const {
    currentPage,
    itemsPerPage,
    setCurrentPage,
    setItemsPerPage,
    totalPages,
    goToFirstPage,
    goToLastPage,
    goToNextPage: goToNextPageHook,
    goToPrevPage,
  } = useServerPagination({ totalCount: sortedLogs.length });

  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedLogs = sortedLogs.slice(startIndex, endIndex);

  const goToNextPage = goToNextPageHook;
  const goToPreviousPage = goToPrevPage;

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
              Showing {paginatedLogs.length > 0 ? startIndex + 1 : 0} - {Math.min(endIndex, sortedLogs.length)} of {sortedLogs.length} {sortedLogs.length === 1 ? 'record' : 'records'}
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
                <CardTitle className="text-lg">Attendance Logs ({sortedLogs.length})</CardTitle>
                <ExportButton 
                  data={sortedLogs.map(log => ({
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
              <div className="overflow-x-auto">
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
                    {paginatedLogs.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center p-8 text-muted-foreground">
                          {searchTerm || filterStaffId !== 'all' || filterStatus !== 'all'
                            ? 'No attendance records match the selected filters'
                            : 'No attendance records found'
                          }
                        </td>
                      </tr>
                    ) : (
                      paginatedLogs.map((log) => (
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
    </div>
  );
}
