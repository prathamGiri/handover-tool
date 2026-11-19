"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireMembership } from "@/lib/auth";
import { getTeamPeople } from "@/lib/projects";
import { isStatus } from "@/lib/status";
import { createClient } from "@/lib/supabase/server";

export type ProjectFormState = { error?: string } | undefined;

type Parsed = {
  name: string;
  description: string;
  owner_id: string;
  target_date: string | null;
  is_private: boolean;
  members: string[];
};

async function parse(form: FormData): Promise<{ data?: Parsed; error?: string }> {
  const m = await requireMembership();
  const people = new Set((await getTeamPeople(m.team.id)).map((p) => p.id));

  const name = String(form.get("name") ?? "").trim();
  const description = String(form.get("description") ?? "").trim();
  const owner_id = String(form.get("owner_id") ?? "") || m.user.id;
  const target = String(form.get("target_date") ?? "").trim();
  const is_private = form.get("is_private") === "on";
  const members = [...new Set(form.getAll("members").map(String))].filter((id) => people.has(id));

  if (!name) return { error: "Give the project a name." };
  if (name.length > 120) return { error: "Project name is too long (120 characters max)." };
  if (description.length > 2000) return { error: "Description is too long (2000 characters max)." };
  if (!people.has(owner_id)) return { error: "Pick an owner from your team." };
  if (target && !/^\d{4}-\d{2}-\d{2}$/.test(target)) return { error: "Target date isn't valid." };

  return {
    data: { name, description, owner_id, target_date: target || null, is_private, members },
  };
}

/** Make the private member list match `wanted` (no-op for public projects). */
async function syncMembers(projectId: string, isPrivate: boolean, wanted: string[]) {
  const supabase = await createClient();
  if (!isPrivate) {
    await supabase.from("project_members").delete().eq("project_id", projectId);
    return null;
  }
  const { data: current } = await supabase
    .from("project_members")
    .select("user_id")
    .eq("project_id", projectId);
  const have = new Set((current ?? []).map((r) => r.user_id as string));
  const want = new Set(wanted);
  const toRemove = [...have].filter((id) => !want.has(id));
  const toAdd = [...want].filter((id) => !have.has(id));
  if (toRemove.length) {
    const { error } = await supabase
      .from("project_members")
      .delete()
      .eq("project_id", projectId)
      .in("user_id", toRemove);
    if (error) return error;
  }
  if (toAdd.length) {
    const { error } = await supabase
      .from("project_members")
      .insert(toAdd.map((user_id) => ({ project_id: projectId, user_id })));
    if (error) return error;
  }
  return null;
}

export async function createProject(
  _prev: ProjectFormState,
  form: FormData,
): Promise<ProjectFormState> {
  const m = await requireMembership();
  const { data, error } = await parse(form);
  if (!data) return { error };

  const status = String(form.get("status") ?? "on_track");
  const progress = Math.round(Number(form.get("progress") ?? 0));
  if (!isStatus(status)) return { error: "Pick a status." };
  if (!Number.isFinite(progress) || progress < 0 || progress > 100)
    return { error: "Progress must be between 0 and 100." };

  const supabase = await createClient();
  const { data: row, error: insertError } = await supabase
    .from("projects")
    .insert({
      team_id: m.team.id,
      name: data.name,
      description: data.description,
      owner_id: data.owner_id,
      target_date: data.target_date,
      is_private: data.is_private,
      status,
      progress,
    })
    .select("id")
    .single();
  if (insertError || !row) return { error: "Couldn't create the project. Try again." };

  const memberError = await syncMembers(row.id, data.is_private, data.members);
  if (memberError) return { error: "Project created, but adding members failed. Edit it to retry." };

  revalidatePath("/", "layout");
  redirect(`/projects/${row.id}`);
}

export async function updateProject(
  projectId: string,
  _prev: ProjectFormState,
  form: FormData,
): Promise<ProjectFormState> {
  await requireMembership();
  const { data, error } = await parse(form);
  if (!data) return { error };

  const supabase = await createClient();
  const { data: updated, error: updateError } = await supabase
    .from("projects")
    .update({
      name: data.name,
      description: data.description,
      owner_id: data.owner_id,
      target_date: data.target_date,
      is_private: data.is_private,
    })
    .eq("id", projectId)
    .select("id");
  if (updateError) return { error: "Couldn't save changes. Try again." };
  if (!updated?.length)
    return { error: "Only the project's creator, owner or a team admin can edit it." };

  const memberError = await syncMembers(projectId, data.is_private, data.members);
  if (memberError) return { error: "Saved, but updating members failed. Try again." };

  revalidatePath("/", "layout");
  redirect(`/projects/${projectId}`);
}

export async function deleteProject(projectId: string) {
  await requireMembership();
  const supabase = await createClient();
  await supabase.from("projects").delete().eq("id", projectId);
  revalidatePath("/", "layout");
  redirect("/projects");
}
