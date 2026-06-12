// Browser-side sprite-sheet slicing: fixed grid math + background detection,
// blank-frame detection, per-frame crop tweaks, content stabilization, and an
// auto-grid suggester. Everything runs locally — nothing leaves the browser.

export interface GridSpec {
  rows: number;
  cols: number;
  offsetTop: number;
  offsetBottom: number;
  offsetLeft: number;
  offsetRight: number;
}

/** Per-frame adjustments, keyed by the frame's base grid index. */
export interface FrameTweak {
  /** Crop nudge in sheet pixels (shifts where the cell samples from). */
  dx: number;
  dy: number;
  /** Duration multiplier (1 = normal; 2 = shown twice as long). */
  hold: number;
}

export interface SlicedFrame {
  index: number;
  imageData: ImageData;
  /** PNG data URL for thumbnails / zip export. */
  dataUrl: string;
  /** True when the cell is empty (background/transparent only). */
  blank: boolean;
}

/** Hard cap so a typo'd 99x99 grid doesn't lock the tab. */
export const MAX_FRAMES = 1024;

interface Background {
  transparent: boolean;
  rgb: number; // 0xRRGGBB, meaningful when !transparent
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

export function frameDims(
  imgW: number,
  imgH: number,
  grid: GridSpec,
): { frameW: number; frameH: number } {
  const effW = imgW - grid.offsetLeft - grid.offsetRight;
  const effH = imgH - grid.offsetTop - grid.offsetBottom;
  return {
    frameW: Math.floor(effW / Math.max(1, grid.cols)),
    frameH: Math.floor(effH / Math.max(1, grid.rows)),
  };
}

function sheetPixels(img: HTMLImageElement): {
  ctx: CanvasRenderingContext2D;
  data: ImageData;
  bg: Background;
} | null {
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return { ctx, data, bg: detectBackground(data) };
}

export function sliceSpritesheet(
  img: HTMLImageElement,
  grid: GridSpec,
  tweaks?: ReadonlyMap<number, FrameTweak>,
): SlicedFrame[] {
  const rows = Math.max(1, grid.rows);
  const cols = Math.max(1, grid.cols);
  if (rows * cols > MAX_FRAMES) return [];
  const { frameW, frameH } = frameDims(img.naturalWidth, img.naturalHeight, grid);
  if (frameW < 1 || frameH < 1) return [];

  const sheet = sheetPixels(img);
  if (!sheet) return [];
  const { ctx: sheetCtx, bg } = sheet;

  const cell = document.createElement("canvas");
  cell.width = frameW;
  cell.height = frameH;
  const cellCtx = cell.getContext("2d");
  if (!cellCtx) return [];

  const frames: SlicedFrame[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const index = row * cols + col;
      const t = tweaks?.get(index);
      const sx = clamp(
        grid.offsetLeft + col * frameW + (t?.dx ?? 0),
        0,
        img.naturalWidth - frameW,
      );
      const sy = clamp(
        grid.offsetTop + row * frameH + (t?.dy ?? 0),
        0,
        img.naturalHeight - frameH,
      );
      const imageData = sheetCtx.getImageData(sx, sy, frameW, frameH);
      cellCtx.clearRect(0, 0, frameW, frameH);
      cellCtx.putImageData(imageData, 0, 0);
      frames.push({
        index,
        imageData,
        dataUrl: cell.toDataURL("image/png"),
        blank: isBlank(imageData, bg),
      });
    }
  }
  return frames;
}

/** Integer nearest-neighbor upscale (for crisp pixel-art GIF export). */
export function scaleImageData(src: ImageData, factor: number): ImageData {
  if (factor <= 1) return src;
  const a = document.createElement("canvas");
  a.width = src.width;
  a.height = src.height;
  const b = document.createElement("canvas");
  b.width = src.width * factor;
  b.height = src.height * factor;
  const actx = a.getContext("2d");
  const bctx = b.getContext("2d", { willReadFrequently: true });
  if (!actx || !bctx) return src;
  actx.putImageData(src, 0, 0);
  bctx.imageSmoothingEnabled = false;
  bctx.drawImage(a, 0, 0, b.width, b.height);
  return bctx.getImageData(0, 0, b.width, b.height);
}

export type StabilizeAnchor = "center" | "bottom";

/**
 * Compute per-frame crop nudges that hold the sprite steady across frames:
 * each cell's content bounding box is aligned to a common anchor — the mean
 * center ("center") or mean bottom-center ("bottom", keeps a character's feet
 * planted). Returns a tweak map (holds preserved from `existing`), or null if
 * fewer than two frames have content.
 */
export function computeStabilizeTweaks(
  img: HTMLImageElement,
  grid: GridSpec,
  anchor: StabilizeAnchor,
  existing?: ReadonlyMap<number, FrameTweak>,
): Map<number, FrameTweak> | null {
  const rows = Math.max(1, grid.rows);
  const cols = Math.max(1, grid.cols);
  if (rows * cols > MAX_FRAMES) return null;
  const { frameW, frameH } = frameDims(img.naturalWidth, img.naturalHeight, grid);
  if (frameW < 1 || frameH < 1) return null;
  const sheet = sheetPixels(img);
  if (!sheet) return null;
  const { data, bg } = sheet;

  // Content bounding box per cell, in frame-local coordinates.
  const boxes = new Map<number, { cx: number; cy: number; bottom: number }>();
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x0 = grid.offsetLeft + col * frameW;
      const y0 = grid.offsetTop + row * frameH;
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (let y = 0; y < frameH; y++) {
        for (let x = 0; x < frameW; x++) {
          const i = ((y0 + y) * data.width + x0 + x) * 4;
          if (isContent(data.data[i], data.data[i + 1], data.data[i + 2], data.data[i + 3], bg)) {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }
      if (maxX >= minX) {
        boxes.set(row * cols + col, {
          cx: (minX + maxX) / 2,
          cy: (minY + maxY) / 2,
          bottom: maxY,
        });
      }
    }
  }
  if (boxes.size < 2) return null;

  // Common anchor = mean across frames; each frame shifts its crop window
  // toward its own content so the content lands on the anchor.
  let sumCx = 0, sumCy = 0, sumBottom = 0;
  for (const b of boxes.values()) {
    sumCx += b.cx;
    sumCy += b.cy;
    sumBottom += b.bottom;
  }
  const targetCx = sumCx / boxes.size;
  const targetCy = sumCy / boxes.size;
  const targetBottom = sumBottom / boxes.size;

  const tweaks = new Map<number, FrameTweak>();
  for (const [index, b] of boxes) {
    const dx = Math.round(b.cx - targetCx);
    const dy =
      anchor === "bottom"
        ? Math.round(b.bottom - targetBottom)
        : Math.round(b.cy - targetCy);
    const hold = existing?.get(index)?.hold ?? 1;
    if (dx !== 0 || dy !== 0 || hold !== 1) tweaks.set(index, { dx, dy, hold });
  }
  // Preserve holds on frames that had no content box.
  if (existing) {
    for (const [index, t] of existing) {
      if (!tweaks.has(index) && t.hold !== 1) {
        tweaks.set(index, { dx: 0, dy: 0, hold: t.hold });
      }
    }
  }
  return tweaks;
}

/**
 * Suggest a grid from the pixels. Strategy: detect the background (alpha or
 * modal corner color), build per-column/per-row content-pixel counts, trim to
 * the content bounding box, then test every candidate division 2..64 of each
 * axis and keep the largest one whose cut lines all land on (nearly) empty
 * pixels — a small search window per cut absorbs grid drift. Returns null
 * when no division is clean (e.g. sprites touch with no gutters).
 */
export function autoDetectGrid(img: HTMLImageElement): GridSpec | null {
  const sheet = sheetPixels(img);
  if (!sheet) return null;
  const { data, bg } = sheet;
  const { width: w, height: h, data: d } = data;

  // Content-pixel counts (not booleans) so thresholds can ignore stray
  // anti-aliasing / shadow noise instead of treating it as content.
  const colCount = new Uint32Array(w);
  const rowCount = new Uint32Array(h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (isContent(d[i], d[i + 1], d[i + 2], d[i + 3], bg)) {
        colCount[x]++;
        rowCount[y]++;
      }
    }
  }
  // A line counts as "empty" with up to ~1% of its pixels lit.
  const colEps = Math.max(1, Math.round(h * 0.01));
  const rowEps = Math.max(1, Math.round(w * 0.01));
  const xb = contentBounds(colCount, colEps);
  const yb = contentBounds(rowCount, rowEps);
  if (!xb || !yb) return null;

  const cols = bestDivision(colCount.subarray(xb.start, xb.end + 1), colEps);
  const rows = bestDivision(rowCount.subarray(yb.start, yb.end + 1), rowEps);
  if (cols === 1 && rows === 1) return null;
  if (rows * cols > MAX_FRAMES) return null;
  return {
    rows,
    cols,
    offsetLeft: xb.start,
    offsetRight: w - (xb.end + 1),
    offsetTop: yb.start,
    offsetBottom: h - (yb.end + 1),
  };
}

/** First/last index whose count exceeds the noise threshold. */
function contentBounds(
  profile: Uint32Array,
  eps: number,
): { start: number; end: number } | null {
  let start = -1;
  let end = -1;
  for (let i = 0; i < profile.length; i++) {
    if (profile[i] > eps) {
      if (start === -1) start = i;
      end = i;
    }
  }
  return start === -1 ? null : { start, end };
}

/**
 * Largest n (2..64) whose n-way cut lines all fall on near-empty pixels.
 * Each cut gets a ±8%-of-cell search window (min of the profile within it),
 * so slightly uneven gutters still register as clean.
 */
function bestDivision(profile: Uint32Array, eps: number): number {
  const len = profile.length;
  const maxN = Math.min(64, Math.floor(len / 4)); // cells at least 4px wide
  let best = 1;
  for (let n = 2; n <= maxN; n++) {
    const cellSize = len / n;
    const win = Math.max(1, Math.round(cellSize * 0.08));
    let clean = true;
    for (let k = 1; k < n; k++) {
      const pos = Math.round(k * cellSize);
      let m = Infinity;
      const from = Math.max(0, pos - win);
      const to = Math.min(len - 1, pos + win);
      for (let x = from; x <= to; x++) m = Math.min(m, profile[x]);
      if (m > eps) {
        clean = false;
        break;
      }
    }
    if (clean) best = n;
  }
  return best;
}

function detectBackground(sheet: ImageData): Background {
  const { width: w, height: h, data: d } = sheet;
  const corners = [0, (w - 1) * 4, (h - 1) * w * 4, ((h - 1) * w + w - 1) * 4];
  for (const i of corners) {
    if (d[i + 3] < 8) return { transparent: true, rgb: 0 };
  }
  // Opaque sheet: modal corner color is the background.
  const tally = new Map<number, number>();
  for (const i of corners) {
    const c = (d[i] << 16) | (d[i + 1] << 8) | d[i + 2];
    tally.set(c, (tally.get(c) ?? 0) + 1);
  }
  let rgb = 0, best = -1;
  for (const [c, n] of tally) if (n > best) { best = n; rgb = c; }
  return { transparent: false, rgb };
}

const COLOR_TOLERANCE = 12; // per-channel distance to still count as background

function isContent(r: number, g: number, b: number, a: number, bg: Background): boolean {
  if (a < 8) return false;
  if (bg.transparent) return true;
  const dr = Math.abs(r - ((bg.rgb >> 16) & 0xff));
  const dg = Math.abs(g - ((bg.rgb >> 8) & 0xff));
  const db = Math.abs(b - (bg.rgb & 0xff));
  return dr > COLOR_TOLERANCE || dg > COLOR_TOLERANCE || db > COLOR_TOLERANCE;
}

function isBlank(frame: ImageData, bg: Background): boolean {
  const d = frame.data;
  for (let i = 0; i < d.length; i += 4) {
    if (isContent(d[i], d[i + 1], d[i + 2], d[i + 3], bg)) return false;
  }
  return true;
}
