import Nav from "@/components/Nav";
import ArenaWorkspace from "@/components/arena/ArenaWorkspace";

export const metadata = { title: "Prompt Arena · Asset Arsenal" };

// Full-view counterpart to the pop-out drawer. Same core arena, more room to
// read verdicts and iterate. Slice 1 is text-only prompt judging; image-pair
// judging and session history land in later slices.

export default function ArenaPage() {
  return (
    <>
      <Nav />
      <main className="min-h-screen bg-zinc-950 px-4 py-10 text-zinc-100">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-8">
          <div className="flex flex-col gap-3">
            <h1 className="text-3xl font-bold">Prompt Arena</h1>
            <p className="max-w-2xl text-base text-zinc-400">
              Drop in two candidate icon-generation prompts and let{" "}
              <span className="text-zinc-200">Gemini 3.1 Flash-Lite</span> judge
              which is the stronger prompt — scored per criterion, with a{" "}
              <span className="text-emerald-300">distilled</span> best prompt you
              can copy straight into the bench. Gemini judges; your OpenAI
              pipeline still does the generating.
            </p>
          </div>
          <ArenaWorkspace />
        </div>
      </main>
    </>
  );
}
