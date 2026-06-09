import Link from "next/link";
import {
  Container,
  Section,
  ButtonLink,
  Eyebrow,
  Badge,
} from "@/components/ui";
import { SITE } from "@/lib/site";
import { SIGNUP_FREE_CREDITS } from "@/lib/pricing";
import { BeforeAfter } from "@/components/marketing/BeforeAfter";
import { Steps } from "@/components/marketing/Steps";
import { PricingGrid } from "@/components/marketing/PricingGrid";
import { FAQ } from "@/components/marketing/FAQ";
import { JsonLd } from "@/components/seo/JsonLd";

export default function LandingPage() {
  return (
    <>
      <JsonLd />

      {/* Hero */}
      <div className="glow relative overflow-hidden">
        <Container className="pt-20 pb-16 sm:pt-28 sm:pb-20">
          <div className="mx-auto max-w-3xl text-center">
            <Eyebrow>AI-assisted icon packs</Eyebrow>
            <h1 className="text-balance text-4xl font-bold tracking-tight text-foreground sm:text-6xl">
              Turn AI design images into reusable icon packs.
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-pretty text-lg leading-relaxed text-muted">
              {SITE.description}
            </p>
            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <ButtonLink href="/app/new" variant="primary" size="lg">
                Upload your first image
              </ButtonLink>
              <ButtonLink href="/examples" variant="secondary" size="lg">
                See examples
              </ButtonLink>
            </div>
            <p className="mt-4 text-sm text-muted">
              {SIGNUP_FREE_CREDITS} free icons to start · No card required
            </p>
          </div>

          <div className="mx-auto mt-16 max-w-5xl">
            <BeforeAfter />
          </div>
        </Container>
      </div>

      {/* Before / After explainer */}
      <Section id="how" className="border-t border-border">
        <Container>
          <div className="mx-auto max-w-2xl text-center">
            <Eyebrow>The wedge</Eyebrow>
            <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Icons in any style you want — matched to your own design.
            </h2>
            <p className="mt-4 text-lg text-muted">
              Not a generic free icon set. We detect the icon system inside your
              image, then recreate the whole family in bulk so every glyph
              belongs together.
            </p>
          </div>

          <div className="mx-auto mt-14 max-w-5xl">
            <BeforeAfter />
          </div>

          <div className="mx-auto mt-12 grid max-w-4xl gap-4 sm:grid-cols-3">
            {[
              {
                title: "Matched, not generic",
                body: "Outputs follow your image's stroke, corners, and fill — a real family, not clip art.",
              },
              {
                title: "Bulk by default",
                body: "Generate a dozen or a few hundred icons in one consistent pass.",
              },
              {
                title: "Honest about it",
                body: "AI recreation, not vector recovery. You always know what you're getting.",
              },
            ].map((f) => (
              <div
                key={f.title}
                className="rounded-2xl border border-border bg-surface p-5"
              >
                <h3 className="text-base font-semibold text-foreground">
                  {f.title}
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">
                  {f.body}
                </p>
              </div>
            ))}
          </div>
        </Container>
      </Section>

      {/* How it works */}
      <Section className="border-t border-border bg-surface/30">
        <Container>
          <div className="mx-auto max-w-2xl text-center">
            <Eyebrow>How it works</Eyebrow>
            <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              From design image to download in five steps.
            </h2>
          </div>
          <div className="mt-14">
            <Steps />
          </div>
        </Container>
      </Section>

      {/* Pricing teaser */}
      <Section id="pricing" className="border-t border-border">
        <Container>
          <div className="mx-auto max-w-2xl text-center">
            <Eyebrow>Pricing</Eyebrow>
            <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Buy once. Keep your credits.
            </h2>
            <p className="mt-4 text-lg text-muted">
              One credit equals one generated icon. Start free, then grab a pack
              when you need more.
            </p>
          </div>

          <div className="mt-14">
            <PricingGrid />
          </div>

          <div className="mt-10 text-center">
            <Link
              href="/pricing"
              className="text-sm font-medium text-accent underline underline-offset-4 hover:text-foreground"
            >
              Compare packs in detail →
            </Link>
          </div>
        </Container>
      </Section>

      {/* FAQ */}
      <Section className="border-t border-border bg-surface/30">
        <Container>
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <Eyebrow>FAQ</Eyebrow>
            <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              The honest answers.
            </h2>
          </div>
          <FAQ />
        </Container>
      </Section>

      {/* Final CTA */}
      <Section className="border-t border-border">
        <Container>
          <div className="glow relative overflow-hidden rounded-3xl border border-border bg-surface px-6 py-16 text-center sm:px-12">
            <Badge className="mb-5 border-primary/40 bg-primary/15 text-primary">
              {SIGNUP_FREE_CREDITS} free icons to start
            </Badge>
            <h2 className="mx-auto max-w-2xl text-balance text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Got a design you love? Turn its icons into a pack.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-lg text-muted">
              Upload one image and see your matched icon set in minutes.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <ButtonLink href="/app/new" variant="primary" size="lg">
                Upload your first image
              </ButtonLink>
              <ButtonLink href="/pricing" variant="secondary" size="lg">
                View pricing
              </ButtonLink>
            </div>
          </div>
        </Container>
      </Section>
    </>
  );
}
