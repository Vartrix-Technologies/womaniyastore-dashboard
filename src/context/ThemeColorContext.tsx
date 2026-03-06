'use client';

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';

/* ── Palette definitions ──────────────────────────────────────────────── */

export type PaletteId = 'ocean' | 'indigo' | 'emerald' | 'rose' | 'amber' | 'slate';

interface PaletteColors {
  50: string; 100: string; 200: string; 300: string; 400: string;
  500: string; 600: string; 700: string; 800: string; 900: string; 950: string;
}

export interface ColorPalette {
  id: PaletteId;
  label: string;
  description: string;
  /** Full accent ramp */
  colors: PaletteColors;
  /** Gradient endpoints (from → to) */
  gradient: { from: string; to: string };
  /** Gradient endpoints one shade darker (hover) */
  gradientHover: { from: string; to: string };
  /** Raw hex values for inline styles, canvas, SVG, etc. */
  brandHex: { solid: string; primary: string; light: string; solidRgb: string };
  /** Preview swatch: [from, to] gradient for the picker */
  swatch: [string, string];
}

export const COLOR_PALETTES: Record<PaletteId, ColorPalette> = {
  ocean: {
    id: 'ocean',
    label: 'Ocean',
    description: 'Teal & Cyan',
    colors: {
      50: '#f0fdfa', 100: '#ccfbf1', 200: '#99f6e4', 300: '#5eead4',
      400: '#2dd4bf', 500: '#14b8a6', 600: '#0d9488', 700: '#0f766e',
      800: '#115e59', 900: '#134e4a', 950: '#042f2e',
    },
    gradient: { from: '#14b8a6', to: '#0891b2' },       // teal-500 → cyan-600
    gradientHover: { from: '#0d9488', to: '#0e7490' },   // teal-600 → cyan-700
    brandHex: { solid: '#14b8a6', primary: '#0d9488', light: '#f0fdfa', solidRgb: 'rgb(20 184 166)' },
    swatch: ['#14b8a6', '#0891b2'],
  },
  indigo: {
    id: 'indigo',
    label: 'Indigo',
    description: 'Indigo & Violet',
    colors: {
      50: '#eef2ff', 100: '#e0e7ff', 200: '#c7d2fe', 300: '#a5b4fc',
      400: '#818cf8', 500: '#6366f1', 600: '#4f46e5', 700: '#4338ca',
      800: '#3730a3', 900: '#312e81', 950: '#1e1b4b',
    },
    gradient: { from: '#6366f1', to: '#7c3aed' },       // indigo-500 → violet-600
    gradientHover: { from: '#4f46e5', to: '#6d28d9' },   // indigo-600 → violet-700
    brandHex: { solid: '#6366f1', primary: '#4f46e5', light: '#eef2ff', solidRgb: 'rgb(99 102 241)' },
    swatch: ['#6366f1', '#7c3aed'],
  },
  emerald: {
    id: 'emerald',
    label: 'Emerald',
    description: 'Emerald & Teal',
    colors: {
      50: '#ecfdf5', 100: '#d1fae5', 200: '#a7f3d0', 300: '#6ee7b7',
      400: '#34d399', 500: '#10b981', 600: '#059669', 700: '#047857',
      800: '#065f46', 900: '#064e3b', 950: '#022c22',
    },
    gradient: { from: '#10b981', to: '#14b8a6' },       // emerald-500 → teal-500
    gradientHover: { from: '#059669', to: '#0d9488' },   // emerald-600 → teal-600
    brandHex: { solid: '#10b981', primary: '#059669', light: '#ecfdf5', solidRgb: 'rgb(16 185 129)' },
    swatch: ['#10b981', '#14b8a6'],
  },
  rose: {
    id: 'rose',
    label: 'Rose',
    description: 'Rose & Pink',
    colors: {
      50: '#fff1f2', 100: '#ffe4e6', 200: '#fecdd3', 300: '#fda4af',
      400: '#fb7185', 500: '#f43f5e', 600: '#e11d48', 700: '#be123c',
      800: '#9f1239', 900: '#881337', 950: '#4c0519',
    },
    gradient: { from: '#f43f5e', to: '#ec4899' },       // rose-500 → pink-500
    gradientHover: { from: '#e11d48', to: '#db2777' },   // rose-600 → pink-600
    brandHex: { solid: '#f43f5e', primary: '#e11d48', light: '#fff1f2', solidRgb: 'rgb(244 63 94)' },
    swatch: ['#f43f5e', '#ec4899'],
  },
  amber: {
    id: 'amber',
    label: 'Amber',
    description: 'Amber & Orange',
    colors: {
      50: '#fffbeb', 100: '#fef3c7', 200: '#fde68a', 300: '#fcd34d',
      400: '#fbbf24', 500: '#f59e0b', 600: '#d97706', 700: '#b45309',
      800: '#92400e', 900: '#78350f', 950: '#451a03',
    },
    gradient: { from: '#f59e0b', to: '#ea580c' },       // amber-500 → orange-600
    gradientHover: { from: '#d97706', to: '#c2410c' },   // amber-600 → orange-700
    brandHex: { solid: '#f59e0b', primary: '#d97706', light: '#fffbeb', solidRgb: 'rgb(245 158 11)' },
    swatch: ['#f59e0b', '#ea580c'],
  },
  slate: {
    id: 'slate',
    label: 'Slate',
    description: 'Slate & Zinc',
    colors: {
      50: '#f8fafc', 100: '#f1f5f9', 200: '#e2e8f0', 300: '#cbd5e1',
      400: '#94a3b8', 500: '#64748b', 600: '#475569', 700: '#334155',
      800: '#1e293b', 900: '#0f172a', 950: '#020617',
    },
    gradient: { from: '#64748b', to: '#52525b' },       // slate-500 → zinc-600
    gradientHover: { from: '#475569', to: '#3f3f46' },   // slate-600 → zinc-700
    brandHex: { solid: '#64748b', primary: '#475569', light: '#f8fafc', solidRgb: 'rgb(100 116 139)' },
    swatch: ['#64748b', '#52525b'],
  },
};

const STORAGE_KEY = 'womaniya-color-palette';
const DEFAULT_PALETTE: PaletteId = 'ocean';

/* ── Context ──────────────────────────────────────────────────────────── */

interface ThemeColorContextValue {
  paletteId: PaletteId;
  palette: ColorPalette;
  setPalette: (id: PaletteId) => void;
}

const ThemeColorContext = createContext<ThemeColorContextValue | undefined>(undefined);

/* ── Apply CSS custom properties to :root ─────────────────────────────── */
/* Override the --color-brand-* variables that Tailwind emits from @theme */

function applyPalette(palette: ColorPalette) {
  const root = document.documentElement;
  const shades = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;

  for (const shade of shades) {
    root.style.setProperty(`--color-brand-${shade}`, palette.colors[shade]);
  }

  root.style.setProperty('--color-brand-from', palette.gradient.from);
  root.style.setProperty('--color-brand-to', palette.gradient.to);
  root.style.setProperty('--color-brand-from-hover', palette.gradientHover.from);
  root.style.setProperty('--color-brand-to-hover', palette.gradientHover.to);

  // Update meta theme-color so the mobile status bar matches the palette
  const isDark = root.classList.contains('dark');
  const themeColor = isDark ? palette.colors[950] : palette.colors[50];
  const metaTags = document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]');
  if (metaTags.length > 0) {
    metaTags.forEach(meta => {
      const media = meta.getAttribute('media');
      if (media?.includes('dark')) {
        meta.setAttribute('content', palette.colors[950]);
      } else {
        meta.setAttribute('content', palette.colors[50]);
      }
    });
  } else {
    // Fallback: create a single meta tag
    const meta = document.createElement('meta');
    meta.name = 'theme-color';
    meta.content = themeColor;
    document.head.appendChild(meta);
  }
}

/* ── Provider ─────────────────────────────────────────────────────────── */

export function ThemeColorProvider({ children }: { children: ReactNode }) {
  const [paletteId, setPaletteId] = useState<PaletteId>(DEFAULT_PALETTE);

  // Hydrate from localStorage and apply chosen palette
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as PaletteId | null;
    if (stored && COLOR_PALETTES[stored]) {
      setPaletteId(stored);
      applyPalette(COLOR_PALETTES[stored]);
    }
    // Default palette doesn't need applyPalette — CSS @theme already has those values
  }, []);

  const setPalette = useCallback((id: PaletteId) => {
    setPaletteId(id);
    localStorage.setItem(STORAGE_KEY, id);
    applyPalette(COLOR_PALETTES[id]);
  }, []);

  const palette = COLOR_PALETTES[paletteId];

  // Always render children — default brand colors come from CSS @theme block
  // Only non-default palettes need the JS override (handled in useEffect above)
  return (
    <ThemeColorContext.Provider value={{ paletteId, palette, setPalette }}>
      {children}
    </ThemeColorContext.Provider>
  );
}

/* ── Hook ─────────────────────────────────────────────────────────────── */

export function useThemeColor() {
  const ctx = useContext(ThemeColorContext);
  if (!ctx) throw new Error('useThemeColor must be used within ThemeColorProvider');
  return ctx;
}
