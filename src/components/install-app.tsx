"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

function subscribe() {
  return () => {};
}

function getPlatform() {
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (standalone) return "installed";
  return /iphone|ipad|ipod/i.test(navigator.userAgent) ? "ios" : "other";
}

export function InstallApp() {
  const platform = useSyncExternalStore(subscribe, getPlatform, () => "server");
  const [deferred, setDeferred] = useState<InstallEvent | null>(null);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as InstallEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (platform === "server" || platform === "installed") return null;

  return (
    <section className="card p-4">
      <h2 className="font-semibold">Add Handover to your home screen</h2>
      {deferred ? (
        <>
          <p className="mt-1 text-sm text-muted">Open it like any other app, full screen, in one tap.</p>
          <button
            type="button"
            className="btn-primary mt-4 w-full"
            onClick={async () => {
              await deferred.prompt();
              setDeferred(null);
            }}
          >
            Install app
          </button>
        </>
      ) : platform === "ios" ? (
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-muted">
          <li>Open this page in <b>Safari</b></li>
          <li>Tap the <b>Share</b> button at the bottom</li>
          <li>Choose <b>Add to Home Screen</b></li>
        </ol>
      ) : (
        <p className="mt-1 text-sm text-muted">
          In Chrome, tap the <b>⋮</b> menu and choose <b>Add to Home screen</b> or <b>Install app</b>.
        </p>
      )}
    </section>
  );
}
