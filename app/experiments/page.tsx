import Nav from "@/components/Nav";
import ExperimentRunner from "@/components/experiments/ExperimentRunner";

export const metadata = { title: "Experiments · Asset Arsenal" };

// The experiment runner: set up a comparison (one prompt across two models, or
// two prompts on one model), run it, and see outputs side by side. Gemini lives
// in the global drawer (bottom-left "✦ Gemini") — run, then hit "Send to Gemini"
// on the results to analyze them there. Isolated from the test benches.

export default function ExperimentsPage() {
  return (
    <>
      <Nav />
      <main className="min-h-screen bg-zinc-950 px-4 py-8 text-zinc-100">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-bold">Experiments</h1>
            <p className="max-w-2xl text-sm text-zinc-400">
              Pick what goes in and what comes out, then run the same prompt
              across two models — or two prompts on one model — and compare the
              outputs. Then “Send to Gemini” to analyze them in the side drawer.
            </p>
          </div>
          <ExperimentRunner />
        </div>
      </main>
    </>
  );
}
