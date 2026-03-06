'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[Error Boundary]', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-orange-50">
      <div className="text-center space-y-6 p-8 bg-white rounded-lg shadow-xl max-w-md">
        <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto">
          <span className="text-5xl">💥</span>
        </div>
        
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-gray-900">Oops! Something went wrong</h1>
          <p className="text-gray-600">
            Don't worry, this happens sometimes. Try refreshing the page.
          </p>
        </div>

        {error.message && (
          <div className="p-4 bg-red-50 rounded-lg border border-red-200">
            <p className="text-sm text-red-800 font-mono break-words">
              {error.message}
            </p>
          </div>
        )}

        <div className="flex gap-3 justify-center">
          <Button
            onClick={() => reset()}
            variant="default"
            size="lg"
          >
            Try Again
          </Button>
          
          <Button
            onClick={() => window.location.href = '/admin'}
            variant="outline"
            size="lg"
          >
            Go to Dashboard
          </Button>
        </div>

        <p className="text-xs text-gray-500">
          If this keeps happening, please contact support
        </p>
      </div>
    </div>
  );
}
