import { toFile, type Uploadable } from "openai";

/**
 * Convert a base64 image (raw or a "data:…;base64,…" data URL) into an
 * Uploadable suitable for `client.images.edit({ image })`.
 *
 * gpt-image models accept png / webp / jpg reference images. We decode the
 * declared mime type from the data URL when present, defaulting to PNG.
 */
export async function imageBase64ToFile(
  imageBase64: string,
  fileName = "image.png",
): Promise<Uploadable> {
  let mimeType = "image/png";
  let b64 = imageBase64;

  if (imageBase64.startsWith("data:")) {
    const match = /^data:([^;]+);base64,([\s\S]*)$/.exec(imageBase64);
    if (match) {
      mimeType = match[1];
      b64 = match[2];
    }
  }

  const buffer = Buffer.from(b64, "base64");
  const ext = mimeType.split("/")[1] ?? "png";
  const name = fileName.includes(".") ? fileName : `${fileName}.${ext}`;
  return toFile(buffer, name, { type: mimeType });
}
