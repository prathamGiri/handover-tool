import { EmptyState } from "@/components/empty-state";
import { IconFolder } from "@/components/icons";
import { PageHeader } from "@/components/page-header";
import { requireMembership } from "@/lib/auth";

export default async function ProjectsPage() {
  const { team } = await requireMembership();
  return (
    <>
      <PageHeader subtitle={team.name} title="Projects" />
      <EmptyState icon={<IconFolder className="h-7 w-7" />} title="No projects yet">
        Creating projects, and keeping some private, is coming in the next update.
      </EmptyState>
    </>
  );
}
