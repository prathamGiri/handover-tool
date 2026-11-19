"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Avatar } from "@/components/avatar";
import { IconLock } from "@/components/icons";
import { ProgressBar } from "@/components/progress-bar";
import { StatusBadge } from "@/components/status-badge";
import type { ProjectListItem } from "@/lib/projects";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "mine", label: "Mine" },
  { id: "private", label: "Private" },
] as const;
type Filter = (typeof FILTERS)[number]["id"];

export function ProjectList({ projects, userId }: { projects: ProjectListItem[]; userId: string }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return projects.filter((p) => {
      if (filter === "mine" && p.owner?.id !== userId && p.created_by !== userId) return false;
      if (filter === "private" && !p.is_private) return false;
      if (!q) return true;
      return p.name.toLowerCase().includes(q) || (p.owner?.full_name ?? "").toLowerCase().includes(q);
    });
  }, [projects, query, filter, userId]);

  return (
    <div className="space-y-3">
      <input
        type="search"
        placeholder="Search projects or people"
        aria-label="Search projects"
        className="field"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="flex gap-2" role="group" aria-label="Filter projects">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            aria-pressed={filter === f.id}
            onClick={() => setFilter(f.id)}
            className={`min-h-9 rounded-full border px-4 text-sm font-medium ${
              filter === f.id ? "border-brand bg-brand text-brand-ink" : "border-border bg-surface text-muted"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted">No projects match.</p>
      ) : (
        <ul className="space-y-3">
          {shown.map((p) => (
            <li key={p.id}>
              <Link href={`/projects/${p.id}`} className="card block p-4 active:bg-surface-2">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="min-w-0 font-semibold leading-snug">
                    {p.is_private && (
                      <>
                        <IconLock className="mr-1 inline h-4 w-4 -translate-y-px text-muted" />
                        <span className="sr-only">Private: </span>
                      </>
                    )}
                    {p.name}
                  </h2>
                  <StatusBadge status={p.status} />
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <ProgressBar value={p.progress} status={p.status} />
                  <span className="w-10 shrink-0 text-right text-sm font-semibold tabular-nums">{p.progress}%</span>
                </div>
                <div className="mt-3 flex items-center gap-2 text-sm text-muted">
                  {p.owner && <Avatar id={p.owner.id} name={p.owner.full_name} size={22} />}
                  <span className="min-w-0 flex-1 truncate">{p.owner?.full_name ?? "No owner"}</span>
                  <span className="shrink-0">
                    {p.updatedLabel}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
