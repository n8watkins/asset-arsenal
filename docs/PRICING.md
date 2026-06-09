# Pricing & Credit Math

Single source of truth lives in [`lib/pricing.ts`](../lib/pricing.ts). This doc
explains the model; the code is what ships. Keep them in sync.

## The one rule

> **1 credit = 1 generated icon.**

That's the whole model. Users think in icons, not API calls — so we bill in
icons. Analysis, the collection image, and prompt composition are folded into
the pack price. They're our cost, not a line item the user sees.

This avoids the trap the original PRD fell into: charging a credit cost to every
pipeline step (analyze 5, collection 8, prompts 3+1, icon 2) created ~17 credits
of fixed overhead **before a single icon existed**, and the cheap tiers didn't
grant enough to cover it — the Free and Mini packs literally couldn't finish the
runs they advertised.

## Packs

| Pack          | Price | Credits (= icons) | Price / icon |
| ------------- | ----- | ----------------- | ------------ |
| Free Preview  | $0    | 3                 | —            |
| Mini Pack     | $5    | 10                | $0.50        |
| Standard Pack | $9    | 25                | $0.36        |
| Builder Pack  | $19   | 75                | $0.25        |
| Studio Pack   | $49   | 250               | $0.20        |

Clean volume-discount curve. Buy once, keep your credits, spend them when you
need assets. People can do the per-icon math themselves — we just show the
price and the credit count.

## Unit economics (internal only — never shown to users)

Raw AI cost per run ≈ `fixed pipeline cost + (per-icon cost × icons)`:

- fixed pipeline cost ≈ **$0.058** (analyze + collection image + prompts)
- per-icon cost ≈ **$0.011**

We apply a **2.5× safety multiplier** to cover retries, failed generations,
reference-image input costs, storage, and cost drift. See `COST_MODEL` and
`estimateRunCostUsd()` in `lib/pricing.ts`.

Sanity check on the primary offer (Standard, $9, 25 icons):

```
raw   = 0.058 + 0.011 × 25      = $0.333
safe  = 0.333 × 2.5             = $0.833
stripe fee (~2.9% + $0.30)      ≈ $0.56
gross ≈ 9.00 − 0.833 − 0.56     ≈ $7.60  (healthy)
```

### The one edge case to watch

"1 credit = 1 icon" means a Studio user could upload 250 _separate_ images and
make us eat the per-run fixed cost 250×. Worst case ≈ $43 cost on $49 revenue.
Realistically people run ~10–25 icons per upload, so the fixed cost amortizes.
If abuse shows up, add a small "open a run" charge (~2–3 credits per new upload);
icons stay 1 credit each. Headline stays simple. Not built yet — guard only if
needed.

## Free credits & expiry

- **Purchased credits:** do not expire (or 12 months — TBD).
- **Free / signup credits:** new accounts get `SIGNUP_FREE_CREDITS` (3), granted
  on first app load via `ensureSignupBonus()`. Anti-farming: idempotent per user,
  and in production capped at `MAX_FREE_GRANTS_PER_IP` (3) grants per IP / 24h, so
  one machine can't mint unlimited free accounts. Consider expiring after 14–30 days.
- **Refunds:** credits are refunded only for system/API failures. User-disliked
  outputs can be regenerated, which costs credits.
