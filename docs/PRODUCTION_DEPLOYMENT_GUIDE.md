# Production Deployment Guide: Womaniya Dashboard → dashboard.womaniyastore.in

> Step-by-step ordered checklist to deploy a clean production instance under the Vartrix startup accounts.

---

## Prerequisites

| Item | Details |
|------|---------|
| **Vartrix GitHub account** | Organisation or personal account, ready to host repos |
| **Vartrix Supabase account** | organisation or personal, on a paid plan (Free tier has limits) |
| **Vartrix Vercel account** | Linked to Vartrix GitHub |
| **Domain** | `womaniyastore.in` purchased; DNS access available |
| **Supabase CLI** | `npm i -g supabase` (v1.200+ recommended) |
| **Git** | Installed locally |

---

## Phase 1: Repository Setup (Local → Vartrix GitHub)

### Step 1 — Create Empty Repo on Vartrix GitHub
1. Go to Vartrix GitHub → **New repository**
2. Name: `womaniya-dashboard` (or `womaniya-store-dashboard`)
3. **Do NOT** initialise with README, .gitignore, or license
4. Keep it **private**

### Step 2 — Clone Current Repo & Strip History
```powershell
# Clone your current private repo
git clone <your-personal-github-repo-url> womaniya-production
cd womaniya-production

# Remove the old remote
git remote remove origin

# Create an orphan branch (fresh history, no debug commits)
git checkout --orphan main

# Stage all files
git add .

# Commit with a clean message
git commit -m "Initial production release v1.0"
```

### Step 3 — Clean the Code Before Pushing
```powershell
# Remove files that should NOT ship to production
Remove-Item -Recurse -Force docs/
Remove-Item -Force check_sale_data.sql
Remove-Item -Force .env.local              # NEVER commit secrets

# Remove any other debug/test files
Remove-Item -Force supabase/debug_database.sql
Remove-Item -Force supabase/debug_qr_code.sql
Remove-Item -Force supabase/create_test_profiles.sql
```

Update `.gitignore` to ensure these stay out:
```
# Add to .gitignore if not already present
.env.local
docs/
check_sale_data.sql
```

### Step 4 — Push to Vartrix GitHub
```powershell
# Add Vartrix remote
git remote add origin <vartrix-github-repo-url>

# Push clean main branch
git push -u origin main

# Create dev branch
git checkout -b dev
git push -u origin dev

# Switch back to main
git checkout main
```

You now have: `main` (production) and `dev` (development) branches with clean history.

---

## Phase 2: Supabase Backend Setup

### Step 5 — Create New Supabase Project
1. Log in to **Vartrix Supabase account** → dashboard.supabase.com
2. Click **New Project**
3. Settings:
   - **Name:** `womaniya-store` (or similar)
   - **Database password:** generate a strong password and **save it securely**
   - **Region:** Choose closest to your client (e.g., `ap-south-1` Mumbai for India)
4. Wait for project to finish provisioning (~2 minutes)
5. Note down:
   - **Project Reference ID** (from URL: `https://supabase.com/dashboard/project/<ref-id>`)
   - **API URL** (`https://<ref-id>.supabase.co`)
   - **Anon Key** (Settings → API → `anon` `public` key)
   - **Service Role Key** (Settings → API → `service_role` key — keep secret!)

### Step 6 — Link Supabase CLI to New Project
```powershell
# Login to Supabase CLI (will open browser)
supabase login

# Navigate to your clean production repo
cd womaniya-production

# Link to the NEW Supabase project
supabase link --project-ref <new-project-ref-id>
# Enter the database password when prompted
```

### Step 7 — Push All Migrations
```powershell
# Apply all migration files in order (00000000_initial_schema.sql first, then rest)
supabase db push
```
This will:
- Create all 7 enums
- Create all 20 tables with RLS
- Create all helper functions
- Apply all 25 migration files in alphabetical/chronological order

> **If any migration fails:** Read the error carefully. The initial schema migration (`00000000_initial_schema.sql`) creates the foundation. Subsequent migrations use `IF NOT EXISTS` and `CREATE OR REPLACE` for idempotency.

### Step 8 — Deploy Edge Functions
```powershell
supabase functions deploy add-stock-lot
supabase functions deploy complete-sale
supabase functions deploy create-daily-checklists
supabase functions deploy create-user
```

### Step 9 — Configure Supabase Auth
In the Supabase Dashboard (Settings → Authentication):

1. **Site URL:** `https://dashboard.womaniyastore.in`
2. **Redirect URLs** (add all):
   - `https://dashboard.womaniyastore.in/**`
   - `https://dashboard.womaniyastore.in/login`
   - `http://localhost:3000/**` (for local dev)
3. **Email Auth:**
   - Enable "Email" provider
   - Disable "Confirm email" (since admin creates users via edge function)
   - Set minimum password length as needed
4. **Email Templates** (optional):
   - Customise templates with Womaniya branding
5. **Rate Limits:** Review and adjust if needed

### Step 10 — Create Initial Superadmin User
In the Supabase Dashboard → SQL Editor, run:

```sql
-- First, create the auth user via the Authentication tab in the Dashboard:
--   Go to Authentication → Users → Add User
--   Email: <client-admin-email>
--   Password: <temporary-password>
--   Auto Confirm: ON
--
-- Note the user's UUID from the Users list, then run:

INSERT INTO profiles (id, full_name, role, is_active, must_change_password)
VALUES (
  '<user-uuid-from-auth>',
  'Admin Name',
  'superadmin',
  true,
  true  -- Force password change on first login
);
```

### Step 11 — Create the Shop
```sql
INSERT INTO shops (shop_name, address, phone, tax_rate, bill_prefix)
VALUES (
  'Womaniya Store',
  '<shop-address>',
  '<shop-phone>',
  5.00,           -- GST rate (adjust as needed)
  'WS'            -- Bill number prefix
);

-- Link the superadmin to the shop
UPDATE profiles 
SET shop_id = (SELECT id FROM shops LIMIT 1)
WHERE role = 'superadmin';
```

---

## Phase 3: Frontend Deployment (Vercel)

### Step 12 — Create Vercel Project
1. Log in to **Vartrix Vercel account** → vercel.com
2. Click **Add New → Project**
3. **Import** the `womaniya-dashboard` repo from Vartrix GitHub
4. Framework: **Next.js** (auto-detected)
5. **Environment Variables** — add these:

| Variable | Value | Environments |
|----------|-------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<ref-id>.supabase.co` | Production, Preview, Development |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `<anon-key-from-step-5>` | Production, Preview, Development |

6. Click **Deploy**

### Step 13 — Configure Custom Domain
**In Vercel:**
1. Go to Project → Settings → Domains
2. Add: `dashboard.womaniyastore.in`
3. Vercel will show the DNS records needed

**At your DNS provider (where you bought `womaniyastore.in`):**
1. Add a **CNAME** record:
   - **Name/Host:** `dashboard`
   - **Value/Target:** `cname.vercel-dns.com`
   - **TTL:** Auto or 3600
2. Wait for DNS propagation (5 min – 48 hours, usually ~10 min)

**Back in Vercel:**
1. Vercel will auto-verify the domain
2. SSL certificate is auto-provisioned (Let's Encrypt)
3. Verify: visit `https://dashboard.womaniyastore.in`

### Step 14 — Configure Branch Deployments in Vercel
1. Project → Settings → Git
2. **Production Branch:** `main`
3. **Preview branches:** All other branches (includes `dev`)
4. Every push to `main` → auto-deploys to `dashboard.womaniyastore.in`
5. Every push to `dev` → creates a preview URL (e.g., `womaniya-dashboard-xyz-dev.vercel.app`)

---

## Phase 4: Smoke Testing

### Step 15 — Full End-to-End Test
Run through this checklist on `https://dashboard.womaniyastore.in`:

| # | Test | Expected Result |
|---|------|----------------|
| 1 | Open login page | Login form loads, branding correct |
| 2 | Login with superadmin | Redirects to dashboard |
| 3 | Change password prompt | If `must_change_password=true`, prompted to change |
| 4 | Create a staff user | Via User Management → user created in Supabase Auth + profiles |
| 5 | Create categories | At least 1 category |
| 6 | Create sizes | At least 1 size |
| 7 | Generate QR codes | Create a QR prefix, generate codes |
| 8 | Add a stock lot | Select category, size, QR prefix → inventory items created |
| 9 | Complete a sale | Scan QR → add to cart → complete sale → bill number generated |
| 10 | Sale returns | Return an item from a completed sale |
| 11 | Check attendance | Clock in/out |
| 12 | Test checklist | Create checklist → complete items |
| 13 | Record expense | Add financial transaction → shows in reports |
| 14 | PWA install | On mobile/tablet: "Add to Home Screen" → opens as standalone app |
| 15 | Offline indicator | Toggle airplane mode → offline banner shows |

---

## Phase 5: Production Hardening (Recommended)

### Step 16 — Update Branding (if needed)
File: `src/lib/config/app.config.ts`  
Update: `brand.name`, `brand.fullName`, `brand.shortName`, `brand.logoLetter`

File: `public/manifest.json`  
Update: `name`, `short_name`, `description`, icons

### Step 17 — Supabase Security Checklist
- [ ] Enable **Point-in-Time Recovery** (PITR) on Supabase (requires Pro plan)
- [ ] Set up **Database Backups** schedule
- [ ] Review **RLS policies** — all tables should have RLS enabled (they do)
- [ ] Ensure **service_role key** is NEVER exposed in frontend code
- [ ] Enable **Auth rate limiting** in Supabase Dashboard
- [ ] Set **JWT expiry** to appropriate duration (default: 3600s)

### Step 18 — Vercel Security Checklist
- [ ] Ensure `.env.local` is NOT in the repo (use Vercel env vars only)
- [ ] Enable **Vercel deployment protection** (optional: password-protect previews)
- [ ] Review **Vercel Access** — only Vartrix team members have access
- [ ] Set up **Vercel Analytics** (optional)

### Step 19 — Monitoring
- [ ] Enable **Supabase Log Explorer** → monitor edge function errors
- [ ] Set up **Vercel runtime logs** → monitor frontend errors
- [ ] Consider Sentry or similar for error tracking (future)

---

## Quick Reference: Environment Summary

| Component | Demo/Sales | Production (Client) |
|-----------|-----------|---------------------|
| **GitHub** | Personal private repo | Vartrix GitHub repo |
| **Supabase** | Personal account project | Vartrix Supabase project |
| **Vercel** | Personal account | Vartrix Vercel account |
| **Domain** | `vartrix-store-dashboard.vercel.app` | `dashboard.womaniyastore.in` |
| **Branches** | main | main (prod), dev |
| **Data** | Test/demo data | Client's real data (starts empty) |

---

## Rollback Plan

If something goes wrong during migration:

1. **Supabase:** Delete the project and recreate from scratch (migrations are idempotent)
2. **Vercel:** Redeploy from a previous commit via Vercel Dashboard → Deployments → "..." → Redeploy  
3. **DNS:** CNAME changes propagate within minutes; can revert by removing the record
4. **Git:** All changes are on the Vartrix repo; original demo repo is untouched

---

## Notes

- The demo repo on your personal GitHub remains **completely untouched** — safe for sales demos
- All migrations are idempotent (safe to re-run) thanks to `IF NOT EXISTS`, `CREATE OR REPLACE`, `DROP ... IF EXISTS`
- The initial schema migration (`00000000_initial_schema.sql`) was generated from the live database's type export to capture tables/enums created via the Dashboard
- Edge functions run with `service_role` privileges — they bypass RLS intentionally for operations like user creation
