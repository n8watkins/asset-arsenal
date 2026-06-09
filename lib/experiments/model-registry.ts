// The capability-typed model registry for the experiment harness. This is the
// heart of the pivot: models are just rows with an I/O signature, and Gemini is
// nothing special — it's a google/text-output row alongside the OpenAI ones.
//
// We DERIVE the OpenAI rows from the existing CatalogModel (kind + capabilities)
// so there's one source of truth for model facts, and add Gemini from the
// client-safe judge-model list. No provider import here → safe in the browser.

import { CATALOG, type CatalogModel } from "@/lib/icon/model-reference";
import { JUDGE_MODELS } from "@/lib/gemini/models";
import type { Modality, IOSignature } from "./modality";

export type Provider = "openai" | "google";

export type ExperimentModel = {
  id: string;
  provider: Provider;
  label: string;
  // Every input modality the model can ACCEPT (some optional, e.g. a reference
  // image for an image model). A model fits a signature when it accepts every
  // input the signature provides and emits the requested output.
  inputs: Modality[];
  output: Modality;
  status: "current" | "deprecated";
  blurb?: string;
};

// Map an OpenAI catalog entry to its I/O signature from its declared kind +
// capabilities. Image models that can do imageEdit accept an optional reference
// image; text models with vision accept an optional image input.
function fromCatalog(m: CatalogModel): ExperimentModel {
  const isImage = m.kind === "image";
  const acceptsImage = isImage
    ? m.capabilities.includes("imageEdit")
    : m.capabilities.includes("vision");
  return {
    id: m.id,
    provider: "openai",
    label: m.id,
    inputs: acceptsImage ? ["text", "image"] : ["text"],
    output: isImage ? "image" : "text",
    status: m.status,
    blurb: m.note,
  };
}

// Gemini: text output, multimodal input (text + image). Image OUTPUT stays
// OpenAI-only by design, so Gemini never appears for image-output experiments.
const GEMINI_MODELS: ExperimentModel[] = JUDGE_MODELS.map((g) => ({
  id: g.id,
  provider: "google",
  label: `Gemini ${g.label}`,
  inputs: ["text", "image"],
  output: "text",
  status: "current",
  blurb: g.blurb,
}));

export const EXPERIMENT_MODELS: ExperimentModel[] = [
  ...CATALOG.map(fromCatalog),
  ...GEMINI_MODELS,
];

export function getExperimentModel(id: string): ExperimentModel | undefined {
  return EXPERIMENT_MODELS.find((m) => m.id === id);
}

/** A model fits when it emits the requested output and accepts every input. */
export function modelFitsSignature(m: ExperimentModel, io: IOSignature): boolean {
  return m.output === io.output && io.inputs.every((i) => m.inputs.includes(i));
}

/** All models compatible with a signature (what the picker offers). */
export function modelsForSignature(io: IOSignature): ExperimentModel[] {
  return EXPERIMENT_MODELS.filter((m) => modelFitsSignature(m, io));
}

// The signatures offered at v1. Each one filters the model picker; "video"
// outputs are intentionally absent until a video model is registered.
export const SIGNATURE_PRESETS: { io: IOSignature; title: string; desc: string }[] = [
  {
    io: { inputs: ["text"], output: "image" },
    title: "Text → Image",
    desc: "Generate from a prompt. Compare prompts, or the same prompt across image models.",
  },
  {
    io: { inputs: ["text", "image"], output: "image" },
    title: "Text + Image → Image",
    desc: "Generate with a reference image (edit) — matches how the pipeline really generates.",
  },
  {
    io: { inputs: ["text"], output: "text" },
    title: "Text → Text",
    desc: "Prompt-to-prompt: transform or refine text. Compare prompts or text models.",
  },
  {
    io: { inputs: ["text", "image"], output: "text" },
    title: "Text + Image → Text",
    desc: "Analyze, describe, or score an image. (This is where Gemini shines.)",
  },
];
