"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import * as Sentry from "@sentry/nextjs";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

/*
 * Route-segment error boundary (pre-T3 hardening, review P2): a throwing
 * page — e.g. an authed query racing an auth desync during token refresh —
 * lands here instead of blowing away the whole layout via global-error.
 * Captured explicitly; tone per §4.5: calm, the system's responsibility,
 * never red.
 *
 * "Sign out" is the escape hatch, not a convenience: a revoked principal
 * (rotated AUTH_ALLOWED_EMAIL, deleted user row) throws from the page's
 * authed query, so the page's own sign-out button never renders — and the
 * middleware still sees a valid JWT cookie, so /signin redirects back here.
 * Without this button, "Try again" just re-throws forever and the only exit
 * is clearing site data.
 */
export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { signOut } = useAuthActions();
  const router = useRouter();

  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <div
      style={{
        display: "grid",
        placeItems: "center",
        // Renders inside layout's app-column, which reserves --dock-clearance
        // below; subtract it (and use dvh for the iOS PWA) so this calmly
        // centered screen never scrolls.
        minHeight: "calc(100dvh - var(--dock-clearance))",
        textAlign: "center",
        padding: "var(--space-5)",
      }}
    >
      <div>
        <p>
          Something went wrong on my end — your captures are safe on this
          phone.
        </p>
        <button
          onClick={reset}
          style={{
            marginTop: "var(--space-4)",
            minHeight: "var(--tap-min)",
            padding: "var(--space-2) var(--space-5)",
            borderRadius: "var(--radius)",
            border: "none",
            background: "var(--color-accent)",
            color: "var(--color-on-accent)",
            fontSize: "var(--font-size-body)",
            fontFamily: "inherit",
            cursor: "pointer",
          }}
        >
          Try again
        </button>
        <div>
          <button
            className="signin-flow-toggle"
            type="button"
            onClick={async () => {
              try {
                await signOut();
              } catch (signOutError) {
                Sentry.captureException(signOutError);
              }
              router.push("/signin");
            }}
          >
            Sign out instead
          </button>
        </div>
      </div>
    </div>
  );
}
