"use client";

import { useSyncExternalStore } from "react";

const noop = () => () => {};

/**
 * Shows a timestamp in the viewer's own time zone ("19 Nov 2026, 3:42 pm").
 * The server can't know the phone's time zone, so it renders `fallback` and
 * the browser swaps in the local time after hydration.
 */
export function LocalTime({ iso, fallback, className }: { iso: string; fallback: string; className?: string }) {
  const text = useSyncExternalStore(
    noop,
    () =>
      new Intl.DateTimeFormat(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }).format(new Date(iso)),
    () => fallback,
  );
  return (
    <time dateTime={iso} className={className}>
      {text}
    </time>
  );
}
