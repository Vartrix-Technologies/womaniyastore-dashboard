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
    logoLetter: 'W',
  },

  /**
   * Theme Colors
   * These are used for brand elements like logo backgrounds
   */
  theme: {
    /** Primary gradient colors for logo background */
    logoGradient: {
      from: 'from-teal-500',
      to: 'to-cyan-600',
    },
    /** PWA theme color */
    themeColor: '#000000',
    /** PWA background color */
    backgroundColor: '#ffffff',
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
    /** Logo image path (relative to public folder) */
    logoPath: '/womaniya-logo.png',
    /** Alt text for logo image */
    logoAlt: 'Womaniya Logo',
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
