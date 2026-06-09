# Setup — what you need to make this work

Everything below maps to a var in `.env.example`. Locally you need **nothing** —
the app runs with a local SQLite file and a dev login. The lists marked
**Production** are what you provide to go live.

## TL;DR

| Service | Local dev | Production | Gives you |
| --- | --- | --- | --- |
| Database (Turso) | not needed (local file) | **required** | users, credits, runs |
| Auth secret | auto dev fallback | **required** | session signing |
| Google OAuth | not needed (dev login) | **required** | real sign-in |
| Stripe | optional | required to sell | credit purchases |
| Cloudflare R2 | optional | required for uploads | image storage |
| GA4 | optional | optional | analytics |

---

## 0. Run locally (zero setup)

```bash
npm install
npx drizzle-kit push      # creates local.db with the schema
npm run dev               # http://localhost:3000
```

On `/login` use **Dev Login** (any email, no password). It creates a real user,
grants the 5 signup credits, and logs you in. The dev login provider is **never**
registered in production.

---

## 1. Database — Turso (required for prod)

```bash
# install the CLI, then:
turso auth signup
turso db create asset-arsenal
turso db show --url asset-arsenal          # -> TURSO_DATABASE_URL
turso db tokens create asset-arsenal       # -> TURSO_AUTH_TOKEN
```

Set `TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN`, then apply the schema:

```bash
npx drizzle-kit push
```

Free tier is generous; no credit card.

## 2. Auth secret (required for prod)

```bash
npx auth secret          # prints AUTH_SECRET — put it in env
```

## 3. Google OAuth (required for prod — the only prod login)

1. [Google Cloud Console](https://console.cloud.google.com/) → create a project.
2. APIs & Services → OAuth consent screen → External → fill app name, support email.
3. Credentials → Create credentials → OAuth client ID → **Web application**.
4. Authorized redirect URIs:
   - `http://localhost:3000/api/auth/callback/google` (dev, optional)
   - `https://YOUR_DOMAIN/api/auth/callback/google` (prod)
5. Copy client id/secret → `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`.

## 4. Stripe (required to take money)

1. [Stripe dashboard](https://dashboard.stripe.com/) → Developers → API keys → `STRIPE_SECRET_KEY`.
2. Create **one-time** Products/Prices for each pack and copy the price IDs into
   `STRIPE_PRICE_MINI`, `STRIPE_PRICE_STANDARD`, `STRIPE_PRICE_BUILDER`,
   `STRIPE_PRICE_STUDIO`. (If unset, the app falls back to inline prices from
   `lib/pricing.ts`, so checkout still works for testing.)
3. Webhook: Developers → Webhooks → add endpoint `https://YOUR_DOMAIN/api/stripe/webhook`,
   events `checkout.session.completed` (+ `charge.refunded`). Copy the signing
   secret → `STRIPE_WEBHOOK_SECRET`.
4. Local webhook testing:
   ```bash
   stripe listen --forward-to localhost:3000/api/stripe/webhook
   ```
   Credits are granted by the webhook (idempotent on the Stripe event id), so the
   webhook must be reachable for balances to update after a purchase.

## 5. Cloudflare R2 (required for real image uploads)

1. Cloudflare dashboard → R2 → create bucket `asset-arsenal`.
2. R2 → Manage API Tokens → create token (Object Read & Write).
3. Fill `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`.
4. For serving images, enable a public bucket URL or custom domain → `R2_PUBLIC_BASE_URL`.
   ($0 egress — that's why R2 over S3/Vercel Blob.) Until set, the upload route
   returns a mock response so the flow still works.

## 6. Analytics (optional)

GA4 → create a property → copy the measurement id (`G-XXXX`) → `NEXT_PUBLIC_GA_ID`.
Vercel Analytics is automatic on Vercel.

## 7. Deploy (Vercel)

```bash
# push to GitHub, import in Vercel, then set all the env vars above in
# Project Settings → Environment Variables. Set NEXT_PUBLIC_SITE_URL to your domain.
```
Run `npx drizzle-kit push` once against the prod Turso DB.

---

## Still stubbed (by design — not blocking the above)

- **The generation pipeline** — `/api/runs/*` returns mock manifests + placeholder
  SVG icons. Wire to the real model when ready (you're building this).
- **ZIP export** — `/api/runs/[runId]/export` returns 501.
- **Transactional email** (receipts / "pack ready"), **admin dashboard**, and a
  per-edge **rate limiter** (current abuse caps are DB-backed: see `lib/limits.ts`).
