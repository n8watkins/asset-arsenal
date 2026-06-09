import type { Metadata } from "next";
import { NewRunFlow } from "@/components/app/NewRunFlow";
import { getCurrentUser } from "@/lib/session";

export const metadata: Metadata = {
  title: "New icon pack",
};

export default async function NewRunPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          New icon pack
        </h1>
        <p className="mt-1 text-sm text-muted">
          Upload a design image. We detect the icon system, then generate
          matching icons — 1 credit each.
        </p>
      </header>
      <NewRunFlow creditsBalance={user.creditsBalance} />
    </div>
  );
}
