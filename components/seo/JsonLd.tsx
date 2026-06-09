import { SITE } from "@/lib/site";
import { PACKS, priceLabel } from "@/lib/pricing";
import { FAQ_ITEMS } from "@/components/marketing/faq-data";

/**
 * Structured data for SEO: Organization, the icon-pack Product/Offers, and the
 * FAQPage. Rendered as a single application/ld+json script via JSON.stringify.
 */
function jsonLd() {
  const organization = {
    "@type": "Organization",
    "@id": `${SITE.url}/#organization`,
    name: SITE.name,
    url: SITE.url,
    description: SITE.description,
    logo: `${SITE.url}${SITE.ogImage}`,
    sameAs: [`https://twitter.com/${SITE.twitter.replace(/^@/, "")}`],
  };

  const product = {
    "@type": "Product",
    "@id": `${SITE.url}/#product`,
    name: `${SITE.name} icon packs`,
    description: SITE.description,
    brand: { "@type": "Brand", name: SITE.name },
    offers: PACKS.map((pack) => ({
      "@type": "Offer",
      name: pack.name,
      description: pack.tagline,
      price: (pack.priceCents / 100).toFixed(2),
      priceCurrency: "USD",
      category: priceLabel(pack.priceCents),
      url: `${SITE.url}/pricing`,
      availability: "https://schema.org/InStock",
    })),
  };

  const faqPage = {
    "@type": "FAQPage",
    "@id": `${SITE.url}/#faq`,
    mainEntity: FAQ_ITEMS.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };

  return {
    "@context": "https://schema.org",
    "@graph": [organization, product, faqPage],
  };
}

export function JsonLd() {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd()) }}
    />
  );
}
