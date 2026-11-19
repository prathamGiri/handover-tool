import { EmptyState } from "@/components/empty-state";
import { IconCamera } from "@/components/icons";
import { PageHeader } from "@/components/page-header";

export default function LogPage() {
  return (
    <>
      <PageHeader title="Post an update" />
      <EmptyState icon={<IconCamera className="h-7 w-7" />} title="Quick updates are coming">
        Soon you&apos;ll pick a project, type what changed, snap a photo and post. The time is
        recorded automatically.
      </EmptyState>
    </>
  );
}
