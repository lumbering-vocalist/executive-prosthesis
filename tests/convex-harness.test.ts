import { expect, test } from "vitest";
import { convexTest } from "convex-test";
import { internal } from "../convex/_generated/api";
import schema from "../convex/schema";

// Globs must live here (not inside convex-test) so Vite resolves this repo's
// modules; convex-test consumes the map. `_generated` is globbed explicitly —
// convex-test locates the functions root from it.
const modules = {
  ...import.meta.glob("../convex/*.ts"),
  ...import.meta.glob("../convex/_generated/*.js"),
};

test("convex-test harness runs a query end-to-end", async () => {
  const t = convexTest(schema, modules);
  expect(await t.query(internal.health.ping, {})).toBe("ok");
});
