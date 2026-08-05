"use client";

import { ConvexAuthNextjsProvider } from "@convex-dev/auth/nextjs";
import { ConvexReactClient } from "convex/react";
import type { ReactNode } from "react";

// NEXT_PUBLIC_CONVEX_URL comes from .env.local (written by
// `npx convex dev --configure`) locally, from Vercel env in production, and
// from a placeholder in CI (the build never opens a connection). A missing
// value must fail with its own name, not as whatever ConvexReactClient does
// with undefined — the CI placeholder means this slip only surfaces in a
// misconfigured prod deploy, where a nameable error is the difference
// between a one-line fix and archaeology.
const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
if (convexUrl === undefined || convexUrl === "") {
  throw new Error(
    "NEXT_PUBLIC_CONVEX_URL is not set — run `npx convex dev` locally or " +
      "set it in the deployment environment",
  );
}
const convex = new ConvexReactClient(convexUrl);

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  return (
    <ConvexAuthNextjsProvider client={convex}>
      {children}
    </ConvexAuthNextjsProvider>
  );
}
