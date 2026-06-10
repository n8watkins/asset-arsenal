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
  FABLE_LIMITS,
  gridFor,
  summarizeProject,
  type FableDecision,
  type FableEvent,
  type FableFinalIcon,
  type FableOp,
  type FableProject,
  type FableSourceImage,
  type FableStage,
  type FableStepKey,
  type FableUsageRecord,
  type IconCandidate,
  type PreviewSheet,
} from "./types";
import { saveProject } from "./store";
import { IMAGE_UPLOAD_LIMITS, MAX_FILE_SIZE_BYTES } from "@/lib/icon/models";

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
    usage: [],
    events: [],
  };
}

/** Read a File into a data URL, validating type/size against the upload limits. */
function fileToDataUrl(file: File): Promise<string> {
  if (!(IMAGE_UPLOAD_LIMITS.allowedMimeTypes as readonly string[]).includes(file.type)) {
    return Promise.reject(
      new Error(
        `Unsupported type "${file.type || "unknown"}". Allowed: PNG, JPEG, WebP.`,
      ),
    );
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return Promise.reject(
      new Error(
        `${(file.size / 1024 / 1024).toFixed(1)} MB exceeds the ${IMAGE_UPLOAD_LIMITS.maxFileSizeMB} MB limit.`,
      ),
    );
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read the image file."));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });
}

// ---------------------------------------------------------------------------
// Hook types
// ---------------------------------------------------------------------------

export type FableBusy = { step: FableStepKey | null; detail: string };

export type PendingDecision = {
  decision: FableDecision;
  text: string;
};

export type UseFable = {
  project: FableProject;
  busy: FableBusy;
  error: string | null;
  devMode: boolean;
  pendingDecision: PendingDecision | null;

  setDevMode: (on: boolean) => void;
  clearError: () => void;

  newProject: () => void;
  openProject: (p: FableProject) => void;
  renameProject: (name: string) => void;

  sendMessage: (text: string, imageFile?: File | null) => Promise<void>;
  confirmPending: () => Promise<void>;
  dismissPending: () => void;

  // Manual controls (Dev Mode + Live buttons) — thin wrappers over internals.
  approveSource: () => Promise<void>;
  regenerateSource: (instruction: string) => Promise<void>;
  runAnalyze: (guidance?: string) => Promise<void>;
  runPreviews: () => Promise<void>;
  approveAndGenerateFinals: () => Promise<void>;
  retryFinal: (iconId: string) => Promise<void>;
  regenerateSheet: (sheetId: string, instruction: string) => Promise<void>;
  removeCandidate: (id: string) => void;
  updateCandidate: (id: string, patch: Partial<IconCandidate>) => void;
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

  // A ref mirror of the latest project so async executors read fresh state
  // without stale closures, and so we never lose intermediate mutations.
  const projectRef = useRef(project);
  projectRef.current = project;

  // ---- persistence (debounced auto-save on every mutation) ----------------

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipNextSave = useRef(false);

  useEffect(() => {
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void saveProject(projectRef.current);
    }, 500);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [project]);

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

  const appendEvent = useCallback(
    (ev: DistributiveOmit<FableEvent, "id" | "at">) => {
      mutate((p) => ({
        ...p,
        events: [...p.events, { id: uid(), at: now(), ...ev } as FableEvent],
      }));
    },
    [mutate],
  );

  const appendUsage = useCallback(
    (usage: FableUsageRecord[]) => {
      if (!usage?.length) return;
      mutate((p) => ({ ...p, usage: [...p.usage, ...usage] }));
    },
    [mutate],
  );

  const appendStep = useCallback(
    (step: FableStepKey, ok: boolean, detail: string) => {
      appendEvent({ kind: "step", step, ok, detail });
    },
    [appendEvent],
  );

  // ---- project lifecycle --------------------------------------------------

  const newProject = useCallback(() => {
    setPendingDecision(null);
    setError(null);
    setBusy({ step: null, detail: "" });
    const p = freshProject();
    projectRef.current = p;
    setProject(p);
    void saveProject(p);
  }, []);

  const openProject = useCallback((p: FableProject) => {
    setPendingDecision(null);
    setError(null);
    setBusy({ step: null, detail: "" });
    skipNextSave.current = true; // don't immediately re-save what we just loaded
    projectRef.current = p;
    setProject(p);
  }, []);

  const renameProject = useCallback(
    (name: string) => {
      mutate((p) => ({ ...p, name: name.trim() || "Untitled project" }));
    },
    [mutate],
  );

  const clearError = useCallback(() => setError(null), []);

  // ---- step internals -----------------------------------------------------
  // Each returns nothing useful directly; they mutate the project + record
  // usage/steps. They throw on failure so callers can surface `error`.

  const runImproveSource = useCallback(
    async (sourceImageUrl: string, instruction: string): Promise<void> => {
      setBusy({ step: "improve_source_image", detail: "Upgrading your source…" });
      const res = await postImproveSource({
        imageBase64: sourceImageUrl,
        instruction,
      });
      appendUsage(res.usage);
      const improved: FableSourceImage = {
        id: uid(),
        kind: "improved",
        imageUrl: res.imageBase64,
        prompt: res.imagePrompt,
        critique: res.critique,
        createdAt: now(),
      };
      mutate((p) => ({
        ...p,
        improved: [...p.improved, improved],
        stage: "source_review",
      }));
      appendStep("improve_source_image", true, "Improved source ready.");
    },
    [appendStep, appendUsage, mutate],
  );

  const runAnalyzeInternal = useCallback(
    async (guidance?: string): Promise<void> => {
      const src = approvedSource(projectRef.current);
      if (!src) throw new Error("No source image to analyze yet.");
      setBusy({ step: "analyze", detail: "Extracting style + icon candidates…" });
      const res = await postAnalyze({
        imageBase64: src.imageUrl,
        guidance: guidance || undefined,
      });
      appendUsage(res.usage);
      mutate((p) => ({
        ...p,
        style: res.style,
        sharedStylePrompt: res.sharedStylePrompt,
        candidates: res.candidates,
        stage: "blueprint",
      }));
      appendStep(
        "analyze",
        true,
        `Blueprint ready — ${res.candidates.filter((c) => c.status === "active").length} candidates.`,
      );
    },
    [appendStep, appendUsage, mutate],
  );

  const generatePreviews = useCallback(async (): Promise<void> => {
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
    // Sheet indices continue past any existing (non-superseded) sheets.
    let nextIndex =
      p0.sheets.reduce((m, s) => Math.max(m, s.index), 0) + 1;

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const sheetIndex = nextIndex++;
      setBusy({
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
      });
      appendUsage(res.usage);
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
      mutate((p) => ({ ...p, sheets: [...p.sheets, sheet] }));
      appendStep("preview_image", true, `Preview sheet ${sheetIndex} ready.`);
    }
    mutate((p) => ({ ...p, stage: "preview_review" }));
  }, [appendStep, appendUsage, mutate]);

  const generateSingleSheet = useCallback(
    async (chunk: IconCandidate[], instruction?: string): Promise<void> => {
      const p0 = projectRef.current;
      const src = approvedSource(p0);
      if (!src || !p0.style || !p0.sharedStylePrompt) {
        throw new Error("Need an approved source + blueprint to render a sheet.");
      }
      const sheetIndex = p0.sheets.reduce((m, s) => Math.max(m, s.index), 0) + 1;
      setBusy({ step: "preview_image", detail: "Rendering another sheet variant…" });
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
      });
      appendUsage(res.usage);
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
      mutate((p) => ({ ...p, sheets: [...p.sheets, sheet], stage: "preview_review" }));
      appendStep("preview_image", true, `Sheet ${sheetIndex} ready.`);
    },
    [appendStep, appendUsage, mutate],
  );

  // Run final-icon generation for a set of candidate ids with bounded concurrency.
  const generateFinalsFor = useCallback(
    async (iconIds: string[]): Promise<void> => {
      const p0 = projectRef.current;
      const approvedSheets = p0.sheets.filter((s) => s.status === "approved");
      const sharedStylePrompt = p0.sharedStylePrompt ?? "";
      const fallbackSheet = approvedSheets[0] ?? null;

      // Seed pending placeholders (or reset existing finals for these ids).
      mutate((p) => {
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
            model: "",
            quality: "high",
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
        const cand = projectRef.current.candidates.find((c) => c.id === iconId);
        if (!cand) return;
        // The reference is the approved sheet containing this icon, else the first.
        const ref =
          approvedSheets.find((s) => s.iconIds.includes(iconId)) ?? fallbackSheet;
        mutate((p) => ({
          ...p,
          finals: p.finals.map((f) =>
            f.iconId === iconId ? { ...f, status: "generating" } : f,
          ),
        }));
        try {
          const res = await postFinalIcon({
            referenceImageBase64: ref?.imageUrl ?? approvedSource(projectRef.current)?.imageUrl ?? "",
            sharedStylePrompt,
            icon: {
              id: cand.id,
              name: cand.name,
              concept: cand.concept,
              prompt: cand.prompt,
            },
          });
          appendUsage(res.usage);
          mutate((p) => ({
            ...p,
            finals: p.finals.map((f) =>
              f.iconId === iconId ? { ...res.final } : f,
            ),
          }));
          appendStep("final_icon", res.final.status === "success", `${cand.name}: ${res.final.status}.`);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          mutate((p) => ({
            ...p,
            finals: p.finals.map((f) =>
              f.iconId === iconId
                ? { ...f, status: "failed", error: message }
                : f,
            ),
          }));
          appendStep("final_icon", false, `${cand.name}: ${message}`);
        }
      };

      await new Promise<void>((resolve) => {
        const pump = () => {
          while (active < FABLE_LIMITS.finalConcurrency && queue.length > 0) {
            const iconId = queue.shift()!;
            active++;
            setBusy({
              step: "final_icon",
              detail: `Generating final icons (${done}/${iconIds.length})…`,
            });
            void runOne(iconId).finally(() => {
              active--;
              done++;
              if (queue.length === 0 && active === 0) resolve();
              else pump();
            });
          }
        };
        pump();
      });
    },
    [appendStep, appendUsage, mutate],
  );

  // ---- decision execution -------------------------------------------------

  const executeDecision = useCallback(
    async (decision: FableDecision, userText: string): Promise<void> => {
      const p0 = projectRef.current;
      switch (decision.intent) {
        case "upgrade_source": {
          if (!p0.original) throw new Error("Attach an image first.");
          await runImproveSource(p0.original.imageUrl, userText);
          break;
        }
        case "use_source_as_is": {
          if (!p0.original) throw new Error("Attach an image first.");
          mutate((p) => ({ ...p, approvedSourceId: p.original!.id }));
          await runAnalyzeInternal(userText);
          await generatePreviews();
          break;
        }
        case "revise_source": {
          const src = approvedSource(p0) ?? p0.original;
          if (!src) throw new Error("No source to revise.");
          await runImproveSource(src.imageUrl, userText);
          break;
        }
        case "approve_source": {
          const latest =
            p0.improved[p0.improved.length - 1] ?? p0.original;
          if (!latest) throw new Error("No source to approve.");
          mutate((p) => ({ ...p, approvedSourceId: latest.id }));
          await runAnalyzeInternal(userText);
          await generatePreviews();
          break;
        }
        case "extract_style": {
          await runAnalyzeInternal(userText);
          await generatePreviews();
          break;
        }
        case "revise_icons": {
          await executeReviseIcons(decision.ops, userText);
          break;
        }
        case "generate_previews": {
          await generatePreviews();
          break;
        }
        case "generate_finals": {
          mutate((p) => ({
            ...p,
            sheets: p.sheets.map((s) =>
              s.status === "draft" ? { ...s, status: "approved" } : s,
            ),
            stage: "finals",
          }));
          const ids = projectRef.current.candidates
            .filter((c) => c.status === "active")
            .map((c) => c.id);
          await generateFinalsFor(ids);
          break;
        }
        case "save_project": {
          mutate((p) => ({ ...p, stage: "complete" }));
          await saveProject(projectRef.current);
          break;
        }
        case "clarify":
        default:
          // assistantReply already appended; nothing to execute.
          break;
      }
    },
    // executeReviseIcons defined below; referenced lazily through closure.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [generateFinalsFor, generatePreviews, mutate, runAnalyzeInternal, runImproveSource],
  );

  const executeReviseIcons = useCallback(
    async (ops: FableOp[], userText: string): Promise<void> => {
      const p0 = projectRef.current;

      // (b) regenerate_icon ops while in finals → re-run final-icon for those ids.
      const regenIds = ops
        .filter((o) => o.op === "regenerate_icon" && o.iconId)
        .map((o) => o.iconId!) as string[];
      if (regenIds.length > 0 && p0.stage === "finals") {
        await generateFinalsFor(regenIds);
      }

      // (c) new_sheet → render one more sheet variant with the instruction.
      const newSheetOps = ops.filter((o) => o.op === "new_sheet");
      for (const op of newSheetOps) {
        const active = projectRef.current.candidates.filter(
          (c) => c.status === "active",
        );
        const chunk = chunkForSheets(active)[0] ?? active;
        await generateSingleSheet(chunk, op.instruction ?? userText);
      }

      // (a) prompt-affecting ops → revise-prompts, then maybe regen previews.
      const promptOps = ops.filter((o) =>
        ["edit_icon", "remove_icon", "add_icon", "restyle_set"].includes(o.op),
      );
      if (promptOps.length > 0) {
        const cur = projectRef.current;
        if (!cur.style || !cur.sharedStylePrompt) {
          throw new Error("Need a blueprint before revising icons.");
        }
        setBusy({ step: "revise_prompts", detail: "Applying icon revisions…" });
        const res = await postRevisePrompts({
          style: cur.style,
          sharedStylePrompt: cur.sharedStylePrompt,
          candidates: cur.candidates,
          ops: promptOps,
        });
        appendUsage(res.usage);
        mutate((p) => ({
          ...p,
          candidates: res.candidates,
          sharedStylePrompt: res.sharedStylePrompt,
        }));
        appendStep("revise_prompts", true, "Icon set updated.");

        // If we were reviewing previews, the drafts are now stale → supersede
        // and re-render.
        if (cur.stage === "preview_review") {
          mutate((p) => ({
            ...p,
            sheets: p.sheets.map((s) =>
              s.status === "draft" ? { ...s, status: "superseded" } : s,
            ),
          }));
          await generatePreviews();
        }
      }
    },
    [appendStep, appendUsage, generateFinalsFor, generateSingleSheet, generatePreviews, mutate],
  );

  // ---- message entry point ------------------------------------------------

  const runDecisionFlow = useCallback(
    async (decision: FableDecision, userText: string): Promise<void> => {
      appendEvent({
        kind: "decision",
        decision,
        stageBefore: projectRef.current.stage,
      });
      appendEvent({ kind: "assistant", text: decision.assistantReply });
      try {
        await executeDecision(decision, userText);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        appendEvent({ kind: "assistant", text: `⚠️ ${message}` });
      } finally {
        setBusy({ step: null, detail: "" });
      }
    },
    [appendEvent, executeDecision],
  );

  const sendMessage = useCallback(
    async (text: string, imageFile?: File | null): Promise<void> => {
      setError(null);
      if (busy.step) return; // ignore while working

      let imageDataUrl: string | null = null;
      if (imageFile) {
        try {
          imageDataUrl = await fileToDataUrl(imageFile);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          setError(message);
          return;
        }
      }

      // First image becomes the project's original source.
      if (imageDataUrl && !projectRef.current.original) {
        const original: FableSourceImage = {
          id: uid(),
          kind: "original",
          imageUrl: imageDataUrl,
          fileName: imageFile?.name,
          createdAt: now(),
        };
        mutate((p) => ({ ...p, original }));
      }

      appendEvent({
        kind: "user_message",
        text,
        imageAttached: !!imageDataUrl,
      });

      setBusy({ step: "agent_route", detail: "Thinking…" });
      let decision: FableDecision;
      try {
        const res = await postAgent({
          text,
          imageBase64: imageDataUrl,
          state: summarizeProject(projectRef.current),
        });
        appendUsage(res.usage);
        appendStep("agent_route", true, `Intent: ${res.decision.intent}.`);
        decision = res.decision;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        appendStep("agent_route", false, message);
        appendEvent({ kind: "assistant", text: `⚠️ ${message}` });
        setBusy({ step: null, detail: "" });
        return;
      }

      // Low confidence / clarify → confirm before auto-executing.
      if (decision.confidence < 0.55 || decision.intent === "clarify") {
        appendEvent({
          kind: "decision",
          decision,
          stageBefore: projectRef.current.stage,
        });
        appendEvent({ kind: "assistant", text: decision.assistantReply });
        setPendingDecision({ decision, text });
        setBusy({ step: null, detail: "" });
        return;
      }

      await runDecisionFlow(decision, text);
    },
    [appendEvent, appendStep, appendUsage, busy.step, mutate, runDecisionFlow],
  );

  const confirmPending = useCallback(async (): Promise<void> => {
    const pd = pendingDecision;
    if (!pd) return;
    setPendingDecision(null);
    setBusy({ step: "agent_route", detail: "Working…" });
    try {
      await executeDecision(pd.decision, pd.text);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      appendEvent({ kind: "assistant", text: `⚠️ ${message}` });
    } finally {
      setBusy({ step: null, detail: "" });
    }
  }, [appendEvent, executeDecision, pendingDecision]);

  const dismissPending = useCallback(() => setPendingDecision(null), []);

  // ---- manual controls (wrap internals; surface errors) -------------------

  const guard = useCallback(
    async (fn: () => Promise<void>): Promise<void> => {
      setError(null);
      try {
        await fn();
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        appendEvent({ kind: "assistant", text: `⚠️ ${message}` });
      } finally {
        setBusy({ step: null, detail: "" });
      }
    },
    [appendEvent],
  );

  const approveSource = useCallback(
    () =>
      guard(async () => {
        const p0 = projectRef.current;
        const latest = p0.improved[p0.improved.length - 1] ?? p0.original;
        if (!latest) throw new Error("No source to approve.");
        mutate((p) => ({ ...p, approvedSourceId: latest.id }));
        await runAnalyzeInternal();
        await generatePreviews();
      }),
    [generatePreviews, guard, mutate, runAnalyzeInternal],
  );

  const regenerateSource = useCallback(
    (instruction: string) =>
      guard(async () => {
        const p0 = projectRef.current;
        const src = approvedSource(p0) ?? p0.original;
        if (!src) throw new Error("No source to regenerate.");
        await runImproveSource(src.imageUrl, instruction);
      }),
    [guard, runImproveSource],
  );

  const runAnalyze = useCallback(
    (guidance?: string) => guard(() => runAnalyzeInternal(guidance)),
    [guard, runAnalyzeInternal],
  );

  const runPreviews = useCallback(
    () => guard(() => generatePreviews()),
    [generatePreviews, guard],
  );

  const approveAndGenerateFinals = useCallback(
    () =>
      guard(async () => {
        mutate((p) => ({
          ...p,
          sheets: p.sheets.map((s) =>
            s.status === "draft" ? { ...s, status: "approved" } : s,
          ),
          stage: "finals",
        }));
        const ids = projectRef.current.candidates
          .filter((c) => c.status === "active")
          .map((c) => c.id);
        await generateFinalsFor(ids);
      }),
    [generateFinalsFor, guard, mutate],
  );

  const retryFinal = useCallback(
    (iconId: string) => guard(() => generateFinalsFor([iconId])),
    [generateFinalsFor, guard],
  );

  const regenerateSheet = useCallback(
    (sheetId: string, instruction: string) =>
      guard(async () => {
        const p0 = projectRef.current;
        const sheet = p0.sheets.find((s) => s.id === sheetId);
        if (!sheet) throw new Error("Sheet not found.");
        // Supersede the old sheet, render a fresh variant over the same icons.
        mutate((p) => ({
          ...p,
          sheets: p.sheets.map((s) =>
            s.id === sheetId ? { ...s, status: "superseded" } : s,
          ),
        }));
        const chunk = sheet.iconIds
          .map((id) => projectRef.current.candidates.find((c) => c.id === id))
          .filter((c): c is IconCandidate => !!c);
        await generateSingleSheet(chunk, instruction);
      }),
    [generateSingleSheet, guard, mutate],
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
    setDevMode,
    clearError,
    newProject,
    openProject,
    renameProject,
    sendMessage,
    confirmPending,
    dismissPending,
    approveSource,
    regenerateSource,
    runAnalyze,
    runPreviews,
    approveAndGenerateFinals,
    retryFinal,
    regenerateSheet,
    removeCandidate,
    updateCandidate,
  };
}

// Re-export stage helper for callers (avoids importing types.ts everywhere).
export const FABLE_STAGE_ORDER: FableStage[] = [
  "intake",
  "source_review",
  "blueprint",
  "preview_review",
  "finals",
  "complete",
];
