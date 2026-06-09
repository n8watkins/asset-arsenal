"use client";

import { useEffect, useState } from "react";
import { listChats, deleteChat, type GeminiChat } from "@/lib/gemini/chat-store";

// Read surface for the /gemini page: a collection of every past analysis chat,
// most-recent first, each expandable to its transcript, plus a token-usage
// rollup across all of them (Gemini is free → pure visibility). The drawer is
// where you *do* analysis; this is where you review it.

function fmt(n: number): string {
  return n.toLocaleString();
}

function ChatRow({ chat, onDelete }: { chat: GeminiChat; onDelete: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const inTok = chat.messages.reduce((s, m) => s + (m.usage?.inputTokens ?? 0), 0);
  const outTok = chat.messages.reduce((s, m) => s + (m.usage?.outputTokens ?? 0), 0);

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setOpen((v) => !v)}
          className="min-w-0 flex-1 truncate text-left text-sm font-medium text-zinc-100 hover:text-cyan-300 focus:outline-none"
        >
          {open ? "▾ " : "▸ "}
          {chat.title}
        </button>
        <span className="font-mono text-xs text-zinc-600">{chat.model}</span>
        <button
          onClick={() => onDelete(chat.id)}
          className="rounded-md px-1.5 py-0.5 text-xs text-zinc-600 transition-colors hover:text-red-400 focus:outline-none"
          aria-label="Delete chat"
        >
          ✕
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-500">
        <span>{new Date(chat.updatedAt).toLocaleString()}</span>
        <span>{chat.messages.length} messages</span>
        {(inTok > 0 || outTok > 0) && (
          <span className="font-mono">
            in {fmt(inTok)} · out {fmt(outTok)} tok
          </span>
        )}
      </div>

      {open && (
        <div className="flex flex-col gap-3 border-t border-zinc-800 pt-3">
          {chat.messages.map((m) => (
            <div key={m.id} className="flex flex-col gap-1.5">
              <span className="text-xs font-medium uppercase tracking-wide text-zinc-600">
                {m.role === "user" ? "You" : "Gemini"}
              </span>
              {m.images && m.images.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {m.images.map((src, i) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={i}
                      src={src}
                      alt={`attachment ${i + 1}`}
                      className="h-16 w-16 rounded-md border border-zinc-800 object-contain bg-zinc-900"
                    />
                  ))}
                </div>
              )}
              {m.text && (
                <p className="whitespace-pre-wrap break-words text-sm text-zinc-300">{m.text}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ChatCollection() {
  const [chats, setChats] = useState<GeminiChat[]>([]);
  const [loaded, setLoaded] = useState(false);

  async function reload() {
    setChats(await listChats());
    setLoaded(true);
  }

  useEffect(() => {
    void reload();
  }, []);

  async function onDelete(id: string) {
    await deleteChat(id);
    void reload();
  }

  // Only chats with real content are worth showing.
  const nonEmpty = chats.filter((c) => c.messages.length > 0);
  const totalIn = nonEmpty.reduce(
    (s, c) => s + c.messages.reduce((a, m) => a + (m.usage?.inputTokens ?? 0), 0),
    0,
  );
  const totalOut = nonEmpty.reduce(
    (s, c) => s + c.messages.reduce((a, m) => a + (m.usage?.outputTokens ?? 0), 0),
    0,
  );

  if (!loaded) return <p className="text-sm text-zinc-600">Loading…</p>;

  if (nonEmpty.length === 0) {
    return (
      <p className="text-sm text-zinc-600">
        No analyses yet. Open the Gemini drawer (✦ bottom-left), compare some
        prompts or results, and they’ll collect here.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap gap-x-8 gap-y-2 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-zinc-600">Analyses</p>
          <p className="font-mono text-lg text-zinc-200">{nonEmpty.length}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-zinc-600">Input tokens</p>
          <p className="font-mono text-lg text-cyan-300">{fmt(totalIn)}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-zinc-600">Output tokens</p>
          <p className="font-mono text-lg text-violet-300">{fmt(totalOut)}</p>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {nonEmpty.map((c) => (
          <ChatRow key={c.id} chat={c} onDelete={onDelete} />
        ))}
      </div>
    </div>
  );
}
