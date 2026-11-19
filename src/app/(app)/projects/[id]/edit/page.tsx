import { notFound, redirect } from "next/navigation";
import { BackLink } from "@/components/back-link";
import { PageHeader } from "@/components/page-header";
import { requireMembership } from "@/lib/auth";
import { canManage, getProject, getTeamPeople } from "@/lib/projects";
import { deleteProject, updateProject } from "../../actions";
import { ProjectForm } from "../../project-form";
import { DeleteProject } from "./delete-project";

export default async function EditProjectPage({ params }: PageProps<"/projects/[id]/edit">) {
  const { id } = await params;
  const m = await requireMembership();
  const project = await getProject(id);
  if (!project) notFound();
  if (!canManage(project, m)) redirect(`/projects/${id}`);
  const people = await getTeamPeople(m.team.id);

  return (
    <>
      <BackLink href={`/projects/${id}`} label={project.name} />
      <PageHeader title="Edit project" />
      <ProjectForm
        mode="edit"
        action={updateProject.bind(null, id)}
        people={people}
        userId={m.user.id}
        creatorId={project.created_by}
        initial={{
          name: project.name,
          description: project.description,
          owner_id: project.owner?.id ?? m.user.id,
          target_date: project.target_date ?? "",
          is_private: project.is_private,
          members: project.members.map((p) => p.id),
        }}
      />
      <p className="pb-2 text-center text-sm text-muted">
        Status and progress change when someone posts an update.
      </p>
      <DeleteProject action={deleteProject.bind(null, id)} name={project.name} />
    </>
  );
}
