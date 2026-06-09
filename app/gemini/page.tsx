import Nav from "@/components/Nav";
import ChatCollection from "@/components/gemini-chat/ChatCollection";

export const metadata = { title: "Gemini Analysis · Asset Arsenal" };

// A collection of every past Gemini analysis (the chats run from the drawer),
// with transcripts and a token-usage rollup. The drawer is where you run
// analysis; this page is the record of it.

export default function GeminiPage() {
  return (
    <>
      <Nav />
      <main className="min-h-screen bg-zinc-950 px-4 py-8 text-zinc-100">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-bold">Gemini Analysis</h1>
            <p className="text-sm text-zinc-400">
              Every analysis you’ve run in the Gemini drawer, collected here —
              expand any to see the transcript. To run a new one, open the drawer
              (✦ bottom-left) or hit “Send to Gemini” on an experiment’s results.
            </p>
          </div>
          <ChatCollection />
        </div>
      </main>
    </>
  );
}
