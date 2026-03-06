'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, Loader2 } from 'lucide-react';
import { appConfig } from '@/lib/config';
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

      {/* Badge strip */}
      {mergedStyle.badgeText && (
        <div
          className="text-center py-1 px-2 text-xs font-bold"
          style={{ backgroundColor: mergedStyle.badgeColor, color: mergedStyle.badgeTextColor }}
        >
          {mergedStyle.badgeText}
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
        <p className="font-mono font-bold text-sm text-center select-all">{code}</p>

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
