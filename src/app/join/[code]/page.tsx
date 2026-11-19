import Link from "next/link";
import { joinTeam } from "@/app/actions";
import { Logo } from "@/components/logo";
import { SubmitButton } from "@/components/submit-button";
import { createClient } from "@/lib/supabase/server";

export default async function JoinPage({ params, searchParams }: PageProps<"/join/[code]">) {
  const { code } = await params;
  const { error } = await searchParams;
  const supabase = await createClient();
  const [{ data: teamName }, { data: auth }] = await Promise.all([
    supabase.rpc("invite_preview", { p_code: code }),
    supabase.auth.getUser(),
  ]);

  return (
    <div className="pt-safe pb-safe">
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-10">
      <Logo size={56} />
      {teamName ? (
        <>
          <p className="mt-6 text-muted">You&apos;ve been invited to join</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">{teamName}</h1>
          <p className="mt-3 text-muted">Track and share progress on every project in the team.</p>
          {error && (
            <p role="alert" className="mt-4 text-sm text-danger">Couldn&apos;t join. Try again.</p>
          )}
          <div className="mt-8">
            {auth.user ? (
              <form action={joinTeam.bind(null, code)}>
                <SubmitButton pendingText="Joining…">Join {teamName}</SubmitButton>
              </form>
            ) : (
              <Link href={`/login?next=${encodeURIComponent(`/join/${code}`)}`} className="btn-primary w-full">
                Sign in to join
              </Link>
            )}
          </div>
        </>
      ) : (
        <>
          <h1 className="mt-6 text-2xl font-bold">This invite link isn&apos;t valid</h1>
          <p className="mt-2 text-muted">It may have been reset. Ask your team admin for a new link.</p>
          <Link href="/" className="btn-secondary mt-8 w-full">Go to Handover</Link>
        </>
      )}
    </main>
    </div>
  );
}
