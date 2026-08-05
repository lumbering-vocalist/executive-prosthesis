import { expect, test } from "vitest";

/*
 * The middleware matcher is the auth perimeter for pages (review P2: the old
 * "anything with a dot" exclusion was a latent bypass — /export/data.json
 * would have skipped auth entirely). The handler itself needs a Next request
 * and a live Convex session, but the matcher is pure regex and is the part
 * that decides whether auth runs at all, so it gets tested here.
 *
 * The pattern is read from proxy.ts as raw source rather than duplicated, so
 * editing the matcher without updating this test fails loudly. Next compiles
 * `config.matcher` entries as whole-pathname matches, which is what the
 * ^...$ wrapper reproduces.
 */

const sources = import.meta.glob("../proxy.ts", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

const source = Object.values(sources)[0];

test("the matcher source is still where this test thinks it is", () => {
  expect(source, "proxy.ts not found by the raw glob").toBeDefined();
  expect(source).toContain("matcher");
});

function matcherPatterns(): string[] {
  const block = /matcher:\s*\[([\s\S]*?)\]/.exec(source);
  expect(block, "could not find config.matcher in proxy.ts").not.toBeNull();
  const patterns = [...block![1].matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((m) =>
    // The source is a JS string literal; unescape it the same way the module
    // loader would.
    JSON.parse(`"${m[1]}"`),
  );
  expect(patterns.length).toBeGreaterThan(0);
  return patterns;
}

function runsAuth(pathname: string): boolean {
  return matcherPatterns().some((p) => new RegExp(`^${p}$`).test(pathname));
}

test("every page route runs the auth middleware", () => {
  for (const path of ["/", "/signin", "/held", "/settings/export"]) {
    expect(runsAuth(path), path).toBe(true);
  }
});

test("the pre-auth static surface is excluded so the PWA stays installable", () => {
  for (const path of [
    "/_next/static/chunks/main.js",
    "/icons/icon-192.png",
    "/fonts/figtree-latin-var.woff2",
    "/favicon.ico",
    "/manifest.webmanifest",
  ]) {
    expect(runsAuth(path), path).toBe(false);
  }
});

test("a dotted data route is protected — the P2 bypass stays closed", () => {
  // The whole point of enumerating assets instead of excluding "anything with
  // a dot": future routes that end in a file extension must still hit auth.
  for (const path of [
    "/export/data.json",
    "/captures.json",
    "/api/backup.csv",
    "/notes/2026-08-05.md",
  ]) {
    expect(runsAuth(path), path).toBe(true);
  }
});

test("exclusions are anchored — no prefix or suffix smuggling", () => {
  // "/favicon.ico$" and "/manifest.webmanifest$" are end-anchored, and the
  // directory exclusions require the trailing slash, so none of these can be
  // used to slip a protected path past the matcher.
  for (const path of [
    "/favicon.ico/../held",
    "/favicon.icons",
    "/manifest.webmanifest/held",
    "/_nextdoor",
    "/iconsmith",
    "/fontsize",
  ]) {
    expect(runsAuth(path), path).toBe(true);
  }
});

test("a new unlisted static asset fails safe (runs auth) rather than leaking", () => {
  expect(runsAuth("/apple-touch-icon.png")).toBe(true);
  expect(runsAuth("/sw.js")).toBe(true);
});
