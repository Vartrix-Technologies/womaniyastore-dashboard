'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { appConfig } from '@/lib/config/app.config';
import { 
  ShoppingCart, 
  QrCode, 
  BarChart3, 
  WifiOff, 
  Users, 
  ClipboardCheck, 
  Receipt, 
  Package, 
  Globe, 
  Heart,
  ExternalLink,
  Code2,
} from 'lucide-react';

const s = appConfig.styles;
const a = s.accent;

const APP_VERSION = '1.0.0';

const FEATURES = [
  {
    icon: ShoppingCart,
    title: 'Point of Sale',
    description: 'Fast, intuitive billing with QR code scanning and manual entry',
  },
  {
    icon: QrCode,
    title: 'QR Code Management',
    description: 'Generate, assign, and track QR codes for inventory items',
  },
  {
    icon: Package,
    title: 'Inventory Management',
    description: 'Track stock levels, lots, categories, and sizes in real-time',
  },
  {
    icon: BarChart3,
    title: 'Sales & Reports',
    description: 'Comprehensive sales reports with date filtering and analytics',
  },
  {
    icon: WifiOff,
    title: 'Offline Support',
    description: 'Continue billing even without internet — data syncs when back online',
  },
  {
    icon: Users,
    title: 'Staff Management',
    description: 'Multi-staff support with role-based access control',
  },
  {
    icon: ClipboardCheck,
    title: 'Daily Checklists',
    description: 'Assign and track daily tasks for your staff',
  },
  {
    icon: Receipt,
    title: 'Expense Tracking',
    description: 'Record and categorize business expenses',
  },
];

export function AboutTab() {
  return (
    <div className="space-y-6">
      {/* App Identity Card */}
      <Card className="overflow-hidden">
        <div className={`bg-gradient-to-br ${s.primaryGradientStops} p-6 text-white`}>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-lg">
              <span className="text-3xl font-bold">{appConfig.brand.logoLetter}</span>
            </div>
            <div>
              <h2 className="text-2xl font-bold">{appConfig.brand.fullName}</h2>
              <p className="text-white/80 text-sm">{appConfig.brand.description}</p>
              <Badge variant="secondary" className="mt-2 bg-white/20 text-white border-0 text-xs">
                v{APP_VERSION}
              </Badge>
            </div>
          </div>
        </div>
      </Card>

      {/* Features Grid */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Features</CardTitle>
          <CardDescription>Everything you need to manage your retail business</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {FEATURES.map(({ icon: Icon, title, description }) => (
              <div
                key={title}
                className={`flex items-start gap-3 p-3 rounded-lg border ${a.border} ${a.borderDark} ${a.bgSubtle} ${a.bgDarkSubtle} transition-colors`}
              >
                <div className={`p-2 rounded-lg ${a.bg} ${a.bgDark} shrink-0`}>
                  <Icon className={`h-4 w-4 ${a.text}`} />
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-sm">{title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Built By - Vartrix Tech Branding */}
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div className="p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-md">
                <Code2 className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Built by</p>
                <h3 className="font-bold text-lg">Vartrix Tech</h3>
              </div>
            </div>

            <p className="text-sm text-muted-foreground leading-relaxed">
              Custom software solutions designed for your business. We build modern, 
              high-performance applications that help businesses digitize and streamline 
              their operations.
            </p>

            <div className="flex flex-wrap gap-2">
              <a
                href="https://vartrix.tech"
                target="_blank"
                rel="noopener noreferrer"
                className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-violet-500 to-purple-600 text-white text-sm font-medium hover:opacity-90 transition-opacity shadow-md`}
              >
                <Globe className="h-4 w-4" />
                vartrix.tech
                <ExternalLink className="h-3.5 w-3.5 opacity-70" />
              </a>
            </div>
          </div>

          {/* Footer strip */}
          <div className="border-t px-6 py-3 bg-muted/30">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              Made with <Heart className="h-3 w-3 text-red-500 fill-red-500" /> by Vartrix Tech
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
