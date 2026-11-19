/**
 * Builds the WhatsApp text summary and the table image for the dashboard.
 * Runs in the browser so dates use the phone's own time zone.
 */
import type { DashboardRow } from "@/lib/dashboard";
import type { DashboardFilters } from "@/lib/dashboard-filters";
import { STATUSES, STATUS_META } from "@/lib/status";
import type { ProjectStatus } from "@/lib/types";

export type ShareOptions = {
  teamName: string;
  filterLabel: string | null;
  link: string | null;
  staleDays: number;
  date?: Date;
};

const COLORS: Record<ProjectStatus, { fg: string; bg: string }> = {
  on_track: { fg: "#15803d", bg: "#dcfce7" },
  at_risk: { fg: "#b45309", bg: "#fef3c7" },
  blocked: { fg: "#dc2626", bg: "#fee2e2" },
  done: { fg: "#4f46e5", bg: "#e0e7ff" },
};

export function todayLabel(date = new Date()) {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(date);
}

/** Describes active filters in plain words, e.g. "Blocked · Riya Mehta". */
export function describeFilters(f: DashboardFilters, rows: DashboardRow[]): string | null {
  const parts: string[] = [];
  if (f.status === "stale") parts.push("Needs an update");
  else if (f.status) parts.push(STATUS_META[f.status].label);
  if (f.owner) {
    const owner = rows.find((r) => r.owner?.id === f.owner)?.owner?.full_name;
    if (owner) parts.push(owner);
  }
  if (f.mine) parts.push("My projects");
  return parts.length ? parts.join(" · ") : null;
}

function oneLine(text: string, max: number) {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > max ? flat.slice(0, max - 1).trimEnd() + "…" : flat;
}

/** WhatsApp formatting: *bold*, _italic_. */
export function buildShareText(rows: DashboardRow[], o: ShareOptions): string {
  const lines: string[] = [];
  lines.push(`*${o.teamName} – Progress update*`);
  lines.push(`${todayLabel(o.date)} · ${rows.length} ${rows.length === 1 ? "project" : "projects"}${o.filterLabel ? ` · ${o.filterLabel}` : ""}`);

  const counts = STATUSES.map((s) => [s, rows.filter((r) => r.status === s).length] as const).filter(([, n]) => n);
  if (counts.length) lines.push(counts.map(([s, n]) => `${STATUS_META[s].emoji} ${n} ${STATUS_META[s].label.toLowerCase()}`).join("  "));

  for (const r of rows) {
    lines.push("");
    const bits = [`${STATUS_META[r.status].emoji} *${r.name.replace(/\*/g, "")}* — ${r.progress}%`];
    if (r.owner) bits.push(`(${r.owner.full_name})`);
    lines.push(bits.join(" "));
    if (r.latest) lines.push(`   ${oneLine(r.latest.body, 140)}`);
    const meta: string[] = [];
    meta.push(r.last_log_at ? `Updated ${r.updatedLabel}` : "No updates yet");
    if (r.overdue) meta.push(`⚠️ overdue (due ${r.targetLabel})`);
    else if (r.targetLabel && r.status !== "done") meta.push(`due ${r.targetLabel}`);
    lines.push(`   _${meta.join(" · ")}_`);
  }

  const stale = rows.filter((r) => r.stale);
  if (stale.length) {
    lines.push("");
    lines.push(`⏰ No update in ${o.staleDays}+ days: ${stale.map((r) => r.name).join(", ")}`);
  }
  if (o.link) {
    lines.push("");
    lines.push(`🔗 ${o.link}`);
  }
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Image
// ---------------------------------------------------------------------------

const W = 1200;
const PAD = 48;
const FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
const INK = "#0f172a";
const MUTED = "#64748b";
const LINE = "#e2e8f0";

// Column x positions and widths.
const COL = {
  project: { x: PAD, w: 330 },
  status: { x: PAD + 350, w: 150 },
  progress: { x: PAD + 520, w: 180 },
  latest: { x: PAD + 730, w: W - PAD - (PAD + 730) },
};

function font(weight: number, size: number) {
  return `${weight} ${size}px ${FONT}`;
}

/** Splits text into at most `maxLines` lines that fit `width`, adding … if cut. */
function wrap(ctx: CanvasRenderingContext2D, text: string, width: number, maxLines: number): string[] {
  const words = text.replace(/\s+/g, " ").trim().split(" ");
  const lines: string[] = [];
  let line = "";
  for (let i = 0; i < words.length; i++) {
    const test = line ? `${line} ${words[i]}` : words[i];
    if (ctx.measureText(test).width <= width) {
      line = test;
      continue;
    }
    if (line) lines.push(line);
    line = words[i];
    // A single very long word: hard-cut it.
    while (ctx.measureText(line).width > width && line.length > 1) {
      let cut = line.length - 1;
      while (cut > 1 && ctx.measureText(line.slice(0, cut)).width > width) cut--;
      lines.push(line.slice(0, cut));
      line = line.slice(cut);
    }
    if (lines.length >= maxLines) break;
  }
  if (line && lines.length < maxLines) lines.push(line);
  if (lines.length > maxLines) lines.length = maxLines;
  const used = lines.join(" ").replace(/\s+/g, " ").length;
  if (used < text.replace(/\s+/g, " ").trim().length && lines.length) {
    let last = lines[lines.length - 1];
    while (last.length && ctx.measureText(last + "…").width > width) last = last.slice(0, -1);
    lines[lines.length - 1] = last.trimEnd() + "…";
  }
  return lines;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

type Layout = { r: DashboardRow; name: string[]; latest: string[]; h: number };

export async function drawShareImage(rows: DashboardRow[], o: ShareOptions): Promise<Blob> {
  const measure = document.createElement("canvas").getContext("2d")!;

  // Lay out rows first so we know the image height.
  const layouts: Layout[] = rows.map((r) => {
    measure.font = font(650, 26);
    const name = wrap(measure, r.name, COL.project.w, 2);
    measure.font = font(400, 23);
    const latest = r.latest ? wrap(measure, r.latest.body, COL.latest.w, 3) : [];
    const left = name.length * 32 + 30; // name + owner line
    const right = Math.max(1, latest.length) * 30 + 30; // update + meta line
    return { r, name, latest, h: Math.max(left, right, 64) + 36 };
  });

  const headerH = 200;
  const tableHeadH = 52;
  const footerH = 90;
  const H = headerH + tableHeadH + layouts.reduce((s, l) => s + l.h, 0) + footerH;

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  ctx.textBaseline = "top";

  ctx.fillStyle = "#f6f7f9";
  ctx.fillRect(0, 0, W, H);

  // Header
  ctx.fillStyle = "#4f46e5";
  ctx.fillRect(0, 0, W, 10);
  ctx.fillStyle = INK;
  ctx.font = font(750, 44);
  ctx.fillText(o.teamName, PAD, 44, W - PAD * 2);
  ctx.fillStyle = MUTED;
  ctx.font = font(400, 26);
  const sub = `Progress update · ${todayLabel(o.date)}${o.filterLabel ? ` · ${o.filterLabel}` : ""}`;
  ctx.fillText(sub, PAD, 102, W - PAD * 2);

  // Status counts as pills
  let px = PAD;
  ctx.font = font(650, 22);
  for (const s of STATUSES) {
    const n = rows.filter((r) => r.status === s).length;
    if (!n) continue;
    const label = `${n} ${STATUS_META[s].label}`;
    const w = ctx.measureText(label).width + 48;
    ctx.fillStyle = COLORS[s].bg;
    roundRect(ctx, px, 144, w, 38, 19);
    ctx.fill();
    ctx.fillStyle = COLORS[s].fg;
    ctx.beginPath();
    ctx.arc(px + 20, 163, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillText(label, px + 34, 152);
    px += w + 12;
  }

  // Table card
  const cardY = headerH;
  const cardH = tableHeadH + layouts.reduce((s, l) => s + l.h, 0);
  ctx.fillStyle = "#ffffff";
  roundRect(ctx, PAD - 24, cardY, W - (PAD - 24) * 2, cardH, 20);
  ctx.fill();
  ctx.strokeStyle = LINE;
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = MUTED;
  ctx.font = font(650, 18);
  const headY = cardY + 18;
  ctx.fillText("PROJECT", COL.project.x, headY);
  ctx.fillText("STATUS", COL.status.x, headY);
  ctx.fillText("PROGRESS", COL.progress.x, headY);
  ctx.fillText("LATEST UPDATE", COL.latest.x, headY);

  let y = cardY + tableHeadH;
  for (const l of layouts) {
    const { r } = l;
    ctx.strokeStyle = LINE;
    ctx.beginPath();
    ctx.moveTo(PAD - 24, y);
    ctx.lineTo(W - PAD + 24, y);
    ctx.stroke();

    const top = y + 18;
    // Project + owner
    ctx.fillStyle = INK;
    ctx.font = font(650, 26);
    l.name.forEach((t, i) => ctx.fillText(t, COL.project.x, top + i * 32));
    ctx.fillStyle = MUTED;
    ctx.font = font(400, 21);
    ctx.fillText(r.owner?.full_name ?? "No owner", COL.project.x, top + l.name.length * 32 + 4, COL.project.w);

    // Status pill
    const c = COLORS[r.status];
    ctx.font = font(650, 20);
    const label = STATUS_META[r.status].label;
    const pw = ctx.measureText(label).width + 40;
    ctx.fillStyle = c.bg;
    roundRect(ctx, COL.status.x, top, pw, 34, 17);
    ctx.fill();
    ctx.fillStyle = c.fg;
    ctx.beginPath();
    ctx.arc(COL.status.x + 17, top + 17, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillText(label, COL.status.x + 29, top + 7);

    // Progress bar
    const barW = 110;
    ctx.fillStyle = "#eef1f5";
    roundRect(ctx, COL.progress.x, top + 12, barW, 12, 6);
    ctx.fill();
    if (r.progress > 0) {
      ctx.fillStyle = c.fg;
      roundRect(ctx, COL.progress.x, top + 12, Math.max(12, (barW * r.progress) / 100), 12, 6);
      ctx.fill();
    }
    ctx.fillStyle = INK;
    ctx.font = font(700, 24);
    ctx.fillText(`${r.progress}%`, COL.progress.x + barW + 12, top + 4);

    // Latest update + meta
    ctx.font = font(400, 23);
    if (l.latest.length) {
      ctx.fillStyle = INK;
      l.latest.forEach((t, i) => ctx.fillText(t, COL.latest.x, top + i * 30));
    } else {
      ctx.fillStyle = MUTED;
      ctx.fillText("No updates yet", COL.latest.x, top);
    }
    const metaY = top + Math.max(1, l.latest.length) * 30 + 4;
    ctx.font = font(r.stale || r.overdue ? 650 : 400, 19);
    const meta: [string, string][] = [];
    if (r.last_log_at) meta.push([`Updated ${r.updatedLabel}`, r.stale ? "#b45309" : MUTED]);
    else if (r.stale) meta.push([`No update in ${r.daysSinceUpdate} days`, "#b45309"]);
    if (r.overdue) meta.push([`Overdue · ${r.targetLabel}`, "#dc2626"]);
    else if (r.targetLabel && r.status !== "done") meta.push([`Due ${r.targetLabel}`, MUTED]);
    let mx = COL.latest.x;
    for (const [t, color] of meta) {
      ctx.fillStyle = color;
      ctx.fillText(t, mx, metaY);
      mx += ctx.measureText(t).width + 22;
    }
    y += l.h;
  }

  // Footer
  ctx.fillStyle = MUTED;
  ctx.font = font(400, 20);
  const foot = `Shared from Handover${o.link ? ` · ${o.link.replace(/^https?:\/\//, "")}` : ""}`;
  ctx.fillText(foot, PAD, H - footerH + 34, W - PAD * 2);

  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't create image"))), "image/png"),
  );
}
