import { afterEach, beforeEach, expect, test, vi } from "vitest";

/*
 * The module-scope env guard in app/ConvexClientProvider.tsx. CI builds with a
 * placeholder URL, so a missing NEXT_PUBLIC_CONVEX_URL only ever surfaces in a
 * misconfigured production deploy — the one place where the difference between
 * a named error and whatever ConvexReactClient(undefined) does is the
 * difference between a one-line fix and archaeology. That makes the guard
 * worth a test even though the component it wraps needs a browser.
 *
 * The guard runs at import time, so each case re-imports with modules reset.
 */

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

const load = () => import("../app/ConvexClientProvider");

test("an unset NEXT_PUBLIC_CONVEX_URL fails with its own name", async () => {
  vi.stubEnv("NEXT_PUBLIC_CONVEX_URL", undefined);
  await expect(load()).rejects.toThrow(/NEXT_PUBLIC_CONVEX_URL is not set/);
});

test("an empty NEXT_PUBLIC_CONVEX_URL is treated as unset, not passed through", async () => {
  // "" is what a declared-but-blank Vercel env var looks like; it must not
  // reach ConvexReactClient.
  vi.stubEnv("NEXT_PUBLIC_CONVEX_URL", "");
  await expect(load()).rejects.toThrow(/NEXT_PUBLIC_CONVEX_URL is not set/);
});

test("the error names the fix, not just the problem", async () => {
  vi.stubEnv("NEXT_PUBLIC_CONVEX_URL", "");
  await expect(load()).rejects.toThrow(/convex dev/);
});

test("a configured URL loads the provider without throwing", async () => {
  vi.stubEnv("NEXT_PUBLIC_CONVEX_URL", "https://placeholder.convex.cloud");
  const mod = await load();
  expect(typeof mod.ConvexClientProvider).toBe("function");
});
