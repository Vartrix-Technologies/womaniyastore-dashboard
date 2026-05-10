import type { MetadataRoute } from 'next'
import { appConfig } from '@/lib/config/app.config'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: appConfig.brand.fullName,
    short_name: appConfig.brand.shortName,
    description: appConfig.brand.description,
    start_url: '/',
    scope: '/',
    id: '/',
    display: appConfig.pwa.display,
    background_color: appConfig.theme.backgroundColor,
    theme_color: appConfig.theme.themeColor,
    orientation: appConfig.pwa.orientation,
    icons: [
      {
        src: appConfig.billing.logoPath,
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-192x192.svg',
        sizes: '192x192',
        type: 'image/svg+xml',
        purpose: 'maskable',
      },
      {
        src: '/icons/icon-512x512.svg',
        sizes: '512x512',
        type: 'image/svg+xml',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512x512.svg',
        sizes: '512x512',
        type: 'image/svg+xml',
        purpose: 'maskable',
      },
    ],
    categories: ['business', 'productivity'],
  }
}
