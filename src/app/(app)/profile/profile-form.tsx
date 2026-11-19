"use client";

import { useActionState } from "react";
import { updateProfile } from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";

export function ProfileForm({ defaultName }: { defaultName: string }) {
  const [state, action] = useActionState(updateProfile, undefined);
  return (
    <form action={action} className="mt-4">
      <div className="flex gap-2">
      <label htmlFor="full_name" className="sr-only">Your name</label>
      <input id="full_name" name="full_name" defaultValue={defaultName} maxLength={80} className="field" required />
      <SubmitButton className="btn-secondary shrink-0" pendingText="…">
        {state?.ok ? "Saved" : "Save"}
      </SubmitButton>
      </div>
      {state?.error && <p role="alert" className="mt-2 text-sm text-danger">{state.error}</p>}
    </form>
  );
}
