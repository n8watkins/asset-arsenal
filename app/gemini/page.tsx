import Nav from "@/components/Nav";
import ChatCollection from "@/components/gemini-chat/ChatCollection";

export const metadata = { title: "Gemini Analysis · Asset Arsenal" };

// ARCHIVED surface: the Gemini analysis drawer is parked (intentionally not
// mounted — see app/layout.tsx). This page remains as the read-only record of
// every past analysis, with transcripts and a token-usage rollup.

export default function GeminiPage() {
  return (
    <>
      <Nav />
      <main className="min-h-screen bg-zinc-950 px-4 py-8 text-zinc-100">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-bold">Gemini Analysis</h1>
            <p className="text-sm text-zinc-400">
              This surface is archived — the Gemini analysis tooling is parked
              for now. Your saved analyses below remain readable; expand any to
              see its transcript.
            </p>
          </div>
          <ChatCollection />
        </div>
      </main>
    </>
  );
}
