'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { usePwaInstall } from '@/hooks/usePwaInstall';
import { appConfig } from '@/lib/config/app.config';
import { toast } from 'sonner';
import {
  Download,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Smartphone,
  Camera,
  Wifi,
  WifiOff,
  HardDrive,
  RefreshCw,
  Share,
  Plus,
  Shield,
} from 'lucide-react';

const s = appConfig.styles;
const a = s.accent;

interface DiagnosticItem {
  label: string;
  status: 'pass' | 'fail' | 'warn' | 'checking';
  detail: string;
  icon: React.ComponentType<{ className?: string }>;
}

export function AppStatusTab() {
  const {
    installState,
    isStandalone,
    canPromptInstall,
    promptInstall,
    isIos,
    swStatus,
    cameraAvailable,
  } = usePwaInstall();

  const [isOnline, setIsOnline] = useState(true);
  const [cameraPermission, setCameraPermission] = useState<PermissionState | 'unknown'>('unknown');
  const [showIosGuide, setShowIosGuide] = useState(false);

  useEffect(() => {
    setIsOnline(navigator.onLine);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Check camera permission
    if ('permissions' in navigator) {
      navigator.permissions.query({ name: 'camera' as PermissionName }).then((result) => {
        setCameraPermission(result.state);
        result.addEventListener('change', () => {
          setCameraPermission(result.state);
        });
      }).catch(() => {
        setCameraPermission('unknown');
      });
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const isSecureContext = typeof window !== 'undefined' && (window.location.protocol === 'https:' || window.location.hostname === 'localhost');
  const isLocalNetwork = typeof window !== 'undefined' && !isSecureContext && /^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(window.location.hostname);

  const handleInstallClick = async () => {
    if (isIos) {
      setShowIosGuide(true);
      return;
    }

    if (!canPromptInstall) {
      if (isLocalNetwork) {
        toast.info('Install is not available over local network (HTTP). Once deployed to HTTPS, this will work on mobile.', { duration: 6000 });
      } else if (!isSecureContext) {
        toast.info('Install requires a secure (HTTPS) connection. This will work once the app is deployed.', { duration: 5000 });
      } else {
        toast.info('Install prompt not available. Try using Chrome or Edge browser.', { duration: 5000 });
      }
      return;
    }

    const result = await promptInstall();
    if (result === 'accepted') {
      toast.success('App installed successfully!');
    } else if (result === 'dismissed') {
      toast.info('You can install anytime from this page.');
    }
  };

  const handleTestCamera = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        toast.error('Camera API not available in this browser');
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      stream.getTracks().forEach(track => track.stop());
      toast.success('Camera is working! Permission granted.');
      setCameraPermission('granted');
    } catch (err: unknown) {
      const errName = err instanceof DOMException ? err.name : '';
      if (errName === 'NotAllowedError') {
        toast.error('Camera permission denied. Please allow camera in your browser settings.');
        setCameraPermission('denied');
      } else if (errName === 'NotFoundError') {
        toast.error('No camera found on this device.');
      } else {
        toast.error('Failed to access camera.');
      }
    }
  };

  // ── Build diagnostics ──────────────────────────────────────────

  const diagnostics: DiagnosticItem[] = [
    {
      label: 'App Installation',
      icon: Smartphone,
      status: isStandalone ? 'pass' : installState === 'installable' ? 'warn' : 'warn',
      detail: isStandalone
        ? 'App is installed and running in standalone mode'
        : installState === 'installable'
          ? 'App can be installed — tap the Install button below'
          : isIos
            ? 'Use Safari\'s "Add to Home Screen" to install'
            : 'Open in Chrome or Edge to enable installation',
    },
    {
      label: 'Service Worker',
      icon: Shield,
      status: swStatus === 'registered' ? 'pass' : swStatus === 'checking' ? 'checking' : 'fail',
      detail: swStatus === 'registered'
        ? 'Service worker is active — offline caching enabled'
        : swStatus === 'not-supported'
          ? 'Service workers not supported in this browser'
          : swStatus === 'checking'
            ? 'Checking service worker status...'
            : 'Service worker not registered — app may not work offline',
    },
    {
      label: 'Camera Access',
      icon: Camera,
      status: cameraPermission === 'granted' ? 'pass' 
        : cameraPermission === 'denied' ? 'fail' 
        : cameraAvailable === false ? 'fail'
        : 'warn',
      detail: cameraPermission === 'granted'
        ? 'Camera permission granted — QR scanning ready'
        : cameraPermission === 'denied'
          ? 'Camera permission denied — tap "Test Camera" to re-request or check browser settings'
          : cameraAvailable === false
            ? 'No camera detected on this device'
            : 'Camera not yet tested — tap "Test Camera" below',
    },
    {
      label: 'Network',
      icon: isOnline ? Wifi : WifiOff,
      status: isOnline ? 'pass' : 'warn',
      detail: isOnline
        ? 'You are online — all features available'
        : 'You are offline — sales will sync when back online',
    },
    {
      label: 'HTTPS',
      icon: Shield,
      status: typeof window !== 'undefined' && (window.location.protocol === 'https:' || window.location.hostname === 'localhost') ? 'pass' : 'fail',
      detail: typeof window !== 'undefined' && (window.location.protocol === 'https:' || window.location.hostname === 'localhost')
        ? 'Secure connection — PWA features enabled'
        : isLocalNetwork
          ? 'Accessing via local network (HTTP) — install and some features won\'t work until deployed to HTTPS'
          : 'Not on HTTPS — PWA install and camera may not work. Contact your admin.',
    },
  ];

  const StatusIcon = ({ status }: { status: string }) => {
    switch (status) {
      case 'pass':
        return <CheckCircle2 className="h-5 w-5 text-green-600" />;
      case 'fail':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'warn':
        return <AlertTriangle className="h-5 w-5 text-amber-500" />;
      default:
        return <RefreshCw className="h-5 w-5 text-muted-foreground animate-spin" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Installation Status Card */}
      <Card className="overflow-hidden">
        <div className={isStandalone 
          ? 'bg-gradient-to-br from-green-500 to-emerald-600 p-6 text-white' 
          : `bg-gradient-to-br ${s.primaryGradientStops} p-6 text-white`
        }>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
              {isStandalone 
                ? <CheckCircle2 className="h-7 w-7" /> 
                : <Download className="h-7 w-7" />
              }
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-lg">
                {isStandalone ? 'App Installed' : 'Install App'}
              </h3>
              <p className="text-sm text-white/80">
                {isStandalone 
                  ? `${appConfig.brand.name} is running as an installed app`
                  : 'Install for the best experience — faster loading, offline access, and camera support'
                }
              </p>
            </div>
          </div>

          {/* Install Button (only if not installed) */}
          {!isStandalone && (
            <div className="mt-4">
              {canPromptInstall ? (
                <Button
                  onClick={handleInstallClick}
                  className="bg-white text-brand-700 hover:bg-white/90 font-semibold shadow-lg"
                >
                  <Download className="mr-2 h-4 w-4" />
                  Install {appConfig.brand.name}
                </Button>
              ) : isIos ? (
                <Button
                  onClick={() => setShowIosGuide(true)}
                  className="bg-white text-brand-700 hover:bg-white/90 font-semibold shadow-lg"
                >
                  <Share className="mr-2 h-4 w-4" />
                  How to Install on iOS
                </Button>
              ) : (
                <div className="mt-2 space-y-2">
                  {isLocalNetwork ? (
                    <>
                      <p className="text-sm text-white/90 font-medium">Not available on local network</p>
                      <p className="text-xs text-white/70">
                        You&apos;re accessing the app via your local network (HTTP). PWA installation 
                        requires HTTPS. Once the app is deployed to a real domain with HTTPS, 
                        installation will work on all devices.
                      </p>
                    </>
                  ) : !isSecureContext ? (
                    <>
                      <p className="text-sm text-white/90 font-medium">HTTPS required</p>
                      <p className="text-xs text-white/70">
                        Install requires a secure connection. This will work after deployment.
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-white/70">
                      Open this page in Chrome or Edge to install the app.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </Card>

      {/* Diagnostics Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">System Diagnostics</CardTitle>
          <CardDescription>Check if all features are working correctly</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {diagnostics.map(({ label, icon: Icon, status, detail }) => (
            <div
              key={label}
              className={`flex items-start gap-3 p-3 rounded-lg border ${
                status === 'pass' ? 'border-green-200 bg-green-50/50 dark:border-green-900 dark:bg-green-950/20' 
                : status === 'fail' ? 'border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-950/20' 
                : status === 'warn' ? 'border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/20'
                : 'border-border bg-muted/20'
              }`}
            >
              <div className="flex items-center gap-2 shrink-0 mt-0.5">
                <StatusIcon status={status} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <p className="font-medium text-sm">{label}</p>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{detail}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Camera Test Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Camera className="h-5 w-5" />
            Camera Test
          </CardTitle>
          <CardDescription>
            Test camera access for QR code scanning. If the camera isn&apos;t working, 
            this will help identify the issue.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Badge variant={cameraPermission === 'granted' ? 'default' : 'secondary'} className={
                cameraPermission === 'granted' ? 'bg-green-100 text-green-700 border-green-200' :
                cameraPermission === 'denied' ? 'bg-red-100 text-red-700 border-red-200' :
                ''
              }>
                {cameraPermission === 'granted' ? 'Permission Granted' :
                 cameraPermission === 'denied' ? 'Permission Denied' :
                 cameraPermission === 'prompt' ? 'Not Yet Requested' :
                 'Unknown'}
              </Badge>
              {cameraAvailable !== null && (
                <Badge variant="secondary">
                  {cameraAvailable ? 'Camera Detected' : 'No Camera Found'}
                </Badge>
              )}
            </div>

            <Button onClick={handleTestCamera} variant="outline" className={`${a.hoverBg} ${a.hoverBorder}`}>
              <Camera className="mr-2 h-4 w-4" />
              Test Camera
            </Button>

            {cameraPermission === 'denied' && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 dark:bg-red-950/20 dark:border-red-900">
                <p className="text-sm text-red-700 dark:text-red-400 font-medium">Camera Permission Denied</p>
                <p className="text-xs text-red-600/80 dark:text-red-400/70 mt-1">
                  To fix this:
                </p>
                <ol className="text-xs text-red-600/80 dark:text-red-400/70 mt-1 space-y-1 list-decimal list-inside">
                  <li>Tap the lock/info icon in your browser&apos;s address bar</li>
                  <li>Find &quot;Camera&quot; in the permissions list</li>
                  <li>Change it to &quot;Allow&quot;</li>
                  <li>Reload the page</li>
                </ol>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* iOS Install Guide Modal */}
      {showIosGuide && (
        <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-end justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-sm shadow-2xl animate-in slide-in-from-bottom duration-300">
            <div className="p-6 space-y-4">
              <div className="text-center">
                <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${s.primaryGradientStops} mx-auto mb-3 flex items-center justify-center`}>
                  <span className="text-white font-bold text-2xl">{appConfig.brand.logoLetter}</span>
                </div>
                <h3 className="font-bold text-lg">Install on iOS</h3>
                <p className="text-sm text-muted-foreground mt-1">Follow these steps in Safari</p>
              </div>

              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800">
                  <div className="w-7 h-7 rounded-full bg-brand-100 dark:bg-brand-900 text-brand-700 dark:text-brand-300 flex items-center justify-center text-sm font-bold shrink-0">1</div>
                  <div>
                    <p className="text-sm font-medium">Tap the Share button</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <Share className="h-3.5 w-3.5 inline" /> at the bottom of Safari
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800">
                  <div className="w-7 h-7 rounded-full bg-brand-100 dark:bg-brand-900 text-brand-700 dark:text-brand-300 flex items-center justify-center text-sm font-bold shrink-0">2</div>
                  <div>
                    <p className="text-sm font-medium">Tap &quot;Add to Home Screen&quot;</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <Plus className="h-3.5 w-3.5 inline" /> Add to Home Screen
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800">
                  <div className="w-7 h-7 rounded-full bg-brand-100 dark:bg-brand-900 text-brand-700 dark:text-brand-300 flex items-center justify-center text-sm font-bold shrink-0">3</div>
                  <div>
                    <p className="text-sm font-medium">Tap &quot;Add&quot; to confirm</p>
                    <p className="text-xs text-muted-foreground mt-0.5">The app icon will appear on your home screen</p>
                  </div>
                </div>
              </div>

              <Button
                onClick={() => setShowIosGuide(false)}
                className={`w-full ${s.primaryGradient} hover:opacity-90`}
              >
                Got it
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
