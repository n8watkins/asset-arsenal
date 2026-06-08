"use client";

import { useState } from "react";
import type {
  IconManifest,
  IndividualIconPrompts,
  GeneratedIcon,
  Confidence,
  GeneratedIconStatus,
} from "@/types/icon-pipeline";

// ---------------------------------------------------------------------------
// Bench "interpreted result" views.
//
// Every step emits two views: the *raw* AI/JSON response, and the *interpreted*
// result — i.e. what we'd actually render to a user in a real product
// (a readable icon list, a downloadable rendered image, prompt cards) rather
// than raw base64 or JSON. OutputTabs wraps both; InterpretedResult renders the
// user-facing view for each kind of step output.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Small shared primitives
// ---------------------------------------------------------------------------

function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          /* clipboard unavailable — no-op */
        }
      }}
      className="rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-xs font-medium text-cyan-300/90 transition-colors hover:border-cyan-500/60 hover:text-cyan-200 focus:outline-none focus:ring-2 focus:ring-cyan-500"
    >
      {copied ? "Copied!" : label}
    </button>
  );
}

const CONFIDENCE_STYLES: Record<Confidence, string> = {
  high: "bg-emerald-900/40 text-emerald-300 border-emerald-700/40",
  medium: "bg-amber-900/40 text-amber-300 border-amber-700/40",
  low: "bg-zinc-800 text-zinc-400 border-zinc-700",
};

function ConfidenceBadge({ confidence }: { confidence: Confidence }) {
  return (
    <span
      className={`rounded-md border px-2 py-0.5 font-mono text-[11px] uppercase tracking-wide ${CONFIDENCE_STYLES[confidence]}`}
    >
      {confidence}
    </span>
  );
}

const STATUS_STYLES: Record<GeneratedIconStatus, string> = {
  success: "bg-emerald-900/40 text-emerald-300 border-emerald-700/40",
  generating: "bg-cyan-900/40 text-cyan-300 border-cyan-700/40",
  pending: "bg-zinc-800 text-zinc-400 border-zinc-700",
  failed: "bg-red-950/40 text-red-300 border-red-800/40",
};

function StatusBadge({ status }: { status: GeneratedIconStatus }) {
  return (
    <span
      className={`rounded-md border px-2 py-0.5 font-mono text-[11px] uppercase tracking-wide ${STATUS_STYLES[status]}`}
    >
      {status}
    </span>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-0.5 font-mono text-xs text-zinc-300">
      {children}
    </span>
  );
}

function LabeledRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline gap-2 text-sm">
      <span className="text-zinc-500">{label}:</span>
      <span className="text-zinc-200">{value}</span>
    </div>
  );
}

// Button-styled anchor (download / open links).
function LinkButton({
  href,
  download,
  target,
  children,
}: {
  href: string;
  download?: string;
  target?: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      download={download}
      target={target}
      rel={target === "_blank" ? "noopener noreferrer" : undefined}
      className="inline-flex items-center rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm font-medium text-cyan-300/90 transition-colors hover:border-cyan-500/60 hover:text-cyan-200 focus:outline-none focus:ring-2 focus:ring-cyan-500"
    >
      {children}
    </a>
  );
}

// ---------------------------------------------------------------------------
// 1) OutputTabs — wraps the raw + interpreted views with a tab switcher.
// ---------------------------------------------------------------------------

function RawView({ rawData }: { rawData: unknown }) {
  // Don't dump giant base64 data URLs — show a compact note instead.
  if (typeof rawData === "string" && rawData.startsWith("data:")) {
    const kb = Math.round(rawData.length / 1024);
    return (
      <p className="font-mono text-sm text-zinc-400">
        base64 image data (≈ {kb} KB)
      </p>
    );
  }

  const text =
    typeof rawData === "string" ? rawData : JSON.stringify(rawData, null, 2);

  return (
    <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-xl border border-zinc-800 bg-zinc-950 p-4 font-mono text-sm text-zinc-300">
      {text}
    </pre>
  );
}

export function OutputTabs({
  empty,
  rawData,
  interpreted,
}: {
  empty: boolean;
  rawData: unknown;
  interpreted: React.ReactNode;
}) {
  const [tab, setTab] = useState<"interpreted" | "raw">("interpreted");

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-zinc-700/60 bg-zinc-950/60 p-5">
      <div className="flex items-center gap-3">
        <span className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
          Output
        </span>
        {!empty && (
          <div className="ml-auto flex gap-1 rounded-lg border border-zinc-800 bg-zinc-900 p-0.5">
            {(["interpreted", "raw"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`rounded-md px-3 py-1 text-xs font-medium capitalize transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500 ${
                  tab === t
                    ? "bg-violet-600 text-white"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        )}
      </div>

      {empty ? (
        <p className="text-sm italic text-zinc-600">
          Run this step to see output here.
        </p>
      ) : tab === "interpreted" ? (
        interpreted
      ) : (
        <RawView rawData={rawData} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 2) InterpretedResult — the user-facing view for each kind of step output.
// ---------------------------------------------------------------------------

function Caption({ children }: { children: React.ReactNode }) {
  return <p className="text-xs italic text-zinc-500">{children}</p>;
}

// --- manifest ---------------------------------------------------------------

function ManifestView({ data }: { data: IconManifest }) {
  const style = data.sharedIconFamilyStyle;
  return (
    <div className="flex flex-col gap-5">
      <Caption>
        What we&apos;d show a user after analysis — the detected icons and the
        shared family style.
      </Caption>
      <h3 className="text-lg font-semibold text-zinc-100">
        {data.iconCount} {data.iconCount === 1 ? "icon" : "icons"} detected
      </h3>

      {/* Shared family style */}
      <div className="flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
        <span className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
          Shared family style
        </span>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-zinc-500">palette:</span>
          {style.colorPalette.map((c, i) => (
            <span
              key={`${c}-${i}`}
              className="inline-flex items-center gap-1.5 rounded-md border border-zinc-700 bg-zinc-900 px-2 py-0.5 font-mono text-xs text-zinc-300"
            >
              <span
                aria-hidden
                className="inline-block h-3 w-3 rounded-sm border border-zinc-600"
                style={{ background: c }}
              />
              {c}
            </span>
          ))}
        </div>
        <LabeledRow label="line style" value={style.lineStyle} />
        <LabeledRow label="shape language" value={style.shapeLanguage} />
        <LabeledRow label="glow" value={style.glowStyle ?? "none"} />
        <LabeledRow label="background" value={style.backgroundRule} />
        {style.negativeRules.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-zinc-500">avoid:</span>
            {style.negativeRules.map((r, i) => (
              <Chip key={`${r}-${i}`}>{r}</Chip>
            ))}
          </div>
        )}
      </div>

      {/* Icon cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {data.icons.map((icon) => (
          <div
            key={icon.id}
            className="flex flex-col gap-1.5 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-zinc-100">{icon.name}</span>
              <ConfidenceBadge confidence={icon.confidence} />
            </div>
            <p className="text-sm text-zinc-300">{icon.concept}</p>
            <p className="text-xs text-zinc-500">where: {icon.whereVisible}</p>
          </div>
        ))}
      </div>

      {data.excludedAsNonIcons.length > 0 && (
        <p className="text-xs text-zinc-500">
          Excluded as non-icons: {data.excludedAsNonIcons.join(", ")}
        </p>
      )}
    </div>
  );
}

// --- collectionPrompt -------------------------------------------------------

function CollectionPromptView({ data }: { data: string }) {
  return (
    <div className="flex flex-col gap-3">
      <Caption>The image-generation prompt we&apos;d feed forward.</Caption>
      <div className="flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
        <div className="flex items-center">
          <span className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
            Collection prompt
          </span>
          <span className="ml-auto">
            <CopyButton text={data} />
          </span>
        </div>
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-200">
          {data}
        </p>
      </div>
    </div>
  );
}

// --- collectionImage --------------------------------------------------------

function CollectionImageView({ data }: { data: { imageUrl: string } }) {
  return (
    <div className="flex flex-col gap-3">
      <Caption>
        Rendered inline from a base64 PNG — no hosted URL.
      </Caption>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={data.imageUrl}
        alt="collection image"
        className="max-w-full rounded-xl border border-zinc-700 bg-zinc-950 object-contain"
      />
      <div className="flex flex-wrap gap-2">
        <LinkButton href={data.imageUrl} download="collection-image.png">
          Download
        </LinkButton>
        <LinkButton href={data.imageUrl} target="_blank">
          Open in new tab
        </LinkButton>
      </div>
    </div>
  );
}

// --- individualPrompts ------------------------------------------------------

function IndividualPromptsView({ data }: { data: IndividualIconPrompts }) {
  return (
    <div className="flex flex-col gap-4">
      <Caption>
        The per-icon prompts we&apos;d feed forward to image generation.
      </Caption>

      <div className="flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
        <div className="flex items-center">
          <span className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
            Shared style prompt
          </span>
          <span className="ml-auto">
            <CopyButton text={data.sharedStylePrompt} />
          </span>
        </div>
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-200">
          {data.sharedStylePrompt}
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {data.iconPrompts.map((p) => (
          <div
            key={p.iconId}
            className="flex flex-col gap-1.5 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-zinc-100">{p.iconName}</span>
              <CopyButton text={p.prompt} />
            </div>
            <p className="text-sm text-zinc-300">{p.concept}</p>
            <p className="text-xs text-zinc-500">
              in collection image: {p.collectionImageReference}
            </p>
            <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-zinc-200">
              {p.prompt}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- icon (single) ----------------------------------------------------------

// Checkered backdrop so transparency is visible.
const CHECKER_STYLE: React.CSSProperties = {
  backgroundImage:
    "linear-gradient(45deg, #27272a 25%, transparent 25%), linear-gradient(-45deg, #27272a 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #27272a 75%), linear-gradient(-45deg, transparent 75%, #27272a 75%)",
  backgroundSize: "16px 16px",
  backgroundPosition: "0 0, 0 8px, 8px -8px, -8px 0",
  backgroundColor: "#18181b",
};

function IconCard({ icon }: { icon: GeneratedIcon }) {
  const failed = icon.status === "failed";
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-zinc-800 bg-zinc-900/60 p-3">
      <div
        className="flex aspect-square items-center justify-center overflow-hidden rounded-lg border border-zinc-800"
        style={failed ? undefined : CHECKER_STYLE}
      >
        {failed || !icon.imageUrl ? (
          <span className="px-2 text-center text-sm text-red-400">
            {icon.error ?? "failed"}
          </span>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={icon.imageUrl}
            alt={icon.iconName}
            className="h-full w-full object-contain p-2"
          />
        )}
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-sm font-medium text-zinc-200">
          {icon.iconName}
        </span>
        <StatusBadge status={icon.status} />
      </div>
      {!failed && icon.imageUrl && (
        <LinkButton href={icon.imageUrl} download={`${icon.iconName}.png`}>
          Download
        </LinkButton>
      )}
    </div>
  );
}

function IconView({ data }: { data: GeneratedIcon }) {
  return (
    <div className="flex flex-col gap-3">
      <Caption>The generated icon, as a user would download it.</Caption>
      <div className="max-w-xs">
        <IconCard icon={data} />
      </div>
    </div>
  );
}

// --- icons (batch) ----------------------------------------------------------

function IconsView({ data }: { data: GeneratedIcon[] }) {
  const ok = data.filter((g) => g.status === "success").length;
  return (
    <div className="flex flex-col gap-3">
      <Caption>The full generated icon set, ready to download.</Caption>
      <p className="font-mono text-sm text-cyan-300">
        {ok}/{data.length} succeeded
      </p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {data.map((icon) => (
          <IconCard key={icon.id} icon={icon} />
        ))}
      </div>
    </div>
  );
}

// --- dispatcher -------------------------------------------------------------

export function InterpretedResult(
  props:
    | { kind: "manifest"; data: IconManifest }
    | { kind: "collectionPrompt"; data: string }
    | { kind: "collectionImage"; data: { imageUrl: string } }
    | { kind: "individualPrompts"; data: IndividualIconPrompts }
    | { kind: "icon"; data: GeneratedIcon }
    | { kind: "icons"; data: GeneratedIcon[] },
): React.ReactElement {
  switch (props.kind) {
    case "manifest":
      return <ManifestView data={props.data} />;
    case "collectionPrompt":
      return <CollectionPromptView data={props.data} />;
    case "collectionImage":
      return <CollectionImageView data={props.data} />;
    case "individualPrompts":
      return <IndividualPromptsView data={props.data} />;
    case "icon":
      return <IconView data={props.data} />;
    case "icons":
      return <IconsView data={props.data} />;
  }
}
