import Link from "next/link";
import { notFound } from "next/navigation";
import { Avatar } from "@/components/avatar";
import { BackLink } from "@/components/back-link";
import { EmptyState } from "@/components/empty-state";
import { IconCamera, IconLock, IconPlus } from "@/components/icons";
import { ProgressBar } from "@/components/progress-bar";
import { ShareProject } from "@/components/share-project";
import { StatusBadge } from "@/components/status-badge";
import { requireMembership } from "@/lib/auth";
import { formatDate, isPast, relativeTime } from "@/lib/format";
import { getTimeline } from "@/lib/logs";
import { canManage, getProject } from "@/lib/projects";
import { Timeline } from "./timeline";

export default async function ProjectPage({ params, searchParams }: PageProps<"/projects/[id]">) {
  const { id } = await params;
  const { posted } = await searchParams;
  const m = await requireMembership();
  const project = await getProject(id);
  if (!project) notFound();
  const entries = await getTimeline(project.id);

  const manage = canManage(project, m);
  const overdue = project.status !== "done" && isPast(project.target_date);
  const people = project.is_private
    ? [project.creator, project.owner, ...project.members].filter(
        (p, i, all): p is NonNullable<typeof p> => Boolean(p) && all.findIndex((q) => q?.id === p!.id) === i,
      )
    : [];

  return (
    <>
      <div className="flex items-center justify-between">
        <BackLink href="/projects" label="Projects" />
        <div className="flex items-center gap-4">
          <ShareProject
            name={project.name}
            status={project.status}
            progress={project.progress}
            owner={project.owner?.full_name ?? null}
            latest={entries[0]?.body ?? null}
            updated={entries[0]?.relative ?? null}
            path={`/projects/${project.id}`}
          />
          {manage && (
            <Link href={`/projects/${project.id}/edit`} className="min-h-10 pt-4 text-sm font-semibold text-brand">
              Edit
            </Link>
          )}
        </div>
      </div>

      <header className="pb-4 pt-2">
        {project.is_private && (
          <span className="mb-2 inline-flex items-center gap-1 rounded-full bg-surface-2 px-2.5 py-1 text-xs font-medium text-muted">
            <IconLock className="h-3.5 w-3.5" /> Private
          </span>
        )}
        <h1 className="text-2xl font-bold tracking-tight">{project.name}</h1>
        {project.description && (
          <p className="mt-2 whitespace-pre-line text-muted">{project.description}</p>
        )}
      </header>

      <section className="card space-y-4 p-4">
        <div className="flex items-center justify-between">
          <StatusBadge status={project.status} />
          <span className="text-2xl font-bold tabular-nums">{project.progress}%</span>
        </div>
        <ProgressBar value={project.progress} status={project.status} />
        <dl className="grid grid-cols-2 gap-4 border-t border-border pt-4 text-sm">
          <div>
            <dt className="text-muted">Owner</dt>
            <dd className="mt-1 flex items-center gap-2 font-medium">
              {project.owner ? (
                <>
                  <Avatar id={project.owner.id} name={project.owner.full_name} size={24} />
                  <span className="truncate">{project.owner.full_name}</span>
                </>
              ) : (
                "No owner"
              )}
            </dd>
          </div>
          <div>
            <dt className="text-muted">Target date</dt>
            <dd className={`mt-1 font-medium ${overdue ? "text-danger" : ""}`}>
              {project.target_date ? formatDate(project.target_date) : "Not set"}
              {overdue && " · overdue"}
            </dd>
          </div>
          <div>
            <dt className="text-muted">Last update</dt>
            <dd className="mt-1 font-medium">
              {project.last_log_at ? relativeTime(project.last_log_at) : "None yet"}
            </dd>
          </div>
          <div>
            <dt className="text-muted">Created</dt>
            <dd className="mt-1 font-medium">
              {formatDate(project.created_at.slice(0, 10))}
              {project.creator && project.creator.id !== project.owner?.id && (
                <span className="block truncate font-normal text-muted">by {project.creator.full_name}</span>
              )}
            </dd>
          </div>
        </dl>
      </section>

      {project.is_private && (
        <section className="card mt-4 p-4">
          <h2 className="font-semibold">Who can see this</h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {people.map((p) => (
              <li key={p.id} className="flex items-center gap-2 rounded-full bg-surface-2 py-1 pl-1 pr-3 text-sm">
                <Avatar id={p.id} name={p.full_name} size={24} />
                {p.full_name}
              </li>
            ))}
          </ul>
        </section>
      )}

      {posted && (
        <p role="status" className="mt-4 rounded-xl bg-ok/12 px-4 py-3 text-sm font-medium text-ok">
          ✓ Update posted
        </p>
      )}

      <div className="mb-3 mt-6 flex items-center justify-between">
        <h2 className="font-semibold">
          Updates {entries.length > 0 && <span className="font-normal text-muted">({entries.length})</span>}
        </h2>
        <Link href={`/log?project=${project.id}`} className="btn-primary min-h-10 px-4 text-sm">
          <IconPlus className="h-4 w-4" /> Post update
        </Link>
      </div>
      {entries.length ? (
        <Timeline entries={entries} userId={m.user.id} isAdmin={m.role === "admin"} />
      ) : (
        <EmptyState icon={<IconCamera className="h-7 w-7" />} title="No updates yet">
          Post the first update: what changed, what&apos;s next, and a photo if it helps.
        </EmptyState>
      )}
    </>
  );
}
