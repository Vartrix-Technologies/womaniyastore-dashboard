'use client';

import { useState } from 'react';
import QRCode from 'qrcode';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Download, Printer, FileImage, Loader2, CheckCircle } from 'lucide-react';
import { appConfig } from '@/lib/config';
import { toast } from 'sonner';
import jsPDF from 'jspdf';

interface QrCodeDownloadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Array of QR code strings to download/print */
  codes: string[];
  /** Title shown in the dialog */
  title?: string;
}

type DownloadFormat = 'individual' | 'print-sheet';
type PrintLayout = '4x6' | '6x8' | '8x10'; // Codes per page

interface LayoutConfig {
  cols: number;
  rows: number;
  qrSize: number;
  pageWidth: number;
  pageHeight: number;
  label: string;
}

const LAYOUT_CONFIGS: Record<PrintLayout, LayoutConfig> = {
  '4x6': { cols: 4, rows: 6, qrSize: 120, pageWidth: 595, pageHeight: 842, label: '4×6 (24 per page)' },
  '6x8': { cols: 6, rows: 8, qrSize: 80, pageWidth: 595, pageHeight: 842, label: '6×8 (48 per page)' },
  '8x10': { cols: 8, rows: 10, qrSize: 60, pageWidth: 595, pageHeight: 842, label: '8×10 (80 per page)' },
};

/**
 * QrCodeDownloadDialog - Dialog for downloading or printing multiple QR codes
 * 
 * Features:
 * - Individual PNG downloads
 * - Print sheet generation (PDF with grid layout)
 * - Multiple layout options
 * - Progress tracking for bulk operations
 */
export function QrCodeDownloadDialog({
  open,
  onOpenChange,
  codes,
  title = 'Download QR Codes',
}: QrCodeDownloadDialogProps) {
  const [format, setFormat] = useState<DownloadFormat>('print-sheet');
  const [layout, setLayout] = useState<PrintLayout>('4x6');
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [completed, setCompleted] = useState(false);

  const handleDownload = async () => {
    if (codes.length === 0) {
      toast.error('No QR codes selected');
      return;
    }

    setProcessing(true);
    setProgress(0);
    setCompleted(false);

    try {
      if (format === 'individual') {
        await downloadIndividualImages(codes, setProgress);
      } else {
        await generatePrintSheet(codes, layout, setProgress);
      }
      
      setCompleted(true);
      toast.success(`Successfully processed ${codes.length} QR codes`);
    } catch (error) {
      console.error('Error processing QR codes:', error);
      toast.error('Failed to process QR codes');
    } finally {
      setProcessing(false);
    }
  };

  const handleClose = () => {
    if (!processing) {
      setCompleted(false);
      setProgress(0);
      onOpenChange(false);
    }
  };

  const layoutConfig = LAYOUT_CONFIGS[layout];
  const codesPerPage = layoutConfig.cols * layoutConfig.rows;
  const totalPages = Math.ceil(codes.length / codesPerPage);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileImage className="h-5 w-5" />
            {title}
          </DialogTitle>
          <DialogDescription className="flex items-center gap-2">
            <Badge variant="secondary">{codes.length} QR code(s) selected</Badge>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Format Selection */}
          <div className="space-y-2">
            <Label>Download Format</Label>
            <Select
              value={format}
              onValueChange={(v) => setFormat(v as DownloadFormat)}
              disabled={processing}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="print-sheet">
                  <div className="flex items-center gap-2">
                    <Printer className="h-4 w-4" />
                    <span>Print Sheet (PDF)</span>
                  </div>
                </SelectItem>
                <SelectItem value="individual">
                  <div className="flex items-center gap-2">
                    <Download className="h-4 w-4" />
                    <span>Individual Images (PNG)</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Layout Selection (for print sheet) */}
          {format === 'print-sheet' && (
            <div className="space-y-2">
              <Label>Print Layout</Label>
              <Select
                value={layout}
                onValueChange={(v) => setLayout(v as PrintLayout)}
                disabled={processing}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(LAYOUT_CONFIGS).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      {config.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Will generate {totalPages} page(s) • {codesPerPage} codes per page
              </p>
            </div>
          )}

          {/* Progress */}
          {processing && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Processing...</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}

          {/* Completed */}
          {completed && (
            <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 p-3 rounded-lg">
              <CheckCircle className="h-5 w-5" />
              <span>
                {format === 'print-sheet' 
                  ? `PDF with ${totalPages} page(s) downloaded!`
                  : `${codes.length} image(s) downloaded!`
                }
              </span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={processing}>
            {completed ? 'Close' : 'Cancel'}
          </Button>
          <Button onClick={handleDownload} disabled={processing || completed}>
            {processing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Processing...
              </>
            ) : (
              <>
                {format === 'print-sheet' ? (
                  <Printer className="h-4 w-4 mr-2" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                {format === 'print-sheet' ? 'Generate PDF' : 'Download All'}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Generate a single branded QR code canvas
 */
async function createBrandedQrCanvas(
  code: string,
  qrSize: number
): Promise<HTMLCanvasElement> {
  const padding = 8;
  const headerHeight = 20;
  const textHeight = 18;
  const totalWidth = qrSize + (padding * 2);
  const totalHeight = headerHeight + qrSize + textHeight + padding;

  const canvas = document.createElement('canvas');
  canvas.width = totalWidth;
  canvas.height = totalHeight;
  const ctx = canvas.getContext('2d')!;

  // White background with border
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, totalWidth, totalHeight);
  ctx.strokeStyle = '#e5e7eb';
  ctx.strokeRect(0, 0, totalWidth, totalHeight);

  // Brand header (black bar)
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, totalWidth, headerHeight);

  // Brand name text
  ctx.fillStyle = '#ffffff';
  const fontSize = Math.max(8, Math.min(12, qrSize / 10));
  ctx.font = `bold ${fontSize}px Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(appConfig.billing.receiptHeader, totalWidth / 2, headerHeight / 2);

  // Generate QR code
  const qrCanvas = document.createElement('canvas');
  await QRCode.toCanvas(qrCanvas, code, {
    width: qrSize,
    margin: 1,
    color: {
      dark: '#000000',
      light: '#ffffff',
    },
    errorCorrectionLevel: 'M',
  });

  // Draw QR code
  ctx.drawImage(qrCanvas, padding, headerHeight);

  // Code text below QR
  ctx.fillStyle = '#000000';
  const codeFontSize = Math.max(6, Math.min(10, qrSize / 12));
  ctx.font = `bold ${codeFontSize}px "Courier New", monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(code, totalWidth / 2, headerHeight + qrSize + 2);

  return canvas;
}

/**
 * Download individual PNG images
 */
async function downloadIndividualImages(
  codes: string[],
  onProgress: (progress: number) => void
): Promise<void> {
  const qrSize = 200;
  
  for (let i = 0; i < codes.length; i++) {
    const code = codes[i];
    const canvas = await createBrandedQrCanvas(code, qrSize);
    
    // Convert to blob and download
    const blob = await new Promise<Blob>((resolve) => {
      canvas.toBlob((b) => resolve(b!), 'image/png');
    });
    
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `QR-${code}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    // Small delay to prevent browser blocking
    await new Promise((r) => setTimeout(r, 100));
    
    onProgress(((i + 1) / codes.length) * 100);
  }
}

/**
 * Generate a print-ready PDF with QR codes in a grid layout
 */
async function generatePrintSheet(
  codes: string[],
  layout: PrintLayout,
  onProgress: (progress: number) => void
): Promise<void> {
  const config = LAYOUT_CONFIGS[layout];
  const { cols, rows, qrSize } = config;
  const codesPerPage = cols * rows;

  // A4 size in mm
  const pageWidth = 210;
  const pageHeight = 297;
  
  // Calculate cell size and margins
  const marginX = 10;
  const marginY = 10;
  const cellWidth = (pageWidth - (marginX * 2)) / cols;
  const cellHeight = (pageHeight - (marginY * 2)) / rows;

  // Create PDF
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const totalPages = Math.ceil(codes.length / codesPerPage);
  let codeIndex = 0;

  for (let page = 0; page < totalPages; page++) {
    if (page > 0) {
      pdf.addPage();
    }

    // Draw grid of QR codes
    for (let row = 0; row < rows && codeIndex < codes.length; row++) {
      for (let col = 0; col < cols && codeIndex < codes.length; col++) {
        const code = codes[codeIndex];
        
        // Generate QR code canvas
        const canvas = await createBrandedQrCanvas(code, qrSize);
        const dataUrl = canvas.toDataURL('image/png');

        // Calculate position
        const x = marginX + (col * cellWidth) + (cellWidth - qrSize / 3.78) / 2; // 3.78 = px to mm
        const y = marginY + (row * cellHeight);
        
        // Add to PDF (qrSize / 3.78 converts px to mm approximately)
        const imgWidth = Math.min(cellWidth - 2, qrSize / 3.78);
        const imgHeight = imgWidth * (canvas.height / canvas.width);
        
        pdf.addImage(dataUrl, 'PNG', x, y, imgWidth, imgHeight);

        codeIndex++;
        onProgress((codeIndex / codes.length) * 100);
      }
    }
  }

  // Download PDF
  const timestamp = new Date().toISOString().slice(0, 10);
  pdf.save(`QR-Codes-${timestamp}.pdf`);
}
