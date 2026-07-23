"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

/*
 * The one unauthenticated page (T2). Single user, so no marketing shell —
 * just the promise and the form. First run uses "First time here?" to create
 * the account; only the allowlisted email can (convex/allowlist.ts).
 * Errors use the degraded amber, never red (§4.5 no-shame family).
 */
export default function SignInPage() {
  const { signIn } = useAuthActions();
  const router = useRouter();
  const [flow, setFlow] = useState<"signIn" | "signUp">("signIn");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    formData.set("flow", flow);
    setBusy(true);
    setError(null);
    try {
      await signIn("password", formData);
      router.push("/");
    } catch {
      // Never echo what was typed (§13); keep the tone calm.
      setError(
        flow === "signIn"
          ? "That didn't match. Take your time and try again."
          : "Couldn't create the account. This is a single-person system — only the configured email works.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="signin">
      <h1 className="signin-title">Prosthesis</h1>
      <p className="signin-promise">
        Tell me things. I keep them, no matter what.
      </p>
      <form onSubmit={handleSubmit} className="signin-form">
        <label className="signin-label" htmlFor="email">
          Email
        </label>
        <input
          className="signin-input"
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
        />
        <label className="signin-label" htmlFor="password">
          Password
        </label>
        <input
          className="signin-input"
          id="password"
          name="password"
          type="password"
          autoComplete={flow === "signIn" ? "current-password" : "new-password"}
          required
        />
        {error !== null && (
          <p className="signin-error" role="alert">
            {error}
          </p>
        )}
        <button className="signin-submit" type="submit" disabled={busy}>
          {flow === "signIn" ? "Sign in" : "Create the account"}
        </button>
      </form>
      <button
        className="signin-flow-toggle"
        type="button"
        onClick={() => {
          setFlow(flow === "signIn" ? "signUp" : "signIn");
          setError(null);
        }}
      >
        {flow === "signIn" ? "First time here?" : "Already set up? Sign in"}
      </button>
    </div>
  );
}
