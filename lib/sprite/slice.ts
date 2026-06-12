// Browser-side sprite-sheet slicing: fixed grid math + background detection,
// blank-frame detection, and a best-effort auto-grid suggester. This is the
// client-side cousin of the V3 "slice locally, it's free" idea from the
// roadmap — no model calls anywhere in this module.

export interface GridSpec {
  rows: number;
  cols: number;
  offsetTop: number;
  offsetBottom: number;
  offsetLeft: number;
  offsetRight: number;
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

export function sliceSpritesheet(
  img: HTMLImageElement,
  grid: GridSpec,
): SlicedFrame[] {
  const rows = Math.max(1, grid.rows);
  const cols = Math.max(1, grid.cols);
  if (rows * cols > MAX_FRAMES) return [];
  const { frameW, frameH } = frameDims(img.naturalWidth, img.naturalHeight, grid);
  if (frameW < 1 || frameH < 1) return [];

  const sheet = document.createElement("canvas");
  sheet.width = img.naturalWidth;
  sheet.height = img.naturalHeight;
  const sheetCtx = sheet.getContext("2d", { willReadFrequently: true });
  if (!sheetCtx) return [];
  sheetCtx.drawImage(img, 0, 0);
  const bg = detectBackground(
    sheetCtx.getImageData(0, 0, sheet.width, sheet.height),
  );

  const cell = document.createElement("canvas");
  cell.width = frameW;
  cell.height = frameH;
  const cellCtx = cell.getContext("2d");
  if (!cellCtx) return [];

  const frames: SlicedFrame[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const sx = grid.offsetLeft + col * frameW;
      const sy = grid.offsetTop + row * frameH;
      const imageData = sheetCtx.getImageData(sx, sy, frameW, frameH);
      cellCtx.clearRect(0, 0, frameW, frameH);
      cellCtx.putImageData(imageData, 0, 0);
      frames.push({
        index: row * cols + col,
        imageData,
        dataUrl: cell.toDataURL("image/png"),
        blank: isBlank(imageData, bg),
      });
    }
  }
  return frames;
}

/**
 * Suggest a grid from the pixels: detect the background (alpha or modal
 * corner color), profile which rows/columns contain content, and count the
 * contiguous content bands per axis. Works when sprites are separated by
 * background gutters; returns null when it can't tell.
 */
export function autoDetectGrid(img: HTMLImageElement): GridSpec | null {
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0);
  const sheet = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const bg = detectBackground(sheet);
  const { width: w, height: h, data: d } = sheet;

  const colHas = new Uint8Array(w);
  const rowHas = new Uint8Array(h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (isContent(d[i], d[i + 1], d[i + 2], d[i + 3], bg)) {
        colHas[x] = 1;
        rowHas[y] = 1;
      }
    }
  }
  const xBands = bands(colHas);
  const yBands = bands(rowHas);
  if (xBands.length === 0 || yBands.length === 0) return null;
  const cols = xBands.length;
  const rows = yBands.length;
  if (rows * cols > MAX_FRAMES || rows > 64 || cols > 64) return null;
  return {
    rows,
    cols,
    offsetLeft: xBands[0].start,
    offsetRight: w - (xBands[xBands.length - 1].end + 1),
    offsetTop: yBands[0].start,
    offsetBottom: h - (yBands[yBands.length - 1].end + 1),
  };
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

function bands(has: Uint8Array): { start: number; end: number }[] {
  const result: { start: number; end: number }[] = [];
  let start = -1;
  for (let i = 0; i < has.length; i++) {
    if (has[i] && start === -1) start = i;
    if (!has[i] && start !== -1) {
      result.push({ start, end: i - 1 });
      start = -1;
    }
  }
  if (start !== -1) result.push({ start, end: has.length - 1 });
  return result;
}
