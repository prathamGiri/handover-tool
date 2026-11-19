import { STATUS_META } from "@/lib/status";
import type { ProjectStatus } from "@/lib/types";

export function StatusBadge({ status }: { status: ProjectStatus }) {
  const s = STATUS_META[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${s.className}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} aria-hidden />
      {s.label}
    </span>
  );
}
