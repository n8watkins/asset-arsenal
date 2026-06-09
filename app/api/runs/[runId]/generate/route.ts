/**
 * POST /api/runs/[runId]/generate   (dynamic params are async in Next 16)
 * Body: { iconIds: string[] }  OR  { icons: [{ key, name }] }
 * Returns: { runId, generatedIcons: [{ id, name, imageUrl }], creditsSpent }
 *
 * Requires a logged-in user (401 otherwise).
 * Cost model: 1 credit = 1 generated icon, so cost = selected icon count.
 * Credits are always spent (spendCredits) — InsufficientCreditsError → 402.
 *
 * Abuse guard: reject runs requesting more than MAX_ICONS_PER_RUN icons (400).
 *
 * STUB: instead of calling an image model we synthesize a tiny inline SVG data
 * URL per icon (a colored rounded square with the icon's initial) so the
 * front-end can actually render and download something real.
 */

import { auth } from "@/lib/auth";
import {
  spendCredits,
  InsufficientCreditsError,
} from "@/lib/credits";
import { getDb, schema } from "@/lib/db";
import { MAX_ICONS_PER_RUN } from "@/lib/limits";

const PALETTE = [
  "#6366f1", "#8b5cf6", "#ec4899", "#f43f5e", "#f97316", "#eab308",
  "#22c55e", "#14b8a6", "#06b6d4", "#3b82f6", "#a855f7", "#ef4444",
];

/** Build a self-contained SVG data URL placeholder for an icon. */
function placeholderIcon(seed: string, label: string): string {
  const color = PALETTE[hash(seed) % PALETTE.length];
  const initial = (label.trim()[0] ?? "?").toUpperCase();
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">` +
    `<rect width="128" height="128" rx="24" fill="${color}"/>` +
    `<text x="64" y="64" font-family="system-ui,sans-serif" font-size="56" ` +
    `font-weight="700" fill="#ffffff" text-anchor="middle" ` +
    `dominant-baseline="central">${escapeXml(initial)}</text>` +
    `</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function escapeXml(s: string): string {
  return s.replace(/[<>&'"]/g, (c) =>
    c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === "&" ? "&amp;" : c === "'" ? "&apos;" : "&quot;",
  );
}

/** Prettify an icon id like "icon_003" into a label "Icon 003" fallback. */
function labelFor(iconId: string): string {
  return iconId
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ runId: string }> },
) {
  const { runId } = await ctx.params;

  const userId = (await auth())?.user?.id;
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    iconIds?: string[];
    icons?: Array<{ key?: string; name?: string }>;
  };
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  // Accept either an array of ids, or the {key,name} objects the UI sends.
  let iconIds: string[] = [];
  const names = new Map<string, string>();
  if (Array.isArray(body.iconIds)) {
    iconIds = body.iconIds.filter((v): v is string => typeof v === "string");
  } else if (Array.isArray(body.icons)) {
    for (const icon of body.icons) {
      if (icon?.key) {
        iconIds.push(icon.key);
        if (icon.name) names.set(icon.key, icon.name);
      }
    }
  }

  if (iconIds.length === 0) {
    return Response.json(
      { error: "iconIds must be a non-empty array" },
      { status: 400 },
    );
  }

  // Abuse guard: cap icons per run.
  if (iconIds.length > MAX_ICONS_PER_RUN) {
    return Response.json(
      { error: `Too many icons: max ${MAX_ICONS_PER_RUN} per run` },
      { status: 400 },
    );
  }

  const cost = iconIds.length;
  let creditsSpent = 0;

  // Spend credits (the credit pre-check). Insufficient → 402.
  try {
    await spendCredits(userId, cost, {
      runId,
      description: "icon generation",
    });
    creditsSpent = cost;
  } catch (err) {
    if (err instanceof InsufficientCreditsError) {
      return Response.json(
        {
          error: "Insufficient credits",
          needed: err.needed,
          available: err.available,
        },
        { status: 402 },
      );
    }
    throw err;
  }

  // Produce stub generated icons.
  const generatedIcons = iconIds.map((id) => {
    const name = names.get(id) ?? labelFor(id);
    return { id, name, imageUrl: placeholderIcon(`${runId}:${id}`, name) };
  });

  // Persist generated icons + roll up the run's credit/icon totals.
  const db = getDb();
  await db.insert(schema.generatedIcons).values(
    generatedIcons.map((icon) => ({
      runId,
      userId,
      iconKey: icon.id,
      iconName: icon.name,
      imageUrl: icon.imageUrl,
      status: "success" as const,
      creditCost: 1,
    })),
  );

  return Response.json({ runId, generatedIcons, creditsSpent });
}
