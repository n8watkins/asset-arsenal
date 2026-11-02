import { Footer, Nav } from "@/components/Chrome";
import { SkinDemo } from "@/components/SkinDemo";
import { compare, faq, pack, steps, uses, workbench } from "@/lib/content";
import { site } from "@/lib/site";

function Section({ id, eyebrow, title, intro, children }: { id: string; eyebrow: string; title: string; intro?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20 border-t border-line">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-24">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">{eyebrow}</p>
        <h2 className="mt-3 max-w-3xl font-display text-3xl font-bold tracking-tight sm:text-4xl">{title}</h2>
        {intro && <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted">{intro}</p>}
        <div className="mt-12">{children}</div>
      </div>
    </section>
  );
}

function Waitlist({ className = "" }: { className?: string }) {
  return (
    <a
      href={site.waitlistUrl}
      className={`inline-flex items-center justify-center rounded-xl bg-accent px-5 py-3 font-semibold text-accent-ink shadow-lg shadow-accent/20 hover:brightness-110 ${className}`}
    >
      Join the waitlist
    </a>
  );
}

export default function Home() {
  return (
    <>
      <Nav />
      <main id="main">
        <section className="relative overflow-hidden">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_80%_0%,rgb(167_139_250/0.16),transparent_55%),radial-gradient(ellipse_at_0%_100%,rgb(243_183_63/0.12),transparent_50%)]"
          />
          <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 pb-20 pt-14 sm:px-6 lg:grid-cols-[1fr_1.05fr] lg:pb-28 lg:pt-20">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-xs font-medium text-muted">
                <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden="true" />
                A concept in development
              </p>
              <h1 className="mt-5 font-display text-5xl font-bold leading-[1.02] tracking-tight sm:text-6xl">
                Give your page a <span className="text-accent">skin</span>.
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted">
                Asset Arsenal reimagines your page in your brand, or in any style you name, then breaks that picture into
                real assets you can ship: backgrounds, frames, buttons, icons and illustrations, each one cut out and ready
                to drop in.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-4">
                <Waitlist />
                <a href="#how-it-works" className="font-medium text-ink underline-offset-4 hover:underline">
                  How it works
                </a>
              </div>
            </div>
            <SkinDemo />
          </div>
        </section>

        <Section
          id="how-it-works"
          eyebrow="How it works"
          title="From one picture of your page to a full set of parts"
          intro="Image models are already good at reimagining a screenshot. The hard part is everything after: turning that one flat picture into pieces you can actually use. That is the part Asset Arsenal does."
        >
          <ol className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {steps.map((s, i) => (
              <li key={s.title} className="rounded-2xl border border-line bg-surface p-6">
                <span className="font-mono text-sm text-accent">0{i + 1}</span>
                <h3 className="mt-3 font-display text-xl font-bold">{s.title}</h3>
                <p className="mt-2 leading-relaxed text-muted">{s.body}</p>
              </li>
            ))}
          </ol>
        </Section>

        <Section
          id="what-you-get"
          eyebrow="What you get"
          title="A skin pack, not a screenshot"
          intro="Every asset comes full size on a transparent background, at 1x and 2x, named for where it goes on the page."
        >
          <ul className="grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
            {pack.map((p) => (
              <li key={p.title} className="bg-surface p-6">
                <h3 className="font-semibold">{p.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{p.body}</p>
              </li>
            ))}
          </ul>

          <div className="mt-14 grid gap-4 md:grid-cols-2">
            {uses.map((u) => (
              <div key={u.title} className="rounded-2xl border border-line bg-gradient-to-br from-surface-2 to-surface p-7">
                <h3 className="font-display text-2xl font-bold">{u.title}</h3>
                <p className="mt-3 leading-relaxed text-muted">{u.body}</p>
              </div>
            ))}
          </div>
        </Section>

        <Section
          id="workbench"
          eyebrow="The workbench"
          title="You stay in charge of every piece"
          intro="Image models still miss sometimes. The workbench makes a miss cheap: fix one piece without redoing the set."
        >
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {workbench.map((w) => (
              <div key={w.title} className="rounded-2xl border border-line p-6">
                <h3 className="font-semibold text-accent">{w.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{w.body}</p>
              </div>
            ))}
          </div>
        </Section>

        <Section
          id="compare"
          eyebrow="Compared"
          title="Good tools exist for parts of this"
          intro="None of them start from your live page and hand back the cut-out parts of a new look. That gap is the whole idea."
        >
          <div className="overflow-x-auto rounded-2xl border border-line">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-surface-2 text-xs uppercase tracking-wider text-muted">
                <tr>
                  <th scope="col" className="px-5 py-3 font-semibold">Tool</th>
                  <th scope="col" className="px-5 py-3 font-semibold">Great at</th>
                  <th scope="col" className="px-5 py-3 font-semibold">Missing for this job</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {compare.map((c) => (
                  <tr key={c.name} className="bg-surface align-top">
                    <th scope="row" className="whitespace-nowrap px-5 py-4 font-semibold">{c.name}</th>
                    <td className="px-5 py-4 leading-relaxed text-muted">{c.good}</td>
                    <td className="px-5 py-4 leading-relaxed text-ink/90">{c.gap}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <Section id="faq" eyebrow="FAQ" title="Questions">
          <dl className="grid gap-x-10 gap-y-8 md:grid-cols-2">
            {faq.map((f) => (
              <div key={f.q}>
                <dt className="font-display text-lg font-bold">{f.q}</dt>
                <dd className="mt-2 leading-relaxed text-muted">{f.a}</dd>
              </div>
            ))}
          </dl>
        </Section>

        <section className="border-t border-line">
          <div className="mx-auto max-w-6xl px-4 py-20 text-center sm:px-6">
            <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">Want your page in a new skin?</h2>
            <p className="mx-auto mt-4 max-w-xl text-lg text-muted">
              Join the waitlist on n8builds.dev and you&rsquo;ll hear when the first skins are ready to try.
            </p>
            <Waitlist className="mt-8" />
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
