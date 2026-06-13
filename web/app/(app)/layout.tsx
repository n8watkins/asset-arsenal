import { redirect } from "next/navigation";
import { Sidebar } from "@/components/app/Sidebar";
import { getCurrentUser } from "@/lib/session";
import { ensureSignupBonus } from "@/lib/signup-bonus";
import { getBalance } from "@/lib/credits";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // Grant the signup bonus on first app load (idempotent, applies the per-IP
  // farming cap). Then read the live balance so the grant shows immediately.
  await ensureSignupBonus(user.id);
  const creditsBalance = await getBalance(user.id);

  return (
    <div className="flex min-h-dvh flex-col bg-background md:flex-row">
      <Sidebar userName={user.name} creditsBalance={creditsBalance} />
      <div className="flex min-w-0 flex-1 flex-col">
        <main className="flex-1 px-5 py-8 sm:px-8">{children}</main>
      </div>
    </div>
  );
}
