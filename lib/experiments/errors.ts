// Thrown by the experiment runner's executor; caught by the route and mapped to
// a friendly { error } response. Provider key errors surface with their own
// messages (OpenAI / Gemini), so this is mostly for our own validation.
export class ExperimentError extends Error {
  constructor(
    message: string,
    public rawError?: unknown,
  ) {
    super(message);
    this.name = "ExperimentError";
  }
}
