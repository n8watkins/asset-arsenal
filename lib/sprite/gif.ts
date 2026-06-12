// Dependency-free GIF89a encoder (browser-side, follows the lib/zip.ts
// "write the format by hand" precedent — no gif.js / gifenc dependency).
//
// Tuned for sprite frames: when the combined frames use <=256 unique colors
// (typical pixel art) the palette is exact and the output is lossless; richer
// images are reduced with weighted median-cut. Supports GIF's 1-bit
// transparency (alpha < 128 -> transparent pixel, disposal "restore to
// background" so frames don't stack).

export interface EncodeGifOptions {
  /** Per-frame delay in milliseconds (GIF resolution is 10ms). */
  delayMs: number;
  /** Optional per-frame delays (parallel to frames); falls back to delayMs. */
  delaysMs?: number[];
  /** Keep transparent pixels transparent; otherwise composite onto `background`. */
  transparent: boolean;
  /** [r,g,b] used when `transparent` is false. Default white. */
  background?: [number, number, number];
}

interface PreppedFrame {
  /** 0xRRGGBB per pixel (background-composited when not transparent). */
  rgb: Uint32Array;
  /** 1 = transparent pixel (only populated in transparent mode). */
  trans: Uint8Array | null;
}

/** Unique-color cap before median-cut works from a truncated census. */
const MAX_UNIQUE_TRACKED = 65_536;

export function encodeGif(frames: ImageData[], opts: EncodeGifOptions): Blob {
  if (frames.length === 0) throw new Error("encodeGif: no frames");
  const width = frames[0].width;
  const height = frames[0].height;

  const prepped = frames.map((f) => prepFrame(f, opts));

  // --- Palette: exact census when it fits, weighted median-cut otherwise ---
  const counts = new Map<number, number>();
  for (const p of prepped) {
    for (let i = 0; i < p.rgb.length; i++) {
      if (p.trans && p.trans[i]) continue;
      const c = p.rgb[i];
      const n = counts.get(c);
      if (n !== undefined) counts.set(c, n + 1);
      else if (counts.size < MAX_UNIQUE_TRACKED) counts.set(c, 1);
    }
  }
  const maxColors = opts.transparent ? 255 : 256; // reserve one slot for transparency
  let palette: number[];
  if (counts.size <= maxColors) {
    palette = [...counts.keys()];
  } else {
    palette = medianCut([...counts.entries()], maxColors);
  }
  if (palette.length === 0) palette = [0]; // fully transparent frames

  const exact = counts.size <= maxColors;
  const indexOf = new Map<number, number>();
  if (exact) palette.forEach((c, i) => indexOf.set(c, i));

  const transIndex = opts.transparent ? palette.length : 0;
  const tableLen = palette.length + (opts.transparent ? 1 : 0);
  // Color table size must be a power of two, minimum 2.
  let padded = 2;
  while (padded < tableLen) padded *= 2;
  const minCodeSize = Math.max(2, Math.log2(padded));

  const lookup = (c: number): number => {
    const hit = indexOf.get(c);
    if (hit !== undefined) return hit;
    // Reduced palette: nearest match, memoized per unique color.
    let best = 0;
    let bestD = Infinity;
    const r = (c >> 16) & 0xff, g = (c >> 8) & 0xff, b = c & 0xff;
    for (let i = 0; i < palette.length; i++) {
      const p = palette[i];
      const dr = r - ((p >> 16) & 0xff);
      const dg = g - ((p >> 8) & 0xff);
      const db = b - (p & 0xff);
      const d = dr * dr + dg * dg + db * db;
      if (d < bestD) { bestD = d; best = i; }
    }
    indexOf.set(c, best);
    return best;
  };

  // --- Write the file ---
  const out: number[] = [];
  const u8 = (v: number) => out.push(v & 0xff);
  const u16 = (v: number) => { out.push(v & 0xff, (v >> 8) & 0xff); };

  // Header + logical screen descriptor + global color table
  for (const ch of "GIF89a") u8(ch.charCodeAt(0));
  u16(width);
  u16(height);
  u8(0xf0 | (Math.log2(padded) - 1)); // GCT present, 8-bit color resolution
  u8(0); // background color index
  u8(0); // pixel aspect ratio
  for (let i = 0; i < padded; i++) {
    const c = i < palette.length ? palette[i] : 0;
    u8((c >> 16) & 0xff); u8((c >> 8) & 0xff); u8(c & 0xff);
  }

  // NETSCAPE2.0 extension: loop forever
  u8(0x21); u8(0xff); u8(0x0b);
  for (const ch of "NETSCAPE2.0") u8(ch.charCodeAt(0));
  u8(0x03); u8(0x01); u16(0); u8(0x00);

  // GIF delays are centiseconds; many decoders treat <2 as "very slow".
  const delayCs = (i: number) =>
    Math.max(2, Math.round((opts.delaysMs?.[i] ?? opts.delayMs) / 10));

  for (let f = 0; f < prepped.length; f++) {
    const p = prepped[f];
    // Graphic control extension
    u8(0x21); u8(0xf9); u8(0x04);
    // disposal 2 (restore to bg) keeps transparent frames from stacking
    u8(opts.transparent ? (2 << 2) | 1 : 1 << 2);
    u16(delayCs(f));
    u8(opts.transparent ? transIndex : 0);
    u8(0x00);

    // Image descriptor (full frame, no local color table)
    u8(0x2c); u16(0); u16(0); u16(width); u16(height); u8(0);

    const indices = new Uint8Array(p.rgb.length);
    for (let i = 0; i < p.rgb.length; i++) {
      indices[i] = p.trans && p.trans[i] ? transIndex : lookup(p.rgb[i]);
    }
    u8(minCodeSize);
    const lzw = lzwEncode(minCodeSize, indices);
    for (let off = 0; off < lzw.length; off += 255) {
      const len = Math.min(255, lzw.length - off);
      u8(len);
      for (let i = 0; i < len; i++) out.push(lzw[off + i]);
    }
    u8(0x00); // block terminator
  }

  u8(0x3b); // trailer
  return new Blob([Uint8Array.from(out)], { type: "image/gif" });
}

function prepFrame(frame: ImageData, opts: EncodeGifOptions): PreppedFrame {
  const [br, bg, bb] = opts.background ?? [255, 255, 255];
  const n = frame.width * frame.height;
  const rgb = new Uint32Array(n);
  const trans = opts.transparent ? new Uint8Array(n) : null;
  const d = frame.data;
  for (let i = 0; i < n; i++) {
    const r = d[i * 4], g = d[i * 4 + 1], b = d[i * 4 + 2], a = d[i * 4 + 3];
    if (trans) {
      if (a < 128) { trans[i] = 1; continue; }
      rgb[i] = (r << 16) | (g << 8) | b; // GIF has no partial alpha
    } else {
      const t = a / 255;
      rgb[i] =
        (Math.round(r * t + br * (1 - t)) << 16) |
        (Math.round(g * t + bg * (1 - t)) << 8) |
        Math.round(b * t + bb * (1 - t));
    }
  }
  return { rgb, trans };
}

/** Weighted median-cut: reduce [color, count] entries to <=target colors. */
function medianCut(entries: [number, number][], target: number): number[] {
  type Item = { r: number; g: number; b: number; n: number };
  const items: Item[] = entries.map(([c, n]) => ({
    r: (c >> 16) & 0xff, g: (c >> 8) & 0xff, b: c & 0xff, n,
  }));
  let boxes: Item[][] = [items];
  while (boxes.length < target) {
    // Split the most populous box that still has more than one color.
    let bi = -1, bestN = -1;
    for (let i = 0; i < boxes.length; i++) {
      if (boxes[i].length < 2) continue;
      const n = boxes[i].reduce((s, it) => s + it.n, 0);
      if (n > bestN) { bestN = n; bi = i; }
    }
    if (bi === -1) break;
    const box = boxes[bi];
    let lo = { r: 255, g: 255, b: 255 }, hi = { r: 0, g: 0, b: 0 };
    for (const it of box) {
      lo = { r: Math.min(lo.r, it.r), g: Math.min(lo.g, it.g), b: Math.min(lo.b, it.b) };
      hi = { r: Math.max(hi.r, it.r), g: Math.max(hi.g, it.g), b: Math.max(hi.b, it.b) };
    }
    const ranges = { r: hi.r - lo.r, g: hi.g - lo.g, b: hi.b - lo.b };
    const ch: "r" | "g" | "b" =
      ranges.r >= ranges.g && ranges.r >= ranges.b ? "r" : ranges.g >= ranges.b ? "g" : "b";
    box.sort((a, b) => a[ch] - b[ch]);
    const total = box.reduce((s, it) => s + it.n, 0);
    let acc = 0, split = 1;
    for (let i = 0; i < box.length - 1; i++) {
      acc += box[i].n;
      if (acc >= total / 2) { split = i + 1; break; }
    }
    boxes.splice(bi, 1, box.slice(0, split), box.slice(split));
  }
  return boxes.map((box) => {
    let r = 0, g = 0, b = 0, n = 0;
    for (const it of box) { r += it.r * it.n; g += it.g * it.n; b += it.b * it.n; n += it.n; }
    return ((Math.round(r / n) & 0xff) << 16) | ((Math.round(g / n) & 0xff) << 8) | (Math.round(b / n) & 0xff);
  });
}

/** Standard GIF LZW with deferred clear at 4096 codes (omggif-style). */
function lzwEncode(minCodeSize: number, indices: Uint8Array): Uint8Array {
  const out: number[] = [];
  let cur = 0, curShift = 0;
  let codeSize = minCodeSize + 1;
  const emit = (code: number) => {
    cur |= code << curShift;
    curShift += codeSize;
    while (curShift >= 8) {
      out.push(cur & 0xff);
      cur >>= 8;
      curShift -= 8;
    }
  };
  const clearCode = 1 << minCodeSize;
  const eoiCode = clearCode + 1;
  let nextCode = eoiCode + 1;
  let table = new Map<number, number>();

  emit(clearCode);
  let prev = indices[0];
  for (let i = 1; i < indices.length; i++) {
    const k = indices[i];
    const key = (prev << 8) | k;
    const hit = table.get(key);
    if (hit !== undefined) {
      prev = hit;
      continue;
    }
    emit(prev);
    if (nextCode === 4096) {
      emit(clearCode);
      nextCode = eoiCode + 1;
      codeSize = minCodeSize + 1;
      table = new Map();
    } else {
      if (nextCode >= 1 << codeSize) codeSize++;
      table.set(key, nextCode++);
    }
    prev = k;
  }
  emit(prev);
  emit(eoiCode);
  if (curShift > 0) out.push(cur & 0xff);
  return Uint8Array.from(out);
}
