import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { IconFolder } from "@/components/icons";
import { PageHeader } from "@/components/page-header";
import { requireMembership } from "@/lib/auth";
import { getProjects } from "@/lib/projects";
import { LogComposer } from "./log-composer";

export default async function LogPage({ searchParams }: PageProps<"/log">) {
  const { team } = await requireMembership();
  const { project } = await searchParams;
  const projects = (await getProjects(team.id))
    .filter((p) => p.status !== "done" || p.id === project)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(({ id, name, status, progress, is_private }) => ({ id, name, status, progress, is_private }));
  const wanted = typeof project === "string" && projects.some((p) => p.id === project) ? project : null;

  return (
    <>
      <PageHeader title="Post an update" />
      {projects.length ? (
        <LogComposer key={wanted ?? "none"} projects={projects} initialProjectId={wanted} />
      ) : (
        <EmptyState icon={<IconFolder className="h-7 w-7" />} title="No active projects">
          <p>Create a project first, then post updates on it here.</p>
          <Link href="/projects/new" className="btn-primary mt-5 w-full">Create a project</Link>
        </EmptyState>
      )}
    </>
  );
}
