import type { PipelineErrorStep } from "@/types/icon-pipeline";

// Thrown by the OpenAI service layer; caught by route handlers and mapped to a
// friendly { error } response. See docs/API-CONTRACT.md.
export class IconPipelineError extends Error {
  constructor(
    public step: PipelineErrorStep,
    message: string,
    public rawError?: unknown,
  ) {
    super(message);
    this.name = "IconPipelineError";
  }
}

export const API_KEY_MISSING = "API_KEY_MISSING";
