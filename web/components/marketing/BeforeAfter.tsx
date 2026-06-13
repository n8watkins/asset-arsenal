/**
 * The flagship conversion visual: a BEFORE → AFTER unit.
 *
 *   LEFT  = the family's product mockup (the "design image you bring").
 *   MID   = an arrow / "extracted" divider with the Asset Arsenal mark.
 *   RIGHT = a 3×4 grid of the matching standalone icons on tasteful tiles,
 *           glowing where the family calls for it.
 *
 * It must read instantly that the right-hand icons MATCH the left design's
 * style. Renders with NO required props (defaults to the brand "saas" family)
 * so the home page can use <BeforeAfter /> directly.
 */
import type { CSSProperties } from "react";
import { cn } from "@/lib/cn";
import {
  DEFAULT_FAMILY,
  GLYPH_ORDER,
  getFamily,
  type FamilyId,
} from "./icon-families";
import { FamilyIcon, withAlpha } from "./icons";
import { Mockup } from "./mockups";

export type { FamilyId };

/* ------------------------------------------------------------------ */
/* Right column — the extracted icon pack on tiles                    */
/* ------------------------------------------------------------------ */

function IconPackGrid({ family }: { family: FamilyId }) {
  const { palette: p, style: s } = getFamily(family);
  return (
    <div className="grid grid-cols-4 gap-2 sm:gap-2.5">
      {GLYPH_ORDER.map((name) => {
        const tileStyle: CSSProperties = {
          background: p.surface,
          border: `1px solid ${p.stroke}`,
          ...(s.glow
            ? { boxShadow: `inset 0 0 18px ${withAlpha(p.accent, 0.08)}` }
            : {}),
        };
        return (
          <div
            key={name}
            className={cn(
              "flex aspect-square items-center justify-center p-2.5 sm:p-3",
              s.tileRadius,
            )}
            style={tileStyle}
          >
            <FamilyIcon
              family={family}
              name={name}
              className="h-6 w-6 sm:h-7 sm:w-7"
            />
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Center divider                                                     */
/* ------------------------------------------------------------------ */

function ExtractDivider({ family }: { family: FamilyId }) {
  const { palette: p, style: s } = getFamily(family);
  return (
    <div className="flex shrink-0 items-center justify-center gap-2 md:flex-col">
      <div
        className="flex h-10 w-10 items-center justify-center rounded-full"
        style={{
          background: `linear-gradient(135deg, ${p.accent}, ${p.accent2})`,
          color: "#fff",
          boxShadow: s.glow
            ? `0 0 22px ${withAlpha(p.accent, 0.6)}`
            : `0 6px 18px ${withAlpha(p.accent, 0.28)}`,
        }}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.25}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-4 w-4 rotate-90 md:rotate-0"
        >
          <path d="M5 12h13" />
          <path d="m12 6 6 6-6 6" />
        </svg>
      </div>
      <span
        className="text-[10px] font-semibold uppercase tracking-widest"
        style={{ color: p.accent }}
      >
        Extracted
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Caption                                                            */
/* ------------------------------------------------------------------ */

function PackCaption({ family }: { family: FamilyId }) {
  const { palette: p } = getFamily(family);
  const items = ["12 icons", "style-matched", "PNG + SVG"];
  return (
    <div
      className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]"
      style={{ color: p.muted }}
    >
      {items.map((item, i) => (
        <span key={item} className="flex items-center gap-2">
          {i > 0 && (
            <span
              className="inline-block h-1 w-1 rounded-full"
              style={{ background: p.stroke }}
            />
          )}
          {item}
        </span>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Composed unit                                                      */
/* ------------------------------------------------------------------ */

export interface BeforeAfterProps {
  /** Which design system to show. Defaults to the brand "saas" family. */
  family?: FamilyId;
  className?: string;
}

export function BeforeAfter({
  family = DEFAULT_FAMILY,
  className,
}: BeforeAfterProps = {}) {
  const fam = getFamily(family);
  const { palette: p } = fam;

  // Tasteful tinted container so each unit reads as its own brand world.
  const panelStyle: CSSProperties = {
    background: `linear-gradient(160deg, ${withAlpha(p.accent, 0.05)}, transparent 60%)`,
  };

  return (
    <div
      className={cn(
        "grid items-stretch gap-5 md:grid-cols-[1fr_auto_1fr] md:gap-4",
        className,
      )}
      style={panelStyle}
    >
      {/* BEFORE */}
      <figure className="flex min-w-0 flex-col">
        <figcaption
          className="mb-2 text-[11px] font-semibold uppercase tracking-wider"
          style={{ color: p.muted }}
        >
          Your design image
        </figcaption>
        <div
          className="flex-1 rounded-2xl p-2.5"
          style={{ background: p.surface, border: `1px solid ${p.stroke}` }}
        >
          <Mockup family={family} />
        </div>
      </figure>

      <ExtractDivider family={family} />

      {/* AFTER */}
      <figure className="flex min-w-0 flex-col">
        <figcaption
          className="mb-2 text-[11px] font-semibold uppercase tracking-wider"
          style={{ color: p.accent }}
        >
          {fam.label} icon pack
        </figcaption>
        <div
          className="flex flex-1 flex-col rounded-2xl p-3 sm:p-4"
          style={{ background: p.bg, border: `1px solid ${p.stroke}` }}
        >
          <IconPackGrid family={family} />
          <PackCaption family={family} />
        </div>
      </figure>
    </div>
  );
}

export default BeforeAfter;
