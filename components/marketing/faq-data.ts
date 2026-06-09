/**
 * FAQ content lives in a plain (non-client) module so it can be imported by
 * BOTH the client <FAQ> accordion and the server-rendered FAQPage JSON-LD.
 * Exporting data from a "use client" file yields a client-reference on the
 * server, not the actual array — keep this module free of "use client".
 */

export interface FaqItem {
  q: string;
  a: string;
}

export const FAQ_ITEMS: FaqItem[] = [
  {
    q: "Is this exact extraction of the icons in my image?",
    a: "No. Asset Arsenal does not recover vector layers or pull source files out of your image. It reads the icon style and recreates each icon as a new, AI-generated asset matched to that style. Think faithful recreation, not file recovery.",
  },
  {
    q: "Can I use the generated icons commercially?",
    a: "You can use your outputs in line with our terms. You are responsible for having the rights to whatever image you upload — if you don't own or have a license to your source image, we can't grant you rights to derivatives of it.",
  },
  {
    q: "Do unused credits expire?",
    a: "Credits you purchase stay on your account and don't expire. Free preview credits and any promotional credits we hand out may have an expiry — we'll note it when they're granted.",
  },
  {
    q: "What files do I get?",
    a: "Each icon is delivered as a PNG, alongside prompt and manifest metadata describing how it was generated. Paid packs also include a ZIP of the full set. SVG export is on the roadmap but not available yet.",
  },
  {
    q: "Can I regenerate icons I don't like?",
    a: "Yes. You can regenerate any icon to get a fresh take. Regenerations use credits like any other generation, except when the original failed due to a system or API error — those are on us.",
  },
];
