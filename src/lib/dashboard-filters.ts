import type { DashboardRow } from "@/lib/dashboard";
import { STATUSES } from "@/lib/status";
import type { ProjectStatus } from "@/lib/types";

export type DashboardFilters = {
  status: ProjectStatus | "stale" | null;
  owner: string | null;
  mine: boolean;
  sort: SortKey;
};

export const SORTS = {
  attention: "Priority",
  recent: "Latest",
  target: "Due date",
  name: "Name",
} as const;
export type SortKey = keyof typeof SORTS;

const RANK: Record<ProjectStatus, number> = { blocked: 0, at_risk: 1, on_track: 2, done: 3 };

export function parseFilters(sp: Record<string, string | string[] | undefined>): DashboardFilters {
  const one = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : null);
  const status = one("status");
  const sort = one("sort");
  return {
    status: status === "stale" || (STATUSES as string[]).includes(status ?? "") ? (status as DashboardFilters["status"]) : null,
    owner: one("owner"),
    mine: one("mine") === "1",
    sort: sort && sort in SORTS ? (sort as SortKey) : "attention",
  };
}

export function applyFilters(rows: DashboardRow[], f: DashboardFilters, userId: string): DashboardRow[] {
  const out = rows.filter((r) => {
    if (f.status === "stale" && !r.stale) return false;
    if (f.status && f.status !== "stale" && r.status !== f.status) return false;
    if (f.owner && r.owner?.id !== f.owner) return false;
    if (f.mine && r.owner?.id !== userId && r.created_by !== userId) return false;
    return true;
  });
  const byName = (a: DashboardRow, b: DashboardRow) => a.name.localeCompare(b.name);
  const sorters: Record<SortKey, (a: DashboardRow, b: DashboardRow) => number> = {
    attention: (a, b) =>
      RANK[a.status] - RANK[b.status] || Number(b.stale) - Number(a.stale) || b.daysSinceUpdate - a.daysSinceUpdate || byName(a, b),
    recent: (a, b) => (b.last_log_at ?? "").localeCompare(a.last_log_at ?? "") || byName(a, b),
    target: (a, b) =>
      (a.target_date ?? "9999").localeCompare(b.target_date ?? "9999") || byName(a, b),
    name: byName,
  };
  return out.sort(sorters[f.sort]);
}

