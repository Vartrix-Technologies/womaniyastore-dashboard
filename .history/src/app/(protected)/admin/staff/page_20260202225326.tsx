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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { Users, Plus, Edit, UserX, ArrowLeft, Search, Shield } from 'lucide-react';
import type { Profile, UserRole } from '@/types';
import { useRouter } from 'next/navigation';
import { useDebouncedSearch } from '@/hooks';
import { UserManagement } from '@/components/admin/UserManagement';

export default function StaffPage() {
  const { profile, refreshProfile, isSuperadmin } = useAuth();
  const router = useRouter();
  const [staff, setStaff] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<Profile | null>(null);
  const { searchTerm, debouncedSearchTerm, setSearchTerm } = useDebouncedSearch({ delay: 300 });
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [roleFilter, setRoleFilter] = useState<'all' | UserRole>('all');
  const [viewMode, setViewMode] = useState<'table' | 'create'>('table');
  
  // Form state
  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
    role: 'staff' as UserRole,
    max_discount_percent: 0,
    is_active: true,
  });

  useEffect(() => {
    if (profile?.shop_id) {
      loadStaff();
    } else if (profile !== undefined) {
      // Profile loaded but no shop_id
      setLoading(false);
    }
  }, [profile?.shop_id]);

  const loadStaff = async () => {
    if (!profile?.shop_id) return;
    
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('shop_id', profile.shop_id)
        .neq('role', 'superadmin') // Show all roles except superadmin
        .order('created_at', { ascending: false });

      if (error) throw error;
      setStaff(data || []);
    } catch (error) {
      console.error('Error loading staff:', error);
      toast.error('Failed to load staff');
    } finally {
      setLoading(false);
    }
  };

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
    if (!formData.full_name.trim()) {
      toast.error('Please enter full name');
      return;
    }

    try {
      if (editingStaff) {
        // Update existing staff
        console.log('Updating staff with data:', {
          max_discount_percent: formData.max_discount_percent,
          id: editingStaff.id
        });
        
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

        console.log('Update result:', { data, error });

        if (error) throw error;
        
        // If editing current user's own profile, reload to refresh the profile in context
        if (editingStaff.id === profile?.id) {
          toast.success('Your profile updated successfully. Reloading...');
          await new Promise(resolve => setTimeout(resolve, 1000));
          window.location.reload();
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
    } catch (error: any) {
      console.error('Error saving staff:', error);
      toast.error(error.message || 'Failed to save staff');
    }
  };

  const handleToggleActive = async (member: Profile) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_active: !member.is_active })
        .eq('id', member.id);

      if (error) throw error;
      
      toast.success(`Staff ${!member.is_active ? 'activated' : 'deactivated'}`);
      await loadStaff();
    } catch (error: any) {
      console.error('Error toggling status:', error);
      toast.error(error.message || 'Failed to update status');
    }
  };

  // Filter staff based on search and filters
  const filteredStaff = staff.filter((member) => {
    const matchesSearch = member.full_name.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
                         member.phone?.toLowerCase().includes(debouncedSearchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || 
                         (statusFilter === 'active' && member.is_active) ||
                         (statusFilter === 'inactive' && !member.is_active);
    const matchesRole = roleFilter === 'all' || member.role === roleFilter;
    
    return matchesSearch && matchesStatus && matchesRole;
  });

  const stats = {
    total: staff.length,
    active: staff.filter(s => s.is_active).length,
    admin: staff.filter(s => ['admin', 'owner', 'superadmin'].includes(s.role)).length,
    regularStaff: staff.filter(s => s.role === 'staff').length,
  };

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Back Button */}
      <Button
        variant="ghost"
        onClick={() => viewMode === 'create' ? setViewMode('table') : router.push('/admin')}
        className="text-teal-600 hover:text-teal-700 hover:bg-teal-50 transition-all"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        {viewMode === 'create' ? 'Back to Staff List' : 'Back to Dashboard'}
      </Button>

      {/* Show UserManagement for superadmins when in create mode */}
      {viewMode === 'create' && isSuperadmin ? (
        <UserManagement currentShopId={profile?.shop_id || undefined} />
      ) : (
        <>
          {/* Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Staff Management</h1>
              <p className="text-muted-foreground mt-1">Manage staff members and permissions</p>
            </div>
            <Button 
              onClick={handleAddStaff}
              className="bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-600 hover:to-cyan-700 text-white hover:scale-105 active:scale-95 transition-all"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Staff
            </Button>
          </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <Card 
          className="cursor-pointer hover:shadow-lg transition-all hover:scale-105 active:scale-95"
          onClick={() => {
            setStatusFilter('all');
            setRoleFilter('all');
          }}
        >
          <CardHeader className="pb-2">
            <CardDescription>Total Staff</CardDescription>
            <CardTitle className="text-lg">{stats.total}</CardTitle>
          </CardHeader>
        </Card>
        <Card 
          className="cursor-pointer hover:shadow-lg transition-all hover:scale-105 active:scale-95"
          onClick={() => {
            setStatusFilter('active');
            setRoleFilter('all');
          }}
        >
          <CardHeader className="pb-2">
            <CardDescription>Active</CardDescription>
            <CardTitle className="text-lg text-green-600">{stats.active}</CardTitle>
          </CardHeader>
        </Card>
        <Card 
          className="cursor-pointer hover:shadow-lg transition-all hover:scale-105 active:scale-95"
          onClick={() => {
            setStatusFilter('all');
            setRoleFilter('admin');
          }}
        >
          <CardHeader className="pb-2">
            <CardDescription>Admins</CardDescription>
            <CardTitle className="text-lg text-blue-600">{stats.admin}</CardTitle>
          </CardHeader>
        </Card>
        <Card 
          className="cursor-pointer hover:shadow-lg transition-all hover:scale-105 active:scale-95"
          onClick={() => {
            setStatusFilter('all');
            setRoleFilter('staff');
          }}
        >
          <CardHeader className="pb-2">
            <CardDescription>Staff</CardDescription>
            <CardTitle className="text-lg text-purple-600">{stats.regularStaff}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search by name or phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Status Filter Tabs */}
          <Tabs value={statusFilter} onValueChange={(value) => setStatusFilter(value as any)}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="all">All Staff</TabsTrigger>
              <TabsTrigger value="active">Active</TabsTrigger>
              <TabsTrigger value="inactive">Inactive</TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Role Filter */}
          <div className="flex items-center gap-2">
            <Label className="text-sm font-medium whitespace-nowrap">Filter by Role:</Label>
            <Select value={roleFilter} onValueChange={(value) => setRoleFilter(value as any)}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="staff">Staff</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="owner">Owner</SelectItem>
                {profile?.role === 'superadmin' && (
                  <SelectItem value="superadmin">Superadmin</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Staff List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Staff Members ({filteredStaff.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <div className="min-w-[600px]">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2 text-sm font-medium">Name</th>
                  <th className="text-left p-2 text-sm font-medium">Phone</th>
                  <th className="text-left p-2 text-sm font-medium">Role</th>
                  <th className="text-left p-2 text-sm font-medium">Max Discount</th>
                  <th className="text-left p-2 text-sm font-medium">Status</th>
                  <th className="text-right p-2 text-sm font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="text-center p-8">
                      <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
                    </td>
                  </tr>
                ) : filteredStaff.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center p-8 text-muted-foreground">
                      {searchTerm || statusFilter !== 'all' || roleFilter !== 'all' 
                        ? 'No staff members match the selected filters'
                        : 'No staff members found'
                      }
                    </td>
                  </tr>
                ) : (
                  filteredStaff.map((member) => (
                    <tr key={member.id} className="border-b hover:bg-muted/50 transition-colors">
                      <td className="p-2 font-medium">{member.full_name}</td>
                      <td className="p-2 text-sm">{member.phone || '-'}</td>
                      <td className="p-2">
                        <Badge variant={
                          member.role === 'superadmin' ? 'default' :
                          member.role === 'owner' ? 'default' :
                          member.role === 'admin' ? 'secondary' : 'outline'
                        }>
                          {member.role}
                        </Badge>
                      </td>
                      <td className="p-2">{member.max_discount_percent}%</td>
                      <td className="p-2">
                        <Badge variant={member.is_active ? 'default' : 'secondary'}>
                          {member.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td className="p-2 text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEditStaff(member)}
                            className="h-11 hover:scale-105 active:scale-95 transition-all"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant={member.is_active ? 'destructive' : 'default'}
                            onClick={() => handleToggleActive(member)}
                            className="h-11 hover:scale-105 active:scale-95 transition-all"
                          >
                            <UserX className="h-4 w-4" />
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
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    placeholder="Enter full name"
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label htmlFor="phone" className="text-sm font-medium">Phone</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+91XXXXXXXXXX"
                    className="mt-1.5"
                  />
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
                    onChange={(e) =>
                      setFormData({ ...formData, max_discount_percent: parseFloat(e.target.value) || 0 })
                    }
                    placeholder="0-100"
                    className="mt-1.5"
                  />
                </div>
              </div>
            </div>

            {/* Status Section */}
            <div>
              <h3 className="text-lg font-semibold mb-3">Account Status</h3>
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <Label htmlFor="is_active" className="text-sm font-medium cursor-pointer">
                    Active Status
                  </Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Inactive staff members cannot log in to the system
                  </p>
                </div>
                <Switch
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
              </div>
            </div>
          </div>
          
          <DialogFooter className="gap-2">
            <Button 
              variant="outline" 
              onClick={() => setDialogOpen(false)}
              className="hover:scale-105 active:scale-95 transition-all"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit}
              className="bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-600 hover:to-cyan-700 text-white hover:scale-105 active:scale-95 transition-all"
            >
              {editingStaff ? 'Update' : 'Add'} Staff
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
