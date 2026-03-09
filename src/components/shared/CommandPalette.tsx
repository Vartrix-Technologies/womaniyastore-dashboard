'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
  CommandShortcut,
} from '@/components/ui/command';
import {
  Home,
  ShoppingCart,
  Package,
  QrCode,
  BarChart3,
  Users,
  Settings,
  Sun,
  Moon,
  Palette,
  ClipboardList,
  DollarSign,
  RotateCcw,
  CalendarCheck,
  LayoutDashboard,
  Search,
  TrendingUp,
  HelpCircle,
  BookOpen,
} from 'lucide-react';
import type { Profile } from '@/types';
import { ThemePickerDialog } from '@/components/shared/ThemePickerDialog';
import { appConfig } from '@/lib/config/app.config';

const s = appConfig.styles;
const a = s.accent;

/* ── Navigation map ───────────────────────────────────────────────────── */

interface NavItem {
  label: string;
  keywords: string;        // extra words for fuzzy search
  icon: React.ReactNode;
  href: string;
  roles: string[];         // which profile.roles can see this
  shortcut?: string;
}

const NAV_ITEMS: NavItem[] = [
  // Admin routes
  { label: 'Dashboard',          keywords: 'home overview stats',        icon: <Home className="h-4 w-4" />,            href: '/admin',                roles: ['owner', 'admin', 'superadmin'] },
  { label: 'Point of Sale',     keywords: 'pos billing checkout sell',  icon: <ShoppingCart className="h-4 w-4" />,     href: '/pos',                  roles: ['owner', 'admin', 'staff', 'superadmin'] },
  { label: 'Inventory',         keywords: 'products items stock',       icon: <Package className="h-4 w-4" />,          href: '/admin/inventory',      roles: ['owner', 'admin', 'superadmin'] },
  { label: 'Sales',             keywords: 'transactions orders history', icon: <DollarSign className="h-4 w-4" />,      href: '/admin/sales',          roles: ['owner', 'admin', 'superadmin'] },
  { label: 'Returns',           keywords: 'refunds exchange',           icon: <RotateCcw className="h-4 w-4" />,        href: '/admin/returns',        roles: ['owner', 'admin', 'superadmin'] },
  { label: 'QR Codes',          keywords: 'barcode labels scanning',    icon: <QrCode className="h-4 w-4" />,           href: '/admin/qr-codes',       roles: ['owner', 'admin', 'superadmin'] },
  { label: 'Reports',           keywords: 'analytics insights charts',  icon: <BarChart3 className="h-4 w-4" />,        href: '/admin/reports',        roles: ['owner', 'admin', 'superadmin'] },
  { label: 'Finances',          keywords: 'money revenue profit',       icon: <TrendingUp className="h-4 w-4" />,       href: '/admin/finances',       roles: ['owner', 'admin', 'superadmin'] },
  { label: 'Staff',             keywords: 'employees team users',       icon: <Users className="h-4 w-4" />,            href: '/admin/staff',          roles: ['owner', 'admin', 'superadmin'] },
  { label: 'Staff Performance', keywords: 'metrics reviews',            icon: <BarChart3 className="h-4 w-4" />,        href: '/admin/staff-performance', roles: ['owner', 'admin', 'superadmin'] },
  { label: 'Attendance',        keywords: 'checkin time tracking',      icon: <CalendarCheck className="h-4 w-4" />,    href: '/admin/attendance',     roles: ['owner', 'admin', 'superadmin'] },
  { label: 'Checklists',        keywords: 'tasks todo opening closing', icon: <ClipboardList className="h-4 w-4" />,    href: '/admin/checklists',     roles: ['owner', 'admin', 'superadmin'] },
  { label: 'Settings',          keywords: 'preferences config',         icon: <Settings className="h-4 w-4" />,         href: '/settings',             roles: ['owner', 'admin', 'staff', 'superadmin'] },

  // Staff routes
  { label: 'My Dashboard',      keywords: 'staff home me',              icon: <LayoutDashboard className="h-4 w-4" />,  href: '/me',                   roles: ['staff'] },

  // Superadmin routes
  { label: 'Superadmin Panel',  keywords: 'super admin manage shops',   icon: <LayoutDashboard className="h-4 w-4" />,  href: '/superadmin',           roles: ['superadmin'] },

  // Help & resources (all roles)
  { label: 'FAQs',              keywords: 'help questions answers faq support',  icon: <HelpCircle className="h-4 w-4" />,  href: '/faqs',                 roles: ['owner', 'admin', 'staff', 'superadmin'] },
  { label: 'User Guide',        keywords: 'guide onboarding tutorial how to help manual', icon: <BookOpen className="h-4 w-4" />,  href: '/guide',               roles: ['owner', 'admin', 'staff', 'superadmin'] },
];

/* ── Component ────────────────────────────────────────────────────────── */

interface CommandPaletteProps {
  profile: Profile;
}

export function CommandPalette({ profile }: CommandPaletteProps) {
  const [open, setOpen] = useState(false);
  const [themePickerOpen, setThemePickerOpen] = useState(false);
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();

  // Ctrl+K / ⌘K keyboard shortcut
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  // Listen for custom event from TopBar search button
  useEffect(() => {
    const handleOpen = () => setOpen(true);
    window.addEventListener('open-command-palette', handleOpen);
    return () => window.removeEventListener('open-command-palette', handleOpen);
  }, []);

  const navigate = useCallback((href: string) => {
    setOpen(false);
    router.push(href);
  }, [router]);

  const toggleTheme = useCallback(() => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
    setOpen(false);
  }, [resolvedTheme, setTheme]);

  const openThemePicker = useCallback(() => {
    setOpen(false);
    // Small delay so the command palette closes first
    setTimeout(() => setThemePickerOpen(true), 150);
  }, []);

  const filteredNav = NAV_ITEMS.filter((item) => item.roles.includes(profile.role));

  return (
    <>
      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        contentClassName="border-2 border-brand-200 dark:border-brand-800"
        commandClassName="[&_[cmdk-group-heading]]:text-brand-600 dark:[&_[cmdk-group-heading]]:text-brand-400"
      >
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        {/* Navigation */}
        <CommandGroup heading="Navigate">
          {filteredNav.map((item) => (
            <CommandItem
              key={item.href}
              onSelect={() => navigate(item.href)}
              keywords={[item.keywords]}
              className="cursor-pointer data-[selected=true]:bg-brand-50 dark:data-[selected=true]:bg-brand-950/30 data-[selected=true]:text-brand-700 dark:data-[selected=true]:text-brand-300"
            >
              <span className="text-brand-600 dark:text-brand-400">{item.icon}</span>
              <span>{item.label}</span>
              {item.shortcut && <CommandShortcut>{item.shortcut}</CommandShortcut>}
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator className="bg-brand-100 dark:bg-brand-900" />

        {/* Appearance */}
        <CommandGroup heading="Appearance">
          <CommandItem onSelect={toggleTheme} className="cursor-pointer data-[selected=true]:bg-brand-50 dark:data-[selected=true]:bg-brand-950/30 data-[selected=true]:text-brand-700 dark:data-[selected=true]:text-brand-300">
            <span className="text-brand-600 dark:text-brand-400">{resolvedTheme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}</span>
            <span>{resolvedTheme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}</span>
          </CommandItem>
          <CommandItem onSelect={openThemePicker} className="cursor-pointer data-[selected=true]:bg-brand-50 dark:data-[selected=true]:bg-brand-950/30 data-[selected=true]:text-brand-700 dark:data-[selected=true]:text-brand-300">
            <span className="text-brand-600 dark:text-brand-400"><Palette className="h-4 w-4" /></span>
            <span>Change Theme Color</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>

    {/* Theme Picker Dialog (triggered from command palette) */}
    <ThemePickerDialog open={themePickerOpen} onOpenChange={setThemePickerOpen} />
    </>
  );
}
