"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendCode(e?: React.FormEvent) {
    e?.preventDefault();
    setError(null);
    const value = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(value)) {
      setError("Enter a valid email address.");
      return;
    }
    setBusy(true);
    const { error } = await createClient().auth.signInWithOtp({
      email: value,
      options: { shouldCreateUser: true },
    });
    setBusy(false);
    if (error) {
      setError(
        error.status === 429
          ? "Too many attempts. Wait a minute and try again."
          : "Couldn't send the code. Check the email and try again.",
      );
      return;
    }
    setEmail(value);
    setCode("");
    setStep("code");
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const token = code.replace(/\D/g, "");
    if (token.length < 6) {
      setError("Enter the 6-digit code from your email.");
      return;
    }
    setBusy(true);
    const { error } = await createClient().auth.verifyOtp({ email, token, type: "email" });
    if (error) {
      setBusy(false);
      setError("That code is wrong or has expired.");
      return;
    }
    router.replace(next);
    router.refresh();
  }

  if (step === "email") {
    return (
      <form onSubmit={sendCode} className="space-y-4" noValidate>
        <div>
          <label htmlFor="email" className="label">
            Work email
          </label>
          <input
            id="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            placeholder="you@company.com"
            className="field"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoFocus
          />
        </div>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <button type="submit" disabled={busy} className="btn-primary w-full">
          {busy ? "Sending…" : "Send login code"}
        </button>
        <p className="text-center text-sm text-muted">
          No password needed. We&apos;ll email you a 6-digit code.
        </p>
      </form>
    );
  }

  return (
    <form onSubmit={verify} className="space-y-4" noValidate>
      <div>
        <label htmlFor="code" className="label">
          Enter the code sent to <span className="font-semibold">{email}</span>
        </label>
        <input
          id="code"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]*"
          maxLength={6}
          placeholder="••••••"
          className="field text-center text-2xl font-semibold tracking-[0.5em]"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          autoFocus
        />
      </div>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <button type="submit" disabled={busy} className="btn-primary w-full">
        {busy ? "Checking…" : "Sign in"}
      </button>
      <div className="flex justify-between text-sm">
        <button type="button" className="py-2 text-muted" onClick={() => setStep("email")}>
          Change email
        </button>
        <button type="button" className="py-2 font-medium text-brand" disabled={busy} onClick={() => sendCode()}>
          Resend code
        </button>
      </div>
    </form>
  );
}
