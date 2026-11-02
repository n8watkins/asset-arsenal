import Link from "next/link";
import { Footer, Nav } from "@/components/Chrome";
import { routes } from "@/lib/site";

export default function NotFound() {
  return (
    <>
      <Nav />
      <main id="main" className="mx-auto max-w-3xl px-4 py-24 sm:px-6">
        <p className="font-mono text-sm text-accent">404</p>
        <h1 className="mt-3 font-display text-4xl font-bold tracking-tight">That page isn&rsquo;t in the arsenal.</h1>
        <ul className="mt-8 space-y-2">
          {routes.map((r) => (
            <li key={r.path}>
              <Link href={r.path} className="text-muted hover:text-accent">
                {r.title}
              </Link>
            </li>
          ))}
        </ul>
      </main>
      <Footer />
    </>
  );
}
