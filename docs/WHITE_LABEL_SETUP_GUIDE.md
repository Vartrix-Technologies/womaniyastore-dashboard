# White-Label Client Setup Guide

> Complete step-by-step guide to deploy this POS & Inventory Management System for a new client with their own branding, backend, and domain.

---

## Table of Contents

1. [Pre-Requisites](#1-pre-requisites)
2. [Repository Setup](#2-repository-setup)
3. [Supabase Backend Setup](#3-supabase-backend-setup)
4. [Frontend Branding](#4-frontend-branding)
5. [Environment Configuration](#5-environment-configuration)
6. [Deployment (Vercel)](#6-deployment-vercel)
7. [Post-Deployment Verification](#7-post-deployment-verification)
8. [Ongoing Maintenance](#8-ongoing-maintenance)
9. [Quick Reference Checklist](#9-quick-reference-checklist)

---

## 1. Pre-Requisites

### Accounts Needed

| Service      | Purpose                           | Free Tier? |
| ------------ | --------------------------------- | ---------- |
| **Supabase** | Database, Auth, Edge Functions    | Yes (2 free projects) |
| **Vercel**   | Frontend hosting, CI/CD           | Yes (hobby plan) |
| **GitHub**   | Source code repository            | Yes |
| **Domain**   | Custom domain (e.g., `dashboard.clientstore.in`) | Paid (~₹500/yr) |

### Tools Installed Locally

- **Node.js** ≥ 18
- **npm** or **pnpm**
- **Git**
- **Supabase CLI** (`npm install -g supabase`)

### Assets Needed from Client

- [ ] Brand name (e.g., "ClientStore")
- [ ] Tagline (e.g., "Style Redefined.")
- [ ] Logo files — provide **4 variants**:
  - `logo_darkbg.png` (512×512, for dark backgrounds)
  - `logo_lightbg.png` (512×512, for light backgrounds)
  - `logo_darkbg.svg` (scalable, dark bg)
  - `logo_lightbg.svg` (scalable, light bg)
- [ ] PWA icons (8 sizes: 72, 96, 128, 144, 152, 192, 384, 512px — SVG preferred)
- [ ] Brand color palette (primary color, gradient start/end)
- [ ] Shop details: name, address, phone, GST number
- [ ] Super admin email and temporary password
- [ ] Domain name for the dashboard

---

## 2. Repository Setup

### Option A: Private Fork (Recommended)

```bash
# Clone the base repo
git clone https://github.com/your-org/womaniya-production.git clientstore-dashboard
cd clientstore-dashboard

# Change remote to a new private repo
git remote set-url origin https://github.com/your-org/clientstore-dashboard.git
git push -u origin main
```

### Option B: Template Copy

```bash
# Create new repo from template on GitHub, then clone
git clone https://github.com/your-org/clientstore-dashboard.git
cd clientstore-dashboard
npm install
```

### Update package.json

```json
{
  "name": "clientstore-dashboard",
  "version": "0.1.0",
  "private": true
}
```

---

## 3. Supabase Backend Setup

### 3.1 Create Supabase Project

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard)
2. Click **New Project**
3. Set:
   - **Name**: `clientstore-dashboard`
   - **Database password**: Generate a strong password (save it!)
   - **Region**: Choose closest to client (e.g., `ap-south-1` for India)
4. Wait for project to be provisioned (~2 min)
5. Copy from **Settings → API**:
   - `Project URL` → This is your `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → This is your `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role secret` key → Save securely (for edge functions only)

### 3.2 Run Database Migrations

#### Option A: Using Supabase CLI (Recommended)

```bash
# Link to the new project
supabase login
supabase link --project-ref <your-project-ref>

# Push all migrations
supabase db push
```

#### Option B: Manual SQL Execution

Run each migration file **in order** via Supabase Dashboard → SQL Editor:

1. `supabase/migrations/00000000000000_initial_schema.sql` — Core schema (tables, enums, RLS, functions)
2. `supabase/migrations/20241221000000_create_user_profiles_view.sql`
3. `supabase/migrations/20241222000000_bill_number_function.sql`
4. `supabase/migrations/20241222000100_expense_categories.sql`
5. `supabase/migrations/20241222000200_financial_transactions_rls.sql`
6. `supabase/migrations/20241222000300_qr_codes_rls.sql`
7. `supabase/migrations/20241231000000_checklists_rls.sql`
8. `supabase/migrations/20241231000100_checklist_shared_pool.sql`
9. `supabase/migrations/20250101000000_add_vendor_to_lots.sql`
10. `supabase/migrations/20250101000100_attendance_crud_audit.sql`
11. `supabase/migrations/20260101000000_profiles_update_policy.sql`
12. `supabase/migrations/20260101000100_update_bill_number_to_bigint.sql`
13. `supabase/migrations/20260110000000_create_qr_prefixes.sql`
14. `supabase/migrations/20260110000100_alter_qr_codes_add_prefix.sql`
15. `supabase/migrations/20260110000200_qr_prefix_functions.sql`
16. `supabase/migrations/20260122000000_add_sale_to_lots.sql`
17. `supabase/migrations/20260122000100_add_sale_to_sale_items.sql`
18. `supabase/migrations/20260125000000_user_management.sql`
19. `supabase/migrations/20260205000000_inventory_items_rls.sql`
20. Continue with any remaining migrations in `supabase/migrations/` in date order

> **Tip**: List all migrations with `ls supabase/migrations/` and run them sequentially.

### 3.3 Deploy Edge Functions

```bash
# Deploy all edge functions
supabase functions deploy create-user
supabase functions deploy add-stock-lot
supabase functions deploy complete-sale
supabase functions deploy auto-close-attendance
supabase functions deploy create-daily-checklists
```

### 3.4 Set Edge Function Secrets

```bash
# The service role key is auto-available in Supabase Edge Functions
# No additional secrets needed unless you add custom integrations
```

### 3.5 Create Initial Shop

Run in Supabase SQL Editor:

```sql
INSERT INTO shops (shop_name, address, phone, tax_rate, bill_prefix)
VALUES (
  'Client Store Name',
  'Shop Address Line 1, City, State - PIN',
  '+91-XXXXXXXXXX',
  0,              -- Tax rate percentage (0 = no tax, 5 = 5%)
  'BILL'          -- Bill number prefix
);
```

### 3.6 Create Superadmin User

1. Go to Supabase Dashboard → **Authentication → Users**
2. Click **Add User** → **Create New User**
   - Email: `admin@clientstore.in`
   - Password: Set a temporary password
   - Auto Confirm: ✅ Yes
3. Run in SQL Editor:

```sql
INSERT INTO profiles (id, full_name, role, is_active, must_change_password)
SELECT
  id,
  'System Administrator',
  'superadmin',
  true,
  true
FROM auth.users
WHERE email = 'admin@clientstore.in'
ON CONFLICT (id) DO UPDATE
SET role = 'superadmin', full_name = 'System Administrator';
```

### 3.7 Create Owner/Admin Users

The superadmin can create additional users via the app's user management UI, or run:

```sql
-- First create the user in Authentication → Users via Supabase Dashboard
-- Then link the profile:
INSERT INTO profiles (id, full_name, phone, role, shop_id, is_active, max_discount_percent, must_change_password)
SELECT
  u.id,
  'Owner Name',
  '+91-XXXXXXXXXX',
  'owner',
  (SELECT id FROM shops WHERE shop_name = 'Client Store Name' LIMIT 1),
  true,
  100,    -- Max discount percent (100 = unlimited)
  true    -- Force password change on first login
FROM auth.users u
WHERE u.email = 'owner@clientstore.in';
```

### 3.8 Set Up Scheduled Functions (Optional)

In Supabase Dashboard → **Database → Extensions**, enable `pg_cron` if not already enabled.

Then set up cron jobs for:
- **Auto-close attendance** — Runs at end of business day
- **Create daily checklists** — Runs at start of business day

```sql
-- Example: Auto-close attendance at 10 PM IST daily
SELECT cron.schedule(
  'auto-close-attendance',
  '30 16 * * *',  -- 4:30 PM UTC = 10:00 PM IST
  $$
  SELECT net.http_post(
    url := 'https://<project-ref>.supabase.co/functions/v1/auto-close-attendance',
    headers := '{"Authorization": "Bearer <service-role-key>"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);

-- Example: Create daily checklists at 8 AM IST daily
SELECT cron.schedule(
  'create-daily-checklists',
  '30 2 * * *',   -- 2:30 AM UTC = 8:00 AM IST
  $$
  SELECT net.http_post(
    url := 'https://<project-ref>.supabase.co/functions/v1/create-daily-checklists',
    headers := '{"Authorization": "Bearer <service-role-key>"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
```

---

## 4. Frontend Branding

### 4.1 Central Config — `src/lib/config/app.config.ts`

This is the **primary branding file**. Update all values:

```typescript
export const appConfig = {
  brand: {
    name: 'ClientStore',                              // ← Brand name
    fullName: 'ClientStore Dashboard',                 // ← Full app title
    shortName: 'ClientStore',                          // ← PWA short name
    description: 'Point of Sale and Inventory Management System',
    logoLetter: 'C',                                   // ← First letter (avatar fallback)
  },
  theme: {
    logoGradient: { from: 'from-brand-from', to: 'to-brand-to' },
    themeColor: '#f0fdfa',      // ← PWA status bar color (match brand palette)
    backgroundColor: '#f0fdfa', // ← PWA splash screen bg
  },
  billing: {
    receiptHeader: 'CLIENTSTORE',                      // ← Receipt header (UPPERCASE)
    logoPath: '/clientstore_logo_darkbg.png',          // ← Receipt logo path
    logoAlt: 'ClientStore Logo',                       // ← Logo alt text
  },
  internal: {
    idbName: 'clientstore-dashboard',                  // ← IndexedDB name
    apiAppName: 'clientstore-dashboard',               // ← API header identifier
  },
  // styles section: Leave as-is (driven by CSS variables/theme system)
} as const;
```

### 4.2 Replace Logo Files

Replace files in `public/`:

| Old File | New File | Purpose |
|----------|----------|---------|
| `womaniya_logo_darkbg.png` | `clientstore_logo_darkbg.png` | Login page, receipts, metadata |
| `womaniya_logo_lightbg.png` | `clientstore_logo_lightbg.png` | PWA icon, manifest |
| `womaniya_logo_darkbg.svg` | `clientstore_logo_darkbg.svg` | Scalable logo |
| `womaniya_logo_lightbg.svg` | `clientstore_logo_lightbg.svg` | Scalable logo |
| `womaniya-logo.png` | `clientstore-logo.png` | Bill preview (A4 layout) |

Also replace all icons in `public/icons/`:
- `icon-72x72.svg`, `icon-96x96.svg`, `icon-128x128.svg`, `icon-144x144.svg`
- `icon-152x152.svg`, `icon-192x192.svg`, `icon-384x384.svg`, `icon-512x512.svg`

### 4.3 Update Layout Metadata — `src/app/layout.tsx`

```typescript
// Update the title (line ~20)
title: "ClientStore Dashboard",  // Remove location suffix like "- Airoli"

// Update icon references to new logo filenames
icons: {
  icon: '/clientstore_logo_darkbg.png',
  apple: '/clientstore_logo_darkbg.png',
},
```

### 4.4 Update Login Page — `src/app/login/page.tsx`

Search and replace:
- Logo image `src` → `/clientstore_logo_darkbg.png`
- Card title → `ClientStore Dashboard`
- localStorage key `womaniya_last_email` → `clientstore_last_email`

### 4.5 Update Bill Preview — `src/components/shared/BillPreviewDialog.tsx`

This file has **hardcoded branding** that must be updated:

1. **Logo image**: Change `src="/womaniya-logo.png"` → `src="/clientstore-logo.png"`
2. **Header text**: Change `WOMANIYA` → `CLIENTSTORE` (or use `appConfig.billing.receiptHeader`)
3. **Tagline**: Change `"Fashion Forward. Always."` → Client's tagline (in all 3 places)
4. **Footer**: Update `"Visit again. Fashion Forward. Always."` → New tagline

### 4.6 Update PWA Manifest — `public/manifest.json`

```json
{
  "name": "ClientStore Dashboard",
  "short_name": "ClientStore",
  "description": "Point of Sale and Inventory Management System",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#f0fdfa",
  "theme_color": "#f0fdfa",
  "orientation": "portrait",
  "icons": [
    {
      "src": "/clientstore_logo_darkbg.png",
      "sizes": "512x512",
      "type": "image/png"
    },
    {
      "src": "/clientstore_logo_lightbg.png",
      "sizes": "512x512",
      "type": "image/png"
    },
    {
      "src": "/clientstore_logo_darkbg.svg",
      "sizes": "any",
      "type": "image/svg+xml"
    },
    {
      "src": "/clientstore_logo_lightbg.svg",
      "sizes": "any",
      "type": "image/svg+xml"
    }
  ]
}
```

### 4.7 Update Service Worker — `public/sw.js`

```javascript
// Line ~4: Update cache name
const CACHE_NAME = 'clientstore-v1';  // Was 'womaniya-v1'

// Line ~14: Update pre-cache icon paths (if icon filenames changed)
const urlsToCache = [
  '/',
  '/offline.html',
  '/manifest.json',
  '/icons/icon-192x192.svg',
  '/icons/icon-512x512.svg'
];
```

### 4.8 Update Offline Page — `public/offline.html`

```html
<title>ClientStore - Offline</title>

<!-- Update the logo letter -->
<div class="icon">C</div>  <!-- First letter of brand name -->

<!-- Optional: Update gradient colors if brand palette differs -->
<!-- Default: background: linear-gradient(135deg, #14b8a6, #06b6d4) -->
```

### 4.9 Update Default Theme Colors (Optional)

If the client's brand uses a different primary color than teal:

**`src/app/globals.css`** — Update the default CSS variables (lines ~61-73):

```css
:root {
  --color-brand-50: #f0f9ff;    /* Lightest shade */
  --color-brand-100: #e0f2fe;
  --color-brand-200: #bae6fd;
  --color-brand-300: #7dd3fc;
  --color-brand-400: #38bdf8;
  --color-brand-500: #0ea5e9;   /* Primary solid */
  --color-brand-600: #0284c7;   /* Primary text */
  --color-brand-700: #0369a1;
  --color-brand-800: #075985;
  --color-brand-900: #0c4a6e;
  --color-brand-950: #082f49;   /* Darkest shade */
  --color-brand-from: #0ea5e9;  /* Gradient start */
  --color-brand-to: #06b6d4;    /* Gradient end */
}
```

**`src/context/ThemeColorContext.tsx`** — Update the `PALETTES` array to change the default palette, or add a custom one matching the client's brand.

**`src/lib/config/app.config.ts`** — Update `styles.brandHex` to match:
```typescript
brandHex: {
  solid: '#0ea5e9',     // Primary solid color
  primary: '#0284c7',   // Primary text color
  light: '#f0f9ff',     // Lightest shade
  solidRgb: 'rgb(14 165 233)',
},
```

---

## 5. Environment Configuration

### 5.1 Create `.env.local`

```env
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-public-key>
```

### 5.2 Verify `.gitignore`

Ensure these are in `.gitignore`:

```
.env.local
.env*.local
.history/
```

---

## 6. Deployment (Vercel)

### 6.1 Connect Repository

1. Go to [vercel.com/dashboard](https://vercel.com/dashboard)
2. Click **Add New → Project**
3. Import the GitHub repository
4. Framework Preset: **Next.js** (auto-detected)
5. Root Directory: Leave as `/` (or set if monorepo)

### 6.2 Set Environment Variables

In Vercel Project → **Settings → Environment Variables**, add:

| Variable | Value | Environment |
|----------|-------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<project-ref>.supabase.co` | Production, Preview, Development |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `<anon-public-key>` | Production, Preview, Development |

### 6.3 Configure Custom Domain

1. Vercel → Project → **Settings → Domains**
2. Add domain: `dashboard.clientstore.in`
3. Follow DNS instructions:
   - **CNAME**: `dashboard` → `cname.vercel-dns.com`
   - Or **A record**: `76.76.21.21`
4. Vercel auto-provisions SSL certificate

### 6.4 Configure Supabase Redirect URLs

In Supabase Dashboard → **Authentication → URL Configuration**:
- **Site URL**: `https://dashboard.clientstore.in`
- **Redirect URLs**: Add `https://dashboard.clientstore.in/**`

### 6.5 Deploy

```bash
# Push to main branch triggers auto-deploy
git add .
git commit -m "Setup ClientStore branding"
git push origin main
```

Or trigger manually from Vercel Dashboard → **Deployments → Redeploy**.

---

## 7. Post-Deployment Verification

### 7.1 Authentication Flow

- [ ] Open `https://dashboard.clientstore.in`
- [ ] Login with superadmin credentials
- [ ] Verify redirect to admin dashboard
- [ ] Force password change works on first login
- [ ] Logout and re-login works

### 7.2 Branding Checks

- [ ] Login page shows correct logo and brand name
- [ ] Page title shows correct brand name in browser tab
- [ ] PWA install prompt shows correct app name and icon
- [ ] Admin dashboard header shows correct branding
- [ ] Bill/receipt preview shows correct company name & tagline
- [ ] Offline page shows correct brand letter and colors
- [ ] About tab shows correct app info

### 7.3 Core Features

- [ ] Create a shop (if not done via SQL)
- [ ] Create owner/admin/staff users via superadmin
- [ ] Add categories and sizes
- [ ] Create a stock lot with QR codes
- [ ] Print QR codes
- [ ] Complete a sale (POS flow)
- [ ] Generate and view bill/receipt
- [ ] View sales reports
- [ ] Check attendance logging
- [ ] Verify checklist functionality

### 7.4 PWA / Offline

- [ ] Install as PWA on mobile device
- [ ] App icon and splash screen correct
- [ ] Go offline → offline page appears
- [ ] Create a sale while offline → queues in IndexedDB
- [ ] Go online → pending sale syncs automatically

### 7.5 Edge Functions

- [ ] Create user via app → `create-user` function works
- [ ] Add stock lot → `add-stock-lot` function works
- [ ] Complete sale → `complete-sale` function works

---

## 8. Ongoing Maintenance

### 8.1 Pulling Updates from Base Repo

If you maintain a base/template repo and want to pull updates to client repos:

```bash
# Add base repo as upstream (one-time)
git remote add upstream https://github.com/your-org/pos-base.git

# Fetch and merge updates
git fetch upstream
git merge upstream/main --no-ff

# Resolve any conflicts in branding files (expected)
# Test thoroughly, then push
git push origin main
```

### 8.2 Database Migrations

When the base app adds new migrations:

```bash
# Copy new migration files to client repo
# Then push to Supabase
supabase db push
```

### 8.3 Edge Function Updates

```bash
supabase functions deploy <function-name>
```

---

## 9. Quick Reference Checklist

### Files to Update Per Client

| # | File | What to Change |
|---|------|----------------|
| 1 | `src/lib/config/app.config.ts` | Brand name, logo letter, receipt header, logo path, IDB name, API name |
| 2 | `src/app/layout.tsx` | Page title, icon paths |
| 3 | `src/app/login/page.tsx` | Logo path, card title, localStorage key |
| 4 | `src/components/shared/BillPreviewDialog.tsx` | Logo, header, tagline (3 places) |
| 5 | `public/manifest.json` | App name, short name, icon paths |
| 6 | `public/sw.js` | Cache name |
| 7 | `public/offline.html` | Title, logo letter, gradient colors |
| 8 | `src/app/globals.css` | Default brand color CSS variables (if changing palette) |
| 9 | `src/context/ThemeColorContext.tsx` | Default palette / custom palette (if changing colors) |
| 10 | `src/lib/config/app.config.ts` → `styles.brandHex` | Raw hex values (if changing colors) |
| 11 | `package.json` | Package name |
| 12 | `public/` logo files | All 5 logo images + 8 PWA icons |
| 13 | `.env.local` | Supabase URL and anon key |

### Global Text Search

After making changes, verify no stale references remain:

```bash
# Search for old brand name (case-insensitive)
grep -ri "womaniya" src/ public/ --include="*.ts" --include="*.tsx" --include="*.json" --include="*.html" --include="*.js" --include="*.css"
```

### Backend Setup Order

1. Create Supabase project
2. Run all migrations (in order)
3. Deploy edge functions
4. Create shop record
5. Create superadmin user (Auth + profile)
6. Set up cron jobs (optional)
7. Configure Site URL and redirect URLs

### Time Estimate Per Client

| Task | Approx Time |
|------|-------------|
| Supabase project + migrations | 15 min |
| Edge function deploy | 5 min |
| Initial data (shop, superadmin) | 10 min |
| Frontend branding updates | 30 min |
| Vercel deploy + domain setup | 15 min |
| Testing & verification | 30 min |
| **Total** | **~1.5–2 hours** |

---

## Appendix A: Timezone Configuration

The app defaults to **IST (Asia/Kolkata)**. If deploying for a client in a different timezone:

- Update `src/lib/utils/timezone.ts` — Change the timezone constant
- Update cron job schedules in Supabase to match client's timezone

## Appendix B: Security Reminders

- **Never commit `.env.local`** to version control
- **Delete `.history/` folder** if it exists (may contain old credentials)
- **Rotate Supabase keys** if they were ever exposed
- **Service role key** should only exist in Supabase Edge Function environment — never in frontend code
- Enable **Supabase MFA** for superadmin accounts in production

## Appendix C: Useful Supabase CLI Commands

```bash
# Login to Supabase
supabase login

# Link to project
supabase link --project-ref <ref>

# Push all migrations
supabase db push

# Deploy a specific edge function
supabase functions deploy <function-name>

# View edge function logs
supabase functions logs <function-name>

# Generate types from database (for TypeScript)
supabase gen types typescript --linked > src/types/database.types.ts

# Reset database (DESTRUCTIVE — dev only)
supabase db reset
```
