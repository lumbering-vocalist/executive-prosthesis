"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

/*
 * Route-segment error boundary (pre-T3 hardening, review P2): a throwing
 * page — e.g. an authed query racing an auth desync during token refresh —
 * lands here instead of blowing away the whole layout via global-error.
 * Captured explicitly; tone per §4.5: calm, the system's responsibility,
 * never red.
 */
export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
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
      </div>
    </div>
  );
}
