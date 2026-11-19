import { redirect } from "next/navigation";
import { Logo } from "@/components/logo";
import { getMembership, requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { OnboardingForm } from "./onboarding-form";

export default async function OnboardingPage() {
  const user = await requireUser();
  const membership = await getMembership();
  if (membership?.profile.full_name.trim()) redirect("/");

  let currentName = membership?.profile.full_name ?? "";
  if (!membership) {
    const supabase = await createClient();
    const { data } = await supabase.from("profiles").select("full_name").eq("id", user.id).single();
    currentName = data?.full_name ?? "";
  }

  return (
    <div className="pt-safe pb-safe">
    <main className="mx-auto flex max-w-md flex-col px-6 py-10">
      <Logo size={44} />
      <h1 className="mt-6 text-2xl font-bold tracking-tight">Welcome to Handover</h1>
      <p className="mt-2 text-muted">
        {membership
          ? `You're in ${membership.team.name}. Tell your team who you are.`
          : "Set up your profile and join your team."}
      </p>
      <div className="mt-8">
        <OnboardingForm defaultName={currentName} hasTeam={Boolean(membership)} />
      </div>
    </main>
    </div>
  );
}
