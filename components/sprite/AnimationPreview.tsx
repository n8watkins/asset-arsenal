"use client";

import { useEffect, useRef, useState } from "react";

// Live canvas player for sliced frames — preview the animation BEFORE paying
// the GIF encode. Pixelated upscale + checkerboard backdrop so transparency
// and crisp pixel art read correctly.

export interface AnimationPreviewProps {
  /** hold = per-frame duration multiplier (default 1). */
  frames: { imageData: ImageData; hold?: number }[];
  fps: number;
  pingPong: boolean;
}

export default function AnimationPreview({ frames, fps, pingPong }: AnimationPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [playing, setPlaying] = useState(true);
  const [index, setIndex] = useState(0);
  const dirRef = useRef(1);
  // The playback clock reads the CURRENT frame's hold without re-subscribing.
  const indexRef = useRef(0);
  indexRef.current = index;
  const framesRef = useRef(frames);
  framesRef.current = frames;

  const count = frames.length;
  const frameW = count > 0 ? frames[0].imageData.width : 0;
  const frameH = count > 0 ? frames[0].imageData.height : 0;

  // Keep the cursor valid when the frame set shrinks.
  useEffect(() => {
    if (index >= count) setIndex(0);
  }, [count, index]);

  // Playback clock
  useEffect(() => {
    if (!playing || count < 2) return;
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    const base = 1000 / Math.max(1, fps);
    const tick = (t: number) => {
      acc += t - last;
      last = t;
      // Interval depends on the current frame's hold, so advance via the ref
      // (state updates are async) and re-read the hold after every step.
      const holdAt = (i: number) => framesRef.current[i]?.hold ?? 1;
      let interval = base * holdAt(indexRef.current);
      while (acc >= interval) {
        acc -= interval;
        const i = indexRef.current;
        let next: number;
        if (!pingPong) {
          next = (i + 1) % count;
        } else {
          next = i + dirRef.current;
          if (next < 0 || next >= count) {
            dirRef.current = -dirRef.current;
            next = i + dirRef.current;
          }
          next = Math.max(0, Math.min(count - 1, next));
        }
        indexRef.current = next;
        setIndex(next);
        interval = base * holdAt(next);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, fps, pingPong, count]);

  // Draw the current frame
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || count === 0 || index >= count) return;
    canvas.width = frameW;
    canvas.height = frameH;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.putImageData(frames[index].imageData, 0, 0);
  }, [frames, index, count, frameW, frameH]);

  if (count === 0) {
    return (
      <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-zinc-700 text-sm text-zinc-500">
        Frames appear here once a sheet is sliced
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <canvas
        ref={canvasRef}
        className="max-h-72 max-w-full rounded-lg border border-zinc-700"
        style={{
          imageRendering: "pixelated",
          // Checkerboard so transparent pixels are visible
          backgroundImage:
            "conic-gradient(#3f3f46 0 25%, #27272a 0 50%, #3f3f46 0 75%, #27272a 0)",
          backgroundSize: "16px 16px",
          width: Math.min(288, frameW * Math.max(1, Math.floor(288 / Math.max(1, frameW)))),
        }}
      />
      <div className="flex w-full items-center gap-3">
        <button
          type="button"
          onClick={() => setPlaying((p) => !p)}
          className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm font-medium text-zinc-200 transition-colors hover:border-cyan-500/60 hover:text-cyan-300"
        >
          {playing ? "Pause" : "Play"}
        </button>
        <input
          type="range"
          min={0}
          max={Math.max(0, count - 1)}
          value={Math.min(index, count - 1)}
          onChange={(e) => {
            setPlaying(false);
            setIndex(Number(e.target.value));
          }}
          className="flex-1 accent-cyan-400"
        />
        <span className="w-16 text-right text-xs tabular-nums text-zinc-400">
          {Math.min(index, count - 1) + 1} / {count}
        </span>
      </div>
    </div>
  );
}
