import { Logo } from "@/components/logo";
import { LoginForm } from "./login-form";

function safeNext(next: string | string[] | undefined) {
  const value = Array.isArray(next) ? next[0] : next;
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/";
}

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next } = await searchParams;
  return (
    <div className="pt-safe pb-safe">
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-6">
      <div className="flex flex-1 flex-col justify-center py-10">
        <Logo size={56} />
        <h1 className="mt-6 text-3xl font-bold tracking-tight">Handover</h1>
        <p className="mt-2 text-muted">See where every project on your team stands.</p>
        <div className="mt-10">
          <LoginForm next={safeNext(next)} />
        </div>
      </div>
    </main>
    </div>
  );
}
