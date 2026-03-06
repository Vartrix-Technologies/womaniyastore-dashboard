'use client';

interface LoadingTableProps {
  /** Number of skeleton rows to render */
  rows?: number;
  /** Number of columns per row */
  columns?: number;
  /** Show a header skeleton row */
  showHeader?: boolean;
  /** Additional CSS classes on the wrapper */
  className?: string;
}

export function LoadingTable({
  rows = 5,
  columns = 5,
  showHeader = true,
  className = '',
}: LoadingTableProps) {
  return (
    <div className={`animate-pulse space-y-3 ${className}`}>
      {/* Header row */}
      {showHeader && (
        <div className="flex gap-4 pb-2 border-b">
          {Array.from({ length: columns }).map((_, i) => (
            <div
              key={`h-${i}`}
              className="h-4 bg-muted rounded flex-1"
              style={{ maxWidth: i === 0 ? '140px' : undefined }}
            />
          ))}
        </div>
      )}

      {/* Data rows */}
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <div key={rowIdx} className="flex gap-4 items-center">
          {Array.from({ length: columns }).map((_, colIdx) => (
            <div
              key={colIdx}
              className="h-4 bg-muted rounded flex-1"
              style={{
                maxWidth: colIdx === 0 ? '140px' : colIdx === columns - 1 ? '80px' : undefined,
                opacity: 1 - rowIdx * 0.08,
              }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
