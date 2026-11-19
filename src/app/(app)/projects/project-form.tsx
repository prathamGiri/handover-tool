"use client";

import { useActionState, useState } from "react";
import { Avatar } from "@/components/avatar";
import { IconLock } from "@/components/icons";
import { SubmitButton } from "@/components/submit-button";
import { STATUSES, STATUS_META } from "@/lib/status";
import type { Person, ProjectStatus } from "@/lib/types";
import type { ProjectFormState } from "./actions";

type Values = {
  name: string;
  description: string;
  owner_id: string;
  target_date: string;
  is_private: boolean;
  members: string[];
  status: ProjectStatus;
  progress: number;
};

export function ProjectForm({
  action,
  people,
  userId,
  initial,
  mode,
  creatorId,
}: {
  action: (prev: ProjectFormState, form: FormData) => Promise<ProjectFormState>;
  people: Person[];
  userId: string;
  initial?: Partial<Values>;
  mode: "create" | "edit";
  /** Who created the project (always has access). Defaults to the current user. */
  creatorId?: string | null;
}) {
  const [state, formAction] = useActionState(action, undefined);
  const [isPrivate, setIsPrivate] = useState(initial?.is_private ?? false);
  const [ownerId, setOwnerId] = useState(initial?.owner_id ?? userId);
  const [progress, setProgress] = useState(initial?.progress ?? 0);
  const [status, setStatus] = useState<ProjectStatus>(initial?.status ?? "on_track");
  const [members, setMembers] = useState<Set<string>>(new Set(initial?.members ?? []));

  // The owner and the creator always have access, so they aren't listed.
  const creator = creatorId === undefined ? userId : creatorId;
  const pickable = people.filter((p) => p.id !== ownerId && p.id !== creator);

  return (
    <form action={formAction} className="space-y-5 pb-4">
      <div>
        <label htmlFor="name" className="label">Project name</label>
        <input id="name" name="name" className="field" maxLength={120} required
          defaultValue={initial?.name} placeholder="e.g. Website revamp" autoFocus={mode === "create"} />
      </div>

      <div>
        <label htmlFor="description" className="label">
          What is it about? <span className="font-normal text-muted">(optional)</span>
        </label>
        <textarea id="description" name="description" rows={3} maxLength={2000} className="field resize-none"
          defaultValue={initial?.description} placeholder="Goal, scope, anything the team should know" />
      </div>

      <div className="grid gap-5 sm:grid-cols-2 sm:gap-3">
        <div>
          <label htmlFor="owner_id" className="label">Owner</label>
          <select id="owner_id" name="owner_id" className="field" value={ownerId}
            onChange={(e) => setOwnerId(e.target.value)}>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.full_name || "New member"}{p.id === userId ? " (you)" : ""}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="target_date" className="label">
            Target date <span className="font-normal text-muted">(optional)</span>
          </label>
          <input id="target_date" name="target_date" type="date" className="field min-h-[50px]"
            defaultValue={initial?.target_date} />
        </div>
      </div>

      {mode === "create" && (
        <fieldset className="card space-y-4 p-4">
          <legend className="sr-only">Starting point</legend>
          <div>
            <span className="label">Current status</span>
            <div className="grid grid-cols-2 gap-2">
              {STATUSES.map((s) => (
                <label key={s}
                  className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border px-3 text-sm font-medium ${
                    status === s ? "border-brand bg-brand-soft" : "border-border"
                  }`}>
                  <input type="radio" name="status" value={s} checked={status === s}
                    onChange={() => setStatus(s)} className="sr-only" />
                  <span className={`h-2.5 w-2.5 rounded-full ${STATUS_META[s].dot}`} aria-hidden />
                  {STATUS_META[s].label}
                </label>
              ))}
            </div>
          </div>
          <div>
            <label htmlFor="progress" className="label flex justify-between">
              <span>How far along?</span>
              <span className="tabular-nums text-brand">{progress}%</span>
            </label>
            <input id="progress" name="progress" type="range" min={0} max={100} step={5} value={progress}
              onChange={(e) => setProgress(Number(e.target.value))} className="w-full accent-brand" />
          </div>
        </fieldset>
      )}

      <div className="card p-4">
        <label className="flex cursor-pointer items-center justify-between gap-4">
          <span>
            <span className="flex items-center gap-1.5 font-semibold">
              <IconLock className="h-4 w-4" /> Private project
            </span>
            <span className="mt-0.5 block text-sm text-muted">
              {isPrivate ? "Only the people you pick can see and post." : "Everyone in the team can see and post."}
            </span>
          </span>
          <input type="checkbox" name="is_private" role="switch" checked={isPrivate}
            onChange={(e) => setIsPrivate(e.target.checked)} className="peer sr-only" />
          <span aria-hidden
            className="relative h-7 w-12 shrink-0 rounded-full bg-surface-2 ring-1 ring-border transition peer-checked:bg-brand after:absolute after:left-0.5 after:top-0.5 after:h-6 after:w-6 after:rounded-full after:bg-white after:shadow after:transition peer-checked:after:translate-x-5 peer-focus-visible:outline-2 peer-focus-visible:outline-brand" />
        </label>

        {isPrivate && (
          <div className="mt-4 border-t border-border pt-4">
            <p className="mb-2 text-sm font-medium">Who else can see it?</p>
            {pickable.length === 0 ? (
              <p className="text-sm text-muted">Invite teammates first to share private projects.</p>
            ) : (
              <ul className="space-y-1">
                {pickable.map((p) => (
                  <li key={p.id}>
                    <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-1">
                      <input type="checkbox" name="members" value={p.id} checked={members.has(p.id)}
                        onChange={(e) => {
                          const next = new Set(members);
                          if (e.target.checked) next.add(p.id);
                          else next.delete(p.id);
                          setMembers(next);
                        }}
                        className="h-5 w-5 accent-brand" />
                      <Avatar id={p.id} name={p.full_name || "?"} size={28} />
                      <span className="truncate">{p.full_name || "New member"}</span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-2 text-xs text-muted">The creator and the owner always have access.</p>
          </div>
        )}
      </div>

      {state?.error && <p role="alert" className="text-sm text-danger">{state.error}</p>}
      <SubmitButton pendingText={mode === "create" ? "Creating…" : "Saving…"}>
        {mode === "create" ? "Create project" : "Save changes"}
      </SubmitButton>
    </form>
  );
}
