import Nav from "@/components/Nav";
import GeminiChat from "@/components/gemini-chat/GeminiChat";

export const metadata = { title: "Gemini Analysis · Asset Arsenal" };

// Full-view counterpart to the pop-out chat drawer. Same chat, more room. A
// standalone analysis scratchpad — paste prompts/images, ask, copy the answer.
// Not wired to the experiment Runner.

export default function GeminiPage() {
  return (
    <>
      <Nav />
      <main className="bg-zinc-950 px-4 py-8 text-zinc-100">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-bold">Gemini Analysis</h1>
            <p className="text-sm text-zinc-400">
              A side chat with Gemini for comparing and critiquing prompts and
              results. Paste two prompts and ask “compare these”, or attach two
              images and ask which icon is better — then copy the answer.
            </p>
          </div>
          <div className="h-[72vh]">
            <GeminiChat />
          </div>
        </div>
      </main>
    </>
  );
}
