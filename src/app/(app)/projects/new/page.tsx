import { BackLink } from "@/components/back-link";
import { PageHeader } from "@/components/page-header";
import { requireMembership } from "@/lib/auth";
import { getTeamPeople } from "@/lib/projects";
import { createProject } from "../actions";
import { ProjectForm } from "../project-form";

export default async function NewProjectPage() {
  const { team, user } = await requireMembership();
  const people = await getTeamPeople(team.id);
  return (
    <>
      <BackLink href="/projects" label="Projects" />
      <PageHeader title="New project" />
      <ProjectForm mode="create" action={createProject} people={people} userId={user.id} />
    </>
  );
}
