/**
 * POST /api/runs
 * Body: { sourceImageUrl?, sourceImageKey?, runId? }
 * Returns: { runId, iconManifest: { iconCount, icons: [...] } }
 *
 * Creates an icon run and runs the STUB "analyze" step. The real pipeline will
 * detect the icon system from the source image; for now we return a fixed,
 * plausible 12-icon manifest so the UI is fully exercisable. When a DB is
 * configured we persist an icon_run row (status "ready") with the manifest.
 */

import { auth } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { features } from "@/lib/env";

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

  const userId = (await auth())?.user?.id ?? "demo-user";
  const iconManifest = { iconCount: STUB_ICONS.length, icons: STUB_ICONS };

  let runId = body.runId ?? crypto.randomUUID();

  // Persist the run when a real DB is configured (skip for the demo user).
  if (features.db && userId !== "demo-user") {
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
  }

  return Response.json({ runId, iconManifest });
}
