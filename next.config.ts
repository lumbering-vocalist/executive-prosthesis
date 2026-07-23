import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Dev-only setting: Next 16 blocks dev-resource requests from origins other
  // than localhost, which leaves pages served at 127.0.0.1 unhydrated (dead
  // click handlers). Allow the loopback IP alias explicitly.
  allowedDevOrigins: ["127.0.0.1"],
  // Baseline hardening for an app that will hold personal capture data.
  // A full CSP needs Next's nonce plumbing — tracked in TODOS, pre-T4.
  headers: async () => [
    {
      source: "/:path*",
      headers: [
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains",
        },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      ],
    },
  ],
};

// Source-map upload only runs when SENTRY_AUTH_TOKEN is present (CI/deploy);
// local dev and CI-without-token build clean.
export default withSentryConfig(nextConfig, {
  silent: true,
  telemetry: false,
  // Replay code never reaches the client bundle (§13 posture). The primary
  // guarantee is that replayIntegration() is never added; these excludes are
  // belt-and-suspenders. (Debug-statement stripping is a no-op under
  // Turbopack builds, so it isn't relied on for page weight.)
  bundleSizeOptimizations: {
    excludeReplayIframe: true,
    excludeReplayShadowDom: true,
    excludeReplayWorker: true,
  },
});
