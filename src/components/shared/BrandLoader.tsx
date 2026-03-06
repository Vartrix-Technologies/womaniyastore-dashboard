'use client';

import { cn } from '@/lib/utils';

interface BrandLoaderProps {
  /** Text shown below the logo (e.g. "Loading your dashboard...") */
  message?: string;
  /** When true, renders full-screen centered. When false, fills its parent container. */
  fullScreen?: boolean;
  /** Additional className for the outer wrapper */
  className?: string;
}

/**
 * Branded loading screen with animated logo and bouncing dots.
 * Used during auth checks, page transitions, and data loading.
 */
export function BrandLoader({
  message = 'Loading...',
  fullScreen = true,
  className,
}: BrandLoaderProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-center bg-background',
        fullScreen ? 'min-h-screen' : 'min-h-[40vh]',
        className
      )}
    >
      <div className="text-center space-y-5">
        <div className="w-20 h-20 mx-auto rounded-full overflow-hidden shadow-lg">
          <img
            src="/womaniya_logo_darkbg.png"
            alt="Loading"
            className="w-full h-full object-cover animate-pulse drop-shadow-lg dark:hidden"
          />
          <img
            src="/womaniya_logo_lightbg.png"
            alt="Loading"
            className="w-full h-full object-cover animate-pulse drop-shadow-lg hidden dark:block"
          />
        </div>
        <p className="text-sm text-muted-foreground animate-pulse">{message}</p>
        <div className="flex justify-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-primary/60 animate-bounce [animation-delay:0ms]" />
          <span className="w-2 h-2 rounded-full bg-primary/60 animate-bounce [animation-delay:150ms]" />
          <span className="w-2 h-2 rounded-full bg-primary/60 animate-bounce [animation-delay:300ms]" />
        </div>
      </div>
    </div>
  );
}
