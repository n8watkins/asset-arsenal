// Fable Bench — server-only Gemini steps (flash-lite, structured JSON output).
//
// All four functions:
//   - use getGeminiClient() + the caller's model (default FABLE_MODELS.analysis)
//   - set temperature 0, responseMimeType "application/json", responseSchema
//   - measure durationMs and record token usage via geminiUsageRecord()
//   - return { ...result, usage: FableUsageRecord[] }
//   - throw FableError (with any accumulated usage attached) on failure

import { Type } from "@google/genai";
import { z } from "zod";
import { getGeminiClient } from "@/lib/gemini/client";
import { GeminiError } from "@/lib/gemini/errors";
import { geminiUsageRecord, previewOf } from "./pricing";
import { FableError } from "./errors";
import {
  AGENT_SYSTEM_INSTRUCTION,
  buildImproveSourceBrief,
  buildAnalyzeComposer,
  buildReviseComposer,
} from "./prompts";
import {
  FABLE_MODELS,
  FABLE_LIMITS,
  FABLE_INTENTS,
  FABLE_OP_KINDS,
} from "./types";
import type {
  FableUsageRecord,
  FableStateSummary,
  FableDecision,
  FableStyle,
  IconCandidate,
  FableOp,
} from "./types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Split a data URL or bare base64 into mimeType + raw base64 data. */
function splitDataUrl(dataUrl: string): { mimeType: string; data: string } {
  const m = /^data:([^;]+);base64,(.*)$/.exec(dataUrl);
  if (m) return { mimeType: m[1], data: m[2] };
  return { mimeType: "image/png", data: dataUrl };
}

// ---------------------------------------------------------------------------
// runAgent — intent classification + op emission
// ---------------------------------------------------------------------------

// Router-specific rules appended to the base system instruction. These cover
// conversational context (state.recentMessages) and image-only turns; they
// OVERRIDE the base prompt's "prefer source intents when an image is attached"
// guidance for the empty-text case.
const AGENT_ROUTER_CONTEXT = `

IMAGE-ONLY MESSAGES (overrides the clarify guidance above): when an image is attached and the user wrote NO text, choose intent "clarify" and ask ONE short, friendly question about what they'd like to do with the image (e.g. polish it up first, or pull an icon pack straight from it). Do not pick a generation intent from a bare image alone — unless state.recentMessages makes the goal obvious (e.g. you just asked them to attach the image for a specific step).

WORKING SOURCE PERSISTS ACROSS TURNS: when state.hasOriginal is true, an image the user sent EARLIER in this conversation is already stored as the project's working source. Follow-up text-only messages ("make it darker", "extract the icons") refer to THAT image — never ask the user to re-attach or re-send it.

RECENT CONVERSATION: state.recentMessages holds the last few user/assistant chat turns (oldest first, truncated). Judge terse messages ("yes", "go", "the second one") and bare images against this recent conversation and the project state, and resolve them to the most plausible intent. Choose "clarify" only when the message is genuinely ambiguous even with this context.`;

const agentResponseSchema = {
  type: Type.OBJECT,
  properties: {
    intent: { type: Type.STRING, enum: [...FABLE_INTENTS] },
    ops: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          op: { type: Type.STRING, enum: [...FABLE_OP_KINDS] },
          iconId: { type: Type.STRING },
          name: { type: Type.STRING },
          instruction: { type: Type.STRING },
        },
        required: ["op"],
        propertyOrdering: ["op", "iconId", "name", "instruction"],
      },
    },
    confidence: { type: Type.NUMBER },
    reason: { type: Type.STRING },
    assistantReply: { type: Type.STRING },
    suggestedTitle: { type: Type.STRING },
  },
  required: ["intent", "ops", "confidence", "reason", "assistantReply"],
  propertyOrdering: ["intent", "ops", "confidence", "reason", "assistantReply", "suggestedTitle"],
};

// Zod schema to re-validate the model's JSON output server-side.
const AgentOutputSchema = z.object({
  intent: z.enum(FABLE_INTENTS),
  ops: z.array(
    z.object({
      op: z.enum(FABLE_OP_KINDS),
      iconId: z.string().nullable().optional(),
      name: z.string().nullable().optional(),
      instruction: z.string().nullable().optional(),
    }),
  ),
  confidence: z.number().min(0).max(1),
  reason: z.string(),
  assistantReply: z.string(),
  suggestedTitle: z.string().nullable().optional(),
});

export async function runAgent(args: {
  text: string;
  imageBase64: string | null;
  state: FableStateSummary;
  model?: string;
}): Promise<{ decision: FableDecision; usage: FableUsageRecord[] }> {
  const ai = getGeminiClient();
  const model = args.model ?? FABLE_MODELS.analysis;
  const start = Date.now();

  // Build the user-turn parts: state JSON + text + optional image. An empty
  // text with an image is a valid turn — flag it explicitly for the router.
  const userText =
    args.text.trim() ||
    (args.imageBase64 ? "(no text — the user sent only an image)" : "");
  type Part = { text: string } | { inlineData: { mimeType: string; data: string } };
  const parts: Part[] = [
    { text: `PROJECT STATE:\n${JSON.stringify(args.state, null, 2)}\n\nUSER MESSAGE:\n${userText}` },
  ];
  if (args.imageBase64) {
    const { mimeType, data } = splitDataUrl(args.imageBase64);
    parts.push({ inlineData: { mimeType, data } });
  }

  const promptPreview = previewOf(`${args.text} [state:${args.state.stage}]`);

  let res;
  try {
    res = await ai.models.generateContent({
      model,
      contents: [{ role: "user", parts }],
      config: {
        systemInstruction: AGENT_SYSTEM_INSTRUCTION + AGENT_ROUTER_CONTEXT,
        responseMimeType: "application/json",
        responseSchema: agentResponseSchema,
        temperature: 0,
      },
    });
  } catch (err) {
    const durationMs = Date.now() - start;
    const usageRecord = geminiUsageRecord({
      step: "agent_route",
      model,
      inputType: args.imageBase64 ? "image+text" : "text",
      outputType: "json",
      durationMs,
      ok: false,
      error: err instanceof Error ? err.message : "Gemini request failed.",
      promptPreview,
    });
    throw new FableError(
      "agent_route",
      err instanceof Error ? err.message : "Agent request failed.",
      [usageRecord],
      err,
    );
  }

  const durationMs = Date.now() - start;
  const meta = res.usageMetadata;

  const raw = res.text;
  if (!raw) {
    const usageRecord = geminiUsageRecord({
      step: "agent_route",
      model,
      inputType: args.imageBase64 ? "image+text" : "text",
      outputType: "json",
      inputTokens: meta?.promptTokenCount ?? 0,
      outputTokens: meta?.candidatesTokenCount ?? 0,
      durationMs,
      ok: false,
      error: "Empty response from agent.",
      promptPreview,
    });
    throw new FableError("agent_route", "Agent returned an empty response.", [usageRecord]);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    const usageRecord = geminiUsageRecord({
      step: "agent_route",
      model,
      inputType: args.imageBase64 ? "image+text" : "text",
      outputType: "json",
      inputTokens: meta?.promptTokenCount ?? 0,
      outputTokens: meta?.candidatesTokenCount ?? 0,
      durationMs,
      ok: false,
      error: `Non-JSON response: ${raw.slice(0, 100)}`,
      promptPreview,
    });
    throw new FableError(
      "agent_route",
      `Agent returned non-JSON: ${raw.slice(0, 200)}`,
      [usageRecord],
    );
  }

  const valid = AgentOutputSchema.safeParse(parsed);
  if (!valid.success) {
    const usageRecord = geminiUsageRecord({
      step: "agent_route",
      model,
      inputType: args.imageBase64 ? "image+text" : "text",
      outputType: "json",
      inputTokens: meta?.promptTokenCount ?? 0,
      outputTokens: meta?.candidatesTokenCount ?? 0,
      durationMs,
      ok: false,
      error: `Validation failed: ${valid.error.issues[0]?.message ?? "bad shape"}`,
      promptPreview,
    });
    throw new FableError(
      "agent_route",
      `Agent output failed validation: ${valid.error.issues[0]?.message ?? "bad shape"}`,
      [usageRecord],
    );
  }

  const data = valid.data;
  const usageRecord = geminiUsageRecord({
    step: "agent_route",
    model,
    inputType: args.imageBase64 ? "image+text" : "text",
    outputType: "json",
    inputTokens: meta?.promptTokenCount ?? 0,
    outputTokens: meta?.candidatesTokenCount ?? 0,
    durationMs,
    ok: true,
    promptPreview,
  });

  // Normalize ops: null out absent optional fields.
  const ops: FableOp[] = data.ops.map((o) => ({
    op: o.op,
    iconId: o.iconId ?? null,
    name: o.name ?? null,
    instruction: o.instruction ?? null,
  }));

  const decision: FableDecision = {
    intent: data.intent,
    confidence: Math.min(1, Math.max(0, data.confidence)),
    reason: data.reason,
    assistantReply: data.assistantReply,
    ops,
    suggestedTitle: data.suggestedTitle?.trim() || null,
  };

  return { decision, usage: [usageRecord] };
}

// ---------------------------------------------------------------------------
// improveSourceBrief — Gemini vision → critique + imagePrompt
// ---------------------------------------------------------------------------

const improveBriefSchema = {
  type: Type.OBJECT,
  properties: {
    critique: { type: Type.STRING },
    imagePrompt: { type: Type.STRING },
  },
  required: ["critique", "imagePrompt"],
  propertyOrdering: ["critique", "imagePrompt"],
};

const ImproveBriefOutputSchema = z.object({
  critique: z.string(),
  imagePrompt: z.string(),
});

export async function improveSourceBrief(args: {
  imageBase64: string;
  instruction: string;
  model?: string;
}): Promise<{ critique: string; imagePrompt: string; usage: FableUsageRecord[] }> {
  const ai = getGeminiClient();
  const model = args.model ?? FABLE_MODELS.analysis;
  const start = Date.now();
  const prompt = buildImproveSourceBrief(args.instruction);
  const promptPreview = previewOf(prompt);
  const { mimeType, data } = splitDataUrl(args.imageBase64);

  let res;
  try {
    res = await ai.models.generateContent({
      model,
      contents: [
        {
          role: "user",
          parts: [
            { inlineData: { mimeType, data } },
            { text: prompt },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: improveBriefSchema,
        temperature: 0,
      },
    });
  } catch (err) {
    const durationMs = Date.now() - start;
    const usageRecord = geminiUsageRecord({
      step: "improve_source_brief",
      model,
      inputType: "image+text",
      outputType: "json",
      durationMs,
      ok: false,
      error: err instanceof Error ? err.message : "Gemini request failed.",
      promptPreview,
    });
    throw new FableError(
      "improve_source_brief",
      err instanceof Error ? err.message : "Improve-source brief failed.",
      [usageRecord],
      err,
    );
  }

  const durationMs = Date.now() - start;
  const meta = res.usageMetadata;

  const raw = res.text;
  if (!raw) {
    const usageRecord = geminiUsageRecord({
      step: "improve_source_brief",
      model,
      inputType: "image+text",
      outputType: "json",
      inputTokens: meta?.promptTokenCount ?? 0,
      outputTokens: meta?.candidatesTokenCount ?? 0,
      durationMs,
      ok: false,
      error: "Empty response.",
      promptPreview,
    });
    throw new FableError("improve_source_brief", "Improve-source brief returned empty.", [usageRecord]);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    const usageRecord = geminiUsageRecord({
      step: "improve_source_brief",
      model,
      inputType: "image+text",
      outputType: "json",
      inputTokens: meta?.promptTokenCount ?? 0,
      outputTokens: meta?.candidatesTokenCount ?? 0,
      durationMs,
      ok: false,
      error: `Non-JSON: ${raw.slice(0, 100)}`,
      promptPreview,
    });
    throw new FableError("improve_source_brief", `Non-JSON response: ${raw.slice(0, 200)}`, [usageRecord]);
  }

  const valid = ImproveBriefOutputSchema.safeParse(parsed);
  if (!valid.success) {
    const usageRecord = geminiUsageRecord({
      step: "improve_source_brief",
      model,
      inputType: "image+text",
      outputType: "json",
      inputTokens: meta?.promptTokenCount ?? 0,
      outputTokens: meta?.candidatesTokenCount ?? 0,
      durationMs,
      ok: false,
      error: `Validation: ${valid.error.issues[0]?.message ?? "bad shape"}`,
      promptPreview,
    });
    throw new FableError(
      "improve_source_brief",
      `Improve-source brief validation failed: ${valid.error.issues[0]?.message ?? "bad shape"}`,
      [usageRecord],
    );
  }

  const usageRecord = geminiUsageRecord({
    step: "improve_source_brief",
    model,
    inputType: "image+text",
    outputType: "json",
    inputTokens: meta?.promptTokenCount ?? 0,
    outputTokens: meta?.candidatesTokenCount ?? 0,
    durationMs,
    ok: true,
    promptPreview,
  });

  return { ...valid.data, usage: [usageRecord] };
}

// ---------------------------------------------------------------------------
// analyzeStyle — Gemini vision → FableStyle + sharedStylePrompt + candidates
// ---------------------------------------------------------------------------

const analyzeStyleSchema = {
  type: Type.OBJECT,
  properties: {
    style: {
      type: Type.OBJECT,
      properties: {
        styleName: { type: Type.STRING },
        summary: { type: Type.STRING },
        colorPalette: { type: Type.ARRAY, items: { type: Type.STRING } },
        lineStyle: { type: Type.STRING },
        shapeLanguage: { type: Type.STRING },
        lighting: { type: Type.STRING },
        background: { type: Type.STRING },
        mood: { type: Type.ARRAY, items: { type: Type.STRING } },
        negativeRules: { type: Type.ARRAY, items: { type: Type.STRING } },
      },
      required: [
        "styleName",
        "summary",
        "colorPalette",
        "lineStyle",
        "shapeLanguage",
        "lighting",
        "background",
        "mood",
        "negativeRules",
      ],
      propertyOrdering: [
        "styleName",
        "summary",
        "colorPalette",
        "lineStyle",
        "shapeLanguage",
        "lighting",
        "background",
        "mood",
        "negativeRules",
      ],
    },
    sharedStylePrompt: { type: Type.STRING },
    candidates: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          concept: { type: Type.STRING },
          rationale: { type: Type.STRING },
          prompt: { type: Type.STRING },
        },
        required: ["name", "concept", "rationale", "prompt"],
        propertyOrdering: ["name", "concept", "rationale", "prompt"],
      },
    },
  },
  required: ["style", "sharedStylePrompt", "candidates"],
  propertyOrdering: ["style", "sharedStylePrompt", "candidates"],
};

const AnalyzeStyleOutputSchema = z.object({
  style: z.object({
    styleName: z.string(),
    summary: z.string(),
    colorPalette: z.array(z.string()),
    lineStyle: z.string(),
    shapeLanguage: z.string(),
    lighting: z.string(),
    background: z.string(),
    mood: z.array(z.string()),
    negativeRules: z.array(z.string()),
  }),
  sharedStylePrompt: z.string(),
  candidates: z.array(
    z.object({
      name: z.string(),
      concept: z.string(),
      rationale: z.string(),
      prompt: z.string(),
    }),
  ),
});

export async function analyzeStyle(args: {
  imageBase64: string;
  guidance?: string;
  maxIcons?: number;
  model?: string;
}): Promise<{
  style: FableStyle;
  sharedStylePrompt: string;
  candidates: IconCandidate[];
  usage: FableUsageRecord[];
}> {
  const ai = getGeminiClient();
  const model = args.model ?? FABLE_MODELS.analysis;
  const start = Date.now();
  const maxIcons = Math.min(args.maxIcons ?? FABLE_LIMITS.maxCandidates, FABLE_LIMITS.maxCandidates);
  const prompt = buildAnalyzeComposer(args.guidance ?? "", maxIcons);
  const promptPreview = previewOf(prompt);
  const { mimeType, data } = splitDataUrl(args.imageBase64);

  let res;
  try {
    res = await ai.models.generateContent({
      model,
      contents: [
        {
          role: "user",
          parts: [
            { inlineData: { mimeType, data } },
            { text: prompt },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: analyzeStyleSchema,
        temperature: 0,
      },
    });
  } catch (err) {
    const durationMs = Date.now() - start;
    const usageRecord = geminiUsageRecord({
      step: "analyze",
      model,
      inputType: "image+text",
      outputType: "json",
      durationMs,
      ok: false,
      error: err instanceof Error ? err.message : "Gemini request failed.",
      promptPreview,
    });
    throw new FableError(
      "analyze",
      err instanceof Error ? err.message : "Style analysis failed.",
      [usageRecord],
      err,
    );
  }

  const durationMs = Date.now() - start;
  const meta = res.usageMetadata;

  const raw = res.text;
  if (!raw) {
    const usageRecord = geminiUsageRecord({
      step: "analyze",
      model,
      inputType: "image+text",
      outputType: "json",
      inputTokens: meta?.promptTokenCount ?? 0,
      outputTokens: meta?.candidatesTokenCount ?? 0,
      durationMs,
      ok: false,
      error: "Empty response.",
      promptPreview,
    });
    throw new FableError("analyze", "Style analysis returned empty.", [usageRecord]);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    const usageRecord = geminiUsageRecord({
      step: "analyze",
      model,
      inputType: "image+text",
      outputType: "json",
      inputTokens: meta?.promptTokenCount ?? 0,
      outputTokens: meta?.candidatesTokenCount ?? 0,
      durationMs,
      ok: false,
      error: `Non-JSON: ${raw.slice(0, 100)}`,
      promptPreview,
    });
    throw new FableError("analyze", `Style analysis non-JSON response: ${raw.slice(0, 200)}`, [usageRecord]);
  }

  const valid = AnalyzeStyleOutputSchema.safeParse(parsed);
  if (!valid.success) {
    const usageRecord = geminiUsageRecord({
      step: "analyze",
      model,
      inputType: "image+text",
      outputType: "json",
      inputTokens: meta?.promptTokenCount ?? 0,
      outputTokens: meta?.candidatesTokenCount ?? 0,
      durationMs,
      ok: false,
      error: `Validation: ${valid.error.issues[0]?.message ?? "bad shape"}`,
      promptPreview,
    });
    throw new FableError(
      "analyze",
      `Style analysis validation failed: ${valid.error.issues[0]?.message ?? "bad shape"}`,
      [usageRecord],
    );
  }

  const usageRecord = geminiUsageRecord({
    step: "analyze",
    model,
    inputType: "image+text",
    outputType: "json",
    inputTokens: meta?.promptTokenCount ?? 0,
    outputTokens: meta?.candidatesTokenCount ?? 0,
    durationMs,
    ok: true,
    promptPreview,
  });

  // Server assigns ids — cap at maxIcons.
  const candidates: IconCandidate[] = valid.data.candidates
    .slice(0, maxIcons)
    .map((c, i) => ({
      id: `icon_${String(i + 1).padStart(3, "0")}`,
      name: c.name,
      concept: c.concept,
      rationale: c.rationale,
      prompt: c.prompt,
      status: "active" as const,
    }));

  return {
    style: valid.data.style,
    sharedStylePrompt: valid.data.sharedStylePrompt,
    candidates,
    usage: [usageRecord],
  };
}

// ---------------------------------------------------------------------------
// revisePrompts — Gemini → updated candidates + possibly new sharedStylePrompt
// ---------------------------------------------------------------------------

const revisePromptsSchema = {
  type: Type.OBJECT,
  properties: {
    sharedStylePrompt: { type: Type.STRING },
    candidates: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          name: { type: Type.STRING },
          concept: { type: Type.STRING },
          rationale: { type: Type.STRING },
          prompt: { type: Type.STRING },
          status: { type: Type.STRING, enum: ["active", "removed"] },
        },
        required: ["id", "name", "concept", "rationale", "prompt", "status"],
        propertyOrdering: ["id", "name", "concept", "rationale", "prompt", "status"],
      },
    },
  },
  required: ["sharedStylePrompt", "candidates"],
  propertyOrdering: ["sharedStylePrompt", "candidates"],
};

const RevisePromptsOutputSchema = z.object({
  sharedStylePrompt: z.string(),
  candidates: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      concept: z.string(),
      rationale: z.string(),
      prompt: z.string(),
      status: z.enum(["active", "removed"]),
    }),
  ),
});

export async function revisePrompts(args: {
  style: FableStyle;
  sharedStylePrompt: string;
  candidates: IconCandidate[];
  ops: FableOp[];
  model?: string;
}): Promise<{
  candidates: IconCandidate[];
  sharedStylePrompt: string;
  usage: FableUsageRecord[];
}> {
  const ai = getGeminiClient();
  const model = args.model ?? FABLE_MODELS.analysis;
  const start = Date.now();
  const prompt = buildReviseComposer(args);
  const promptPreview = previewOf(prompt);

  let res;
  try {
    res = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: revisePromptsSchema,
        temperature: 0,
      },
    });
  } catch (err) {
    const durationMs = Date.now() - start;
    const usageRecord = geminiUsageRecord({
      step: "revise_prompts",
      model,
      inputType: "text",
      outputType: "json",
      durationMs,
      ok: false,
      error: err instanceof Error ? err.message : "Gemini request failed.",
      promptPreview,
    });
    throw new FableError(
      "revise_prompts",
      err instanceof Error ? err.message : "Revise-prompts failed.",
      [usageRecord],
      err,
    );
  }

  const durationMs = Date.now() - start;
  const meta = res.usageMetadata;

  const raw = res.text;
  if (!raw) {
    const usageRecord = geminiUsageRecord({
      step: "revise_prompts",
      model,
      inputType: "text",
      outputType: "json",
      inputTokens: meta?.promptTokenCount ?? 0,
      outputTokens: meta?.candidatesTokenCount ?? 0,
      durationMs,
      ok: false,
      error: "Empty response.",
      promptPreview,
    });
    throw new FableError("revise_prompts", "Revise-prompts returned empty.", [usageRecord]);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    const usageRecord = geminiUsageRecord({
      step: "revise_prompts",
      model,
      inputType: "text",
      outputType: "json",
      inputTokens: meta?.promptTokenCount ?? 0,
      outputTokens: meta?.candidatesTokenCount ?? 0,
      durationMs,
      ok: false,
      error: `Non-JSON: ${raw.slice(0, 100)}`,
      promptPreview,
    });
    throw new FableError("revise_prompts", `Revise-prompts non-JSON response: ${raw.slice(0, 200)}`, [usageRecord]);
  }

  const valid = RevisePromptsOutputSchema.safeParse(parsed);
  if (!valid.success) {
    const usageRecord = geminiUsageRecord({
      step: "revise_prompts",
      model,
      inputType: "text",
      outputType: "json",
      inputTokens: meta?.promptTokenCount ?? 0,
      outputTokens: meta?.candidatesTokenCount ?? 0,
      durationMs,
      ok: false,
      error: `Validation: ${valid.error.issues[0]?.message ?? "bad shape"}`,
      promptPreview,
    });
    throw new FableError(
      "revise_prompts",
      `Revise-prompts validation failed: ${valid.error.issues[0]?.message ?? "bad shape"}`,
      [usageRecord],
    );
  }

  const usageRecord = geminiUsageRecord({
    step: "revise_prompts",
    model,
    inputType: "text",
    outputType: "json",
    inputTokens: meta?.promptTokenCount ?? 0,
    outputTokens: meta?.candidatesTokenCount ?? 0,
    durationMs,
    ok: true,
    promptPreview,
  });

  // Server-side reconciliation:
  // 1. Ignore any op-produced ids that aren't in the original list (protection).
  // 2. Assign the next free icon_NNN id to any new candidates (id === "").
  const existingIds = new Set(args.candidates.map((c) => c.id));

  // Determine highest numeric suffix in use so far.
  let maxNum = args.candidates.reduce((m, c) => {
    const n = parseInt(c.id.replace("icon_", ""), 10);
    return isNaN(n) ? m : Math.max(m, n);
  }, 0);

  const reconciled: IconCandidate[] = valid.data.candidates.map((c) => {
    if (c.id === "" || !existingIds.has(c.id)) {
      // New candidate — assign the next available id.
      maxNum += 1;
      return {
        ...c,
        id: `icon_${String(maxNum).padStart(3, "0")}`,
        status: "active" as const,
      };
    }
    return { ...c, status: c.status };
  });

  return {
    candidates: reconciled,
    sharedStylePrompt: valid.data.sharedStylePrompt,
    usage: [usageRecord],
  };
}
