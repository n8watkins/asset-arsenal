"use client";

import { useEffect, useRef, useState } from "react";
import { sendChat } from "@/lib/gemini/chat-client";
import { DEFAULT_JUDGE_MODEL, JUDGE_MODELS } from "@/lib/gemini/models";
import {
  listChats,
  createChat,
  saveChat,
  deleteChat,
  deriveTitle,
  type GeminiChat as Chat,
  type ChatMessage,
} from "@/lib/gemini/chat-store";

// The Gemini analysis chat sidebar: one scrollable conversation, one input box,
// multiple auto-named chats. Paste prompts or attach images and ask Gemini to
// compare/critique; copy the answer out. Standalone — not wired to the Runner.

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function MessageBubble({ msg }: { msg: ChatMessage }) {
  const [copied, setCopied] = useState(false);
  const isUser = msg.role === "user";
  return (
    <div className={`flex flex-col gap-1.5 ${isUser ? "items-end" : "items-start"}`}>
      {msg.images && msg.images.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {msg.images.map((src, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={i}
              src={src}
              alt={`attachment ${i + 1}`}
              className="h-20 w-20 rounded-md border border-zinc-800 object-contain bg-zinc-900"
            />
          ))}
        </div>
      )}
      {msg.text && (
        <div
          className={`group relative max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-sm ${
            isUser
              ? "bg-cyan-500/15 text-cyan-50 ring-1 ring-cyan-500/30"
              : "bg-zinc-800/70 text-zinc-100"
          }`}
        >
          {msg.text}
          {!isUser && (
            <button
              onClick={async () => {
                await navigator.clipboard.writeText(msg.text);
                setCopied(true);
                setTimeout(() => setCopied(false), 1200);
              }}
              className="absolute -bottom-5 left-1 text-xs text-zinc-600 opacity-0 transition-opacity hover:text-cyan-300 group-hover:opacity-100 focus:opacity-100 focus:outline-none"
            >
              {copied ? "copied ✓" : "copy"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export interface GeminiChatProps {
  // When the runner sends results over, the drawer passes them here to pre-fill
  // the composer. seedNonce changes on each send so repeats re-apply.
  seedText?: string;
  seedImages?: string[];
  seedNonce?: number;
}

export default function GeminiChat({ seedText, seedImages, seedNonce }: GeminiChatProps) {
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [model, setModel] = useState<string>(DEFAULT_JUDGE_MODEL);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState<string[]>([]); // attached image data URLs
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const active = chats.find((c) => c.id === activeId) ?? null;

  // Load chats on mount; ensure there's an active one.
  useEffect(() => {
    void (async () => {
      const all = await listChats();
      if (all.length > 0) {
        setChats(all);
        setActiveId(all[0].id);
      } else {
        const fresh = await createChat(DEFAULT_JUDGE_MODEL);
        setChats([fresh]);
        setActiveId(fresh.id);
      }
    })();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [active?.messages.length, loading]);

  // Pre-fill the composer when the runner seeds the drawer with results.
  useEffect(() => {
    if (seedNonce === undefined) return;
    if (seedText !== undefined) setInput(seedText);
    if (seedImages && seedImages.length) setPending(seedImages);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seedNonce]);

  function patchActive(updater: (c: Chat) => Chat) {
    setChats((prev) => prev.map((c) => (c.id === activeId ? updater(c) : c)));
  }

  async function onNewChat() {
    const fresh = await createChat(model);
    setChats((prev) => [fresh, ...prev]);
    setActiveId(fresh.id);
    setError(null);
  }

  async function onDeleteChat(id: string) {
    await deleteChat(id);
    setChats((prev) => {
      const next = prev.filter((c) => c.id !== id);
      if (id === activeId) setActiveId(next[0]?.id ?? null);
      return next;
    });
    // If we emptied the list, spin up a fresh chat.
    const remaining = chats.filter((c) => c.id !== id);
    if (remaining.length === 0) await onNewChat();
  }

  async function attachFiles(files: FileList | null) {
    if (!files) return;
    const urls = await Promise.all([...files].map(readAsDataUrl));
    setPending((p) => [...p, ...urls]);
  }

  async function onSend() {
    if (!active || loading) return;
    if (!input.trim() && pending.length === 0) return;

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      text: input,
      images: pending.length ? pending : undefined,
      createdAt: new Date().toISOString(),
    };
    const titled =
      active.title === "New chat"
        ? deriveTitle(input || "image comparison")
        : active.title;
    const withUser: Chat = {
      ...active,
      title: titled,
      messages: [...active.messages, userMsg],
    };

    patchActive(() => withUser);
    setInput("");
    setPending([]);
    setLoading(true);
    setError(null);
    void saveChat(withUser);

    try {
      const { reply, usage } = await sendChat({
        model,
        turns: withUser.messages.map((m) => ({
          role: m.role,
          text: m.text,
          images: m.role === "user" ? m.images : undefined,
        })),
      });
      const modelMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "model",
        text: reply,
        createdAt: new Date().toISOString(),
        usage,
      };
      const withReply: Chat = { ...withUser, messages: [...withUser.messages, modelMsg] };
      patchActive(() => withReply);
      void saveChat(withReply);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      {/* Chat switcher */}
      <div className="flex items-center gap-2">
        <select
          value={activeId ?? ""}
          onChange={(e) => setActiveId(e.target.value)}
          className="min-w-0 flex-1 truncate rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 py-1.5 text-sm text-zinc-200 focus:border-cyan-500/50 focus:outline-none"
        >
          {chats.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
        <button
          onClick={onNewChat}
          className="shrink-0 rounded-lg border border-zinc-700 px-2.5 py-1.5 text-xs text-zinc-300 transition-colors hover:bg-zinc-800 focus:outline-none focus:ring-1 focus:ring-cyan-500"
        >
          + New
        </button>
        {active && (
          <button
            onClick={() => onDeleteChat(active.id)}
            className="shrink-0 rounded-lg px-2 py-1.5 text-xs text-zinc-600 transition-colors hover:text-red-400 focus:outline-none"
            aria-label="Delete chat"
          >
            ✕
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 min-h-0 overflow-y-auto rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">
        {active && active.messages.length > 0 ? (
          <div className="flex flex-col gap-4">
            {active.messages.map((m) => (
              <MessageBubble key={m.id} msg={m} />
            ))}
            {loading && (
              <div className="flex items-center gap-2 text-sm text-zinc-500">
                <span className="h-2 w-2 animate-pulse rounded-full bg-cyan-400" />
                Gemini is thinking…
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-0.5 px-4 text-center text-xs text-zinc-600">
            <p>Paste two prompts → “compare these”.</p>
            <p>Or attach two images → “which icon is better?”</p>
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-red-700/40 bg-red-950/40 px-3 py-2 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Pending attachments */}
      {pending.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {pending.map((src, i) => (
            <div key={i} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt={`pending ${i + 1}`}
                className="h-14 w-14 rounded-md border border-zinc-800 object-contain bg-zinc-900"
              />
              <button
                onClick={() => setPending((p) => p.filter((_, j) => j !== i))}
                className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-zinc-800 text-xs text-zinc-300 ring-1 ring-zinc-600 hover:text-red-400"
                aria-label="Remove attachment"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Composer */}
      <div className="flex flex-col gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              void onSend();
            }
          }}
          rows={2}
          placeholder="Ask Gemini… (⌘/Ctrl+Enter to send)"
          className="resize-y rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/40"
        />
        <div className="flex items-center gap-2">
          <button
            onClick={() => fileRef.current?.click()}
            className="rounded-lg border border-zinc-700 px-2.5 py-1.5 text-xs text-zinc-300 transition-colors hover:bg-zinc-800 focus:outline-none focus:ring-1 focus:ring-cyan-500"
          >
            + Image
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              void attachFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-xs text-zinc-300 focus:border-cyan-500/50 focus:outline-none"
          >
            {JUDGE_MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
          <button
            onClick={onSend}
            disabled={loading || (!input.trim() && pending.length === 0)}
            className="ml-auto rounded-lg bg-cyan-500/15 px-4 py-1.5 text-sm font-semibold text-cyan-300 ring-1 ring-cyan-500/40 transition-colors hover:bg-cyan-500/25 focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loading ? "Sending…" : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}
