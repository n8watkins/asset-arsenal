// Programmatic demo sprite sheet — a bouncing slime with squash & stretch,
// 4x4 grid of 64px cells. Drawn at 16px and upscaled nearest-neighbor for a
// pixel-art look, so visitors land on a page that's already animating
// without shipping any image asset.

export const DEMO_NAME = "demo-slime.png";

export function makeDemoSheet(): string {
  const CELL = 64;
  const N = 4;
  const TINY = 16;
  const sheet = document.createElement("canvas");
  sheet.width = sheet.height = CELL * N;
  const ctx = sheet.getContext("2d");
  const tiny = document.createElement("canvas");
  tiny.width = tiny.height = TINY;
  const tctx = tiny.getContext("2d");
  if (!ctx || !tctx) return "";
  ctx.imageSmoothingEnabled = false;

  for (let i = 0; i < N * N; i++) {
    // One full bounce across the 16 frames; sin hits 0 at both ends so the
    // loop is seamless.
    const phase = (i / (N * N)) * Math.PI * 2;
    const bounce = Math.abs(Math.sin(phase)); // 0 = on ground, 1 = apex
    const squash = 1 - bounce;

    tctx.clearRect(0, 0, TINY, TINY);
    const cx = 8;
    const ry = 4 - squash * 1.5 + bounce * 0.5;
    const rx = 4.5 + squash * 1.5;
    const cy = 14 - ry - bounce * 6;

    // Outline, body, eyes.
    tctx.fillStyle = "#166534";
    tctx.beginPath();
    tctx.ellipse(cx, cy, rx + 0.9, ry + 0.9, 0, 0, Math.PI * 2);
    tctx.fill();
    tctx.fillStyle = "#4ade80";
    tctx.beginPath();
    tctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    tctx.fill();
    tctx.fillStyle = "#052e16";
    tctx.fillRect(Math.round(cx - 2.5), Math.round(cy - 1), 1, 2);
    tctx.fillRect(Math.round(cx + 1.5), Math.round(cy - 1), 1, 2);

    const col = i % N;
    const row = Math.floor(i / N);
    ctx.drawImage(tiny, col * CELL, row * CELL, CELL, CELL);
  }
  return sheet.toDataURL("image/png");
}
