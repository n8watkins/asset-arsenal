/**
 * GET|POST /api/runs/[runId]/export   (dynamic params are async in Next 16)
 *
 * STUB: ZIP export of the generated icon pack is not implemented yet.
 * Returns 501 so the UI can show a "coming soon" state.
 */

async function handle(
  _req: Request,
  ctx: { params: Promise<{ runId: string }> },
) {
  // Resolve params to satisfy the async-params contract even though unused.
  await ctx.params;
  return Response.json({ error: "ZIP export coming soon" }, { status: 501 });
}

export const GET = handle;
export const POST = handle;
