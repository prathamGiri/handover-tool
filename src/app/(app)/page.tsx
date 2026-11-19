import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { IconDashboard, IconPlus } from "@/components/icons";
import { PageHeader } from "@/components/page-header";
import { requireMembership } from "@/lib/auth";
import { STALE_DAYS, getDashboard } from "@/lib/dashboard";
import { parseFilters } from "@/lib/dashboard-filters";
import { DashboardView } from "./dashboard-view";

export default async function DashboardPage({ searchParams }: PageProps<"/">) {
  const { profile, team, user } = await requireMembership();
  const rows = await getDashboard(team.id);
  const firstName = profile.full_name.split(" ")[0];

  return (
    <>
      <PageHeader
        subtitle={team.name}
        title={`Hi, ${firstName}`}
        action={
          rows.length ? (
            <Link href="/log" className="btn-primary min-h-10 px-4 text-sm">
              <IconPlus className="h-4 w-4" /> Update
            </Link>
          ) : undefined
        }
      />
      {rows.length ? (
        <DashboardView rows={rows} userId={user.id} initial={parseFilters(await searchParams)} staleDays={STALE_DAYS} teamName={team.name} />
      ) : (
        <EmptyState icon={<IconDashboard className="h-7 w-7" />} title="Your team dashboard">
          Every project&apos;s status, progress and latest update will appear here, ready to share to WhatsApp.
          <Link href="/projects/new" className="btn-primary mt-5 w-full">Add a project</Link>
        </EmptyState>
      )}
    </>
  );
}
