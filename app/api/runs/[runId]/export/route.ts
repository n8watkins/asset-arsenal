/**
 * GET|POST /api/runs/[runId]/export   (dynamic params are async in Next 16)
 *
 * Requires a logged-in user (401 otherwise).
 * STUB: ZIP export of the generated icon pack is not implemented yet.
 * Returns 501 so the UI can show a "coming soon" state.
 */

import { auth } from "@/lib/auth";

async function handle(
  _req: Request,
  ctx: { params: Promise<{ runId: string }> },
) {
  // Resolve params to satisfy the async-params contract even though unused.
  await ctx.params;

  const userId = (await auth())?.user?.id;
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  return Response.json({ error: "ZIP export coming soon" }, { status: 501 });
}

export const GET = handle;
export const POST = handle;
