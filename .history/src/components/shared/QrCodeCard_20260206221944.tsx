'use client';

import { useEffect, useState, useRef } from 'react';
import QRCode from 'qrcode';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, Loader2 } from 'lucide-react';
import { appConfig } from '@/lib/config';
import { toast } from 'sonner';

interface QrCodeCardProps {
  /** The QR code string to encode (e.g., "WA-499-0001") */
  code: string;
  /** Size of the QR code in pixels (default: 200) */
  size?: number;
  /** Whether to show the download button (default: true) */
  showDownloadButton?: boolean;
  /** Whether to show the brand header (default: true) */
  showBrandHeader?: boolean;
  /** Custom class name for the card */
  className?: string;
  /** Callback when QR code canvas is ready (for bulk operations) */
  onCanvasReady?: (canvas: HTMLCanvasElement) => void;
}

/**
 * QrCodeCard - Displays a QR code with brand header and code text
 * 
 * Structure:
 * ┌─────────────────────┐
 * │    BRAND NAME       │  <- Brand header
 * │  ┌───────────────┐  │
 * │  │               │  │
 * │  │   QR CODE     │  │  <- QR code image
 * │  │               │  │
 * │  └───────────────┘  │
 * │    WA-499-0001      │  <- Code text
 * │     [Download]      │  <- Download button (optional)
 * └─────────────────────┘
 */
export function QrCodeCard({
  code,
  size = 200,
  showDownloadButton = true,
  showBrandHeader = true,
  className = '',
  onCanvasReady,
}: QrCodeCardProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    generateQrCode();
  }, [code, size]);

  const generateQrCode = async () => {
    try {
      setLoading(true);
      
      // Generate QR code as data URL
      const dataUrl = await QRCode.toDataURL(code, {
        width: size,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#ffffff',
        },
        errorCorrectionLevel: 'M',
      });
      
      setQrDataUrl(dataUrl);

      // If callback provided, create canvas for bulk operations
      if (onCanvasReady) {
        const canvas = await createBrandedCanvas(code, size);
        onCanvasReady(canvas);
      }
    } catch (error) {
      console.error('Error generating QR code:', error);
      toast.error('Failed to generate QR code');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Creates a branded canvas with header, QR code, and code text
   */
  const createBrandedCanvas = async (qrCode: string, qrSize: number): Promise<HTMLCanvasElement> => {
    const padding = 20;
    const headerHeight = 40;
    const textHeight = 30;
    const totalWidth = qrSize + (padding * 2);
    const totalHeight = headerHeight + qrSize + textHeight + (padding * 2);

    const canvas = document.createElement('canvas');
    canvas.width = totalWidth;
    canvas.height = totalHeight;
    const ctx = canvas.getContext('2d')!;

    // White background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, totalWidth, totalHeight);

    // Brand header (black background)
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, totalWidth, headerHeight);

    // Brand name text
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(appConfig.billing.receiptHeader, totalWidth / 2, headerHeight / 2);

    // Generate QR code to canvas
    const qrCanvas = document.createElement('canvas');
    await QRCode.toCanvas(qrCanvas, qrCode, {
      width: qrSize,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
      errorCorrectionLevel: 'M',
    });

    // Draw QR code
    ctx.drawImage(qrCanvas, padding, headerHeight + padding / 2);

    // Code text below QR
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 14px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(qrCode, totalWidth / 2, headerHeight + qrSize + padding);

    return canvas;
  };

  const handleDownload = async () => {
    try {
      setDownloading(true);

      // Create branded canvas
      const canvas = await createBrandedCanvas(code, size);
      
      // Convert to blob and download
      canvas.toBlob((blob) => {
        if (!blob) {
          toast.error('Failed to create image');
          return;
        }

        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `QR-${code}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        toast.success(`Downloaded QR code: ${code}`);
      }, 'image/png');
    } catch (error) {
      console.error('Error downloading QR code:', error);
      toast.error('Failed to download QR code');
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <Card className={`p-4 flex items-center justify-center ${className}`}>
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </Card>
    );
  }

  return (
    <Card className={`overflow-hidden ${className}`}>
      {/* Brand Header */}
      {showBrandHeader && (
        <div className="bg-black text-white text-center py-2 px-4">
          <span className="font-bold tracking-wider text-sm">
            {appConfig.billing.receiptHeader}
          </span>
        </div>
      )}

      {/* QR Code */}
      <div className="p-4 flex flex-col items-center gap-3">
        {qrDataUrl && (
          <img
            src={qrDataUrl}
            alt={`QR Code: ${code}`}
            width={size}
            height={size}
            className="block"
          />
        )}

        {/* Code Text */}
        <p className="font-mono font-bold text-sm text-center select-all">
          {code}
        </p>

        {/* Download Button */}
        {showDownloadButton && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownload}
            disabled={downloading}
            className="w-full"
          >
            {downloading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            Download
          </Button>
        )}
      </div>
    </Card>
  );
}

/**
 * Utility function to generate a branded QR code image as a data URL
 * Can be used for bulk operations without rendering the component
 */
export async function generateBrandedQrCode(
  code: string,
  size: number = 200
): Promise<string> {
  const padding = 20;
  const headerHeight = 40;
  const textHeight = 30;
  const totalWidth = size + (padding * 2);
  const totalHeight = headerHeight + size + textHeight + (padding * 2);

  const canvas = document.createElement('canvas');
  canvas.width = totalWidth;
  canvas.height = totalHeight;
  const ctx = canvas.getContext('2d')!;

  // White background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, totalWidth, totalHeight);

  // Brand header (black background)
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, totalWidth, headerHeight);

  // Brand name text
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 16px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(appConfig.billing.receiptHeader, totalWidth / 2, headerHeight / 2);

  // Generate QR code to canvas
  const qrCanvas = document.createElement('canvas');
  await QRCode.toCanvas(qrCanvas, code, {
    width: size,
    margin: 2,
    color: {
      dark: '#000000',
      light: '#ffffff',
    },
    errorCorrectionLevel: 'M',
  });

  // Draw QR code
  ctx.drawImage(qrCanvas, padding, headerHeight + padding / 2);

  // Code text below QR
  ctx.fillStyle = '#000000';
  ctx.font = 'bold 14px "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(code, totalWidth / 2, headerHeight + size + padding);

  return canvas.toDataURL('image/png');
}

/**
 * Utility function to download a single QR code
 */
export async function downloadQrCode(code: string, size: number = 200): Promise<void> {
  const dataUrl = await generateBrandedQrCode(code, size);
  
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = `QR-${code}.png`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
