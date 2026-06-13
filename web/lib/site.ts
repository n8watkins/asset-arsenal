/** Site-wide constants used in metadata, nav, SEO, and structured data. */

export const SITE = {
  name: "Asset Arsenal",
  shortName: "Asset Arsenal",
  description:
    "Upload a design image. Asset Arsenal detects the icon system, recreates the style, and generates individual downloadable icons. Turn AI mockups into reusable icon packs.",
  tagline: "Turn AI design images into reusable icon packs.",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://assetarsenal.app",
  twitter: "@assetarsenal",
} as const;

/** Public nav links shown in the marketing header. */
export const NAV_LINKS = [
  { href: "/examples", label: "Examples" },
  { href: "/pricing", label: "Pricing" },
] as const;

/** Footer link groups. */
export const FOOTER_LINKS = [
  {
    title: "Product",
    links: [
      { href: "/examples", label: "Examples" },
      { href: "/pricing", label: "Pricing" },
      { href: "/app", label: "Dashboard" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/terms", label: "Terms" },
      { href: "/privacy", label: "Privacy" },
      { href: "/refunds", label: "Refunds" },
    ],
  },
] as const;
