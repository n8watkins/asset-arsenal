// The type system for the experiment harness. An experiment is defined first by
// its I/O SIGNATURE — what modality goes in, what comes out — and that signature
// filters which models you're allowed to pick. "video" is reserved for later;
// nothing wires it yet.

export type Modality = "text" | "image";

export type IOSignature = {
  // The modalities the user will provide for each cell.
  inputs: Modality[];
  // The single modality each cell emits.
  output: Modality;
};

export const MODALITY_LABEL: Record<Modality, string> = {
  text: "text",
  image: "image",
};

/** Stable key for a signature, e.g. "image+text->image". Order-independent. */
export function signatureKey(io: IOSignature): string {
  return `${[...io.inputs].sort().join("+")}->${io.output}`;
}

/** Human label, e.g. "text + image → image". Preserves declared input order. */
export function signatureLabel(io: IOSignature): string {
  return `${io.inputs.map((m) => MODALITY_LABEL[m]).join(" + ")} → ${MODALITY_LABEL[io.output]}`;
}
