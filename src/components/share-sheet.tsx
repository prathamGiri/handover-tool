"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { DashboardRow } from "@/lib/dashboard";
import type { DashboardFilters } from "@/lib/dashboard-filters";
import { buildShareText, describeFilters, drawShareImage, todayLabel } from "@/lib/share";
import { IconCopy, IconShare, IconWhatsApp } from "./icons";

type Props = {
  rows: DashboardRow[];
  filters: DashboardFilters;
  teamName: string;
  staleDays: number;
};

export function ShareButton(props: Props) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn-secondary min-h-10 shrink-0 px-4 text-sm">
        <IconShare className="h-4 w-4" /> Share
      </button>
      {open && <ShareSheet {...props} onClose={() => setOpen(false)} />}
    </>
  );
}

function ShareSheet({ rows, filters, teamName, staleDays, onClose }: Props & { onClose: () => void }) {
  const privateCount = rows.filter((r) => r.is_private).length;
  const [includePrivate, setIncludePrivate] = useState(false);
  const [includeLink, setIncludeLink] = useState(true);
  const [image, setImage] = useState<{ blob: Blob; url: string } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const imageRef = useRef(image);

  const shared = useMemo(
    () => (includePrivate ? rows : rows.filter((r) => !r.is_private)),
    [rows, includePrivate],
  );
  const options = useMemo(
    () => ({
      teamName,
      filterLabel: describeFilters(filters, rows),
      link: includeLink ? window.location.origin : null,
      staleDays,
    }),
    [teamName, filters, rows, includeLink, staleDays],
  );
  const text = useMemo(() => buildShareText(shared, options), [shared, options]);

  // Draw the image up front so tapping Share can open the share menu at once
  // (iPhone Safari only allows it straight after a tap).
  useEffect(() => {
    let cancelled = false;
    if (!shared.length) return;
    drawShareImage(shared, options).then((blob) => {
      if (cancelled) return;
      const url = URL.createObjectURL(blob);
      setImage((prev) => {
        if (prev) URL.revokeObjectURL(prev.url);
        return { blob, url };
      });
    });
    return () => {
      cancelled = true;
    };
  }, [shared, options]);

  useEffect(() => {
    imageRef.current = image;
  }, [image]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
      if (imageRef.current) URL.revokeObjectURL(imageRef.current.url);
    };
  }, [onClose]);

  const fileName = `${teamName.replace(/[^\w-]+/g, "-")}-progress-${todayLabel().replace(/\s/g, "-")}.png`;

  function flash(msg: string) {
    setNotice(msg);
    window.setTimeout(() => setNotice(null), 3000);
  }

  async function shareImage() {
    if (!image) return;
    const file = new File([image.blob], fileName, { type: "image/png" });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: `${teamName} progress` });
        onClose();
      } catch (e) {
        if ((e as DOMException)?.name !== "AbortError") flash("Couldn't open the share menu. Try Download instead.");
      }
      return;
    }
    // Desktop browsers: copy to clipboard (paste into WhatsApp Web) and download.
    let copied = false;
    try {
      await navigator.clipboard.write([new ClipboardItem({ "image/png": image.blob })]);
      copied = true;
    } catch {
      // Clipboard images not supported; the download still works.
    }
    downloadImage();
    flash(copied ? "Image copied and downloaded. Paste it into WhatsApp." : "Image downloaded. Attach it in WhatsApp.");
  }

  function downloadImage() {
    if (!image) return;
    const a = document.createElement("a");
    a.href = image.url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function shareText() {
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener");
  }

  async function copyText() {
    try {
      await navigator.clipboard.writeText(text);
      flash("Text copied.");
    } catch {
      window.prompt("Copy this text:", text);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 md:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-title"
        onClick={(e) => e.stopPropagation()}
        className="pb-safe max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-surface p-5 shadow-2xl md:rounded-3xl"
      >
        <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-border md:hidden" aria-hidden />
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="share-title" className="text-lg font-bold">Share progress</h2>
            <p className="text-sm text-muted">
              {shared.length} {shared.length === 1 ? "project" : "projects"}
              {options.filterLabel ? ` · ${options.filterLabel}` : ""}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="grid h-10 w-10 place-items-center rounded-full bg-surface-2 text-xl leading-none">
            ×
          </button>
        </div>

        {shared.length === 0 ? (
          <p className="mt-6 rounded-xl bg-surface-2 p-4 text-sm text-muted">
            Nothing to share: every project in this view is private. Turn on &ldquo;Include private projects&rdquo; below.
          </p>
        ) : (
          <div className="mt-4 overflow-hidden rounded-xl border border-border bg-surface-2">
            {image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={image.url} alt="Preview of the progress table image" className="max-h-72 w-full object-contain object-top" />
            ) : (
              <div className="h-48 animate-pulse" aria-label="Preparing image" />
            )}
          </div>
        )}

        <div className="mt-4 space-y-1">
          {privateCount > 0 && (
            <label className="flex min-h-11 cursor-pointer items-center gap-3">
              <input type="checkbox" className="h-5 w-5 accent-brand" checked={includePrivate}
                onChange={(e) => setIncludePrivate(e.target.checked)} />
              <span className="text-sm">
                Include private projects <span className="text-muted">({privateCount})</span>
              </span>
            </label>
          )}
          <label className="flex min-h-11 cursor-pointer items-center gap-3">
            <input type="checkbox" className="h-5 w-5 accent-brand" checked={includeLink}
              onChange={(e) => setIncludeLink(e.target.checked)} />
            <span className="text-sm">Add link to the app</span>
          </label>
        </div>

        <div className="mt-4 grid gap-3">
          <button type="button" onClick={shareImage} disabled={!image || !shared.length} className="btn-primary w-full">
            <IconShare className="h-5 w-5" /> Share image
          </button>
          <button type="button" onClick={shareText} disabled={!shared.length} className="btn w-full bg-[#25D366] text-white">
            <IconWhatsApp className="h-5 w-5" /> Send as text on WhatsApp
          </button>
          <div className="grid grid-cols-2 gap-3">
            <button type="button" onClick={downloadImage} disabled={!image || !shared.length} className="btn-secondary text-sm">
              Download image
            </button>
            <button type="button" onClick={copyText} disabled={!shared.length} className="btn-secondary text-sm">
              <IconCopy className="h-4 w-4" /> Copy text
            </button>
          </div>
        </div>
        <p role="status" className="mt-3 min-h-5 text-center text-sm text-ok">{notice}</p>
      </div>
    </div>
  );
}
