import "server-only";
import { createClient } from "@/lib/supabase/server";
import { formatDateTimeUTC, relativeTime } from "@/lib/format";
import type { LogEntry, Person, TimelineEntry } from "@/lib/types";

export const PHOTO_BUCKET = "log-photos";
const PAGE_SIZE = 50;

type Row = Omit<LogEntry, "photos"> & {
  log_photos: { id: string; storage_path: string; width: number | null; height: number | null }[];
};

/** Newest-first updates for a project, with short-lived photo URLs. */
export async function getLogs(projectId: string): Promise<LogEntry[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("progress_logs")
    .select(
      "id, body, status, progress, created_at, edited_at, author:profiles!progress_logs_author_id_fkey(id, full_name), log_photos(id, storage_path, width, height, created_at)",
    )
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .order("created_at", { referencedTable: "log_photos", ascending: true })
    .limit(PAGE_SIZE);
  if (error) throw error;
  const rows = (data ?? []) as unknown as Row[];

  const paths = rows.flatMap((r) => r.log_photos.map((p) => p.storage_path));
  const urls = new Map<string, string>();
  if (paths.length) {
    const { data: signed } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrls(paths, 60 * 60);
    for (const s of signed ?? []) if (s.path && s.signedUrl) urls.set(s.path, s.signedUrl);
  }

  return rows.map(({ log_photos, ...log }) => ({
    ...log,
    author: log.author as Person | null,
    photos: log_photos
      .filter((p) => urls.has(p.storage_path))
      .map((p) => ({ ...p, url: urls.get(p.storage_path)! })),
  }));
}

/** Updates plus display labels ("3 hours ago", UTC fallback time). */
export async function getTimeline(projectId: string): Promise<TimelineEntry[]> {
  const logs = await getLogs(projectId);
  const now = Date.now();
  return logs.map((l) => ({
    ...l,
    relative: relativeTime(l.created_at, now),
    fallbackTime: formatDateTimeUTC(l.created_at),
  }));
}
