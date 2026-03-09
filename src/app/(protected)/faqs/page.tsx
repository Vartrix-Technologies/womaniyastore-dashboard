'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { appConfig } from '@/lib/config/app.config';
import {
  HelpCircle,
  Search,
  ShoppingCart,
  Package,
  QrCode,
  Users,
  Wallet,
  Smartphone,
  WifiOff,
  RotateCcw,
  ClipboardCheck,
  BarChart3,
  Shield,
  Palette,
  ArrowLeft,
} from 'lucide-react';
import { useRouter } from 'next/navigation';

const s = appConfig.styles;
const a = s.accent;

// ─── FAQ Data ──────────────────────────────────────────────────────────────

interface FaqItem {
  question: string;
  answer: string;
}

interface FaqCategory {
  id: string;
  label: string;
  icon: React.ElementType;
  description: string;
  items: FaqItem[];
}

const FAQ_CATEGORIES: FaqCategory[] = [
  {
    id: 'getting-started',
    label: 'Getting Started',
    icon: Smartphone,
    description: 'Setup, installation, and first steps',
    items: [
      {
        question: 'How do I log in for the first time?',
        answer:
          'Open the app in Chrome on your device and enter the email and temporary password provided to you. After signing in, you\'ll be prompted to set a new password. Choose a strong password with at least 8 characters including uppercase, lowercase, a number, and a special character.',
      },
      {
        question: 'How do I install the app on my device?',
        answer:
          'Open the app in Chrome (Android) or Safari (iPhone/iPad). Look for the "Install App" banner at the bottom, or tap the three-dot menu → "Install app" / "Add to Home Screen." The app icon will appear on your home screen and runs full-screen like a native app.',
      },
      {
        question: 'What devices does the app work on?',
        answer:
          'The app works on any device with a modern web browser — Android tablets (recommended for counter use), Android phones, iPhones, iPads, Windows PCs, and Macs. For the best experience, use Chrome on Android or Safari on iOS.',
      },
      {
        question: 'How do I set up my shop details?',
        answer:
          'Go to Settings (gear icon) → "Shop Details" tab. Enter your shop name, address, and phone number. Then switch to "Tax Settings" to enter your GST number and tax percentage. Tap "Save" on each tab. Your shop name appears on every bill.',
      },
      {
        question: 'What should I set up before I start selling?',
        answer:
          'Before making your first sale, you need to: 1) Set up shop details and tax settings, 2) Add categories (e.g., Silk Saree, Cotton Kurti) and sizes (S, M, L, XL), 3) Create at least one QR prefix, 4) Generate QR codes, and 5) Add your first stock lot.',
      },
    ],
  },
  {
    id: 'pos',
    label: 'Point of Sale',
    icon: ShoppingCart,
    description: 'Billing, sales, and checkout',
    items: [
      {
        question: 'How do I make a sale?',
        answer:
          'Tap "POS" in the bottom navigation. Use the camera button to scan the QR code on each item — it automatically adds to your cart. When ready, tap "Complete Sale," choose the payment method (Cash, UPI, or Card), and optionally enter customer details. The bill is generated instantly.',
      },
      {
        question: 'What if I can\'t scan a QR code?',
        answer:
          'Tap "Search" to find items by name, category, or QR code number. You can also type the QR code ID manually. The search works even when the camera isn\'t available.',
      },
      {
        question: 'How do I apply a discount?',
        answer:
          'Tap on an item in the cart to adjust the discount percentage. Your maximum discount is set by your admin — you cannot exceed it. The discount is applied per item and reflected in the bill total.',
      },
      {
        question: 'How do I send a bill to the customer?',
        answer:
          'After completing a sale, the Bill Preview appears. Tap "Share on WhatsApp" to send it directly to the customer, or tap "Print" for a paper copy. The bill includes your shop name, GST details, itemized list, and total.',
      },
      {
        question: 'Can I undo or cancel a sale?',
        answer:
          'Completed sales cannot be undone directly. Instead, use the Returns feature (available from the Admin Dashboard → Returns) to process a return against the original bill number. This properly records the return and puts items back in inventory.',
      },
      {
        question: 'What payment methods are supported?',
        answer:
          'The app supports Cash, UPI, and Card payments. Select the payment method during checkout — it\'s recorded with the sale for your financial records.',
      },
    ],
  },
  {
    id: 'inventory',
    label: 'Inventory',
    icon: Package,
    description: 'Stock management, lots, and tracking',
    items: [
      {
        question: 'How do I add new stock?',
        answer:
          'Go to Inventory → tap "Add Stock Lot." Select the category, size, and QR prefix. Enter the vendor name, cost price, selling price, and quantity. Optionally set a sale configuration for festival/promotion items. Tap "Preview & Add" to review, then "Confirm & Add."',
      },
      {
        question: 'What is a "lot" and why does it matter?',
        answer:
          'A lot is a batch of similar items added together (e.g., "50 silk sarees from Vendor X at ₹800 each"). Each item in the lot gets a unique QR code. Lots help you track when stock was added, from which vendor, and at what price.',
      },
      {
        question: 'How do I search for specific items?',
        answer:
          'Use the search bar on the Inventory page to type a QR code, category name, or size. Combine with dropdown filters for category and sale type. Click the stat cards at the top to filter by status (Available, Sold, Damaged).',
      },
      {
        question: 'What do the item statuses mean?',
        answer:
          'Available = in stock and ready to sell. Sold = item has been sold. Damaged = marked as damaged (removed from sellable stock). Returned = item was returned by a customer and is back in stock.',
      },
      {
        question: 'Can I edit item details after adding?',
        answer:
          'Yes. Click on any item row in the inventory table to see full details, then use the edit option to update information like price, category, or size.',
      },
      {
        question: 'How is profit margin calculated?',
        answer:
          'Profit margin is automatically calculated as: ((Selling Price - Cost Price) / Selling Price) × 100. It\'s shown as a green percentage when adding stock and in item details.',
      },
    ],
  },
  {
    id: 'qr-codes',
    label: 'QR Codes',
    icon: QrCode,
    description: 'QR generation, prefixes, and printing',
    items: [
      {
        question: 'What are QR prefixes and why do I need them?',
        answer:
          'QR prefixes are short codes (2-4 letters) that identify different product lines. For example, "WMN" for women\'s clothing creates QR IDs like WMN-001, WMN-002. You need at least one prefix before you can generate QR codes.',
      },
      {
        question: 'How do I generate QR codes?',
        answer:
          'Go to QR Codes from the Admin Dashboard → "Generate New QR Codes." Select a prefix, enter the quantity (start with 50-100), and tap "Generate." The codes are created and ready to print.',
      },
      {
        question: 'How do I print QR stickers?',
        answer:
          'After generating QR codes, select the ones you want and tap "Download." You can adjust the size in the download dialog. Print on sticker sheets using any label printer.',
      },
      {
        question: 'Can QR codes be reused?',
        answer:
          'Each QR code is unique and can only be assigned to one item. Once an item is sold, the QR code is marked as "sold." Generate more codes than your current stock — you\'ll need them when new shipments arrive.',
      },
      {
        question: 'What if I run out of QR codes?',
        answer:
          'Simply generate more from Settings → QR Codes → "Generate New QR Codes." There\'s no limit on how many you can generate. Keep a buffer of unassigned codes ready for new stock arrivals.',
      },
    ],
  },
  {
    id: 'staff',
    label: 'Staff Management',
    icon: Users,
    description: 'Staff, roles, attendance, and performance',
    items: [
      {
        question: 'How do I add a new staff member?',
        answer:
          'Go to Staff Management → "Add Staff" (only Superadmin can do this). Enter their name, email, phone, role (Staff or Admin), and maximum discount percentage. A temporary password is generated — share it with the staff member verbally.',
      },
      {
        question: 'What\'s the difference between Staff, Admin, and Superadmin roles?',
        answer:
          'Staff can only use POS and see their own dashboard. Admins can access inventory, sales, finances, and all management features. Owner/Superadmin has full access including user management and system settings.',
      },
      {
        question: 'How does attendance work?',
        answer:
          'Staff tap "Clock In" when they start work and "Clock Out" when they leave from their dashboard. Hours are calculated automatically. Admins can view attendance calendars, logs, and manually add/correct records from the Attendance page.',
      },
      {
        question: 'What if a staff member forgets to clock out?',
        answer:
          'An Admin can edit the attendance record from the Attendance → Logs tab. Find the entry and add the missing clock-out time manually.',
      },
      {
        question: 'How do I deactivate a staff member?',
        answer:
          'Go to Staff Management, find the staff member, and toggle the switch in the "Status" column. Deactivated staff can\'t log in (they\'re logged out automatically) but their records are kept, and you can reactivate them anytime.',
      },
      {
        question: 'How is staff performance measured?',
        answer:
          'Go to Staff Performance from the Admin Dashboard. View metrics per staff member: total sales count, revenue generated, items sold, and average discount given. Use date range filters for any period.',
      },
    ],
  },
  {
    id: 'finances',
    label: 'Finances',
    icon: Wallet,
    description: 'Expenses, revenue, and profit tracking',
    items: [
      {
        question: 'How do I record an expense?',
        answer:
          'Go to Finances → "Add Expense." Enter the amount, select a category (Rent, Salary, Supplies, etc.), add a brief description, set the date, and tap "Save." You can create new categories inline if needed.',
      },
      {
        question: 'How is Net Profit calculated?',
        answer:
          'Net Profit = Total Revenue (from sales) − Total Expenses (all recorded expenses). This is your bottom line. Make sure all expenses are recorded — missing expenses will show inflated profit.',
      },
      {
        question: 'What does "Cash Flow" mean?',
        answer:
          'Cash Flow shows money coming in (revenue from sales) versus money going out (expenses). A negative cash flow means you\'re spending more than you\'re earning in the selected period.',
      },
      {
        question: 'What is "Inventory Value"?',
        answer:
          'Inventory Value is the total worth of all items currently in stock, calculated at their cost price. This tells you how much capital is tied up in unsold inventory.',
      },
      {
        question: 'Can I edit or delete an expense?',
        answer:
          'Yes. Find the expense in the expenses table on the Finances page and use the edit or delete option. Past expenses can be modified at any time.',
      },
    ],
  },
  {
    id: 'returns',
    label: 'Returns',
    icon: RotateCcw,
    description: 'Processing returns and refunds',
    items: [
      {
        question: 'How do I process a return?',
        answer:
          'Go to Returns → "Process Return." Enter the original bill number to search. Select which items are being returned (you can return some, not all). Enter the refund amount and reason, then tap "Submit Return." Items go back to inventory.',
      },
      {
        question: 'Can I return only some items from a bill?',
        answer:
          'Yes. When processing a return, check only the items being returned. Items already returned from that bill are grayed out to prevent double-returns.',
      },
      {
        question: 'Does the refund amount have to match the original price?',
        answer:
          'No. You decide the refund amount — it doesn\'t have to match the original sale price. This gives you flexibility for partial refunds or restocking fees.',
      },
      {
        question: 'Can I send a return receipt to the customer?',
        answer:
          'Yes. After processing a return, you can send a return receipt via WhatsApp from the return details screen, just like a regular bill.',
      },
    ],
  },
  {
    id: 'checklists',
    label: 'Checklists',
    icon: ClipboardCheck,
    description: 'Daily tasks and routines',
    items: [
      {
        question: 'How do I create a daily checklist?',
        answer:
          'Go to Checklists → "New Checklist." Enter a name (e.g., "Morning Opening Routine") and description. Set which days it applies to, add checklist items (drag to reorder by priority), and tap "Save."',
      },
      {
        question: 'How do staff see and complete checklists?',
        answer:
          'Staff see their assigned checklists on their dashboard. They check off items as they complete them. Make sure you tap "Create Today" on the Checklists page to generate today\'s instances for all active checklists.',
      },
      {
        question: 'Why aren\'t my checklists showing up for staff?',
        answer:
          'Most likely you haven\'t tapped "Create Today" to generate today\'s checklist instances. Also check that the checklist is active and that the current day is included in the recurrence schedule.',
      },
    ],
  },
  {
    id: 'reports',
    label: 'Sales & Reports',
    icon: BarChart3,
    description: 'Analytics, exports, and insights',
    items: [
      {
        question: 'Where can I see my sales analytics?',
        answer:
          'Go to Sales Hub → "Analytics" tab to view category-wise and sale-type-wise breakdowns with charts. Use the "Transactions" tab to search individual bills by bill number, customer name, or phone.',
      },
      {
        question: 'What do the colored rows in the sales table mean?',
        answer:
          'Green rows = Festival sale items, Red rows = Clearance sale items, Blue rows = Promotion items. A legend below the table explains each color.',
      },
      {
        question: 'How do I export my data?',
        answer:
          'Look for the "Export CSV" button (download icon) on any data page — Inventory, Sales, Finances, Attendance, QR Codes, or Returns. Apply filters first, as the CSV only contains what\'s currently displayed. Open the downloaded file in Excel, Google Sheets, or any spreadsheet app.',
      },
      {
        question: 'What specialized reports are available?',
        answer:
          'Three specialized reports: Festival Sale Report (festival-priced items revenue and margin analysis), Clearance Report (recovery rate and profit/loss on clearance items), and Promotion Report (discount effectiveness and price comparison).',
      },
    ],
  },
  {
    id: 'offline',
    label: 'Offline & Sync',
    icon: WifiOff,
    description: 'Working without internet',
    items: [
      {
        question: 'Does the app work without internet?',
        answer:
          'Yes! The POS works fully offline — sales are saved on your device and sync automatically when internet returns. A yellow banner appears when offline and turns green when back online. Only POS works offline; other features require internet.',
      },
      {
        question: 'What happens to sales made offline?',
        answer:
          'Sales are saved locally on your device and sync automatically when internet connectivity returns. A notification confirms each synced sale. You can check sync status from the account menu (top-right avatar icon).',
      },
      {
        question: 'What if a sale fails to sync?',
        answer:
          'Check your internet connection and pull down to refresh. If sales are stuck as "pending," go to the account menu to check sync status. Contact your admin if the issue persists — a "Failed sync" notification provides details.',
      },
      {
        question: 'Can multiple devices work offline simultaneously?',
        answer:
          'Yes. Each device syncs independently when internet returns. The system prevents duplicate entries, so you don\'t need to worry about the same sale appearing twice.',
      },
    ],
  },
  {
    id: 'personalization',
    label: 'Personalization',
    icon: Palette,
    description: 'Themes, colors, and navigation',
    items: [
      {
        question: 'How do I change the app color theme?',
        answer:
          'Tap your avatar (top-right corner) → "Theme Color." Choose from 6 options: Ocean (Teal, default), Indigo, Emerald, Rose, Amber, or Slate. Your choice is saved automatically and applies everywhere.',
      },
      {
        question: 'How do I switch between dark and light mode?',
        answer:
          'Tap the sun/moon icon in the top bar (right side). The change is instant, and your preference is saved. Dark mode saves battery on OLED screens and is easier on the eyes at night.',
      },
      {
        question: 'What is the Command Palette?',
        answer:
          'Press Ctrl+K or tap the search icon (🔍) in the top bar. Type what you want — "inventory," "sales," "dark mode" — and results appear as you type. Tap any result to navigate instantly. It\'s the fastest way to get around the app.',
      },
      {
        question: 'Does the theme affect all users?',
        answer:
          'No. Theme changes are personal — each user can pick their own color and dark/light mode. Choices persist across sessions.',
      },
    ],
  },
  {
    id: 'security',
    label: 'Security & Data',
    icon: Shield,
    description: 'Passwords, access, and data safety',
    items: [
      {
        question: 'How do I change my password?',
        answer:
          'Currently, password changes are handled through the Change Password flow when you first log in. If you need to reset a forgotten password, contact your admin.',
      },
      {
        question: 'Is my data safe?',
        answer:
          'Yes. All data is stored securely in the cloud with encryption. If your device breaks or gets stolen, nothing is lost — just log in on another device. Automatic backups run regularly.',
      },
      {
        question: 'Who can see what data?',
        answer:
          'Access is role-based: Staff can only see POS and their own dashboard. Admins can see everything except system settings. Superadmin has full access. No one can see another staff member\'s personal dashboard.',
      },
      {
        question: 'What happens if my device is lost or stolen?',
        answer:
          'Your data is safe in the cloud. Contact your admin to deactivate your account immediately — this prevents anyone from using your login. Then log in on your new device with your credentials.',
      },
    ],
  },
];

// ─── Component ──────────────────────────────────────────────────────────────

export default function FaqsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const router = useRouter();

  // Filter FAQs based on search query
  const getFilteredCategories = () => {
    if (!searchQuery.trim()) return FAQ_CATEGORIES;

    const query = searchQuery.toLowerCase();
    return FAQ_CATEGORIES.map((category) => ({
      ...category,
      items: category.items.filter(
        (item) =>
          item.question.toLowerCase().includes(query) ||
          item.answer.toLowerCase().includes(query)
      ),
    })).filter((category) => category.items.length > 0);
  };

  const filteredCategories = getFilteredCategories();

  // Get categories for the active tab
  const displayCategories =
    activeTab === 'all'
      ? filteredCategories
      : filteredCategories.filter((c) => c.id === activeTab);

  // Count total matching FAQs
  const totalFaqs = displayCategories.reduce((sum, c) => sum + c.items.length, 0);

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="relative group shrink-0">
          <div className={`p-2.5 rounded-lg ${s.headerIconGradient} text-white shadow-md group-hover:shadow-lg transition-shadow`}>
            <HelpCircle className="h-6 w-6" />
          </div>
          <div className="absolute -left-1.5 -top-1.5 bg-background border rounded-full p-1 shadow-sm group-hover:scale-110 transition-transform">
            <ArrowLeft className="h-3 w-3 text-muted-foreground" />
          </div>
        </button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">FAQs</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Frequently asked questions &amp; help
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search FAQs... (e.g. &quot;offline&quot;, &quot;QR code&quot;, &quot;return&quot;)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          {searchQuery && (
            <p className="text-xs text-muted-foreground mt-2">
              {totalFaqs} result{totalFaqs !== 1 ? 's' : ''} found
              {activeTab !== 'all' && ` in ${FAQ_CATEGORIES.find((c) => c.id === activeTab)?.label}`}
            </p>
          )}

      {/* Category Tabs — Scrollable */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="overflow-x-auto -mx-4 px-4 pb-1">
          <TabsList className="inline-flex w-auto min-w-full md:min-w-0 h-auto flex-wrap gap-1 bg-muted/50 p-1">
            <TabsTrigger value="all" className="text-xs px-3 py-1.5 rounded-md">
              All
              <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5 py-0 h-4">
                {FAQ_CATEGORIES.reduce((s, c) => s + c.items.length, 0)}
              </Badge>
            </TabsTrigger>
            {FAQ_CATEGORIES.map((cat) => {
              const Icon = cat.icon;
              return (
                <TabsTrigger
                  key={cat.id}
                  value={cat.id}
                  className="text-xs px-3 py-1.5 rounded-md gap-1.5"
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{cat.label}</span>
                  <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0 h-4">
                    {cat.items.length}
                  </Badge>
                </TabsTrigger>
              );
            })}
          </TabsList>
        </div>

        {/* Tab Content — All categories or filtered */}
        <TabsContent value={activeTab} className="mt-4 space-y-4">
          {displayCategories.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <HelpCircle className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
                <p className="text-sm text-muted-foreground">
                  No FAQs match your search. Try different keywords.
                </p>
              </CardContent>
            </Card>
          ) : (
            displayCategories.map((category) => {
              const Icon = category.icon;
              return (
                <Card key={category.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${a.bg} ${a.bgDark} shrink-0`}>
                        <Icon className={`h-4 w-4 ${a.text}`} />
                      </div>
                      <div>
                        <CardTitle className="text-base">{category.label}</CardTitle>
                        <CardDescription className="text-xs">
                          {category.description}
                        </CardDescription>
                      </div>
                      <Badge
                        variant="outline"
                        className="ml-auto text-[10px] px-1.5 py-0 h-4 shrink-0"
                      >
                        {category.items.length}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <Accordion type="multiple" className="w-full">
                      {category.items.map((item, index) => (
                        <AccordionItem key={index} value={`${category.id}-${index}`}>
                          <AccordionTrigger className="text-sm font-medium text-left py-3 hover:no-underline">
                            {item.question}
                          </AccordionTrigger>
                          <AccordionContent className="text-sm text-muted-foreground leading-relaxed pb-4">
                            {item.answer}
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>
      </Tabs>

      {/* Help Footer */}
      <Card className={`border ${a.border} ${a.borderDark}`}>
        <CardContent className="p-4 flex items-center gap-3">
          <div className={`p-2 rounded-lg ${a.bg} ${a.bgDark} shrink-0`}>
            <HelpCircle className={`h-4 w-4 ${a.text}`} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium">Still need help?</p>
            <p className="text-xs text-muted-foreground">
              Contact your admin or reach out to Vartrix support at{' '}
              <a
                href="https://vartrix.tech"
                target="_blank"
                rel="noopener noreferrer"
                className={`${s.linkColor} hover:underline`}
              >
                vartrix.tech
              </a>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
