import { GoogleGenAI } from "@google/genai";
import { GeminiError } from "./errors";

// Singleton instance — created lazily so the app builds/renders without a key.
let _client: GoogleGenAI | null = null;

/**
 * Returns the singleton Gemini client. Throws GeminiError at call time (not at
 * module load) if GEMINI_API_KEY is not configured, mirroring lib/openai/client.
 *
 * The key is server-side only — never import this from a client component.
 */
export function getGeminiClient(): GoogleGenAI {
  if (_client) return _client;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new GeminiError("Gemini API key is not configured.");
  }

  _client = new GoogleGenAI({ apiKey });
  return _client;
}

// Default judge model. Gemini 3.1 Flash-Lite is multimodal (text + image in,
// text out), cheap, and fast — the right tier for high-volume arena judging.
export const DEFAULT_JUDGE_MODEL = "gemini-3.1-flash-lite";
