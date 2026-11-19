"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type ActionState = { error?: string; ok?: boolean } | undefined;

function text(form: FormData, key: string) {
  return String(form.get(key) ?? "").trim();
}

/** Accepts either a raw invite code or a full invite link. */
function parseInviteCode(input: string) {
  const match = input.match(/join\/([a-z0-9]+)/i);
  return (match ? match[1] : input).trim().toLowerCase();
}

async function saveName(name: string) {
  const user = await requireUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ full_name: name })
    .eq("id", user.id);
  return error;
}

export async function completeOnboarding(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const name = text(form, "full_name");
  const mode = text(form, "mode");
  if (!name) return { error: "Please enter your name." };
  if (name.length > 80) return { error: "Name is too long." };

  const nameError = await saveName(name);
  if (nameError) return { error: "Couldn't save your name. Try again." };

  const supabase = await createClient();

  if (mode === "skip") {
    // Already in a team: only the name was missing.
  } else if (mode === "create") {
    const teamName = text(form, "team_name");
    if (!teamName) return { error: "Please enter a team name." };
    const { error } = await supabase.rpc("create_team", { p_name: teamName });
    if (error) return { error: "Couldn't create the team. Try again." };
  } else {
    const code = parseInviteCode(text(form, "invite_code"));
    if (!code) return { error: "Paste the invite link or code you received." };
    const { error } = await supabase.rpc("join_team", { p_code: code });
    if (error) return { error: "That invite link isn't valid. Ask your team for a new one." };
  }

  revalidatePath("/", "layout");
  redirect("/");
}

export async function joinTeam(code: string) {
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.rpc("join_team", { p_code: code });
  if (error) redirect(`/join/${code}?error=1`);
  revalidatePath("/", "layout");
  redirect("/");
}

export async function updateProfile(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const name = text(form, "full_name");
  if (!name) return { error: "Name can't be empty." };
  if (name.length > 80) return { error: "Name is too long." };
  const error = await saveName(name);
  if (error) return { error: "Couldn't save. Try again." };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function resetInviteLink(teamId: string) {
  const supabase = await createClient();
  await supabase.rpc("regenerate_invite_code", { p_team: teamId });
  revalidatePath("/profile");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
