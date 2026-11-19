import { STATUS_META } from "@/lib/status";
import type { ProjectStatus } from "@/lib/types";

export function ProgressBar({ value, status }: { value: number; status: ProjectStatus }) {
  return (
    <div
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`${value}% complete`}
      className="h-2 w-full overflow-hidden rounded-full bg-surface-2"
    >
      <div className={`h-full rounded-full ${STATUS_META[status].dot}`} style={{ width: `${value}%` }} />
    </div>
  );
}
