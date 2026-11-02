/**
 * Site-wide settings. The concept page lives at https://assetarsenal.n8builds.dev
 * until Asset Arsenal gets its own domain. NEXT_PUBLIC_SITE_URL can override the
 * canonical URL at build time.
 */
export const site = {
  name: "Asset Arsenal",
  url: (process.env.NEXT_PUBLIC_SITE_URL ?? "https://assetarsenal.n8builds.dev").replace(/\/$/, ""),
  title: "Asset Arsenal: reimagine your page in any style, then ship the assets",
  description:
    "Asset Arsenal reimagines your web page in your brand or any style you describe, then breaks the picture into real, cut-out assets you can put on the page: backgrounds, frames, buttons, icons and illustrations. A concept in development.",
  shortDescription: "Reimagine your page in any style, then ship every asset in it.",
  updated: "2026-11-02",
  /** The waitlist lives on n8builds.dev, where the product is built in public. */
  waitlistUrl: "https://n8builds.dev/upcoming?interest=asset-arsenal#asset-arsenal",
  builderUrl: "https://n8builds.dev",
} as const;

/** Routes that exist on this site, used by the sitemap and the 404 page. */
export const routes = [
  { path: "/", title: "Home" },
  { path: "/#how-it-works", title: "How it works" },
  { path: "/#what-you-get", title: "What you get" },
  { path: "/#compare", title: "Compared with other tools" },
  { path: "/#faq", title: "FAQ" },
  { path: "/privacy", title: "Privacy" },
  { path: "/terms", title: "Terms" },
] as const;
