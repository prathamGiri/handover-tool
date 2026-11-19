import "server-only";
import { cache } from "react";
import { relativeTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { Membership, Person, Project, ProjectDetail } from "@/lib/types";

const PROJECT_FIELDS =
  "id, team_id, name, description, status, progress, target_date, is_private, created_by, created_at, last_log_at, owner:profiles!projects_owner_id_fkey(id, full_name)";

/** Everyone in the team, sorted by name. */
export const getTeamPeople = cache(async (teamId: string): Promise<Person[]> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("team_members")
    .select("profiles(id, full_name)")
    .eq("team_id", teamId);
  return ((data ?? []) as unknown as { profiles: Person | null }[])
    .map((r) => r.profiles)
    .filter((p): p is Person => Boolean(p))
    .sort((a, b) => a.full_name.localeCompare(b.full_name));
});

/** Projects the current user can see (RLS hides private ones they aren't in). */
export type ProjectListItem = Project & { updatedLabel: string };

export async function getProjects(teamId: string): Promise<ProjectListItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .select(PROJECT_FIELDS)
    .eq("team_id", teamId)
    .order("last_log_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  const now = Date.now();
  return ((data ?? []) as unknown as Project[]).map((p) => ({
    ...p,
    updatedLabel: p.last_log_at ? `Updated ${relativeTime(p.last_log_at, now)}` : "No updates yet",
  }));
}

export async function getProject(id: string): Promise<ProjectDetail | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("projects")
    .select(
      `${PROJECT_FIELDS}, creator:profiles!projects_created_by_fkey(id, full_name), project_members(profiles(id, full_name))`,
    )
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  const row = data as unknown as Project & {
    creator: Person | null;
    project_members: { profiles: Person | null }[];
  };
  const { project_members, ...rest } = row;
  return {
    ...rest,
    members: project_members
      .map((m) => m.profiles)
      .filter((p): p is Person => Boolean(p))
      .sort((a, b) => a.full_name.localeCompare(b.full_name)),
  };
}

/** Creator, owner and team admins can change a project's settings. */
export function canManage(project: Pick<Project, "created_by" | "owner">, m: Membership) {
  return m.role === "admin" || project.created_by === m.user.id || project.owner?.id === m.user.id;
}
