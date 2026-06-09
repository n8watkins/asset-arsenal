import Nav from "@/components/Nav";
import ExperimentRunner from "@/components/experiments/ExperimentRunner";
import GeminiChat from "@/components/gemini-chat/GeminiChat";

export const metadata = { title: "Experiments · Asset Arsenal" };

// The all-in-one experiment surface: set up a comparison (one prompt across two
// models, or two prompts on one model), run it, and see the outputs side by
// side — with the Gemini analysis chat docked as a sidebar for eyeballing the
// results. Isolated from the test benches.

export default function ExperimentsPage() {
  return (
    <>
      <Nav />
      <main className="bg-zinc-950 px-4 py-8 text-zinc-100">
        <div className="mx-auto w-full max-w-7xl">
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-bold">Experiments</h1>
            <p className="max-w-2xl text-sm text-zinc-400">
              Pick what goes in and what comes out, then run the same prompt
              across two models — or two prompts on one model — and compare the
              outputs. Gemini sits on the right as an analysis sidebar: drop your
              results in and ask which is better.
            </p>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_24rem]">
            <ExperimentRunner />

            <aside className="flex flex-col gap-2 lg:sticky lg:top-20 lg:h-[calc(100vh-7rem)]">
              <h2 className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Gemini analysis
              </h2>
              <div className="min-h-0 flex-1 rounded-2xl border border-zinc-800 bg-zinc-900/30 p-3">
                <GeminiChat />
              </div>
            </aside>
          </div>
        </div>
      </main>
    </>
  );
}
