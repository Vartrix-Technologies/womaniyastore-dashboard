'use client';

import { useState, useEffect } from 'react';
import { usePwaInstall } from '@/hooks/usePwaInstall';
import { Button } from '@/components/ui/button';
import { Download, X, Share, Plus } from 'lucide-react';
import { appConfig } from '@/lib/config/app.config';
import { toast } from 'sonner';

const s = appConfig.styles;

const DISMISSED_KEY = 'pwa-banner-dismissed';
const DISMISS_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Smart install banner that appears at the top of the app when:
 * - The app is not installed
 * - The user hasn't dismissed the banner recently
 * 
 * Shows appropriate instructions for:
 * - Chrome/Edge (native install prompt)
 * - iOS Safari (Add to Home Screen)
 */
export function PwaInstallBanner() {
  const { installState, canPromptInstall, promptInstall, isIos, isStandalone } = usePwaInstall();
  const [visible, setVisible] = useState(false);
  const [showIosGuide, setShowIosGuide] = useState(false);

  useEffect(() => {
    // Don't show if already installed
    if (isStandalone || installState === 'installed') return;

    // Check if user dismissed recently
    const dismissedAt = localStorage.getItem(DISMISSED_KEY);
    if (dismissedAt) {
      const elapsed = Date.now() - parseInt(dismissedAt, 10);
      if (elapsed < DISMISS_DURATION) return;
    }

    // Show banner after a short delay (don't interrupt initial experience)
    const timer = setTimeout(() => {
      setVisible(true);
    }, 3000);

    return () => clearTimeout(timer);
  }, [isStandalone, installState]);

  const handleDismiss = () => {
    setVisible(false);
    localStorage.setItem(DISMISSED_KEY, Date.now().toString());
  };

  const handleInstall = async () => {
    if (isIos) {
      setShowIosGuide(true);
      return;
    }

    if (!canPromptInstall) {
      // Prompt not available — explain why
      const isSecure = window.location.protocol === 'https:' || window.location.hostname === 'localhost';
      if (!isSecure) {
        toast.info('Install requires HTTPS. This will work once the app is deployed to a real domain.', { duration: 5000 });
      } else {
        toast.info('Install prompt not available. Try using Chrome or Edge, or check Settings → App & Install for more details.', { duration: 5000 });
      }
      return;
    }

    const result = await promptInstall();
    if (result === 'accepted') {
      setVisible(false);
    } else if (result === 'dismissed') {
      toast.info('You can install anytime from Settings → App & Install');
    }
  };

  if (!visible) return null;

  return (
    <>
      {/* Install Banner */}
      <div className={`fixed top-0 left-0 right-0 z-[100] bg-gradient-to-r ${s.primaryGradient} text-white shadow-lg animate-in slide-in-from-top duration-300`}>
        <div className="container-boxed px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-white/20 backdrop-blur-sm shrink-0">
              <Download className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm">Install {appConfig.brand.name}</p>
              <p className="text-xs text-white/80 truncate">
                {isIos 
                  ? 'Add to Home Screen for the best experience' 
                  : 'Install for faster access & offline support'}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                size="sm"
                variant="secondary"
                onClick={handleInstall}
                className="bg-white text-brand-700 hover:bg-white/90 font-semibold text-xs h-8 px-3"
              >
                {isIos ? 'How?' : 'Install'}
              </Button>
              <button
                onClick={handleDismiss}
                className="p-1.5 rounded-full hover:bg-white/20 transition-colors"
                aria-label="Dismiss install banner"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* iOS "Add to Home Screen" Guide Overlay */}
      {showIosGuide && (
        <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-end justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl animate-in slide-in-from-bottom duration-300">
            <div className="p-6 space-y-4">
              <div className="text-center">
                <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${s.primaryGradientStops} mx-auto mb-3 flex items-center justify-center`}>
                  <span className="text-white font-bold text-2xl">{appConfig.brand.logoLetter}</span>
                </div>
                <h3 className="font-bold text-lg">Install {appConfig.brand.name}</h3>
                <p className="text-sm text-muted-foreground mt-1">Follow these steps to install on your iPhone/iPad</p>
              </div>

              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 rounded-lg bg-gray-50">
                  <div className="w-7 h-7 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-sm font-bold shrink-0">1</div>
                  <div>
                    <p className="text-sm font-medium">Tap the Share button</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      Look for <Share className="h-3.5 w-3.5 inline" /> at the bottom of Safari
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-lg bg-gray-50">
                  <div className="w-7 h-7 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-sm font-bold shrink-0">2</div>
                  <div>
                    <p className="text-sm font-medium">Scroll down & tap &quot;Add to Home Screen&quot;</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      Look for <Plus className="h-3.5 w-3.5 inline" /> Add to Home Screen
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-lg bg-gray-50">
                  <div className="w-7 h-7 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-sm font-bold shrink-0">3</div>
                  <div>
                    <p className="text-sm font-medium">Tap &quot;Add&quot; to confirm</p>
                    <p className="text-xs text-muted-foreground mt-0.5">The app will appear on your home screen</p>
                  </div>
                </div>
              </div>

              <Button
                onClick={() => { setShowIosGuide(false); handleDismiss(); }}
                className={`w-full ${s.primaryGradient} hover:opacity-90`}
              >
                Got it
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
