'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  type QrStyleOptions,
  DEFAULT_QR_STYLE,
  renderQrToCanvas,
} from '@/lib/qr-styles';

// ── Props ────────────────────────────────────────────────────────────────────

interface QrCodeCardProps {
  /** The QR code string to encode (e.g. "WA-499-0001") */
  code: string;
  /** Size of the QR code in pixels (default: 200) */
  size?: number;
  /** Whether to show the download button (default: true) */
  showDownloadButton?: boolean;
  /** Whether to show the brand header (default: true) */
  showBrandHeader?: boolean;
  /** Custom class name for the card */
  className?: string;
  /** Optional style overrides for colours / badge / logo */
  style?: Partial<QrStyleOptions>;
  /** Callback when QR code canvas is ready (for bulk operations) */
  onCanvasReady?: (canvas: HTMLCanvasElement) => void;
}

// ── Component ────────────────────────────────────────────────────────────────

/**
 * QrCodeCard – Displays a single QR code with branded layout.
 *
 * Structure:
 * ┌─────────────────────┐
 * │    BRAND NAME       │  ← Brand header (optional)
 * │   [Badge Text]      │  ← Promo badge (optional)
 * │  ┌───────────────┐  │
 * │  │   QR CODE     │  │
 * │  └───────────────┘  │
 * │    WA-499-0001      │  ← Code text
 * │     [Download]      │  ← Download button (optional)
 * └─────────────────────┘
 */
export function QrCodeCard({
  code,
  size = 200,
  showDownloadButton = true,
  showBrandHeader = true,
  className = '',
  style: styleProp,
  onCanvasReady,
}: QrCodeCardProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  const mergedStyle: QrStyleOptions = {
    ...DEFAULT_QR_STYLE,
    ...styleProp,
    showHeader: showBrandHeader,
  };

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        const canvas = await renderQrToCanvas(code, size, mergedStyle);
        if (cancelled) return;
        setQrDataUrl(canvas.toDataURL('image/png'));
        if (onCanvasReady) onCanvasReady(canvas);
      } catch (err) {
        console.error('Error generating QR code:', err);
        toast.error('Failed to generate QR code');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, size, showBrandHeader, styleProp?.fgColor, styleProp?.bgColor, styleProp?.badgeText, styleProp?.showLogo]);

  const handleDownload = async () => {
    try {
      setDownloading(true);
      const canvas = await renderQrToCanvas(code, size, mergedStyle);
      canvas.toBlob((blob) => {
        if (!blob) {
          toast.error('Failed to create image');
          return;
        }
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `QR-${code}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success(`Downloaded QR code: ${code}`);
      }, 'image/png');
    } catch {
      toast.error('Failed to download QR code');
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <div className={`p-4 flex items-center justify-center ${className}`}>
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className={`flex flex-col items-center gap-3 ${className}`}>
      {/* The canvas image already includes the brand header, badge, QR code, and code text */}
      {qrDataUrl && (
        <img
          src={qrDataUrl}
          alt={`QR Code: ${code}`}
          className="block w-full max-w-[280px] h-auto rounded-lg"
        />
      )}

      {/* Download Button */}
      {showDownloadButton && (
        <Button
          variant="outline"
          size="sm"
          onClick={handleDownload}
          disabled={downloading}
          className="w-full max-w-[200px]"
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
  );
}

// ── Utility exports (for use outside the component) ─────────────────────────

/**
 * Generate a branded QR code image as a data URL.
 * Useful for bulk operations without rendering the component.
 */
export async function generateBrandedQrCode(
  code: string,
  size = 200,
  style?: Partial<QrStyleOptions>,
): Promise<string> {
  const merged: QrStyleOptions = { ...DEFAULT_QR_STYLE, ...style };
  const canvas = await renderQrToCanvas(code, size, merged);
  return canvas.toDataURL('image/png');
}

/**
 * Download a single QR code as a PNG.
 */
export async function downloadQrCode(
  code: string,
  size = 200,
  style?: Partial<QrStyleOptions>,
): Promise<void> {
  const dataUrl = await generateBrandedQrCode(code, size, style);
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = `QR-${code}.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
