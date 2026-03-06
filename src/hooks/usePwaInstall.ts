'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Detected PWA installation state
 */
export type PwaInstallState = 
  | 'installed'       // Running as installed PWA (standalone mode)
  | 'installable'     // Browser supports install & beforeinstallprompt fired
  | 'not-installable' // Browser didn't fire prompt (may already be installed or not supported)
  | 'ios-safari'      // iOS Safari — must use "Add to Home Screen" manually
  | 'unknown';        // Still detecting

export interface UsePwaInstallReturn {
  /** Current install state */
  installState: PwaInstallState;
  /** Whether the app is running in standalone (installed) mode */
  isStandalone: boolean;
  /** Whether the native install prompt can be shown */
  canPromptInstall: boolean;
  /** Trigger the native browser install prompt (Chrome/Edge/Samsung) */
  promptInstall: () => Promise<'accepted' | 'dismissed' | 'unavailable'>;
  /** Whether this is iOS and needs manual "Add to Home Screen" */
  isIos: boolean;
  /** Service worker registration status */
  swStatus: 'registered' | 'not-registered' | 'not-supported' | 'checking';
  /** Whether camera is available */
  cameraAvailable: boolean | null;
}

// Store the deferred prompt globally so it survives re-renders
let deferredPrompt: BeforeInstallPromptEvent | null = null;

const PWA_INSTALLED_KEY = 'pwa-installed';

// Extend the Window and Event interfaces for the beforeinstallprompt event
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
  prompt(): Promise<void>;
}

declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
  }
}

export function usePwaInstall(): UsePwaInstallReturn {
  const [installState, setInstallState] = useState<PwaInstallState>('unknown');
  const [isStandalone, setIsStandalone] = useState(false);
  const [canPromptInstall, setCanPromptInstall] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [swStatus, setSwStatus] = useState<'registered' | 'not-registered' | 'not-supported' | 'checking'>('checking');
  const [cameraAvailable, setCameraAvailable] = useState<boolean | null>(null);
  const promptRef = useRef<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    // ── Detect standalone (installed) mode ──────────────────
    const standalone = 
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsStandalone(standalone);

    // ── Detect iOS ──────────────────────────────────────────
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent) && !(window as unknown as { MSStream?: unknown }).MSStream;
    setIsIos(isIosDevice);

    // ── Set initial install state ───────────────────────────
    const previouslyInstalled = localStorage.getItem(PWA_INSTALLED_KEY) === 'true';
    if (standalone || previouslyInstalled) {
      setInstallState('installed');
      setIsStandalone(standalone); // true only in standalone, but we know it's installed
    } else if (isIosDevice) {
      setInstallState('ios-safari');
    } else {
      setInstallState('not-installable');
    }

    // ── Listen for beforeinstallprompt ──────────────────────
    const handleBeforeInstallPrompt = (e: BeforeInstallPromptEvent) => {
      // Prevent the default mini-infobar
      e.preventDefault();
      deferredPrompt = e;
      promptRef.current = e;
      setCanPromptInstall(true);
      if (!standalone && !previouslyInstalled) {
        setInstallState('installable');
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // If a prompt was captured before this hook mounted
    if (deferredPrompt) {
      promptRef.current = deferredPrompt;
      setCanPromptInstall(true);
      if (!standalone && !previouslyInstalled) {
        setInstallState('installable');
      }
    }

    // ── Listen for successful installation ──────────────────
    const handleAppInstalled = () => {
      setInstallState('installed');
      setIsStandalone(true);
      setCanPromptInstall(false);
      deferredPrompt = null;
      promptRef.current = null;
      // Persist so the browser (non-standalone) also knows it's installed
      localStorage.setItem(PWA_INSTALLED_KEY, 'true');
    };

    window.addEventListener('appinstalled', handleAppInstalled);

    // ── Check service worker status ─────────────────────────
    // Use navigator.serviceWorker.ready (resolves when SW is active)
    // with a timeout fallback, since the SW may still be registering.
    if ('serviceWorker' in navigator) {
      // Quick check first
      navigator.serviceWorker.getRegistration().then((reg) => {
        if (reg?.active) {
          setSwStatus('registered');
        } else {
          // SW may still be installing — wait up to 5 seconds
          const timeout = setTimeout(() => setSwStatus('not-registered'), 5000);
          navigator.serviceWorker.ready.then(() => {
            clearTimeout(timeout);
            setSwStatus('registered');
          }).catch(() => {
            clearTimeout(timeout);
            setSwStatus('not-registered');
          });
        }
      }).catch(() => {
        setSwStatus('not-registered');
      });
    } else {
      setSwStatus('not-supported');
    }

    // ── Check camera availability ───────────────────────────
    if (navigator.mediaDevices && typeof navigator.mediaDevices.enumerateDevices === 'function') {
      navigator.mediaDevices.enumerateDevices().then((devices) => {
        const hasCamera = devices.some(d => d.kind === 'videoinput');
        setCameraAvailable(hasCamera);
      }).catch(() => {
        setCameraAvailable(false);
      });
    } else {
      setCameraAvailable(false);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const promptInstall = useCallback(async (): Promise<'accepted' | 'dismissed' | 'unavailable'> => {
    const prompt = promptRef.current || deferredPrompt;
    if (!prompt) return 'unavailable';

    try {
      await prompt.prompt();
      const { outcome } = await prompt.userChoice;
      
      if (outcome === 'accepted') {
        setInstallState('installed');
        setCanPromptInstall(false);
        deferredPrompt = null;
        promptRef.current = null;
        localStorage.setItem(PWA_INSTALLED_KEY, 'true');
      }
      
      return outcome;
    } catch {
      return 'unavailable';
    }
  }, []);

  return {
    installState,
    isStandalone,
    canPromptInstall,
    promptInstall,
    isIos,
    swStatus,
    cameraAvailable,
  };
}
