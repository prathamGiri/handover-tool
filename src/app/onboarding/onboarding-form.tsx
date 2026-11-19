"use client";

import { useActionState, useState } from "react";
import { completeOnboarding } from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";

export function OnboardingForm({ defaultName, hasTeam }: { defaultName: string; hasTeam: boolean }) {
  const [state, action] = useActionState(completeOnboarding, undefined);
  const [mode, setMode] = useState<"join" | "create">("join");

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="mode" value={hasTeam ? "skip" : mode} />
      <div>
        <label htmlFor="full_name" className="label">Your name</label>
        <input
          id="full_name"
          name="full_name"
          className="field"
          placeholder="e.g. Priya Sharma"
          defaultValue={defaultName}
          autoComplete="name"
          maxLength={80}
          required
        />
      </div>

      {!hasTeam && (
        <div>
          <div role="tablist" className="grid grid-cols-2 rounded-xl bg-surface-2 p-1 text-sm font-medium">
            {(["join", "create"] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={mode === m}
                onClick={() => setMode(m)}
                className={`min-h-10 rounded-lg transition ${mode === m ? "bg-surface text-text shadow-sm" : "text-muted"}`}
              >
                {m === "join" ? "Join a team" : "Create a team"}
              </button>
            ))}
          </div>

          <div className="mt-4">
            {mode === "join" ? (
              <>
                <label htmlFor="invite_code" className="label">Invite link or code</label>
                <input
                  id="invite_code"
                  name="invite_code"
                  className="field"
                  placeholder="Paste the link from WhatsApp"
                  autoCapitalize="none"
                  autoCorrect="off"
                />
                <p className="mt-2 text-sm text-muted">Ask your team admin to share the invite link.</p>
              </>
            ) : (
              <>
                <label htmlFor="team_name" className="label">Team name</label>
                <input
                  id="team_name"
                  name="team_name"
                  className="field"
                  placeholder="e.g. Product Team"
                  maxLength={80}
                />
                <p className="mt-2 text-sm text-muted">You&apos;ll be the admin and can invite everyone else.</p>
              </>
            )}
          </div>
        </div>
      )}

      {state?.error && <p role="alert" className="text-sm text-danger">{state.error}</p>}
      <SubmitButton pendingText="Saving…">Continue</SubmitButton>
    </form>
  );
}
