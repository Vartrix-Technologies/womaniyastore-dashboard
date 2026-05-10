'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from '@/components/ui/accordion';
import { appConfig } from '@/lib/config/app.config';
import {
    BookOpen,
    Settings,
    ShoppingCart,
    Users,
    BarChart3,
    Palette,
    LogIn,
    Download,
    Store,
    Tags,
    QrCode,
    Printer,
    Package,
    Camera,
    CreditCard,
    Search,
    RotateCcw,
    Wallet,
    WifiOff,
    UserPlus,
    CalendarCheck,
    ClipboardCheck,
    TrendingUp,
    Shield,
    LayoutDashboard,
    FileDown,
    Sun,
    Moon,
    ArrowLeft,
    Lightbulb,
    AlertTriangle,
    CheckCircle2,
    ExternalLink,
    Globe,
    Code2,
    Heart,
} from 'lucide-react';
import { useRouter } from 'next/navigation';

const s = appConfig.styles;
const a = s.accent;

// ─── Guide Data ──────────────────────────────────────────────────────────

interface GuideStep {
    text: string;
}

interface GuideCard {
    id: string;
    title: string;
    icon: React.ElementType;
    steps: GuideStep[];
    tips: string[];
    troubleshooting: string[];
}

interface GuidePhase {
    id: string;
    label: string;
    description: string;
    dotColor: string;
    stepBg: string;
    iconBg: string;
    iconColor: string;
    bgColor: string;
    textColor: string;
    borderColor: string;
    cards: GuideCard[];
}

const GUIDE_PHASES: GuidePhase[] = [
    {
        id: 'setup',
        label: 'Setup',
        description: 'One-time setup to get started',
        dotColor: 'bg-emerald-500 dark:bg-emerald-400',
        stepBg: 'bg-emerald-600 dark:bg-emerald-500',
        iconBg: 'bg-emerald-100 dark:bg-emerald-900/40',
        iconColor: 'text-emerald-600 dark:text-emerald-400',
        bgColor: 'bg-emerald-50 dark:bg-emerald-950/30',
        textColor: 'text-emerald-700 dark:text-emerald-400',
        borderColor: 'border-emerald-200 dark:border-emerald-800',
        cards: [
            {
                id: 'login',
                title: 'Login & Set Your Password',
                icon: LogIn,
                steps: [
                    { text: 'Open the app in Chrome on your tablet or phone' },
                    { text: 'Enter the email and temporary password provided to you' },
                    { text: 'Tap "Sign In"' },
                    { text: 'You\'ll be asked to set a new password' },
                    { text: 'Enter your temporary password, then choose a strong new password (8+ characters, uppercase, lowercase, number, special character)' },
                    { text: 'Tap "Set Password" — you\'re in!' },
                ],
                tips: [
                    'The strength meter shows 5 bars — aim for all green',
                    'Bookmark the app URL for quick access',
                ],
                troubleshooting: [
                    '"Invalid credentials" → Double-check the email and temporary password (case-sensitive)',
                    'Screen stuck loading → Wait 6 seconds, it will auto-recover. Try refreshing',
                    'Forgot your password → Contact your admin to reset it',
                ],
            },
            {
                id: 'install',
                title: 'Install the App on Your Device',
                icon: Download,
                steps: [
                    { text: 'Open the app in Chrome (Android) or Safari (iPhone/iPad)' },
                    { text: 'Look for the "Install App" banner at the bottom of the screen' },
                    { text: 'Tap "Install"' },
                    { text: 'The app icon appears on your home screen' },
                    { text: 'Open from home screen — it runs full-screen like a native app' },
                ],
                tips: [
                    'On iPhone/iPad: Open in Safari → Share button → "Add to Home Screen"',
                    'The app works offline for POS after installation',
                    'No manual updates needed — you always get the latest version',
                ],
                troubleshooting: [
                    'No install banner? → Tap the three-dot menu in Chrome → "Install app"',
                    'App looks odd? → Close and reopen from the home screen icon',
                ],
            },
            {
                id: 'shop-details',
                title: 'Set Up Your Shop Details',
                icon: Store,
                steps: [
                    { text: 'Go to Settings (gear icon in the top bar)' },
                    { text: 'Open the "Shop Details" tab' },
                    { text: 'Enter your shop name, address, and phone number' },
                    { text: 'Open the "Tax Settings" tab' },
                    { text: 'Enter your GST number and tax percentage' },
                    { text: 'Tap "Save" on each tab' },
                ],
                tips: [
                    'Your shop name appears on every bill — spell it exactly as you want',
                    'Tax settings apply automatically to all new sales',
                ],
                troubleshooting: [
                    'Changes not saving? → Check your internet connection',
                    'Wrong tax on bills? → Update Tax Settings; future bills use the new rate',
                ],
            },
            {
                id: 'categories',
                title: 'Add Categories & Sizes',
                icon: Tags,
                steps: [
                    { text: 'Go to Settings → "Categories" tab' },
                    { text: 'Tap "Add Category" and enter a name (e.g., "Silk Saree," "Cotton Kurti")' },
                    { text: 'Repeat for all your product categories' },
                    { text: 'Switch to the "Sizes" tab' },
                    { text: 'Add sizes you sell (e.g., "S," "M," "L," "XL," "Free Size")' },
                ],
                tips: [
                    'Keep category names short and consistent — they appear in filters and reports',
                    'Categories and sizes cannot be deleted if items are using them',
                ],
                troubleshooting: [
                    'Duplicate category? → The app warns you if a name already exists',
                    'Misspelled? → Edit it; all linked items update automatically',
                ],
            },
            {
                id: 'qr-prefixes',
                title: 'Set Up QR Prefixes',
                icon: QrCode,
                steps: [
                    { text: 'Go to Settings → "QR Prefixes" tab' },
                    { text: 'Tap "Add Prefix"' },
                    { text: 'Enter a short code (e.g., "BRD" for your brand, "KID" for kids)' },
                    { text: 'Add a description' },
                    { text: 'Tap "Save" — repeat for different product lines' },
                ],
                tips: [
                    'Keep prefixes short (2–4 letters) — they become part of QR IDs like WMN-001',
                    'You need at least one prefix before generating QR codes',
                ],
                troubleshooting: [
                    '"Prefix already exists" → Choose a different code',
                ],
            },
            {
                id: 'generate-qr',
                title: 'Generate Your First QR Codes',
                icon: Printer,
                steps: [
                    { text: 'Go to QR Codes from the Admin Dashboard' },
                    { text: 'Open the "Generate New QR Codes" section' },
                    { text: 'Select a prefix from the dropdown' },
                    { text: 'Enter the quantity (start with 50–100)' },
                    { text: 'Tap "Generate"' },
                    { text: 'Select codes → "Download" for printable QR stickers' },
                ],
                tips: [
                    'Generate more codes than your current stock for future shipments',
                    'Each QR code is unique and can only be used once',
                    'Print on sticker sheets using any label printer',
                ],
                troubleshooting: [
                    'Can\'t generate? → Make sure you have at least one QR prefix in Settings',
                ],
            },
        ],
    },
    {
        id: 'daily',
        label: 'Daily Operations',
        description: 'Everyday tasks and workflows',
        dotColor: 'bg-blue-500 dark:bg-blue-400',
        stepBg: 'bg-blue-600 dark:bg-blue-500',
        iconBg: 'bg-blue-100 dark:bg-blue-900/40',
        iconColor: 'text-blue-600 dark:text-blue-400',
        bgColor: 'bg-blue-50 dark:bg-blue-950/30',
        textColor: 'text-blue-700 dark:text-blue-400',
        borderColor: 'border-blue-200 dark:border-blue-800',
        cards: [
            {
                id: 'add-stock',
                title: 'Add New Stock (Add a Lot)',
                icon: Package,
                steps: [
                    { text: 'Go to Inventory → tap "Add Stock Lot"' },
                    { text: 'Select the Category and Size' },
                    { text: 'Choose a QR Prefix' },
                    { text: 'Enter the Vendor Name (type to search or add new)' },
                    { text: 'Enter Cost Price and Selling Price' },
                    { text: 'Enter Quantity' },
                    { text: 'Tap "Preview & Add" → review → "Confirm & Add"' },
                ],
                tips: [
                    'The app auto-calculates your profit margin',
                    'Each item gets a unique QR code from your chosen prefix',
                    'Vendor names auto-complete from previous entries',
                ],
                troubleshooting: [
                    '"Not enough QR codes" → Generate more codes first',
                    'Form won\'t submit? → Check for red error messages',
                ],
            },
            {
                id: 'make-sale',
                title: 'Make a Sale (POS)',
                icon: Camera,
                steps: [
                    { text: 'Tap "POS" in the bottom navigation bar' },
                    { text: 'Tap the camera button to scan a QR code on the item' },
                    { text: 'Point your camera at the QR sticker — item appears in cart' },
                    { text: 'Repeat for each item the customer is buying' },
                    { text: 'Tap on an item to adjust quantity or apply discount' },
                    { text: 'Tap "Complete Sale" when ready' },
                ],
                tips: [
                    'Can\'t scan? Tap "Search" to find items manually',
                    'The cart persists if you close the page — items stay',
                    'Tap trash icon to remove items, or "Clear Cart" to start over',
                ],
                troubleshooting: [
                    'Camera not working? → Allow camera permission in browser',
                    '"Item not found" → QR code may not be assigned to stock yet',
                    'App offline? → Sales still work! They sync when internet returns',
                ],
            },
            {
                id: 'complete-sale',
                title: 'Complete a Sale & Send Bill',
                icon: CreditCard,
                steps: [
                    { text: 'After scanning items, tap "Complete Sale"' },
                    { text: 'Choose payment method: Cash, UPI, or Card' },
                    { text: 'Optionally enter customer name and phone' },
                    { text: 'Tap "Complete Sale"' },
                    { text: 'Review the Bill Preview' },
                    { text: 'Tap "Share on WhatsApp" or "Print"' },
                ],
                tips: [
                    'Customer info is optional for quick sales',
                    'Every bill gets a unique bill number',
                    'Find any past bill from the Sales Hub page',
                ],
                troubleshooting: [
                    'WhatsApp not opening? → Make sure WhatsApp is installed',
                    'Bill looks wrong? → Check tax settings in Settings',
                ],
            },
            {
                id: 'search-inventory',
                title: 'Search for Items',
                icon: Search,
                steps: [
                    { text: 'Go to Inventory from the Admin Dashboard' },
                    { text: 'Use the search bar to type QR code, category, or size' },
                    { text: 'Use dropdown filters to narrow results' },
                    { text: 'Click stat cards at top to filter by status (Available, Sold, Damaged)' },
                    { text: 'Click any row for full item details' },
                ],
                tips: [
                    'Combine search bar with filters for precise results',
                    'Click "Category Breakdown" for stock distribution overview',
                    'Click "Lots History" to see all stock lots added',
                ],
                troubleshooting: [
                    'No results? → Clear all filters first, then try again',
                ],
            },
            {
                id: 'return',
                title: 'Process a Return',
                icon: RotateCcw,
                steps: [
                    { text: 'Go to Returns from the Admin Dashboard' },
                    { text: 'Tap "Process Return"' },
                    { text: 'Enter the original bill number and search' },
                    { text: 'Check the boxes next to items being returned' },
                    { text: 'Enter the refund amount and reason' },
                    { text: 'Tap "Submit Return" — items go back to inventory' },
                ],
                tips: [
                    'You can return some items from a bill, not all',
                    'Already returned items are grayed out',
                    'Send a return receipt via WhatsApp',
                ],
                troubleshooting: [
                    'Can\'t find the bill? → Check the bill number or search in Sales Hub',
                ],
            },
            {
                id: 'expense',
                title: 'Record an Expense',
                icon: Wallet,
                steps: [
                    { text: 'Go to Finances from the Admin Dashboard' },
                    { text: 'Tap "Add Expense"' },
                    { text: 'Enter the amount' },
                    { text: 'Select a category (Rent, Salary, Supplies, etc.)' },
                    { text: 'Add a brief description' },
                    { text: 'Set the date and tap "Save"' },
                ],
                tips: [
                    'Record expenses daily — don\'t let them pile up',
                    'Create specific categories for better reports',
                    'You can edit or delete any expense later',
                ],
                troubleshooting: [
                    'Category doesn\'t exist? → Type a new name to create one',
                ],
            },
            {
                id: 'offline',
                title: 'Working Offline',
                icon: WifiOff,
                steps: [
                    { text: 'You don\'t need to do anything — it\'s automatic' },
                    { text: 'When internet drops, a yellow banner appears: "You\'re offline"' },
                    { text: 'POS still works — sales are saved on your device' },
                    { text: 'When internet returns, banner turns green: "Syncing..."' },
                    { text: 'Sales sync automatically — a notification confirms each one' },
                ],
                tips: [
                    'Only POS works offline — other features need internet',
                    'QR scanning works offline too (pre-cached inventory)',
                    'Each device syncs independently — no duplicates',
                ],
                troubleshooting: [
                    'Sales stuck as "pending"? → Check internet, pull down to refresh',
                    '"Failed sync" → Check Sync Issues in your account menu',
                ],
            },
        ],
    },
    {
        id: 'staff',
        label: 'Staff & Management',
        description: 'Team management and oversight',
        dotColor: 'bg-purple-500 dark:bg-purple-400',
        stepBg: 'bg-purple-600 dark:bg-purple-500',
        iconBg: 'bg-purple-100 dark:bg-purple-900/40',
        iconColor: 'text-purple-600 dark:text-purple-400',
        bgColor: 'bg-purple-50 dark:bg-purple-950/30',
        textColor: 'text-purple-700 dark:text-purple-400',
        borderColor: 'border-purple-200 dark:border-purple-800',
        cards: [
            {
                id: 'add-staff',
                title: 'Add a New Staff Member',
                icon: UserPlus,
                steps: [
                    { text: 'Go to Staff Management from Admin Dashboard' },
                    { text: 'Tap "Add Staff" (Superadmin only)' },
                    { text: 'Enter full name, email, phone' },
                    { text: 'Select role: "Staff" (POS only) or "Admin" (full access)' },
                    { text: 'Set maximum discount percentage' },
                    { text: 'Tap "Create" — share temporary password verbally' },
                ],
                tips: [
                    'Staff must change temporary password on first login',
                    'Maximum discount prevents unauthorized discounts',
                ],
                troubleshooting: [
                    '"Add Staff" disabled? → Only Superadmin can create users',
                    'Staff can\'t log in? → Verify email and temporary password',
                ],
            },
            {
                id: 'attendance',
                title: 'Mark Attendance',
                icon: CalendarCheck,
                steps: [
                    { text: 'Staff: Open app → My Dashboard → Attendance Card' },
                    { text: 'Tap "Clock In" when starting work' },
                    { text: 'Tap "Clock Out" when leaving' },
                    { text: 'Admin: Go to Attendance → Calendar tab for monthly view' },
                    { text: 'Admin: Use "Attendance Logs" tab for detailed records' },
                    { text: 'Admin: Tap "Add Record" or "Bulk Entry" for manual corrections' },
                ],
                tips: [
                    'Calendar is color-coded: green = completed, yellow = in progress',
                    'Hours are auto-calculated from clock-in to clock-out',
                    'Export attendance to CSV for payroll',
                ],
                troubleshooting: [
                    'Forgot to clock out? → Admin can edit the record',
                ],
            },
            {
                id: 'checklists',
                title: 'Create & Manage Checklists',
                icon: ClipboardCheck,
                steps: [
                    { text: 'Go to Checklists from Admin Dashboard' },
                    { text: 'Tap "New Checklist"' },
                    { text: 'Enter a name and description' },
                    { text: 'Set recurrence — which days of the week' },
                    { text: 'Add checklist items — drag to reorder' },
                    { text: 'Tap "Save"' },
                    { text: 'Tap "Create Today" to generate today\'s instances' },
                ],
                tips: [
                    'Create multiple checklists (opening, closing, weekly)',
                    'View completion history to track task fulfillment',
                ],
                troubleshooting: [
                    'Staff doesn\'t see checklists? → Tap "Create Today"',
                    'Checklist not on a day? → Check recurrence schedule',
                ],
            },
            {
                id: 'performance',
                title: 'View Staff Performance',
                icon: TrendingUp,
                steps: [
                    { text: 'Go to Staff Performance from Admin Dashboard' },
                    { text: 'Select a date range (Today, This Week, This Month, Custom)' },
                    { text: 'View each staff member\'s sales count, revenue, items sold, and average discount' },
                    { text: 'Compare performance across your team' },
                ],
                tips: [
                    'High discount % may indicate coaching is needed',
                    'Compare revenue vs. items sold for premium vs. volume insights',
                ],
                troubleshooting: [
                    'No data? → Ensure date range includes days with sales',
                ],
            },
            {
                id: 'edit-staff',
                title: 'Edit Staff & Control Access',
                icon: Shield,
                steps: [
                    { text: 'Go to Staff Management from Admin Dashboard' },
                    { text: 'Find the staff member in the table' },
                    { text: 'To deactivate: Toggle the Status switch → confirm' },
                    { text: 'To edit: Click three-dot menu → "Edit"' },
                    { text: 'Update name, phone, role, or max discount' },
                    { text: 'Tap "Save Changes"' },
                ],
                tips: [
                    'Deactivated staff are logged out immediately',
                    'Records are kept — reactivate anytime',
                    'Use stat cards at top to filter the table',
                ],
                troubleshooting: [
                    'Can\'t edit? → Only Admins+ can edit staff',
                    'Staff still logged in? → They\'ll be signed out on next page load',
                ],
            },
        ],
    },
    {
        id: 'insights',
        label: 'Insights & Reports',
        description: 'Analytics, exports, and dashboards',
        dotColor: 'bg-amber-500 dark:bg-amber-400',
        stepBg: 'bg-amber-600 dark:bg-amber-500',
        iconBg: 'bg-amber-100 dark:bg-amber-900/40',
        iconColor: 'text-amber-600 dark:text-amber-400',
        bgColor: 'bg-amber-50 dark:bg-amber-950/30',
        textColor: 'text-amber-700 dark:text-amber-400',
        borderColor: 'border-amber-200 dark:border-amber-800',
        cards: [
            {
                id: 'dashboard',
                title: 'Read Your Admin Dashboard',
                icon: LayoutDashboard,
                steps: [
                    { text: 'The Admin Dashboard is your home screen (Admin/Owner)' },
                    { text: '4 stat cards show today\'s snapshot: Available Items, Sales, Turnover, Items Sold' },
                    { text: 'Weekly Insight banner compares this week to last week' },
                    { text: '9 module tiles organized in 3 groups: Business, Staff, Operations' },
                    { text: 'Tap any tile to navigate to that module' },
                ],
                tips: [
                    'Stat cards are clickable — they filter respective views',
                    'Check this page every morning for at-a-glance overview',
                ],
                troubleshooting: [
                    'Numbers look stale? → Pull down to refresh',
                    'Wrong landing page? → You may be logged in as Staff instead of Admin',
                ],
            },
            {
                id: 'analyze-sales',
                title: 'Analyze Your Sales',
                icon: BarChart3,
                steps: [
                    { text: 'Go to Sales Hub from Admin Dashboard' },
                    { text: 'Transactions tab: See all bills, search by bill number or customer' },
                    { text: 'Analytics tab: Category-wise and sale-type breakdowns with charts' },
                    { text: 'Vendors tab: See which vendors\' products sell best' },
                    { text: 'Use date range filter for any period' },
                ],
                tips: [
                    'Click any bill row to see the full bill preview',
                    'Colored rows: 🟢 Festival, 🔴 Clearance, 🔵 Promotion',
                    'Export transactions to CSV for accounting',
                ],
                troubleshooting: [
                    'No sales? → Check date filter — it defaults to "Today"',
                ],
            },
            {
                id: 'finances',
                title: 'Check Your Finances',
                icon: Wallet,
                steps: [
                    { text: 'Go to Finances from Admin Dashboard' },
                    { text: '6 stat cards: Revenue, Expenses, Net Profit, Avg Sale, Inventory Value, Cash Flow' },
                    { text: 'Expense Breakdown chart shows spending by category' },
                    { text: 'Scroll to expenses table for individual records' },
                    { text: 'Use date filter to compare periods' },
                ],
                tips: [
                    'Net Profit = Revenue − Expenses',
                    'Inventory Value = total stock worth at cost price',
                    'Bar chart helps spot which categories eat profits',
                ],
                troubleshooting: [
                    'Profit looks wrong? → Make sure all expenses are recorded',
                    'Revenue not matching Sales Hub? → Align date ranges',
                ],
            },
            {
                id: 'export',
                title: 'Export Your Data',
                icon: FileDown,
                steps: [
                    { text: 'Go to any data page (Inventory, Sales, Finances, Attendance, etc.)' },
                    { text: 'Look for the "Export CSV" button (download icon)' },
                    { text: 'Tap — a .csv file downloads automatically' },
                    { text: 'Open in Excel, Google Sheets, or any spreadsheet app' },
                ],
                tips: [
                    'Apply filters BEFORE exporting — CSV only contains displayed data',
                    'CSV works with Excel, Google Sheets, LibreOffice, Numbers',
                    'Use exports for tax filing, accountant reports, or insurance',
                ],
                troubleshooting: [
                    '"No data to export" → Apply a wider date range or clear filters',
                    'CSV garbled in Excel? → Open Excel → Data → From CSV',
                ],
            },
        ],
    },
    {
        id: 'personalization',
        label: 'Personalization',
        description: 'Make the app yours',
        dotColor: 'bg-slate-500 dark:bg-slate-400',
        stepBg: 'bg-slate-600 dark:bg-slate-500',
        iconBg: 'bg-slate-100 dark:bg-slate-800/40',
        iconColor: 'text-slate-600 dark:text-slate-400',
        bgColor: 'bg-slate-50 dark:bg-slate-950/30',
        textColor: 'text-slate-700 dark:text-slate-400',
        borderColor: 'border-slate-200 dark:border-slate-700',
        cards: [
            {
                id: 'theme-color',
                title: 'Change Your Color Theme',
                icon: Palette,
                steps: [
                    { text: 'Tap your avatar (top-right corner)' },
                    { text: 'Select "Theme Color"' },
                    { text: 'Choose from 6 options: Ocean, Indigo, Emerald, Rose, Amber, Slate' },
                    { text: 'Tap any color — preview is instant' },
                    { text: 'Close dialog — choice is saved automatically' },
                ],
                tips: [
                    'Theme changes are personal — each user picks their own',
                    'Applies everywhere: buttons, headers, stats, navigation',
                    'Status bar color on your device also changes to match',
                ],
                troubleshooting: [
                    'Theme not applying? → Close and reopen the app',
                    'Want to reset? → Pick "Ocean" (the default)',
                ],
            },
            {
                id: 'dark-mode',
                title: 'Switch Dark / Light Mode',
                icon: Sun,
                steps: [
                    { text: 'Find the sun/moon icon in the top bar (right side)' },
                    { text: 'Tap to toggle between Light Mode ☀️ and Dark Mode 🌙' },
                    { text: 'Change is instant — no restart needed' },
                    { text: 'Preference is saved automatically' },
                ],
                tips: [
                    'Dark mode saves battery on OLED/AMOLED screens',
                    'Bills always preview in light mode for readability',
                ],
                troubleshooting: [
                    'Some colors look off? → App is optimized for light mode as primary',
                ],
            },
            {
                id: 'command-palette',
                title: 'Quick Navigation (Command Palette)',
                icon: Search,
                steps: [
                    { text: 'Press Ctrl+K or tap the search icon (🔍) in the top bar' },
                    { text: 'A search overlay appears' },
                    { text: 'Type what you want: "inventory," "sales," "dark mode"' },
                    { text: 'Results appear as you type — tap any to go there instantly' },
                    { text: 'Press Escape to close' },
                ],
                tips: [
                    'The fastest way to navigate — faster than tapping menus',
                    'Search for pages AND actions (e.g., "dark" for dark mode toggle)',
                    'Results are filtered by your role',
                ],
                troubleshooting: [
                    'Search not finding a page? → Try different keywords',
                    'On tablet without keyboard? → Use the search icon in the top bar',
                ],
            },
        ],
    },
];

// Quick reference data
const QUICK_REFERENCE = [
    { action: 'Make a sale', where: 'POS (bottom nav)' },
    { action: 'Add new stock', where: 'Inventory → Add Stock Lot' },
    { action: 'Check today\'s revenue', where: 'Admin Dashboard' },
    { action: 'Record an expense', where: 'Finances → Add Expense' },
    { action: 'Add a staff member', where: 'Staff Management → Add Staff' },
    { action: 'Process a return', where: 'Returns → Process Return' },
    { action: 'Generate QR codes', where: 'QR Codes → Generate' },
    { action: 'View sales analytics', where: 'Sales Hub → Analytics tab' },
    { action: 'Change app theme', where: 'Account menu → Theme' },
    { action: 'Export data', where: 'Any page → Export CSV button' },
    { action: 'Clock in/out', where: 'My Dashboard → Attendance Card' },
    { action: 'View FAQs', where: 'Account menu → FAQs' },
];

// ─── Component ──────────────────────────────────────────────────────────

export default function GuidePage() {
    const [activePhase, setActivePhase] = useState('setup');
    const router = useRouter();

    const currentPhase = GUIDE_PHASES.find((p) => p.id === activePhase) || GUIDE_PHASES[0];

    return (
        <div className="space-y-4 md:space-y-6">
            {/* Header */}
            <div className="flex items-center gap-3">
                <button onClick={() => router.back()} className="relative group shrink-0">
                    <div className={`p-2.5 rounded-lg ${s.headerIconGradient} text-white shadow-md group-hover:shadow-lg transition-shadow`}>
                        <BookOpen className="h-6 w-6" />
                    </div>
                    <div className="absolute -left-1.5 -top-1.5 bg-background border rounded-full p-1 shadow-sm group-hover:scale-110 transition-transform">
                        <ArrowLeft className="h-3 w-3 text-muted-foreground" />
                    </div>
                </button>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">User Guide</h1>
                    <p className="text-sm text-muted-foreground mt-0.5">
                        Step-by-step guide to using {appConfig.brand.fullName}
                    </p>
                </div>
            </div>

            {/* Hero Card */}
            <Card className="overflow-hidden">
                <div className={`bg-gradient-to-br ${s.primaryGradientStops} p-6 text-white`}>
                    <div className="flex items-center gap-4">
                        <div>
                            <h2 className="text-xl font-bold">Your Complete Guide</h2>
                            <p className="text-white/80 text-sm mt-1">
                                Everything you need to know, organized in 5 phases — from initial setup to daily mastery.
                            </p>
                            <div className="flex gap-2 mt-2 flex-wrap">
                                <Badge variant="secondary" className="bg-white/20 text-white border-0 text-xs">
                                    {GUIDE_PHASES.reduce((s, p) => s + p.cards.length, 0)} guides
                                </Badge>
                                <Badge variant="secondary" className="bg-white/20 text-white border-0 text-xs">
                                    5 phases
                                </Badge>
                            </div>
                        </div>
                    </div>
                </div>
            </Card>

            {/* Phase Tabs */}
            <Tabs value={activePhase} onValueChange={setActivePhase}>
                <div className="overflow-x-auto -mx-4 px-4 pb-1">
                    <TabsList className="inline-flex w-auto min-w-full md:min-w-0 h-auto flex-wrap gap-1 bg-muted/50 p-1">
                        {GUIDE_PHASES.map((phase) => (
                            <TabsTrigger
                                key={phase.id}
                                value={phase.id}
                                className="text-xs px-3 py-1.5 rounded-md gap-1.5"
                            >
                                <span
                                    className={`w-2 h-2 rounded-full shrink-0 ${(GUIDE_PHASES.find(p => p.id === phase.id) || phase).dotColor}`}
                                />
                                {phase.label}
                                <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0 h-4">
                                    {phase.cards.length}
                                </Badge>
                            </TabsTrigger>
                        ))}
                        <TabsTrigger
                            value="quick-ref"
                            className="text-xs px-3 py-1.5 rounded-md gap-1.5"
                        >
                            <Search className="h-3 w-3" />
                            Quick Ref
                        </TabsTrigger>
                    </TabsList>
                </div>

                {/* Phase Content */}
                {GUIDE_PHASES.map((phase) => (
                    <TabsContent key={phase.id} value={phase.id} className="mt-4 space-y-4">
                        {/* Phase Header */}
                        <div
                            className={`flex items-center gap-3 p-3 rounded-lg border ${phase.borderColor} ${phase.bgColor}`}
                        >
                            <span
                                className={`w-3 h-3 rounded-full shrink-0 shadow-sm ${phase.dotColor}`}
                            />
                            <div>
                                <h3 className={`font-semibold text-sm ${phase.textColor}`}>{phase.label}</h3>
                                <p className="text-xs text-muted-foreground">{phase.description}</p>
                            </div>
                            <Badge variant="outline" className="ml-auto text-[10px]">
                                {phase.cards.length} guide{phase.cards.length !== 1 ? 's' : ''}
                            </Badge>
                        </div>

                        {/* Cards */}
                        <Accordion type="multiple" className="space-y-3">
                            {phase.cards.map((card, idx) => {
                                const Icon = card.icon;
                                return (
                                    <AccordionItem
                                        key={card.id}
                                        value={card.id}
                                        className="border rounded-lg overflow-hidden"
                                    >
                                        <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/30">
                                            <div className="flex items-center gap-3 text-left">
                                                <div
                                                    className={`p-2 rounded-lg shrink-0 ${phase.iconBg}`}
                                                >
                                                    <Icon className={`h-4 w-4 ${phase.iconColor}`} />
                                                </div>
                                                <div>
                                                    <p className="font-medium text-sm">{card.title}</p>
                                                    <p className="text-xs text-muted-foreground mt-0.5">
                                                        {card.steps.length} steps
                                                    </p>
                                                </div>
                                                <Badge
                                                    variant="outline"
                                                    className="ml-auto mr-2 text-[10px] shrink-0"
                                                >
                                                    {idx + 1}/{phase.cards.length}
                                                </Badge>
                                            </div>
                                        </AccordionTrigger>
                                        <AccordionContent className="px-4 pb-4 pt-0">
                                            {/* Steps */}
                                            <div className="space-y-2 mb-4">
                                                {card.steps.map((step, stepIdx) => (
                                                    <div key={stepIdx} className="flex items-start gap-3">
                                                        <div
                                                            className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-[11px] font-bold shrink-0 mt-0.5 ${phase.stepBg}`}
                                                        >
                                                            {stepIdx + 1}
                                                        </div>
                                                        <p className="text-sm text-muted-foreground leading-relaxed pt-0.5">
                                                            {step.text}
                                                        </p>
                                                    </div>
                                                ))}
                                            </div>

                                            <Separator className="my-3" />

                                            {/* Tips */}
                                            <div className="space-y-3">
                                                <div className="flex items-center gap-2">
                                                    <Lightbulb className="h-4 w-4 text-amber-500" />
                                                    <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                                                        Pro Tips
                                                    </p>
                                                </div>
                                                <ul className="space-y-1.5 ml-6">
                                                    {card.tips.map((tip, tipIdx) => (
                                                        <li
                                                            key={tipIdx}
                                                            className="text-xs text-muted-foreground leading-relaxed list-disc"
                                                        >
                                                            {tip}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>

                                            {card.troubleshooting.length > 0 && (
                                                <>
                                                    <Separator className="my-3" />
                                                    <div className="space-y-3">
                                                        <div className="flex items-center gap-2">
                                                            <AlertTriangle className="h-4 w-4 text-orange-500" />
                                                            <p className="text-xs font-semibold text-orange-700 dark:text-orange-400">
                                                                If Something Goes Wrong
                                                            </p>
                                                        </div>
                                                        <ul className="space-y-1.5 ml-6">
                                                            {card.troubleshooting.map((item, tIdx) => (
                                                                <li
                                                                    key={tIdx}
                                                                    className="text-xs text-muted-foreground leading-relaxed list-disc"
                                                                >
                                                                    {item}
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                </>
                                            )}
                                        </AccordionContent>
                                    </AccordionItem>
                                );
                            })}
                        </Accordion>
                    </TabsContent>
                ))}

                {/* Quick Reference Tab */}
                <TabsContent value="quick-ref" className="mt-4 space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Quick Reference</CardTitle>
                            <CardDescription>Find any feature instantly</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-1">
                                {QUICK_REFERENCE.map((ref, idx) => (
                                    <div
                                        key={idx}
                                        className={`flex items-center justify-between py-2.5 px-3 rounded-lg ${idx % 2 === 0 ? `${a.bgSubtle} ${a.bgDarkSubtle}` : ''
                                            }`}
                                    >
                                        <span className="text-sm font-medium">{ref.action}</span>
                                        <span className="text-xs text-muted-foreground text-right ml-4">{ref.where}</span>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Capabilities Overview */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">What&apos;s Inside</CardTitle>
                            <CardDescription>At a glance</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-2 gap-3">
                                {[
                                    { label: 'Modules', value: '10+' },
                                    { label: 'Reports', value: '3 specialized' },
                                    { label: 'Devices', value: 'Any browser' },
                                    { label: 'Color themes', value: '6' },
                                    { label: 'Offline', value: 'Full POS' },
                                    { label: 'Setup time', value: '< 1 hour' },
                                    { label: 'Staff roles', value: '4' },
                                    { label: 'Data export', value: 'CSV' },
                                ].map((stat) => (
                                    <div
                                        key={stat.label}
                                        className={`p-3 rounded-lg border ${a.border} ${a.borderDark} ${a.bgSubtle} ${a.bgDarkSubtle}`}
                                    >
                                        <p className="text-xs text-muted-foreground">{stat.label}</p>
                                        <p className="text-sm font-semibold mt-0.5">{stat.value}</p>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* Footer */}
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
                                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-violet-500 to-purple-600 text-white text-sm font-medium hover:opacity-90 transition-opacity shadow-md"
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
