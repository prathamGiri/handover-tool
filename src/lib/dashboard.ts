import "server-only";
import { formatDate, isPast, relativeTime } from "@/lib/format";
import { getProjects } from "@/lib/projects";
import { createClient } from "@/lib/supabase/server";
import type { Project } from "@/lib/types";

/** Projects with no update for this many days are flagged. */
export const STALE_DAYS = 3;

export type DashboardRow = Project & {
  latest: { body: string; author: string | null; created_at: string } | null;
  updatedLabel: string;
  daysSinceUpdate: number;
  stale: boolean;
  targetLabel: string;
  overdue: boolean;
};

export async function getDashboard(teamId: string): Promise<DashboardRow[]> {
  const projects = await getProjects(teamId);
  if (!projects.length) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from("project_latest_logs")
    .select("project_id, body, created_at, author_name")
    .in(
      "project_id",
      projects.map((p) => p.id),
    );
  const latest = new Map(
    (data ?? []).map((l) => [
      l.project_id as string,
      { body: l.body as string, author: (l.author_name as string | null) || null, created_at: l.created_at as string },
    ]),
  );

  const now = Date.now();
  return projects.map((p) => {
    const since = p.last_log_at ?? p.created_at;
    const daysSinceUpdate = Math.floor((now - new Date(since).getTime()) / 86_400_000);
    return {
      ...p,
      latest: latest.get(p.id) ?? null,
      updatedLabel: p.last_log_at ? relativeTime(p.last_log_at, now) : "Never",
      daysSinceUpdate,
      stale: p.status !== "done" && daysSinceUpdate >= STALE_DAYS,
      targetLabel: p.target_date ? formatDate(p.target_date) : "",
      overdue: p.status !== "done" && isPast(p.target_date),
    };
  });
}
