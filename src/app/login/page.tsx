'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useAuth } from '@/context/AuthContext';
import { getHomeRoute } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import ParticleBackground from '@/components/ui/ParticleBackground';
import { FieldError, fieldErrorClass, useFormErrors } from '@/components/shared/FieldError';
import { appConfig } from '@/lib/config/app.config';
import { Eye, EyeOff } from 'lucide-react';

const s = appConfig.styles;
const a = s.accent;

const LAST_EMAIL_KEY = 'womaniya_last_email';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { signIn, user, profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const { errors, validateFields, clearFieldError } = useFormErrors<'email' | 'password'>();
  const hasRedirected = useRef(false);

  // Pre-fill last used email so store staff only need to type their password
  useEffect(() => {
    const saved = localStorage.getItem(LAST_EMAIL_KEY);
    if (saved) setEmail(saved);
  }, []);

  // Redirect if already logged in — go DIRECTLY to the role-based dashboard
  // (eliminates the old Login → / → /admin double-hop that silently failed)
  useEffect(() => {
    if (authLoading) return; // wait for auth to settle
    if (hasRedirected.current) return; // prevent double redirects
    
    if (user && profile) {
      hasRedirected.current = true;
      const dest = getHomeRoute(profile);
      router.replace(dest);
    }
  }, [user, profile, authLoading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const valid = validateFields({
      email: [!email, 'Email is required'],
      password: [!password, 'Password is required'],
    });
    if (!valid) return;

    setLoading(true);

    try {
      // signIn() now returns the profile AND sets AuthContext state eagerly.
      // We navigate DIRECTLY — no waiting for onAuthStateChange or useEffect.
      const userProfile = await signIn(email, password);
      localStorage.setItem(LAST_EMAIL_KEY, email); // Remember for next login

      const dest = getHomeRoute(userProfile);
      toast.success('Welcome back!');
      hasRedirected.current = true;
      router.replace(dest);
      // Note: we intentionally do NOT call setLoading(false) here.
      // The button stays in "Signing in..." state until the page navigates
      // away, which prevents a flash of the enabled button.
    } catch (error) {
      console.warn('[Login] signIn failed:', error instanceof Error ? error.message : error);
      toast.error(error instanceof Error ? error.message : 'Failed to sign in');
      setLoading(false);
    }
  };

  return (
    <div className={`relative min-h-screen flex items-center justify-center bg-gradient-to-br ${s.primaryGradientStops} to-blue-700 p-4`}>
      {/* Particle Background */}
      <ParticleBackground />

      {/* Login Card */}
      <Card className={`w-full max-w-md shadow-2xl relative z-10 backdrop-blur-sm bg-white/95 ${a.hoverShadow} hover:scale-[1.02] transition-all duration-300`}>
        <CardHeader className="space-y-3 text-center">
          {/* Logo */}
          <div className="flex justify-center mb-2">
            <div className={`w-30 h-30 rounded-full overflow-hidden bg-white shadow-lg ring-4 ${a.ring}`}>
              <Image
                src="/womaniya_logo_darkbg.png"
                alt="Womaniya Logo"
                width={200}
                height={200}
                className="object-cover"
              />
            </div>
          </div>
          
          {/* Title - text-2xl per checklist */}
          <CardTitle className={`text-2xl font-bold ${s.primaryGradient} bg-clip-text text-transparent`}>
            Womaniya Dashboard
          </CardTitle>
          
          {/* Description - text-sm per checklist */}
          <CardDescription className="text-sm">
            Sign in to your account to continue
          </CardDescription>
        </CardHeader>

        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {/* Email Field */}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">Email *</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => { setEmail(e.target.value); clearFieldError('email'); }}
                disabled={loading}
                autoComplete="email"
                className={`h-11 focus:ring-2 ${a.focusRing} ${a.focusBorder} transition-all ${fieldErrorClass(errors.email)}`}
                required
              />
              <FieldError message={errors.email} />
            </div>

            {/* Password Field */}
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium">Password *</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); clearFieldError('password'); }}
                  disabled={loading}
                  autoComplete="current-password"
                  className={`h-11 pr-10 focus:ring-2 ${a.focusRing} ${a.focusBorder} transition-all ${fieldErrorClass(errors.password)}`}
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <FieldError message={errors.password} />
              <p className="text-xs text-muted-foreground">Minimum 6 characters</p>
            </div>
          </CardContent>

          <CardFooter>
            <Button
              type="submit"
              className={`w-full h-11 ${s.primaryGradient} ${s.primaryGradientHover} ${s.btnAnimation} shadow-lg`}
              disabled={loading || !email || !password}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Signing in...
                </span>
              ) : (
                'Sign In'
              )}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
