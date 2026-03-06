# Deployment & Runtime

> Environment variables, build configuration, local vs production differences, and Supabase setup.

---

## Overview

Womaniya Dashboard is deployed as a Next.js application with a Supabase backend. The frontend can be hosted on Vercel, Netlify, or any Node.js-compatible host. The backend (Supabase) is managed separately.

---

## Environment Variables

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | `https://xxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public API key | `eyJhbGciOiJIUzI1...` |

### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Runtime environment | `development` / `production` |
| `NEXT_TELEMETRY_DISABLED` | Disable Next.js telemetry | `1` |

### Environment Files

```
.env.local        # Local development (gitignored)
.env.example      # Template for new developers (committed)
```

**`.env.local` Template:**
```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

---

## Local Development Setup

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Supabase account with project

### Quick Start

```bash
# 1. Clone repository
git clone <repo-url>
cd womaniya-dashboard

# 2. Install dependencies
npm install

# 3. Set up environment
cp .env.example .env.local
# Edit .env.local with your Supabase credentials

# 4. Start development server
npm run dev
```

**Development URL:** `http://localhost:3000`

### Available Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start dev server with hot reload |
| `npm run build` | Create production build |
| `npm run start` | Run production build locally |
| `npm run lint` | Run ESLint |

---

## Supabase Configuration

### Project Setup

1. **Create Project** at [supabase.com](https://supabase.com)
2. **Get credentials** from Project Settings → API:
   - Project URL
   - `anon` public key
3. **Configure Authentication:**
   - Email/Password enabled
   - Disable email confirmation (for easier testing)

### Database Schema

The database schema is defined in migration files:

```
supabase/migrations/
├── 20241222_bill_number_function.sql
├── 20241222_expense_categories.sql
├── 20241222_financial_transactions_rls.sql
├── 20241222_qr_codes_rls.sql
└── ...
```

**Apply Migrations:**
```bash
# Using Supabase CLI
supabase db push

# Or manually execute SQL in Supabase Dashboard → SQL Editor
```

### Edge Functions Deployment

```bash
# Install Supabase CLI
npm install -g supabase

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref your-project-ref

# Deploy all functions
supabase functions deploy

# Deploy specific function
supabase functions deploy complete-sale
```

**Function URLs:**
```
https://<project-ref>.supabase.co/functions/v1/complete-sale
https://<project-ref>.supabase.co/functions/v1/add-stock-lot
https://<project-ref>.supabase.co/functions/v1/create-daily-checklists
```

### Row Level Security (RLS)

⚠️ **Critical:** RLS must be enabled on all tables.

**Verify RLS is enabled:**
```sql
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public';
```

**Example RLS Policy:**
```sql
-- Enable RLS
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;

-- Policy: Users see their shop's items
CREATE POLICY "Users see own shop items"
ON inventory_items FOR SELECT
USING (
  shop_id = (SELECT shop_id FROM profiles WHERE id = auth.uid())
);
```

---

## Production Deployment

### Vercel Deployment

1. **Connect Repository:**
   - Import project from GitHub
   - Framework Preset: Next.js

2. **Configure Environment:**
   - Add `NEXT_PUBLIC_SUPABASE_URL`
   - Add `NEXT_PUBLIC_SUPABASE_ANON_KEY`

3. **Build Settings:**
   ```
   Build Command: npm run build
   Output Directory: .next
   Install Command: npm install
   ```

4. **Deploy:**
   - Automatic on push to main branch
   - Preview deployments for PRs

### Manual Deployment (Node.js Host)

```bash
# Build
npm run build

# Start production server
npm run start

# Or use PM2 for process management
pm2 start npm --name "womaniya" -- start
```

### Docker Deployment

```dockerfile
# Dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
```

```bash
# Build and run
docker build -t womaniya-dashboard .
docker run -p 3000:3000 \
  -e NEXT_PUBLIC_SUPABASE_URL=... \
  -e NEXT_PUBLIC_SUPABASE_ANON_KEY=... \
  womaniya-dashboard
```

---

## Local vs Production Differences

| Aspect | Local | Production |
|--------|-------|------------|
| **Build** | Dev mode (hot reload) | Optimized bundle |
| **Source Maps** | Enabled | Disabled (or external) |
| **Error Handling** | Detailed stack traces | Generic messages |
| **Caching** | Minimal | Aggressive |
| **HTTPS** | HTTP (localhost) | HTTPS required |
| **Database** | Can use same Supabase | Same Supabase |

### Environment Detection

```typescript
// Check environment
const isDev = process.env.NODE_ENV === 'development';

// Conditional logging
if (isDev) {
  console.log('Debug:', data);
}
```

---

## Supabase Edge Function Environment

### Local Development

```bash
# Start local Supabase
supabase start

# Serve functions locally
supabase functions serve

# Function will be available at:
# http://localhost:54321/functions/v1/function-name
```

### Production Environment

Edge Functions automatically have:

| Variable | Source |
|----------|--------|
| `SUPABASE_URL` | Auto-injected |
| `SUPABASE_SERVICE_ROLE_KEY` | Auto-injected |
| `SUPABASE_ANON_KEY` | Auto-injected |

**Access in function:**
```typescript
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
```

### Function Secrets

For additional secrets:

```bash
# Set a secret
supabase secrets set MY_SECRET=value

# Access in function
const mySecret = Deno.env.get('MY_SECRET');
```

---

## Build Configuration

### Next.js Config

**`next.config.ts`:**
```typescript
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Enable if needed
  experimental: {
    // Turbopack for dev (faster)
    // turbo: true
  },
  
  // Image optimization
  images: {
    domains: ['your-domain.com'],
  },
  
  // Environment variables validation could go here
};

export default nextConfig;
```

### TypeScript Config

**`tsconfig.json`:**
```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "strict": true,
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

### Tailwind Config

**`tailwind.config.ts`:**
- Uses Shadcn UI preset
- Custom colors for brand (teal/cyan theme)
- Dark mode support via `class` strategy

---

## PWA Configuration

### Manifest

**`public/manifest.json`:**
```json
{
  "name": "Womaniya Dashboard",
  "short_name": "Womaniya",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#0d9488",
  "theme_color": "#0d9488",
  "icons": [...]
}
```

### Service Worker

**Status:** Partially implemented

For full offline support, add service worker:
```javascript
// public/sw.js
self.addEventListener('fetch', (event) => {
  // Cache-first strategy for static assets
  // Network-first for API calls
});
```

---

## Database Type Generation

After schema changes:

```bash
# Generate TypeScript types from Supabase schema
supabase gen types typescript --linked > src/types/database.types.ts

# Or specify project ref
supabase gen types typescript --project-id your-ref > src/types/database.types.ts
```

This ensures `src/types/database.types.ts` stays in sync with the database.

---

## Health Checks

### Application Health

```typescript
// Could add an API route: /api/health
export async function GET() {
  return Response.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version,
  });
}
```

### Supabase Health

```typescript
// Check database connectivity
const { data, error } = await supabase.from('shops').select('id').limit(1);
const dbHealthy = !error;

// Check Edge Functions
const { data, error } = await supabase.functions.invoke('health-check');
const functionsHealthy = !error;
```

---

## Monitoring & Logging

### Client-Side

- `console.error()` for error logging
- `toast` notifications for user feedback
- Browser DevTools for debugging

### Supabase Dashboard

- **Auth:** User management, sessions
- **Database:** Query performance, RLS violations
- **Functions:** Invocation logs, errors
- **Storage:** File access (if used)

### Production Logging

Consider adding:
- Sentry for error tracking
- LogRocket for session replay
- Analytics for usage patterns

---

## Security Checklist

### Before Production

- [ ] RLS enabled on all tables
- [ ] Anon key only (no service key in frontend)
- [ ] HTTPS enforced
- [ ] Environment variables not in code
- [ ] No console.log with sensitive data
- [ ] Session expiry configured appropriately

### Supabase Security

- [ ] Email confirmation enabled (production)
- [ ] Rate limiting configured
- [ ] Audit logs enabled
- [ ] API rate limits set
- [ ] CORS configured properly

---

## Troubleshooting

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| "Invalid API key" | Wrong ANON_KEY | Check .env.local |
| "RLS policy violation" | Missing policy | Add RLS policy |
| Edge Function 500 | Runtime error | Check function logs |
| Build fails | Type errors | Fix TypeScript errors |
| Offline not working | IndexedDB blocked | Check browser settings |

### Debug Commands

```bash
# Clear Next.js cache
rm -rf .next

# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Check Supabase connection
npx supabase status
```

---

## Quick Reference

| Task | Command/Location |
|------|------------------|
| Start dev server | `npm run dev` |
| Build for production | `npm run build` |
| Deploy Edge Functions | `supabase functions deploy` |
| Generate types | `supabase gen types typescript` |
| View function logs | Supabase Dashboard → Functions |
| Check RLS policies | Supabase Dashboard → Authentication → Policies |
