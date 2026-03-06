'use client';

import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { 
  Loader2, 
  UserPlus, 
  RefreshCw, 
  User, 
  Mail, 
  Phone, 
  Shield, 
  Key,
  Eye,
  EyeOff,
  AlertCircle,
  Copy,
  MoreVertical
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { appConfig } from '@/lib/config/app.config';
import { EmptyState } from '@/components/shared/EmptyState';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { FieldError, fieldErrorClass, useFormErrors } from '@/components/shared/FieldError';

const s = appConfig.styles;
const a = s.accent;

interface UserData {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  role: string;
  shop_id: string;
  shop_name: string;
  is_active: boolean;
  must_change_password: boolean;
  created_at: string;
  max_discount_percent?: number;
}

interface Shop {
  id: string;
  shop_name: string;
}

interface UserManagementProps {
  currentShopId?: string;
}

export function UserManagement({ currentShopId }: UserManagementProps) {
  const [users, setUsers] = useState<UserData[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    full_name: '',
    phone: '',
    role: 'staff' as 'staff' | 'admin' | 'owner',
    shop_id: currentShopId || '',
    max_discount_percent: 0
  });
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  // Reset password state
  const [newPassword, setNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);

  // Field errors
  const { errors, validateFields, clearFieldError } = useFormErrors<'email' | 'password' | 'full_name' | 'shop_id'>();

  // Confirm dialog state for destructive actions
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
  }>({ open: false, title: '', description: '', onConfirm: () => {} });

  // Fetch users and shops on mount
  useEffect(() => {
    fetchUsers();
    fetchShops();
  }, []);

  const fetchShops = async () => {
    try {
      const { data, error } = await supabase
        .from('shops')
        .select('id, shop_name')
        .order('shop_name');
      
      if (error) throw error;
      setShops(data || []);
      
      // Set default shop_id if only one shop
      if (data && data.length === 1 && !formData.shop_id) {
        setFormData(prev => ({ ...prev, shop_id: data[0].id }));
      }
    } catch (error) {
      console.error('Error fetching shops:', error);
    }
  };

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        toast.error('Not authenticated');
        return;
      }

      const response = await supabase.functions.invoke('create-user', {
        body: { 
          action: 'list_users',
          shop_id: currentShopId // Optional filter by shop
        }
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      if (response.data.error) {
        throw new Error(response.data.error);
      }

      setUsers(response.data.users || []);
    } catch (error: any) {
      console.error('Error fetching users:', error);
      toast.error(error.message || 'Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  // Generate random password
  const generatePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
    let password = '';
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  };

  const handleGeneratePassword = () => {
    const newPwd = generatePassword();
    setFormData(prev => ({ ...prev, password: newPwd }));
    setShowPassword(true);
  };

  const handleCopyPassword = async () => {
    try {
      await navigator.clipboard.writeText(formData.password);
      toast.success('Password copied to clipboard');
    } catch {
      toast.error('Failed to copy password');
    }
  };

  const handleCreateUser = async () => {
    // Validation
    const valid = validateFields({
      email: [!formData.email || !formData.email.includes('@'), 'Please enter a valid email address'],
      password: [!formData.password || formData.password.length < 6, 'Password must be at least 6 characters'],
      full_name: [!formData.full_name.trim(), 'Please enter the full name'],
      shop_id: [!formData.shop_id, 'Please select a shop'],
    });
    if (!valid) return;

    setSubmitting(true);
    try {
      const response = await supabase.functions.invoke('create-user', {
        body: {
          action: 'create',
          ...formData
        }
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      if (response.data.error) {
        throw new Error(response.data.error);
      }

      toast.success(
        <div className="space-y-2">
          <p><strong>{formData.full_name}</strong> created successfully!</p>
          <p className="text-sm text-muted-foreground">
            Temporary password: <code className="bg-gray-100 px-1 rounded">{formData.password}</code>
          </p>
          <p className="text-xs text-muted-foreground">
            User will be required to change password on first login.
          </p>
        </div>,
        { duration: 10000 }
      );

      setDialogOpen(false);
      resetForm();
      fetchUsers();
    } catch (error: any) {
      console.error('Error creating user:', error);
      toast.error(error.message || 'Failed to create user');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetPassword = async () => {
    if (!selectedUser || !newPassword || newPassword.length < 6) {
      toast.error('Please enter a password with at least 6 characters');
      return;
    }

    setSubmitting(true);
    try {
      const response = await supabase.functions.invoke('create-user', {
        body: {
          action: 'reset_password',
          user_id: selectedUser.id,
          new_password: newPassword
        }
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      if (response.data.error) {
        throw new Error(response.data.error);
      }

      toast.success(response.data.message);
      setResetDialogOpen(false);
      setSelectedUser(null);
      setNewPassword('');
      fetchUsers();
    } catch (error: any) {
      console.error('Error resetting password:', error);
      toast.error(error.message || 'Failed to reset password');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (user: UserData) => {
    const newState = !user.is_active;
    setConfirmDialog({
      open: true,
      title: newState ? 'Activate User' : 'Deactivate User',
      description: newState
        ? `Are you sure you want to activate ${user.full_name || user.email}? They will be able to log in again.`
        : `Are you sure you want to deactivate ${user.full_name || user.email}? They will be locked out immediately.`,
      onConfirm: async () => {
        try {
          const response = await supabase.functions.invoke('create-user', {
            body: {
              action: 'toggle_active',
              user_id: user.id
            }
          });

          if (response.error) {
            throw new Error(response.error.message);
          }

          if (response.data.error) {
            throw new Error(response.data.error);
          }

          toast.success(response.data.message);
          fetchUsers();
        } catch (error: any) {
          console.error('Error toggling user status:', error);
          toast.error(error.message || 'Failed to update user status');
        }
      },
    });
  };

  const resetForm = () => {
    setFormData({
      email: '',
      password: '',
      full_name: '',
      phone: '',
      role: 'staff',
      shop_id: currentShopId || shops[0]?.id || '',
      max_discount_percent: 0
    });
    setShowPassword(false);
  };

  const openResetDialog = (user: UserData) => {
    setSelectedUser(user);
    setNewPassword(generatePassword());
    setShowNewPassword(true);
    setResetDialogOpen(true);
  };

  const getRoleBadge = (role: string) => {
    const variants: Record<string, { variant: 'default' | 'secondary' | 'outline', label: string }> = {
      owner: { variant: 'default', label: 'Owner' },
      admin: { variant: 'secondary', label: 'Admin' },
      staff: { variant: 'outline', label: 'Staff' }
    };
    const config = variants[role] || { variant: 'outline', label: role };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">User Management</h2>
          <p className="text-sm text-muted-foreground">
            Create and manage user accounts (staff, admin, owner)
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchUsers}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={() => {
              resetForm();
              handleGeneratePassword();
              setDialogOpen(true);
            }}
            className={`${s.primaryGradient} ${s.primaryGradientHover}`}
          >
            <UserPlus className="h-4 w-4 mr-2" />
            Create User
          </Button>
        </div>
      </div>

      {/* User List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : users.length === 0 ? (
        <Card>
          <CardContent className="p-8">
            <EmptyState
              icon={User}
              title="No users found"
              description="Create your first user account to get started"
              action={
                <Button onClick={() => {
                  resetForm();
                  handleGeneratePassword();
                  setDialogOpen(true);
                }}>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Create First User
                </Button>
              }
            />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3 animate-content-in">
          {users.map((user, idx) => (
            <Card key={user.id} className={`animate-stagger-fade-in ${!user.is_active ? 'opacity-60' : ''}`} style={{ '--row-index': idx } as React.CSSProperties}>
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-start sm:items-center justify-between gap-3">
                  <div className="flex items-start sm:items-center gap-3 flex-1 min-w-0">
                    {/* Avatar */}
                    <div className={`h-9 w-9 sm:h-10 sm:w-10 rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0 ${
                      user.is_active 
                        ? `bg-gradient-to-br ${a.gradientLight}` 
                        : 'bg-gray-400'
                    }`}>
                      {user.full_name.charAt(0).toUpperCase()}
                    </div>
                    
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                        <span className="font-medium text-sm sm:text-base truncate max-w-[120px] sm:max-w-none">{user.full_name}</span>
                        {getRoleBadge(user.role)}
                        {!user.is_active && (
                          <Badge variant="destructive" className="text-xs">Inactive</Badge>
                        )}
                      </div>
                      {user.must_change_password && (
                        <Badge variant="outline" className="text-xs text-orange-600 border-orange-300 mt-1">
                          <AlertCircle className="h-3 w-3 mr-1" />
                          <span className="hidden sm:inline">Password Change Required</span>
                          <span className="sm:hidden">Change Pwd</span>
                        </Badge>
                      )}
                      <div className="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-4 text-xs sm:text-sm text-muted-foreground mt-1">
                        <span className="flex items-center gap-1 truncate">
                          <Mail className="h-3 w-3 flex-shrink-0" />
                          <span className="truncate">{user.email}</span>
                        </span>
                        {user.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="h-3 w-3 flex-shrink-0" />
                            {user.phone}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {user.shop_name} • Joined {new Date(user.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>

                  {/* Actions - Switch for status + dropdown for other actions */}
                  <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
                    {/* Direct Toggle Switch */}
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      <Switch
                        checked={user.is_active}
                        onCheckedChange={() => handleToggleActive(user)}
                        className="data-[state=checked]:bg-green-500"
                      />
                      <span className="text-xs text-muted-foreground hidden sm:inline">
                        {user.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    
                    {/* Other Actions Dropdown — modal=false prevents focus-trap freeze on mobile */}
                    <DropdownMenu modal={false}>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openResetDialog(user)}>
                          <Key className="h-4 w-4 mr-2" />
                          Reset Password
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create User Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Create New User
            </DialogTitle>
            <DialogDescription>
              Create a new user account. The user will be required to change their password on first login.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Full Name */}
            <div className="space-y-2">
              <Label htmlFor="full_name">Full Name *</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="full_name"
                  value={formData.full_name}
                  onChange={e => { setFormData(prev => ({ ...prev, full_name: e.target.value })); clearFieldError('full_name'); }}
                  placeholder="Enter full name"
                  className={`pl-10 ${fieldErrorClass(errors.full_name)}`}
                />
              </div>
              <FieldError message={errors.full_name} />
            </div>

            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={e => { setFormData(prev => ({ ...prev, email: e.target.value })); clearFieldError('email'); }}
                  placeholder="user@example.com"
                  className={`pl-10 ${fieldErrorClass(errors.email)}`}
                />
              </div>
              <FieldError message={errors.email} />
            </div>

            {/* Phone */}
            <div className="space-y-2">
              <Label htmlFor="phone">Phone (Optional)</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={e => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="+91 98765 43210"
                  className="pl-10"
                />
              </div>
            </div>

            {/* Temporary Password */}
            <div className="space-y-2">
              <Label htmlFor="password">Temporary Password *</Label>
              <div className="relative">
                <Key className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={e => { setFormData(prev => ({ ...prev, password: e.target.value })); clearFieldError('password'); }}
                  placeholder="Enter or generate password"
                  className={`pl-10 pr-20 ${fieldErrorClass(errors.password)}`}
                />
                <div className="absolute right-1 top-1/2 -translate-y-1/2 flex">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={handleCopyPassword}
                    disabled={!formData.password}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleGeneratePassword}
              >
                Generate Secure Password
              </Button>
              <FieldError message={errors.password} />
            </div>

            {/* Role */}
            <div className="space-y-2">
              <Label htmlFor="role">Role *</Label>
              <Select
                value={formData.role}
                onValueChange={(value: 'staff' | 'admin' | 'owner') => 
                  setFormData(prev => ({ ...prev, role: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="staff">Staff</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="owner">Owner</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Shop */}
            <div className="space-y-2">
              <Label htmlFor="shop">Shop *</Label>
              <Select
                value={formData.shop_id}
                onValueChange={(value) => { setFormData(prev => ({ ...prev, shop_id: value })); clearFieldError('shop_id'); }}
              >
                <SelectTrigger className={fieldErrorClass(errors.shop_id)}>
                  <SelectValue placeholder="Select shop" />
                </SelectTrigger>
                <SelectContent>
                  {shops.map(shop => (
                    <SelectItem key={shop.id} value={shop.id}>
                      {shop.shop_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError message={errors.shop_id} />
            </div>

            {/* Max Discount */}
            <div className="space-y-2">
              <Label htmlFor="max_discount">Max Discount % (0-100)</Label>
              <Input
                id="max_discount"
                type="number"
                min="0"
                max="100"
                value={formData.max_discount_percent}
                onChange={e => setFormData(prev => ({ 
                  ...prev, 
                  max_discount_percent: Math.min(100, Math.max(0, parseInt(e.target.value) || 0))
                }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateUser} disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Create User
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              Reset Password
            </DialogTitle>
            <DialogDescription>
              Reset password for <strong>{selectedUser?.full_name}</strong>. 
              They will be required to change it on next login.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new_password">New Temporary Password</Label>
              <div className="relative">
                <Key className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="new_password"
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  className="pl-10 pr-12"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                >
                  {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setNewPassword(generatePassword());
                    setShowNewPassword(true);
                  }}
                >
                  Generate New
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(newPassword);
                      toast.success('Password copied');
                    } catch {
                      toast.error('Failed to copy');
                    }
                  }}
                  disabled={!newPassword}
                >
                  <Copy className="h-4 w-4 mr-1" />
                  Copy
                </Button>
              </div>
            </div>

            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-sm">
              <p className="text-orange-800">
                <strong>Note:</strong> Share this password with the user securely. 
                They will be prompted to change it on their next login.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setResetDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleResetPassword} disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Resetting...
                </>
              ) : (
                'Reset Password'
              )}
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
    </div>
  );
}
