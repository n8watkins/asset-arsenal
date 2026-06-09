import type { Metadata } from "next";
import { Container, Section, Eyebrow, Badge, ButtonLink } from "@/components/ui";
import { BeforeAfter } from "@/components/marketing/BeforeAfter";
import {
  type Glyph,
  HomeIcon,
  ChartIcon,
  BellIcon,
  UserIcon,
  SettingsIcon,
  SearchIcon,
  CalendarIcon,
  LockIcon,
  HeartIcon,
  StarIcon,
  FolderIcon,
  BoltIcon,
  GridIcon,
  DownloadIcon,
  ImageIcon,
  SparkleIcon,
} from "@/components/marketing/icons";

export const metadata: Metadata = {
  title: "Examples",
  description:
    "See how Asset Arsenal turns different design images — SaaS dashboards, gaming overlays, AI app mockups, creator dashboards, and brand kits — into matched icon packs.",
};

interface Example {
  kind: string;
  title: string;
  description: string;
  accent: string;
  glyphs: Glyph[];
}

const EXAMPLES: Example[] = [
  {
    kind: "SaaS dashboard",
    title: "SaaS dashboard → icon pack",
    description:
      "A clean analytics dashboard with thin-line icons becomes a tidy navigation and metrics set.",
    accent: "text-primary",
    glyphs: [HomeIcon, ChartIcon, BellIcon, UserIcon, SettingsIcon, SearchIcon, CalendarIcon, FolderIcon],
  },
  {
    kind: "Gaming overlay",
    title: "Gaming overlay → icon pack",
    description:
      "A bold stream overlay turns into punchy badge-style icons for alerts, stats, and rewards.",
    accent: "text-accent",
    glyphs: [BoltIcon, StarIcon, HeartIcon, BellIcon, UserIcon, ChartIcon, LockIcon, GridIcon],
  },
  {
    kind: "AI app mockup",
    title: "AI app mockup → icon pack",
    description:
      "A futuristic AI product concept yields a sleek duotone set for chat, prompts, and history.",
    accent: "text-primary",
    glyphs: [SparkleIcon, SearchIcon, ImageIcon, FolderIcon, SettingsIcon, BoltIcon, UserIcon, GridIcon],
  },
  {
    kind: "Creator dashboard",
    title: "Creator dashboard → icon pack",
    description:
      "A content creator's studio view becomes icons for uploads, audience, schedule, and earnings.",
    accent: "text-accent",
    glyphs: [ImageIcon, ChartIcon, CalendarIcon, HeartIcon, DownloadIcon, BellIcon, UserIcon, StarIcon],
  },
  {
    kind: "Brand kit",
    title: "Brand kit → icon pack",
    description:
      "A brand style frame produces a cohesive icon family on-brand with the source palette and shapes.",
    accent: "text-primary",
    glyphs: [StarIcon, HeartIcon, BoltIcon, SparkleIcon, FolderIcon, GridIcon, HomeIcon, SettingsIcon],
  },
];

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
              A few kinds of images people bring to Asset Arsenal, and the
              matched packs they get back.
            </p>
            <div className="mt-6 flex justify-center">
              <Badge>Illustrative — visuals are representative, not real outputs</Badge>
            </div>
          </div>
        </Container>
      </Section>

      <Section>
        <Container>
          <div className="space-y-8">
            {EXAMPLES.map((ex) => (
              <article
                key={ex.kind}
                className="rounded-3xl border border-border bg-surface/40 p-5 sm:p-8"
              >
                <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <Badge className="mb-3">{ex.kind}</Badge>
                    <h2 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                      {ex.title}
                    </h2>
                  </div>
                  <p className="max-w-md text-sm leading-relaxed text-muted">
                    {ex.description}
                  </p>
                </div>
                <BeforeAfter glyphs={ex.glyphs} accent={ex.accent} />
              </article>
            ))}
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
