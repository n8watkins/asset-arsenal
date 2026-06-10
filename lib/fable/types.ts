// Fable Bench — the opinionated, productized version of the Asset Arsenal flow.
//
// This file is the SHARED CONTRACT between the server pipeline (lib/fable/*,
// app/api/fable/*) and the client workspace (app/fable, lib/fable/store.ts).
// It is client-safe: no SDK imports.
//
// The flow:
//
//   user message (+ optional image)
//     → POST /api/fable/agent            Gemini decides intent + ops (the "agent")
//     → client executes the decision against the step routes:
//        /api/fable/improve-source        Gemini writes brief → OpenAI renders upgraded source
//        /api/fable/analyze               Gemini extracts style + icon candidates
//        /api/fable/revise-prompts        Gemini applies revision ops to candidates
//        /api/fable/preview-sheet         Gemini writes sheet prompt → OpenAI renders 3×3 sheet
//        /api/fable/final-icon            OpenAI renders one standalone transparent icon
//
// Gemini (flash-lite) does ALL analysis / routing / JSON / prompt writing.
// OpenAI (gpt-image-1-mini) does ALL pixel generation.
// Every model call produces a FableUsageRecord, accumulated on the project.

// ---------------------------------------------------------------------------
// Models + limits
// ---------------------------------------------------------------------------

export const FABLE_MODELS = {
  /** All routing, analysis, structured JSON, prompt writing. Free-tier Gemini. */
  analysis: "gemini-3.1-flash-lite",
  /** All image generation (improved source, preview sheets, final icons). */
  image: "gpt-image-1-mini",
} as const;

export const FABLE_LIMITS = {
  /** Icons per preview sheet by default (3×3). */
  previewDefault: 9,
  /** Hard cap of icons on one sheet (4×4); more candidates → more sheets. */
  previewMax: 16,
  /** Cap on candidates the analyzer may propose. */
  maxCandidates: 24,
  /** Parallel final-icon generations. */
  finalConcurrency: 3,
} as const;

export type ImageQuality = "low" | "medium" | "high";

// ---------------------------------------------------------------------------
// Stages — where the project is in the flow
// ---------------------------------------------------------------------------

export const FABLE_STAGES = [
  "intake", //          nothing usable yet — waiting for an image / direction
  "source_review", //   a source (original or improved) is on the table, awaiting approval
  "blueprint", //       style + icon candidates extracted, editable before spending on previews
  "preview_review", //  preview sheet(s) rendered, awaiting approval / revisions
  "finals", //          generating / reviewing final standalone icons
  "complete", //        project saved & done
] as const;

export type FableStage = (typeof FABLE_STAGES)[number];

// ---------------------------------------------------------------------------
// Agent decision — what the Gemini router returns for each user turn
// ---------------------------------------------------------------------------

export const FABLE_INTENTS = [
  "upgrade_source", //     user wants a better visual direction generated from their image
  "use_source_as_is", //   user's image is already the style they want — skip upgrading
  "revise_source", //      user wants changes to the current improved source
  "approve_source", //     user accepted the source → move to style extraction
  "extract_style", //      run/re-run style + icon-candidate analysis
  "revise_icons", //       targeted changes to candidates / sheets (carries ops)
  "generate_previews", //  render preview sheet(s) from current candidates
  "generate_finals", //    previews approved → batch-generate standalone icons
  "save_project", //       wrap up & mark complete
  "clarify", //            genuinely not enough signal — ask (last resort)
] as const;

export type FableIntent = (typeof FABLE_INTENTS)[number];

// Revision ops are FLAT (no unions) so they map 1:1 onto a Gemini structured-
// output schema. Unused fields are null.
export const FABLE_OP_KINDS = [
  "regenerate_icon", // re-render one icon (optionally with an instruction)
  "edit_icon", //       rewrite one icon's prompt per the instruction
  "remove_icon", //     drop a candidate from the set
  "add_icon", //        add a new candidate (name + concept in fields)
  "restyle_set", //     apply an instruction to the WHOLE set's style/prompts
  "new_sheet", //       render another preview sheet variant
] as const;

export type FableOpKind = (typeof FABLE_OP_KINDS)[number];

export type FableOp = {
  op: FableOpKind;
  iconId: string | null; //      e.g. "icon_004" for icon-targeted ops
  name: string | null; //        for add_icon
  instruction: string | null; // free-text change request where applicable
};

export type FableDecision = {
  intent: FableIntent;
  confidence: number; // 0..1
  reason: string; //      one tight sentence — shown in Dev Mode
  assistantReply: string; // short user-facing message — shown in the chat
  ops: FableOp[]; //      only populated for revise_icons / revise_source
};

// Compact project summary sent WITH each agent call so routing is state-aware.
// Derived in code from the project — never by the model.
export type FableStateSummary = {
  stage: FableStage;
  hasOriginal: boolean;
  hasImproved: boolean;
  sourceApproved: boolean;
  candidateCount: number;
  candidates: { id: string; name: string }[]; // ids+names only, for targeted ops
  sheetCount: number;
  sheetApproved: boolean;
  finalsCount: number;
};

// ---------------------------------------------------------------------------
// Artifacts
// ---------------------------------------------------------------------------

export type FableSourceImage = {
  id: string;
  kind: "original" | "improved";
  imageUrl: string; // data URL
  fileName?: string;
  /** For improved sources: the OpenAI image prompt that produced it. */
  prompt?: string;
  /** For improved sources: Gemini's critique of what it fixed. */
  critique?: string;
  createdAt: string;
};

export type FableStyle = {
  styleName: string; //    short human name, e.g. "Midnight Glass SaaS"
  summary: string;
  colorPalette: string[]; // hex or descriptive
  lineStyle: string;
  shapeLanguage: string;
  lighting: string; //      glow / gradients / flat etc.
  background: string; //    what icons should sit on
  mood: string[];
  negativeRules: string[];
};

export type IconCandidate = {
  id: string; //        stable "icon_001", "icon_002", …
  name: string;
  concept: string;
  rationale: string; // why this icon belongs in the set
  prompt: string; //    per-icon generation prompt (style-grounded)
  status: "active" | "removed";
};

export type PreviewSheet = {
  id: string;
  index: number; //          sheet 1, sheet 2, …
  imageUrl: string; //       data URL
  prompt: string; //         full prompt sent to the image model
  iconIds: string[]; //      row-major order — cell (r,c) = iconIds[r*cols + c]
  grid: { rows: number; cols: number };
  status: "draft" | "approved" | "superseded";
  createdAt: string;
};

export type FableFinalIcon = {
  id: string;
  iconId: string; //   the candidate it renders, e.g. "icon_004"
  name: string;
  prompt: string; //   the final wrapped prompt actually sent
  imageUrl: string; // data URL once generated, "" until then
  model: string;
  quality: ImageQuality;
  status: "pending" | "generating" | "success" | "failed";
  error?: string;
  createdAt: string;
};

// ---------------------------------------------------------------------------
// Usage ledger — one record per model call, accumulated on the project
// ---------------------------------------------------------------------------

export type FableStepKey =
  | "agent_route" //          Gemini: intent classification
  | "improve_source_brief" // Gemini: critique + image prompt for the upgrade
  | "improve_source_image" // OpenAI: render upgraded source
  | "analyze" //              Gemini: style + icon candidates
  | "revise_prompts" //       Gemini: apply ops to candidates
  | "preview_prompt" //       Gemini: compose the sheet prompt
  | "preview_image" //        OpenAI: render preview sheet
  | "final_icon"; //          OpenAI: render one standalone icon

export type FableUsageRecord = {
  id: string;
  at: string; // ISO timestamp
  provider: "gemini" | "openai";
  model: string;
  step: FableStepKey;
  kind: "text" | "image";
  inputType: string; //  e.g. "image+text", "text"
  outputType: string; // e.g. "json", "text", "image"
  inputTokens?: number;
  outputTokens?: number;
  imageCount?: number;
  quality?: ImageQuality;
  estCostUSD: number; // 0 for Gemini free tier
  durationMs?: number;
  ok: boolean;
  error?: string;
  /** First ~300 chars of the prompt — full prompts live on the artifacts. */
  promptPreview?: string;
};

// ---------------------------------------------------------------------------
// Events — the project's chat / decision / step history
// ---------------------------------------------------------------------------

export type FableEvent =
  | {
      id: string;
      at: string;
      kind: "user_message";
      text: string;
      imageAttached: boolean;
      /** Data URL of the attached image, so the chat bubble can render it. */
      imageUrl?: string;
    }
  | { id: string; at: string; kind: "assistant"; text: string }
  | { id: string; at: string; kind: "decision"; decision: FableDecision; stageBefore: FableStage }
  | { id: string; at: string; kind: "step"; step: FableStepKey; ok: boolean; detail: string };

// ---------------------------------------------------------------------------
// Project — everything saved to IndexedDB
// ---------------------------------------------------------------------------

export type FableProject = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  stage: FableStage;

  original: FableSourceImage | null;
  improved: FableSourceImage[]; // newest last; regenerations append
  approvedSourceId: string | null; // points into original/improved

  style: FableStyle | null;
  sharedStylePrompt: string | null;
  candidates: IconCandidate[];

  sheets: PreviewSheet[];
  finals: FableFinalIcon[];

  usage: FableUsageRecord[];
  events: FableEvent[];
};

/** The approved source image, falling back to the latest improved, then original. */
export function approvedSource(p: FableProject): FableSourceImage | null {
  if (p.approvedSourceId) {
    if (p.original?.id === p.approvedSourceId) return p.original;
    const hit = p.improved.find((s) => s.id === p.approvedSourceId);
    if (hit) return hit;
  }
  return p.improved[p.improved.length - 1] ?? p.original;
}

/** Derive the compact summary sent with each agent call. */
export function summarizeProject(p: FableProject): FableStateSummary {
  return {
    stage: p.stage,
    hasOriginal: !!p.original,
    hasImproved: p.improved.length > 0,
    sourceApproved: !!p.approvedSourceId,
    candidateCount: p.candidates.filter((c) => c.status === "active").length,
    candidates: p.candidates
      .filter((c) => c.status === "active")
      .map((c) => ({ id: c.id, name: c.name })),
    sheetCount: p.sheets.filter((s) => s.status !== "superseded").length,
    sheetApproved: p.sheets.some((s) => s.status === "approved"),
    finalsCount: p.finals.filter((f) => f.status === "success").length,
  };
}

/** Split active candidates into preview-sheet chunks (≤ previewMax per sheet). */
export function chunkForSheets(candidates: IconCandidate[]): IconCandidate[][] {
  const active = candidates.filter((c) => c.status === "active");
  if (active.length === 0) return [];
  if (active.length <= FABLE_LIMITS.previewMax) return [active];
  const chunks: IconCandidate[][] = [];
  for (let i = 0; i < active.length; i += FABLE_LIMITS.previewDefault) {
    chunks.push(active.slice(i, i + FABLE_LIMITS.previewDefault));
  }
  return chunks;
}

/** Grid shape for n icons: 3×3 up to 9, then 4×4 up to 16. */
export function gridFor(n: number): { rows: number; cols: number } {
  if (n <= 9) {
    const cols = Math.min(3, Math.max(1, n));
    return { rows: Math.ceil(n / cols), cols };
  }
  return { rows: Math.ceil(n / 4), cols: 4 };
}

// ---------------------------------------------------------------------------
// API request / response shapes (one per route)
// ---------------------------------------------------------------------------

// POST /api/fable/agent
export type AgentRequest = {
  text: string;
  /** Data URL or bare base64; null when no NEW image was attached this turn. */
  imageBase64: string | null;
  state: FableStateSummary;
};
export type AgentResponse = {
  decision: FableDecision;
  usage: FableUsageRecord[];
};

// POST /api/fable/improve-source
export type ImproveSourceRequest = {
  imageBase64: string; //  the original (or current) source
  instruction: string; //  user's ask, e.g. "make this look better" or a revision
  quality?: ImageQuality;
};
export type ImproveSourceResponse = {
  critique: string; //   what Gemini decided to fix
  imagePrompt: string; // the OpenAI prompt used
  imageBase64: string; // the improved source (data URL)
  usage: FableUsageRecord[];
};

// POST /api/fable/analyze
export type AnalyzeStyleRequest = {
  imageBase64: string; // the approved source
  guidance?: string; //   optional user steer, e.g. "more dark-mode SaaS"
  maxIcons?: number; //   defaults to FABLE_LIMITS.maxCandidates
};
export type AnalyzeStyleResponse = {
  style: FableStyle;
  sharedStylePrompt: string;
  candidates: IconCandidate[]; // ids assigned icon_001… in order
  usage: FableUsageRecord[];
};

// POST /api/fable/revise-prompts
export type RevisePromptsRequest = {
  style: FableStyle;
  sharedStylePrompt: string;
  candidates: IconCandidate[];
  ops: FableOp[];
};
export type RevisePromptsResponse = {
  /** Full updated candidate list (removed ones get status:"removed"; added ones
   *  get the next free icon_NNN id). */
  candidates: IconCandidate[];
  sharedStylePrompt: string; // possibly updated by restyle_set
  usage: FableUsageRecord[];
};

// POST /api/fable/preview-sheet
export type PreviewSheetRequest = {
  referenceImageBase64: string; // the approved source
  style: FableStyle;
  sharedStylePrompt: string;
  icons: { id: string; name: string; concept: string; prompt: string }[];
  sheetIndex: number;
  instruction?: string; // for "try another sheet" variants
  quality?: ImageQuality;
};
export type PreviewSheetResponse = {
  sheetPrompt: string;
  imageBase64: string; // data URL
  grid: { rows: number; cols: number };
  usage: FableUsageRecord[];
};

// POST /api/fable/final-icon
export type FinalIconRequest = {
  referenceImageBase64: string; // the APPROVED PREVIEW SHEET (style anchor)
  sharedStylePrompt: string;
  icon: { id: string; name: string; concept: string; prompt: string };
  quality?: ImageQuality;
};
export type FinalIconResponse = {
  final: FableFinalIcon;
  usage: FableUsageRecord[];
};

export type FableApiError = { error: string };
