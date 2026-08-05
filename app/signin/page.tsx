"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import * as Sentry from "@sentry/nextjs";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PASSWORD_MIN_LENGTH } from "@/convex/allowlist";

/*
 * The one unauthenticated page (T2). Single user, so no marketing shell —
 * just the promise and the form. First run uses "First time here?" to create
 * the account; it needs the allowlisted email (convex/allowlist.ts) AND the
 * one-time setup token (AUTH_SETUP_TOKEN — review P0: the email alone is
 * knowledge, not authorization), and asks for the password twice because no
 * reset path exists until Resend lands at T5 — a typo here would otherwise be
 * a permanent lockout. Errors use the degraded amber, never red (§4.5
 * no-shame family).
 */

// The Convex client surfaces network failures as fetch/connection errors;
// server-side rejections (wrong password, allowlist, setup token) arrive as
// generic server errors. The two need different copy — "try again" is wrong
// advice when the server is unreachable — and only infrastructure failures
// are Sentry-worthy (§13); a mistyped password is not an app error, and
// capturing every attempt would be noise. Exported for tests.
export function isInfrastructureError(error: unknown): boolean {
  return (
    error instanceof TypeError ||
    (error instanceof Error && /fetch|network|connect/i.test(error.message))
  );
}

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
    if (
      flow === "signUp" &&
      formData.get("password") !== formData.get("confirmPassword")
    ) {
      setError("Those passwords don't match. One more look before we set it.");
      return;
    }
    formData.delete("confirmPassword");
    setBusy(true);
    setError(null);
    try {
      await signIn("password", formData);
      router.push("/");
    } catch (caught) {
      // Never echo what was typed (§13); keep the tone calm.
      if (isInfrastructureError(caught)) {
        Sentry.captureException(caught);
        setError(
          "Couldn't reach the server just now. Your password wasn't the problem — check the connection and try again.",
        );
      } else {
        setError(
          flow === "signIn"
            ? "That didn't match. Take your time and try again."
            : "Couldn't create the account. This is a single-person system — check the email, the setup token, and the password.",
        );
      }
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
          minLength={flow === "signUp" ? PASSWORD_MIN_LENGTH : undefined}
          required
        />
        {flow === "signUp" && (
          <>
            <p className="signin-hint">
              At least {PASSWORD_MIN_LENGTH} characters.
            </p>
            <label className="signin-label" htmlFor="confirmPassword">
              Password again
            </label>
            <input
              className="signin-input"
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              minLength={PASSWORD_MIN_LENGTH}
              required
            />
            <label className="signin-label" htmlFor="setupToken">
              Setup token
            </label>
            <input
              className="signin-input"
              id="setupToken"
              name="setupToken"
              type="password"
              autoComplete="off"
              required
            />
            <p className="signin-hint">
              The one-time AUTH_SETUP_TOKEN from your deployment environment.
            </p>
          </>
        )}
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
