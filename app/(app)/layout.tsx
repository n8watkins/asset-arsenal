import { redirect } from "next/navigation";
import { Sidebar } from "@/components/app/Sidebar";
import { getCurrentUser, isDemo } from "@/lib/session";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="flex min-h-dvh flex-col bg-background md:flex-row">
      <Sidebar userName={user.name} creditsBalance={user.creditsBalance} />
      <div className="flex min-w-0 flex-1 flex-col">
        {isDemo && (
          <div className="border-b border-border bg-surface-2 px-5 py-2 text-center text-xs text-muted">
            Demo mode — sign-in not configured.
          </div>
        )}
        <main className="flex-1 px-5 py-8 sm:px-8">{children}</main>
      </div>
    </div>
  );
}
