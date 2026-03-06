# Womaniya Dashboard - Point of Sale & Inventory System

A production-ready PWA for clothing retail management, built with Next.js 14, TypeScript, Supabase, and optimized for tablet use.

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

Visit http://localhost:3000

## 📚 Documentation

- **[ACTION_PLAN.md](ACTION_PLAN.md)** - Current priorities and next steps
- **[UPDATED_REQUIREMENTS.md](UPDATED_REQUIREMENTS.md)** - Complete project requirements
- **[PROJECT_ANALYSIS_AND_ROADMAP.md](PROJECT_ANALYSIS_AND_ROADMAP.md)** - Comprehensive analysis & roadmap
- **[SUPABASE_SETUP_GUIDE.md](SUPABASE_SETUP_GUIDE.md)** - Database setup instructions
- **[QUICK_START.md](QUICK_START.md)** - Developer onboarding guide
- **[debug_database.sql](debug_database.sql)** - Database troubleshooting queries

## ⚡ Current Status

**Core Features:**
- ✅ Authentication & role-based access (admin, staff)
- ✅ Offline-first POS with QR scanning
- ✅ IndexedDB sync engine
- ✅ Cart management with discount tracking
- ✅ PWA manifest configured
- ⚠️ Service Worker (in progress)
- ⚠️ Admin pages (in progress)

**Tech Stack:**
- Next.js 14 (App Router, Static Export)
- TypeScript
- Supabase (Postgres + Auth + Edge Functions)
- shadcn/ui + Tailwind CSS
- IndexedDB (idb)
- html5-qrcode

## 🔧 Environment Setup

Create `.env.local`:
```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

## 🐛 Troubleshooting

### Login not working?
1. Check if Supabase project is paused (restore it)
2. Verify user has a profile in `profiles` table
3. Run queries from `debug_database.sql` in Supabase SQL Editor
4. Check browser console for errors

See [ACTION_PLAN.md](ACTION_PLAN.md) for detailed troubleshooting.

## 📦 Deployment

```bash
# Build static export
npm run build

# Deploy to Firebase Hosting
firebase deploy

# Deploy Supabase Edge Functions
npx supabase functions deploy complete-sale
npx supabase functions deploy add-stock-lot
```

## 🏗️ Project Structure

```
src/
├── app/                   # Next.js pages
│   ├── (protected)/       # Auth-protected routes
│   │   ├── pos/          # Point of Sale
│   │   ├── admin/        # Admin dashboard
│   │   └── me/           # Staff features
│   └── login/            # Login page
├── components/
│   ├── pos/              # POS components
│   ├── shared/           # Reusable components
│   ├── tablet/           # Navigation (TopBar, BottomNav)
│   └── ui/               # shadcn/ui components
├── context/              # React Context providers
├── hooks/                # Custom hooks
├── lib/                  # Utilities & API
│   ├── api/             # API functions
│   └── offline/         # IndexedDB wrapper
└── types/               # TypeScript types
```

## 👥 Contributing

This is a private project for Womaniya Airoli.

## 📄 License

Proprietary
