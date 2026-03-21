# Gym Buddy — New Project AI Prompt

> Use this prompt in a fresh AI session to transform this codebase into the Gym Buddy application.
> Attach the **DESIGN_SYSTEM_BIBLE.md** and **PAGE_ANALYSIS_CHECKLIST.md** alongside this prompt.

---

## CONTEXT FOR AI

I'm building **Gym Buddy** — a multi-tenant gym management SaaS disguised as a single-gym experience. I (the superadmin) onboard multiple gyms, but each gym owner sees only their own data and never knows they share a database. This is architecturally identical to my existing production app "Womaniya Dashboard" which manages retail shops.

**This repo IS the Womaniya Dashboard codebase.** Your job is to systematically transform it into Gym Buddy — stripping retail-specific code, keeping all reusable infrastructure, and building gym-specific features on top. Do NOT start from scratch.

I'm attaching my **Design System Bible** and **Page Analysis Checklist** from the existing app — follow them as the canonical source for all UI/UX decisions.

### Key User Insights (Shape Every Design Decision)

| Insight | Impact |
|---------|--------|
| **Primary user is the receptionist**, not the owner | Optimize every screen for rapid-fire operations: sell membership, collect payment, add enquiry. Owner only cares about analytics. |
| **Primary device is a tablet/desktop at the reception counter** | Design for 768px+ first. Mobile support secondary. Larger touch targets, side-by-side layouts OK. |
| **First target gym has ~400 members** | Server-side pagination default: 25 items. Search must be fast. Scale to 500+ without redesign. |
| **WhatsApp is THE communication channel** | WhatsApp deep links everywhere. No SMS. No email notifications to members. |
| **Family/couple memberships are common** | Must support group memberships (1 payment, multiple members linked). |
| **Free initially, monthly SaaS later** | Superadmin needs a subscription management panel to enable/disable gyms. |
| **Potential white-label in future** | Keep branding fully config-driven (appConfig). No hardcoded app names anywhere. |
| **No member attendance tracking** | No check-in/check-out for members — only trainer attendance. Saves DB load. |
| **Hindi/regional language NOT needed** | English only. No i18n infrastructure. |

### Build Strategy: Transform, Don't Rebuild

This codebase has ~70% reusable infrastructure:
- **Keep as-is:** Auth system, hooks, shared components, design system config, contexts, shadcn/ui components, Tailwind setup, PWA shell, eslint/tsconfig, all `src/components/shared/`, all `src/hooks/`, `ThemeColorContext`, `AuthContext` (rename shop→gym references)
- **Delete:** QR code components, inventory components, POS components, sales/returns, lot management, SyncContext (no offline POS needed), all QR/inventory migrations, all `src/components/pos/`
- **Transform:** `shops` → `gyms` table, `shop_id` → `gym_id` everywhere, staff → trainer, customer → member, sales → payments
- **Build new:** Member management, membership plans, membership lifecycle, payment tracking, referrals, leads, passes, Gmail backup, measurement tracking, WhatsApp integration, reception desk mode

---

## 1. TECH STACK (Exact Match)

| Layer | Technology | Version Baseline |
|-------|-----------|-----------------|
| Framework | **Next.js 16+** (App Router, React 19+) | Latest stable |
| Language | **TypeScript** (strict mode) | 5.x |
| Styling | **Tailwind CSS 4** + `@tailwindcss/postcss` | Latest |
| UI Components | **shadcn/ui** (Radix UI primitives) | Latest |
| Icons | **Lucide React** | Latest |
| Animations | **Framer Motion** | Latest |
| Forms | **react-hook-form** + **Zod** validation | Latest |
| Database | **Supabase** (PostgreSQL + Auth + RLS) | Latest |
| Data Fetching | **@tanstack/react-query** | Latest |
| Tables | **@tanstack/react-table** | Latest |
| Charts | **Recharts** | Latest |
| Theming | **next-themes** (light/dark) + custom runtime palette context | — |
| Toasts | **Sonner** | Latest |
| Command Palette | **cmdk** | Latest |
| Date Utils | **date-fns** | Latest |
| PDF Export | **jsPDF** + **html2canvas** | Latest |
| Excel Export | **xlsx** | Latest |
| PWA | Custom service worker + manifest.json | — |

### Do NOT include (not needed for gym app):
- QR code generation/scanning libraries (`qrcode`, html5-qrcode)
- @tsparticles (particle effects — too heavy, skip for now)
- IDB / IndexedDB (no offline POS mode needed)

---

## 2. APPLICATION PURPOSE & DOMAIN

### What Gym Buddy Does
A **premium membership management system for gyms** with:
- **Member onboarding** with extensive profile data (text-only, no images to keep DB lean)
- **Membership plan management** (create monthly/quarterly/annual plans + daily/weekly passes + trial passes)
- **Membership renewals** and payment tracking with partial payment support
- **Referral system** (track who referred whom, reward discounts on renewal)
- **Lead management** (enquiry pipeline: walk-in/call → trial → converted/lost)
- **Birthday celebrations** (today's birthdays banner, birthday month list, WhatsApp wish links)
- **Body measurement tracking** (periodic weight, chest, waist, etc. — text-only, with progress charts)
- **Family/couple memberships** (link multiple members to one payment, group discount)
- **Gym trainer management** (similar to staff management in Womaniya)
- **Attendance tracking** for trainers (clock in/out, same pattern as Womaniya)
- **Daily checklists** for gym operations (cleaning, equipment check — same as Womaniya)
- **Financial ledger** (membership income, expenses — same pattern as Womaniya)
- **Analytics & reports** (revenue, member growth, expiring memberships, trainer performance)
- **Gmail backup** of member data (like WhatsApp chat backup — periodic export to gym owner's Gmail)
- **WhatsApp deep links** (pre-filled messages for expiry reminders, birthday wishes, payment reminders — zero API cost)
- **Promo codes** (discount codes for campaigns, track redemptions)
- **Reception Desk mode** (single-screen speed UI for front desk member lookup + payment)
- **Equipment inventory** (simple list with maintenance schedule — lightweight)
- **Announcements** (gym-wide notices: holiday closures, timing changes)
- **Onboarding wizard** (guided first-time setup for new gyms)
- **Contextual teaching** (first-visit tooltips on every page, dismissible)
- **WordPress integration ready** (API endpoints for embedding data on gym websites)

### What It Does NOT Do (Phase 1)
- Member-facing app or portal (no member login — future scope)
- Member attendance tracking (no check-in/check-out — unnecessary DB load)
- Workout plans or exercise tracking
- Diet plans
- Image/photo uploads (text-only DB to keep costs low)
- Online payments or payment gateway integration
- QR codes or inventory management
- SMS sending (WhatsApp deep links instead — zero cost)
- Hindi/regional language support (English only)

---

## 3. MULTI-TENANT ARCHITECTURE

### Identical pattern to Womaniya:

```
superadmin (me — manages subscriptions, enables/disables gyms)
├── Gym A (owner: John) [subscription: active]
│   ├── Admin: Sara
│   ├── Receptionist: Lisa
│   ├── Trainer: Mike
│   └── Trainer: Raj
├── Gym B (owner: Priya) [subscription: active]
│   ├── Receptionist: Deepa
│   ├── Trainer: Amit
│   └── Trainer: Neha
└── Gym C (owner: Alex) [subscription: expired — disabled]
    └── (all users locked out)
```

### Entity Mapping (Womaniya → Gym Buddy)

| Womaniya Concept | Gym Buddy Equivalent |
|-----------------|---------------------|
| Shop | **Gym** |
| Shop Owner | **Gym Owner** |
| Admin (shop) | **Gym Admin** |
| Staff | **Gym Trainer** |
| Customer | **Member** |
| Inventory Item | **Membership** (assigned plan instance) |
| Sale | **Payment / Membership Transaction** |
| Sale Item | **Payment Line Item** |
| Category | **Membership Plan Category** (e.g., Monthly, Quarterly) |
| Lot | — (not applicable) |
| QR Code | — (not applicable) |

### Roles & Permissions

| Role | Access |
|------|--------|
| `superadmin` | All gyms, all data, manage gyms & owners, subscription management (enable/disable gyms) |
| `owner` | Full access to own gym, manage admins, trainers, receptionists. Analytics & reports focus. |
| `admin` | Same as owner minus billing/financial settings |
| `receptionist` | **Primary operator.** Member lookup, sell memberships, collect payments, add walk-ins/enquiries, daily pass. No financial reports or settings. |
| `trainer` | View assigned members, mark own attendance, log measurements, complete checklists |

### RLS Rules
- Every table has `gym_id` column (equivalent of `shop_id`)
- `current_gym_id()` SQL function returns the authenticated user's gym
- All SELECT/INSERT/UPDATE/DELETE policies filter by `gym_id = current_gym_id()`
- Superadmin bypasses gym isolation
- Trainers have row-level restrictions on write operations

---

## 4. DATABASE SCHEMA

### Enums

```sql
CREATE TYPE user_role AS ENUM ('superadmin', 'owner', 'admin', 'receptionist', 'trainer');
CREATE TYPE membership_status AS ENUM ('active', 'expired', 'frozen', 'cancelled');
CREATE TYPE plan_type AS ENUM ('membership', 'daily_pass', 'weekly_pass', 'trial');
CREATE TYPE payment_method AS ENUM ('cash', 'upi', 'card', 'bank_transfer', 'other');
CREATE TYPE payment_status AS ENUM ('paid', 'partial', 'pending', 'refunded');
CREATE TYPE gender AS ENUM ('male', 'female', 'other');
CREATE TYPE attendance_status AS ENUM ('open', 'closed');
CREATE TYPE financial_tx_type AS ENUM ('membership_income', 'expense', 'adjustment', 'refund');
CREATE TYPE checklist_status AS ENUM ('pending', 'completed', 'partial');
CREATE TYPE lead_status AS ENUM ('new', 'contacted', 'trial', 'converted', 'lost');
CREATE TYPE lead_source AS ENUM ('walk_in', 'phone', 'referral', 'website', 'social_media', 'other');
```

### Core Tables

#### `gyms`
```sql
CREATE TABLE gyms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_name TEXT NOT NULL,
  address TEXT,
  city TEXT,
  phone TEXT,
  email TEXT,
  opening_time TIME DEFAULT '06:00',
  closing_time TIME DEFAULT '22:00',
  is_active BOOLEAN DEFAULT true,
  settings JSONB DEFAULT '{}',  -- tax_rate, currency, bill_prefix, referral_reward_config, auto_backup, revenue_goal, etc.
  
  -- Subscription management (superadmin controls)
  subscription_status TEXT DEFAULT 'active',    -- 'active', 'trial', 'expired', 'suspended'
  subscription_started_at TIMESTAMPTZ DEFAULT now(),
  subscription_expires_at TIMESTAMPTZ,          -- NULL = indefinite (free tier)
  subscription_plan TEXT DEFAULT 'free',        -- 'free', 'basic', 'premium' (future billing tiers)
  subscription_notes TEXT,                      -- superadmin notes ('Payment pending since March')
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

#### `profiles` (Auth-linked, same pattern as Womaniya)
```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  role user_role NOT NULL DEFAULT 'trainer',
  gym_id UUID REFERENCES gyms(id),
  is_active BOOLEAN DEFAULT true,
  must_change_password BOOLEAN DEFAULT true,
  password_changed_at TIMESTAMPTZ,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
```

#### `members` (Core entity — text-only, extensive)
```sql
CREATE TABLE members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id UUID NOT NULL REFERENCES gyms(id),
  
  -- Identity
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  alt_phone TEXT,
  email TEXT,
  gender gender,
  date_of_birth DATE,
  
  -- Address
  address TEXT,
  city TEXT,
  pincode TEXT,
  
  -- Physical Profile (text-only, no images)
  height_cm NUMERIC(5,1),        -- e.g., 175.5
  weight_kg NUMERIC(5,1),        -- e.g., 72.3
  blood_group TEXT,               -- e.g., 'O+', 'AB-'
  
  -- Professional & Personal
  profession TEXT,                -- e.g., 'Software Engineer'
  workplace TEXT,                 -- e.g., 'TCS, Pune'
  
  -- Medical
  medical_conditions TEXT,        -- free text: 'Asthma, knee injury'
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  
  -- Gym-specific
  fitness_goal TEXT,              -- e.g., 'Weight loss', 'Muscle gain', 'General fitness'
  referred_by_member_id UUID REFERENCES members(id),  -- FK to referring member (for referral tracking)
  referred_by_name TEXT,          -- fallback: free-text name if referrer isn't a member
  assigned_trainer_id UUID REFERENCES profiles(id),
  notes TEXT,                     -- admin notes
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  joined_at DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_members_phone_gym ON members(phone, gym_id);
CREATE INDEX idx_members_dob ON members(date_of_birth);  -- for birthday queries
CREATE INDEX idx_members_gym_active ON members(gym_id, is_active);
```

#### `membership_plans` (Templates)
```sql
CREATE TABLE membership_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id UUID NOT NULL REFERENCES gyms(id),
  plan_name TEXT NOT NULL,            -- e.g., 'Monthly Basic', 'Quarterly Premium'
  plan_type plan_type DEFAULT 'membership', -- membership, daily_pass, weekly_pass, trial
  duration_days INTEGER NOT NULL,     -- e.g., 1, 7, 30, 90, 180, 365
  price NUMERIC(10,2) NOT NULL,
  description TEXT,
  includes_personal_training BOOLEAN DEFAULT false,
  max_freeze_days INTEGER DEFAULT 0,  -- how many days a member can freeze this plan
  
  -- Family/couple support
  allows_family BOOLEAN DEFAULT false,     -- can this plan be purchased as a family group?
  family_max_members INTEGER DEFAULT 1,    -- max members in one family group (e.g., 2 for couple, 4 for family)
  family_discount_percent NUMERIC(4,1) DEFAULT 0, -- discount per additional family member (e.g., 20%)
  
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

#### `memberships` (Assigned plan instances — the core business record)
```sql
CREATE TABLE memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id UUID NOT NULL REFERENCES gyms(id),
  member_id UUID NOT NULL REFERENCES members(id),
  plan_id UUID NOT NULL REFERENCES membership_plans(id),
  
  -- Duration
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  
  -- Pricing (snapshot at time of purchase)
  plan_price NUMERIC(10,2) NOT NULL,     -- original plan price
  discount NUMERIC(10,2) DEFAULT 0,      -- discount applied
  final_amount NUMERIC(10,2) NOT NULL,   -- plan_price - discount
  
  -- Payment
  amount_paid NUMERIC(10,2) DEFAULT 0,
  payment_status payment_status DEFAULT 'pending',
  
  -- Status
  status membership_status DEFAULT 'active',
  frozen_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  cancellation_reason TEXT,
  
  -- Freeze tracking
  freeze_days_used INTEGER DEFAULT 0,
  max_freeze_days INTEGER DEFAULT 0,   -- snapshot from plan at time of purchase
  
  -- Promo
  promo_code_id UUID REFERENCES promo_codes(id),
  
  -- Family/Group
  family_group_id UUID REFERENCES family_groups(id),  -- NULL for individual, set for family plans
  
  -- Metadata
  renewed_from_id UUID REFERENCES memberships(id),  -- links renewal chain
  notes TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_memberships_expiry ON memberships(end_date, status);
CREATE INDEX idx_memberships_member ON memberships(member_id, gym_id);
```

#### `family_groups` (Link multiple members under one membership purchase)
```sql
CREATE TABLE family_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id UUID NOT NULL REFERENCES gyms(id),
  
  group_name TEXT NOT NULL,               -- e.g., 'Sharma Family', 'Raj & Priya'
  primary_member_id UUID NOT NULL REFERENCES members(id),  -- who pays / primary contact
  
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Junction: which members are in this family group
CREATE TABLE family_group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_group_id UUID NOT NULL REFERENCES family_groups(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES members(id),
  relationship TEXT,                      -- 'spouse', 'child', 'parent', 'sibling', 'other'
  added_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(family_group_id, member_id)
);
```

#### `payments` (Track every payment against a membership)
```sql
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id UUID NOT NULL REFERENCES gyms(id),
  membership_id UUID NOT NULL REFERENCES memberships(id),
  member_id UUID NOT NULL REFERENCES members(id),
  
  amount NUMERIC(10,2) NOT NULL,
  payment_method payment_method DEFAULT 'cash',
  payment_date DATE DEFAULT CURRENT_DATE,
  receipt_number TEXT,                     -- auto-generated, gym-prefixed
  notes TEXT,
  
  received_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
```

#### `attendance_logs` (Trainer attendance — same as Womaniya)
```sql
CREATE TABLE attendance_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id UUID NOT NULL REFERENCES gyms(id),
  profile_id UUID NOT NULL REFERENCES profiles(id),
  
  clock_in TIMESTAMPTZ NOT NULL,
  clock_out TIMESTAMPTZ,
  status attendance_status DEFAULT 'open',
  
  -- Edit audit trail (same as Womaniya)
  is_manual BOOLEAN DEFAULT false,
  manual_reason TEXT,
  edited_by UUID REFERENCES profiles(id),
  edited_at TIMESTAMPTZ,
  edit_reason TEXT,
  deleted_by UUID REFERENCES profiles(id),
  deleted_at TIMESTAMPTZ,
  delete_reason TEXT,
  is_deleted BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ DEFAULT now()
);
```

#### `checklists`, `checklist_items`, `checklist_instances`, `checklist_item_completions`
> Exact same schema as Womaniya. Copy 1:1. Replace `shop_id` with `gym_id`.

#### `expense_categories`
```sql
CREATE TABLE expense_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id UUID NOT NULL REFERENCES gyms(id),
  name TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

#### `financial_transactions`
```sql
CREATE TABLE financial_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id UUID NOT NULL REFERENCES gyms(id),
  type financial_tx_type NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  description TEXT,
  payment_method payment_method,
  reference_id UUID,                   -- links to membership_id or payment_id
  category_id UUID REFERENCES expense_categories(id),
  transaction_date DATE DEFAULT CURRENT_DATE,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
```

#### `gmail_backup_logs` (Track backup history)
```sql
CREATE TABLE gmail_backup_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id UUID NOT NULL REFERENCES gyms(id),
  backup_type TEXT NOT NULL,            -- 'members', 'payments', 'full'
  record_count INTEGER,
  file_format TEXT DEFAULT 'csv',       -- 'csv' or 'json'
  sent_to_email TEXT NOT NULL,
  status TEXT DEFAULT 'sent',           -- 'sent', 'failed'
  error_message TEXT,
  triggered_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
```

#### `leads` (Enquiry pipeline)
```sql
CREATE TABLE leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id UUID NOT NULL REFERENCES gyms(id),
  
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  
  source lead_source DEFAULT 'walk_in',
  interested_plan_id UUID REFERENCES membership_plans(id),
  status lead_status DEFAULT 'new',
  
  -- Follow-up
  last_contacted_at TIMESTAMPTZ,
  next_follow_up DATE,
  notes TEXT,
  
  -- Conversion
  converted_member_id UUID REFERENCES members(id),  -- set when lead becomes a member
  converted_at TIMESTAMPTZ,
  lost_reason TEXT,
  
  assigned_to UUID REFERENCES profiles(id),
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_leads_status ON leads(gym_id, status);
CREATE INDEX idx_leads_follow_up ON leads(next_follow_up) WHERE status NOT IN ('converted', 'lost');
```

#### `referrals` (Track referral rewards)
```sql
CREATE TABLE referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id UUID NOT NULL REFERENCES gyms(id),
  
  referrer_member_id UUID NOT NULL REFERENCES members(id),  -- who referred
  referred_member_id UUID NOT NULL REFERENCES members(id),  -- who was referred
  
  -- Reward
  reward_type TEXT DEFAULT 'discount',     -- 'discount', 'free_days', 'none'
  reward_value NUMERIC(10,2),              -- discount amount or free days count
  reward_applied BOOLEAN DEFAULT false,    -- has the reward been redeemed?
  reward_applied_at TIMESTAMPTZ,
  reward_membership_id UUID REFERENCES memberships(id), -- which renewal got the discount
  
  created_at TIMESTAMPTZ DEFAULT now()
);
```

#### `member_measurements` (Body progress tracking)
```sql
CREATE TABLE member_measurements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id UUID NOT NULL REFERENCES gyms(id),
  member_id UUID NOT NULL REFERENCES members(id),
  
  measured_at DATE DEFAULT CURRENT_DATE,
  
  -- All measurements optional (record what's available)
  weight_kg NUMERIC(5,1),
  chest_cm NUMERIC(5,1),
  waist_cm NUMERIC(5,1),
  hips_cm NUMERIC(5,1),
  biceps_cm NUMERIC(5,1),
  thighs_cm NUMERIC(5,1),
  body_fat_percent NUMERIC(4,1),
  
  notes TEXT,
  recorded_by UUID REFERENCES profiles(id),  -- trainer who took measurements
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_measurements_member ON member_measurements(member_id, measured_at);
```

#### `promo_codes` (Discount campaigns)
```sql
CREATE TABLE promo_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id UUID NOT NULL REFERENCES gyms(id),
  
  code TEXT NOT NULL,                      -- e.g., 'NEWYEAR25', 'REFER50'
  discount_type TEXT DEFAULT 'percentage', -- 'percentage' or 'flat'
  discount_value NUMERIC(10,2) NOT NULL,   -- e.g., 25 (for 25%) or 500 (for ₹500 off)
  
  -- Validity
  valid_from DATE DEFAULT CURRENT_DATE,
  valid_until DATE,
  max_uses INTEGER,                        -- NULL = unlimited
  times_used INTEGER DEFAULT 0,
  
  -- Restrictions
  applicable_plan_ids UUID[],              -- NULL = all plans
  min_plan_duration_days INTEGER,          -- e.g., only for 90+ day plans
  
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX idx_promo_code_gym ON promo_codes(gym_id, code);
```

#### `equipment` (Lightweight equipment tracking)
```sql
CREATE TABLE equipment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id UUID NOT NULL REFERENCES gyms(id),
  
  name TEXT NOT NULL,                      -- e.g., 'Treadmill #3', 'Leg Press'
  category TEXT,                           -- e.g., 'Cardio', 'Strength', 'Free Weights'
  brand TEXT,
  purchase_date DATE,
  purchase_cost NUMERIC(10,2),
  
  -- Maintenance
  last_maintenance_date DATE,
  next_maintenance_date DATE,
  maintenance_notes TEXT,
  
  status TEXT DEFAULT 'working',           -- 'working', 'needs_repair', 'out_of_order'
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

#### `announcements` (Gym-wide notices)
```sql
CREATE TABLE announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id UUID NOT NULL REFERENCES gyms(id),
  
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  priority TEXT DEFAULT 'normal',          -- 'low', 'normal', 'urgent'
  
  -- Visibility
  visible_from TIMESTAMPTZ DEFAULT now(),
  visible_until TIMESTAMPTZ,              -- NULL = indefinite
  show_to_roles user_role[] DEFAULT '{owner,admin,receptionist,trainer}',
  
  is_pinned BOOLEAN DEFAULT false,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
```

#### `whatsapp_templates` (Pre-filled message templates)
```sql
CREATE TABLE whatsapp_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id UUID NOT NULL REFERENCES gyms(id),
  
  name TEXT NOT NULL,                      -- e.g., 'Expiry Reminder', 'Birthday Wish'
  template TEXT NOT NULL,                  -- 'Hi {member_name}, your membership expires on {end_date}...'
  category TEXT NOT NULL,                  -- 'expiry', 'birthday', 'payment', 'welcome', 'custom'
  
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

#### `onboarding_progress` (First-time setup wizard tracking)
```sql
CREATE TABLE onboarding_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id UUID NOT NULL REFERENCES gyms(id) UNIQUE,
  
  steps_completed JSONB DEFAULT '{}',     -- e.g., {"gym_details": true, "first_plan": true, "first_trainer": false}
  is_completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

```sql
-- Get current user's gym (same pattern as current_shop_id)
CREATE FUNCTION current_gym_id() RETURNS UUID AS $$
  SELECT gym_id FROM profiles WHERE id = auth.uid()
$$ LANGUAGE SQL SECURITY DEFINER STABLE SET search_path = public;

-- Auto-generate receipt numbers per gym
CREATE FUNCTION next_receipt_number(p_gym_id UUID) RETURNS TEXT AS $$
  -- Pattern: GYM_PREFIX-0001, GYM_PREFIX-0002, ...
$$ LANGUAGE plpgsql;

-- Check membership expiry (called by cron or on-demand)
CREATE FUNCTION update_expired_memberships() RETURNS void AS $$
  UPDATE memberships 
  SET status = 'expired' 
  WHERE end_date < CURRENT_DATE AND status = 'active';
$$ LANGUAGE SQL;
```

### Cron Jobs (Supabase pg_cron)
1. **Nightly at 00:30**: `update_expired_memberships()` — auto-expire overdue memberships
2. **Nightly at 01:00**: Auto-close open attendance logs older than 16 hours
3. **Weekly (optional)**: Trigger Gmail backup for gyms with auto-backup enabled

---

## 5. APP ROUTES & NAVIGATION

```
/ (root)               → Redirect based on role:
│                         • superadmin → /superadmin
│                         • owner/admin → /admin
│                         • receptionist → /reception (PRIMARY work screen)
│                         • trainer → /trainer
├── /login             → Email/password login
├── /change-password   → First-login password change
└── /(protected)       → Auth-required (subscription check: expired gym → locked screen)
    ├── /superadmin           → Superadmin dashboard
    │   ├── /gyms             → Manage all gyms (with subscription status)
    │   ├── /gyms/[id]        → Single gym detail + subscription controls
    │   ├── /subscriptions    → Subscription management (active/trial/expired/suspended)
    │   └── /analytics        → Cross-gym analytics
    │
    ├── /admin                → Gym admin/owner dashboard (Smart Dashboard — analytics focus)
    │   ├── /members          → Member management (CRUD, search, filter)
    │   ├── /members/[id]     → Member detail + membership history + measurements + family
    │   ├── /members/new      → Onboard new member (multi-step form)
    │   ├── /memberships      → All memberships (active, expiring, expired)
    │   ├── /plans            → Membership plans CRUD (monthly, quarterly, daily pass, family, etc.)
    │   ├── /trainers         → Trainer management (≡ staff management)
    │   ├── /attendance       → Trainer attendance (same as Womaniya staff attendance)
    │   ├── /checklists       → Daily checklists (same as Womaniya)
    │   ├── /finances         → Income/expenses ledger (same as Womaniya)
    │   ├── /reports          → Analytics & reports
    │   ├── /payments         → Payment history & pending dues
    │   ├── /leads            → Lead/enquiry pipeline
    │   ├── /equipment        → Equipment list + maintenance schedule
    │   ├── /backup           → Gmail backup management
    │   └── /settings         → Gym settings (details, plans, expense categories, templates, promos)
    │
    ├── /reception            → Reception Desk mode (THE primary work screen for receptionists)
    │                           Search, sell, renew, collect — all within 2 taps
    │
    ├── /trainer              → Trainer dashboard
    │   ├── /my-members       → Trainer's assigned members + log measurements
    │   └── /attendance       → Own attendance
    │
    ├── /me                   → Profile page
    ├── /settings             → App settings (theme, preferences)
    └── /faqs                 → Help / FAQ
```

---

## 6. KEY FEATURES — DETAILED SPECS

### 6.1 Smart Dashboard (Owner-Focused Analytics)

The admin/owner dashboard is an **analytics command center**. The owner checks this from home to see how the gym is doing. (Receptionists use the Reception Desk mode instead — see 6.10.)

**Top Section — Urgency Cards (horizontal scroll on mobile):**
| Card | Data | Action |
|------|------|--------|
| 🎂 Birthdays Today | Count + names | → Tap to see list, one-tap WhatsApp wish |
| ⚠️ Expiring This Week | Count | → Tap to see list, one-tap renew or remind |
| 💰 Pending Dues | ₹ amount | → Tap to see who owes, collect payment |
| 📋 Leads to Follow Up | Count with overdue | → Tap to see leads pipeline |

**Middle Section — KPI Stats Grid (interactive toggle filter like Womaniya inventory):**
- Total Members, Active Memberships, Expired, Frozen, New This Month, Renewals This Month

**Bottom Section — Quick Actions Grid:**
- [+ New Member] [+ Collect Payment] [+ Daily Pass] [+ Add Enquiry]
- Each is a gradient button leading to the fastest path for that action

**Revenue Trend**: Small sparkline or bar chart showing last 7 days income. Below: "This month: ₹X vs Last month: ₹Y (↑Z%)"

**Revenue Goal Progress**: If monthly target is set, show progress bar ("₹45,000 / ₹80,000 target — 56%")

**Announcements Banner**: Pinned announcements from the `announcements` table.

### 6.2 Member Onboarding
- **Multi-step form** (not one giant form) with stepper progress indicator:
  - Step 1: Basic Info (name, phone, gender, DOB) — **phone is validated unique per gym**
  - Step 2: Contact & Address (email, alt phone, address, city, pincode)
  - Step 3: Physical Profile (height, weight, blood group)
  - Step 4: Professional & Medical (profession, workplace, medical conditions, emergency contact)
  - Step 5: Gym Details (fitness goal, referral source, assign trainer, notes)
- **Quick-add toggle**: At the top of the form, a switch: "Quick Add (name + phone only)" — skips to step 5 with minimal required fields. Fill rest later from member detail page.
- **Smart defaults**: Most popular trainer pre-selected, most common fitness goal pre-filled
- Server-side search across all member fields
- Filters: active/inactive, has active membership / no membership / expired, assigned trainer
- **Inline WhatsApp**: On member list rows, a small WhatsApp icon that opens `wa.me/{phone}` — instant communication

### 6.3 Member Detail Page (`/members/[id]`)
A premium detail page with tabs:
- **Profile tab**: All member info with inline edit (same form steps, but editable)
- **Membership tab**: Current plan, history of all past memberships (renewal chain), assign new plan, renew, freeze, cancel
- **Payments tab**: Payment history, record new payment, pending balance
- **Measurements tab**: Chart (Recharts line graph) of weight/chest/waist over time + table of all entries + "Add Measurement" button
- **Referrals tab**: Who this member referred, who referred them, reward status
- **Notes/Timeline tab**: Activity log (joined, plan assigned, payment recorded, measurement taken, etc.)

### 6.4 Membership Management
- **Plan types**: `membership` (30+ days), `daily_pass` (1 day), `weekly_pass` (7 days), `trial` (3-7 days free)
- **Assign plan** to member → creates a `memberships` row with start/end dates
- **Renewal flow**: Select expiring/expired membership → renew (creates new membership linked via `renewed_from_id`). Pre-fill with same plan, apply referral discount if eligible.
- **Freeze**: Pause membership. Track `freeze_days_used` vs `max_freeze_days` (from plan). When unfreezing, extend `end_date` by frozen duration. Show remaining freeze days on member card.
- **Cancel**: With reason, tracks cancelled_at
- **Daily/Weekly pass**: Quick flow — select member (or quick-add new member) → select pass → collect payment → done in 3 taps
- **Expiry alerts**: Prominent warning cards for members expiring within 7 days. Show on dashboard and members list.
- **Batch renewal**: Select multiple expiring members → renew all with same plan or individual plans
- Server-side pagination (default 25 items for ~400 member gyms), sorting, search, date range filtering

### 6.4.1 Family/Couple Memberships
Many gyms offer discounted family plans. This is a first-class feature:

**How it works:**
1. Receptionist creates a **Family Group** (e.g., "Sharma Family") with a primary member as the payer
2. Add family members to the group (spouse, child, etc. with relationship tag)
3. When selling a family-enabled plan, the system applies `family_discount_percent` for each additional member beyond the first
4. **One payment record** covers all family members' memberships, but each member gets their own membership row (for individual tracking/expiry)
5. On the member detail page, show "Family: Sharma Family (3 members)" with links to each

**Example flow:**
- Plan: "Quarterly Premium" — ₹2,500/person, family discount 20%
- Family of 3: ₹2,500 + ₹2,000 + ₹2,000 = ₹6,500 total
- Creates 3 membership rows, 1 payment of ₹6,500

**UI:**
- On plan creation page: toggle "Allow Family" → shows max members + discount % fields
- On membership assignment: if family plan, show "Add Family Member" button to add more members before finalizing
- Receipt shows all members with group name

### 6.5 Payment Tracking
- Record payments against memberships
- Support partial payments (amount_paid vs final_amount) with visual progress bar
- Auto-generated receipt numbers (gym prefix + sequential)
- Payment methods: Cash, UPI, Card, Bank Transfer, Other
- Payment history per member (in member detail page)
- **Pending dues view**: Members with partial/pending payments, sorted by amount owed
- **Collect payment shortcut**: From anywhere a member name appears, one-tap to payment dialog
- Financial summary: Daily/weekly/monthly collection totals with comparison to previous period
- **Receipt generation**: PDF receipt with gym branding (similar to Womaniya bill preview)

### 6.6 Birthday Management 🎂
- **Today's Birthdays**: Prominent card on dashboard with member names and 🎂 emoji
- **Birthday Month View**: Calendar-style list of all member birthdays this month
- **WhatsApp Birthday Wish**: One-tap button next to each birthday member → opens WhatsApp with pre-filled wish message from `whatsapp_templates` (category: 'birthday')
- **Birthday query**: `SELECT * FROM members WHERE EXTRACT(MONTH FROM date_of_birth) = EXTRACT(MONTH FROM CURRENT_DATE) AND EXTRACT(DAY FROM date_of_birth) = EXTRACT(DAY FROM CURRENT_DATE) AND gym_id = current_gym_id()`
- **Tip**: If birthday falls during membership expiry period, show "Birthday + Expiring" special highlight to nudge the gym to offer a birthday renewal discount

### 6.7 Lead Management (Enquiry Pipeline)
- **Add Enquiry**: Quick form (name + phone + source + interested plan)
- **Pipeline view**: Kanban-style or list view with status columns: New → Contacted → Trial → Converted / Lost
- **Follow-up reminders**: "3 leads haven't been contacted in 5 days" nudge on dashboard
- **Convert to member**: One-tap converts a lead into a member (pre-fills member form with lead data)
- **Loss tracking**: When marking as lost, capture reason
- **Sources**: Walk-in, Phone call, Referral, Website (WordPress form), Social media, Other
- **Stats**: Conversion rate, average time to convert, best-performing source

### 6.8 Referral System
- **Track referrals**: When onboarding a new member, optionally link to existing member as referrer (`referred_by_member_id`)
- **Referral rewards**: Gym owner configures reward rules in settings (e.g., "₹200 off next renewal per referral" or "7 free days per referral")
- **Reward application**: When referrer renews, show available referral rewards and apply as discount
- **Referral leaderboard**: Top referrers ranked by count — display on dashboard or reports
- **Referral tracking**: Each member's detail page shows who they referred and their rewards

### 6.9 WhatsApp Deep Links (Zero-Cost Communication)
- **No API needed**: Uses `wa.me/{phone}?text={encoded_message}` — opens WhatsApp natively
- **Template system**: `whatsapp_templates` table stores customizable message templates per gym
- **Default templates** (seeded during onboarding):
  - Expiry Reminder: "Hi {member_name}, your {plan_name} membership at {gym_name} expires on {end_date}. Visit us to renew!"
  - Birthday Wish: "Happy Birthday {member_name}! 🎂 {gym_name} wishes you a fantastic year of fitness!"
  - Payment Reminder: "Hi {member_name}, you have a pending balance of ₹{amount} for your membership. Please visit us to clear your dues."
  - Welcome: "Welcome to {gym_name}, {member_name}! Your {plan_name} membership starts today. Let's crush those goals! 💪"
  - Renewal Confirmation: "Hi {member_name}, your {plan_name} has been renewed until {end_date}. See you at the gym!"
- **Bulk action**: On member list, filter by "expiring this week" → "Send Reminder to All" button → opens WhatsApp for each member sequentially (or shows a list with individual send buttons)
- **Template editor**: In settings, gym owner can customize message wording

### 6.10 Reception Desk Mode (`/reception`) — THE PRIMARY WORK SCREEN

**This is where the receptionist lives all day.** It is the default landing page for the `receptionist` role. Optimized for a tablet/desktop at the front desk. Every action within 2 taps.

**Layout (Side-by-side on tablet/desktop):**

**Left Panel (60% width):**
- **Giant search bar** at top → type phone number or name → instant results below (debounced, server-side)
- **Search results**: Member cards with: name (initials avatar), active plan badge (green/red/yellow), expiry date, due amount
- **Each card has inline actions**: [Renew] [Pay ₹{amount}] [WhatsApp] [Profile]
- Below search: **Quick Action Buttons** in a 2x2 grid:
  - [+ Sell Membership] → opens member picker + plan selector + payment in one flow
  - [+ Daily/Weekly Pass] → quick-add or select member → select pass → collect → done
  - [+ New Member] → quick-add form (name + phone, assign plan immediately)
  - [+ Add Enquiry] → lead quick-form

**Right Panel (40% width):**
- **Today's Birthdays** (compact list with WhatsApp icons)
- **Expiring This Week** (compact list with [Renew] buttons)
- **Recent Activity Feed** (last 10 actions: "Rajesh renewed Monthly", "Priya paid ₹1,000")
- **Pinned Announcements** (urgent ones highlighted)

**Key Design Principles for Reception Desk:**
- Search bar is auto-focused on page load — receptionist can start typing immediately
- Phone number search shows instant results — most common lookup method
- "Sell Membership" flow is the hero: member → plan → payment → WhatsApp welcome = 4 taps max
- Family membership: "Add Family Members" step in the sell flow
- All dialogs open as side sheets (not centered modals) to maintain spatial context on tablet
- WhatsApp buttons use green WhatsApp icon (✉️) — instantly recognizable
- **No navigation away from this page for common tasks** — everything opens as sheets/dialogs

**Access**: `receptionist` (default landing), `admin`, `owner`

### 6.11 Trainer Management (≡ Staff Management)
- CRUD for trainers (same as Womaniya staff)
- Assign trainers to members
- Owner creates trainer/receptionist accounts (must_change_password on first login)
- Trainer sees only their assigned members
- Active/inactive toggle
- **Trainer schedule**: Optional shift timings (morning/evening) stored in profile or settings

### 6.12 Body Measurement Tracking
- **Log measurements**: Trainer (or admin) records member's body stats periodically
- **Fields**: Weight, chest, waist, hips, biceps, thighs, body fat % — all optional
- **Progress chart**: Recharts line graph on member detail page showing trends over time
- **Comparison**: "vs First Visit" and "vs Last Month" delta shown as badges (e.g., "−3.2 kg", "+2 cm biceps")
- **Measurement history table**: All entries with date, recorded_by, all values
- **Trainer view**: Trainers can log measurements for their assigned members

### 6.13 Trainer Attendance (≡ Womaniya Attendance — Copy 1:1)
- Clock in / clock out
- Manual entry with reason
- Edit with audit trail (edited_by, edit_reason)
- Soft delete with reason
- Attendance history with date range filter
- Auto-close stale attendance via cron

### 6.14 Daily Checklists (≡ Womaniya Checklists — Copy 1:1)
- Checklist templates with items
- Daily instance generation
- Multi-trainer completion tracking
- Drag-and-drop reorder (framer-motion)
- Recurrence settings

### 6.15 Financial Ledger (≡ Womaniya Finances — Adapted)
- **Income**: Auto-logged from membership payments
- **Expenses**: Manual entry with expense categories
- **Types**: membership_income, expense, adjustment, refund
- Date range filtering, search, export
- Summary cards: Total income, Total expenses, Net profit
- **Revenue goal**: Optional monthly target (stored in gym settings) → progress bar on dashboard

### 6.16 Equipment Inventory (Lightweight)
- Simple CRUD list of gym equipment
- Fields: Name, category, brand, purchase date, cost, status (working/needs repair/out of order)
- **Maintenance tracking**: Last maintenance date, next maintenance date, notes
- **Overdue maintenance alert**: Show on dashboard if any equipment is past its next_maintenance_date
- No complex features — just a checklist-style tracker

### 6.17 Promo Codes
- Create discount codes with: code string, discount type (% or flat), value, validity period, max uses
- Restrict to specific plans or minimum duration
- Track redemptions (times_used counter)
- Apply promo code during membership assignment → auto-calculate discounted price
- List active/expired promos in settings

### 6.18 Announcements
- Create announcements with title, body, priority (low/normal/urgent), visibility dates
- Pin important ones to show as banner on dashboard and reception desk
- Restrict visibility by role (e.g., show only to trainers)
- Auto-expire based on visible_until date
- Urgent announcements get a red banner treatment

### 6.19 Reports & Analytics
- **Membership analytics**: Active vs expired trend, popular plans, renewal rate, churn rate
- **Revenue reports**: Daily/weekly/monthly income, payment method breakdown, comparison with previous period
- **Member growth**: New members over time, net growth (new minus churned)
- **Expiry forecast**: Members expiring in next 7/14/30 days (downloadable list)
- **Trainer performance**: Assigned members count, measurement logs count, attendance regularity
- **Lead conversion**: Pipeline funnel, conversion rate, average time to convert, best source
- **Referral report**: Top referrers, total referrals, rewards distributed
- **Birthday calendar**: Monthly view of all member birthdays
- Charts via **Recharts**, CSV/Excel export via **xlsx**

### 6.20 Gmail Backup (Signature Feature)
- **Concept**: Like WhatsApp's "Back up to Google Drive" — gym owners can export their member data to their Gmail
- **Implementation via Supabase Edge Function**:
  1. Owner clicks "Backup Now" or sets up auto-backup schedule
  2. Edge function queries all members + memberships for that gym
  3. Generates CSV file (structured, importable into Excel/Google Sheets)
  4. Sends email via **Resend** (or Supabase's built-in email) with the file as attachment
  5. Logs backup in `gmail_backup_logs`
- **Backup types**: Members only, Payments only, Full export (members + memberships + payments)
- **Auto-backup**: Optional weekly/monthly schedule (stored in gym settings JSONB)
- **UI**: Prominent section in settings with: last backup date + time, backup history list, "Backup Now" CTA, auto-schedule toggle
- **Progress**: Show a progress indicator while backup is being generated + sent

### 6.21 Onboarding Wizard (First-Time Setup)
When a new gym is created (by superadmin), the owner's first login triggers a guided wizard:
1. **Welcome**: "Welcome to Gym Buddy! Let's set up your gym in 5 minutes."
2. **Gym Details**: Name, address, phone, timings (pre-filled from superadmin, editable)
3. **First Plan**: Create your first membership plan (pre-filled templates: "Monthly ₹1000", "Quarterly ₹2500", "Annual ₹8000")
4. **First Trainer**: Add your first trainer (or skip)
5. **First Member**: Add your first member (or skip)
6. **Done!**: "You're ready!" → Redirect to dashboard with confetti celebration
- Progress tracked in `onboarding_progress` table
- Can be dismissed and resumed later
- Dashboard shows "Complete your setup (3/5 done)" until finished

### 6.22 Contextual Teaching (Progressive Disclosure)
- First time visiting any page → subtle info banner at top:
  - Members page: "💡 Tip: Click a stats card to filter the table below"
  - Dashboard: "💡 Tip: The birthday card shows today's member birthdays"
  - Settings: "💡 Tip: Create WhatsApp message templates to send reminders faster"
- **Dismiss permanently**: "Got it" button → stored in localStorage (`dismissed_tips: { members: true, dashboard: true }`)
- **NOT a modal or overlay** — just an inline `bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm` bar
- Each tip has an icon + one sentence. Concise.

### 6.23 Settings (Expanded)
- **Gym Details tab**: Name, address, phone, email, opening/closing hours
- **Membership Plans tab**: CRUD with plan type, sort order, pricing, duration, freeze allowance, family options
- **Expense Categories tab**: CRUD with sort order
- **WhatsApp Templates tab**: Customize message templates for each category
- **Promo Codes tab**: Create/manage discount codes
- **Backup Settings tab**: Gmail backup config, auto-schedule, history
- **User Management tab**: Manage admin/trainer/receptionist accounts (owner only)
- **Revenue Goals tab**: Set monthly targets
- **Referral Rewards tab**: Configure reward rules (discount amount per referral)

### 6.24 Superadmin — Subscription & Gym Management
The superadmin panel manages all gyms and their subscription lifecycle:

**Gym List:**
- All gyms with: name, city, owner name, member count, subscription status badge, subscription expiry
- Filter by: subscription status (active/trial/expired/suspended), city
- Search by gym name or owner name

**Gym Detail:**
- Gym info + all staff accounts
- **Subscription controls**: Change status (active/trial/expired/suspended), set expiry date, add notes
- When a gym subscription is **expired/suspended**: All non-superadmin users of that gym see a "Your gym subscription has expired. Contact support." screen instead of the app. This is enforced via an auth check in the protected layout.
- **Quick stats**: Member count, active memberships, revenue this month

**Subscription Dashboard:**
- Total active gyms, trial gyms, expired gyms, revenue
- Gyms expiring this week (nudge list)
- Revenue per gym chart

**Implementation:** 
- Subscription status is checked in the `(protected)/layout.tsx` auth guard
- If `gym.subscription_status NOT IN ('active', 'trial')`, show a locked screen
- Superadmin can toggle this to immediately lock/unlock a gym

---

## 7. UX PHILOSOPHY — MAKING IT STAND OUT

### 7.1 Least Clicks to Complete Any Task

Every common action should be achievable in **3 taps or fewer** from the dashboard:

| Task | Path |
|------|------|
| Collect payment | Dashboard → "Pending Dues" card → tap member → [Collect Payment] |
| Renew membership | Dashboard → "Expiring" card → tap member → [Renew] |
| Add daily pass | Dashboard → [+ Daily Pass] → select/quick-add member → done |
| Send expiry reminder | Dashboard → "Expiring" card → WhatsApp icon → sent |
| Add new member | Dashboard → [+ New Member] → quick-add (name+phone) → done |
| Wish happy birthday | Dashboard → Birthday card → WhatsApp icon → sent |

**Rules:**
- Every list row has **inline action icons** (WhatsApp, edit, renew) — never hidden behind a menu
- The most common action on any page is the **biggest button** (primary gradient CTA)
- Destructive actions require ConfirmDialog but non-destructive ones are instant (optimistic UI)
- **Smart pre-fills**: When renewing, pre-fill the same plan. When recording payment, pre-fill the remaining amount.

### 7.2 Teaching Users Along the Way

- **Onboarding wizard** for first-time gym setup (Section 6.21)
- **Contextual tips** on first visit to each page (Section 6.22)
- **Empty states that educate**: When a page has no data, the empty state explains what this page is for AND shows a CTA to create the first item. E.g., "No members yet. Members are the people who train at your gym. Add your first member to get started." + [Add Member] button
- **Placeholder data labels**: Input placeholders that show realistic examples ("e.g., Rajesh Kumar", "e.g., 175.5")
- **Success celebrations**: Confetti or checkmark animation on milestone achievements (first member added, 100th member, first month completed)
- **FAQ page**: Organized by feature, searchable. Answers to "How do I freeze a membership?", "How does Gmail backup work?", etc.

### 7.3 Premium Feel — Not Just Functional

These interaction details elevate the app from "works" to "feels expensive":

| Detail | Implementation |
|--------|---------------|
| **Staggered list entrance** | Items fade in with 30-50ms offset per row on page load |
| **Count-up animation** | Stats numbers roll from 0 to value (requestAnimationFrame, no library) |
| **Skeleton crossfade** | Loading skeleton fades into real content, not hard-swap |
| **Gradient headers** | Every page has the signature gradient icon badge in the header |
| **Haptic button press** | `s.btnAnimation` (scale 105→95) on every interactive button |
| **Smooth page transitions** | Subtle fade between pages (framer-motion AnimatePresence) |
| **Backdrop blur dialogs** | Dialog overlay: `bg-black/60 backdrop-blur-sm` |
| **Pull-to-refresh** | On mobile, pull down to refresh data |
| **Status color language** | Consistent: green=active, red=expired, yellow=expiring, blue=renewed, purple=frozen |
| **Micro-copy everywhere** | Tooltips, helper text under inputs, format hints. Never make the user guess. |

### 7.4 Efficiency Architecture

- **Command Palette** (Ctrl+K / Cmd+K): Search members, navigate to any page, trigger actions ("add member", "collect payment") — power user accelerator
- **Keyboard shortcuts on data pages**: Arrow keys for pagination, Enter to open selected row, Escape to close dialogs
- **Batch operations**: Select multiple members → batch renew, batch send reminder, batch export
- **Smart search**: Type a phone number OR a name in the same search box. The app detects which it is.
- **URL state**: Filters, pagination, search term are reflected in the URL — shareable, bookmarkable, browser back works correctly
- **Offline-resilient**: Basic pages work without internet (cached), data operations gracefully degrade with "You're offline" toast

---

## 8. DESIGN SYSTEM — ADAPT FROM WOMANIYA

### Brand Identity Changes

| Token | Womaniya | Gym Buddy |
|-------|---------|-----------|
| `brand.name` | Womaniya | Gym Buddy |
| `brand.fullName` | Womaniya Dashboard | Gym Buddy Dashboard |
| `brand.shortName` | Womaniya | GymBuddy |
| `brand.description` | Point of Sale and Inventory Management System | Gym Membership Management System |
| `brand.logoLetter` | W | G |
| `billing.receiptHeader` | WOMANIYA | GYM BUDDY |
| `internal.idbName` | womaniya-dashboard | gym-buddy |
| `internal.apiAppName` | womaniya-dashboard | gym-buddy |

### Color System
- Keep the **exact same config-driven token architecture** (`appConfig.styles`, `const s = appConfig.styles`)
- Keep the **runtime palette switcher** (ThemeColorContext with 6 palettes)
- Default palette: could be **indigo** or **emerald** instead of ocean/teal — gym feel. Decide later, architecture stays the same.
- All the `s.primaryGradient`, `s.statsActive.*`, `s.rowTint.*`, `s.btnAnimation` tokens carry over unchanged.

### Stats Card Tokens — Re-map to Gym Domain

| Token | Gym Buddy Usage |
|-------|----------------|
| `s.statsActive.total` | Total Members |
| `s.statsActive.available` | Active Memberships (green) |
| `s.statsActive.sold` | Renewed this month (blue) |
| `s.statsActive.damaged` | Expired Memberships (red) |
| `s.statsActive.yellow` | Expiring Soon (amber/yellow) |
| `s.statsActive.purple` | Frozen Memberships (purple) |
| `s.statsActive.orange` | Pending Payments (orange) |

### Row Tint Tokens — Re-map

| Token | Gym Buddy Usage |
|-------|----------------|
| `s.rowTint.available` | Active membership (green) |
| `s.rowTint.sold` | Renewed (blue) |
| `s.rowTint.damaged` | Expired (red) |
| `s.rowTint.inProgress` | Expiring soon (yellow) |
| `s.rowTint.manual` | Frozen (purple) |

### Components to Copy 1:1 from Womaniya
- `StatsCardGrid` → same component, new data
- `DateRangeFilter` + `useDateFilter` hook
- `SortableHeader` + `useSortableTable` hook
- `useServerPagination` hook
- `useDebouncedSearch` hook
- `PaginationControls`
- `EmptyState`
- `ConfirmDialog`
- `LoadingTable` (skeleton)
- `ExportButton`
- `FilterChips`
- `CountUp` (animated numbers)
- `CommandPalette` (cmdk)
- `BrandLoader`
- `ThemePickerDialog`
- `SyncStatusIndicator` (repurposed for backup status)
- `TopBar` (re-branded)
- `BottomNav` (re-branded with gym-relevant icons)
- All shadcn/ui base components

### Pages to Recreate (adapted)
| Womaniya Page | Gym Buddy Equivalent |
|--------------|---------------------|
| Inventory | Members |
| Sales | Payments |
| Staff | Trainers |
| Attendance | Trainer Attendance (identical) |
| Checklists | Checklists (identical) |
| Finances | Finances (identical structure, different tx types) |
| Reports | Reports (membership-focused analytics) |
| Settings (shop details) | Settings (gym details) |
| Settings (categories) | Settings (membership plans) |
| Settings (sizes) | — not needed |
| Settings (expense categories) | Settings (expense categories — identical) |
| Settings (user management) | Settings (user management — identical) |
| QR Codes | — not needed |
| POS | — not needed (no point-of-sale) |
| Returns | — not needed |
| Superadmin | Superadmin (manage gyms instead of shops) |

---

## 9. ARCHITECTURAL PATTERNS TO REPLICATE

### Auth Flow (Identical to Womaniya)
1. Email/password via Supabase Auth
2. Profile fetch after login with 5s timeout + localStorage cache (24h TTL)
3. Role-based redirect: superadmin → /superadmin, owner/admin → /admin, **receptionist → /reception**, trainer → /trainer
4. `must_change_password` flag → force /change-password on first login
5. Subscription check: if `gym.subscription_status NOT IN ('active', 'trial')` → show locked screen for all non-superadmin users
6. AuthContext provides: `user, profile, loading, hasRole(), isAdmin, isTrainer, isReceptionist, isSuperadmin`

### Context Providers (Same wrapper order)
```tsx
<ThemeProvider>          {/* next-themes light/dark */}
  <ThemeColorProvider>   {/* runtime palette picker */}
    <AuthProvider>       {/* Supabase auth + profile */}
      {children}
      <Toaster />        {/* Sonner */}
    </AuthProvider>
  </ThemeColorProvider>
</ThemeProvider>
```

### Data Fetching Patterns
- **Server-side pagination**: `useServerPagination` + `.range(from, to)`
- **Server-side sorting**: `useSortableTable` + `.order(sortBy, { ascending })`
- **Server-side search**: `useDebouncedSearch` (400ms) + `.ilike()` / `.or()`
- **Date range filtering**: `useDateFilter` + `DateRangeFilter` component
- **Supabase error handling**: Check `result.error`, not try/catch (client doesn't throw)
- **Optimistic UI**: Visual update first, DB persist in background, revert on failure

### API Layer Structure
```
src/lib/api/
├── members.ts          -- Member CRUD, search, birthday queries
├── memberships.ts      -- Plan assignment, renewal, freeze, cancel
├── payments.ts         -- Payment recording, receipt generation
├── trainers.ts         -- Trainer CRUD
├── attendance.ts       -- Clock in/out (copy from Womaniya)
├── checklists.ts       -- Checklist operations (copy from Womaniya)
├── finances.ts         -- Financial transactions
├── leads.ts            -- Lead/enquiry pipeline CRUD
├── referrals.ts        -- Referral tracking and rewards
├── measurements.ts     -- Body measurement CRUD
├── equipment.ts        -- Equipment CRUD + maintenance
├── promos.ts           -- Promo code CRUD + validation
├── announcements.ts    -- Announcements CRUD
├── whatsapp.ts         -- Template CRUD + deep link generation
├── reports.ts          -- Analytics queries
├── backup.ts           -- Gmail backup trigger
└── superadmin.ts       -- Gym CRUD, cross-gym queries
```

### Service Worker / PWA
- Same network-first strategy for navigation
- Cache-first for static assets
- Skip Supabase API calls (let app handle)
- Offline fallback page
- **No offline data sync** (unlike Womaniya's IndexedDB POS cache — not needed for gym)

---

## 10. UI/UX RULES (from Design System Bible)

These rules are NON-NEGOTIABLE. Apply to every page:

1. **Optimistic UI** — user sees result instantly, DB persists in background
2. **No native dialogs** — never use `confirm()`, `alert()`, `prompt()`. Use `ConfirmDialog`
3. **No spinners-only** — use skeleton placeholders matching final layout shape
4. **Always-visible actions** — no hover-revealed buttons (touch devices)
5. **Server-side operations** — pagination, sorting, search happen on Supabase, not client
6. **Shared components first** — check shared/ before building custom
7. **Config-driven theming** — all colors via `appConfig.styles` tokens, zero hardcoded teal/brand classes
8. **Mobile-first** — every component starts as phone layout, scales up. PWA on tablets.
9. **`space-y-4 md:space-y-6`** page wrapper — never `container mx-auto p-6`
10. **Touch targets** — minimum 32px (h-8 w-8) for icon buttons, 40px (h-10) for inputs
11. **Button animations** — `s.btnAnimation` on CTAs, `s.btnAnimationSubtle` on cards
12. **Page headers** — back button + gradient icon badge + title + subtitle
13. **Stats cards** — interactive toggle filtering with `s.statsActive.*` tokens
14. **Toasts via Sonner** — `toast.success()`, `toast.error()`
15. **Dialogs** — `p-0 overflow-hidden` pattern, gradient header, scrollable body

---

## 11. IMPLEMENTATION ORDER

### Phase 0: Repository Transformation (Do FIRST)
1. Copy Womaniya repo → rename to `gym-buddy`
2. Global find-and-replace: `shop` → `gym`, `shop_id` → `gym_id`, `Shop` → `Gym`, `WOMANIYA` → `GYM BUDDY`, `Womaniya` → `Gym Buddy`, `womaniya` → `gym-buddy`
3. Update `appConfig.ts` brand section (name, logo letter, description, internal identifiers)
4. Delete all retail-specific code:
   - `src/components/pos/` (entire folder)
   - All QR code components and pages
   - All inventory/lot components and pages 
   - Sales, returns, sale_items pages and components
   - SyncContext.tsx (no offline POS needed)
   - QR/inventory/sales API files from `src/lib/api/`
5. Delete retail-specific migrations (QR, inventory, lots, sales, returns) — write new gym-specific migrations
6. Keep intact: all `src/components/shared/`, all `src/hooks/`, `src/components/ui/`, `AuthContext`, `ThemeColorContext`, `TopBar`, `BottomNav` (will be re-skinned), config structure, Tailwind config, eslint, tsconfig
7. Update `profiles` type: rename `staff` role to `trainer`, add `receptionist` role
8. Verify the app compiles with no errors after cleanup
9. Commit: "Phase 0: Clean skeleton — Womaniya → Gym Buddy"

### Phase 1: Foundation
10. New database migrations: gyms, profiles (updated), members, membership_plans, memberships, payments
11. RLS policies with `current_gym_id()` function
12. Additional migrations: leads, referrals, member_measurements, promo_codes, equipment, announcements, whatsapp_templates, onboarding_progress
13. Update AuthContext: role-based redirect (add receptionist → /reception)
14. Update TopBar + BottomNav for gym context (icons: Users, Dumbbell, CreditCard, BarChart)
15. Login page + change-password page (re-skin)
16. Onboarding wizard component

### Phase 2: Core Member & Membership Features
17. Member management (list, search, filter, CRUD) — default 25 items per page for ~400 member gyms
18. Member onboarding (multi-step form with quick-add toggle)
19. Member detail page (profile + tabs: membership, payments, measurements, referrals, family)
20. Membership plans management (settings tab, including daily/weekly/trial pass types + family options)
21. Family group management (create group, add members, relationship tags)
22. Membership assignment + renewal + freeze + cancel flows (with family discount calculation)
23. Payment recording + receipt generation (family receipts showing all members)
24. Pending dues view

### Phase 3: Smart Dashboard & Communication
25. Smart Dashboard (urgency cards, KPI stats, quick actions, revenue sparkline, revenue goal)
26. Birthday management (today's birthdays, birthday month, WhatsApp wish)
27. WhatsApp deep links + template system
28. Reception Desk mode (/reception) — THE primary screen, auto-focused search, 2-tap actions
29. Lead management (enquiry pipeline)
30. Referral system + rewards

### Phase 4: Operations (Copy from Womaniya)
31. Trainer management (CRUD + receptionist role)
32. Trainer attendance (copy from Womaniya staff attendance)
33. Daily checklists (copy from Womaniya)
34. Expense categories (settings)
35. Financial ledger (income from memberships + manual expenses)

### Phase 5: Analytics, Polish & Enterprise Features
36. Body measurement tracking + progress charts
37. Promo codes management
38. Equipment inventory + maintenance tracking
39. Announcements system
40. Reports page (membership analytics, revenue, growth, lead conversion, referral stats)
41. Gmail backup feature (Edge Function + UI)
42. Onboarding wizard flow
43. Contextual teaching tips (first-visit banners)
44. Command palette
45. FAQ page
46. PWA manifest + service worker (updated branding)
47. Final design system audit against checklist

### Phase 6: Superadmin & Multi-Tenant Management
48. Superadmin subscription dashboard (active/trial/expired gym counts, revenue)
49. Gym list with subscription status, filters, search
50. Gym detail page with subscription controls (status, expiry, lock/unlock)
51. Subscription enforcement in protected layout (expired gym → locked screen)
52. Superadmin gym creation + owner account setup

---

## 12. FILE STRUCTURE

```
gym-buddy/
├── next.config.ts
├── package.json
├── tsconfig.json
├── postcss.config.mjs
├── eslint.config.mjs
├── components.json              (shadcn config)
├── public/
│   ├── manifest.json
│   ├── sw.js
│   ├── offline.html
│   └── icons/
├── src/
│   ├── app/
│   │   ├── layout.tsx           (providers stack)
│   │   ├── page.tsx             (redirect hub)
│   │   ├── globals.css
│   │   ├── error.tsx
│   │   ├── not-found.tsx
│   │   ├── login/
│   │   ├── change-password/
│   │   └── (protected)/
│   │       ├── layout.tsx       (auth guard + nav)
│   │       ├── superadmin/
│   │       ├── admin/
│   │       │   ├── page.tsx     (smart dashboard)
│   │       │   ├── members/
│   │       │   ├── memberships/
│   │       │   ├── plans/
│   │       │   ├── trainers/
│   │       │   ├── attendance/
│   │       │   ├── checklists/
│   │       │   ├── finances/
│   │       │   ├── payments/
│   │       │   ├── leads/
│   │       │   ├── equipment/
│   │       │   ├── reports/
│   │       │   ├── backup/
│   │       │   └── settings/
│   │       ├── reception/       (reception desk speed screen)
│   │       ├── trainer/
│   │       ├── me/
│   │       ├── settings/
│   │       └── faqs/
│   ├── components/
│   │   ├── ui/                  (shadcn base)
│   │   ├── shared/              (reusable across roles)
│   │   ├── admin/               (admin-specific)
│   │   ├── reception/           (reception desk components)
│   │   ├── trainer/             (trainer-specific)
│   │   └── tablet/              (TopBar, BottomNav)
│   ├── context/
│   │   ├── AuthContext.tsx
│   │   └── ThemeColorContext.tsx
│   ├── hooks/
│   │   └── index.ts             (all custom hooks)
│   ├── lib/
│   │   ├── config/
│   │   │   └── app.config.ts
│   │   ├── api/                 (Supabase query functions)
│   │   ├── supabase/
│   │   │   ├── client.ts
│   │   │   └── server.ts
│   │   └── utils.ts
│   └── types/
│       ├── index.ts
│       └── database.types.ts    (Supabase generated)
└── supabase/
    ├── migrations/
    └── functions/               (Edge Functions for Gmail backup)
```

---

## 13. WORDPRESS INTEGRATION (Future Scope)

Each gym gets a free WordPress website (managed by the superadmin). The Gym Buddy app exposes data via Supabase REST API that WordPress can consume.

### Embeddable Data (via JavaScript snippet or WordPress plugin)

| Widget | Data Source | Display |
|--------|-------------|---------|
| **Membership Pricing** | `membership_plans` where `is_active = true` | Price cards with plan name, duration, price |
| **Our Trainers** | `profiles` where `role = 'trainer' AND is_active = true` | Name, initials avatar, specialization |
| **Active Members Badge** | `COUNT(*)` from `memberships` where `status = 'active'` | "500+ Active Members" trust badge |
| **Current Offers** | `promo_codes` where `is_active = true AND valid_until >= today` | Offer cards with discount details |
| **Enquiry Form** | POST to Supabase → inserts into `leads` table | Name, phone, interested plan dropdown |
| **Check My Membership** | Member enters phone → shows expiry date only | Simple lookup (read-only, minimal data exposure) |

### Implementation Approach
1. **Supabase REST API**: Each query is scoped by `gym_id` passed as a parameter
2. **Read-only API key**: A special anon key with SELECT-only RLS policies for public-facing data
3. **JavaScript embed snippet**: `<script src="https://gymbuddy.app/embed.js?gym=UUID"></script>` — gym owner copies into WordPress page
4. **Enquiry form POST**: Uses a Supabase Edge Function to validate and insert leads (with CAPTCHA/rate limiting)
5. **CORS**: Configured per gym (allow the gym's WordPress domain)

### WordPress Site Template
Each gym website includes:
- Hero section with gym name + tagline
- Pricing page (pulled from Gym Buddy)
- Trainers page
- Enquiry form
- Contact info + location map
- Social media links

**This creates a full ecosystem play**: Gym Buddy (management) + WordPress (marketing) = complete gym business package.

---

## 14. IMPORTANT NOTES

### Core Architecture Decisions
1. **This is a repo transformation, not a fresh build.** Start with Phase 0 (cleanup) before building new features.
2. **No SyncContext needed** — Unlike Womaniya, there's no offline POS or IndexedDB caching. Remove SyncContext entirely.
3. **No QR code anything** — No QR generation, scanning, prefixes, or related tables.
4. **No inventory/lots** — The "inventory" concept is replaced by members + memberships.
5. **No POS module** — No point-of-sale. Payments are recorded from the admin panel or reception desk.
6. **No member attendance tracking** — Unlike many gym apps, this app does NOT track daily member check-ins. This saves significant DB load. Only staff attendance is tracked.
7. **Copy Womaniya patterns aggressively** — Attendance, checklists, finances, settings, and user management are nearly identical. Don't reinvent.

### Data & Identity
8. **Text-only members** — No image uploads. Keep the DB lean. All member data is textual. Use initials avatars everywhere.
9. **Phone number as unique identifier** — Members are identified by phone number within a gym. Validate uniqueness on insert.
10. **Receipt numbers, not bill numbers** — Simpler naming for gym context.
11. **English only** — No i18n/l10n needed. Hardcode all strings in English.

### The Receptionist is the Primary User
12. **Receptionist ≠ Trainer** — These are different people. Receptionists handle front desk (memberships, payments, enquiries). Trainers work on the floor with members.
13. **Reception Desk (`/reception`) is THE primary screen** — The receptionist sits at a tablet/desktop all day. This page must be a speed machine: auto-focused search, inline actions, everything within 2 taps. This is where 80% of daily work happens.
14. **Design for tablet-first, desktop-compatible** — The reception desk is on a tablet at the counter. All touch targets must be large. Side-sheet dialogs, not centered modals.

### Family Memberships are First-Class
15. **Family/couple memberships are very common** — This isn't an edge case, it's a core flow. Family groups with relationship tags, family-enabled plans with automatic discount calculation, combined payment with individual membership tracking.
16. **One payment → multiple memberships** — When a family renews, one payment covers all members but each gets their own membership record for individual expiry/freeze tracking.

### Communication & Engagement
17. **WhatsApp is THE communication channel** — Use `wa.me` deep links. Zero cost, zero infrastructure. Works on every phone. Every member interaction should have a WhatsApp action.
18. **Gmail backup is a signature feature** — Polish the UX (progress indicator, last backup shown, backup history).

### Growth Features
19. **Lead management is a growth driver** — Most gyms lose walk-in enquiries. The pipeline view turns every enquiry into a potential member.
20. **Referrals drive organic growth** — Track who referred whom. Reward referrers. Display leaderboard. Gym owners love this.
21. **Daily/weekly passes create foot traffic** — Not every visitor wants a monthly plan. Passes reduce friction for casual gym-goers who may convert later.
22. **Measurements build retention** — When members see progress over time, they renew. Trainers logging measurements is a key engagement loop.

### Business Model
23. **Free to start, monthly SaaS later** — Superadmin controls gym subscriptions. Lock the app for non-paying gyms by checking `subscription_status` in the protected layout auth guard.
24. **Subscription enforcement is simple** — Superadmin sets status to `expired` or `suspended` → all gym users see "Subscription expired" locked screen. No complex billing system needed in Phase 1.
25. **First gym will have ~400 members** — Size queries and pagination defaults accordingly (25 items/page is fine).

### Dashboard & Analytics
26. **Smart Dashboard = owner's morning view** — The dashboard is for the owner checking from home. Make every number actionable. Include revenue goals with progress bars.
27. **Membership lifecycle is the core flow**: Onboard member → Assign plan → Track payments → Renew/Freeze/Cancel → Analytics.
28. **WordPress integration is the business moat** — Gym Buddy + Website = a complete package. The embed snippets and enquiry form create a lead pipeline from website to app.

---

*End of prompt. Begin implementation from Phase 0.*
