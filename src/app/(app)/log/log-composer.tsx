"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { IconCamera, IconLock } from "@/components/icons";
import { preparePhoto, type PreparedPhoto } from "@/lib/image";
import { MAX_PHOTOS } from "@/lib/limits";
import { STATUSES, STATUS_META } from "@/lib/status";
import { createClient } from "@/lib/supabase/client";
import type { ProjectStatus } from "@/lib/types";
import { createLog } from "./actions";

export type ComposerProject = {
  id: string;
  name: string;
  status: ProjectStatus;
  progress: number;
  is_private: boolean;
};

const DRAFT_KEY = "handover:draft";
type Draft = { projectId: string; body: string };

function readDraft(): Draft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as Draft) : null;
  } catch {
    return null;
  }
}
function writeDraft(d: Draft | null) {
  try {
    if (d && (d.body || d.projectId)) localStorage.setItem(DRAFT_KEY, JSON.stringify(d));
    else localStorage.removeItem(DRAFT_KEY);
  } catch {
    // Private mode or storage blocked: drafts just aren't kept.
  }
}

export function LogComposer({
  projects,
  initialProjectId,
}: {
  projects: ComposerProject[];
  initialProjectId: string | null;
}) {
  const router = useRouter();
  const [projectId, setProjectId] = useState(initialProjectId ?? "");
  const [body, setBody] = useState("");
  const [status, setStatus] = useState<ProjectStatus | null>(null);
  const [changeProgress, setChangeProgress] = useState(false);
  const [progress, setProgress] = useState(0);
  const [photos, setPhotos] = useState<PreparedPhoto[]>([]);
  const [processing, setProcessing] = useState(0);
  const [phase, setPhase] = useState<"idle" | "uploading" | "saving">("idle");
  const [uploaded, setUploaded] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const restored = useRef(false);
  const cameraInput = useRef<HTMLInputElement>(null);
  const galleryInput = useRef<HTMLInputElement>(null);

  const project = projects.find((p) => p.id === projectId) ?? null;

  // Restore an unsent draft once (the URL's project wins if given).
  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    const d = readDraft();
    if (!d) return;
    /* eslint-disable react-hooks/set-state-in-effect -- one-time restore from localStorage */
    if (d.body) setBody(d.body);
    if (!initialProjectId && projects.some((p) => p.id === d.projectId)) setProjectId(d.projectId);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [initialProjectId, projects]);

  useEffect(() => {
    if (restored.current) writeDraft({ projectId, body });
  }, [projectId, body]);

  // Free preview memory when photos are removed or the page closes.
  const photosRef = useRef(photos);
  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);
  useEffect(() => () => photosRef.current.forEach((p) => URL.revokeObjectURL(p.previewUrl)), []);

  function pickProject(id: string) {
    setProjectId(id);
    const p = projects.find((x) => x.id === id);
    if (p) setProgress(p.progress);
    setStatus(null);
    setChangeProgress(false);
  }

  function pickStatus(s: ProjectStatus | null) {
    setStatus(s);
    if (s === "done") {
      setChangeProgress(true);
      setProgress(100);
    }
  }

  async function addFiles(list: FileList | null) {
    if (!list?.length) return;
    setError(null);
    const room = MAX_PHOTOS - photos.length;
    const files = Array.from(list).filter((f) => f.type.startsWith("image/")).slice(0, room);
    if (list.length > room) setError(`Up to ${MAX_PHOTOS} photos per update.`);
    setProcessing((n) => n + files.length);
    for (const f of files) {
      try {
        const prepared = await preparePhoto(f);
        setPhotos((prev) => [...prev, prepared]);
      } catch {
        setError("One photo couldn't be read. Try a different one.");
      } finally {
        setProcessing((n) => n - 1);
      }
    }
  }

  function removePhoto(key: string) {
    setPhotos((prev) => {
      const gone = prev.find((p) => p.key === key);
      if (gone) URL.revokeObjectURL(gone.previewUrl);
      return prev.filter((p) => p.key !== key);
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!project) return setError("Pick a project.");
    if (!body.trim()) return setError("Write what changed.");
    if (processing) return setError("Wait for photos to finish preparing.");

    const logId = crypto.randomUUID();
    const supabase = createClient();
    const uploadedPhotos: { path: string; width: number; height: number }[] = [];

    try {
      if (photos.length) {
        setPhase("uploading");
        setUploaded(0);
        for (const [i, p] of photos.entries()) {
          const path = `${project.id}/${logId}/${i + 1}-${p.key}.jpg`;
          const { error: upErr } = await supabase.storage
            .from("log-photos")
            .upload(path, p.blob, { contentType: "image/jpeg", upsert: false });
          if (upErr) throw new Error("upload");
          uploadedPhotos.push({ path, width: p.width, height: p.height });
          setUploaded(i + 1);
        }
      }
      setPhase("saving");
      const result = await createLog({
        id: logId,
        projectId: project.id,
        body,
        status: status && status !== project.status ? status : null,
        progress: changeProgress && progress !== project.progress ? progress : null,
        photos: uploadedPhotos,
      });
      if (!result.ok) throw new Error(result.error);
    } catch (err) {
      setPhase("idle");
      if (uploadedPhotos.length) {
        await supabase.storage.from("log-photos").remove(uploadedPhotos.map((p) => p.path));
      }
      const msg = err instanceof Error && err.message !== "upload" ? err.message : null;
      setError(msg ?? "Photo upload failed. Check your connection and try again — your text is saved.");
      return;
    }

    writeDraft(null);
    photos.forEach((p) => URL.revokeObjectURL(p.previewUrl));
    router.push(`/projects/${project.id}?posted=1`);
    router.refresh();
  }

  const busy = phase !== "idle";

  return (
    <form onSubmit={submit} className="space-y-5 pb-4">
      <div>
        <label htmlFor="project" className="label">Project</label>
        <select id="project" className="field" value={projectId} onChange={(e) => pickProject(e.target.value)}>
          <option value="" disabled>Choose a project…</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.is_private ? "🔒 " : ""}{p.name}
            </option>
          ))}
        </select>
        {project?.is_private && (
          <p className="mt-1.5 flex items-center gap-1 text-xs text-muted">
            <IconLock className="h-3.5 w-3.5" /> Private: only the project&apos;s members will see this.
          </p>
        )}
      </div>

      <div>
        <label htmlFor="body" className="label">What changed?</label>
        <textarea
          id="body"
          rows={5}
          maxLength={5000}
          className="field resize-none"
          placeholder="e.g. Finished the homepage design. Next: signup form. Waiting on copy from marketing."
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
      </div>

      <div>
        <span className="label">Photos <span className="font-normal text-muted">(optional, up to {MAX_PHOTOS})</span></span>
        {(photos.length > 0 || processing > 0) && (
          <ul className="mb-3 grid grid-cols-3 gap-2">
            {photos.map((p) => (
              <li key={p.key} className="relative aspect-square overflow-hidden rounded-xl bg-surface-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.previewUrl} alt="" className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => removePhoto(p.key)}
                  disabled={busy}
                  aria-label="Remove photo"
                  className="absolute right-1 top-1 grid h-8 w-8 place-items-center rounded-full bg-black/60 text-lg leading-none text-white"
                >
                  ×
                </button>
              </li>
            ))}
            {Array.from({ length: processing }, (_, i) => (
              <li key={`p${i}`} className="aspect-square animate-pulse rounded-xl bg-surface-2" aria-label="Preparing photo" />
            ))}
          </ul>
        )}
        {photos.length + processing < MAX_PHOTOS && (
          <div className="grid grid-cols-2 gap-3">
            <button type="button" className="btn-secondary" disabled={busy} onClick={() => cameraInput.current?.click()}>
              <IconCamera className="h-5 w-5" /> Camera
            </button>
            <button type="button" className="btn-secondary" disabled={busy} onClick={() => galleryInput.current?.click()}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" />
              </svg>
              Gallery
            </button>
          </div>
        )}
        <input ref={cameraInput} type="file" accept="image/*" capture="environment" hidden
          data-testid="camera-input"
          onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
        <input ref={galleryInput} type="file" accept="image/*" multiple hidden
          data-testid="gallery-input"
          onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
      </div>

      {project && (
        <fieldset className="card space-y-4 p-4">
          <legend className="sr-only">Status and progress</legend>
          <div>
            <span className="label">
              Status <span className="font-normal text-muted">· now {STATUS_META[project.status].label}</span>
            </span>
            <div className="flex flex-wrap gap-2">
              <StatusChip active={status === null} onClick={() => pickStatus(null)} label="No change" />
              {STATUSES.filter((s) => s !== project.status).map((s) => (
                <StatusChip key={s} active={status === s} onClick={() => pickStatus(s)}
                  label={STATUS_META[s].label} dot={STATUS_META[s].dot} />
              ))}
            </div>
          </div>
          <div>
            <label className="flex min-h-11 cursor-pointer items-center gap-3">
              <input type="checkbox" className="h-5 w-5 accent-brand" checked={changeProgress}
                onChange={(e) => { setChangeProgress(e.target.checked); setProgress(project.progress); }} />
              <span className="text-sm font-medium">
                Update progress <span className="font-normal text-muted">· now {project.progress}%</span>
              </span>
            </label>
            {changeProgress && (
              <div className="mt-2">
                <div className="mb-1 flex justify-between text-sm">
                  <span className="text-muted">{project.progress}%</span>
                  <span className="font-semibold tabular-nums text-brand">{progress}%</span>
                </div>
                <input type="range" min={0} max={100} step={5} value={progress} aria-label="New progress"
                  onChange={(e) => setProgress(Number(e.target.value))} className="w-full accent-brand" />
              </div>
            )}
          </div>
        </fieldset>
      )}

      {error && <p role="alert" className="text-sm text-danger">{error}</p>}

      <button type="submit" className="btn-primary w-full" disabled={busy || processing > 0}>
        {phase === "uploading"
          ? `Uploading photos ${uploaded}/${photos.length}…`
          : phase === "saving"
            ? "Posting…"
            : "Post update"}
      </button>
      <p className="text-center text-xs text-muted">The time and your name are added automatically.</p>
    </form>
  );
}

function StatusChip({ active, onClick, label, dot }: { active: boolean; onClick: () => void; label: string; dot?: string }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active}
      className={`inline-flex min-h-10 items-center gap-2 rounded-full border px-3.5 text-sm font-medium ${
        active ? "border-brand bg-brand-soft text-text" : "border-border bg-surface text-muted"
      }`}>
      {dot && <span className={`h-2.5 w-2.5 rounded-full ${dot}`} aria-hidden />}
      {label}
    </button>
  );
}
