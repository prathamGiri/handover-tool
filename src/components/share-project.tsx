"use client";

import { STATUS_META } from "@/lib/status";
import type { ProjectStatus } from "@/lib/types";
import { IconWhatsApp } from "./icons";

/** Sends one project's current state and latest update to WhatsApp. */
export function ShareProject({
  name,
  status,
  progress,
  owner,
  latest,
  updated,
  path,
}: {
  name: string;
  status: ProjectStatus;
  progress: number;
  owner: string | null;
  latest: string | null;
  updated: string | null;
  path: string;
}) {
  function share() {
    const s = STATUS_META[status];
    const lines = [`${s.emoji} *${name.replace(/\*/g, "")}* — ${s.label}, ${progress}%${owner ? ` (${owner})` : ""}`];
    if (latest) lines.push("", latest.trim().slice(0, 600), updated ? `_Updated ${updated}_` : "");
    lines.push("", `🔗 ${window.location.origin}${path}`);
    window.open(`https://wa.me/?text=${encodeURIComponent(lines.filter((l, i, a) => l || a[i - 1]).join("\n"))}`, "_blank", "noopener");
  }
  return (
    <button type="button" onClick={share} className="inline-flex min-h-10 items-center gap-1.5 pt-4 text-sm font-semibold text-[#128C7E]">
      <IconWhatsApp className="h-4 w-4" /> Share
    </button>
  );
}
