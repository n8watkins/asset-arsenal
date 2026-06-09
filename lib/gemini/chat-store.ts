// IndexedDB-backed store for the Gemini analysis chat sidebar. Browser-only;
// best-effort (never throws). Each chat is one scrollable conversation with its
// messages inline; lives in the shared asset-arsenal DB ("chats" store).

import { getDB } from "@/lib/storage/db";
import type { TokenUsage } from "@/types/icon-pipeline";

export type ChatRole = "user" | "model";

export type ChatMessage = {
  id: string;
  role: ChatRole;
  text: string;
  // User-attached images as data URLs (e.g. two results dragged in to compare).
  images?: string[];
  createdAt: string;
  usage?: TokenUsage; // on model replies
};

export type GeminiChat = {
  id: string;
  title: string;
  model: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
};

/** Derive an auto-title from the first user message (no model call). */
export function deriveTitle(text: string): string {
  const clean = text.trim().replace(/\s+/g, " ");
  if (!clean) return "New chat";
  return clean.length > 40 ? `${clean.slice(0, 40)}…` : clean;
}

/** All chats, most-recently-updated first. Best-effort: [] on error. */
export async function listChats(): Promise<GeminiChat[]> {
  try {
    const db = await getDB();
    const all = await db.getAll("chats");
    all.sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
    return all;
  } catch {
    return [];
  }
}

export async function getChat(id: string): Promise<GeminiChat | undefined> {
  try {
    const db = await getDB();
    return await db.get("chats", id);
  } catch {
    return undefined;
  }
}

/** Make a fresh empty chat and persist it. */
export async function createChat(model: string): Promise<GeminiChat> {
  const now = new Date().toISOString();
  const chat: GeminiChat = {
    id: crypto.randomUUID(),
    title: "New chat",
    model,
    createdAt: now,
    updatedAt: now,
    messages: [],
  };
  try {
    const db = await getDB();
    await db.put("chats", chat);
  } catch {
    /* unavailable / quota — return unpersisted */
  }
  return chat;
}

/** Persist a chat (bumps updatedAt). Best-effort. */
export async function saveChat(chat: GeminiChat): Promise<void> {
  try {
    const db = await getDB();
    await db.put("chats", { ...chat, updatedAt: new Date().toISOString() });
  } catch {
    /* ignore */
  }
}

export async function deleteChat(id: string): Promise<void> {
  try {
    const db = await getDB();
    await db.delete("chats", id);
  } catch {
    /* ignore */
  }
}
