import { cn } from "@/lib/cn";
import {
  ICON_FAMILY,
  type Glyph,
  HomeIcon,
  ChartIcon,
  BellIcon,
  UserIcon,
  SearchIcon,
  SettingsIcon,
} from "./icons";

/**
 * The flagship conversion visual. LEFT = a CSS-drawn "design mockup"
 * (header bar, sidebar, cards/charts) with small inline icons baked in.
 * RIGHT = the same icon family extracted as a clean, standalone grid.
 * Everything is drawn with divs + inline SVG — no external image assets.
 */

export function MockupPanel({
  accent = "text-primary",
}: {
  /** Tailwind text-color class for the accent icons/bars. */
  accent?: string;
}) {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-border bg-background">
      {/* window chrome */}
      <div className="flex items-center gap-1.5 border-b border-border bg-surface-2 px-3 py-2">
        <span className="h-2.5 w-2.5 rounded-full bg-border" />
        <span className="h-2.5 w-2.5 rounded-full bg-border" />
        <span className="h-2.5 w-2.5 rounded-full bg-border" />
        <div className="ml-2 h-3 w-28 rounded bg-surface" />
      </div>

      <div className="flex flex-1">
        {/* sidebar */}
        <div className="flex w-12 flex-col items-center gap-4 border-r border-border bg-surface px-2 py-4 sm:w-14">
          <HomeIcon className={cn("h-5 w-5", accent)} />
          <ChartIcon className="h-5 w-5 text-muted" />
          <UserIcon className="h-5 w-5 text-muted" />
          <SettingsIcon className="h-5 w-5 text-muted" />
        </div>

        {/* content */}
        <div className="flex-1 space-y-3 p-3 sm:p-4">
          {/* top bar */}
          <div className="flex items-center justify-between">
            <div className="h-3 w-20 rounded bg-surface-2" />
            <div className="flex items-center gap-2.5">
              <SearchIcon className="h-4 w-4 text-muted" />
              <BellIcon className="h-4 w-4 text-muted" />
              <span className="h-5 w-5 rounded-full bg-surface-2" />
            </div>
          </div>

          {/* stat cards */}
          <div className="grid grid-cols-3 gap-2">
            {[HomeIcon, ChartIcon, BellIcon].map((Glyph, i) => (
              <div
                key={i}
                className="rounded-lg border border-border bg-surface p-2"
              >
                <Glyph className={cn("mb-1.5 h-4 w-4", accent)} />
                <div className="h-2 w-8 rounded bg-surface-2" />
                <div className="mt-1 h-3 w-10 rounded bg-border" />
              </div>
            ))}
          </div>

          {/* chart card */}
          <div className="rounded-lg border border-border bg-surface p-3">
            <div className="mb-2 flex items-center justify-between">
              <div className="h-2.5 w-16 rounded bg-surface-2" />
              <ChartIcon className={cn("h-4 w-4", accent)} />
            </div>
            <div className="flex h-12 items-end gap-1.5">
              {[40, 65, 35, 80, 55, 70, 45, 90].map((h, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex-1 rounded-t",
                    i % 2 === 0 ? "bg-primary/70" : "bg-surface-2",
                  )}
                  style={{ height: `${h}%` }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function IconPackGrid({
  glyphs = ICON_FAMILY.map((f) => f.Icon),
  accent = "text-primary",
}: {
  glyphs?: Glyph[];
  accent?: string;
}) {
  return (
    <div className="grid h-full grid-cols-4 gap-2.5 sm:gap-3">
      {glyphs.map((Glyph, i) => (
        <div
          key={i}
          className="group flex aspect-square items-center justify-center rounded-xl border border-border bg-background transition-colors hover:border-primary/50"
        >
          <Glyph
            className={cn(
              "h-6 w-6 transition-colors sm:h-7 sm:w-7",
              i % 5 === 0 ? accent : "text-foreground",
            )}
          />
        </div>
      ))}
    </div>
  );
}

export function ArrowDivider() {
  return (
    <div className="flex shrink-0 items-center justify-center md:flex-col">
      <div className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface text-accent shadow-sm">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-4 w-4 rotate-90 md:rotate-0"
        >
          <path d="M5 12h14" />
          <path d="m13 6 6 6-6 6" />
        </svg>
      </div>
    </div>
  );
}

export function BeforeAfter({
  className,
  glyphs,
  accent = "text-primary",
}: {
  className?: string;
  glyphs?: Glyph[];
  accent?: string;
}) {
  return (
    <div
      className={cn(
        "grid items-stretch gap-4 md:grid-cols-[1fr_auto_1fr] md:gap-3",
        className,
      )}
    >
      <figure className="flex flex-col">
        <figcaption className="mb-2 text-xs font-medium uppercase tracking-wider text-muted">
          Your design image
        </figcaption>
        <div className="flex-1 rounded-2xl border border-border bg-surface p-3">
          <MockupPanel accent={accent} />
        </div>
      </figure>

      <ArrowDivider />

      <figure className="flex flex-col">
        <figcaption className="mb-2 text-xs font-medium uppercase tracking-wider text-accent">
          Your icon pack
        </figcaption>
        <div className="flex-1 rounded-2xl border border-border bg-surface p-4">
          <IconPackGrid glyphs={glyphs} accent={accent} />
        </div>
      </figure>
    </div>
  );
}
