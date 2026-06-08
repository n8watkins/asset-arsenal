import OpenAI from "openai";
import { IconPipelineError } from "@/lib/icon/errors";

// Singleton instance — created lazily so the app builds without a key.
let _client: OpenAI | null = null;

/**
 * Returns the singleton OpenAI client. Throws IconPipelineError at call time
 * (not at module load) if OPENAI_API_KEY is not configured.
 */
export function getClient(): OpenAI {
  if (_client) return _client;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new IconPipelineError(
      "analysis",
      "API key is not configured.",
    );
  }

  _client = new OpenAI({ apiKey });
  return _client;
}
