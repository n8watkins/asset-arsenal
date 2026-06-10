"use client";

// Fable Bench — the orchestrating client hook.
//
// Owns ONE FableProject and executes agent decisions against the step routes.
// Everything is in-memory + auto-persisted to IndexedDB (lib/fable/store.ts).
//
// The mental model: the user (or a quick-action chip) sends a message; the agent
// route classifies it into an intent + ops; then EXECUTE() runs the matching
// step routes, mutating the project and appending events/usage as it goes. The
// same internals back the manual Dev-Mode / Live buttons, so a click and a
// sentence travel the same path.
//
// CROSS-CHAT SAFETY: every async executor captures the project id at start and
// funnels all writes through mutateFor(pid, fn) — if the user switches chats
// mid-generation, orphaned executors no-op their mutations and their loops
// stop, so artifacts/usage never bleed into the wrong project. Usage is still
// recorded to the GLOBAL ledger (lib/icon/usage-log) under the originating
// project id — the call happened and cost money regardless.

import { useCallback, useEffect, useRef, useState } from "react";
import {
  postAgent,
  postAnalyze,
  postFinalIcon,
  postImproveSource,
  postPreviewSheet,
  postRevisePrompts,
} from "./client-api";
import {
  approvedSource,
  chunkForSheets,
  DEFAULT_FABLE_MODEL_CONFIG,
  FABLE_LIMITS,
  summarizeProject,
  type FableDecision,
  type FableEvent,
  type FableFinalIcon,
  type FableModelConfig,
  type FableOp,
  type FableProject,
  type FableSourceImage,
  type FableStepKey,
  type FableUsageRecord,
  type IconCandidate,
  type PreviewSheet,
} from "./types";
import { saveProject } from "./store";
import { getFableSettings } from "./settings";
import { IMAGE_UPLOAD_LIMITS, MAX_FILE_SIZE_BYTES } from "@/lib/icon/models";
import { imageCostUSD } from "@/lib/icon/model-reference";
import { logUsage } from "@/lib/icon/usage-log";

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

// Distributive Omit so omitting keys from a discriminated union preserves each
// member's remaining shape (a plain Omit collapses the union).
type DistributiveOmit<T, K extends keyof T> = T extends unknown ? Omit<T, K> : never;

function now(): string {
  return new Date().toISOString();
}

function uid(): string {
  return crypto.randomUUID();
}

function estUsd(n: number): string {
  return n >= 0.01 ? `$${n.toFixed(3)}` : `$${n.toFixed(4)}`;
}

function freshProject(): FableProject {
  const ts = now();
  return {
    id: uid(),
    name: "Untitled project",
    createdAt: ts,
    updatedAt: ts,
    stage: "intake",
    original: null,
    improved: [],
    approvedSourceId: null,
    style: null,
    sharedStylePrompt: null,
    candidates: [],
    sheets: [],
    finals: [],
    models: { ...DEFAULT_FABLE_MODEL_CONFIG },
    usage: [],
    events: [],
  };
}

/** Read a File into a data URL, validating type/size against the upload limits.
 *  When the global downscale setting is on and the image's longest edge exceeds
 *  the cap, the image is decoded + redrawn at the cap (aspect preserved):
 *  PNG stays PNG (transparency), everything else becomes JPEG q0.92. */
async function fileToDataUrl(file: File): Promise<string> {
  if (!(IMAGE_UPLOAD_LIMITS.allowedMimeTypes as readonly string[]).includes(file.type)) {
    throw new Error(
      `Unsupported type "${file.type || "unknown"}". Allowed: PNG, JPEG, WebP.`,
    );
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error(
      `${(file.size / 1024 / 1024).toFixed(1)} MB exceeds the ${IMAGE_UPLOAD_LIMITS.maxFileSizeMB} MB limit.`,
    );
  }

  const { downscaleMaxEdge } = getFableSettings();
  if (downscaleMaxEdge > 0) {
    try {
      const bitmap = await createImageBitmap(file);
      const longest = Math.max(bitmap.width, bitmap.height);
      if (longest > downscaleMaxEdge) {
        const scale = downscaleMaxEdge / longest;
        const w = Math.max(1, Math.round(bitmap.width * scale));
        const h = Math.max(1, Math.round(bitmap.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(bitmap, 0, 0, w, h);
          bitmap.close();
          // PNG keeps transparency; everything else re-encodes as JPEG.
          return file.type === "image/png"
            ? canvas.toDataURL("image/png")
            : canvas.toDataURL("image/jpeg", 0.92);
        }
      }
      bitmap.close();
    } catch {
      /* decode/draw failed — fall through to the verbatim read below */
    }
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read the image file."));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });
}

/** A project that never got a message or an image — not worth persisting. */
function isEmptyProject(p: FableProject): boolean {
  return p.events.length === 0 && !p.original && p.improved.length === 0;
}

// Intents that should adopt a NEW image attached mid-project (B7).
const SOURCE_ACTING_INTENTS = new Set(["upgrade_source", "use_source_as_is", "revise_source"]);

// ---------------------------------------------------------------------------
// Hook types
// ---------------------------------------------------------------------------

export type FableBusy = { step: FableStepKey | null; detail: string };

export type PendingDecision = {
  decision: FableDecision;
  text: string;
  /** New image attached on the turn that produced this decision. */
  imageUrl?: string | null;
  /** Custom executor for synthetic cost-confirm gates; overrides executeDecision. */
  run?: (projectId: string) => Promise<void>;
};

export type FableLastRawError = { at: string; raw: unknown };

export type UseFable = {
  project: FableProject;
  busy: FableBusy;
  error: string | null;
  devMode: boolean;
  pendingDecision: PendingDecision | null;
  /** Most recent raw error payload a route returned (for the Dev drawer). */
  lastRawError: FableLastRawError | null;

  setDevMode: (on: boolean) => void;
  clearError: () => void;

  newProject: () => void;
  openProject: (p: FableProject) => void;
  renameProject: (name: string) => void;
  setModelConfig: (patch: Partial<FableModelConfig>) => void;

  sendMessage: (text: string, imageFile?: File | null) => Promise<void>;
  confirmPending: () => Promise<void>;
  dismissPending: () => void;

  // Manual controls (Dev Mode + Live buttons) — thin wrappers over internals.
  approveSource: () => Promise<void>;
  regenerateSource: (instruction: string) => Promise<void>;
  runAnalyze: (guidance?: string) => Promise<void>;
  runPreviews: () => Promise<void>;
  approveAndGenerateFinals: () => Promise<void>;
  approveSheetAndGenerateFinals: (sheetId: string) => Promise<void>;
  retryFinal: (iconId: string) => Promise<void>;
  regenerateSheet: (sheetId: string, instruction: string) => Promise<void>;
  removeCandidate: (id: string) => void;
  updateCandidate: (id: string, patch: Partial<IconCandidate>) => void;

  // Mechanical card actions — structured executors, NO agent round-trip.
  reviseIconsDirect: (ops: FableOp[], description: string) => Promise<void>;
  tryAnotherSheet: (sheetId: string, instruction: string) => Promise<void>;
  regenerateFinal: (iconId: string) => Promise<void>;
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useFable(): UseFable {
  const [project, setProject] = useState<FableProject>(() => freshProject());
  const [busy, setBusy] = useState<FableBusy>({ step: null, detail: "" });
  const [error, setError] = useState<string | null>(null);
  const [devMode, setDevMode] = useState(false);
  const [pendingDecision, setPendingDecision] = useState<PendingDecision | null>(null);
  const [lastRawError, setLastRawError] = useState<FableLastRawError | null>(null);

  // A ref mirror of the latest project so async executors read fresh state
  // without stale closures, and so we never lose intermediate mutations.
  const projectRef = useRef(project);
  projectRef.current = project;

  // Busy mirrored in a ref so synchronous gates (double-send) never read a
  // stale closure value.
  const busyRef = useRef<FableBusy>(busy);

  const setBusyAll = useCallback((b: FableBusy) => {
    busyRef.current = b;
    setBusy(b);
  }, []);

  /** True while `pid` is still the project on screen. */
  const isCurrent = useCallback((pid: string) => projectRef.current.id === pid, []);

  /** Busy updates from an executor only land while its project is current. */
  const setBusyFor = useCallback(
    (pid: string, b: FableBusy) => {
      if (isCurrent(pid)) setBusyAll(b);
    },
    [isCurrent, setBusyAll],
  );

  // ---- persistence (debounced auto-save on every mutation) ----------------

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipNextSave = useRef(false);

  useEffect(() => {
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }
    // Empty chats never persist — no events, no image, nothing to keep.
    if (isEmptyProject(projectRef.current)) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveTimer.current = null;
      void saveProject(projectRef.current);
    }, 500);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [project]);

  /** Run a pending debounced save NOW (unmount / before swapping projects). */
  const flushPendingSave = useCallback(() => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
      if (!isEmptyProject(projectRef.current)) void saveProject(projectRef.current);
    }
  }, []);

  // Unmount: FLUSH a pending debounced save instead of dropping it.
  useEffect(() => () => flushPendingSave(), [flushPendingSave]);

  // Central mutator: applies a patch fn, bumps updatedAt, keeps the ref fresh.
  const mutate = useCallback(
    (fn: (p: FableProject) => FableProject): FableProject => {
      const next = { ...fn(projectRef.current), updatedAt: now() };
      projectRef.current = next;
      setProject(next);
      return next;
    },
    [],
  );

  /** mutate, but ONLY while `pid` is still the current project — async
   *  executors use this so a chat switch mid-flight can't contaminate the
   *  newly opened project. Returns the next project, or null if skipped. */
  const mutateFor = useCallback(
    (pid: string, fn: (p: FableProject) => FableProject): FableProject | null => {
      if (!isCurrent(pid)) return null;
      return mutate(fn);
    },
    [isCurrent, mutate],
  );

  const appendEvent = useCallback(
    (pid: string, ev: DistributiveOmit<FableEvent, "id" | "at">) => {
      mutateFor(pid, (p) => ({
        ...p,
        events: [...p.events, { id: uid(), at: now(), ...ev } as FableEvent],
      }));
    },
    [mutateFor],
  );

  const appendUsage = useCallback(
    (pid: string, usage: FableUsageRecord[]) => {
      if (!usage?.length) return;
      // Global ledger first (fire-and-forget; logUsage never throws) — even if
      // the user switched chats, the spend happened under `pid`.
      for (const u of usage) {
        try {
          void logUsage({
            at: u.at,
            step: u.step,
            model: u.model,
            kind: u.kind,
            quality: u.quality,
            count: u.imageCount ?? 1,
            estCost: u.estCostUSD,
            realizedCost: u.ok ? u.estCostUSD : 0,
            inputTokens: u.inputTokens,
            outputTokens: u.outputTokens,
            ok: u.ok,
            error: u.error,
            bench: "fable",
            provider: u.provider,
            projectId: pid,
            durationMs: u.durationMs,
          });
        } catch {
          /* logging must never affect the flow */
        }
      }
      mutateFor(pid, (p) => ({ ...p, usage: [...p.usage, ...usage] }));
    },
    [mutateFor],
  );

  const appendStep = useCallback(
    (pid: string, step: FableStepKey, ok: boolean, detail: string) => {
      appendEvent(pid, { kind: "step", step, ok, detail });
    },
    [appendEvent],
  );

  /** Harvest what a failed call still produced: usage records (→ project ledger
   *  + global ledger) and the raw error payload (→ Dev drawer). */
  const noteFailure = useCallback(
    (pid: string, err: unknown) => {
      if (!err || typeof err !== "object") return;
      const e = err as { usage?: unknown; raw?: unknown };
      if (Array.isArray(e.usage) && e.usage.length > 0) {
        appendUsage(pid, e.usage as FableUsageRecord[]);
      }
      if (e.raw !== undefined) setLastRawError({ at: now(), raw: e.raw });
    },
    [appendUsage],
  );

  // ---- project lifecycle --------------------------------------------------

  const newProject = useCallback(() => {
    flushPendingSave(); // don't drop the outgoing project's last edits
    setPendingDecision(null);
    setError(null);
    setBusyAll({ step: null, detail: "" });
    const p = freshProject();
    projectRef.current = p;
    skipNextSave.current = true;
    setProject(p);
    // Deliberately NOT saved — empty chats never hit the store (see autosave).
  }, [flushPendingSave, setBusyAll]);

  const openProject = useCallback(
    (p: FableProject) => {
      flushPendingSave(); // don't drop the outgoing project's last edits
      setPendingDecision(null);
      setError(null);
      setBusyAll({ step: null, detail: "" });
      skipNextSave.current = true; // don't immediately re-save what we just loaded
      const next = p.models ? p : { ...p, models: { ...DEFAULT_FABLE_MODEL_CONFIG } };
      projectRef.current = next;
      setProject(next);
    },
    [flushPendingSave, setBusyAll],
  );

  const renameProject = useCallback(
    (name: string) => {
      mutate((p) => ({ ...p, name: name.trim() || "Untitled project" }));
    },
    [mutate],
  );

  const setModelConfig = useCallback(
    (patch: Partial<FableModelConfig>) => {
      mutate((p) => ({ ...p, models: { ...p.models, ...patch } }));
    },
    [mutate],
  );

  const clearError = useCallback(() => setError(null), []);

  // ---- step internals -----------------------------------------------------
  // Each takes the OWNING project id, mutates the project + records usage and
  // steps via the pid-scoped helpers, and throws on failure so callers can
  // surface `error`.

  const runImproveSource = useCallback(
    async (pid: string, sourceImageUrl: string, instruction: string): Promise<void> => {
      const { models } = projectRef.current;
      setBusyFor(pid, { step: "improve_source_image", detail: "Upgrading your source…" });
      const res = await postImproveSource({
        imageBase64: sourceImageUrl,
        instruction,
        model: models.analysis,
        imageModel: models.image,
        quality: models.quality,
      });
      appendUsage(pid, res.usage);
      const improved: FableSourceImage = {
        id: uid(),
        kind: "improved",
        imageUrl: res.imageBase64,
        prompt: res.imagePrompt,
        critique: res.critique,
        createdAt: now(),
      };
      const next = mutateFor(pid, (p) => ({
        ...p,
        improved: [...p.improved, improved],
        stage: "source_review",
      }));
      appendStep(pid, "improve_source_image", true, "Improved source ready.");
      if (next) void saveProject(projectRef.current); // flush — pixels are precious
    },
    [appendStep, appendUsage, mutateFor, setBusyFor],
  );

  const runAnalyzeInternal = useCallback(
    async (pid: string, guidance?: string): Promise<void> => {
      const p0 = projectRef.current;
      const src = approvedSource(p0);
      if (!src) throw new Error("No source image to analyze yet.");
      setBusyFor(pid, { step: "analyze", detail: "Extracting style + icon candidates…" });
      const res = await postAnalyze({
        imageBase64: src.imageUrl,
        guidance: guidance || undefined,
        model: p0.models.analysis,
      });
      appendUsage(pid, res.usage);
      mutateFor(pid, (p) => ({
        ...p,
        style: res.style,
        sharedStylePrompt: res.sharedStylePrompt,
        candidates: res.candidates,
        stage: "blueprint",
      }));
      appendStep(
        pid,
        "analyze",
        true,
        `Blueprint ready — ${res.candidates.filter((c) => c.status === "active").length} candidates.`,
      );
      // Title fallback: still untitled after analyze → use the style name.
      const styleName = res.style.styleName.trim();
      if (styleName && isCurrent(pid) && projectRef.current.name === "Untitled project") {
        mutateFor(pid, (p) => ({ ...p, name: styleName }));
      }
    },
    [appendStep, appendUsage, isCurrent, mutateFor, setBusyFor],
  );

  const generatePreviews = useCallback(
    async (pid: string): Promise<void> => {
      const p0 = projectRef.current;
      const src = approvedSource(p0);
      if (!src) throw new Error("No approved source for preview sheets.");
      if (!p0.style || !p0.sharedStylePrompt) {
        throw new Error("Run analysis before generating previews.");
      }
      const chunks = chunkForSheets(p0.candidates);
      if (chunks.length === 0) throw new Error("No active candidates to preview.");

      const style = p0.style;
      const sharedStylePrompt = p0.sharedStylePrompt;
      const { models } = p0;
      // Sheet indices continue past any existing (non-superseded) sheets.
      let nextIndex = p0.sheets.reduce((m, s) => Math.max(m, s.index), 0) + 1;

      for (let i = 0; i < chunks.length; i++) {
        if (!isCurrent(pid)) return; // chat switched — stop spending
        const chunk = chunks[i];
        const sheetIndex = nextIndex++;
        setBusyFor(pid, {
          step: "preview_image",
          detail: `Rendering preview sheet ${i + 1} of ${chunks.length}…`,
        });
        const res = await postPreviewSheet({
          referenceImageBase64: src.imageUrl,
          style,
          sharedStylePrompt,
          icons: chunk.map((c) => ({
            id: c.id,
            name: c.name,
            concept: c.concept,
            prompt: c.prompt,
          })),
          sheetIndex,
          imageModel: models.image,
          quality: models.quality,
        });
        appendUsage(pid, res.usage);
        const sheet: PreviewSheet = {
          id: uid(),
          index: sheetIndex,
          imageUrl: res.imageBase64,
          prompt: res.sheetPrompt,
          iconIds: chunk.map((c) => c.id),
          grid: res.grid,
          status: "draft",
          createdAt: now(),
        };
        const next = mutateFor(pid, (p) => ({ ...p, sheets: [...p.sheets, sheet] }));
        appendStep(pid, "preview_image", true, `Preview sheet ${sheetIndex} ready.`);
        if (next) void saveProject(projectRef.current); // flush — pixels are precious
      }
      mutateFor(pid, (p) => ({ ...p, stage: "preview_review" }));
    },
    [appendStep, appendUsage, isCurrent, mutateFor, setBusyFor],
  );

  const generateSingleSheet = useCallback(
    async (pid: string, chunk: IconCandidate[], instruction?: string): Promise<void> => {
      const p0 = projectRef.current;
      const src = approvedSource(p0);
      if (!src || !p0.style || !p0.sharedStylePrompt) {
        throw new Error("Need an approved source + blueprint to render a sheet.");
      }
      const { models } = p0;
      const sheetIndex = p0.sheets.reduce((m, s) => Math.max(m, s.index), 0) + 1;
      setBusyFor(pid, { step: "preview_image", detail: "Rendering another sheet variant…" });
      const res = await postPreviewSheet({
        referenceImageBase64: src.imageUrl,
        style: p0.style,
        sharedStylePrompt: p0.sharedStylePrompt,
        icons: chunk.map((c) => ({
          id: c.id,
          name: c.name,
          concept: c.concept,
          prompt: c.prompt,
        })),
        sheetIndex,
        instruction: instruction || undefined,
        imageModel: models.image,
        quality: models.quality,
      });
      appendUsage(pid, res.usage);
      const sheet: PreviewSheet = {
        id: uid(),
        index: sheetIndex,
        imageUrl: res.imageBase64,
        prompt: res.sheetPrompt,
        iconIds: chunk.map((c) => c.id),
        grid: res.grid,
        status: "draft",
        createdAt: now(),
      };
      const next = mutateFor(pid, (p) => ({
        ...p,
        sheets: [...p.sheets, sheet],
        stage: "preview_review",
      }));
      appendStep(pid, "preview_image", true, `Sheet ${sheetIndex} ready.`);
      if (next) void saveProject(projectRef.current); // flush — pixels are precious
    },
    [appendStep, appendUsage, mutateFor, setBusyFor],
  );

  // Run final-icon generation for a set of candidate ids with bounded concurrency.
  const generateFinalsFor = useCallback(
    async (pid: string, iconIds: string[]): Promise<void> => {
      if (iconIds.length === 0) return; // nothing to do — never hang `busy`
      const p0 = projectRef.current;
      const approvedSheets = p0.sheets.filter((s) => s.status === "approved");
      const sharedStylePrompt = p0.sharedStylePrompt ?? "";
      const fallbackSheet = approvedSheets[0] ?? null;
      const { models } = p0;

      // Seed pending placeholders (or reset existing finals for these ids).
      mutateFor(pid, (p) => {
        const finals = [...p.finals];
        for (const iconId of iconIds) {
          const cand = p.candidates.find((c) => c.id === iconId);
          const existingIdx = finals.findIndex((f) => f.iconId === iconId);
          const placeholder: FableFinalIcon = {
            id: existingIdx >= 0 ? finals[existingIdx].id : uid(),
            iconId,
            name: cand?.name ?? iconId,
            prompt: cand?.prompt ?? "",
            imageUrl: "",
            model: models.image,
            quality: models.quality,
            status: "pending",
            createdAt: now(),
          };
          if (existingIdx >= 0) finals[existingIdx] = placeholder;
          else finals.push(placeholder);
        }
        return { ...p, finals, stage: "finals" };
      });

      const queue = [...iconIds];
      let active = 0;
      let done = 0;

      const runOne = async (iconId: string): Promise<void> => {
        if (!isCurrent(pid)) return; // chat switched — don't spend on orphans
        const cand = projectRef.current.candidates.find((c) => c.id === iconId);
        if (!cand) return;
        // The reference is the approved sheet containing this icon, else the first.
        const ref =
          approvedSheets.find((s) => s.iconIds.includes(iconId)) ?? fallbackSheet;
        // Tell the model WHERE on the sheet this icon already lives, so it
        // reproduces that exact rendering instead of redrawing from text.
        let sheetPosition: string | undefined;
        if (ref) {
          const idx = ref.iconIds.indexOf(iconId);
          if (idx >= 0) {
            const row = Math.floor(idx / ref.grid.cols) + 1;
            const col = (idx % ref.grid.cols) + 1;
            sheetPosition = `row ${row}, column ${col} of a ${ref.grid.rows}×${ref.grid.cols} grid`;
          }
        }
        mutateFor(pid, (p) => ({
          ...p,
          finals: p.finals.map((f) =>
            f.iconId === iconId ? { ...f, status: "generating" } : f,
          ),
        }));
        try {
          const res = await postFinalIcon({
            referenceImageBase64:
              ref?.imageUrl ?? approvedSource(projectRef.current)?.imageUrl ?? "",
            sharedStylePrompt,
            icon: {
              id: cand.id,
              name: cand.name,
              concept: cand.concept,
              prompt: cand.prompt,
            },
            sheetPosition,
            imageModel: models.image,
            quality: models.quality,
          });
          appendUsage(pid, res.usage);
          const next = mutateFor(pid, (p) => ({
            ...p,
            finals: p.finals.map((f) =>
              f.iconId === iconId ? { ...res.final } : f,
            ),
          }));
          // Generated pixels are precious — flush to IndexedDB immediately
          // rather than waiting out the debounce (a reload could lose them).
          if (next) void saveProject(projectRef.current);
          appendStep(pid, "final_icon", res.final.status === "success", `${cand.name}: ${res.final.status}.`);
        } catch (err) {
          noteFailure(pid, err);
          const message = err instanceof Error ? err.message : String(err);
          mutateFor(pid, (p) => ({
            ...p,
            finals: p.finals.map((f) =>
              f.iconId === iconId
                ? { ...f, status: "failed", error: message }
                : f,
            ),
          }));
          appendStep(pid, "final_icon", false, `${cand.name}: ${message}`);
        }
      };

      await new Promise<void>((resolve) => {
        const pump = () => {
          if (!isCurrent(pid)) queue.length = 0; // chat switched — stop dequeuing
          while (active < FABLE_LIMITS.finalConcurrency && queue.length > 0) {
            const iconId = queue.shift()!;
            active++;
            setBusyFor(pid, {
              step: "final_icon",
              detail: `Generating final icons (${done}/${iconIds.length})…`,
            });
            void runOne(iconId).finally(() => {
              active--;
              done++;
              pump();
            });
          }
          if (queue.length === 0 && active === 0) resolve();
        };
        pump();
      });
    },
    [appendStep, appendUsage, isCurrent, mutateFor, noteFailure, setBusyFor],
  );

  // ---- one-shot tamers (C19) ----------------------------------------------
  // Multi-image cascades the user didn't explicitly ask for go through the
  // existing pendingDecision confirm machinery with a cost estimate.

  const queuePreviewConfirm = useCallback(
    (pid: string, userText: string, lead: string) => {
      if (!isCurrent(pid)) return;
      const p = projectRef.current;
      const chunks = chunkForSheets(p.candidates).length;
      const cost = chunks * imageCostUSD(p.models.image, p.models.quality);
      const plural = chunks === 1 ? "" : "s";
      appendEvent(pid, {
        kind: "assistant",
        text: `${lead} Rendering ${chunks} preview sheet${plural} will cost ~${estUsd(cost)}. Go ahead?`,
      });
      setPendingDecision({
        decision: {
          intent: "generate_previews",
          confidence: 1,
          reason: `Render ${chunks} preview sheet${plural} (~${estUsd(cost)})`,
          assistantReply: "",
          ops: [],
        },
        text: userText,
      });
    },
    [appendEvent, isCurrent],
  );

  // ---- decision execution -------------------------------------------------

  const executeReviseIcons = useCallback(
    async (
      pid: string,
      ops: FableOp[],
      userText: string,
      // Agent-routed flows confirm expensive cascades; mechanical buttons and
      // already-confirmed runs pass false to execute immediately.
      confirmCascades = true,
    ): Promise<void> => {
      const p0 = projectRef.current;
      const inFinals = p0.stage === "finals";

      const regenOps = ops.filter((o) => o.op === "regenerate_icon" && o.iconId);
      const regenIds = regenOps.map((o) => o.iconId!);

      // (a) prompt-affecting ops → revise-prompts FIRST, so any regeneration
      // below picks up the rewritten prompts. A regenerate_icon carrying an
      // instruction is an edit in disguise — the server treats it as one.
      const promptOps = [
        ...ops.filter((o) =>
          ["edit_icon", "remove_icon", "add_icon", "restyle_set"].includes(o.op),
        ),
        ...regenOps.filter((o) => o.instruction?.trim()),
      ];
      let revised = false;
      if (promptOps.length > 0) {
        const cur = projectRef.current;
        if (!cur.style || !cur.sharedStylePrompt) {
          throw new Error("Need a blueprint before revising icons.");
        }
        setBusyFor(pid, { step: "revise_prompts", detail: "Applying icon revisions…" });
        const res = await postRevisePrompts({
          style: cur.style,
          sharedStylePrompt: cur.sharedStylePrompt,
          candidates: cur.candidates,
          ops: promptOps,
          model: cur.models.analysis,
        });
        appendUsage(pid, res.usage);
        mutateFor(pid, (p) => ({
          ...p,
          candidates: res.candidates,
          sharedStylePrompt: res.sharedStylePrompt,
        }));
        appendStep(pid, "revise_prompts", true, "Icon set updated.");
        revised = true;
      }

      if (!isCurrent(pid)) return; // chat switched — stop before spending more

      // (b) regenerate_icon while in finals → re-run final-icon for those ids
      // (after the prompt revision above, so the new prompt is what renders).
      if (inFinals && regenIds.length > 0) {
        await generateFinalsFor(pid, regenIds);
      }

      // (c) new_sheet → render one more sheet variant per chunk with the
      // instruction (large packs span several chunks — cover them all).
      const newSheetOps = ops.filter((o) => o.op === "new_sheet");
      for (const op of newSheetOps) {
        const active = projectRef.current.candidates.filter(
          (c) => c.status === "active",
        );
        const chunks = chunkForSheets(active);
        for (const chunk of chunks.length > 0 ? chunks : [active]) {
          if (!isCurrent(pid)) return;
          await generateSingleSheet(pid, chunk, op.instruction ?? userText);
        }
      }

      // (d) preview stage: stale sheets need re-rendering. A full prompt
      // revision supersedes every draft; a bare regenerate only re-renders the
      // sheet(s) containing the targeted icons (one cell of a raster sheet
      // can't be redrawn in isolation).
      if (!inFinals && p0.stage === "preview_review") {
        if (revised) {
          const drafts = projectRef.current.sheets.filter((s) => s.status === "draft");
          if (confirmCascades && drafts.length > 1) {
            // Re-rendering EVERY draft sheet is a multi-image cascade → confirm.
            const chunks = chunkForSheets(projectRef.current.candidates).length;
            const cost = chunks * imageCostUSD(
              projectRef.current.models.image,
              projectRef.current.models.quality,
            );
            appendEvent(pid, {
              kind: "assistant",
              text: `Prompts updated. Re-rendering all ${drafts.length} draft sheets will cost ~${estUsd(cost)}. Go ahead?`,
            });
            setPendingDecision({
              decision: {
                intent: "generate_previews",
                confidence: 1,
                reason: `Supersede ${drafts.length} draft sheets and re-render (~${estUsd(cost)})`,
                assistantReply: "",
                ops: [],
              },
              text: userText,
              run: async (pid2) => {
                mutateFor(pid2, (p) => ({
                  ...p,
                  sheets: p.sheets.map((s) =>
                    s.status === "draft" ? { ...s, status: "superseded" } : s,
                  ),
                }));
                await generatePreviews(pid2);
              },
            });
            return;
          }
          mutateFor(pid, (p) => ({
            ...p,
            sheets: p.sheets.map((s) =>
              s.status === "draft" ? { ...s, status: "superseded" } : s,
            ),
          }));
          await generatePreviews(pid);
        } else if (regenIds.length > 0) {
          const cur = projectRef.current;
          const affected = cur.sheets.filter(
            (s) => s.status === "draft" && s.iconIds.some((id) => regenIds.includes(id)),
          );
          for (const sheet of affected) {
            if (!isCurrent(pid)) return;
            mutateFor(pid, (p) => ({
              ...p,
              sheets: p.sheets.map((s) =>
                s.id === sheet.id ? { ...s, status: "superseded" } : s,
              ),
            }));
            const icons = cur.candidates.filter(
              (c) => c.status === "active" && sheet.iconIds.includes(c.id),
            );
            await generateSingleSheet(
              pid,
              icons,
              `Re-render this sheet with a fresh, improved take on ${regenIds.join(", ")}; keep every other icon as close to the previous sheet as possible.`,
            );
          }
        }
      }
    },
    [
      appendEvent,
      appendStep,
      appendUsage,
      generateFinalsFor,
      generateSingleSheet,
      generatePreviews,
      isCurrent,
      mutateFor,
      setBusyFor,
    ],
  );

  const executeDecision = useCallback(
    async (
      pid: string,
      decision: FableDecision,
      userText: string,
      newImageUrl: string | null = null,
    ): Promise<void> => {
      let p0 = projectRef.current;

      // B7: a NEW image arrived mid-project and the intent acts on the source →
      // adopt the new image as the latest source version (SourceCard's version
      // strip) so everything below works from it.
      let turnSource: FableSourceImage | null = null;
      if (newImageUrl && p0.original && SOURCE_ACTING_INTENTS.has(decision.intent)) {
        turnSource = {
          id: uid(),
          kind: "original",
          imageUrl: newImageUrl,
          createdAt: now(),
        };
        const next = mutateFor(pid, (p) => ({
          ...p,
          improved: [...p.improved, turnSource!],
        }));
        p0 = next ?? p0;
      }

      switch (decision.intent) {
        case "upgrade_source": {
          const src = turnSource ?? p0.original;
          if (!src) throw new Error("Attach an image first.");
          await runImproveSource(pid, src.imageUrl, userText);
          break;
        }
        case "use_source_as_is": {
          const src = turnSource ?? p0.original;
          if (!src) throw new Error("Attach an image first.");
          mutateFor(pid, (p) => ({ ...p, approvedSourceId: src.id }));
          await runAnalyzeInternal(pid, userText);
          if (/\b(preview|sheets?|render)\b/i.test(userText)) await generatePreviews(pid);
          else queuePreviewConfirm(pid, userText, "Blueprint's ready — review the icon set above.");
          break;
        }
        case "revise_source": {
          const src = turnSource ?? approvedSource(p0) ?? p0.original;
          if (!src) throw new Error("No source to revise.");
          await runImproveSource(pid, src.imageUrl, userText);
          break;
        }
        case "approve_source": {
          const latest = p0.improved[p0.improved.length - 1] ?? p0.original;
          if (!latest) throw new Error("No source to approve.");
          mutateFor(pid, (p) => ({ ...p, approvedSourceId: latest.id }));
          await runAnalyzeInternal(pid, userText);
          if (/\b(preview|sheets?|render)\b/i.test(userText)) await generatePreviews(pid);
          else queuePreviewConfirm(pid, userText, "Blueprint's ready — review the icon set above.");
          break;
        }
        case "extract_style": {
          await runAnalyzeInternal(pid, userText);
          if (/\b(preview|sheets?|render)\b/i.test(userText)) await generatePreviews(pid);
          else queuePreviewConfirm(pid, userText, "Blueprint's ready — review the icon set above.");
          break;
        }
        case "revise_icons": {
          await executeReviseIcons(pid, decision.ops, userText);
          break;
        }
        case "generate_previews": {
          await generatePreviews(pid);
          break;
        }
        case "generate_finals": {
          mutateFor(pid, (p) => ({
            ...p,
            sheets: p.sheets.map((s) =>
              s.status === "draft" ? { ...s, status: "approved" } : s,
            ),
            stage: "finals",
          }));
          const ids = projectRef.current.candidates
            .filter((c) => c.status === "active")
            .map((c) => c.id);
          await generateFinalsFor(pid, ids);
          break;
        }
        case "save_project": {
          const next = mutateFor(pid, (p) => ({ ...p, stage: "complete" }));
          if (next) await saveProject(next);
          break;
        }
        case "clarify":
        default:
          // assistantReply already appended; nothing to execute.
          break;
      }
    },
    [
      executeReviseIcons,
      generateFinalsFor,
      generatePreviews,
      mutateFor,
      queuePreviewConfirm,
      runAnalyzeInternal,
      runImproveSource,
    ],
  );

  // ---- message entry point ------------------------------------------------

  const runDecisionFlow = useCallback(
    async (
      pid: string,
      decision: FableDecision,
      userText: string,
      newImageUrl: string | null = null,
    ): Promise<void> => {
      appendEvent(pid, {
        kind: "decision",
        decision,
        stageBefore: projectRef.current.stage,
      });
      appendEvent(pid, { kind: "assistant", text: decision.assistantReply });
      try {
        await executeDecision(pid, decision, userText, newImageUrl);
      } catch (err) {
        noteFailure(pid, err);
        const message = err instanceof Error ? err.message : String(err);
        if (isCurrent(pid)) setError(message);
        appendEvent(pid, { kind: "assistant", text: `⚠️ ${message}` });
      } finally {
        setBusyFor(pid, { step: null, detail: "" });
      }
    },
    [appendEvent, executeDecision, isCurrent, noteFailure, setBusyFor],
  );

  const sendMessage = useCallback(
    async (text: string, imageFile?: File | null): Promise<void> => {
      if (busyRef.current.step) return; // ignore while working (ref → no stale read)
      setError(null);
      const pid = projectRef.current.id;
      // Claim busy SYNCHRONOUSLY so a double-Enter can't race past the gate.
      setBusyAll({ step: "agent_route", detail: "Thinking…" });

      let imageDataUrl: string | null = null;
      if (imageFile) {
        try {
          imageDataUrl = await fileToDataUrl(imageFile);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          setError(message);
          setBusyFor(pid, { step: null, detail: "" });
          return;
        }
      }
      if (!isCurrent(pid)) return; // switched chats while reading the file

      const hadOriginal = !!projectRef.current.original;
      // First image becomes the project's original source.
      if (imageDataUrl && !hadOriginal) {
        const original: FableSourceImage = {
          id: uid(),
          kind: "original",
          imageUrl: imageDataUrl,
          fileName: imageFile?.name,
          createdAt: now(),
        };
        mutateFor(pid, (p) => ({ ...p, original }));
      }
      // A second (or later) image rode this turn — the agent + executor adopt it.
      const newImageThisTurn = !!imageDataUrl && hadOriginal;
      const turnImage = newImageThisTurn ? imageDataUrl : null;

      appendEvent(pid, {
        kind: "user_message",
        text,
        imageAttached: !!imageDataUrl,
        imageUrl: imageDataUrl ?? undefined,
      });

      let decision: FableDecision;
      try {
        const res = await postAgent({
          text,
          imageBase64: imageDataUrl,
          state: { ...summarizeProject(projectRef.current), newImageThisTurn },
          model: projectRef.current.models.analysis,
        });
        appendUsage(pid, res.usage);
        appendStep(pid, "agent_route", true, `Intent: ${res.decision.intent}.`);
        decision = res.decision;
      } catch (err) {
        noteFailure(pid, err);
        const message = err instanceof Error ? err.message : String(err);
        if (isCurrent(pid)) setError(message);
        appendStep(pid, "agent_route", false, message);
        appendEvent(pid, { kind: "assistant", text: `⚠️ ${message}` });
        setBusyFor(pid, { step: null, detail: "" });
        return;
      }
      if (!isCurrent(pid)) return; // switched chats while routing

      // AI chat title — only while still untitled (a manual rename always wins).
      const suggested = decision.suggestedTitle?.trim();
      if (suggested && projectRef.current.name === "Untitled project") {
        mutateFor(pid, (p) => ({ ...p, name: suggested.slice(0, 60) }));
      }

      // Low confidence / clarify → confirm before auto-executing.
      if (decision.confidence < 0.55 || decision.intent === "clarify") {
        appendEvent(pid, {
          kind: "decision",
          decision,
          stageBefore: projectRef.current.stage,
        });
        appendEvent(pid, { kind: "assistant", text: decision.assistantReply });
        setPendingDecision({ decision, text, imageUrl: turnImage });
        setBusyFor(pid, { step: null, detail: "" });
        return;
      }

      // C19a: generate_finals must never silently approve draft sheets — when
      // unapproved drafts exist, confirm the batch (with a cost estimate) first.
      if (decision.intent === "generate_finals") {
        const cur = projectRef.current;
        const drafts = cur.sheets.filter((s) => s.status === "draft").length;
        if (drafts > 0) {
          const ids = cur.candidates.filter((c) => c.status === "active").length;
          const cost = ids * imageCostUSD(cur.models.image, cur.models.quality);
          appendEvent(pid, {
            kind: "decision",
            decision,
            stageBefore: cur.stage,
          });
          appendEvent(pid, { kind: "assistant", text: decision.assistantReply });
          appendEvent(pid, {
            kind: "assistant",
            text: `This will approve ${drafts} draft sheet${drafts === 1 ? "" : "s"} and render ${ids} final icon${ids === 1 ? "" : "s"} (~${estUsd(cost)}). Go ahead?`,
          });
          setPendingDecision({ decision, text, imageUrl: turnImage });
          setBusyFor(pid, { step: null, detail: "" });
          return;
        }
      }

      await runDecisionFlow(pid, decision, text, turnImage);
    },
    [
      appendEvent,
      appendStep,
      appendUsage,
      isCurrent,
      mutateFor,
      noteFailure,
      runDecisionFlow,
      setBusyAll,
      setBusyFor,
    ],
  );

  const confirmPending = useCallback(async (): Promise<void> => {
    const pd = pendingDecision;
    if (!pd) return;
    if (busyRef.current.step) return; // double-click guard (ref → no stale read)
    setPendingDecision(null);
    const pid = projectRef.current.id;
    setBusyAll({ step: "agent_route", detail: "Working…" });
    try {
      if (pd.run) await pd.run(pid);
      else await executeDecision(pid, pd.decision, pd.text, pd.imageUrl ?? null);
    } catch (err) {
      noteFailure(pid, err);
      const message = err instanceof Error ? err.message : String(err);
      if (isCurrent(pid)) setError(message);
      appendEvent(pid, { kind: "assistant", text: `⚠️ ${message}` });
    } finally {
      setBusyFor(pid, { step: null, detail: "" });
    }
  }, [appendEvent, executeDecision, isCurrent, noteFailure, pendingDecision, setBusyAll, setBusyFor]);

  const dismissPending = useCallback(() => setPendingDecision(null), []);

  // ---- manual controls (wrap internals; surface errors) -------------------

  const guard = useCallback(
    async (fn: (pid: string) => Promise<void>): Promise<void> => {
      if (busyRef.current.step) return; // already working — ignore the click
      setError(null);
      const pid = projectRef.current.id;
      try {
        await fn(pid);
      } catch (err) {
        noteFailure(pid, err);
        const message = err instanceof Error ? err.message : String(err);
        if (isCurrent(pid)) setError(message);
        appendEvent(pid, { kind: "assistant", text: `⚠️ ${message}` });
      } finally {
        setBusyFor(pid, { step: null, detail: "" });
      }
    },
    [appendEvent, isCurrent, noteFailure, setBusyFor],
  );

  const approveSource = useCallback(
    () =>
      guard(async (pid) => {
        const p0 = projectRef.current;
        const latest = p0.improved[p0.improved.length - 1] ?? p0.original;
        if (!latest) throw new Error("No source to approve.");
        mutateFor(pid, (p) => ({ ...p, approvedSourceId: latest.id }));
        await runAnalyzeInternal(pid);
        await generatePreviews(pid);
      }),
    [generatePreviews, guard, mutateFor, runAnalyzeInternal],
  );

  const regenerateSource = useCallback(
    (instruction: string) =>
      guard(async (pid) => {
        const p0 = projectRef.current;
        const src = approvedSource(p0) ?? p0.original;
        if (!src) throw new Error("No source to regenerate.");
        await runImproveSource(pid, src.imageUrl, instruction);
      }),
    [guard, runImproveSource],
  );

  const runAnalyze = useCallback(
    (guidance?: string) => guard((pid) => runAnalyzeInternal(pid, guidance)),
    [guard, runAnalyzeInternal],
  );

  const runPreviews = useCallback(
    () => guard((pid) => generatePreviews(pid)),
    [generatePreviews, guard],
  );

  const approveAndGenerateFinals = useCallback(
    () =>
      guard(async (pid) => {
        mutateFor(pid, (p) => ({
          ...p,
          sheets: p.sheets.map((s) =>
            s.status === "draft" ? { ...s, status: "approved" } : s,
          ),
          stage: "finals",
        }));
        const ids = projectRef.current.candidates
          .filter((c) => c.status === "active")
          .map((c) => c.id);
        await generateFinalsFor(pid, ids);
      }),
    [generateFinalsFor, guard, mutateFor],
  );

  // Approve ONE sheet and generate finals for ITS icons only — other draft
  // sheets stay under review (the chat "generate finals" intent is the
  // approve-everything path).
  const approveSheetAndGenerateFinals = useCallback(
    (sheetId: string) =>
      guard(async (pid) => {
        const p0 = projectRef.current;
        const sheet = p0.sheets.find((s) => s.id === sheetId);
        if (!sheet) throw new Error("Sheet not found.");
        const otherDrafts = p0.sheets.some(
          (s) => s.id !== sheetId && s.status === "draft",
        );
        mutateFor(pid, (p) => ({
          ...p,
          sheets: p.sheets.map((s) =>
            s.id === sheetId ? { ...s, status: "approved" } : s,
          ),
          stage: otherDrafts ? p.stage : "finals",
        }));
        const ids = projectRef.current.candidates
          .filter((c) => c.status === "active" && sheet.iconIds.includes(c.id))
          .map((c) => c.id);
        await generateFinalsFor(pid, ids);
      }),
    [generateFinalsFor, guard, mutateFor],
  );

  const retryFinal = useCallback(
    (iconId: string) => guard((pid) => generateFinalsFor(pid, [iconId])),
    [generateFinalsFor, guard],
  );

  const regenerateSheet = useCallback(
    (sheetId: string, instruction: string) =>
      guard(async (pid) => {
        const p0 = projectRef.current;
        const sheet = p0.sheets.find((s) => s.id === sheetId);
        if (!sheet) throw new Error("Sheet not found.");
        // Supersede the old sheet, render a fresh variant over the same icons.
        mutateFor(pid, (p) => ({
          ...p,
          sheets: p.sheets.map((s) =>
            s.id === sheetId ? { ...s, status: "superseded" } : s,
          ),
        }));
        const chunk = sheet.iconIds
          .map((id) => projectRef.current.candidates.find((c) => c.id === id))
          .filter((c): c is IconCandidate => !!c);
        await generateSingleSheet(pid, chunk, instruction);
      }),
    [generateSingleSheet, guard, mutateFor],
  );

  // ---- mechanical card actions (C18) — structured, no agent round-trip ----

  const reviseIconsDirect = useCallback(
    (ops: FableOp[], description: string) =>
      guard(async (pid) => {
        appendEvent(pid, { kind: "user_message", text: description, imageAttached: false });
        await executeReviseIcons(pid, ops, description, /* confirmCascades */ false);
      }),
    [appendEvent, executeReviseIcons, guard],
  );

  const tryAnotherSheet = useCallback(
    (sheetId: string, instruction: string) =>
      guard(async (pid) => {
        const p0 = projectRef.current;
        const sheet = p0.sheets.find((s) => s.id === sheetId);
        if (!sheet) throw new Error("Sheet not found.");
        appendEvent(pid, {
          kind: "user_message",
          text: `Try another take on sheet ${sheet.index}: ${instruction}`,
          imageAttached: false,
        });
        const chunk = sheet.iconIds
          .map((id) => p0.candidates.find((c) => c.id === id))
          .filter((c): c is IconCandidate => !!c && c.status === "active");
        if (chunk.length === 0) throw new Error("No active icons on that sheet.");
        await generateSingleSheet(pid, chunk, instruction);
      }),
    [appendEvent, generateSingleSheet, guard],
  );

  const regenerateFinal = useCallback(
    (iconId: string) =>
      guard(async (pid) => {
        const name =
          projectRef.current.candidates.find((c) => c.id === iconId)?.name ?? iconId;
        appendEvent(pid, {
          kind: "user_message",
          text: `Regenerate the ${name} icon.`,
          imageAttached: false,
        });
        await generateFinalsFor(pid, [iconId]);
      }),
    [appendEvent, generateFinalsFor, guard],
  );

  const removeCandidate = useCallback(
    (id: string) => {
      mutate((p) => ({
        ...p,
        candidates: p.candidates.map((c) =>
          c.id === id ? { ...c, status: "removed" } : c,
        ),
      }));
    },
    [mutate],
  );

  const updateCandidate = useCallback(
    (id: string, patch: Partial<IconCandidate>) => {
      mutate((p) => ({
        ...p,
        candidates: p.candidates.map((c) =>
          c.id === id ? { ...c, ...patch } : c,
        ),
      }));
    },
    [mutate],
  );

  return {
    project,
    busy,
    error,
    devMode,
    pendingDecision,
    lastRawError,
    setDevMode,
    clearError,
    newProject,
    openProject,
    renameProject,
    setModelConfig,
    sendMessage,
    confirmPending,
    dismissPending,
    approveSource,
    regenerateSource,
    runAnalyze,
    runPreviews,
    approveAndGenerateFinals,
    approveSheetAndGenerateFinals,
    retryFinal,
    regenerateSheet,
    removeCandidate,
    updateCandidate,
    reviseIconsDirect,
    tryAnotherSheet,
    regenerateFinal,
  };
}
