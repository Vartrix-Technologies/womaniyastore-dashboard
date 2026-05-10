/**
 * App Configuration
 * 
 * This file contains all branding and identity settings for the app.
 * When using this as a skeleton for new projects, update these values
 * to customize the app for different clients.
 * 
 * Note: Login page and loader components are intentionally kept separate
 * for per-project customization to prevent reuse by clients.
 */

export const appConfig = {
  /**
   * Brand Identity
   */
  brand: {
    /** The main brand name shown in TopBar and headers */
    name: 'Womaniya',
    /** Full app name with descriptor */
    fullName: 'Womaniya Dashboard',
    /** Short name for PWA and mobile */
    shortName: 'Womaniya',
    /** App tagline/description */
    description: 'Point of Sale and Inventory Management System',
    /** Single letter/character for logo avatar */
    logoLetter: 'WA',
  },

  /**
   * Theme Colors
   * These are used for brand elements like logo backgrounds.
   * The actual colour values are driven by CSS custom properties
   * set by ThemeColorContext — change palette at runtime.
   */
  theme: {
    /** Primary gradient colors for logo background */
    logoGradient: {
      from: 'from-brand-from',
      to: 'to-brand-to',
    },
    /** PWA theme color */
    themeColor: '#f0fdfa',
    /** PWA background color */
    backgroundColor: '#f0fdfa',
  },

  /**
   * Design System Style Tokens
   * Centralized Tailwind class tokens used across all pages.
   * Change these to re-skin the entire app.
   *
   * The `accent` block covers every shade from the primary colour ramp
   * (teal-50 → teal-950) so a single colour swap repaints the whole UI.
   * Future: populate these from a user-chosen colour via Settings.
   */
  styles: {
    /* ── Primary action gradients ─────────────────────────────────── */
    primaryGradient: 'bg-gradient-to-r from-brand-from to-brand-to',
    /** Gradient stops only — use when the direction differs (e.g. bg-gradient-to-br) */
    primaryGradientStops: 'from-brand-from to-brand-to',
    primaryGradientHover: 'hover:from-brand-from-hover hover:to-brand-to-hover',
    /** Page header icon badge gradient */
    headerIconGradient: 'bg-gradient-to-br from-brand-from to-brand-to',

    /* ── Link / back-button colours ───────────────────────────────── */
    linkColor: 'text-brand-600',
    linkHover: 'hover:text-brand-700 hover:bg-brand-50',

    /* ── Accent colour ramp (derived from one hue) ────────────────── */
    accent: {
      /** Backgrounds */
      bg:           'bg-brand-50 dark:bg-brand-950/30',
      bgSubtle:     'bg-brand-50/50',
      bgMuted:      'bg-brand-100',
      bgSolid:      'bg-brand-500',
      bgDark:       'dark:bg-brand-950/30',
      bgDarkSolid:  'dark:bg-brand-950',
      bgDarkSubtle: 'dark:bg-brand-950/20',
      bgDarkMid:    'dark:bg-brand-950/50',

      /** Text */
      text:         'text-brand-700',
      textMuted:    'text-brand-500',

      /** Borders */
      border:       'border-brand-200 dark:border-brand-800',
      borderMid:    'border-brand-300',
      borderStrong: 'border-brand-500',
      borderLeft:   'border-l-brand-500',
      borderDark:   'dark:border-brand-800',
      borderDarkMid:'dark:border-brand-700',

      /** Hover states (apply directly in className) */
      hoverBg:      'hover:bg-brand-50 dark:hover:bg-brand-950/40',
      hoverBorder:  'hover:border-brand-300 dark:hover:border-brand-700',
      hoverShadow:  'hover:shadow-brand-500/20',

      /** Focus states */
      focusRing:    'focus:ring-brand-500',
      focusBorder:  'focus:border-brand-500',

      /** Decorative rings */
      ring:         'ring-brand-500/20',
      ringLight:    'ring-brand-200',

      /** Secondary gradients */
      gradientSubtle: 'from-brand-50 to-brand-100/50',
      gradientLight:  'from-brand-400 to-brand-500',
      gradientCard:   'from-brand-500 to-brand-600',
      topBarBg:       'from-slate-50 to-brand-50',
      particleBg:     'bg-brand-300/40',

      /** Composite: settings-tab active state (Tailwind JIT needs full classes) */
      tabActive: 'data-[state=active]:border-brand-300 dark:data-[state=active]:border-brand-700 data-[state=active]:bg-brand-50 dark:data-[state=active]:bg-brand-950/50 data-[state=active]:text-brand-700 dark:data-[state=active]:text-brand-300',
    },

    /**
     * Raw hex / rgb values for contexts that need actual colour values
     * (inline styles, canvas, SVG, framer-motion, etc.)
     *
     * NOTE: These are the *default* (Ocean) values. Components that need
     * runtime hex values should read from useThemeColor().palette.brandHex
     * instead when the colour palette is user-selectable.
     */
    brandHex: {
      /** teal-500 — primary solid colour */
      solid:     '#14b8a6',
      /** teal-600 — primary text colour */
      primary:   '#0d9488',
      /** teal-50 — lightest accent surface */
      light:     '#f0fdfa',
      /** teal-500 as CSS rgb() for inline styles */
      solidRgb:  'rgb(20 184 166)',
    },

    /* ── Semantic status colours (stats, rows) ────────────────────── */
    statsActive: {
      total:     { border: 'border-l-brand-500',   bg: 'bg-brand-50 dark:bg-brand-950/30' },
      available: { border: 'border-l-green-500',   bg: 'bg-green-50 dark:bg-green-950/30', text: 'text-green-600' },
      sold:      { border: 'border-l-blue-500',    bg: 'bg-blue-50 dark:bg-blue-950/30',   text: 'text-blue-600' },
      damaged:   { border: 'border-l-red-500',     bg: 'bg-red-50 dark:bg-red-950/30',     text: 'text-red-600' },
      unused:    { border: 'border-l-green-500',   bg: 'bg-green-50 dark:bg-green-950/30', text: 'text-green-600' },
      assigned:  { border: 'border-l-blue-500',    bg: 'bg-blue-50 dark:bg-blue-950/30',   text: 'text-blue-600' },
      lost:      { border: 'border-l-red-500',     bg: 'bg-red-50 dark:bg-red-950/30',     text: 'text-red-500' },
      purple:    { border: 'border-l-purple-500',  bg: 'bg-purple-50 dark:bg-purple-950/30', text: 'text-purple-600' },
      yellow:    { border: 'border-l-yellow-500',  bg: 'bg-yellow-50 dark:bg-yellow-950/30', text: 'text-yellow-600' },
      orange:    { border: 'border-l-orange-500',  bg: 'bg-orange-50 dark:bg-orange-950/30', text: 'text-orange-600' },
      gray:      { border: 'border-l-gray-500',    bg: 'bg-gray-50 dark:bg-gray-950/30',   text: 'text-gray-600' },
    },

    /** Table row status tinting */
    rowTint: {
      available: 'bg-gradient-to-r from-green-50/60 via-green-50/30 to-transparent border-l-[3px] border-l-green-500',
      sold:      'bg-gradient-to-r from-blue-50/60 via-blue-50/30 to-transparent border-l-[3px] border-l-blue-500',
      damaged:   'bg-gradient-to-r from-red-50/60 via-red-50/30 to-transparent border-l-[3px] border-l-red-500',
      festival:  'bg-gradient-to-r from-green-50/60 via-green-50/30 to-transparent border-l-[3px] border-l-green-500',
      clearance: 'bg-gradient-to-r from-red-50/60 via-red-50/30 to-transparent border-l-[3px] border-l-red-500',
      promotion: 'bg-gradient-to-r from-blue-50/60 via-blue-50/30 to-transparent border-l-[3px] border-l-blue-500',
      /* QR Code statuses */
      unused:    'bg-gradient-to-r from-gray-50/60 via-gray-50/30 to-transparent border-l-[3px] border-l-gray-400',
      assigned:  'bg-gradient-to-r from-amber-50/60 via-amber-50/30 to-transparent border-l-[3px] border-l-amber-500',
      lost:      'bg-gradient-to-r from-red-50/60 via-red-50/30 to-transparent border-l-[3px] border-l-red-500',
      /* Attendance statuses */
      inProgress: 'bg-gradient-to-r from-yellow-50/60 via-yellow-50/30 to-transparent border-l-[3px] border-l-yellow-500',
      completed:  'bg-gradient-to-r from-green-50/60 via-green-50/30 to-transparent border-l-[3px] border-l-green-500',
      manual:     'bg-gradient-to-r from-purple-50/60 via-purple-50/30 to-transparent border-l-[3px] border-l-purple-500',
    },

    /** Category breakdown progress bar colors (cycle through these) */
    categoryBarColors: [
      'bg-brand-500',
      'bg-brand-400',
      'bg-blue-500',
      'bg-indigo-500',
      'bg-purple-500',
      'bg-brand-600',
    ],

    /* ── Button animation utilities ───────────────────────────────── */
    btnAnimation: 'hover:scale-105 active:scale-95 transition-all',
    btnAnimationSubtle: 'hover:scale-[1.02] active:scale-[0.98] transition-all',
  },

  /**
   * PWA Settings
   */
  pwa: {
    /** PWA display mode */
    display: 'standalone' as const,
    /** PWA orientation */
    orientation: 'portrait' as const,
  },

  /**
   * Bill/Receipt Branding
   * These appear on printed receipts and invoices
   */
  billing: {
    /** Header text on receipts (usually uppercase) */
    receiptHeader: 'WOMANIYA',
    /** Logo image path for light backgrounds (relative to public folder) */
    logoPath: '/brand_logo_lightbg.png',
    /** Logo image path for dark backgrounds (relative to public folder) */
    logoDarkPath: '/brand_logo_darkbg.png',
    /** Alt text for logo image */
    logoAlt: 'Womaniya Logo',
    /** Tagline shown on receipts and billing materials */
    tagline: 'Fashion Forward. Always.',
  },

  /**
   * Internal identifiers
   * Used for IndexedDB, localStorage, and API headers
   */
  internal: {
    /** IndexedDB database name */
    idbName: 'womaniya-dashboard',
    /** Application header for API requests */
    apiAppName: 'womaniya-dashboard',
    /** localStorage key for remembering the last used login email */
    lastEmailKey: 'womaniya_last_email',
    /** localStorage key for the cached user profile */
    profileCacheKey: 'womaniya_cached_profile',
    /** localStorage key for the selected color palette */
    colorPaletteKey: 'womaniya-color-palette',
    /** localStorage key for the last inventory cache timestamp */
    inventoryCacheTimestampKey: 'womaniya-inventory-cache-timestamp',
    /** localStorage key for the POS cart */
    cartStorageKey: 'womaniya-pos-cart',
    /** Prefix for backup file downloads */
    backupFilePrefix: 'womaniya-backup',
  },
} as const;

/**
 * Type for the app configuration
 */
export type AppConfig = typeof appConfig;

/**
 * Helper to get brand name
 */
export const getBrandName = () => appConfig.brand.name;

/**
 * Helper to get logo gradient classes
 */
export const getLogoGradientClasses = () => 
  `${appConfig.theme.logoGradient.from} ${appConfig.theme.logoGradient.to}`;
