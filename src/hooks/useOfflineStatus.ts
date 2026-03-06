// React hook for monitoring online/offline status
'use client';

import { useState, useEffect } from 'react';

export interface UseOfflineStatusReturn {
  isOnline: boolean;
  wasOffline: boolean;
}

/**
 * Hook to monitor network online/offline status
 * Returns current online status and whether we were recently offline
 */
export function useOfflineStatus(): UseOfflineStatusReturn {
  const [isOnline, setIsOnline] = useState(true);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    // Set initial status
    setIsOnline(navigator.onLine);

    function handleOnline() {
      setIsOnline(true);
      setWasOffline(true);
      
      // Clear wasOffline flag after 5 seconds
      setTimeout(() => {
        setWasOffline(false);
      }, 5000);
    }

    function handleOffline() {
      setIsOnline(false);
    }

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return { isOnline, wasOffline };
}
