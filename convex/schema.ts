import { defineSchema } from "convex/server";

// Tables land at T3 (engineering-plan.md §3). T1 ships the empty schema so
// codegen, convex-test, and CI are proven before any data exists.
export default defineSchema({});
