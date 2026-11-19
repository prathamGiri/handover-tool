import { BottomNav } from "@/components/bottom-nav";
import { requireMembership } from "@/lib/auth";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  await requireMembership();
  return (
    <div className="pt-safe min-h-dvh">
      <main className="mx-auto max-w-lg px-4 pb-28 md:has-[[data-wide]]:max-w-6xl">{children}</main>
      <BottomNav />
    </div>
  );
}
