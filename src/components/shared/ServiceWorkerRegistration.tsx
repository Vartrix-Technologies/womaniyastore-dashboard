'use client';

import { useEffect } from 'react';

/**
 * Registers the service worker and handles updates.
 * Must be rendered as a client component inside `<body>`.
 *
 * Update flow:
 * 1. New SW installs and waits (no auto-skipWaiting in sw.js)
 * 2. This component detects the waiting worker
 * 3. Sends SKIP_WAITING message to activate the new SW
 * 4. Listens for `controllerchange` and reloads the page
 *    so the browser fetches fresh HTML/CSS/JS references
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    let refreshing = false;
    // Track whether there was a controller on page load (to distinguish
    // first-ever install from SW updates — only reload on updates).
    const hadController = !!navigator.serviceWorker.controller;

    // When the active controller changes (new SW took over), reload once
    // so the page loads fresh HTML that references the correct CSS/JS hashes.
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return;
      if (!hadController) return; // First install — no need to reload
      refreshing = true;
      window.location.reload();
    });

    // Register the SW immediately — don't wait for the `load` event
    // (React hydration typically runs after `load` has already fired,
    //  so a `load` listener would never execute.)
    const registerSW = async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
        });

        console.log('[PWA] Service Worker registered with scope:', registration.scope);

        // Check for updates periodically (every 60 minutes)
        setInterval(() => {
          registration.update();
        }, 60 * 60 * 1000);

        // Activate a waiting worker (e.g. from a previous visit that installed
        // an update but the user never closed all tabs).
        const activateWaiting = (worker: ServiceWorker) => {
          worker.postMessage({ type: 'SKIP_WAITING' });
        };

        if (registration.waiting) {
          activateWaiting(registration.waiting);
        }

        // When a new SW is found, wait for it to finish installing,
        // then tell it to activate (triggers controllerchange → reload).
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (!newWorker) return;

          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed') {
              if (navigator.serviceWorker.controller) {
                // There's an existing SW — this is an update
                console.log('[PWA] New service worker installed, activating update…');
                activateWaiting(newWorker);
              } else {
                // First-ever install — nothing to update
                console.log('[PWA] Service worker installed for the first time');
              }
            }
          });
        });
      } catch (error) {
        console.error('[PWA] Service Worker registration failed:', error);
      }
    };

    registerSW();
  }, []);

  return null;
}
