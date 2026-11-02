# Skins: the concept, the competition and the cost

Written 2026-11-02 from the owner's description of where Asset Arsenal should go.
The landing page in `landing/` (assetarsenal.n8builds.dev) is the public version of this.

## The idea in the owner's words, tightened

Take a real web page (a dashboard, a suggestion box) and give it a skin, the way a game gives a weapon a skin.
The skin can sit close to the brand ("more like my brand than a generic green page for a green brand") or go far (high fantasy, sci-fi).
Some sites could even offer several skins and let their users pick.

The flow:

1. **Input**: a screenshot or URL of the page, plus the brand's own material (logo, colors, a few images it already uses).
2. **Reimagine**: an image model paints the whole page in the new style. A few variants; the owner keeps one.
3. **Break down**: a vision pass finds every asset in that concept (header art, card frames, buttons, icons, dividers, background) with boxes.
4. **Build each asset**: each one is generated again on its own, zoomed in, full size and transparent, using the concept and its crop as reference.
5. **Workbench**: box the keepers, reject the misses, retry a single piece, lock the style; see the cost before each run.
6. **Output**: a skin pack (assets at 1x and 2x, named by where they go, plus a CSS-variables theme file) and a preview of the assets placed back on the page.

It is not about SVG first and not about favicons: it is about art a page can actually use.

## What already exists in this repo

Most of the hard machinery is already here in the Fable bench, for icons instead of pages:

| Skin step | Already built (Fable and the benches) |
| --- | --- |
| Reimagine | The "collection image" step: one generated sheet that anchors the style (V1, Fable sheets). |
| Break down | `locate_icons`: one Gemini call returns boxes for every item on a sheet; canvas crops. |
| Build each asset | Finals generated per item with the sheet and the crop as reference images. |
| Workbench | Per-cell refine and regenerate, approved and superseded sheets, hover-to-identify, cost meters in `/usage`. |
| Cheap path | V3: many items in one grid image, sliced locally (14x cheaper than one call per item). |

The new parts are the page-shaped input, the asset taxonomy for pages (frames that stretch, button states, tiling backgrounds), the theme file and the preview.

## Cost per skin (model spend)

Prices from public trackers in November 2026; they move fast, so treat them as ranges.

| Step | Calls | Rough cost |
| --- | --- | --- |
| Reimagine the page | 3 to 4 full-page concepts, high quality (GPT Image or Nano Banana Pro class, about $0.13 to $0.25 each) | $0.40 to $1.00 |
| Break down | 1 vision call with boxes | under $0.01 |
| Build assets | about 12 assets at medium quality (about $0.04 each), plus about 50% retries | $0.50 to $0.75 |
| Small icons | one grid image, sliced locally (the V3 trick) | about $0.05 |
| Background removal and upscaling | per asset | about $0.10 |
| **Total** | | **about $1 to $2, up to $3 with heavy retries** |

Pricing options that leave room: $9 to $19 per skin pack, or $15 to $29 a month with credits, and bring-your-own-key for self-hosters.

## Competition

| Tool | What it does well | Why it isn't this |
| --- | --- | --- |
| ChatGPT / Gemini (Nano Banana) by hand | Reimagining a screenshot in a style is already good, and cheap. | One flat picture; turning it into transparent, full-size, consistent assets is manual. This DIY path is the real competitor. |
| Lovart | Design agent with a brand kit; identities, mockups, campaigns from one prompt. | Marketing deliverables, not your live page taken apart into drop-in parts. |
| Recraft (V4) | Brand-styled consistent images and icons, true vectors, API. | You prompt each asset; it doesn't start from a page or decide what the page needs. A likely supplier for the asset step. |
| Visily, Uizard | Screenshot to editable layout; theme generators restyle colors, fonts, components. | Restyle stays at tokens and components; no illustrated frames, textures or hero art. |
| Google Stitch, Figma Make | Screens and front-end code from prompts and images; design systems (Stitch's DESIGN.md). | Layout and code tools; the look stays close to standard UI. |
| Scenario | Game-studio asset generation with custom style models, API, Unity plugin. | For game teams, needs style training up front; not web pages. Closest in spirit to "skins". |

Sources: [Visily](https://www.visily.ai/ai-design/), [Uizard](https://uizard.io/ai-design/), [img.ly on vibe design tools](https://img.ly/blog/vibe-design-tools-compared), [Google Stitch review](https://designproject.io/blog/google-stitch-review/), [Scenario FAQ](https://help.scenario.com/frequently-asked-questions-faq), [Recraft vector generator](https://recraft.ai/vector-generator), [image API prices](https://costperprompt.com/image-api-pricing), [image API cost guide](https://tech-insider.org/ai-image-generator-api-costs-2026/).

## Verdict

**Worth building, small and focused.**

- The gap is real: every tool above stops either at "a picture of a new look" or at "tokens and components".
  Nobody takes a live page, reimagines it and hands back the cut-out parts.
- The repo already has the pipeline shape (anchor image, locate, regenerate each item, keep and retry), so the first version is mostly re-aiming Fable at pages.
- The risk is quality, not demand: an asset regenerated at full size has to match the concept closely enough to sit beside the others.
  Measure that before building any SaaS.
- The biggest threat is the general models getting good enough at "give me this page's assets" in one chat.
  The defense is the workbench, the page-shaped output (stretchable frames, button states, a theme file) and the preview.
- Franchise styles ("Warcraft", "Lord of the Rings") are out: offer the feel (high fantasy, gothic, retro arcade), never someone else's characters, logos or trademarks.

## Next steps

1. Re-aim Fable: page screenshot in, three concepts out, locate the assets, build each one.
2. An eval set: five real pages (the n8builds concepts are perfect: Relink, Strollz, VibeLog, KeysReady, VoiceDock) times three styles.
   Score whether the assets match the concept and would ship.
3. Only if that works: export (pack plus theme file plus preview), then the parked `web/` SaaS shell for accounts and billing.
