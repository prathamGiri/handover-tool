import { resetInviteLink, signOut } from "@/app/actions";
import { Avatar } from "@/components/avatar";
import { InstallApp } from "@/components/install-app";
import { InviteShare } from "@/components/invite-share";
import { PageHeader } from "@/components/page-header";
import { SubmitButton } from "@/components/submit-button";
import { requireMembership } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Role } from "@/lib/types";
import { ProfileForm } from "./profile-form";

type MemberRow = { role: Role; profiles: { id: string; full_name: string } | null };

export default async function ProfilePage() {
  const { user, profile, team, role } = await requireMembership();
  const supabase = await createClient();
  const { data } = await supabase
    .from("team_members")
    .select("role, profiles(id, full_name)")
    .eq("team_id", team.id)
    .order("joined_at", { ascending: true });
  const members = ((data ?? []) as unknown as MemberRow[]).filter((m) => m.profiles);
  const isAdmin = role === "admin";

  return (
    <>
      <PageHeader title="Profile" />

      <div className="space-y-4">
        <section className="card p-4">
          <div className="flex items-center gap-3">
            <Avatar id={profile.id} name={profile.full_name} size={48} />
            <div className="min-w-0">
              <p className="truncate font-semibold">{profile.full_name}</p>
              <p className="truncate text-sm text-muted">{user.email}</p>
            </div>
          </div>
          <ProfileForm defaultName={profile.full_name} />
        </section>

        <section className="card p-4">
          <div className="flex items-baseline justify-between">
            <h2 className="font-semibold">{team.name}</h2>
            <span className="text-sm text-muted">{members.length} {members.length === 1 ? "member" : "members"}</span>
          </div>
          <p className="mt-3 text-sm text-muted">Invite teammates. Anyone with this link can join the team.</p>
          <div className="mt-3">
            <InviteShare teamName={team.name} path={`/join/${team.invite_code}`} />
          </div>
          {isAdmin && (
            <form action={resetInviteLink.bind(null, team.id)} className="mt-2">
              <SubmitButton className="w-full py-2 text-sm text-muted" pendingText="Resetting…">
                Reset invite link (old link stops working)
              </SubmitButton>
            </form>
          )}

          <ul className="mt-4 divide-y divide-border border-t border-border">
            {members.map((m) => (
              <li key={m.profiles!.id} className="flex items-center gap-3 py-3">
                <Avatar id={m.profiles!.id} name={m.profiles!.full_name || "?"} size={36} />
                <span className="min-w-0 flex-1 truncate">
                  {m.profiles!.full_name || "New member"}
                  {m.profiles!.id === user.id && <span className="text-muted"> (you)</span>}
                </span>
                {m.role === "admin" && (
                  <span className="rounded-full bg-brand-soft px-2 py-0.5 text-xs font-medium text-brand">Admin</span>
                )}
              </li>
            ))}
          </ul>
        </section>

        <InstallApp />

        <form action={signOut}>
          <SubmitButton className="btn-secondary w-full text-danger" pendingText="Signing out…">
            Sign out
          </SubmitButton>
        </form>
      </div>
    </>
  );
}
