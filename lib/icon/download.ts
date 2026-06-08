// Browser-only download / clipboard / file-read helpers for export (PRD §20)
// and upload (§13.1).

export function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "icon"
  );
}

export function downloadDataUrl(dataUrl: string, filename: string): void {
  if (!dataUrl) return;
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export async function copyText(text: string): Promise<void> {
  await navigator.clipboard.writeText(text);
}

export type ReadImageResult = {
  dataUrl: string;
  width?: number;
  height?: number;
};

// Reads an image File into a data URL and (best-effort) its pixel dimensions.
export function readImageFile(file: File): Promise<ReadImageResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read the image file."));
    reader.onload = () => {
      const dataUrl = String(reader.result);
      const img = new Image();
      img.onload = () =>
        resolve({ dataUrl, width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => resolve({ dataUrl }); // dims optional
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });
}
