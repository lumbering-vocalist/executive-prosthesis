import { getAuthUserId } from "@convex-dev/auth/server";
import {
  customAction,
  customCtx,
  customMutation,
  customQuery,
} from "convex-helpers/server/customFunctions";
import { action, mutation, query } from "./_generated/server";
import type { ActionCtx, MutationCtx, QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

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
 */

async function requireUserId(
  ctx: QueryCtx | MutationCtx | ActionCtx,
): Promise<Id<"users">> {
  const userId = await getAuthUserId(ctx);
  if (userId === null) {
    throw new Error("Not signed in");
  }
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

export const authedAction = customAction(
  action,
  customCtx(async (ctx) => ({ userId: await requireUserId(ctx) })),
);
