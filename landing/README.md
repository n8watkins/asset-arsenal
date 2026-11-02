# Asset Arsenal landing page

The concept page for Asset Arsenal's page skins, at https://assetarsenal.n8builds.dev.
The idea, the competition and the cost model are in [`../docs/SKINS_CONCEPT.md`](../docs/SKINS_CONCEPT.md); keep the copy in `lib/content.ts` in step with it.

- Fully static Next.js export (`output: "export"`), served by Cloudflare Workers static assets with no Worker script.
- The waitlist is on n8builds.dev: every "Join the waitlist" link goes to `https://n8builds.dev/upcoming?interest=asset-arsenal#asset-arsenal`.
- The skin demo in the hero (`components/SkinDemo.tsx`) is plain CSS; each skin is a block of CSS variables in `app/globals.css`.

## Run

```bash
npm install
npm run dev        # local dev server
npm run lint && npm run typecheck
npm run build      # writes out/
```

## Deploy

Log in once with `npx wrangler login`, then run `npm run deploy` (build, then `wrangler deploy`).
`wrangler.jsonc` attaches `assetarsenal.n8builds.dev` as a Workers custom domain, so Cloudflare creates and manages its DNS record.
The n8builds.dev zone injects the cookieless Cloudflare Web Analytics beacon at the edge; never add `no-transform` to `Cache-Control` in `public/_headers`, because that stops it.
Roll back with `npx wrangler rollback`; take it down with `npx wrangler delete asset-arsenal-landing`.
