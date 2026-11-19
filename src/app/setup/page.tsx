import { redirect } from "next/navigation";
import { hasSupabaseEnv } from "@/lib/supabase/env";

export default function SetupPage() {
  if (hasSupabaseEnv) redirect("/");
  return (
    <main className="mx-auto max-w-md px-6 py-16">
      <h1 className="text-2xl font-bold">Almost there</h1>
      <p className="mt-3 text-muted">
        The app isn&apos;t connected to a database yet. Add{" "}
        <code className="rounded bg-surface-2 px-1">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
        <code className="rounded bg-surface-2 px-1">NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code>{" "}
        to the environment, then restart. See the README for step-by-step instructions.
      </p>
    </main>
  );
}
