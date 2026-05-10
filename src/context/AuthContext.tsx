'use client';

import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { Profile, UserRole } from '@/types';
import { clearAllCachedStats } from '@/lib/utils/stats-cache';
import { appConfig } from '@/lib/config/app.config';

// ── Debug logger ───────────────────────────────────────────────────────
const DEBUG = process.env.NODE_ENV === 'development';
function authLog(action: string, ...args: unknown[]) {
  if (!DEBUG) return;
  const ts = new Date().toISOString().slice(11, 23);
  console.log(`[Auth ${ts}] ${action}`, ...args);
}

// ── Profile cache (localStorage) ──────────────────────────────────────
// On networks where Supabase REST hangs (ISP blocks, slow DNS), the
// app would stall because fetchProfile never resolves.  We cache the
// most recent successful profile so the initial load can skip the
// network call and navigate instantly.
const PROFILE_CACHE_KEY = appConfig.internal.profileCacheKey;

function getCachedProfile(userId: string): Profile | null {
  try {
    const raw = localStorage.getItem(PROFILE_CACHE_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw) as { userId: string; profile: Profile; ts: number };
    // Only use cache if it matches the current user and is < 24 hours old
    if (cached.userId !== userId) return null;
    if (Date.now() - cached.ts > 24 * 60 * 60 * 1000) return null;
    return cached.profile;
  } catch {
    return null;
  }
}

function setCachedProfile(userId: string, profile: Profile) {
  try {
    localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify({
      userId,
      profile,
      ts: Date.now(),
    }));
  } catch {
    // localStorage full or blocked — ignore
  }
}

function clearCachedProfile() {
  try { localStorage.removeItem(PROFILE_CACHE_KEY); } catch { /* ignore */ }
}

/** Maps a profile to the correct dashboard route */
export function getHomeRoute(profile: Profile | null): string {
  if (!profile) return '/login';
  if (profile.role === 'superadmin') return '/superadmin';
  if (['owner', 'admin'].includes(profile.role)) return '/admin';
  return '/pos';
}

export interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  /** Signs in and returns the user's profile. Throws on failure. */
  signIn: (email: string, password: string) => Promise<Profile>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  hasRole: (roles: UserRole | UserRole[]) => boolean;
  isAdmin: boolean;
  isStaff: boolean;
  isSuperadmin: boolean;
  mustChangePassword: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ── fetchProfile with timeout ─────────────────────────────────────────
// Supabase REST calls can hang forever on bad networks.  We race the
// actual query against a timeout so the app never freezes.
const FETCH_PROFILE_TIMEOUT_MS = 5_000;

async function fetchProfileFromDb(userId: string, timeoutMs = FETCH_PROFILE_TIMEOUT_MS): Promise<Profile | null> {
  authLog('fetchProfile:start');

  const fetchPromise = supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()
    .then(({ data, error }) => {
      if (error) {
        authLog('fetchProfile:error');
        console.error('Error fetching profile:', error);
        return null;
      }
      authLog('fetchProfile:ok');
      return data as Profile | null;
    });

  const timeoutPromise = new Promise<null>((resolve) => {
    setTimeout(() => {
      authLog('fetchProfile:TIMEOUT');
      resolve(null);
    }, timeoutMs);
  });

  return Promise.race([fetchPromise, timeoutPromise]);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  // Concurrency guard
  const authEventSeq = useRef(0);

  // Keep a ref to the current profile so the onAuthStateChange closure
  // always reads the latest value (React state is stale inside useEffect).
  const profileRef = useRef<Profile | null>(null);
  useEffect(() => { profileRef.current = profile; }, [profile]);

  // Clear auth state
  const clearAuthState = useCallback(() => {
    authLog('clearAuthState');
    setUser(null);
    setProfile(null);
    profileRef.current = null;
    setLoading(false);
    clearAllCachedStats();
    clearCachedProfile();
  }, []);

  // ── Safety-net timeout ──────────────────────────────────────────────
  // If auth initialization hangs beyond 6s, clear stale state so the
  // user can at least reach the login page.
  useEffect(() => {
    if (!loading) return;
    authLog('safety-timer:start (6s)');
    const timer = setTimeout(() => {
      authLog('safety-timer:FIRED — clearing stale auth state');
      console.warn('[Auth] Loading timeout — clearing stale auth state');
      supabase.auth.signOut().catch(() => {});
      clearAuthState();
    }, 6_000);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  // ── Auth state listener ─────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;

        const seq = ++authEventSeq.current;
        authLog('onAuthStateChange', event);

        // Signed out or dead token
        if (event === 'SIGNED_OUT' || (event === 'TOKEN_REFRESHED' && !session)) {
          authLog('clearing state');
          clearAuthState();
          return;
        }

        if (session?.user) {
          setUser(session.user);
          const userId = session.user.id;

          // ── FAST PATH: if we have a profile (in state OR cache), use it
          // instantly and refresh in background.  This covers:
          //   • INITIAL_SESSION  — overnight PWA resume (cached profile)
          //   • SIGNED_IN        — visibility change while already logged in
          //   • TOKEN_REFRESHED  — background token renewal
          //
          // We NEVER block the UI on a network call when we already know
          // who the user is.  The stale profile is at most 24h old and
          // gets refreshed in the background anyway.
          const existing = profileRef.current || getCachedProfile(userId);
          if (existing) {
            authLog('fast path: using existing profile');
            setProfile(existing);
            setLoading(false);

            // Non-blocking background refresh
            fetchProfileFromDb(userId).then((fresh) => {
              if (!mounted || seq !== authEventSeq.current) return;
              if (fresh) {
                authLog('background refresh: updated profile');
                setProfile(fresh);
                setCachedProfile(userId, fresh);
              }
              // If fresh is null (timeout/error), keep the existing profile — never wipe it
            });
            return;
          }

          // ── SLOW PATH: no profile anywhere (truly first login) ──────
          // signIn() normally handles first login eagerly, so this path
          // rarely runs.  If fetchProfile times out here too, we fall
          // back to cache one last time.
          const userProfile = await fetchProfileFromDb(userId);
          if (!mounted) return;
          if (seq !== authEventSeq.current) {
            authLog('stale callback discarded');
            return;
          }

          if (userProfile) {
            setCachedProfile(userId, userProfile);
            setProfile(userProfile);
          } else {
            // Timeout or error — last-resort cache check
            const fallback = getCachedProfile(userId);
            if (fallback) {
              authLog('slow path: timeout but found cache');
              setProfile(fallback);
            } else {
              authLog('slow path: no profile found anywhere');
              setProfile(null);
            }
          }
          setLoading(false);
          authLog('auth ready');
        } else {
          authLog('no session — clearing');
          clearAuthState();
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [clearAuthState]);

  // ── PWA resume: re-validate session ─────────────────────────────────
  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState !== 'visible') return;
      authLog('visibility:visible — checking session');

      supabase.auth.getSession().catch(() => {
        authLog('visibility:getSession failed — signing out');
        supabase.auth.signOut().catch(() => {});
        clearAuthState();
      });
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [clearAuthState]);

  // ── signIn ──────────────────────────────────────────────────────────
  // Returns the profile so the caller can navigate immediately.
  // If fetchProfile times out, falls back to cached profile.
  async function signIn(email: string, password: string): Promise<Profile> {
    authLog('signIn:start');
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      authLog('signIn:error');
      throw error;
    }

    authLog('signIn:signInWithPassword ok');

    if (!data.user) {
      throw new Error('Sign-in succeeded but no user was returned.');
    }

    const userId = data.user.id;

    // Fetch profile with timeout — don't hang forever
    let userProfile = await fetchProfileFromDb(userId, 5_000);
    authLog('signIn:fetchProfile result');

    // If network timed out, try cached profile as last resort
    if (!userProfile) {
      const cached = getCachedProfile(userId);
      if (cached) {
        authLog('signIn:using cached profile as fallback');
        userProfile = cached;
      }
    }

    if (!userProfile) {
      await supabase.auth.signOut();
      throw new Error('Could not load your profile (network timeout). Please check your connection and try again.');
    }

    if (!userProfile.is_active) {
      await supabase.auth.signOut();
      throw new Error('Your account has been deactivated. Please contact your administrator.');
    }

    // Eagerly set state — caller can navigate immediately
    setUser(data.user);
    setProfile(userProfile);
    setLoading(false);
    setCachedProfile(userId, userProfile);
    authLog('signIn:state set eagerly');

    return userProfile;
  }

  // Sign out
  async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    
    setUser(null);
    setProfile(null);
    clearCachedProfile();
  }

  // Refresh profile data
  async function refreshProfile() {
    if (!user) return;
    
    const userProfile = await fetchProfileFromDb(user.id);
    if (userProfile) {
      setProfile(userProfile);
      setCachedProfile(user.id, userProfile);
    }
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
  
  // Check if user must change password (for newly created users)
  const mustChangePassword = Boolean(profile?.must_change_password);
  
  // Check if user account is active
  useEffect(() => {
    if (!loading && user && profile && !profile.is_active) {
      // User has been deactivated - sign them out
      signOut().then(() => {
        // Toast will show after redirect to login
        authLog('User account deactivated - signed out');
      });
    }
  }, [loading, user, profile]);
  
  // Redirect to change-password page if needed
  useEffect(() => {
    if (!loading && user && profile && profile.is_active && mustChangePassword) {
      // Only redirect if not already on the change-password page
      if (pathname !== '/change-password') {
        router.replace('/change-password');
      }
    }
  }, [loading, user, profile, mustChangePassword, pathname, router]);

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
        mustChangePassword,
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
