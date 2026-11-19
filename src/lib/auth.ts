import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Membership, Profile, Role, Team } from "@/lib/types";

/** The signed-in user, or a redirect to /login. */
export const requireUser = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");
  return { id: data.user.id, email: data.user.email ?? "" };
});

/** The user's profile and first team, or null if they haven't joined one. */
export const getMembership = cache(async (): Promise<Membership | null> => {
  const user = await requireUser();
  const supabase = await createClient();

  const [{ data: profile }, { data: memberships }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, avatar_url").eq("id", user.id).single(),
    supabase
      .from("team_members")
      .select("role, joined_at, teams(id, name, invite_code)")
      .eq("user_id", user.id)
      .order("joined_at", { ascending: true })
      .limit(1),
  ]);

  const first = memberships?.[0] as
    | { role: Role; teams: Team | null }
    | undefined;
  if (!profile || !first?.teams) return null;

  return {
    user,
    profile: profile as Profile,
    team: first.teams,
    role: first.role,
  };
});

/** Membership for pages inside the app; sends new users to onboarding. */
export const requireMembership = cache(async (): Promise<Membership> => {
  const m = await getMembership();
  if (!m) redirect("/onboarding");
  if (!m.profile.full_name.trim()) redirect("/onboarding");
  return m;
});
