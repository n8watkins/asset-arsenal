import { z } from "zod";
import { ROUTER_FLOWS } from "./types";

// POST /api/router — request body. The image is never sent; `hasImage` is the
// only thing the router needs to know about it.
export const RouterRequestSchema = z.object({
  hasImage: z.boolean(),
  text: z.string(),
  iconList: z.array(z.string()),
  model: z.string().optional(),
});

// The model's structured JSON output, re-validated server-side after parsing
// (the model is asked for exactly this shape via responseSchema).
export const RouterModelOutputSchema = z.object({
  recommendedFlow: z.enum(ROUTER_FLOWS),
  confidence: z.number().min(0).max(1),
  needsUserChoice: z.boolean(),
  reason: z.string(),
});
