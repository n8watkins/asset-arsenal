# Asset Arsenal — Web

Pack-based icon-asset website. Upload a design image → detect the icon system →
generate matching standalone icons → download the pack. This is the **website /
front-end** (marketing, auth, pricing, checkout, account). The generation
pipeline is **stubbed** behind the API — it returns mock manifests/icons so the
whole flow is clickable with zero secrets.

> Isolated project. It does **not** connect to the `asset-arsenal` pipeline repo.

## Stack

| Concern        | Choice                                      |
| -------------- | ------------------------------------------- |
| Framework/host | Next.js 16 (App Router, Turbopack) / Vercel |
| Auth           | Auth.js v5 + Google provider                |
| Database       | Turso (libSQL/SQLite) + Drizzle ORM         |
| Image storage  | Cloudflare R2 (S3 API, $0 egress)           |
| Payments       | Stripe Checkout (one-time credit packs)     |
| Analytics      | Vercel Analytics + GA4                      |

## Demo mode

With **no env vars set**, the app runs in demo mode: a mock user with 5 credits,
mock pipeline responses, and graceful "not configured" states for auth/Stripe/
storage. Every page renders; nothing crashes. Configure secrets (see
`.env.example`) to light up each feature — gated by `features.*` in `lib/env.ts`.

## Run

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # production build
```

## Pricing / credit model

**1 credit = 1 generated icon.** Pipeline overhead is baked into the pack price.
Source of truth: [`lib/pricing.ts`](lib/pricing.ts). Rationale + math:
[`docs/PRICING.md`](docs/PRICING.md).

## Layout

```
app/(marketing)/   landing, pricing, examples, legal             (public)
app/(app)/         dashboard, new run, runs, credits, settings    (auth-gated)
app/api/           auth, billing/checkout, stripe/webhook, uploads, runs, credits
lib/               pricing, credits ledger, db (Drizzle), auth, stripe, storage/r2
components/        ui (kit), marketing, app, seo, analytics
```

## Database

```bash
npx drizzle-kit push      # apply schema to Turso (needs TURSO_* env)
```

Schema: `lib/db/schema.ts` (Auth.js tables + credit ledger, runs, generated
icons, usage events).
