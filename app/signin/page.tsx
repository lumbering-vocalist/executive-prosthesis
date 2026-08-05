"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import * as Sentry from "@sentry/nextjs";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { NOT_CONFIGURED, PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "@/lib/auth-policy";

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

// The two failure classes need different copy — "try again" is wrong advice
// when the server is unreachable — and only infrastructure failures are
// Sentry-worthy (§13); a mistyped password is not an app error, and
// capturing every attempt would be noise.
//
// Beyond transport errors, this also catches the shapes a broken deployment
// produces: an HTML error page from the edge (JSON.parse SyntaxError on the
// auth proxy's response) and the module's own fail-closed configuration
// errors, which are the likeliest first-run failure and must not read as
// "you typed it wrong". Exported for tests.
export function isInfrastructureError(error: unknown): boolean {
  if (error instanceof TypeError) return true;
  // A ConvexError payload survives Convex's production redaction, which is
  // how a misconfigured deployment stays distinguishable from a wrong
  // password (plain server errors all arrive as "[CONVEX] Server Error").
  const data = (error as { data?: { code?: unknown } } | null)?.data;
  if (data?.code === NOT_CONFIGURED) return true;
  if (!(error instanceof Error)) return false;
  return (
    error instanceof SyntaxError ||
    /fetch|network|connect|timed out/i.test(error.message)
  );
}

// The Convex client queues action calls while its WebSocket is down instead
// of rejecting, so on a flaky mobile network — this PWA's whole environment —
// an un-raced signIn never settles: the button stays disabled and nothing is
// ever said. Bound the wait so silence becomes a message.
const SIGN_IN_TIMEOUT_MS = 20_000;

class SignInTimeout extends Error {
  constructor() {
    super("Sign-in timed out waiting for the server");
  }
}

/*
 * The timed-out call is NOT cancelled — Convex has no abort for an in-flight
 * action, and it may still land. Left unhandled during first-run setup that
 * would silently create the account with a password the founder was just
 * told had failed. So the original promise keeps its handlers: a late
 * success navigates on, a late failure is swallowed (the timeout message is
 * already on screen).
 */
function withTimeout<T>(work: Promise<T>, onLateSuccess: () => void): Promise<T> {
  let timedOut = false;
  work.then(
    () => {
      if (timedOut) onLateSuccess();
    },
    () => {},
  );
  return Promise.race([
    work,
    new Promise<never>((_, reject) =>
      setTimeout(() => {
        timedOut = true;
        reject(new SignInTimeout());
      }, SIGN_IN_TIMEOUT_MS),
    ),
  ]);
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
      await withTimeout(signIn("password", formData), () => router.push("/"));
      router.push("/");
    } catch (caught) {
      // Never echo what was typed (§13); keep the tone calm.
      if (caught instanceof SignInTimeout) {
        Sentry.captureException(caught);
        setError(
          "The server is taking longer than expected. This may still go through — give it a moment before trying again.",
        );
      } else if (isInfrastructureError(caught)) {
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
          maxLength={PASSWORD_MAX_LENGTH}
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
              maxLength={PASSWORD_MAX_LENGTH}
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
