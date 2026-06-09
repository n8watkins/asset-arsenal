"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import GeminiChatDrawer from "./GeminiChatDrawer";

// Holds the global Gemini drawer's open state + a "seed" (text and/or images to
// pre-fill the composer with). Mounted once in the root layout, so the drawer is
// the single Gemini surface everywhere — and the experiment runner can open it
// pre-loaded with two results via useGeminiDrawer().openWith(...).

export type DrawerSeed = { text?: string; images?: string[] };

type DrawerCtx = {
  open: boolean;
  seed: (DrawerSeed & { nonce: number }) | null;
  toggle: () => void;
  close: () => void;
  openWith: (seed: DrawerSeed) => void;
};

const Ctx = createContext<DrawerCtx | null>(null);

export function useGeminiDrawer(): DrawerCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("useGeminiDrawer must be used within GeminiDrawerProvider");
  return c;
}

export default function GeminiDrawerProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [seed, setSeed] = useState<(DrawerSeed & { nonce: number }) | null>(null);

  const toggle = useCallback(() => setOpen((o) => !o), []);
  const close = useCallback(() => setOpen(false), []);
  const openWith = useCallback((s: DrawerSeed) => {
    setSeed({ ...s, nonce: Date.now() });
    setOpen(true);
  }, []);

  return (
    <Ctx.Provider value={{ open, seed, toggle, close, openWith }}>
      {children}
      <GeminiChatDrawer />
    </Ctx.Provider>
  );
}
