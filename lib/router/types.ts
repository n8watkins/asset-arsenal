// Client-safe router types — no SDK import, safe in client components.
//
// The router is the entry step of the product: given what the user provided (an
// image? text? an explicit icon list?), it picks WHICH flow to run. It does NOT
// read image pixels — presence + the user's text is all it classifies on. Most
// of the decision is programmatic (what inputs exist); the only model call is
// classifying the INTENT of the text into one of the flows below.

// Every flow the router can recommend. Each is a distinct "door" into the same
// downstream factory (style reference + icon list → preview → pack).
export const ROUTER_FLOWS = [
  "extract_assets_from_image",
  "upgrade_design_first",
  "generate_style_reference_from_prompt",
  "build_icon_pack_from_list",
  "use_uploaded_style_reference",
  "ask_for_clarification",
] as const;

export type RouterFlow = (typeof ROUTER_FLOWS)[number];

// What the user landed with — fully derivable from the inputs (computed in code,
// not by the model).
export type StartingPoint =
  | "image_only"
  | "text_only"
  | "image_and_text"
  | "icon_list_only"
  | "image_and_list"
  | "image_text_and_list"
  | "text_and_list"
  | "nothing";

// What the bench sends. The image itself is never sent — only whether one exists.
export type RouterInput = {
  hasImage: boolean;
  text: string; // may be ""
  iconList: string[]; // may be []
};

// The model's half of the decision (validated against the schema).
export type RouterModelOutput = {
  recommendedFlow: RouterFlow;
  confidence: number; // 0..1
  needsUserChoice: boolean;
  reason: string;
};

// The full decision returned to the client: the model's call + the deterministic
// starting point computed from the inputs.
export type RouterDecision = RouterModelOutput & {
  startingPoint: StartingPoint;
};

// Human-readable copy for the bench legend — what each flow means and where it
// leads downstream. Keep in sync with ROUTER_FLOWS.
export const FLOW_META: Record<RouterFlow, { label: string; blurb: string }> = {
  extract_assets_from_image: {
    label: "Extract assets from image",
    blurb:
      "Flagship. A polished mockup/dashboard — analyze its style and pull the matching icon pack straight from it.",
  },
  upgrade_design_first: {
    label: "Upgrade design first",
    blurb:
      "A rough/basic source the user wants improved before extracting — elevate it (Bench S), then extract from the polished result.",
  },
  generate_style_reference_from_prompt: {
    label: "Generate style reference from prompt",
    blurb:
      "No image — the text describes a look. Generate style references first, let the user pick one, then build the pack.",
  },
  build_icon_pack_from_list: {
    label: "Build icon pack from list",
    blurb:
      "The user named the icons they want. Take the list, attach a style, generate the pack — no image needed.",
  },
  use_uploaded_style_reference: {
    label: "Use uploaded style reference",
    blurb:
      "An image to match AND a known icon list — treat the image as the style anchor and generate those specific icons in it.",
  },
  ask_for_clarification: {
    label: "Ask for clarification",
    blurb:
      "Genuinely too little signal to route confidently. Last resort — prefer a best guess over asking when possible.",
  },
};

// Derive the starting point from the raw inputs (deterministic, no model).
export function deriveStartingPoint(input: RouterInput): StartingPoint {
  const hasText = input.text.trim().length > 0;
  const hasList = input.iconList.length > 0;
  if (input.hasImage && hasText && hasList) return "image_text_and_list";
  if (input.hasImage && hasList) return "image_and_list";
  if (input.hasImage && hasText) return "image_and_text";
  if (input.hasImage) return "image_only";
  if (hasText && hasList) return "text_and_list";
  if (hasList) return "icon_list_only";
  if (hasText) return "text_only";
  return "nothing";
}
