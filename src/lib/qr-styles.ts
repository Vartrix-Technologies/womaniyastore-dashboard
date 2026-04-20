'use client';

import QRCode from 'qrcode';
import { appConfig } from '@/lib/config';

const s = appConfig.styles;

// ── Types ────────────────────────────────────────────────────────────────────

export type DotStyle = 'square' | 'rounded' | 'dots' | 'classy';

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
  /** Module dot style — square, rounded, dots, or classy (connected rounded) */
  dotStyle: DotStyle;
  /** Logo size as fraction of QR size (0.18–0.35) */
  logoSize: number;
}

export const DEFAULT_QR_STYLE: QrStyleOptions = {
  fgColor: '#000000',
  bgColor: '#ffffff',
  ecLevel: 'M',
  showHeader: true,
  badgeText: '',
  badgeColor: '#e11d48',
  badgeTextColor: '#ffffff',
  showLogo: true,
  logoUrl: '/womaniya_logo_lightbg.png',
  dotStyle: 'rounded',
  logoSize: 0.24,
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
  { name: 'Teal (Brand)',      fg: s.brandHex.primary, bg: s.brandHex.light },
];

/** Festival / promotion badge presets */
export const BADGE_PRESETS: { label: string; text: string; bg: string; fg: string }[] = [
  { label: 'None',             text: '',                bg: '#e11d48', fg: '#ffffff' },
  { label: 'New Arrival',      text: '🛍️ New Arrival',  bg: '#ec4899', fg: '#ffffff' },
  { label: 'Summer',           text: '☀️ Summer Sale',  bg: '#ea580c', fg: '#ffffff' },
  { label: 'Monsoon',          text: '🌧️ Monsoon Sale', bg: '#0284c7', fg: '#ffffff' },
  { label: 'Winter',           text: '❄️ Winter Sale',  bg: '#0284c7', fg: '#ffffff' },
  { label: 'New Year',         text: '🎆 New Year',     bg: '#7c3aed', fg: '#ffffff' },
  { label: 'Republic Day',     text: '🇮🇳 26th Jan',      bg: '#2563eb', fg: '#ffffff' },
  { label: 'Holi',             text: '🎨 Holi Fest',    bg: '#ec4899', fg: '#ffffff' },
  { label: 'Independence Day', text: '🇮🇳 15th Aug',      bg: '#f97316', fg: '#ffffff' },
  { label: 'Navratri',         text: '🔱 Navratri',     bg: '#dc2626', fg: '#ffffff' },
  { label: 'Diwali',           text: '🪔 Diwali Sale',  bg: '#f59e0b', fg: '#000000' },
  { label: 'Christmas',        text: '🎄 Christmas',    bg: '#16a34a', fg: '#ffffff' },
];

// ── Font preloading ─────────────────────────────────────────────────────────

let fontPromise: Promise<void> | null = null;

/**
 * Preload premium fonts (Inter + JetBrains Mono) from Google Fonts.
 * Uses CSS link injection + document.fonts.ready for reliable canvas rendering.
 * Falls back silently to system fonts if loading fails.
 */
function ensureFonts(): Promise<void> {
  if (fontPromise) return fontPromise;

  fontPromise = new Promise<void>(async (resolve) => {
    try {
      if (typeof document === 'undefined') { resolve(); return; }
      if (!document.querySelector('#qr-premium-fonts')) {
        const link = document.createElement('link');
        link.id = 'qr-premium-fonts';
        link.rel = 'stylesheet';
        link.href =
          'https://fonts.googleapis.com/css2?family=Inter:wght@600;700;800&family=JetBrains+Mono:wght@500;600;700&display=swap';
        document.head.appendChild(link);
      }
      // Wait for all declared fonts to finish loading (with 3 s timeout)
      await Promise.race([
        document.fonts.ready,
        new Promise((r) => setTimeout(r, 3000)),
      ]);
    } catch {
      /* fallback silently to system fonts */
    }
    resolve();
  });

  return fontPromise;
}

// ── Canvas drawing helpers ──────────────────────────────────────────────────

/** Draw and fill a rounded rectangle with uniform corner radius. */
function fillRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  ctx.fill();
}

/** Build a rounded-rect path WITHOUT filling — use before ctx.clip(). */
function roundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/** Stroke (outline only) a rounded rectangle with uniform corner radius. */
function strokeRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  ctx.stroke();
}

/**
 * Fill a rounded rectangle where each corner can have a different radius.
 * Used by the "classy" module style for context-aware corner rounding.
 */
function fillVariableRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  rTL: number, rTR: number, rBR: number, rBL: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + rTL, y);
  ctx.lineTo(x + w - rTR, y);
  if (rTR > 0) ctx.quadraticCurveTo(x + w, y, x + w, y + rTR);
  else ctx.lineTo(x + w, y);
  ctx.lineTo(x + w, y + h - rBR);
  if (rBR > 0) ctx.quadraticCurveTo(x + w, y + h, x + w - rBR, y + h);
  else ctx.lineTo(x + w, y + h);
  ctx.lineTo(x + rBL, y + h);
  if (rBL > 0) ctx.quadraticCurveTo(x, y + h, x, y + h - rBL);
  else ctx.lineTo(x, y + h);
  ctx.lineTo(x, y + rTL);
  if (rTL > 0) ctx.quadraticCurveTo(x, y, x + rTL, y);
  else ctx.lineTo(x, y);
  ctx.closePath();
  ctx.fill();
}

// ── QR module identification ────────────────────────────────────────────────

/** Check if a module position belongs to one of the three finder patterns (7×7 corners). */
function isFinderModule(row: number, col: number, size: number): boolean {
  if (row <= 6 && col <= 6) return true;            // top-left
  if (row <= 6 && col >= size - 7) return true;      // top-right
  if (row >= size - 7 && col <= 6) return true;      // bottom-left
  return false;
}

// ── Premium finder pattern rendering ────────────────────────────────────────

/**
 * Draw a single finder pattern with premium styling.
 * Outer ring → gap → inner core, all with rounded corners when style ≠ square.
 */
function drawFinderPattern(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  moduleSize: number,
  fgColor: string,
  bgColor: string,
  rounded: boolean,
) {
  const s7 = 7 * moduleSize;
  const s5 = 5 * moduleSize;
  const s3 = 3 * moduleSize;
  const off1 = moduleSize;
  const off2 = 2 * moduleSize;

  const outerR = rounded ? moduleSize * 1.0 : 0;
  const gapR   = rounded ? moduleSize * 0.7 : 0;
  const coreR  = rounded ? moduleSize * 0.5 : 0;

  // Outer filled rectangle
  ctx.fillStyle = fgColor;
  fillRoundedRect(ctx, x, y, s7, s7, outerR);

  // Gap in background colour
  ctx.fillStyle = bgColor;
  fillRoundedRect(ctx, x + off1, y + off1, s5, s5, gapR);

  // Inner core
  ctx.fillStyle = fgColor;
  fillRoundedRect(ctx, x + off2, y + off2, s3, s3, coreR);
}

// ── Module style renderers ──────────────────────────────────────────────────

/**
 * Draw a "classy" module — rounded corners only on exposed edges.
 * Corners touching another dark module stay sharp so adjacent modules
 * appear visually connected.
 */
function drawClassyModule(
  ctx: CanvasRenderingContext2D,
  data: Uint8Array | Uint8ClampedArray,
  size: number,
  row: number, col: number,
  x: number, y: number,
  ms: number, radius: number,
) {
  const dark = (r: number, c: number) =>
    r >= 0 && r < size && c >= 0 && c < size && data[r * size + c] !== 0;

  const rTL = (!dark(row - 1, col) && !dark(row, col - 1)) ? radius : 0;
  const rTR = (!dark(row - 1, col) && !dark(row, col + 1)) ? radius : 0;
  const rBR = (!dark(row + 1, col) && !dark(row, col + 1)) ? radius : 0;
  const rBL = (!dark(row + 1, col) && !dark(row, col - 1)) ? radius : 0;

  if (rTL + rTR + rBR + rBL === 0) {
    ctx.fillRect(x, y, ms, ms);
  } else {
    fillVariableRoundedRect(ctx, x, y, ms, ms, rTL, rTR, rBR, rBL);
  }
}

// ── Main rendering function ─────────────────────────────────────────────────

/**
 * Render a premium branded QR card to an off-screen canvas.
 *
 * Layout (top → bottom):
 *  ╭──────────────────────────────╮←─ rounded card corners
 *  │  ████ BRAND GRADIENT ████   │←─ teal→cyan gradient header
 *  │  ▓▓▓▓ BADGE STRIP ▓▓▓▓▓   │←─ optional festival/promo badge
 *  │                              │
 *  │     ╭─ QR modules ─╮        │←─ customizable dot style
 *  │     │  (with logo)  │        │    rounded / dots / classy / square
 *  │     ╰───────────────╯        │
 *  │                              │
 *  │       WA-001-0042            │←─ JetBrains Mono, legible
 *  ╰──────────────────────────────╯
 */
export async function renderQrToCanvas(
  code: string,
  qrPixelSize: number,
  style: QrStyleOptions = DEFAULT_QR_STYLE,
): Promise<HTMLCanvasElement> {
  // Load premium fonts (cached after first call)
  await ensureFonts();

  // Merge with defaults so new fields are always present
  const opts: QrStyleOptions = { ...DEFAULT_QR_STYLE, ...style };

  // ── Scaling ─────────────────────────────────────────────────────────────
  // All dimensions scale proportionally relative to a 160 px baseline.
  const BASE = 160;
  const sc = qrPixelSize / BASE;
  const px = (v: number) => Math.round(v * sc);

  // ── Layout measurements ─────────────────────────────────────────────────
  const sidePad     = px(14);
  const headerH     = opts.showHeader ? px(30) : 0;
  const badgeH      = opts.badgeText  ? px(22) : 0;
  const qrTopGap    = px(8);
  const qrBottomGap = px(6);
  const codeTextH   = px(24);
  const bottomPad   = px(10);
  const cardR       = px(10);

  const w = qrPixelSize + sidePad * 2;
  const h = headerH + badgeH + qrTopGap + qrPixelSize + qrBottomGap + codeTextH + bottomPad;

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  // ── 1. Card background with rounded corners ────────────────────────────
  ctx.fillStyle = opts.bgColor;
  fillRoundedRect(ctx, 0, 0, w, h, cardR);

  // Card border
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = Math.max(1, px(1.5));
  strokeRoundedRect(ctx, 0.5, 0.5, w - 1, h - 1, cardR);

  let y = 0;

  // ── 2. Premium gradient header ─────────────────────────────────────────
  if (opts.showHeader) {
    ctx.save();
    // Clip to card shape so header corners match card corners
    roundedRectPath(ctx, 0, 0, w, h, cardR);
    ctx.clip();

    // Solid black header background
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, w, headerH);

    // Header text – Inter Bold with letter-spacing
    ctx.fillStyle = '#ffffff';
    const hFontSize = Math.max(10, px(14));
    ctx.font = `800 ${hFontSize}px Inter, 'Segoe UI', system-ui, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    // Manual letter-spacing for premium typography
    const headerText = appConfig.billing.receiptHeader;
    const letterSpacing = px(1.5);
    const charWidths = [...headerText].map(ch => ctx.measureText(ch).width);
    const totalTextW = charWidths.reduce((a, b) => a + b, 0) + letterSpacing * (headerText.length - 1);
    let tx = (w - totalTextW) / 2;
    for (let i = 0; i < headerText.length; i++) {
      ctx.fillText(headerText[i], tx, headerH / 2);
      tx += charWidths[i] + letterSpacing;
    }

    ctx.restore();
    y += headerH;
  }

  // ── 3. Badge strip ─────────────────────────────────────────────────────
  if (opts.badgeText) {
    ctx.save();
    roundedRectPath(ctx, 0, 0, w, h, cardR);
    ctx.clip();

    ctx.fillStyle = opts.badgeColor;
    ctx.fillRect(0, y, w, badgeH);
    ctx.fillStyle = opts.badgeTextColor;
    const bFontSize = Math.max(8, px(11));
    ctx.font = `600 ${bFontSize}px Inter, 'Segoe UI', system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(opts.badgeText, w / 2, y + badgeH / 2);
    ctx.restore();
    y += badgeH;
  }

  y += qrTopGap;

  // ── 4. QR code rendering (custom module-level control) ─────────────────
  const qrX = sidePad;
  const qrY = y;

  // Get binary matrix from qrcode library
  const ecl = opts.showLogo ? 'H' : opts.ecLevel;
  const qrResult = (QRCode as any).create(code, { errorCorrectionLevel: ecl });
  const modData: Uint8Array | Uint8ClampedArray = qrResult.modules.data;
  const modCount: number = qrResult.modules.size;

  // Module sizing with 1-module quiet zone on each side
  const quietZone = 1;
  const modSide = modCount + quietZone * 2;
  const moduleSize = qrPixelSize / modSide;
  const originX = qrX + quietZone * moduleSize;
  const originY = qrY + quietZone * moduleSize;

  // QR area background
  ctx.fillStyle = opts.bgColor;
  ctx.fillRect(qrX, qrY, qrPixelSize, qrPixelSize);

  // Corner radius for modules
  const dotRadius =
    opts.dotStyle === 'dots'   ? moduleSize * 0.5 :
    opts.dotStyle === 'square' ? 0 :
                                 moduleSize * 0.35;

  // Render data modules (skip finder pattern zones — drawn separately)
  ctx.fillStyle = opts.fgColor;
  for (let row = 0; row < modCount; row++) {
    for (let col = 0; col < modCount; col++) {
      if (!modData[row * modCount + col]) continue;
      if (isFinderModule(row, col, modCount)) continue;

      const mx = originX + col * moduleSize;
      const my = originY + row * moduleSize;

      switch (opts.dotStyle) {
        case 'dots': {
          ctx.beginPath();
          ctx.arc(
            mx + moduleSize / 2,
            my + moduleSize / 2,
            moduleSize * 0.4,
            0,
            Math.PI * 2,
          );
          ctx.fill();
          break;
        }
        case 'rounded':
          fillRoundedRect(ctx, mx, my, moduleSize, moduleSize, dotRadius);
          break;

        case 'classy':
          drawClassyModule(ctx, modData, modCount, row, col, mx, my, moduleSize, dotRadius);
          break;

        default: // square
          ctx.fillRect(mx, my, moduleSize, moduleSize);
      }
    }
  }

  // ── 5. Premium finder patterns ─────────────────────────────────────────
  const finderRounded = opts.dotStyle !== 'square';
  const finderPositions = [
    { r: 0,            c: 0 },
    { r: 0,            c: modCount - 7 },
    { r: modCount - 7, c: 0 },
  ];
  for (const fp of finderPositions) {
    drawFinderPattern(
      ctx,
      originX + fp.c * moduleSize,
      originY + fp.r * moduleSize,
      moduleSize,
      opts.fgColor,
      opts.bgColor,
      finderRounded,
    );
  }

  // ── 6. Logo overlay ────────────────────────────────────────────────────
  if (opts.showLogo && opts.logoUrl) {
    try {
      const logoImg = await loadImage(opts.logoUrl);
      const logoFrac = opts.logoSize || 0.24;
      const logoSize = Math.round(qrPixelSize * logoFrac);
      const ringPad = Math.round(logoSize * 0.14);
      const totalArea = logoSize + ringPad * 2;

      const cx = qrX + qrPixelSize / 2;
      const cy = qrY + qrPixelSize / 2;

      // Outer shadow disc
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.18)';
      ctx.shadowBlur = px(6);
      ctx.shadowOffsetY = px(1);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(cx, cy, totalArea / 2 + px(1), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // White background disc
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(cx, cy, totalArea / 2, 0, Math.PI * 2);
      ctx.fill();

      // Brand accent ring
      ctx.strokeStyle = '#14b8a6'; // teal-500
      ctx.lineWidth = Math.max(1.5, px(2));
      ctx.beginPath();
      ctx.arc(cx, cy, totalArea / 2, 0, Math.PI * 2);
      ctx.stroke();

      // Draw logo image (high-quality resampling)
      ctx.save();
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.beginPath();
      ctx.arc(cx, cy, logoSize / 2, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(logoImg, cx - logoSize / 2, cy - logoSize / 2, logoSize, logoSize);
      ctx.restore();
    } catch {
      // silently skip if logo can't load
    }
  }

  y = qrY + qrPixelSize + qrBottomGap;

  // ── 7. Code text ───────────────────────────────────────────────────────
  const textColor = isLightColor(opts.bgColor)
    ? (opts.fgColor === '#ffffff' ? '#1a1a1a' : opts.fgColor)
    : '#ffffff';
  ctx.fillStyle = textColor;

  // Auto-shrink font to fit long codes within the card width
  const maxTextW = w - sidePad * 1.2;    // available width with a small margin
  let codeFontSize = Math.max(9, px(13));
  ctx.font = `600 ${codeFontSize}px "JetBrains Mono", "SF Mono", "Cascadia Code", "Fira Code", Consolas, monospace`;

  while (ctx.measureText(code).width > maxTextW && codeFontSize > 6) {
    codeFontSize -= 1;
    ctx.font = `600 ${codeFontSize}px "JetBrains Mono", "SF Mono", "Cascadia Code", "Fira Code", Consolas, monospace`;
  }

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(code, w / 2, y + codeTextH / 2);

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

/** Rough luminance check to determine if a hex colour is "light". */
function isLightColor(hex: string): boolean {
  const c = hex.replace('#', '');
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 155;
}
