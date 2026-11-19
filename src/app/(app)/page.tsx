import { EmptyState } from "@/components/empty-state";
import { IconDashboard } from "@/components/icons";
import { PageHeader } from "@/components/page-header";
import { requireMembership } from "@/lib/auth";

export default async function DashboardPage() {
  const { profile, team } = await requireMembership();
  const firstName = profile.full_name.split(" ")[0];
  return (
    <>
      <PageHeader subtitle={team.name} title={`Hi, ${firstName}`} />
      <EmptyState icon={<IconDashboard className="h-7 w-7" />} title="Your team dashboard">
        Every project&apos;s status, progress and latest update will appear here as a table you can
        share to WhatsApp.
      </EmptyState>
    </>
  );
}
