'use client';

import QRCode from 'qrcode';
import { appConfig } from '@/lib/config';

// ── Types ────────────────────────────────────────────────────────────────────

export interface QrStyleOptions {
  /** Foreground (dark module) colour – hex */
  fgColor: string;
  /** Background colour – hex */
  bgColor: string;
  /** Error‑correction level */
  ecLevel: 'L' | 'M' | 'Q' | 'H';
  /** Show branded header bar on card */
  showHeader: boolean;
  /** Badge / promo text rendered below brand header (e.g. "Diwali 2025") */
  badgeText: string;
  /** Badge background colour – hex */
  badgeColor: string;
  /** Badge text colour – hex */
  badgeTextColor: string;
  /** Whether to try loading logo image in QR centre */
  showLogo: boolean;
  /** Logo image URL (defaults to appConfig.billing.logoPath) */
  logoUrl: string;
}

export const DEFAULT_QR_STYLE: QrStyleOptions = {
  fgColor: '#000000',
  bgColor: '#ffffff',
  ecLevel: 'M',
  showHeader: true,
  badgeText: '',
  badgeColor: '#e11d48',
  badgeTextColor: '#ffffff',
  showLogo: false,
  logoUrl: appConfig.billing.logoPath,
};

/** Preset colour themes the user can pick from */
export const QR_COLOR_PRESETS: { name: string; fg: string; bg: string }[] = [
  { name: 'Classic',           fg: '#000000', bg: '#ffffff' },
  { name: 'Midnight',          fg: '#1e293b', bg: '#f8fafc' },
  { name: 'Ocean',             fg: '#0369a1', bg: '#f0f9ff' },
  { name: 'Forest',            fg: '#166534', bg: '#f0fdf4' },
  { name: 'Royal Purple',      fg: '#6b21a8', bg: '#faf5ff' },
  { name: 'Rose',              fg: '#be123c', bg: '#fff1f2' },
  { name: 'Amber',             fg: '#92400e', bg: '#fffbeb' },
  { name: 'Teal (Brand)',      fg: '#0d9488', bg: '#f0fdfa' },
];

/** Festival / promotion badge presets */
export const BADGE_PRESETS: { label: string; text: string; bg: string; fg: string }[] = [
  { label: 'None',             text: '',                bg: '#e11d48', fg: '#ffffff' },
  { label: 'Diwali',           text: '🪔 Diwali Sale',  bg: '#f59e0b', fg: '#000000' },
  { label: 'Christmas',        text: '🎄 Christmas',    bg: '#16a34a', fg: '#ffffff' },
  { label: 'New Year',         text: '🎆 New Year',     bg: '#7c3aed', fg: '#ffffff' },
  { label: 'Holi',             text: '🎨 Holi Fest',    bg: '#ec4899', fg: '#ffffff' },
  { label: 'Summer',           text: '☀️ Summer Sale',  bg: '#ea580c', fg: '#ffffff' },
  { label: 'Monsoon',          text: '🌧️ Monsoon',     bg: '#0284c7', fg: '#ffffff' },
  { label: 'Eid',              text: '🌙 Eid Mubarak',  bg: '#059669', fg: '#ffffff' },
  { label: 'Navratri',         text: '🔱 Navratri',     bg: '#dc2626', fg: '#ffffff' },
  { label: 'Raksha Bandhan',   text: '🎀 Rakhi',        bg: '#c026d3', fg: '#ffffff' },
  { label: 'Independence Day', text: '🇮🇳 15th Aug',    bg: '#f97316', fg: '#ffffff' },
  { label: 'Republic Day',     text: '🇮🇳 26th Jan',    bg: '#2563eb', fg: '#ffffff' },
];

// ── Canvas rendering ────────────────────────────────────────────────────────

/**
 * Render a branded QR card to an off‑screen canvas.
 *
 * Layout from top → bottom:
 *  • Optional brand header (black bar with white text)
 *  • Optional badge strip
 *  • QR code with optional logo overlay
 *  • Code text
 */
export async function renderQrToCanvas(
  code: string,
  qrPixelSize: number,
  style: QrStyleOptions = DEFAULT_QR_STYLE,
): Promise<HTMLCanvasElement> {
  const padding = 8;
  const headerH = style.showHeader ? 22 : 0;
  const badgeH = style.badgeText ? 18 : 0;
  const textH = 18;
  const w = qrPixelSize + padding * 2;
  const h = headerH + badgeH + qrPixelSize + textH + padding;

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  // ── background + border
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = '#d1d5db';
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, w - 1, h - 1);

  let y = 0;

  // ── brand header
  if (style.showHeader) {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, w, headerH);
    ctx.fillStyle = '#ffffff';
    const fSize = Math.max(8, Math.min(12, qrPixelSize / 10));
    ctx.font = `bold ${fSize}px Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(appConfig.billing.receiptHeader, w / 2, headerH / 2);
    y += headerH;
  }

  // ── badge strip
  if (style.badgeText) {
    ctx.fillStyle = style.badgeColor;
    ctx.fillRect(0, y, w, badgeH);
    ctx.fillStyle = style.badgeTextColor;
    const bSize = Math.max(7, Math.min(10, qrPixelSize / 12));
    ctx.font = `bold ${bSize}px Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(style.badgeText, w / 2, y + badgeH / 2);
    y += badgeH;
  }

  // ── QR code
  const qrCanvas = document.createElement('canvas');
  await QRCode.toCanvas(qrCanvas, code, {
    width: qrPixelSize,
    margin: 1,
    color: { dark: style.fgColor, light: style.bgColor },
    errorCorrectionLevel: style.showLogo ? 'H' : style.ecLevel,   // need H for logo overlay
  });
  ctx.drawImage(qrCanvas, padding, y);

  // ── logo overlay in centre
  if (style.showLogo && style.logoUrl) {
    try {
      const logoImg = await loadImage(style.logoUrl);
      const logoSize = Math.round(qrPixelSize * 0.22);
      const lx = padding + (qrPixelSize - logoSize) / 2;
      const ly = y + (qrPixelSize - logoSize) / 2;

      // white circle background so logo is visible
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(lx + logoSize / 2, ly + logoSize / 2, logoSize / 2 + 3, 0, Math.PI * 2);
      ctx.fill();

      ctx.drawImage(logoImg, lx, ly, logoSize, logoSize);
    } catch {
      // silently skip if logo can't load
    }
  }

  y += qrPixelSize;

  // ── code text
  ctx.fillStyle = style.fgColor === '#ffffff' ? '#000000' : style.fgColor;
  const codeFontSize = Math.max(6, Math.min(10, qrPixelSize / 12));
  ctx.font = `bold ${codeFontSize}px "Courier New", monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(code, w / 2, y + 3);

  return canvas;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
