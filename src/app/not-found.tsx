'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  const handleGoBack = () => {
    // Use window.history instead of router for more reliable back navigation
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.location.href = '/admin';
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50 p-4">
      <div className="text-center space-y-6 p-8 bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
          <span className="text-5xl">🔍</span>
        </div>
        
        <div className="space-y-2">
          <h1 className="text-6xl font-bold text-blue-600">404</h1>
          <h2 className="text-2xl font-bold text-gray-900">Page Not Found</h2>
          <p className="text-gray-600">
            The page you're looking for doesn't exist or has been moved.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <Button
            onClick={handleGoBack}
            variant="outline"
            size="lg"
            className="w-full"
          >
            ← Go Back
          </Button>
          
          <Link href="/admin" className="w-full">
            <Button variant="default" size="lg" className="w-full">
              Go to Dashboard
            </Button>
          </Link>
        </div>

        <p className="text-xs text-gray-500">
          If you think this is a mistake, please refresh the page
        </p>
      </div>
    </div>
  );
}
