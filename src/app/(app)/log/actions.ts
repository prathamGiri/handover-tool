"use server";

import { revalidatePath } from "next/cache";
import { requireMembership } from "@/lib/auth";
import { MAX_PHOTOS } from "@/lib/limits";
import { PHOTO_BUCKET } from "@/lib/logs";
import { isStatus } from "@/lib/status";
import { createClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type NewLog = {
  id: string;
  projectId: string;
  body: string;
  status: string | null;
  progress: number | null;
  photos: { path: string; width: number; height: number }[];
};

export type LogResult = { ok: true } | { ok: false; error: string };

/**
 * Photos are uploaded by the browser first (to <project>/<log id>/...), then
 * this records the update and links the photos. The database sets the time
 * and author.
 */
export async function createLog(input: NewLog): Promise<LogResult> {
  await requireMembership();
  const body = String(input.body ?? "").trim();
  if (!UUID.test(input.id) || !UUID.test(input.projectId)) return { ok: false, error: "Pick a project." };
  if (!body) return { ok: false, error: "Write what changed." };
  if (body.length > 5000) return { ok: false, error: "Update is too long (5000 characters max)." };
  if (input.status !== null && !isStatus(input.status)) return { ok: false, error: "Pick a valid status." };
  if (
    input.progress !== null &&
    (!Number.isInteger(input.progress) || input.progress < 0 || input.progress > 100)
  )
    return { ok: false, error: "Progress must be between 0 and 100." };
  const photos = input.photos ?? [];
  if (photos.length > MAX_PHOTOS) return { ok: false, error: `Up to ${MAX_PHOTOS} photos per update.` };
  const prefix = `${input.projectId}/${input.id}/`;
  if (photos.some((p) => !p.path.startsWith(prefix) || p.path.includes("..")))
    return { ok: false, error: "Photo upload failed. Try again." };

  const supabase = await createClient();
  const { error } = await supabase.from("progress_logs").insert({
    id: input.id,
    project_id: input.projectId,
    body,
    status: input.status,
    progress: input.progress,
  });
  if (error) {
    return {
      ok: false,
      error:
        error.code === "42501"
          ? "You don't have access to post on this project."
          : "Couldn't post the update. Check your connection and try again.",
    };
  }

  if (photos.length) {
    const { error: photoError } = await supabase.from("log_photos").insert(
      photos.map((p) => ({
        log_id: input.id,
        storage_path: p.path,
        width: Math.round(p.width) || null,
        height: Math.round(p.height) || null,
      })),
    );
    if (photoError) return { ok: false, error: "Update posted, but attaching photos failed." };
  }

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function updateLog(logId: string, body: string): Promise<LogResult> {
  await requireMembership();
  const text = String(body ?? "").trim();
  if (!UUID.test(logId)) return { ok: false, error: "Update not found." };
  if (!text) return { ok: false, error: "Update can't be empty." };
  if (text.length > 5000) return { ok: false, error: "Update is too long." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("progress_logs")
    .update({ body: text })
    .eq("id", logId)
    .select("id");
  if (error || !data?.length) return { ok: false, error: "Only the author can edit an update." };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deleteLog(logId: string): Promise<LogResult> {
  await requireMembership();
  if (!UUID.test(logId)) return { ok: false, error: "Update not found." };
  const supabase = await createClient();
  const { data: photos } = await supabase.from("log_photos").select("storage_path").eq("log_id", logId);
  const { data, error } = await supabase.from("progress_logs").delete().eq("id", logId).select("id");
  if (error || !data?.length) return { ok: false, error: "Only the author or an admin can delete it." };
  if (photos?.length) {
    // Best effort: storage only lets the uploader remove their files.
    await supabase.storage.from(PHOTO_BUCKET).remove(photos.map((p) => p.storage_path));
  }
  revalidatePath("/", "layout");
  return { ok: true };
}
