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
 * Hardened pre-T3 (review P2): the scan recurses into subdirectories (Convex
 * supports nested function modules), matches both quote styles and optional
 * `.js` extensions, catches re-exports, and bans the `*Generic` public
 * builders importable straight from "convex/server".
 *
 * Sources are read via Vite's raw import so this test needs no fs access in
 * the edge runtime.
 */

const sources = import.meta.glob(
  ["../convex/**/*.ts", "!../convex/_generated/**"],
  {
    query: "?raw",
    import: "default",
    eager: true,
  },
) as Record<string, string>;

const PUBLIC_BUILDERS = ["query", "mutation", "action", "httpAction"];
// The same builders under their "convex/server" spellings — importable
// without touching _generated at all.
const PUBLIC_GENERIC_BUILDERS = [
  "queryGeneric",
  "mutationGeneric",
  "actionGeneric",
  "httpActionGeneric",
];
const SANCTIONED = ["../convex/functions.ts"];

// Any module specifier that resolves to the generated server module, from any
// nesting depth ("./_generated/server", "../_generated/server", with or
// without ".js"), in either quote style.
const GENERATED_SERVER = String.raw`["'][^"']*_generated\/server(?:\.js)?["']`;
const CONVEX_SERVER = String.raw`["']convex\/server["']`;

function namedImports(source: string, moduleSpec: string) {
  // Captures the brace list of `import { ... } from "<module>"`; group 1 is a
  // whole-statement `type` qualifier, group 2 the specifier list.
  const re = new RegExp(
    String.raw`import\s+(type\s+)?\{([^}]*)\}\s*from\s*` + moduleSpec,
    "g",
  );
  return [...source.matchAll(re)];
}

function bannedNames(names: string, banned: string[]): string[] {
  return names
    .split(",")
    .map((n) => n.trim())
    .filter((n) => n !== "" && !n.startsWith("type ")) // per-specifier type imports can't execute
    .map((n) => n.split(/\s+as\s+/)[0])
    .filter((n) => banned.includes(n));
}

test("only functions.ts imports the raw public builders", () => {
  for (const [file, source] of Object.entries(sources)) {
    if (SANCTIONED.includes(file)) continue;
    for (const [, typeOnly, names] of namedImports(source, GENERATED_SERVER)) {
      if (typeOnly) continue;
      const banned = bannedNames(names, PUBLIC_BUILDERS);
      expect(
        banned,
        `${file} imports public builder(s) [${banned.join(", ")}] — use the ` +
          `authed* wrappers from convex/functions.ts or the internal* builders`,
      ).toEqual([]);
    }
  }
});

test("no module reaches the public builders via convex/server generics", () => {
  // queryGeneric/mutationGeneric/actionGeneric/httpActionGeneric are the same
  // public builders, importable from "convex/server" without touching
  // _generated. A namespace import of convex/server puts them in reach too.
  for (const [file, source] of Object.entries(sources)) {
    if (SANCTIONED.includes(file)) continue;
    for (const [, typeOnly, names] of namedImports(source, CONVEX_SERVER)) {
      if (typeOnly) continue;
      const banned = bannedNames(names, PUBLIC_GENERIC_BUILDERS);
      expect(
        banned,
        `${file} imports generic public builder(s) [${banned.join(", ")}] ` +
          `from convex/server — use the authed* wrappers from ` +
          `convex/functions.ts or the internal* builders`,
      ).toEqual([]);
    }
    const namespace = new RegExp(
      String.raw`import\s+\*\s+as\s+\w+\s*from\s*` + CONVEX_SERVER,
    ).test(source);
    expect(
      namespace,
      `${file} namespace-imports convex/server, which reaches the *Generic ` +
        `public builders — import what you need by name`,
    ).toBe(false);
  }
});

test("no module smuggles builders via namespace, default, or dynamic imports", () => {
  // `import * as server from "./_generated/server"` would put the raw public
  // builders in reach without tripping the named-import check above. Type-only
  // namespace imports (`import type * as`) stay allowed — they can't execute.
  for (const [file, source] of Object.entries(sources)) {
    if (SANCTIONED.includes(file)) continue;
    const smuggled =
      new RegExp(
        String.raw`import\s+(\*\s+as\s+\w+|\w+\s*,|\w+\s+from)[^;]*` +
          GENERATED_SERVER,
      ).test(source) ||
      new RegExp(String.raw`import\s*\(\s*` + GENERATED_SERVER + String.raw`\s*\)`).test(
        source,
      );
    expect(
      smuggled,
      `${file} imports ./_generated/server via a namespace/default/dynamic ` +
        `import — use the authed* wrappers from convex/functions.ts or the ` +
        `internal* builders`,
    ).toBe(false);
  }
});

test("no module re-exports from _generated/server", () => {
  // `export { query } from "./_generated/server"` (or `export *`) hands the
  // raw builders to other modules without any import this suite would see.
  // `export type` stays allowed — types can't execute.
  for (const [file, source] of Object.entries(sources)) {
    if (SANCTIONED.includes(file)) continue;
    const reExported = new RegExp(
      String.raw`export\s+(?!type\b)[^;]*from\s*` + GENERATED_SERVER,
    ).test(source);
    expect(
      reExported,
      `${file} re-exports from ./_generated/server — the raw builders must ` +
        `not escape convex/functions.ts`,
    ).toBe(false);
  }
});

test("the sanctioned file list still matches the repo", () => {
  // If functions.ts is renamed or removed, the tests above would silently
  // enforce nothing extra; fail loudly instead.
  for (const file of SANCTIONED) {
    expect(sources[file], `${file} missing but sanctioned`).toBeDefined();
  }
  // And the glob itself must still be finding the codebase.
  expect(Object.keys(sources).length).toBeGreaterThan(1);
});
