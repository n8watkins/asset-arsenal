/**
 * The five "BEFORE" design images — each a distinct product mockup drawn with
 * divs + inline SVG (no screenshots, no image API). Every mockup uses its
 * family's palette so the left design and the right icon pack read as the same
 * "brand". A <Mockup family="…" /> dispatcher picks the right one.
 */
import type { CSSProperties } from "react";
import { cn } from "@/lib/cn";
import {
  getFamily,
  type FamilyId,
  type FamilyPalette,
} from "./icon-families";
import { MiniGlyph, SparkleMini, withAlpha } from "./icons";

/* ------------------------------------------------------------------ */
/* Shared faux app/browser frame                                      */
/* ------------------------------------------------------------------ */

function Frame({
  palette,
  url,
  children,
  className,
}: {
  palette: FamilyPalette;
  url: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex h-full min-h-[260px] flex-col overflow-hidden rounded-xl",
        className,
      )}
      style={{
        background: palette.bg,
        border: `1px solid ${palette.stroke}`,
        color: palette.text,
      }}
    >
      <div
        className="flex items-center gap-1.5 px-3 py-2"
        style={{
          background: palette.surface,
          borderBottom: `1px solid ${palette.stroke}`,
        }}
      >
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#ff5f56" }} />
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#ffbd2e" }} />
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#27c93f" }} />
        <div
          className="ml-3 hidden flex-1 truncate rounded-md px-2.5 py-1 text-[10px] sm:block"
          style={{ background: palette.bg, color: palette.muted }}
        >
          {url}
        </div>
      </div>
      <div className="relative flex-1">{children}</div>
    </div>
  );
}

/** Placeholder text bar. */
function Bar({
  w,
  h = 6,
  color,
  className,
}: {
  w: number | string;
  h?: number;
  color: string;
  className?: string;
}) {
  return (
    <div
      className={cn("rounded-full", className)}
      style={{
        width: typeof w === "number" ? `${w}px` : w,
        height: `${h}px`,
        background: color,
      }}
    />
  );
}

interface MockupProps {
  family: FamilyId;
  className?: string;
}

/* ================================================================== */
/* 1. SaaS — tidy analytics dashboard                                 */
/* ================================================================== */

function SaasMockup({ family }: { family: FamilyId }) {
  const { palette: p, appUrl } = getFamily(family);
  const navItems = ["home", "chart", "user", "settings"] as const;
  const bars = [44, 70, 38, 86, 58, 74, 50, 92, 66];
  return (
    <Frame palette={p} url={appUrl}>
      <div className="flex h-full">
        {/* left nav */}
        <div
          className="flex w-12 flex-col items-center gap-3 py-3 sm:w-14"
          style={{ borderRight: `1px solid ${p.stroke}`, background: p.surface }}
        >
          <div
            className="mb-1 h-5 w-5 rounded-md"
            style={{ background: `linear-gradient(135deg, ${p.accent}, ${p.accent2})` }}
          />
          {navItems.map((n, i) => (
            <div
              key={n}
              className="flex h-7 w-7 items-center justify-center rounded-lg"
              style={
                i === 0
                  ? { background: withAlpha(p.accent, 0.16), color: p.accent }
                  : { color: p.muted }
              }
            >
              <MiniGlyph name={n} className="h-4 w-4" />
            </div>
          ))}
        </div>

        {/* main */}
        <div className="flex flex-1 flex-col gap-2.5 p-3">
          <div className="flex items-center justify-between">
            <Bar w={88} h={9} color={p.surface} />
            <div className="flex items-center gap-2" style={{ color: p.muted }}>
              <MiniGlyph name="search" className="h-3.5 w-3.5" />
              <MiniGlyph name="bell" className="h-3.5 w-3.5" />
              <span
                className="h-5 w-5 rounded-full"
                style={{ background: `linear-gradient(135deg, ${p.accent}, ${p.accent2})` }}
              />
            </div>
          </div>

          {/* KPI cards */}
          <div className="grid grid-cols-3 gap-2">
            {(["chart", "user", "bolt"] as const).map((n, i) => (
              <div
                key={n}
                className="rounded-lg p-2"
                style={{ background: p.surface, border: `1px solid ${p.stroke}` }}
              >
                <MiniGlyph
                  name={n}
                  className="mb-1.5 h-3.5 w-3.5"
                  style={{ color: i === 0 ? p.accent : p.accent2 }}
                />
                <Bar w={20} h={4} color={p.stroke} className="mb-1" />
                <Bar w={32} h={8} color={withAlpha(p.text, 0.5)} />
              </div>
            ))}
          </div>

          {/* chart */}
          <div
            className="flex-1 rounded-lg p-2.5"
            style={{ background: p.surface, border: `1px solid ${p.stroke}` }}
          >
            <div className="mb-2 flex items-center justify-between">
              <Bar w={56} h={6} color={p.stroke} />
              <MiniGlyph name="chart" className="h-3.5 w-3.5" style={{ color: p.accent }} />
            </div>
            <div className="flex h-14 items-end gap-1.5">
              {bars.map((h, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-t-sm"
                  style={{
                    height: `${h}%`,
                    background:
                      i % 3 === 2
                        ? `linear-gradient(${p.accent}, ${p.accent2})`
                        : withAlpha(p.accent, 0.3),
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </Frame>
  );
}

/* ================================================================== */
/* 2. Arcade — neon stream overlay                                    */
/* ================================================================== */

function ArcadeMockup({ family }: { family: FamilyId }) {
  const { palette: p, appUrl } = getFamily(family);
  const glow = (c: string): CSSProperties => ({
    boxShadow: `0 0 12px ${withAlpha(c, 0.45)}, inset 0 0 0 1px ${withAlpha(c, 0.4)}`,
  });
  return (
    <Frame palette={p} url={appUrl}>
      <div className="grid h-full grid-cols-3 gap-2 p-2.5">
        {/* gameplay area / webcam + alerts (spans 2) */}
        <div className="col-span-2 flex flex-col gap-2">
          {/* webcam frame */}
          <div
            className="relative flex-1 overflow-hidden rounded-lg"
            style={{
              background: `radial-gradient(circle at 30% 20%, ${withAlpha(p.accent, 0.18)}, ${p.surface})`,
              ...glow(p.accent),
            }}
          >
            <span
              className="absolute left-2 top-2 rounded px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider"
              style={{ background: "#ef4444", color: "#fff" }}
            >
              ● Live
            </span>
            <span
              className="absolute bottom-2 left-2 text-[10px] font-bold uppercase tracking-wide"
              style={{ color: p.accent2, textShadow: `0 0 8px ${withAlpha(p.accent2, 0.7)}` }}
            >
              Player_01
            </span>
            <div
              className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-md"
              style={{ color: p.accent, ...glow(p.accent) }}
            >
              <MiniGlyph name="user" className="h-4 w-4" />
            </div>
          </div>

          {/* alerts ticker */}
          <div
            className="flex items-center gap-2 rounded-lg px-2.5 py-2"
            style={{ background: p.surface, ...glow(p.accent2) }}
          >
            <MiniGlyph name="bolt" className="h-4 w-4 shrink-0" style={{ color: p.accent2 }} />
            <Bar w="40%" h={6} color={withAlpha(p.accent2, 0.5)} />
            <MiniGlyph name="star" className="ml-auto h-4 w-4 shrink-0" style={{ color: p.accent }} />
          </div>

          {/* XP / level bar */}
          <div
            className="rounded-lg px-2.5 py-2"
            style={{ background: p.surface, border: `1px solid ${p.stroke}` }}
          >
            <div className="mb-1.5 flex items-center justify-between text-[9px] font-bold uppercase" style={{ color: p.accent }}>
              <span style={{ textShadow: `0 0 6px ${withAlpha(p.accent, 0.7)}` }}>LV 27</span>
              <span style={{ color: p.muted }}>8420 XP</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full" style={{ background: p.bg }}>
              <div
                className="h-full rounded-full"
                style={{
                  width: "72%",
                  background: `linear-gradient(90deg, ${p.accent}, ${p.accent2})`,
                  boxShadow: `0 0 10px ${withAlpha(p.accent, 0.8)}`,
                }}
              />
            </div>
          </div>
        </div>

        {/* chat box */}
        <div
          className="flex flex-col gap-1.5 rounded-lg p-2"
          style={{ background: p.surface, ...glow(p.accent) }}
        >
          <div className="mb-0.5 flex items-center gap-1.5 text-[9px] font-bold uppercase" style={{ color: p.accent }}>
            <MiniGlyph name="bell" className="h-3 w-3" />
            Chat
          </div>
          {[p.accent, p.accent2, p.accent, p.accent2, p.accent, p.accent2].map((c, i) => (
            <div key={i} className="flex items-center gap-1">
              <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: c }} />
              <Bar w={i % 2 === 0 ? "70%" : "85%"} h={4} color={p.stroke} />
            </div>
          ))}
        </div>
      </div>
    </Frame>
  );
}

/* ================================================================== */
/* 3. Nova — AI chat / assistant                                      */
/* ================================================================== */

function NovaMockup({ family }: { family: FamilyId }) {
  const { palette: p, appUrl } = getFamily(family);
  const grad = `linear-gradient(135deg, ${p.accent}, ${p.accent2})`;
  return (
    <Frame palette={p} url={appUrl}>
      <div className="flex h-full">
        {/* thread sidebar */}
        <div
          className="hidden w-24 flex-col gap-2 p-2.5 sm:flex"
          style={{ borderRight: `1px solid ${p.stroke}`, background: p.surface }}
        >
          <div
            className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[9px] font-semibold"
            style={{ background: grad, color: "#fff" }}
          >
            <SparkleMini className="h-3 w-3" /> New
          </div>
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="rounded-lg px-2 py-1.5"
              style={i === 1 ? { background: withAlpha(p.accent, 0.18) } : undefined}
            >
              <Bar w={i === 1 ? "90%" : "75%"} h={5} color={i === 1 ? withAlpha(p.accent, 0.6) : p.stroke} />
            </div>
          ))}
        </div>

        {/* conversation */}
        <div className="flex flex-1 flex-col p-3">
          <div className="flex items-center gap-2">
            <span
              className="flex h-6 w-6 items-center justify-center rounded-full"
              style={{ background: grad, color: "#fff" }}
            >
              <SparkleMini className="h-3.5 w-3.5" />
            </span>
            <Bar w={64} h={7} color={p.surface} />
          </div>

          <div className="mt-3 flex flex-1 flex-col justify-end gap-2.5">
            {/* assistant bubble */}
            <div className="flex gap-1.5">
              <span className="mt-0.5 h-4 w-4 shrink-0 rounded-full" style={{ background: grad }} />
              <div
                className="space-y-1.5 rounded-2xl rounded-tl-sm px-3 py-2"
                style={{ background: p.surface, border: `1px solid ${p.stroke}`, maxWidth: "80%" }}
              >
                <Bar w={120} h={5} color={p.stroke} />
                <Bar w={92} h={5} color={p.stroke} />
              </div>
            </div>
            {/* user bubble */}
            <div className="flex justify-end">
              <div
                className="space-y-1.5 rounded-2xl rounded-tr-sm px-3 py-2"
                style={{ background: withAlpha(p.accent, 0.16), maxWidth: "70%" }}
              >
                <Bar w={84} h={5} color={withAlpha(p.accent, 0.5)} />
              </div>
            </div>
            {/* assistant typing */}
            <div className="flex gap-1.5">
              <span className="mt-0.5 h-4 w-4 shrink-0 rounded-full" style={{ background: grad }} />
              <div
                className="flex items-center gap-1 rounded-2xl rounded-tl-sm px-3 py-2.5"
                style={{ background: p.surface, border: `1px solid ${p.stroke}` }}
              >
                {[0, 1, 2].map((i) => (
                  <span key={i} className="h-1.5 w-1.5 rounded-full" style={{ background: p.accent2 }} />
                ))}
              </div>
            </div>
          </div>

          {/* prompt bar */}
          <div
            className="mt-3 flex items-center gap-2 rounded-full px-3 py-2"
            style={{ background: p.surface, border: `1px solid ${p.stroke}` }}
          >
            <SparkleMini className="h-4 w-4" style={{ color: p.accent }} />
            <Bar w="50%" h={5} color={p.stroke} />
            <span
              className="ml-auto flex h-6 w-6 items-center justify-center rounded-full"
              style={{ background: grad, color: "#fff", boxShadow: `0 0 12px ${withAlpha(p.accent, 0.5)}` }}
            >
              <MiniGlyph name="bolt" className="h-3.5 w-3.5" />
            </span>
          </div>
        </div>
      </div>
    </Frame>
  );
}

/* ================================================================== */
/* 4. Ember — creator studio                                          */
/* ================================================================== */

function EmberMockup({ family }: { family: FamilyId }) {
  const { palette: p, appUrl } = getFamily(family);
  const grad = `linear-gradient(135deg, ${p.accent}, ${p.accent2})`;
  const stats: { name: "user" | "heart" | "chart"; label: string }[] = [
    { name: "user", label: "Subs" },
    { name: "heart", label: "Likes" },
    { name: "chart", label: "Views" },
  ];
  const area = [30, 45, 38, 60, 52, 72, 64, 88];
  return (
    <Frame palette={p} url={appUrl}>
      <div className="flex h-full flex-col gap-2.5 p-3">
        {/* header */}
        <div className="flex items-center gap-2">
          <span
            className="flex h-7 w-7 items-center justify-center rounded-full text-[11px]"
            style={{ background: grad, color: "#1a120a" }}
          >
            <MiniGlyph name="star" className="h-4 w-4" />
          </span>
          <div>
            <Bar w={70} h={7} color={p.surface} className="mb-1" />
            <Bar w={44} h={4} color={p.stroke} />
          </div>
          <span
            className="ml-auto rounded-full px-2 py-1 text-[9px] font-bold"
            style={{ background: withAlpha(p.accent, 0.18), color: p.accent }}
          >
            142K subs
          </span>
        </div>

        {/* audience stat cards */}
        <div className="grid grid-cols-3 gap-2">
          {stats.map((s, i) => (
            <div
              key={s.label}
              className="rounded-xl p-2"
              style={{ background: p.surface, border: `1px solid ${p.stroke}` }}
            >
              <MiniGlyph
                name={s.name}
                className="mb-1.5 h-4 w-4"
                style={{ color: i === 1 ? p.accent2 : p.accent }}
              />
              <Bar w={34} h={8} color={withAlpha(p.text, 0.55)} className="mb-1" />
              <span className="text-[8px]" style={{ color: p.muted }}>{s.label}</span>
            </div>
          ))}
        </div>

        {/* revenue area chart */}
        <div
          className="rounded-xl p-2.5"
          style={{ background: p.surface, border: `1px solid ${p.stroke}` }}
        >
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-[9px] font-semibold" style={{ color: p.accent }}>Revenue</span>
            <span className="text-[9px] font-bold" style={{ color: p.text }}>$4.2k</span>
          </div>
          <div className="flex h-10 items-end gap-1">
            {area.map((h, i) => (
              <div
                key={i}
                className="flex-1 rounded-t-md"
                style={{ height: `${h}%`, background: grad, opacity: 0.35 + i * 0.08 }}
              />
            ))}
          </div>
        </div>

        {/* thumbnail tiles */}
        <div className="grid flex-1 grid-cols-3 gap-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="relative overflow-hidden rounded-lg"
              style={{
                background: `linear-gradient(135deg, ${withAlpha(p.accent, 0.25)}, ${withAlpha(p.accent2, 0.25)})`,
                border: `1px solid ${p.stroke}`,
                minHeight: 36,
              }}
            >
              <span
                className="absolute inset-0 flex items-center justify-center"
                style={{ color: withAlpha("#ffffff", 0.85) }}
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </span>
            </div>
          ))}
        </div>
      </div>
    </Frame>
  );
}

/* ================================================================== */
/* 5. Vault — fintech / crypto dashboard                              */
/* ================================================================== */

function VaultMockup({ family }: { family: FamilyId }) {
  const { palette: p, appUrl } = getFamily(family);
  const grad = `linear-gradient(135deg, ${p.accent}, ${p.accent2})`;
  // candlestick data: [low%, high%, openTop%, openBottom%, up]
  const candles = [
    { l: 20, h: 70, b: 34, t: 56, up: true },
    { l: 30, h: 80, b: 46, t: 64, up: true },
    { l: 25, h: 60, b: 52, t: 38, up: false },
    { l: 18, h: 88, b: 40, t: 72, up: true },
    { l: 40, h: 75, b: 66, t: 50, up: false },
    { l: 22, h: 92, b: 44, t: 80, up: true },
    { l: 35, h: 68, b: 58, t: 44, up: false },
    { l: 28, h: 96, b: 48, t: 86, up: true },
  ];
  const tokens: { name: "bolt" | "lock" | "star"; up: boolean }[] = [
    { name: "bolt", up: true },
    { name: "lock", up: false },
    { name: "star", up: true },
  ];
  return (
    <Frame palette={p} url={appUrl}>
      <div className="flex h-full flex-col gap-2.5 p-3">
        {/* balance card */}
        <div
          className="relative overflow-hidden rounded-lg p-3"
          style={{ background: `linear-gradient(135deg, ${withAlpha(p.accent, 0.16)}, ${p.surface})`, border: `1px solid ${p.stroke}` }}
        >
          <span className="text-[8px] uppercase tracking-widest" style={{ color: p.muted }}>Total balance</span>
          <div className="mt-1 flex items-end justify-between">
            <span className="text-base font-bold tracking-tight" style={{ color: p.text }}>$128,940.50</span>
            <span
              className="rounded px-1.5 py-0.5 text-[9px] font-bold"
              style={{ background: withAlpha(p.accent, 0.2), color: p.accent }}
            >
              +12.4%
            </span>
          </div>
        </div>

        {/* candlestick chart */}
        <div
          className="flex-1 rounded-lg p-2.5"
          style={{ background: p.surface, border: `1px solid ${p.stroke}` }}
        >
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[9px] font-semibold" style={{ color: p.accent }}>BTC / USD</span>
            <MiniGlyph name="chart" className="h-3.5 w-3.5" style={{ color: p.accent2 }} />
          </div>
          <div className="flex h-14 items-stretch justify-between gap-1">
            {candles.map((c, i) => {
              const color = c.up ? p.accent : p.accent2;
              return (
                <div key={i} className="relative flex flex-1 items-stretch justify-center">
                  {/* wick */}
                  <div
                    className="absolute w-px"
                    style={{ top: `${100 - c.h}%`, bottom: `${c.l}%`, background: color }}
                  />
                  {/* body */}
                  <div
                    className="relative w-1.5 rounded-[1px]"
                    style={{
                      marginTop: `${100 - Math.max(c.t, c.b)}%`,
                      marginBottom: `${Math.min(c.t, c.b)}%`,
                      background: color,
                    }}
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* token list */}
        <div className="space-y-1.5">
          {tokens.map((t, i) => (
            <div
              key={i}
              className="flex items-center gap-2 rounded-lg px-2 py-1.5"
              style={{ background: p.surface, border: `1px solid ${p.stroke}` }}
            >
              <span
                className="flex h-6 w-6 items-center justify-center rounded-md"
                style={{ background: withAlpha(p.accent, 0.14), color: p.accent }}
              >
                <MiniGlyph name={t.name} className="h-3.5 w-3.5" />
              </span>
              <Bar w={50} h={5} color={p.stroke} />
              <div className="ml-auto flex items-center gap-2">
                <Bar w={36} h={5} color={withAlpha(p.text, 0.4)} />
                <span
                  className="text-[9px] font-bold"
                  style={{ color: t.up ? p.accent : p.accent2 }}
                >
                  {t.up ? "▲" : "▼"}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Frame>
  );
}

/* ------------------------------------------------------------------ */
/* Dispatcher                                                          */
/* ------------------------------------------------------------------ */

export function Mockup({ family, className }: MockupProps) {
  const inner = (() => {
    switch (family) {
      case "arcade":
        return <ArcadeMockup family={family} />;
      case "nova":
        return <NovaMockup family={family} />;
      case "ember":
        return <EmberMockup family={family} />;
      case "vault":
        return <VaultMockup family={family} />;
      case "saas":
      default:
        return <SaasMockup family={family} />;
    }
  })();
  return <div className={cn("h-full", className)}>{inner}</div>;
}
