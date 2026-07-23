import { defineSchema } from "convex/server";
import { authTables } from "@convex-dev/auth/server";

// Domain tables land at T3 (engineering-plan.md §3). T2 adds only Convex
// Auth's own tables (users, authAccounts, authSessions, ...).
export default defineSchema({
  ...authTables,
});
