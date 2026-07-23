import { getAuthUserId } from "@convex-dev/auth/server";
import {
  customAction,
  customCtx,
  customMutation,
  customQuery,
} from "convex-helpers/server/customFunctions";
import { action, internalQuery, mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { assertAllowedEmail } from "./allowlist";

/*
 * The public/internal split (T2, engineering-plan.md §14).
 *
 * Every public function asserts the caller is the signed-in user —
 * structurally, not by convention: this module is the only place allowed to
 * touch the raw public builders (`query`/`mutation`/`action`), enforced by
 * tests/function-split.test.ts. Everything else uses these wrappers or the
 * `internal*` builders. Convex Auth's own public surface (signIn/signOut/
 * store/isAuthenticated in auth.ts, routed in http.ts) is the one sanctioned
 * unauthenticated exception — it is how a session comes to exist.
 *
 * Handlers receive `ctx.userId` so downstream code never re-derives identity.
 *
 * Pre-T3 hardening (review P1): a JWT subject alone is not a principal. Every
 * request re-checks that the user row still exists (a deleted user's session
 * dies immediately, not at access-token expiry) and that the user's email
 * still matches AUTH_ALLOWED_EMAIL — so rotating the allowlist revokes
 * already-issued sessions, which the refresh-token exchange would otherwise
 * keep alive without ever re-running the provider's profile check.
 */

async function requireUserId(
  ctx: QueryCtx | MutationCtx,
): Promise<Id<"users">> {
  const userId = await getAuthUserId(ctx);
  if (userId === null) {
    throw new Error("Not signed in");
  }
  const user = await ctx.db.get(userId);
  if (user === null) {
    // Valid-looking JWT, no user row: a deleted principal, not a caller.
    throw new Error("Not signed in");
  }
  // Fail-closed on a missing email too — assertAllowedEmail throws on
  // non-strings, so an anomalous user row cannot slip through.
  assertAllowedEmail(user.email, process.env.AUTH_ALLOWED_EMAIL);
  return userId;
}

export const authedQuery = customQuery(
  query,
  customCtx(async (ctx) => ({ userId: await requireUserId(ctx) })),
);

export const authedMutation = customMutation(
  mutation,
  customCtx(async (ctx) => ({ userId: await requireUserId(ctx) })),
);

// Actions have no ctx.db, so the principal checks run in an internal query
// (auth identity propagates into ctx.runQuery). Internal builders are allowed
// anywhere; this one lives here so the checks stay in one module.
export const checkPrincipal = internalQuery({
  args: {},
  handler: async (ctx) => requireUserId(ctx),
});

export const authedAction = customAction(
  action,
  // The explicit return type breaks a type-inference cycle: this module's
  // types feed the generated `internal` object, which is referenced here.
  customCtx(async (ctx): Promise<{ userId: Id<"users"> }> => ({
    userId: await ctx.runQuery(internal.functions.checkPrincipal, {}),
  })),
);
