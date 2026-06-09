"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, ButtonLink, Card } from "@/components/ui";
import { cn } from "@/lib/cn";

/* ----------------------------------------------------------------- types -- */

interface ManifestIcon {
  key: string;
  name: string;
  concept?: string;
  /** included in the generate step */
  include: boolean;
}

interface GeneratedIcon {
  key: string;
  name: string;
  imageUrl?: string | null;
  status?: string;
}

const MAX_BYTES = 10 * 1024 * 1024; // 10MB
const ACCEPTED = ["image/png", "image/jpeg", "image/webp"];

type Step = 1 | 2 | 3 | 4;

/* ------------------------------------------------------------- component -- */

export function NewRunFlow({ creditsBalance }: { creditsBalance: number }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [step, setStep] = useState<Step>(1);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const [runId, setRunId] = useState<string | null>(null);
  const [manifest, setManifest] = useState<ManifestIcon[]>([]);
  const [results, setResults] = useState<GeneratedIcon[]>([]);

  const selectedCount = manifest.filter((m) => m.include).length;

  /* ------------------------------------------------------ step 1: upload -- */

  function handleFiles(files: FileList | null) {
    setError(null);
    const f = files?.[0];
    if (!f) return;
    if (!ACCEPTED.includes(f.type)) {
      setError("Please choose a PNG, JPG, or WEBP image.");
      return;
    }
    if (f.size > MAX_BYTES) {
      setError("That image is over 10MB. Please choose a smaller file.");
      return;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
  }

  async function uploadAndAnalyze() {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      // 1) Upload the source image.
      const form = new FormData();
      form.append("file", file);
      let sourceImageKey: string | undefined;
      let sourceImageUrl: string | undefined;
      try {
        const upRes = await fetch("/api/uploads", {
          method: "POST",
          body: form,
        });
        if (upRes.ok) {
          const up = await upRes.json();
          sourceImageKey = up.key ?? up.imageKey;
          sourceImageUrl = up.url ?? up.imageUrl;
        }
      } catch {
        // Upload endpoint may be stubbed/unavailable — continue with preview.
      }

      // 2) Create a run (kicks off analysis on the backend).
      const runRes = await fetch("/api/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceImageKey, sourceImageUrl }),
      });

      let data: {
        runId?: string;
        id?: string;
        iconManifest?: Array<{ key?: string; name?: string; concept?: string }>;
        manifest?: Array<{ key?: string; name?: string; concept?: string }>;
      } = {};
      if (runRes.ok) data = await runRes.json();

      setRunId(data.runId ?? data.id ?? null);

      const rawManifest = data.iconManifest ?? data.manifest ?? [];
      const normalized: ManifestIcon[] =
        rawManifest.length > 0
          ? rawManifest.map((m, i) => ({
              key: m.key ?? `icon_${String(i + 1).padStart(3, "0")}`,
              name: m.name ?? `Icon ${i + 1}`,
              concept: m.concept,
              include: true,
            }))
          : FALLBACK_MANIFEST();

      setManifest(normalized);
      setStep(2);
    } catch {
      // Resilient fallback so the flow stays usable without a real backend.
      setManifest(FALLBACK_MANIFEST());
      setStep(2);
      setError(
        "Couldn't reach the analysis service — showing a sample manifest.",
      );
    } finally {
      setBusy(false);
    }
  }

  /* --------------------------------------------------- step 2: manifest -- */

  function toggleIcon(key: string) {
    setManifest((prev) =>
      prev.map((m) => (m.key === key ? { ...m, include: !m.include } : m)),
    );
  }

  function renameIcon(key: string, name: string) {
    setManifest((prev) =>
      prev.map((m) => (m.key === key ? { ...m, name } : m)),
    );
  }

  /* --------------------------------------------------- step 3: generate -- */

  async function generate() {
    if (selectedCount === 0) {
      setError("Select at least one icon to generate.");
      return;
    }
    if (!runId) {
      setError("This run isn't ready yet. Please re-analyze your image.");
      return;
    }
    setBusy(true);
    setError(null);
    setStep(4);
    try {
      const selected = manifest.filter((m) => m.include);
      const res = await fetch(`/api/runs/${runId}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          icons: selected.map((m) => ({ key: m.key, name: m.name })),
        }),
      });

      let data: { icons?: GeneratedIcon[]; generatedIcons?: GeneratedIcon[] } =
        {};
      if (res.ok) data = await res.json();

      const raw = data.icons ?? data.generatedIcons ?? [];
      const normalized: GeneratedIcon[] =
        raw.length > 0
          ? raw.map((g, i) => ({
              key: g.key ?? selected[i]?.key ?? `icon_${i}`,
              name: g.name ?? selected[i]?.name ?? `Icon ${i + 1}`,
              imageUrl: g.imageUrl ?? null,
              status: g.status ?? "success",
            }))
          : selected.map((m) => ({
              key: m.key,
              name: m.name,
              imageUrl: null,
              status: "pending",
            }));

      setResults(normalized);
    } catch {
      setResults(
        manifest
          .filter((m) => m.include)
          .map((m) => ({
            key: m.key,
            name: m.name,
            imageUrl: null,
            status: "pending",
          })),
      );
      setError(
        "Generation service is unavailable right now — your selection was saved.",
      );
    } finally {
      setBusy(false);
    }
  }

  /* ----------------------------------------------------------- render -- */

  return (
    <div className="space-y-6">
      <Stepper current={step} />

      {error && (
        <div className="rounded-lg border border-border bg-surface-2 px-4 py-3 text-sm text-muted">
          {error}
        </div>
      )}

      {/* Step 1 — Upload */}
      {step === 1 && (
        <Card className="space-y-5">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              handleFiles(e.dataTransfer.files);
            }}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              "flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-12 text-center transition-colors",
              dragOver
                ? "border-primary bg-primary/10"
                : "border-border hover:border-foreground/30 hover:bg-surface-2/40",
            )}
          >
            {previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewUrl}
                alt="Source preview"
                className="max-h-56 rounded-lg object-contain"
              />
            ) : (
              <>
                <span
                  className={cn(
                    "mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-surface-2 transition-colors",
                    dragOver ? "border-primary/40 text-accent" : "text-muted",
                  )}
                >
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M12 16V4m0 0L8 8m4-4 4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <p className="text-sm font-medium text-foreground">
                  Drag &amp; drop an image, or{" "}
                  <span className="text-accent">click to browse</span>
                </p>
                <p className="mt-1 text-xs text-muted">
                  PNG, JPG, or WEBP · up to 10MB
                </p>
              </>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED.join(",")}
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />
          </div>

          {file && (
            <p className="text-xs text-muted">
              {file.name} · {(file.size / 1024 / 1024).toFixed(1)}MB
            </p>
          )}

          <div className="flex justify-end">
            <Button onClick={uploadAndAnalyze} disabled={!file || busy}>
              {busy ? "Analyzing…" : "Analyze image"}
            </Button>
          </div>
        </Card>
      )}

      {/* Step 2 — Manifest */}
      {step === 2 && (
        <Card className="space-y-5">
          <div>
            <h2 className="text-base font-semibold text-foreground">
              Detected icons
            </h2>
            <p className="mt-1 text-xs text-muted">
              Include the icons you want and tweak their names.
            </p>
          </div>

          <ul className="divide-y divide-border">
            {manifest.map((icon) => (
              <li key={icon.key} className="flex items-center gap-3 py-3">
                <input
                  type="checkbox"
                  checked={icon.include}
                  onChange={() => toggleIcon(icon.key)}
                  className="h-4 w-4 accent-[var(--color-primary)]"
                />
                <input
                  value={icon.name}
                  onChange={(e) => renameIcon(icon.key, e.target.value)}
                  className="min-w-0 flex-1 rounded-md border border-border bg-surface-2 px-3 py-1.5 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                {icon.concept && (
                  <span className="hidden truncate text-xs text-muted sm:block">
                    {icon.concept}
                  </span>
                )}
              </li>
            ))}
          </ul>

          <div className="flex items-center justify-between">
            <Button variant="ghost" onClick={() => setStep(1)}>
              ← Back
            </Button>
            <Button onClick={() => setStep(3)} disabled={selectedCount === 0}>
              Continue ({selectedCount} selected)
            </Button>
          </div>
        </Card>
      )}

      {/* Step 3 — Generate */}
      {step === 3 && (
        <Card className="space-y-5">
          <h2 className="text-base font-semibold text-foreground">
            Confirm &amp; generate
          </h2>
          <div className="rounded-xl border border-border bg-surface-2 p-4 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted">Icons to generate</span>
              <span className="font-medium text-foreground">
                {selectedCount}
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-muted">Cost (1 credit = 1 icon)</span>
              <span className="font-medium text-foreground">
                {selectedCount} credit{selectedCount === 1 ? "" : "s"}
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-muted">Your balance</span>
              <span className="font-medium text-foreground">
                {creditsBalance} credits
              </span>
            </div>
          </div>

          {selectedCount > creditsBalance && (
            <div className="rounded-lg border border-border bg-surface-2 px-4 py-3 text-sm text-muted">
              You need more credits for this run.{" "}
              <ButtonLink href="/app/credits" size="sm" className="ml-2">
                Buy credits
              </ButtonLink>
            </div>
          )}

          <div className="flex items-center justify-between">
            <Button variant="ghost" onClick={() => setStep(2)}>
              ← Back
            </Button>
            <Button
              onClick={generate}
              disabled={busy || selectedCount > creditsBalance}
            >
              {busy ? "Generating…" : `Generate ${selectedCount} icons`}
            </Button>
          </div>
        </Card>
      )}

      {/* Step 4 — Results */}
      {step === 4 && (
        <Card className="space-y-5">
          <h2 className="text-base font-semibold text-foreground">
            {busy ? "Generating your icons…" : "Your icons"}
          </h2>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {results.map((icon) => (
              <div
                key={icon.key}
                className="group/icon flex flex-col items-center gap-2.5 rounded-xl border border-border bg-surface-2 p-4 text-center transition-colors hover:border-foreground/25"
              >
                <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-lg border border-border bg-background">
                  {icon.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={icon.imageUrl}
                      alt={icon.name}
                      className="h-full w-full object-contain"
                    />
                  ) : busy ? (
                    <span
                      className="h-5 w-5 animate-spin rounded-full border-2 border-border border-t-accent"
                      aria-label="Generating"
                    />
                  ) : (
                    <span className="text-[10px] font-medium uppercase tracking-wide text-muted">
                      pending
                    </span>
                  )}
                </div>
                <p className="w-full truncate text-xs font-medium text-foreground">
                  {icon.name}
                </p>
                {icon.imageUrl && (
                  <a
                    href={icon.imageUrl}
                    download={`${icon.name}.png`}
                    className="inline-flex items-center gap-1 text-xs font-medium text-accent transition-colors hover:text-foreground"
                  >
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                      <path d="M6 1.5v6m0 0L3.75 5.25M6 7.5l2.25-2.25M2 9.5h8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    Download
                  </a>
                )}
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between gap-3">
            <Button variant="ghost" onClick={() => router.push("/app")}>
              Done
            </Button>
            {runId && (
              <ButtonLink href={`/app/runs/${runId}`} variant="secondary">
                View run
              </ButtonLink>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}

/* ------------------------------------------------------------- helpers -- */

function Stepper({ current }: { current: Step }) {
  const steps: Array<{ n: Step; label: string }> = [
    { n: 1, label: "Upload" },
    { n: 2, label: "Review" },
    { n: 3, label: "Generate" },
    { n: 4, label: "Results" },
  ];
  return (
    <ol className="flex items-center gap-1 text-xs sm:gap-2">
      {steps.map((s, i) => {
        const done = current > s.n;
        const active = current === s.n;
        return (
          <li key={s.n} className="flex items-center gap-1.5 sm:gap-2">
            <span
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-full border text-[11px] font-semibold transition-colors",
                active
                  ? "border-primary bg-primary text-primary-foreground shadow-sm shadow-primary/30"
                  : done
                    ? "border-primary/40 bg-primary/15 text-accent"
                    : "border-border text-muted",
              )}
            >
              {done ? (
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                  <path d="M2.5 6.2l2.2 2.3L9.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : (
                s.n
              )}
            </span>
            <span
              className={cn(
                "hidden font-medium sm:inline",
                current >= s.n ? "text-foreground" : "text-muted",
              )}
            >
              {s.label}
            </span>
            {i < steps.length - 1 && (
              <span
                className={cn(
                  "mx-1 h-px w-4 transition-colors sm:w-8",
                  done ? "bg-primary/40" : "bg-border",
                )}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

function FALLBACK_MANIFEST(): ManifestIcon[] {
  return [
    { key: "icon_001", name: "Home", concept: "house outline", include: true },
    { key: "icon_002", name: "Search", concept: "magnifier", include: true },
    { key: "icon_003", name: "Settings", concept: "gear", include: true },
    { key: "icon_004", name: "Profile", concept: "person", include: true },
    { key: "icon_005", name: "Bell", concept: "notification", include: true },
  ];
}
