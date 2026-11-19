"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/avatar";
import { LocalTime } from "@/components/local-time";
import { STATUS_META } from "@/lib/status";
import type { LogPhoto, TimelineEntry } from "@/lib/types";
import { deleteLog, updateLog } from "../../log/actions";

export function Timeline({
  entries,
  userId,
  isAdmin,
}: {
  entries: TimelineEntry[];
  userId: string;
  isAdmin: boolean;
}) {
  const [viewer, setViewer] = useState<{ photos: LogPhoto[]; index: number } | null>(null);
  return (
    <>
      <ol className="relative space-y-4 before:absolute before:bottom-2 before:left-[19px] before:top-2 before:w-px before:bg-border">
        {entries.map((e) => (
          <Entry
            key={e.id}
            entry={e}
            canEdit={e.author?.id === userId}
            canDelete={e.author?.id === userId || isAdmin}
            onOpenPhoto={(index) => setViewer({ photos: e.photos, index })}
          />
        ))}
      </ol>
      {viewer && <PhotoViewer {...viewer} onClose={() => setViewer(null)} />}
    </>
  );
}

function Entry({
  entry,
  canEdit,
  canDelete,
  onOpenPhoto,
}: {
  entry: TimelineEntry;
  canEdit: boolean;
  canDelete: boolean;
  onOpenPhoto: (index: number) => void;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(entry.body);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const name = entry.author?.full_name ?? "Former member";

  function save() {
    setError(null);
    startTransition(async () => {
      const r = await updateLog(entry.id, draft);
      if (!r.ok) return setError(r.error);
      setEditing(false);
      router.refresh();
    });
  }

  function remove() {
    if (!window.confirm("Delete this update and its photos?")) return;
    startTransition(async () => {
      const r = await deleteLog(entry.id);
      if (!r.ok) return setError(r.error);
      router.refresh();
    });
  }

  return (
    <li className={`relative flex gap-3 ${pending ? "opacity-60" : ""}`}>
      <div className="relative z-10 rounded-full ring-4 ring-bg">
        <Avatar id={entry.author?.id ?? entry.id} name={name} size={40} />
      </div>
      <article className="card min-w-0 flex-1 p-4">
        <header className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate font-semibold">{name}</p>
            <p className="text-xs text-muted">
              <span>{entry.relative}</span>
              {" · "}
              <LocalTime iso={entry.created_at} fallback={entry.fallbackTime} />
              {entry.edited_at && " · edited"}
            </p>
          </div>
          {(canEdit || canDelete) && !editing && (
            <details className="relative">
              <summary className="grid h-9 w-9 cursor-pointer list-none place-items-center rounded-full text-muted hover:bg-surface-2 [&::-webkit-details-marker]:hidden" aria-label="Update options">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" />
                </svg>
              </summary>
              <div className="absolute right-0 z-20 mt-1 w-36 overflow-hidden rounded-xl border border-border bg-surface shadow-lg">
                {canEdit && (
                  <button type="button" className="block w-full px-4 py-3 text-left text-sm"
                    onClick={(ev) => { (ev.currentTarget.closest("details") as HTMLDetailsElement).open = false; setDraft(entry.body); setEditing(true); }}>
                    Edit text
                  </button>
                )}
                {canDelete && (
                  <button type="button" className="block w-full px-4 py-3 text-left text-sm text-danger" onClick={remove}>
                    Delete
                  </button>
                )}
              </div>
            </details>
          )}
        </header>

        {(entry.status || entry.progress !== null) && (
          <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
            {entry.status && (
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 ${STATUS_META[entry.status].className}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${STATUS_META[entry.status].dot}`} aria-hidden />
                Marked {STATUS_META[entry.status].label.toLowerCase()}
              </span>
            )}
            {entry.progress !== null && (
              <span className="rounded-full bg-surface-2 px-2.5 py-1 text-text">Progress → {entry.progress}%</span>
            )}
          </div>
        )}

        {editing ? (
          <div className="mt-3 space-y-2">
            <label htmlFor={`edit-${entry.id}`} className="sr-only">Edit update</label>
            <textarea id={`edit-${entry.id}`} rows={4} maxLength={5000} className="field resize-none"
              value={draft} onChange={(e) => setDraft(e.target.value)} autoFocus />
            <div className="flex gap-2">
              <button type="button" className="btn-primary min-h-10 flex-1 text-sm" disabled={pending} onClick={save}>
                {pending ? "Saving…" : "Save"}
              </button>
              <button type="button" className="btn-secondary min-h-10 flex-1 text-sm" disabled={pending}
                onClick={() => { setEditing(false); setError(null); }}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <p className="mt-3 whitespace-pre-line break-words">{entry.body}</p>
        )}

        {entry.photos.length > 0 && (
          <ul className={`mt-3 grid gap-1.5 ${entry.photos.length === 1 ? "grid-cols-1" : entry.photos.length === 2 || entry.photos.length === 4 ? "grid-cols-2" : "grid-cols-3"}`}>
            {entry.photos.map((p, i) => (
              <li key={p.id}>
                <button type="button" onClick={() => onOpenPhoto(i)} aria-label={`Open photo ${i + 1} of ${entry.photos.length}`}
                  className={`block w-full overflow-hidden rounded-lg bg-surface-2 ${entry.photos.length === 1 ? "max-h-80" : "aspect-square"}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.url} alt="" loading="lazy" className="h-full w-full object-cover"
                    width={p.width ?? undefined} height={p.height ?? undefined} />
                </button>
              </li>
            ))}
          </ul>
        )}
        {error && <p role="alert" className="mt-2 text-sm text-danger">{error}</p>}
      </article>
    </li>
  );
}

function PhotoViewer({ photos, index, onClose }: { photos: LogPhoto[]; index: number; onClose: () => void }) {
  const [i, setI] = useState(index);
  const photo = photos[i];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setI((n) => Math.min(photos.length - 1, n + 1));
      if (e.key === "ArrowLeft") setI((n) => Math.max(0, n - 1));
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose, photos.length]);

  const startX = useRef(0);
  return (
    <div role="dialog" aria-modal="true" aria-label="Photo viewer"
      className="fixed inset-0 z-50 flex flex-col bg-black"
      onTouchStart={(e) => { startX.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => {
        const dx = e.changedTouches[0].clientX - startX.current;
        if (dx < -50) setI((n) => Math.min(photos.length - 1, n + 1));
        if (dx > 50) setI((n) => Math.max(0, n - 1));
      }}>
      <div className="pt-safe flex items-center justify-between px-4 py-3 text-white">
        <span className="text-sm tabular-nums">{i + 1} / {photos.length}</span>
        <button type="button" onClick={onClose} className="grid h-11 w-11 place-items-center rounded-full bg-white/10 text-2xl leading-none" aria-label="Close">
          ×
        </button>
      </div>
      <div className="relative flex flex-1 items-center justify-center overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photo.url} alt={`Photo ${i + 1}`} className="max-h-full max-w-full object-contain" />
        {i > 0 && (
          <button type="button" onClick={() => setI(i - 1)} aria-label="Previous photo"
            className="absolute left-2 grid h-11 w-11 place-items-center rounded-full bg-white/10 text-2xl text-white">‹</button>
        )}
        {i < photos.length - 1 && (
          <button type="button" onClick={() => setI(i + 1)} aria-label="Next photo"
            className="absolute right-2 grid h-11 w-11 place-items-center rounded-full bg-white/10 text-2xl text-white">›</button>
        )}
      </div>
      <div className="pb-safe h-6" />
    </div>
  );
}
