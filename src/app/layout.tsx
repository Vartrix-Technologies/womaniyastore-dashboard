import type { Metadata, Viewport } from "next";
import { DM_Sans } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { Toaster } from "@/components/ui/sonner";
import { ServiceWorkerRegistration } from "@/components/shared/ServiceWorkerRegistration";
import { ThemeProvider } from "next-themes";
import { ThemeColorProvider } from "@/context/ThemeColorContext";

const dmSans = DM_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-dm-sans",
});

export const metadata: Metadata = {
  title: "Womaniya Dashboard - Airoli",
  description: "Point of Sale and Inventory Management System for Womaniya Airoli",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Womaniya Dashboard",
  },
  icons: {
    icon: [
      { url: "/womaniya_logo_darkbg.png", sizes: "512x512", type: "image/png" },
      { url: "/womaniya_logo_lightbg.png", sizes: "512x512", type: "image/png" },
      { url: "/womaniya_logo_darkbg.svg", sizes: "512x512", type: "image/svg+xml" },
      { url: "/womaniya_logo_lightbg.svg", sizes: "512x512", type: "image/svg+xml" },
    ],
    apple: [
      { url: "/womaniya_logo_darkbg.png", sizes: "512x512", type: "image/png" },
      { url: "/womaniya_logo_lightbg.png", sizes: "512x512", type: "image/png" },
    ],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f0fdfa" },
    { media: "(prefers-color-scheme: dark)", color: "#042f2e" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning data-scroll-behavior="smooth">
      <body className={`${dmSans.variable} font-sans antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
          <ThemeColorProvider>
            <AuthProvider>
              <ServiceWorkerRegistration />
              {children}
              <Toaster 
                position="top-right" 
                richColors={false}
                closeButton
                gap={8}
                offset={{ top: "calc(env(safe-area-inset-top, 0px) + 16px)", right: "16px", bottom: "16px", left: "16px" }}
                mobileOffset={{ top: "calc(env(safe-area-inset-top, 0px) + 16px)", right: "16px", bottom: "16px", left: "16px" }}
                visibleToasts={4}
                expand={true}
                duration={4000}
              />
            </AuthProvider>
          </ThemeColorProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
