import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { IconFolder, IconPlus } from "@/components/icons";
import { PageHeader } from "@/components/page-header";
import { requireMembership } from "@/lib/auth";
import { getProjects } from "@/lib/projects";
import { ProjectList } from "./project-list";

export default async function ProjectsPage() {
  const { team, user } = await requireMembership();
  const projects = await getProjects(team.id);

  return (
    <>
      <PageHeader
        subtitle={team.name}
        title="Projects"
        action={
          <Link href="/projects/new" className="btn-primary min-h-10 px-4 text-sm">
            <IconPlus className="h-4 w-4" /> New
          </Link>
        }
      />
      {projects.length ? (
        <ProjectList projects={projects} userId={user.id} />
      ) : (
        <EmptyState icon={<IconFolder className="h-7 w-7" />} title="No projects yet">
          <p>Add the project you&apos;re working on so the team can follow its progress.</p>
          <Link href="/projects/new" className="btn-primary mt-5 w-full">
            Create a project
          </Link>
        </EmptyState>
      )}
    </>
  );
}
