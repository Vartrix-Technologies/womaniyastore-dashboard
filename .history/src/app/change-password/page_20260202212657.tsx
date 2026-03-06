'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Lock, Eye, EyeOff, CheckCircle, Shield } from 'lucide-react';
import ParticleBackground from '@/components/ui/ParticleBackground';

export default function ChangePasswordPage() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const { user, profile, refreshProfile } = useAuth();
  const router = useRouter();

  // Redirect if not logged in
  useEffect(() => {
    if (!user) {
      router.replace('/login');
    }
  }, [user, router]);

  // If user doesn't need to change password, redirect to home
  useEffect(() => {
    if (profile && !profile.must_change_password) {
      router.replace('/');
    }
  }, [profile, router]);

  // Password strength validation
  const getPasswordStrength = (password: string) => {
    let strength = 0;
    if (password.length >= 8) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[a-z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^A-Za-z0-9]/.test(password)) strength++;
    return strength;
  };

  const passwordStrength = getPasswordStrength(newPassword);
  const strengthLabels = ['Very Weak', 'Weak', 'Fair', 'Good', 'Strong'];
  const strengthColors = ['bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-blue-500', 'bg-green-500'];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!currentPassword) {
      toast.error('Please enter your current temporary password');
      return;
    }

    if (!newPassword) {
      toast.error('Please enter a new password');
      return;
    }

    if (newPassword.length < 8) {
      toast.error('New password must be at least 8 characters');
      return;
    }

    if (newPassword === currentPassword) {
      toast.error('New password must be different from current password');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    if (passwordStrength < 3) {
      toast.error('Please choose a stronger password (use uppercase, lowercase, numbers, or symbols)');
      return;
    }

    setLoading(true);

    try {
      // First verify current password by re-authenticating
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user?.email || '',
        password: currentPassword
      });

      if (signInError) {
        toast.error('Current password is incorrect');
        setLoading(false);
        return;
      }

      // Update password
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (updateError) {
        toast.error(updateError.message || 'Failed to update password');
        setLoading(false);
        return;
      }

      // Clear the must_change_password flag directly
      // Using type assertion since the function may not be in types yet
      const { error: flagError } = await (supabase.rpc as any)('mark_password_changed');
      
      if (flagError) {
        console.error('Error clearing password change flag:', flagError);
        // Fallback: try direct update
        if (user?.id) {
          const { error: directUpdateError } = await supabase
            .from('profiles')
            .update({ 
              must_change_password: false, 
              password_changed_at: new Date().toISOString() 
            })
            .eq('id', user.id);
          
          if (directUpdateError) {
            console.error('Fallback update also failed:', directUpdateError);
          }
        }
      }

      toast.success('Password changed successfully! Welcome to Womaniya Dashboard.');
      
      // Refresh profile to get updated must_change_password status
      await refreshProfile();
      
      // Redirect to home page
      setTimeout(() => {
        router.replace('/');
      }, 1000);
      
    } catch (error) {
      console.error('Password change error:', error);
      toast.error('An unexpected error occurred. Please try again.');
      setLoading(false);
    }
  };

  // Don't render if no user
  if (!user) {
    return null;
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-gradient-to-br from-teal-500 via-cyan-600 to-blue-700 p-4">
      {/* Particle Background */}
      <ParticleBackground />

      {/* Change Password Card */}
      <Card className="w-full max-w-md shadow-2xl relative z-10 backdrop-blur-sm bg-white/95">
        <CardHeader className="space-y-3 text-center">
          {/* Icon */}
          <div className="flex justify-center mb-2">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-teal-400 to-cyan-500 flex items-center justify-center shadow-lg">
              <Shield className="h-10 w-10 text-white" />
            </div>
          </div>

          <CardTitle className="text-2xl font-bold text-gray-900">
            Set Your Password
          </CardTitle>
          <CardDescription className="text-gray-600">
            Welcome! Your account was created by an administrator. 
            Please set a new secure password to continue.
          </CardDescription>
        </CardHeader>

        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {/* Current/Temporary Password */}
            <div className="space-y-2">
              <Label htmlFor="currentPassword" className="text-gray-700">
                Temporary Password
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="currentPassword"
                  type={showCurrentPassword ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter the password provided to you"
                  className="pl-10 pr-10"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* New Password */}
            <div className="space-y-2">
              <Label htmlFor="newPassword" className="text-gray-700">
                New Password
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="newPassword"
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Create a strong password"
                  className="pl-10 pr-10"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              
              {/* Password Strength Indicator */}
              {newPassword && (
                <div className="space-y-1">
                  <div className="flex gap-1">
                    {[0, 1, 2, 3, 4].map((index) => (
                      <div
                        key={index}
                        className={`h-1 flex-1 rounded ${
                          index < passwordStrength ? strengthColors[passwordStrength - 1] : 'bg-gray-200'
                        }`}
                      />
                    ))}
                  </div>
                  <p className={`text-xs ${passwordStrength >= 3 ? 'text-green-600' : 'text-orange-600'}`}>
                    {strengthLabels[passwordStrength - 1] || 'Very Weak'} - 
                    {passwordStrength < 3 && ' Use uppercase, lowercase, numbers, and symbols'}
                  </p>
                </div>
              )}
            </div>

            {/* Confirm Password */}
            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-gray-700">
                Confirm New Password
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter your new password"
                  className="pl-10 pr-10"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              
              {/* Match Indicator */}
              {confirmPassword && (
                <p className={`text-xs flex items-center gap-1 ${
                  newPassword === confirmPassword ? 'text-green-600' : 'text-red-600'
                }`}>
                  {newPassword === confirmPassword ? (
                    <>
                      <CheckCircle className="h-3 w-3" />
                      Passwords match
                    </>
                  ) : (
                    'Passwords do not match'
                  )}
                </p>
              )}
            </div>

            {/* Security Tips */}
            <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-600 space-y-1">
              <p className="font-medium">Password requirements:</p>
              <ul className="list-disc list-inside space-y-0.5">
                <li className={newPassword.length >= 8 ? 'text-green-600' : ''}>
                  At least 8 characters
                </li>
                <li className={/[A-Z]/.test(newPassword) && /[a-z]/.test(newPassword) ? 'text-green-600' : ''}>
                  Mix of uppercase and lowercase letters
                </li>
                <li className={/[0-9]/.test(newPassword) ? 'text-green-600' : ''}>
                  Include numbers
                </li>
                <li className={/[^A-Za-z0-9]/.test(newPassword) ? 'text-green-600' : ''}>
                  Include special characters (recommended)
                </li>
              </ul>
            </div>
          </CardContent>

          <CardFooter>
            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-600 hover:to-cyan-700"
              disabled={loading}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Updating Password...
                </span>
              ) : (
                'Set New Password'
              )}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
