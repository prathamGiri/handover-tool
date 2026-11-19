"use client";

import { SubmitButton } from "@/components/submit-button";

export function DeleteProject({ action, name }: { action: () => Promise<void>; name: string }) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!window.confirm(`Delete "${name}" and all its updates? This can't be undone.`)) e.preventDefault();
      }}
      className="mt-6 border-t border-border pt-6"
    >
      <SubmitButton className="btn-secondary w-full text-danger" pendingText="Deleting…">
        Delete project
      </SubmitButton>
    </form>
  );
}
