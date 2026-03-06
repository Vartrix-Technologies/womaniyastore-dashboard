'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { Profile, UserRole } from '@/types';

export interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  hasRole: (roles: UserRole | UserRole[]) => boolean;
  isAdmin: boolean;
  isStaff: boolean;
  isSuperadmin: boolean;
  mustChangePassword: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  // Fetch user profile from database
  async function fetchProfile(userId: string) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Error fetching profile:', error);
      console.error('User ID:', userId);
      console.error('This usually means the profile record does not exist for this user.');
      return null;
    }

    return data;
  }

  // Initialize auth state
  useEffect(() => {
    let mounted = true;
    let currentUserId: string | null = null; // Track current user ID

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      
      setUser(session?.user ?? null);
      
      if (session?.user) {
        currentUserId = session.user.id;
        fetchProfile(session.user.id).then(profileData => {
          if (mounted) {
            setProfile(profileData);
            setLoading(false);
          }
        });
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes with session tracking to prevent redundant fetches
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        // User signed out - clear everything
        if (event === 'SIGNED_OUT') {
          currentUserId = null;
          setUser(null);
          setProfile(null);
          setLoading(false);
          return;
        }
        
        // Check if user ID actually changed
        if (session?.user) {
          if (session.user.id === currentUserId) {
            return; // Don't do anything - prevents profile object from being recreated
          }
          
          // User ID changed - update everything
          currentUserId = session.user.id;
          setUser(session.user);
          
          // Fetch profile for the new user
          const userProfile = await fetchProfile(session.user.id);
          setProfile(userProfile);
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Sign in with email and password
  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;
    
    // Profile will be loaded by the auth state change listener
  }

  // Sign out
  async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    
    setUser(null);
    setProfile(null);
  }

  // Refresh profile data
  async function refreshProfile() {
    if (!user) return;
    
    const userProfile = await fetchProfile(user.id);
    setProfile(userProfile);
  }

  // Check if user has specific role(s)
  function hasRole(roles: UserRole | UserRole[]): boolean {
    if (!profile) return false;
    
    const roleArray = Array.isArray(roles) ? roles : [roles];
    return roleArray.includes(profile.role);
  }

  // Computed role flags
  const isAdmin = hasRole(['owner', 'admin', 'superadmin']);
  const isStaff = hasRole(['staff', 'admin', 'owner', 'superadmin']);
  const isSuperadmin = hasRole('superadmin');

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        signIn,
        signOut,
        refreshProfile,
        hasRole,
        isAdmin,
        isStaff,
        isSuperadmin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// Hook to use auth context
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
