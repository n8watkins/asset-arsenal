# Asset Arsenal Web — Handoff

**Intended domain:** https://assetarsenal.app  
**Status: NOT deployed.** Local-only — see critical warning below.  
**Companion:** `asset-arsenal/backend` is the tools playground (separate repo/git).

---

## ⚠️ CRITICAL: This repo has no git remote

`asset-arsenal/web` is a **local-only git repo with no remote configured.**
It has never been pushed to GitHub. Before doing anything else in a new session,
decide where this lives and push it:

```bash
# Option A — new private repo on GitHub (recommended)
gh repo create n8watkins/asset-arsenal-web --private
git remote add origin https://github.com/n8watkins/asset-arsenal-web.git
git push -u origin main
git push -u origin harden-auth-abuse-guards

# Option B — push as a branch of n8watkins/asset-arsenal
# (confusing — not recommended since backend already lives there)
```

Current branch: `harden-auth-abuse-guards` (launch-ready work — see below).
`main` exists locally but is behind this branch.

---

## What this is

Full SaaS product. Users upload a design image; Asset Arsenal detects the icon
system, recreates the style, and generates individual downloadable icon packs.
Credit-based billing (Stripe), Google OAuth, cloud storage (Cloudflare R2).

**Stack:** Next.js, Auth.js v5 (Google OAuth), Turso/libSQL (Drizzle ORM),
Cloudflare R2 (image storage), Stripe (billing), Vercel Analytics.

---

## Branch state

### `harden-auth-abuse-guards` (current, launch-ready)
4 commits ahead of `main`. This is the version to deploy. Changes from main:
- Auth hardened: proper session handling, production-only Google OAuth
- Abuse guards: per-IP signup throttle, credit anti-farming cap
- Free signup grant: 3 credits on first `/app` load (`lib/signup-bonus.ts`)
- `lib/limits.ts`: centralized rate limiting
- Dev Login: works locally, never available in production
- `docs/SETUP.md`: step-by-step guide to obtain every production credential
- `docs/DEPLOYMENT.md`: full env var checklist with explanations

### `main`
Base scaffolding: marketing site, auth, Stripe, R2, credit system. Missing
the hardening work above.

**The branch has NOT been merged to main yet.**

---

## To deploy (read SETUP.md + DEPLOYMENT.md in full first)

Local dev works with zero setup:
```bash
npm install
npx drizzle-kit push   # creates local.db
npm run dev            # http://localhost:3000
# Use Dev Login on /login (any email, no password)
```

Production requires (in order):
1. `AUTH_SECRET` — `npx auth secret`
2. Google OAuth credentials (Cloud Console)
3. Turso database URL + auth token
4. Cloudflare R2 bucket + API credentials
5. Stripe publishable key + secret key + webhook secret
6. `NEXT_PUBLIC_SITE_URL=https://assetarsenal.app`

Full details in `docs/SETUP.md`. Full env var list in `docs/DEPLOYMENT.md`.

---

## App structure

```
app/
  (marketing)/       Marketing site: homepage, pricing, examples
  (app)/             Authenticated product: /app dashboard, runs, settings
  api/
    runs/            Run creation, generation, export
    billing/         Stripe checkout + customer portal
    uploads/         Image upload → R2
    credits/         Balance checks
  login/             Google OAuth + Dev Login (dev only)
lib/
  auth.ts            Auth.js config, session helpers, OAuth providers
  credits.ts         Credit deduction + balance
  limits.ts          Rate limiting (per-IP, per-user)
  signup-bonus.ts    3-credit grant on first app load
  db/                Drizzle schema + client (Turso in prod, SQLite locally)
  session.ts         Session token helpers
  env.ts             Zod-validated env vars
  pricing.ts         Credit pack definitions
  site.ts            SITE constants (name, URL, tagline)
docs/
  SETUP.md           How to get every production credential
  DEPLOYMENT.md      Full env var checklist
  PRICING.md         Credit pricing model
```

---

## Key decisions (do not re-litigate)

- **Auth**: Google OAuth only in production. Dev Login is a registered provider
  only when `NODE_ENV !== production`.
- **Storage**: Image bytes → Cloudflare R2. Turso holds metadata only.
- **Credits**: 3 free on signup (per-IP capped). Stripe for paid packs.
- **Abuse guard**: Per-IP throttle on signup + credit grant. In `lib/limits.ts`.
- **No demo mode**: removed. Dev Login replaces it locally.

---

## Relationship to asset-arsenal/backend

`asset-arsenal/backend` is the tools playground (Fable AI bench, icon pipeline,
sprite tool, experiments). It is a **separate git repo** pushed to
`n8watkins/asset-arsenal` on GitHub. The web and backend share the same product
vision but are independent codebases — no shared imports.

The sprite tooling in the backend will eventually surface in the web product
(and in Sprite Arsenal, the free standalone tool at sprite-bench.vercel.app).
