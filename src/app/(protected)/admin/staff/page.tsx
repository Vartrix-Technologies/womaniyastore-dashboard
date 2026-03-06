'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { Users, Plus, Edit, ArrowLeft, Search, MoreVertical, RefreshCw, Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { Profile, UserRole } from '@/types';
import { useRouter } from 'next/navigation';
import { useDebouncedSearch, useServerPagination, useSortableTable } from '@/hooks';
import { UserManagement } from '@/components/admin/UserManagement';
import { EmptyState } from '@/components/shared/EmptyState';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { FieldError, fieldErrorClass, useFormErrors } from '@/components/shared/FieldError';
import { StatsCardGrid } from '@/components/shared/StatsCardGrid';
import { CountUp } from '@/components/shared/CountUp';
import { SortableHeader } from '@/components/shared/SortableHeader';
import { PaginationControls } from '@/components/shared/PaginationControls';
import { FilterChips, type FilterChip } from '@/components/shared/FilterChips';
import { appConfig } from '@/lib/config/app.config';
import { getCachedStats, setCachedStats } from '@/lib/utils/stats-cache';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const s = appConfig.styles;
type StaffSortColumn = 'name' | 'phone' | 'role' | 'discount' | 'status' | 'date';

export default function StaffPage() {
  const { profile, refreshProfile, isSuperadmin } = useAuth();
  const router = useRouter();

  // Confirm dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
  }>({ open: false, title: '', description: '', onConfirm: () => {} });

  // Table data
  const [staff, setStaff] = useState<Profile[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [initialLoading, setInitialLoading] = useState(true);
  const [tableLoading, setTableLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<Profile | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'create'>('table');

  // Stats (server-side count queries)
  const [stats, setStats] = useState(() => getCachedStats('staff_stats', { total: 0, active: 0, admin: 0, regularStaff: 0 }));

  // Filters
  const { searchTerm, debouncedSearchTerm, setSearchTerm, clearSearch } = useDebouncedSearch({ delay: 300 });
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('active');
  const [roleFilter, setRoleFilter] = useState<'all' | UserRole>('all');

  // Sorting & Pagination
  const { sortBy, sortOrder, toggleSort } = useSortableTable<StaffSortColumn>({
    initialSortBy: 'date',
    initialSortOrder: 'desc',
  });
  const {
    currentPage, itemsPerPage, setCurrentPage, setItemsPerPage,
    totalPages, startItem, endItem, from, to,
  } = useServerPagination({ totalCount, initialItemsPerPage: 25 });

  // Field errors (including phone & discount)
  const { errors, validateFields, clearFieldError } = useFormErrors<'full_name' | 'phone' | 'max_discount_percent'>();

  // Form state
  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
    role: 'staff' as UserRole,
    max_discount_percent: 0,
    is_active: true,
  });

  // ─── Data Loading ─────────────────────────────────────────────── //

  const loadStats = async () => {
    if (!profile?.shop_id) return;
    try {
      const [totalRes, activeRes, adminRes, staffRes] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('shop_id', profile.shop_id).neq('role', 'superadmin'),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('shop_id', profile.shop_id).neq('role', 'superadmin').eq('is_active', true),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('shop_id', profile.shop_id).in('role', ['admin', 'owner']),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('shop_id', profile.shop_id).eq('role', 'staff'),
      ]);
      // Only update if all queries succeeded (stale-while-revalidate)
      if (!totalRes.error && !activeRes.error && !adminRes.error && !staffRes.error) {
        const newStats = {
          total: totalRes.count || 0,
          active: activeRes.count || 0,
          admin: adminRes.count || 0,
          regularStaff: staffRes.count || 0,
        };
        setStats(newStats);
        setCachedStats('staff_stats', newStats);
      }
    } catch (error) {
      // Network error / offline — keep showing previous stats
      console.warn('Staff stats fetch failed — keeping previous values:', error);
    }
  };

  const loadStaff = async () => {
    if (!profile?.shop_id) return;

    try {
      setTableLoading(true);
      let query = supabase
        .from('profiles')
        .select('*', { count: 'exact' })
        .eq('shop_id', profile.shop_id)
        .neq('role', 'superadmin');

      // Server-side search
      if (debouncedSearchTerm) {
        query = query.or(`full_name.ilike.%${debouncedSearchTerm}%,phone.ilike.%${debouncedSearchTerm}%`);
      }

      // Server-side filters
      if (statusFilter === 'active') query = query.eq('is_active', true);
      else if (statusFilter === 'inactive') query = query.eq('is_active', false);
      if (roleFilter !== 'all') query = query.eq('role', roleFilter);

      // Sorting
      let orderColumn = 'created_at';
      switch (sortBy) {
        case 'name': orderColumn = 'full_name'; break;
        case 'phone': orderColumn = 'phone'; break;
        case 'role': orderColumn = 'role'; break;
        case 'discount': orderColumn = 'max_discount_percent'; break;
        case 'status': orderColumn = 'is_active'; break;
        case 'date': orderColumn = 'created_at'; break;
      }

      const { data, error, count } = await query
        .order(orderColumn, { ascending: sortOrder === 'asc' })
        .range(from, to);

      if (error) throw error;
      setStaff(data || []);
      setTotalCount(count || 0);
    } catch (error) {
      console.error('Error loading staff:', error);
      toast.error('Failed to load staff');
    } finally {
      setTableLoading(false);
      setInitialLoading(false);
    }
  };

  // Load stats separately — only on shop_id change or after mutations
  useEffect(() => {
    if (profile?.shop_id) {
      loadStats();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.shop_id]);

  useEffect(() => {
    if (profile?.shop_id) {
      loadStaff();
    } else if (profile !== undefined) {
      setInitialLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.shop_id, debouncedSearchTerm, statusFilter, roleFilter, sortBy, sortOrder, currentPage, itemsPerPage]);

  const handleAddStaff = () => {
    if (isSuperadmin) {
      // Superadmin can create users directly
      setViewMode('create');
    } else {
      // Regular admins need superadmin to create users
      toast.info(
        'Only superadmins can create new user accounts. Please contact your superadmin to add new staff members.',
        { duration: 6000 }
      );
    }
  };

  const handleEditStaff = (member: Profile) => {
    setEditingStaff(member);
    setFormData({
      full_name: member.full_name,
      phone: member.phone || '',
      role: member.role,
      max_discount_percent: member.max_discount_percent,
      is_active: member.is_active,
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    const phoneClean = formData.phone.replace(/\s/g, '');
    const valid = validateFields({
      full_name: [!formData.full_name.trim(), 'Please enter full name'],
      phone: [!!phoneClean && !/^\+?\d{10,13}$/.test(phoneClean), 'Enter a valid phone (e.g. +91XXXXXXXXXX)'],
      max_discount_percent: [formData.max_discount_percent < 0 || formData.max_discount_percent > 100, 'Must be between 0 and 100'],
    });
    if (!valid) return;

    try {
      if (editingStaff) {
        const { data, error } = await supabase
          .from('profiles')
          .update({
            full_name: formData.full_name,
            phone: formData.phone || null,
            role: formData.role,
            max_discount_percent: formData.max_discount_percent,
            is_active: formData.is_active,
          })
          .eq('id', editingStaff.id)
          .select();

        if (error) throw error;
        
        // If editing current user's own profile, reload to refresh the profile in context
        if (editingStaff.id === profile?.id) {
          toast.success('Your profile updated successfully. Reloading...');
          await new Promise(resolve => setTimeout(resolve, 1000));
          refreshProfile();
        } else {
          toast.success('Staff updated successfully');
        }
      } else {
        // Note: Creating new users requires them to sign up first
        // This is a limitation - you can't create auth users from the client
        toast.info('Staff members must sign up through the login page first. You can then edit their details here.');
        setDialogOpen(false);
        return;
      }

      setDialogOpen(false);
      await loadStaff();
      await loadStats();
    } catch (error: any) {
      console.error('Error saving staff:', error);
      toast.error(error.message || 'Failed to save staff');
    }
  };

  const handleToggleActive = async (member: Profile) => {
    const newState = !member.is_active;
    setConfirmDialog({
      open: true,
      title: newState ? 'Activate Staff Member' : 'Deactivate Staff Member',
      description: newState
        ? `Are you sure you want to activate ${member.full_name}? They will be able to log in again.`
        : `Are you sure you want to deactivate ${member.full_name}? They will be locked out immediately.`,
      onConfirm: async () => {
        try {
          const { error } = await supabase
            .from('profiles')
            .update({ is_active: !member.is_active })
            .eq('id', member.id);

          if (error) throw error;
          
          toast.success(`Staff ${!member.is_active ? 'activated' : 'deactivated'}`);
          await loadStaff();
          await loadStats();
        } catch (error: any) {
          console.error('Error toggling status:', error);
          toast.error(error.message || 'Failed to update status');
        }
      },
    });
  };

  // ─── Filter Chips ─────────────────────────────────────────────── //

  const filterChips: FilterChip[] = [];
  if (statusFilter !== 'all') filterChips.push({ label: 'Status', value: statusFilter, onClear: () => { setStatusFilter('all'); setCurrentPage(1); }, className: 'capitalize' });
  if (roleFilter !== 'all') filterChips.push({ label: 'Role', value: roleFilter, onClear: () => { setRoleFilter('all'); setCurrentPage(1); }, className: 'capitalize' });
  if (debouncedSearchTerm) filterChips.push({ label: 'Search', value: `"${debouncedSearchTerm}"`, onClear: () => { clearSearch(); setCurrentPage(1); } });

  // ─── Initial Loading Skeleton ─────────────────────────────────── //

  if (initialLoading) {
    return (
      <div className="space-y-4 md:space-y-6">
        <div className="flex flex-col gap-3">
          <div className="h-9 w-40 bg-muted animate-pulse rounded-md" />
          <div className="space-y-2">
            <div className="h-8 w-64 bg-muted animate-pulse rounded" />
            <div className="h-4 w-80 bg-muted animate-pulse rounded" />
          </div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-3">
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
    <div className="space-y-4 md:space-y-6 animate-content-in">
      {/* Show UserManagement for superadmins when in create mode */}
      {viewMode === 'create' && isSuperadmin ? (
        <>
          <button onClick={() => setViewMode('table')} className="relative group shrink-0 w-fit">
            <div className={`p-2.5 rounded-lg ${s.headerIconGradient} text-white shadow-md group-hover:shadow-lg transition-shadow`}>
              <Users className="h-6 w-6" />
            </div>
            <div className="absolute -left-1.5 -top-1.5 bg-background border rounded-full p-1 shadow-sm group-hover:scale-110 transition-transform">
              <ArrowLeft className="h-3 w-3 text-muted-foreground" />
            </div>
          </button>
          <UserManagement currentShopId={profile?.shop_id || undefined} />
        </>
      ) : (
        <>
          {/* Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button onClick={() => router.push('/admin')} className="relative group shrink-0">
                <div className={`p-2.5 rounded-lg ${s.headerIconGradient} text-white shadow-md group-hover:shadow-lg transition-shadow`}>
                  <Users className="h-6 w-6" />
                </div>
                <div className="absolute -left-1.5 -top-1.5 bg-background border rounded-full p-1 shadow-sm group-hover:scale-110 transition-transform">
                  <ArrowLeft className="h-3 w-3 text-muted-foreground" />
                </div>
              </button>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Staff Management</h1>
                <p className="text-sm text-muted-foreground mt-0.5">Manage staff members and permissions</p>
              </div>
            </div>
            {isSuperadmin ? (
              <Button 
                onClick={handleAddStaff}
                className={`${s.primaryGradient} ${s.primaryGradientHover} text-white ${s.btnAnimation}`}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Staff
              </Button>
            ) : (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="outline"
                      className="gap-2 cursor-default opacity-70"
                      onClick={(e) => e.preventDefault()}
                    >
                      <Info className="h-4 w-4 text-muted-foreground" />
                      Add Staff
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-[220px] text-center">
                    <p className="text-xs">Contact your superadmin to add new staff members</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>

      {/* Stats */}
      <StatsCardGrid
        stats={[
          {
            label: 'Total Staff',
            value: <CountUp end={stats.total} />,
            isActive: statusFilter === 'all' && roleFilter === 'all',
            isDefault: true,
            activeClassName: `${s.statsActive.total.border} ${s.statsActive.total.bg}`,
            onClick: () => { setStatusFilter('all'); setRoleFilter('all'); setCurrentPage(1); },
          },
          {
            label: 'Active',
            value: <CountUp end={stats.active} />,
            valueColor: 'text-green-600',
            isActive: statusFilter === 'active' && roleFilter === 'all',
            activeClassName: `${s.statsActive.available.border} ${s.statsActive.available.bg}`,
            onClick: () => { setStatusFilter('active'); setRoleFilter('all'); setCurrentPage(1); },
          },
          {
            label: 'Admins',
            value: <CountUp end={stats.admin} />,
            valueColor: 'text-blue-600',
            isActive: statusFilter === 'all' && roleFilter === 'admin',
            activeClassName: `${s.statsActive.assigned.border} ${s.statsActive.assigned.bg}`,
            onClick: () => { setStatusFilter('all'); setRoleFilter('admin'); setCurrentPage(1); },
          },
          {
            label: 'Staff',
            value: <CountUp end={stats.regularStaff} />,
            valueColor: 'text-purple-600',
            isActive: statusFilter === 'all' && roleFilter === 'staff',
            activeClassName: `${s.statsActive.purple.border} ${s.statsActive.purple.bg}`,
            onClick: () => { setStatusFilter('all'); setRoleFilter('staff'); setCurrentPage(1); },
          },
        ]}
        filterHint="Click a metric to filter the table below"
      />

      {/* Staff Table — search, filters, table, pagination */}
      <Card>
        <CardHeader className="pb-3">
          <div className="space-y-4">
            <div>
              <CardTitle className="text-lg">Staff Members</CardTitle>
              <CardDescription className="text-sm mt-0.5">
                {totalCount} member{totalCount !== 1 ? 's' : ''}
                {statusFilter !== 'all' ? ` (${statusFilter})` : ''}
                {roleFilter !== 'all' ? ` · ${roleFilter}` : ''}
              </CardDescription>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or phone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 text-sm"
              />
            </div>

            <FilterChips
              chips={filterChips}
              onClearAll={() => { setStatusFilter('all'); setRoleFilter('all'); clearSearch(); setCurrentPage(1); }}
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="overflow-x-auto -mx-6 px-6 relative">
            {tableLoading && (
              <div className="absolute inset-0 bg-background/60 z-10 flex items-center justify-center rounded-md">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Loading…
                </div>
              </div>
            )}

            {staff.length === 0 && !tableLoading ? (
              <div className="text-center py-12">
                <Users className="h-12 w-12 md:h-16 md:w-16 mx-auto text-muted-foreground mb-3" />
                <p className="text-sm md:text-base text-muted-foreground">
                  {debouncedSearchTerm || statusFilter !== 'all' || roleFilter !== 'all'
                    ? 'No staff members match the selected filters'
                    : 'No staff members found'}
                </p>
              </div>
            ) : (
              <table className="w-full min-w-[700px]">
                <thead>
                  <tr className="border-b text-xs md:text-sm">
                    <SortableHeader column="name" sortBy={sortBy} sortOrder={sortOrder} onSort={toggleSort} minWidth="140px">
                      Name
                    </SortableHeader>
                    <SortableHeader column="phone" sortBy={sortBy} sortOrder={sortOrder} onSort={toggleSort} minWidth="130px">
                      Phone
                    </SortableHeader>
                    <SortableHeader column="role" sortBy={sortBy} sortOrder={sortOrder} onSort={toggleSort} minWidth="90px">
                      Role
                    </SortableHeader>
                    <SortableHeader column="discount" sortBy={sortBy} sortOrder={sortOrder} onSort={toggleSort} minWidth="110px">
                      Max Discount
                    </SortableHeader>
                    <SortableHeader column="status" sortBy={sortBy} sortOrder={sortOrder} onSort={toggleSort} minWidth="90px">
                      Status
                    </SortableHeader>
                    <th className="text-center py-3 px-3 font-medium min-w-[100px]">
                      <span className="whitespace-nowrap">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {staff.map((member, idx) => (
                    <tr key={member.id} className="border-b hover:bg-muted/50 transition-colors group animate-stagger-fade-in" style={{ '--row-index': idx } as React.CSSProperties}>
                      <td className="py-3 px-3 font-medium text-sm">{member.full_name}</td>
                      <td className="py-3 px-3 text-sm text-muted-foreground">{member.phone || '—'}</td>
                      <td className="py-3 px-3">
                        <Badge
                          variant={
                            member.role === 'superadmin' ? 'default' :
                            member.role === 'owner' ? 'default' :
                            member.role === 'admin' ? 'secondary' : 'outline'
                          }
                          className="text-xs capitalize"
                        >
                          {member.role}
                        </Badge>
                      </td>
                      <td className="py-3 px-3 text-sm font-semibold">{member.max_discount_percent}%</td>
                      <td className="py-3 px-3">
                        <Badge
                          variant={member.is_active ? 'default' : 'secondary'}
                          className="text-xs"
                        >
                          {member.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex justify-center items-center gap-2">
                          <Switch
                            checked={member.is_active}
                            onCheckedChange={() => handleToggleActive(member)}
                            disabled={member.id === profile?.id}
                            className="data-[state=checked]:bg-green-500"
                          />
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleEditStaff(member)}>
                                <Edit className="h-4 w-4 mr-2" />
                                Edit Details
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </td>
                    </tr>
                  ))}
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
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="w-[90vw] max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{editingStaff ? 'Edit Staff Member' : 'Add Staff Member'}</DialogTitle>
            <DialogDescription>
              {editingStaff
                ? 'Update staff member details and permissions'
                : 'Note: Staff must create an account first via the login page'}
            </DialogDescription>
          </DialogHeader>
          
          <Separator />
          
          <div className="space-y-4 py-2 overflow-y-auto pr-2">
            {/* Basic Information Section */}
            <div>
              <h3 className="text-lg font-semibold mb-3">Basic Information</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="full_name" className="text-sm font-medium">
                    Full Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="full_name"
                    value={formData.full_name}
                    onChange={(e) => { setFormData({ ...formData, full_name: e.target.value }); clearFieldError('full_name'); }}
                    placeholder="Enter full name"
                    className={`mt-1.5 ${fieldErrorClass(errors.full_name)}`}
                  />
                  <FieldError message={errors.full_name} />
                </div>
                <div>
                  <Label htmlFor="phone" className="text-sm font-medium">Phone</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => { setFormData({ ...formData, phone: e.target.value }); clearFieldError('phone'); }}
                    placeholder="+91XXXXXXXXXX"
                    className={`mt-1.5 ${fieldErrorClass(errors.phone)}`}
                  />
                  <FieldError message={errors.phone} />
                </div>
              </div>
            </div>

            {/* Permissions Section */}
            <div>
              <h3 className="text-lg font-semibold mb-3">Permissions & Role</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="role" className="text-sm font-medium">Role</Label>
                  <Select
                    value={formData.role}
                    onValueChange={(value: UserRole) => setFormData({ ...formData, role: value })}
                  >
                    <SelectTrigger className="mt-1.5">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="staff">Staff</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="owner">Owner</SelectItem>
                      {profile?.role === 'superadmin' && (
                        <SelectItem value="superadmin">Superadmin</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="max_discount" className="text-sm font-medium">
                    Max Discount Percent
                  </Label>
                  <Input
                    id="max_discount"
                    type="number"
                    min={0}
                    max={100}
                    value={formData.max_discount_percent}
                    onChange={(e) => {
                      setFormData({ ...formData, max_discount_percent: parseFloat(e.target.value) || 0 });
                      clearFieldError('max_discount_percent');
                    }}
                    placeholder="0-100"
                    className={`mt-1.5 ${fieldErrorClass(errors.max_discount_percent)}`}
                  />
                  <FieldError message={errors.max_discount_percent} />
                </div>
              </div>
            </div>
          </div>
          
          <DialogFooter className="gap-2">
            <Button 
              variant="outline" 
              onClick={() => setDialogOpen(false)}
              className={s.btnAnimation}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit}
              className={`${s.primaryGradient} ${s.primaryGradientHover} text-white ${s.btnAnimation}`}
            >
              {editingStaff ? 'Update' : 'Add'} Staff
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Dialog for destructive actions */}
      <ConfirmDialog
        open={confirmDialog.open}
        onOpenChange={(open) => setConfirmDialog({ ...confirmDialog, open })}
        onConfirm={confirmDialog.onConfirm}
        title={confirmDialog.title}
        description={confirmDialog.description}
        confirmText="Confirm"
        cancelText="Cancel"
        variant="destructive"
      />
        </>
      )}
    </div>
  );
}
