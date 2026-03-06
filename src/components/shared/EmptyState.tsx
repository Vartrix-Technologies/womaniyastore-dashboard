'use client';

import { LucideIcon, Package } from 'lucide-react';
import { ReactNode } from 'react';

interface EmptyStateProps {
  /** Lucide icon to display (defaults to Package) */
  icon?: LucideIcon;
  /** Primary message */
  title: string;
  /** Optional secondary message */
  description?: string;
  /** Optional action button or any ReactNode below the description */
  action?: ReactNode;
  /** Additional CSS classes on the wrapper */
  className?: string;
  /** Use inside a table row — wraps in <tr><td colSpan> */
  colSpan?: number;
}

export function EmptyState({
  icon: Icon = Package,
  title,
  description,
  action,
  className = '',
  colSpan,
}: EmptyStateProps) {
  const content = (
    <div className={`text-center py-12 ${className}`}>
      <Icon className="h-12 w-12 md:h-16 md:w-16 mx-auto text-muted-foreground mb-3" />
      <p className="text-sm md:text-base text-muted-foreground mb-2">{title}</p>
      {description && (
        <p className="text-xs text-muted-foreground mb-4">{description}</p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );

  if (colSpan) {
    return (
      <tr>
        <td colSpan={colSpan} className="p-0">
          {content}
        </td>
      </tr>
    );
  }

  return content;
}
