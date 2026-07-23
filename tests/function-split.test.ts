import { expect, test } from "vitest";

/*
 * Mechanical enforcement of T2's public/internal split (plan §14): the raw
 * public builders (`query`/`mutation`/`action`/`httpAction`) may only be
 * touched by convex/functions.ts, whose authed* wrappers assert the caller's
 * identity on every invocation. Every other module either uses the wrappers
 * or the `internal*` builders. Convex Auth's public surface (signIn/signOut/
 * store/isAuthenticated) is created by convexAuth() in auth.ts without
 * touching the builders, so it needs no exemption here — it is the sanctioned
 * unauthenticated exception by construction.
 *
 * Sources are read via Vite's raw import so this test needs no fs access in
 * the edge runtime.
 */

const sources = import.meta.glob("../convex/*.ts", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

const PUBLIC_BUILDERS = ["query", "mutation", "action", "httpAction"];
const SANCTIONED = ["../convex/functions.ts"];

test("only functions.ts imports the raw public builders", () => {
  for (const [file, source] of Object.entries(sources)) {
    if (SANCTIONED.includes(file)) continue;
    // Value imports from _generated/server; type-only imports are harmless.
    const imports = [
      ...source.matchAll(
        /import\s+(type\s+)?\{([^}]*)\}\s+from\s+"\.\/_generated\/server"/g,
      ),
    ];
    for (const [, typeOnly, names] of imports) {
      if (typeOnly) continue;
      const imported = names.split(",").map((n) => n.trim().split(/\s+as\s+/)[0]);
      const banned = imported.filter((n) => PUBLIC_BUILDERS.includes(n));
      expect(
        banned,
        `${file} imports public builder(s) [${banned.join(", ")}] — use the ` +
          `authed* wrappers from convex/functions.ts or the internal* builders`,
      ).toEqual([]);
    }
  }
});

test("no module smuggles builders via namespace or default imports", () => {
  // `import * as server from "./_generated/server"` would put the raw public
  // builders in reach without tripping the named-import check above. Type-only
  // namespace imports (`import type * as`) stay allowed — they can't execute.
  for (const [file, source] of Object.entries(sources)) {
    if (SANCTIONED.includes(file)) continue;
    const smuggled =
      /import\s+(\*\s+as\s+\w+|\w+\s*,|\w+\s+from)[^;]*"\.\/_generated\/server"/.test(
        source,
      ) || /import\s*\(\s*["']\.\/_generated\/server["']\s*\)/.test(source);
    expect(
      smuggled,
      `${file} imports ./_generated/server via a namespace/default/dynamic ` +
        `import — use the authed* wrappers from convex/functions.ts or the ` +
        `internal* builders`,
    ).toBe(false);
  }
});

test("the sanctioned file list still matches the repo", () => {
  // If functions.ts is renamed or removed, the test above would silently
  // enforce nothing extra; fail loudly instead.
  for (const file of SANCTIONED) {
    expect(sources[file], `${file} missing but sanctioned`).toBeDefined();
  }
});
