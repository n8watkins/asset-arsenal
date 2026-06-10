"use client";

// Fable Bench — the project-centric surface ("project ≠ chat").
//
// A scrollable view of EVERYTHING the project owns: the style blueprint, every
// source version (original + improvements), every preview sheet (including
// superseded, dimmed), and every final icon — each with its generation prompt
// in a collapsible, and every image clickable into the shared Lightbox.
//
// Phase 1 ships the component only; Phase 2 wires it behind a "Chat | Project"
// header tab on /fable.

import { useState } from "react";
import { slugify } from "@/lib/icon/download";
import { downloadZip, zipEntriesFromDataUrls } from "@/lib/zip";
import { useObjectUrl } from "@/lib/fable/use-object-url";
import type { FableProject, FableSourceImage } from "@/lib/fable/types";
import { CardAction, Lightbox, Pill, STAGE_LABELS } from "./ui";

const CHECKER = "repeating-conic-gradient(#27272a 0% 25%, #18181b 0% 50%) 50% / 16px 16px";

type LightboxState = { src: string; caption: string; downloadName?: string };

export default function ProjectView({ project }: { project: FableProject }) {
  const [enlarged, setEnlarged] = useState<LightboxState | null>(null);

  const sources: FableSourceImage[] = [
    ...(project.original ? [project.original] : []),
    ...project.improved,
  ];
  const successes = project.finals.filter((f) => f.status === "success" && f.imageUrl);

  function downloadAllZip() {
    const entries = zipEntriesFromDataUrls(
      successes.map((f) => ({ name: f.name, dataUrl: f.imageUrl })),
    );
    downloadZip(`${slugify(project.name)}.zip`, entries);
  }

  return (
    <div className="flex h-full flex-col gap-6 overflow-y-auto p-4">
      {/* ---- Header: name + stage + created ---- */}
      <div className="flex flex-wrap items-center gap-2.5">
        <h2 className="text-lg font-semibold text-zinc-100">{project.name}</h2>
        <Pill tone={project.stage === "complete" ? "emerald" : "cyan"}>
          {STAGE_LABELS[project.stage]}
        </Pill>
        <span className="text-xs text-zinc-500">
          created {new Date(project.createdAt).toLocaleDateString()}
        </span>
        <div className="ml-auto">
          <CardAction tone="cyan" onClick={downloadAllZip} disabled={successes.length === 0}>
            ⤓ Download all (.zip)
          </CardAction>
        </div>
      </div>

      {/* ---- Blueprint summary ---- */}
      {project.style && (
        <Section heading="Style blueprint" dot="bg-cyan-400" count={null}>
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
            <div className="flex flex-wrap items-baseline gap-2">
              <h3 className="text-base font-semibold text-zinc-100">
                {project.style.styleName}
              </h3>
            </div>
            <p className="mt-1 text-sm text-zinc-400">{project.style.summary}</p>

            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              {project.style.colorPalette.map((c, i) => (
                <Swatch key={i} color={c} />
              ))}
            </div>

            <div className="mt-3 flex flex-wrap gap-1.5">
              <Tag>{project.style.lineStyle}</Tag>
              <Tag>{project.style.shapeLanguage}</Tag>
              <Tag>{project.style.lighting}</Tag>
              {project.style.mood.map((m, i) => (
                <Tag key={i}>{m}</Tag>
              ))}
            </div>

            {project.sharedStylePrompt && (
              <PromptDetails label="Shared style prompt" text={project.sharedStylePrompt} />
            )}
          </div>
        </Section>
      )}

      {/* ---- Sources: original + every improved version ---- */}
      <Section heading="Sources" dot="bg-cyan-400" count={sources.length}>
        {sources.length === 0 ? (
          <Empty>No source image yet.</Empty>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {sources.map((s, i) => {
              const label =
                s.kind === "original"
                  ? (s.fileName ?? "original")
                  : `improved v${project.improved.indexOf(s) + 1}`;
              const approved = project.approvedSourceId === s.id;
              return (
                <figure
                  key={s.id ?? i}
                  className="flex flex-col gap-1.5 rounded-xl border border-zinc-800 bg-zinc-950 p-2"
                >
                  <Zoomable
                    src={s.imageUrl}
                    alt={label}
                    className="aspect-square w-full rounded-lg bg-zinc-900 object-contain"
                    onZoom={() => setEnlarged({ src: s.imageUrl, caption: label })}
                  />
                  <div className="flex items-center gap-1.5">
                    <span className="min-w-0 flex-1 truncate text-[11px] text-zinc-300">
                      {label}
                    </span>
                    <Pill tone={s.kind === "original" ? "zinc" : "violet"}>
                      {s.kind === "original" ? "uploaded" : "AI"}
                    </Pill>
                    {approved && <Pill tone="emerald">approved</Pill>}
                  </div>
                  {s.prompt && <PromptDetails label="Prompt" text={s.prompt} />}
                </figure>
              );
            })}
          </div>
        )}
      </Section>

      {/* ---- Preview sheets, superseded ones dimmed ---- */}
      <Section
        heading="Preview sheets"
        dot="bg-violet-400"
        count={project.sheets.length}
      >
        {project.sheets.length === 0 ? (
          <Empty>No preview sheets yet.</Empty>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
            {project.sheets.map((sheet) => {
              const label = `Sheet ${sheet.index}`;
              const dimmed = sheet.status === "superseded";
              return (
                <figure
                  key={sheet.id}
                  className={`flex flex-col gap-1.5 rounded-xl border border-zinc-800 bg-zinc-950 p-2 ${
                    dimmed ? "opacity-60" : ""
                  }`}
                >
                  <Zoomable
                    src={sheet.imageUrl}
                    alt={label}
                    className="w-full rounded-lg bg-zinc-900 object-contain"
                    onZoom={() => setEnlarged({ src: sheet.imageUrl, caption: label })}
                  />
                  <div className="flex items-center gap-1.5">
                    <span className="min-w-0 flex-1 truncate text-[11px] text-zinc-300">
                      {label}{" "}
                      <span className="text-zinc-600">
                        · {sheet.grid.rows}×{sheet.grid.cols}
                      </span>
                    </span>
                    <Pill
                      tone={
                        sheet.status === "approved"
                          ? "emerald"
                          : sheet.status === "superseded"
                            ? "zinc"
                            : "violet"
                      }
                    >
                      {sheet.status}
                    </Pill>
                  </div>
                  {sheet.prompt && <PromptDetails label="Sheet prompt" text={sheet.prompt} />}
                </figure>
              );
            })}
          </div>
        )}
      </Section>

      {/* ---- Final icons on a checkerboard ---- */}
      <Section heading="Final icons" dot="bg-emerald-400" count={project.finals.length}>
        {project.finals.length === 0 ? (
          <Empty>No final icons yet.</Empty>
        ) : (
          <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 md:grid-cols-5">
            {project.finals.map((f) => (
              <figure
                key={f.id}
                className="flex flex-col gap-1.5 rounded-xl border border-zinc-800 bg-zinc-950 p-2"
              >
                <div
                  className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-lg"
                  style={{ background: CHECKER }}
                >
                  {f.status === "success" && f.imageUrl ? (
                    <Zoomable
                      src={f.imageUrl}
                      alt={f.name}
                      className="h-full w-full object-contain"
                      onZoom={() =>
                        setEnlarged({ src: f.imageUrl, caption: f.name, downloadName: f.name })
                      }
                    />
                  ) : (
                    <span className="p-2 text-center text-[10px] text-zinc-500">
                      {f.status === "failed" ? (f.error ?? "failed") : f.status}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="min-w-0 flex-1 truncate text-[11px] text-zinc-300">
                    {f.name}
                  </span>
                  {f.status !== "success" && (
                    <Pill tone={f.status === "failed" ? "red" : "violet"}>{f.status}</Pill>
                  )}
                </div>
                {f.prompt && <PromptDetails label="Prompt" text={f.prompt} />}
              </figure>
            ))}
          </div>
        )}
      </Section>

      {enlarged && (
        <Lightbox
          src={enlarged.src}
          caption={enlarged.caption}
          downloadName={enlarged.downloadName ?? enlarged.caption}
          onClose={() => setEnlarged(null)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------------

function Section({
  heading,
  dot,
  count,
  children,
}: {
  heading: string;
  dot: string;
  count: number | null;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2.5">
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${dot}`} />
        <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-200">
          {heading}
        </h4>
        {count !== null && <span className="text-xs text-zinc-500">({count})</span>}
      </div>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="px-1 py-2 text-xs text-zinc-600">{children}</p>;
}

/** A data-URL image rendered via object URL, click-to-zoom into the Lightbox. */
function Zoomable({
  src,
  alt,
  className,
  onZoom,
}: {
  src: string;
  alt: string;
  className: string;
  onZoom: () => void;
}) {
  const displaySrc = useObjectUrl(src);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={displaySrc}
      alt={alt}
      title="Click to enlarge"
      className={`cursor-zoom-in ${className}`}
      onClick={onZoom}
    />
  );
}

/** Collapsible monospace block for prompts (shared style / sheet / per-icon). */
function PromptDetails({ label, text }: { label: string; text: string }) {
  return (
    <details className="group mt-1">
      <summary className="cursor-pointer select-none text-[10px] uppercase tracking-widest text-zinc-500 hover:text-zinc-300">
        {label}
      </summary>
      <pre className="mt-1.5 max-h-48 overflow-auto whitespace-pre-wrap rounded-lg bg-zinc-950/80 p-2.5 font-mono text-[11px] leading-relaxed text-zinc-400 ring-1 ring-zinc-800">
        {text}
      </pre>
    </details>
  );
}

function Swatch({ color }: { color: string }) {
  const hex = /^#?[0-9a-f]{3,8}$/i.test(color.trim());
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-zinc-950/60 px-1.5 py-1 ring-1 ring-zinc-800">
      <span
        className="h-4 w-4 rounded ring-1 ring-zinc-700"
        style={{
          backgroundColor: hex
            ? color.trim().startsWith("#")
              ? color.trim()
              : `#${color.trim()}`
            : "#3f3f46",
        }}
      />
      <span className="text-[10px] text-zinc-400">{color}</span>
    </span>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-md bg-zinc-800/70 px-1.5 py-0.5 text-[10px] text-zinc-300 ring-1 ring-zinc-700/50">
      {children}
    </span>
  );
}
