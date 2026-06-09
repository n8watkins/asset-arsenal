// Thrown by the Gemini service layer (prompt arena / image judging); caught by
// route handlers and mapped to a friendly { error } response. Kept separate
// from IconPipelineError because the arena is not a pipeline step.
export class GeminiError extends Error {
  constructor(
    message: string,
    public rawError?: unknown,
  ) {
    super(message);
    this.name = "GeminiError";
  }
}
