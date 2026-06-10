// Minimal dependency-free ZIP writer — STORE method only (no compression).
// PNGs are already deflate-compressed, so storing them verbatim costs ~0% and
// keeps this file tiny. Format reference: PKWARE APPNOTE.TXT (the classic
// local-header / central-directory / EOCD layout, all little-endian).

import { slugify } from "@/lib/icon/download";

// ---- CRC-32 (table-based, reflected polynomial 0xEDB88320) ----

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** Decode a base64 data URL ("data:image/png;base64,…") to raw bytes. */
export function dataUrlToBytes(dataUrl: string): Uint8Array {
  const bin = atob(dataUrl.slice(dataUrl.indexOf(",") + 1));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

/**
 * Build a ZIP Blob from named byte entries. Every entry is STOREd verbatim.
 * Filenames are written as UTF-8 (general-purpose flag bit 11).
 */
export function buildZip(files: { name: string; data: Uint8Array }[]): Blob {
  const enc = new TextEncoder();
  // ZIP timestamps are local-time MS-DOS format (2-second resolution).
  const now = new Date();
  const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
  const dosDate =
    (Math.max(0, now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();

  const parts: BlobPart[] = []; //   local headers + file data, in order
  const central: BlobPart[] = []; // central directory entries
  let offset = 0; //                 running byte offset of the next local header
  let centralSize = 0;

  for (const f of files) {
    const name = enc.encode(f.name);
    const crc = crc32(f.data);

    // Local file header (30 bytes) + filename, then the raw bytes.
    const local = new Uint8Array(30 + name.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true); // local file header signature
    lv.setUint16(4, 20, true); //         version needed to extract: 2.0
    lv.setUint16(6, 0x0800, true); //     flags: bit 11 = UTF-8 filename
    lv.setUint16(8, 0, true); //          compression method: 0 = STORE
    lv.setUint16(10, dosTime, true);
    lv.setUint16(12, dosDate, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, f.data.length, true); // compressed size (= raw for STORE)
    lv.setUint32(22, f.data.length, true); // uncompressed size
    lv.setUint16(26, name.length, true);
    lv.setUint16(28, 0, true); //            extra field length
    local.set(name, 30);
    parts.push(local, f.data as BlobPart);

    // Central directory entry (46 bytes) + filename. Unset fields stay 0
    // (extra/comment lengths, disk number, internal/external attributes).
    const cen = new Uint8Array(46 + name.length);
    const cv = new DataView(cen.buffer);
    cv.setUint32(0, 0x02014b50, true); // central directory signature
    cv.setUint16(4, 20, true); //         version made by
    cv.setUint16(6, 20, true); //         version needed to extract
    cv.setUint16(8, 0x0800, true); //     flags: UTF-8 filename
    cv.setUint16(10, 0, true); //         method: STORE
    cv.setUint16(12, dosTime, true);
    cv.setUint16(14, dosDate, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, f.data.length, true);
    cv.setUint32(24, f.data.length, true);
    cv.setUint16(28, name.length, true);
    cv.setUint32(42, offset, true); //    offset of this entry's local header
    cen.set(name, 46);
    central.push(cen);

    offset += local.length + f.data.length;
    centralSize += cen.length;
  }

  // End of central directory record (22 bytes, no comment).
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true); // EOCD signature
  ev.setUint16(8, files.length, true); //  entries on this disk
  ev.setUint16(10, files.length, true); // total entries
  ev.setUint32(12, centralSize, true); //  central directory size
  ev.setUint32(16, offset, true); //       central directory offset
  return new Blob([...parts, ...central, eocd], { type: "application/zip" });
}

/**
 * Map named data-URL images to zip entries: slugified names, extension from
 * the data URL's mime type (default png), name collisions deduped -2, -3, ….
 */
export function zipEntriesFromDataUrls(
  items: { name: string; dataUrl: string }[],
): { name: string; data: Uint8Array }[] {
  const seen = new Map<string, number>();
  return items.map((it) => {
    const m = /^data:image\/([a-z0-9.+-]+)/i.exec(it.dataUrl);
    const sub = m ? m[1].toLowerCase() : "png";
    const ext = sub === "jpeg" ? "jpg" : sub === "svg+xml" ? "svg" : sub;
    const base = slugify(it.name);
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return {
      name: `${base}${n > 1 ? `-${n}` : ""}.${ext}`,
      data: dataUrlToBytes(it.dataUrl),
    };
  });
}

/** Build the zip and trigger a single browser download via a (revoked) object URL. */
export function downloadZip(
  zipName: string,
  files: { name: string; data: Uint8Array }[],
): void {
  if (files.length === 0) return;
  const url = URL.createObjectURL(buildZip(files));
  const a = document.createElement("a");
  a.href = url;
  a.download = zipName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}
