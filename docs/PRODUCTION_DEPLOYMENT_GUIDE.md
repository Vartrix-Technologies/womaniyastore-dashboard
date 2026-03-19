# Production Deployment Guide: Womaniya Dashboard → dashboard.womaniyastore.in

> Step-by-step ordered checklist to deploy a clean production instance under the Vartrix startup accounts.

---

## Prerequisites

| Item | Details |
|------|---------|
| **Vartrix GitHub account** | Organisation or personal account, ready to host repos |
| **Vartrix Supabase account** | organisation or personal, on a paid plan (Free tier has limits) |
| **Vartrix Vercel account** | Linked to Vartrix GitHub |
| **Cloudflare account** | For DNS proxy & Cloudflare Workers (Supabase ISP ban workaround) |
| **Domain** | `womaniyastore.in` purchased; DNS managed via **Cloudflare** |
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
   - **Publishable Key**
   - **Service Role Key** (Settings → API → `service_role` key — keep secret!)
   - **Database connection string** (`postgresql://postgres:[YOUR-PASSWORD]@db.<ref-id>.supabase.co:5432/postgres`)

   > **⚠️ NEVER commit real keys to this file. Store them in a password manager or Supabase Vault.**

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
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<cloudflare-worker-subdomain>.workers.dev` | Production, Preview |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<ref-id>.supabase.co` | Development (local only, if ISP ban doesn't apply) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `<anon-key-from-step-5>` | Production, Preview, Development |

> **⚠️ This env var change is MANDATORY.** The Cloudflare DNS proxy on `dashboard.womaniyastore.in` only proxies frontend traffic (browser → Cloudflare → Vercel). Supabase API calls are made **directly from the user's browser** to whatever `NEXT_PUBLIC_SUPABASE_URL` is set to. If it still points to `supabase.co`, the ISP ban will block those calls. The Cloudflare Worker URL must be used so browser API requests go through the Worker instead.
>
> The `NEXT_PUBLIC_SUPABASE_ANON_KEY` stays unchanged — the Worker forwards all headers (including the API key) as-is to Supabase. See **Phase 3B** below.

6. Click **Deploy**

### Step 13 — Configure Custom Domain (via Cloudflare DNS Proxy)
**In Vercel:**
1. Go to Project → Settings → Domains
2. Add: `dashboard.womaniyastore.in`
3. Vercel will show the DNS records needed

**In Cloudflare (DNS is managed here, NOT at the domain registrar):**
1. Ensure `womaniyastore.in` is added to Cloudflare and nameservers point to Cloudflare
2. Add a **CNAME** record:
   - **Name/Host:** `dashboard`
   - **Value/Target:** `cname.vercel-dns.com`
   - **Proxy status:** **Proxied** (orange cloud ON) — this routes traffic through Cloudflare's CDN/WAF
   - **TTL:** Auto
3. Cloudflare handles SSL termination (edge certificate) and re-encrypts to Vercel (Full Strict mode recommended)

**Back in Vercel:**
1. Vercel will auto-verify the domain (may take a moment with Cloudflare proxy)
2. Verify: visit `https://dashboard.womaniyastore.in`

> **Note:** Since Cloudflare proxies the traffic, the SSL certificate on the Vercel side is still provisioned, but the end-user sees Cloudflare's edge certificate. Ensure Cloudflare SSL/TLS mode is set to **Full (Strict)**.

### Step 14 — Configure Branch Deployments in Vercel
1. Project → Settings → Git
2. **Production Branch:** `main`
3. **Preview branches:** All other branches (includes `dev`)
4. Every push to `main` → auto-deploys to `dashboard.womaniyastore.in`
5. Every push to `dev` → creates a preview URL (e.g., `womaniya-dashboard-xyz-dev.vercel.app`)

---

## Phase 3B: Cloudflare Worker — Supabase Proxy (ISP Ban Workaround)

> **Context:** Several Indian ISPs temporarily block `*.supabase.co`. A Cloudflare Worker acts as a transparent reverse proxy so the frontend reaches Supabase through a non-blocked domain.

### Step 15 — Create the Cloudflare Worker
> **Status:** This Worker is already deployed on the **Vartrix Cloudflare account**. The steps below are for reference/recreation only.

1. Log in to **Cloudflare Dashboard** → Workers & Pages
2. Click **Create Worker**
3. Name: `supabase-proxy` (or similar)
4. Replace the default code with:

```javascript
export default {
  async fetch(request) {
    const SUPABASE_URL = "https://<ref-id>.supabase.co"; // your actual Supabase project URL

    const url = new URL(request.url);
    const target = SUPABASE_URL + url.pathname + url.search;

    const modifiedRequest = new Request(target, {
      method: request.method,
      headers: request.headers,
      body:
        request.method === "GET" || request.method === "HEAD"
          ? null
          : request.body,
      redirect: "follow",
    });

    return fetch(modifiedRequest);
  },
};
```

5. Click **Save and Deploy**
6. Note the Worker URL: `https://supabase-proxy.<your-cf-subdomain>.workers.dev`

### Step 16 — (Optional) Attach a Custom Route
Instead of using the `workers.dev` URL, you can route it through a subdomain:
1. In Cloudflare → Workers → your worker → Triggers → Add Route
2. Route: `api-proxy.womaniyastore.in/*`
3. Add a CNAME in Cloudflare DNS: `api-proxy` → `supabase-proxy.<your-cf-subdomain>.workers.dev` (Proxied)
4. Update `NEXT_PUBLIC_SUPABASE_URL` in Vercel to `https://api-proxy.womaniyastore.in`

### Step 17 — Verify the Proxy
```powershell
# Test the worker is forwarding correctly
curl https://supabase-proxy.<your-cf-subdomain>.workers.dev/rest/v1/ -H "apikey: <anon-key>" -I
# Should return 200 OK from Supabase
```

> **Important:** The Supabase Anon Key (`NEXT_PUBLIC_SUPABASE_ANON_KEY`) remains unchanged — it is sent as a header by the Supabase JS client. The Worker simply forwards all headers as-is.

> **When the ISP ban is lifted:** Update `NEXT_PUBLIC_SUPABASE_URL` in Vercel back to `https://<ref-id>.supabase.co` and optionally decommission the Worker.

---

## Phase 4: Smoke Testing

### Step 18 — Full End-to-End Test
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

### Step 19 — Update Branding (if needed)
File: `src/lib/config/app.config.ts`  
Update: `brand.name`, `brand.fullName`, `brand.shortName`, `brand.logoLetter`

File: `public/manifest.json`  
Update: `name`, `short_name`, `description`, icons

### Step 20 — Supabase Security Checklist
- [ ] Enable **Point-in-Time Recovery** (PITR) on Supabase (requires Pro plan)
- [ ] Set up **Database Backups** schedule
- [ ] Review **RLS policies** — all tables should have RLS enabled (they do)
- [ ] Ensure **service_role key** is NEVER exposed in frontend code
- [ ] Enable **Auth rate limiting** in Supabase Dashboard
- [ ] Set **JWT expiry** to appropriate duration (default: 3600s)

### Step 21 — Vercel Security Checklist
- [ ] Ensure `.env.local` is NOT in the repo (use Vercel env vars only)
- [ ] Enable **Vercel deployment protection** (optional: password-protect previews)
- [ ] Review **Vercel Access** — only Vartrix team members have access
- [ ] Set up **Vercel Analytics** (optional)

### Step 22 — Monitoring
- [ ] Monitor **Cloudflare Worker** analytics → check request volume and errors
- [ ] Review Cloudflare **Firewall Events** for suspicious activity
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
| **Cloudflare** | — | Vartrix Cloudflare account (DNS proxy + Worker) |
| **Domain** | `vartrix-store-dashboard.vercel.app` | `dashboard.womaniyastore.in` (via Cloudflare proxy → Vercel) |
| **Supabase URL** | Direct `supabase.co` | Cloudflare Worker proxy (`workers.dev` or custom subdomain) |
| **Branches** | main | main (prod), dev |
| **Data** | Test/demo data | Client's real data (starts empty) |

---

## Rollback Plan

If something goes wrong during migration:

1. **Supabase:** Delete the project and recreate from scratch (migrations are idempotent)
2. **Vercel:** Redeploy from a previous commit via Vercel Dashboard → Deployments → "..." → Redeploy  
3. **Cloudflare DNS:** CNAME changes propagate within minutes; can revert by removing or un-proxying the record
4. **Cloudflare Worker:** Roll back the worker code or delete the worker entirely; update `NEXT_PUBLIC_SUPABASE_URL` back to direct Supabase URL
5. **Git:** All changes are on the Vartrix repo; original demo repo is untouched

---

## Notes

- The demo repo on your personal GitHub remains **completely untouched** — safe for sales demos
- All migrations are idempotent (safe to re-run) thanks to `IF NOT EXISTS`, `CREATE OR REPLACE`, `DROP ... IF EXISTS`
- The initial schema migration (`00000000_initial_schema.sql`) was generated from the live database's type export to capture tables/enums created via the Dashboard
- Edge functions run with `service_role` privileges — they bypass RLS intentionally for operations like user creation
- **Cloudflare Worker proxy** is a temporary workaround for ISP-level blocks on `supabase.co` in India. Once the ban is lifted, switch `NEXT_PUBLIC_SUPABASE_URL` back to the direct `https://<ref-id>.supabase.co` URL and optionally remove the Worker
- The Cloudflare DNS proxy (orange cloud) on `dashboard.womaniyastore.in` provides CDN caching, DDoS protection, and hides the Vercel origin IP
