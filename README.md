# ShorTul — Short links. Faster journeys.

A production-ready URL shortener built on a Cloudflare-first architecture.

## Architecture

```
DATABASE (Supabase) = source of truth
CLOUDFLARE KV       = fast redirect cache
WORKER              = redirect engine
QUEUE/ASYNC         = click collection
CRON                = scheduled synchronization
NEXT.JS             = dashboard/UI
```

The redirect path **never** queries Supabase when the shortcode exists in KV. Redirects return in <50ms at the edge.

## Project Structure

```
shortul/
├── worker/                  # Cloudflare Worker (redirect engine + API + cron + queue)
│   ├── wrangler.toml
│   └── src/
│       ├── index.js         # entry — routing
│       ├── redirect.js      # KV-first redirect logic
│       ├── shortcode.js     # generation + validation
│       ├── security.js      # URL validation, reserved routes, rate limit
│       ├── cron.js          # morning preload + evening sync
│       ├── queue.js         # click-event producer
│       ├── queue-consumer.js# click-event consumer / aggregator
│       ├── api.js           # link management API
│       ├── db.js            # Supabase + D1 helpers
│       └── 404.js           # custom 404 page
├── dashboard/               # Next.js frontend
│   ├── package.json
│   ├── next.config.mjs
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── jsconfig.json
│   ├── .env.local.example
│   └── src/
│       ├── app/
│       │   ├── layout.jsx
│       │   ├── globals.css
│       │   ├── page.jsx                  # homepage
│       │   ├── features/page.jsx
│       │   ├── analytics/page.jsx
│       │   ├── custom-links/page.jsx
│       │   ├── link-shortener/page.jsx
│       │   ├── about/page.jsx
│       │   ├── pricing/page.jsx
│       │   ├── privacy/page.jsx
│       │   ├── terms/page.jsx
│       │   ├── sitemap.js
│       │   ├── robots.js
│       │   ├── login/page.jsx
│       │   ├── signup/page.jsx
│       │   ├── dashboard/
│       │   │   ├── layout.jsx
│       │   │   ├── page.jsx
│       │   │   ├── links/page.jsx
│       │   │   ├── analytics/page.jsx
│       │   │   ├── profile/page.jsx
│       │   │   └── settings/page.jsx
│       │   └── admin/page.jsx
│       ├── lib/
│       │   ├── supabase.js
│       │   └── api.js
│       └── components/
│           ├── Navbar.jsx
│           ├── Footer.jsx
│           └── ShortenerForm.jsx
├── schema.sql               # Supabase / D1 schema
├── .env.example
└── README.md
```

## Cloudflare Resources (create manually)

| Resource | Type | Purpose |
|----------|------|---------|
| `SHORTUL_KV` | KV Namespace | shortcode → destination cache |
| `shortul_clicks` | Queue | async click events |
| `shortul_clicks_dlq` | Queue (DLQ) | dead-letter queue for failed events |
| `shortul_db` | D1 Database | click aggregation / batch buffer |
| Cron Triggers | `0 6 * * *` (morning preload), `0 22 * * *` (evening sync) | scheduled jobs |

Create them in the dashboard or via Wrangler:

```bash
npx wrangler kv namespace create SHORTUL_KV
npx wrangler queues queue create shortul_clicks
npx wrangler queues queue create shortul_clicks_dlq
npx wrangler d1 create shortul_db
```

Then update `worker/wrangler.toml` with the returned IDs.

## Environment Variables

| Variable | Where | Purpose |
|----------|-------|---------|
| `SUPABASE_URL` | Worker + Next.js | Supabase project URL |
| `SUPABASE_ANON_KEY` | Worker + Next.js | public anon key (safe for browser) |
| `SUPABASE_SERVICE_ROLE_KEY` | **Worker only** | server-side DB access (NEVER in frontend) |
| `ADMIN_SECRET` | Worker | admin API auth |
| `SITE_URL` | Worker | canonical domain (e.g. https://shortul.app) |
| `ORIGIN_URL` | Worker | Next.js origin for reserved-route fallback |

## Deployment Steps

### 1. Database (Supabase)
```bash
# Run schema.sql in Supabase SQL Editor
```

### 2. Worker
```bash
cd worker
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
npx wrangler secret put ADMIN_SECRET
npx wrangler d1 execute shortul_db --file=./d1-schema.sql
npx wrangler deploy
```

### 3. Dashboard
```bash
cd dashboard
cp .env.local.example .env.local   # fill in
npm install
npm run build
# Deploy to Cloudflare Pages or Vercel
```

## How the Morning Cache Preload Works

Cron fires at 06:00 UTC daily. The Worker:
1. Queries Supabase for all `is_active = true` links (and non-expired).
2. Writes each `shortcode → {destination_url, expires_at, is_active, password_hash}` to KV.
3. Deletes KV keys for expired/inactive links.
4. Runs entirely in the background — no user is affected.

## How Evening Click Synchronization Works

Cron fires at 22:00 UTC. The Worker:
1. Reads aggregated click stats from D1 (`click_buffer` table).
2. Batch-upserts into Supabase `click_statistics` and `daily_statistics`.
3. Marks D1 buffer rows as synced.
4. If Supabase is down, rows stay unsynced and retry on next run — no clicks lost.

## How Cache Invalidation Works

On any link mutation (create/edit/delete/disable/expire):
- The API endpoint immediately writes or deletes the KV key.
- Guest links get a TTL matching their expiry.
- No stale destinations survive longer than the KV write propagation (~60s globally).

## How to Test Redirect Performance

```bash
# Warm the cache (first request populates KV)
curl -sI https://shortul.app/abc123

# Measure cached redirect (should be <50ms TTFB)
curl -w "@curl-format.txt" -sI https://shortul.app/abc123

# curl-format.txt:
# time_namelookup: %{time_namelookup}\n
# time_connect: %{time_connect}\n
# time_starttransfer: %{time_starttransfer}\n
# time_total: %{time_total}\n
```

Load test:
```bash
npx wrangler tail shortul-worker   # watch live
# Use k6 or ab:
ab -n 10000 -c 50 https://shortul.app/abc123
```