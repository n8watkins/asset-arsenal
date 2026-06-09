// Server-only. Cuts a single grid image (the V3 "collection image as
// deliverable") into individual transparent icon PNGs. Two strategies:
//
//   "math" — assume a perfect rows×cols grid and crop each cell by arithmetic.
//            Cheap, but chops icons in half when the model's grid drifts.
//   "cv"   — find the icons by their pixels: threshold the alpha channel,
//            dilate to join an icon's internal gaps, label connected components,
//            and crop each blob's bounding box. Tolerant of grid drift.
//
// Both run locally after the image is generated — no API cost, just CPU.

import sharp from "sharp";

export type SliceMode = "cv" | "math";

export type SliceBox = { x: number; y: number; w: number; h: number };

export type Slice = {
  index: number; // reading-order position (maps to the i-th requested icon)
  box: SliceBox;
  pngBase64: string; // data URL — trimmed, centered on a transparent square
};

export type SliceResult = {
  mode: SliceMode;
  detectedCount: number;
  slices: Slice[];
};

const ALPHA_THRESHOLD = 16; // alpha above this counts as "ink"
const OUTPUT_SIZE = 512; // each sliced icon is normalized to this square

export async function sliceGrid(
  pngBuffer: Buffer,
  opts: { rows: number; cols: number; mode: SliceMode },
): Promise<SliceResult> {
  return opts.mode === "math"
    ? sliceByMath(pngBuffer, opts.rows, opts.cols)
    : sliceByBlobs(pngBuffer, opts.rows, opts.cols);
}

// --- "math" — fixed-coordinate grid ----------------------------------------

async function sliceByMath(
  buf: Buffer,
  rows: number,
  cols: number,
): Promise<SliceResult> {
  const { width: W = 0, height: H = 0 } = await sharp(buf).metadata();
  const cw = Math.floor(W / cols);
  const ch = Math.floor(H / rows);

  const slices: Slice[] = [];
  let index = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = c * cw;
      const y = r * ch;
      const w = c === cols - 1 ? W - x : cw;
      const h = r === rows - 1 ? H - y : ch;
      slices.push({
        index,
        box: { x, y, w, h },
        pngBase64: await finalizeSquare(buf, { left: x, top: y, width: w, height: h }),
      });
      index++;
    }
  }
  return { mode: "math", detectedCount: slices.length, slices };
}

// --- "cv" — alpha-channel connected components ------------------------------

type Blob = { minX: number; minY: number; maxX: number; maxY: number; area: number };

async function sliceByBlobs(
  buf: Buffer,
  rows: number,
  cols: number,
): Promise<SliceResult> {
  const { data, info } = await sharp(buf)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const W = info.width;
  const H = info.height;
  const ch = info.channels; // 4 after ensureAlpha
  const N = W * H;

  // Binary ink mask from the alpha channel.
  let mask: Uint8Array = new Uint8Array(N);
  for (let i = 0; i < N; i++) mask[i] = data[i * ch + 3] > ALPHA_THRESHOLD ? 1 : 0;

  // Dilate to bridge an icon's internal gaps (disconnected strokes) without
  // merging neighbours: a 4×4 grid leaves wide gutters, so a small radius is
  // safe. Scale it to the cell size.
  const radius = Math.max(2, Math.round((W / cols) * 0.03));
  mask = dilate(mask, W, H, radius);

  // Label connected components (8-connectivity) with an explicit-stack flood fill.
  const labels = new Int32Array(N);
  const stack = new Int32Array(N);
  const blobs: Blob[] = [];
  let label = 0;
  for (let p = 0; p < N; p++) {
    if (mask[p] !== 1 || labels[p] !== 0) continue;
    label++;
    let sp = 0;
    stack[sp++] = p;
    labels[p] = label;
    let minX = W, minY = H, maxX = 0, maxY = 0, area = 0;
    while (sp > 0) {
      const q = stack[--sp];
      const qx = q % W;
      const qy = (q - qx) / W;
      area++;
      if (qx < minX) minX = qx;
      if (qx > maxX) maxX = qx;
      if (qy < minY) minY = qy;
      if (qy > maxY) maxY = qy;
      for (let dy = -1; dy <= 1; dy++) {
        const ny = qy + dy;
        if (ny < 0 || ny >= H) continue;
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = qx + dx;
          if (nx < 0 || nx >= W) continue;
          const np = ny * W + nx;
          if (mask[np] === 1 && labels[np] === 0) {
            labels[np] = label;
            stack[sp++] = np;
          }
        }
      }
    }
    blobs.push({ minX, minY, maxX, maxY, area });
  }

  // Drop noise: anything far too small to be an icon (< 1% of a cell).
  const minArea = (W / cols) * (H / rows) * 0.01;
  const kept = blobs.filter((b) => b.area >= minArea);

  const ordered = orderReadingOrder(kept, H, rows);

  const slices: Slice[] = [];
  for (let i = 0; i < ordered.length; i++) {
    const b = ordered[i];
    const pad = Math.round((W / cols) * 0.04);
    const left = Math.max(0, b.minX - pad);
    const top = Math.max(0, b.minY - pad);
    const width = Math.min(W - left, b.maxX - b.minX + 1 + pad * 2);
    const height = Math.min(H - top, b.maxY - b.minY + 1 + pad * 2);
    slices.push({
      index: i,
      box: { x: left, y: top, w: width, h: height },
      pngBase64: await finalizeSquare(buf, { left, top, width, height }),
    });
  }
  return { mode: "cv", detectedCount: slices.length, slices };
}

// Reading order without assuming exact cell boundaries: sort by Y, group into
// row bands (a gap > ~half a cell height starts a new band), sort each band by X.
function orderReadingOrder(blobs: Blob[], H: number, rows: number): Blob[] {
  if (blobs.length === 0) return blobs;
  const withCenter = blobs.map((b) => ({
    b,
    cx: (b.minX + b.maxX) / 2,
    cy: (b.minY + b.maxY) / 2,
  }));
  withCenter.sort((a, z) => a.cy - z.cy);
  const bandGap = (H / rows) * 0.5;
  const bands: (typeof withCenter)[] = [];
  let current: typeof withCenter = [];
  let bandStartCy = -Infinity;
  for (const item of withCenter) {
    if (current.length === 0 || item.cy - bandStartCy <= bandGap) {
      if (current.length === 0) bandStartCy = item.cy;
      current.push(item);
    } else {
      bands.push(current);
      current = [item];
      bandStartCy = item.cy;
    }
  }
  if (current.length) bands.push(current);
  const out: Blob[] = [];
  for (const band of bands) {
    band.sort((a, z) => a.cx - z.cx);
    for (const it of band) out.push(it.b);
  }
  return out;
}

// Separable box dilation (max filter), radius k, horizontal then vertical.
function dilate(mask: Uint8Array, W: number, H: number, k: number): Uint8Array {
  const tmp = new Uint8Array(W * H);
  // horizontal
  for (let y = 0; y < H; y++) {
    const row = y * W;
    for (let x = 0; x < W; x++) {
      let on = 0;
      for (let dx = -k; dx <= k && !on; dx++) {
        const nx = x + dx;
        if (nx >= 0 && nx < W && mask[row + nx] === 1) on = 1;
      }
      tmp[row + x] = on;
    }
  }
  // vertical
  const out = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let on = 0;
      for (let dy = -k; dy <= k && !on; dy++) {
        const ny = y + dy;
        if (ny >= 0 && ny < H && tmp[ny * W + x] === 1) on = 1;
      }
      out[y * W + x] = on;
    }
  }
  return out;
}

// Crop a region, then center it on a transparent square and normalize the size,
// so every sliced icon is a clean, uniform asset.
async function finalizeSquare(
  buf: Buffer,
  region: { left: number; top: number; width: number; height: number },
): Promise<string> {
  const cell = await sharp(buf)
    .ensureAlpha()
    .extract(region)
    .png()
    .toBuffer();
  const { width: w = region.width, height: h = region.height } =
    await sharp(cell).metadata();
  const side = Math.max(w, h);
  const left = Math.floor((side - w) / 2);
  const right = side - w - left;
  const top = Math.floor((side - h) / 2);
  const bottom = side - h - top;
  const out = await sharp(cell)
    .ensureAlpha()
    .extend({ top, bottom, left, right, background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .resize(OUTPUT_SIZE, OUTPUT_SIZE, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();
  return `data:image/png;base64,${out.toString("base64")}`;
}
