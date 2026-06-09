# Deployment & API Keys — what I need from you

Everything you have to provide to take this live, in order. Local dev needs
**none** of it (SQLite file + Dev Login). This is the production list.

For the step-by-step "how to get each one," see [`SETUP.md`](./SETUP.md). This
doc is the **checklist**: every secret, where it goes, and what breaks without it.

---

## The full env var list

Every var the app reads, grouped by what it unlocks. `NEXT_PUBLIC_*` are exposed
to the browser (safe to be public); everything else is **server-only — never
commit these**.

### 1. Site — required

| Var | Example | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | `https://assetarsenal.com` | Your live domain. Used for sitemap, OG tags, canonical URLs, OAuth callback. |

### 2. Auth — required (no login without it)

| Var | How | Notes |
| --- | --- | --- |
| `AUTH_SECRET` | `npx auth secret` | Signs session JWTs. Generate once, keep stable. |
| `AUTH_GOOGLE_ID` | Google Cloud Console | OAuth client ID. |
| `AUTH_GOOGLE_SECRET` | Google Cloud Console | OAuth client secret. |

> In production, **Google is the only way to sign in** (the Dev Login provider is
> never registered when `NODE_ENV=production`). No Google creds → no one can log in.

### 3. Database — required (Turso / libSQL)

| Var | How | Notes |
| --- | --- | --- |
| `TURSO_DATABASE_URL` | `turso db show --url asset-arsenal` | Users, credits, runs. |
| `TURSO_AUTH_TOKEN` | `turso db tokens create asset-arsenal` | DB access token. |

> Without a DB the app can't store users or credits at all. **Required.**

### 4. Stripe — required to take money

| Var | How | Notes |
| --- | --- | --- |
| `STRIPE_SECRET_KEY` | Stripe → Developers → API keys | Server key. **Secret.** |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | same page | Public, browser-side. |
| `STRIPE_WEBHOOK_SECRET` | Stripe → Webhooks → your endpoint | Verifies webhook signatures. **Credits are granted by the webhook**, so this must be set or balances never update after purchase. |
| `STRIPE_PRICE_MINI` | one-time Price ID | Optional — falls back to inline price from `lib/pricing.ts`. |
| `STRIPE_PRICE_STANDARD` | one-time Price ID | Optional. |
| `STRIPE_PRICE_BUILDER` | one-time Price ID | Optional. |
| `STRIPE_PRICE_STUDIO` | one-time Price ID | Optional. |

> Webhook endpoint to register: `https://YOUR_DOMAIN/api/stripe/webhook`,
> events `checkout.session.completed` + `charge.refunded`.

### 5. Cloudflare R2 — required for real image uploads

| Var | How | Notes |
| --- | --- | --- |
| `R2_ACCOUNT_ID` | Cloudflare → R2 | |
| `R2_ACCESS_KEY_ID` | R2 → Manage API Tokens | Object Read & Write. **Secret.** |
| `R2_SECRET_ACCESS_KEY` | R2 → Manage API Tokens | **Secret.** |
| `R2_BUCKET` | bucket name | Defaults to `asset-arsenal`. |
| `R2_PUBLIC_BASE_URL` | public bucket / custom domain | URL images are served from ($0 egress). |

> Until set, the upload route returns a mock response so the flow still works.

### 6. Analytics — optional

| Var | How | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_GA_ID` | GA4 → measurement id (`G-XXXX`) | Optional. Vercel Analytics is automatic. |

---

## Priority order (what unblocks what)

1. **`AUTH_SECRET` + Google OAuth + Turso** → app is usable, people can log in and
   get their 3 free credits. *(Minimum viable deploy.)*
2. **Stripe** → people can buy credit packs.
3. **Cloudflare R2** → real uploads instead of the mock.
4. **GA4** → analytics (skippable at launch).

You can ship with just group 1, sell with 1+2.

---

## Deploy on Vercel — steps

1. Push this repo to GitHub.
2. Vercel → **New Project** → import the repo (framework auto-detected as Next.js).
3. **Project Settings → Environment Variables** → paste every var above for the
   **Production** environment (and Preview if you want preview deploys to work).
4. Apply the schema to the prod DB **once**:
   ```bash
   TURSO_DATABASE_URL=... TURSO_AUTH_TOKEN=... npx drizzle-kit push
   ```
5. Deploy. Then in Stripe, register the webhook against the live URL and paste
   `STRIPE_WEBHOOK_SECRET` back into Vercel.
6. In Google Cloud Console, add the production redirect URI:
   `https://YOUR_DOMAIN/api/auth/callback/google`.
7. Point your domain at Vercel (Project Settings → Domains) and set
   `NEXT_PUBLIC_SITE_URL` to it.

---

## Security reminders

- **Server secrets** (`AUTH_SECRET`, `*_SECRET*`, `*_TOKEN`, `STRIPE_SECRET_KEY`,
  `R2_*`, Turso) live only in Vercel env vars — never in the repo, never in a
  `NEXT_PUBLIC_` var.
- Rotate any key that was ever pasted into a chat, screenshot, or commit.
- `.env.example` lists the names only — your real `.env` is gitignored.

---

## Not needed from you (stubbed / handled in code)

- **Generation pipeline** — `/api/runs/*` returns mock manifests + placeholder SVGs
  (you're building the real one).
- **ZIP export** — `/api/runs/[runId]/export` returns 501.
- **Email receipts**, **admin dashboard**, **per-edge rate limiter** — deferred.
