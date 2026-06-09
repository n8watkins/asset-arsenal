import type { Metadata } from "next";
import {
  Container,
  Section,
  Eyebrow,
  ButtonLink,
} from "@/components/ui";
import { PricingGrid } from "@/components/marketing/PricingGrid";
import { FAQ } from "@/components/marketing/FAQ";
import { JsonLd } from "@/components/seo/JsonLd";
import { SIGNUP_FREE_CREDITS } from "@/lib/pricing";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Simple credit packs for Asset Arsenal. One credit equals one generated icon. Buy once and keep your credits — no subscription.",
};

const CREDIT_NOTES = [
  {
    title: "1 credit = 1 icon",
    body: "Every generated icon costs a single credit. Analysis, style matching, and the collection image are baked into the pack price.",
  },
  {
    title: "Credits don't expire",
    body: "Purchased credits stay on your account until you use them. Free and promotional credits may carry an expiry.",
  },
  {
    title: "Failures are free",
    body: "If a generation fails because of a system or API error, you won't be charged a credit for it.",
  },
];

export default function PricingPage() {
  return (
    <>
      <JsonLd />

      <Section className="border-b border-border">
        <Container>
          <div className="mx-auto max-w-2xl text-center">
            <Eyebrow>Pricing</Eyebrow>
            <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
              Buy once. Keep your credits.
            </h1>
            <p className="mt-5 text-lg leading-relaxed text-muted">
              No subscriptions, no seats. One credit equals one generated icon.
              Start with {SIGNUP_FREE_CREDITS} free icons, then top up with a
              pack whenever you need more.
            </p>
          </div>

          <div className="mt-14">
            <PricingGrid />
          </div>

          <div className="mx-auto mt-14 grid max-w-4xl gap-4 sm:grid-cols-3">
            {CREDIT_NOTES.map((note) => (
              <div
                key={note.title}
                className="rounded-2xl border border-border bg-surface p-5"
              >
                <h3 className="text-base font-semibold text-foreground">
                  {note.title}
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">
                  {note.body}
                </p>
              </div>
            ))}
          </div>
        </Container>
      </Section>

      <Section>
        <Container>
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <Eyebrow>Questions</Eyebrow>
            <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              How credits work.
            </h2>
          </div>
          <FAQ />

          <div className="mt-12 text-center">
            <ButtonLink href="/app/new" variant="primary" size="lg">
              Start with {SIGNUP_FREE_CREDITS} free icons
            </ButtonLink>
          </div>
        </Container>
      </Section>
    </>
  );
}
