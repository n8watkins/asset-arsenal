// Page skins - keep model-written component CSS inside the skin layer.
// Drops rules whose selectors target anything outside SKINNABLE_CLASSES and
// declarations that would change layout or load external resources.

import { SKINNABLE_CLASSES } from "./sample-page";

const LAYOUT_PROPS = new Set([
  "display", "width", "height", "min-width", "min-height", "max-width", "max-height",
  "grid", "grid-template", "grid-template-columns", "grid-template-rows", "grid-area", "grid-column", "grid-row",
  "flex", "flex-direction", "flex-wrap", "flex-basis", "flex-grow", "flex-shrink", "order",
  "margin", "margin-top", "margin-right", "margin-bottom", "margin-left",
  "padding", "padding-top", "padding-right", "padding-bottom", "padding-left",
  "float", "font-size", "overflow", "overflow-x", "overflow-y", "columns", "column-count", "zoom",
]);

/** Allowed on pseudo-elements only, where ornaments need them. */
const PSEUDO_ONLY_PROPS = new Set([
  "position", "top", "right", "bottom", "left", "inset", "width", "height", "display", "margin",
  "font-size", "z-index",
]);

/** The generator owns these layers: the texture on .page and the image in .hero-art. */
const OWNED_BACKGROUNDS = new Set(["page", "hero-art"]);
const BG_PROPS = /^background(-image|-color|-size|-repeat|-position|-blend-mode)?$/;

/** Full-width section wrappers: tinted bands are fine, boxed frames are not. */
const WRAPPERS = new Set(["nav", "hero", "logos", "section", "footer"]);
const BOX_PROPS = /^(border(-radius)?|box-shadow|outline)$/;

export type SanitizeReport = { css: string; droppedRules: number; droppedDecls: number };

function selectorAllowed(sel: string): boolean {
  const s = sel.trim();
  const m = /^\.([a-z0-9-]+)/i.exec(s);
  return !!m && m[1] in SKINNABLE_CLASSES;
}

export function sanitizeComponentCss(input: string): SanitizeReport {
  let droppedRules = 0;
  let droppedDecls = 0;
  // Strip comments and at-rules wholesale (no @media/@keyframes/@import in the prototype).
  const css = input.replace(/\/\*[\s\S]*?\*\//g, "").replace(/@[a-z-]+[^{;]*(;|\{(?:[^{}]|\{[^{}]*\})*\})/gi, () => {
    droppedRules++;
    return "";
  });

  const out: string[] = [];
  const ruleRe = /([^{}]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = ruleRe.exec(css))) {
    const selectors = m[1].split(",").map((s) => s.trim()).filter(Boolean);
    if (!selectors.length || !selectors.every(selectorAllowed)) {
      droppedRules++;
      continue;
    }
    const isPseudo = selectors.every((s) => /::?(before|after)\b/.test(s));
    const roots = selectors.map((s) => /^\.([a-z0-9-]+)/i.exec(s)![1]);
    const bare = selectors.every((s) => /^\.[a-z0-9-]+(:[a-z-]+)?$/i.test(s));
    const touchesOwnedBg = roots.some((r) => OWNED_BACKGROUNDS.has(r)) && !isPseudo;
    const boxesWrapper = bare && roots.some((r) => WRAPPERS.has(r));
    const decls = m[2]
      .split(";")
      .map((d) => d.trim())
      .filter(Boolean)
      .filter((d) => {
        const idx = d.indexOf(":");
        if (idx < 1) return false;
        const prop = d.slice(0, idx).trim().toLowerCase();
        const value = d.slice(idx + 1).toLowerCase();
        const ok =
          !/url\s*\(|expression\s*\(|@import/.test(value) &&
          !(LAYOUT_PROPS.has(prop) && !(isPseudo && PSEUDO_ONLY_PROPS.has(prop))) &&
          !(prop === "position" && !isPseudo) &&
          !(prop === "position" && /fixed|sticky/.test(value)) &&
          !(touchesOwnedBg && BG_PROPS.test(prop)) &&
          !(boxesWrapper && BOX_PROPS.test(prop));
        if (!ok) droppedDecls++;
        return ok;
      });
    if (decls.length) out.push(`${selectors.join(",")}{${decls.join(";")}}`);
  }
  return { css: out.join("\n"), droppedRules, droppedDecls };
}
