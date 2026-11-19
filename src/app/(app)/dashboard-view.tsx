"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Avatar } from "@/components/avatar";
import { IconLock } from "@/components/icons";
import { ShareButton } from "@/components/share-sheet";
import { ProgressBar } from "@/components/progress-bar";
import { StatusBadge } from "@/components/status-badge";
import type { DashboardRow } from "@/lib/dashboard";
import { SORTS, applyFilters, type DashboardFilters, type SortKey } from "@/lib/dashboard-filters";
import { STATUSES, STATUS_META } from "@/lib/status";
import type { ProjectStatus } from "@/lib/types";

function toQuery(f: DashboardFilters) {
  const q = new URLSearchParams();
  if (f.status) q.set("status", f.status);
  if (f.owner) q.set("owner", f.owner);
  if (f.mine) q.set("mine", "1");
  if (f.sort !== "attention") q.set("sort", f.sort);
  const s = q.toString();
  return s ? `?${s}` : "";
}

export function DashboardView({
  rows,
  userId,
  initial,
  staleDays,
  teamName,
}: {
  rows: DashboardRow[];
  userId: string;
  initial: DashboardFilters;
  staleDays: number;
  teamName: string;
}) {
  const [f, setF] = useState<DashboardFilters>(initial);
  const shown = useMemo(() => applyFilters(rows, f, userId), [rows, f, userId]);

  // Keep filters in the address so refresh / back / sharing a link keeps them.
  useEffect(() => {
    window.history.replaceState(null, "", window.location.pathname + toQuery(f));
  }, [f]);

  const owners = useMemo(() => {
    const m = new Map<string, string>();
    rows.forEach((r) => r.owner && m.set(r.owner.id, r.owner.full_name));
    return [...m].sort((a, b) => a[1].localeCompare(b[1]));
  }, [rows]);

  const count = (s: ProjectStatus) => rows.filter((r) => r.status === s).length;
  const staleCount = rows.filter((r) => r.stale).length;
  const toggleStatus = (s: DashboardFilters["status"]) => setF((p) => ({ ...p, status: p.status === s ? null : s }));
  const filtered = f.status || f.owner || f.mine;

  return (
    <div data-wide className="space-y-4">
      {/* Summary tiles double as filters */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {STATUSES.map((s) => (
          <Tile key={s} label={STATUS_META[s].label} value={count(s)} dot={STATUS_META[s].dot}
            active={f.status === s} onClick={() => toggleStatus(s)} />
        ))}
        <Tile label={`No update ${staleDays}+ days`} value={staleCount} dot="bg-muted"
          active={f.status === "stale"} onClick={() => toggleStatus("stale")}
          className="col-span-2 sm:col-span-1" warn={staleCount > 0} />
      </div>

      <div className="flex items-center gap-2">
        <button type="button" aria-pressed={f.mine} onClick={() => setF((p) => ({ ...p, mine: !p.mine }))}
          className={`min-h-10 shrink-0 rounded-full border px-4 text-sm font-medium ${f.mine ? "border-brand bg-brand text-brand-ink" : "border-border bg-surface text-muted"}`}>
          Mine
        </button>
        <label className="sr-only" htmlFor="owner-filter">Owner</label>
        <select id="owner-filter" value={f.owner ?? ""} onChange={(e) => setF((p) => ({ ...p, owner: e.target.value || null }))}
          className="min-h-10 min-w-0 flex-1 rounded-full border border-border bg-surface px-3 text-sm text-text md:max-w-56 md:flex-none">
          <option value="">Everyone</option>
          {owners.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select>
        <label className="sr-only" htmlFor="sort">Sort by</label>
        <select id="sort" value={f.sort} onChange={(e) => setF((p) => ({ ...p, sort: e.target.value as SortKey }))}
          className="min-h-10 min-w-0 flex-1 rounded-full border border-border bg-surface px-3 text-sm text-text md:ml-auto md:max-w-56 md:flex-none">
          {Object.entries(SORTS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted" aria-live="polite">
          {shown.length === rows.length ? `${rows.length} projects` : `${shown.length} of ${rows.length} projects`}
          {filtered && (
            <button type="button" className="ml-2 font-medium text-brand"
              onClick={() => setF((p) => ({ ...p, status: null, owner: null, mine: false }))}>
              Clear filters
            </button>
          )}
        </p>
        {shown.length > 0 && <ShareButton rows={shown} filters={f} teamName={teamName} staleDays={staleDays} />}
      </div>

      {shown.length === 0 ? (
        <p className="card px-4 py-10 text-center text-sm text-muted">No projects match these filters.</p>
      ) : (
        <>
          <ul className="space-y-3 md:hidden">
            {shown.map((r) => <Card key={r.id} r={r} />)}
          </ul>
          <DashboardTable rows={shown} />
        </>
      )}
    </div>
  );
}

function Tile({ label, value, dot, active, onClick, className = "", warn }: {
  label: string; value: number; dot: string; active: boolean; onClick: () => void; className?: string; warn?: boolean;
}) {
  return (
    <button type="button" aria-pressed={active} onClick={onClick}
      className={`card flex items-center justify-between gap-2 p-3 text-left transition ${active ? "border-brand ring-2 ring-brand/30" : ""} ${className}`}>
      <span className="flex min-w-0 items-center gap-2 text-sm text-muted">
        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${dot}`} aria-hidden />
        <span className="truncate">{label}</span>
      </span>
      <span className={`text-xl font-bold tabular-nums ${warn ? "text-warn" : ""}`}>{value}</span>
    </button>
  );
}

function StaleTag({ r }: { r: DashboardRow }) {
  if (!r.stale) return null;
  return (
    <span className="inline-flex items-center rounded-full bg-warn/15 px-2 py-0.5 text-xs font-semibold text-warn">
      No update in {r.daysSinceUpdate} days
    </span>
  );
}

function Card({ r }: { r: DashboardRow }) {
  return (
    <li>
      <Link href={`/projects/${r.id}`} className="card relative block overflow-hidden p-4 pl-5 active:bg-surface-2">
        <span className={`absolute inset-y-0 left-0 w-1.5 ${STATUS_META[r.status].dot}`} aria-hidden />
        <div className="flex items-start justify-between gap-3">
          <h2 className="min-w-0 font-semibold leading-snug">
            {r.is_private && <IconLock className="mr-1 inline h-4 w-4 -translate-y-px text-muted" />}
            {r.name}
          </h2>
          <StatusBadge status={r.status} />
        </div>
        <div className="mt-3 flex items-center gap-3">
          <ProgressBar value={r.progress} status={r.status} />
          <span className="w-10 shrink-0 text-right text-sm font-semibold tabular-nums">{r.progress}%</span>
        </div>
        {r.latest ? (
          <p className="mt-3 line-clamp-2 text-sm">
            <span className="font-medium">{r.latest.author?.split(" ")[0] ?? "Someone"}:</span> {r.latest.body}
          </p>
        ) : (
          <p className="mt-3 text-sm text-muted">No updates yet</p>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted">
          {r.owner && (
            <span className="flex items-center gap-1.5">
              <Avatar id={r.owner.id} name={r.owner.full_name} size={18} />
              {r.owner.full_name}
            </span>
          )}
          {r.last_log_at && <span>{r.updatedLabel}</span>}
          {r.targetLabel && (
            <span className={r.overdue ? "font-semibold text-danger" : ""}>
              {r.overdue ? "Overdue · " : "Due "}{r.targetLabel}
            </span>
          )}
          <StaleTag r={r} />
        </div>
      </Link>
    </li>
  );
}

function DashboardTable({ rows }: { rows: DashboardRow[] }) {
  return (
    <div className="card hidden overflow-x-auto md:block">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-border text-xs uppercase tracking-wide text-muted">
          <tr>
            <th scope="col" className="px-4 py-3 font-semibold">Project</th>
            <th scope="col" className="px-4 py-3 font-semibold">Owner</th>
            <th scope="col" className="px-4 py-3 font-semibold">Status</th>
            <th scope="col" className="w-36 px-4 py-3 font-semibold">Progress</th>
            <th scope="col" className="px-4 py-3 font-semibold">Latest update</th>
            <th scope="col" className="px-4 py-3 font-semibold">Updated</th>
            <th scope="col" className="px-4 py-3 font-semibold">Target</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((r) => (
            <tr key={r.id} className="relative hover:bg-surface-2">
              <td className="px-4 py-3 font-semibold">
                <Link href={`/projects/${r.id}`} className="after:absolute after:inset-0">
                  {r.is_private && <IconLock className="mr-1 inline h-3.5 w-3.5 -translate-y-px text-muted" />}
                  {r.name}
                </Link>
              </td>
              <td className="whitespace-nowrap px-4 py-3">
                {r.owner ? (
                  <span className="flex items-center gap-2">
                    <Avatar id={r.owner.id} name={r.owner.full_name} size={22} />
                    {r.owner.full_name}
                  </span>
                ) : <span className="text-muted">—</span>}
              </td>
              <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <ProgressBar value={r.progress} status={r.status} />
                  <span className="w-9 text-right font-semibold tabular-nums">{r.progress}%</span>
                </div>
              </td>
              <td className="max-w-xs px-4 py-3">
                {r.latest ? <p className="line-clamp-2">{r.latest.body}</p> : <span className="text-muted">No updates yet</span>}
              </td>
              <td className="whitespace-nowrap px-4 py-3">
                <span className={r.stale ? "font-semibold text-warn" : "text-muted"}>{r.updatedLabel}</span>
              </td>
              <td className={`whitespace-nowrap px-4 py-3 ${r.overdue ? "font-semibold text-danger" : "text-muted"}`}>
                {r.targetLabel || "—"}{r.overdue && " (overdue)"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
