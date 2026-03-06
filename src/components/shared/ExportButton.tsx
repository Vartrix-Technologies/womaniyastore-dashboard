'use client';

import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { toast } from 'sonner';

interface ExportButtonProps {
  data: any[];
  filename: string;
  disabled?: boolean;
}

export function ExportButton({ data, filename, disabled }: ExportButtonProps) {
  const handleExport = () => {
    if (!data || data.length === 0) {
      toast.warning('No data to export');
      return;
    }

    // Convert to CSV
    const headers = Object.keys(data[0]).join(',');
    const rows = data.map((row) =>
      Object.values(row)
        .map((val) => {
          const stringVal = String(val ?? '');
          // Escape quotes and wrap in quotes if contains comma
          return stringVal.includes(',') || stringVal.includes('"')
            ? `"${stringVal.replace(/"/g, '""')}"`
            : stringVal;
        })
        .join(',')
    );
    const csv = [headers, ...rows].join('\n');

    // Download
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Button onClick={handleExport} disabled={disabled} variant="outline">
      <Download className="mr-2 h-4 w-4" />
      Export CSV
    </Button>
  );
}
