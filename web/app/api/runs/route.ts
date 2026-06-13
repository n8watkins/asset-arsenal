/**
 * POST /api/runs
 * Body: { sourceImageUrl?, sourceImageKey?, runId? }
 * Returns: { runId, iconManifest: { iconCount, icons: [...] } }
 *
 * Requires a logged-in user (401 otherwise). Creates an icon run and runs the
 * STUB "analyze" step, returning a fixed 12-icon manifest so the UI is fully
 * exercisable. Persists an icon_run row (status "ready") with the manifest.
 *
 * Abuse guard: a user may create at most MAX_RUNS_PER_HOUR runs per rolling
 * hour (429 otherwise).
 */

import { auth } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { isOverRunRateLimit } from "@/lib/limits";

/** Stub manifest — a believable dashboard icon system. */
const STUB_ICONS = [
  { id: "icon_001", name: "Home", concept: "navigation home", confidence: "high" },
  { id: "icon_002", name: "Search", concept: "global search", confidence: "high" },
  { id: "icon_003", name: "Dashboard", concept: "analytics grid overview", confidence: "high" },
  { id: "icon_004", name: "Settings", concept: "gear settings", confidence: "high" },
  { id: "icon_005", name: "Notifications", concept: "bell alerts", confidence: "high" },
  { id: "icon_006", name: "Profile", concept: "user avatar account", confidence: "medium" },
  { id: "icon_007", name: "Messages", concept: "chat envelope", confidence: "high" },
  { id: "icon_008", name: "Calendar", concept: "schedule date", confidence: "medium" },
  { id: "icon_009", name: "Analytics", concept: "bar chart metrics", confidence: "high" },
  { id: "icon_010", name: "Files", concept: "documents folder", confidence: "medium" },
  { id: "icon_011", name: "Billing", concept: "credit card payment", confidence: "medium" },
  { id: "icon_012", name: "Logout", concept: "sign out exit", confidence: "high" },
];

export async function POST(req: Request) {
  const userId = (await auth())?.user?.id;
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Abuse guard: cap runs per hour.
  if (await isOverRunRateLimit(userId)) {
    return Response.json(
      { error: "Rate limit: too many runs this hour" },
      { status: 429 },
    );
  }

  let body: {
    sourceImageUrl?: string;
    sourceImageKey?: string;
    runId?: string;
  };
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const iconManifest = { iconCount: STUB_ICONS.length, icons: STUB_ICONS };

  let runId = body.runId ?? crypto.randomUUID();

  const db = getDb();
  const inserted = await db
    .insert(schema.iconRuns)
    .values({
      ...(body.runId ? { id: body.runId } : {}),
      userId,
      status: "ready",
      sourceImageKey: body.sourceImageKey,
      sourceImageUrl: body.sourceImageUrl,
      iconManifest,
      iconCount: iconManifest.iconCount,
    })
    .returning({ id: schema.iconRuns.id })
    .get();
  if (inserted?.id) runId = inserted.id;

  return Response.json({ runId, iconManifest });
}
