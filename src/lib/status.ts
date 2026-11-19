import type { ProjectStatus } from "./types";

export const STATUSES: ProjectStatus[] = ["on_track", "at_risk", "blocked", "done"];

export const STATUS_META: Record<
  ProjectStatus,
  { label: string; emoji: string; className: string; dot: string }
> = {
  on_track: { label: "On track", emoji: "🟢", className: "bg-ok/12 text-ok", dot: "bg-ok" },
  at_risk: { label: "At risk", emoji: "🟡", className: "bg-warn/15 text-warn", dot: "bg-warn" },
  blocked: { label: "Blocked", emoji: "🔴", className: "bg-danger/12 text-danger", dot: "bg-danger" },
  done: { label: "Done", emoji: "✅", className: "bg-brand-soft text-brand", dot: "bg-brand" },
};

export function isStatus(v: unknown): v is ProjectStatus {
  return typeof v === "string" && (STATUSES as string[]).includes(v);
}
