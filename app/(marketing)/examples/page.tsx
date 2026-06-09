import type { Metadata } from "next";
import { Container, Section, Eyebrow, Badge, ButtonLink } from "@/components/ui";
import { BeforeAfter } from "@/components/marketing/BeforeAfter";
import { FAMILY_ORDER, getFamily } from "@/components/marketing/icon-families";

export const metadata: Metadata = {
  title: "Examples",
  description:
    "See how Asset Arsenal turns different design images — SaaS dashboards, stream overlays, AI assistants, creator studios, and fintech dashboards — into matched, style-aware icon packs.",
};

export default function ExamplesPage() {
  return (
    <>
      <Section className="border-b border-border">
        <Container>
          <div className="mx-auto max-w-2xl text-center">
            <Eyebrow>Examples</Eyebrow>
            <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
              Any design. Any style. Its own icon pack.
            </h1>
            <p className="mt-5 text-lg leading-relaxed text-muted">
              Five very different products go in. Five distinct, perfectly
              style-matched icon families come out — same concepts, drawn in each
              design&apos;s own language.
            </p>
            <div className="mt-6 flex justify-center">
              <Badge>
                Illustrative — visuals are representative, not real outputs
              </Badge>
            </div>
          </div>
        </Container>
      </Section>

      <Section>
        <Container>
          <div className="space-y-8 sm:space-y-10">
            {FAMILY_ORDER.map((id, idx) => {
              const fam = getFamily(id);
              return (
                <article
                  key={id}
                  className="rounded-3xl border border-border bg-surface/40 p-5 sm:p-8"
                >
                  <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <Badge className="mb-3">
                        {String(idx + 1).padStart(2, "0")} · {fam.mockupTitle}
                      </Badge>
                      <h2 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                        {fam.mockupTitle} → {fam.label} icon pack
                      </h2>
                    </div>
                    <p className="max-w-md text-sm leading-relaxed text-muted">
                      {fam.tagline}
                    </p>
                  </div>
                  <BeforeAfter family={id} />
                </article>
              );
            })}
          </div>

          <div className="mt-14 text-center">
            <ButtonLink href="/app/new" variant="primary" size="lg">
              Try it with your own image
            </ButtonLink>
          </div>
        </Container>
      </Section>
    </>
  );
}
