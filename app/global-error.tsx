"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import "./globals.css";

/*
 * Root-level render failures replace the whole layout, so this component must
 * render its own <html>/<body>. Captured explicitly — window-level handlers
 * don't reliably see root render errors. Tone per §4.5: calm, framed as the
 * system's responsibility, never red.
 */
export default function GlobalError({
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
    <html lang="en">
      <body
        style={{
          display: "grid",
          placeItems: "center",
          minHeight: "100vh",
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
      </body>
    </html>
  );
}
