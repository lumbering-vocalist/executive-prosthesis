import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";
import type { DataModel } from "./_generated/dataModel";
import {
  assertAllowedEmail,
  assertPasswordBounded,
  assertPasswordStrength,
  assertSetupToken,
  normalizeEmail,
} from "./allowlist";

/*
 * T2 (engineering-plan.md §14) + pre-T3 hardening: Convex Auth, Password
 * provider, single-user allowlist, setup-token-gated account creation.
 *
 * Password — not magic link or OAuth — because the installed iOS PWA's
 * storage is fully partitioned from Safari (the same fact §5.5's digest law
 * rests on): an emailed link opens Safari and strands the session outside the
 * installed app. Password keeps the whole flow inside the PWA, with no OAuth
 * vendor and no dependency on email delivery (Resend lands at T5).
 *
 * The allowlist is asserted twice, both fail-closed:
 * - Password `profile`: runs on every flow of this provider
 *   (signUp / signIn / reset / verification)
 * - `createOrUpdateUser`: provider-independent backstop — a future provider
 *   added without its own check still cannot mint a user
 *
 * The signUp flow is additionally gated on AUTH_SETUP_TOKEN (review P0: the
 * email alone is knowledge, not authorization). The gate throws inside
 * `profile`, which the provider runs before any account lookup or scrypt
 * work — so an unauthorized signUp also cannot be used as an unthrottled
 * password oracle or a hashing-cost DoS (review P1). While the token is
 * unset — the steady state after the founder claims the account — signUp is
 * disabled entirely.
 */
export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Password<DataModel>({
      profile(params) {
        if (params.flow === "signUp") {
          assertSetupToken(params.setupToken, process.env.AUTH_SETUP_TOKEN);
        }
        // The provider validates password length on signUp and reset only,
        // so signIn would otherwise hand scrypt an unbounded string. Bound
        // it on every flow; `profile` runs before any hashing.
        assertPasswordBounded(params.password);
        return {
          email: assertAllowedEmail(
            params.email,
            process.env.AUTH_ALLOWED_EMAIL,
          ),
        };
      },
      validatePasswordRequirements: assertPasswordStrength,
    }),
  ],
  callbacks: {
    async createOrUpdateUser(ctx, { existingUserId, profile }) {
      const email = assertAllowedEmail(
        profile.email,
        process.env.AUTH_ALLOWED_EMAIL,
      );
      if (existingUserId !== null) {
        return existingUserId;
      }
      const existing = await ctx.db.query("users").first();
      if (existing === null) {
        return ctx.db.insert("users", { email });
      }
      // Rotation reclaim: the per-request allowlist check in functions.ts
      // revokes sessions the moment AUTH_ALLOWED_EMAIL changes, which would
      // otherwise be a one-way door — the stale row fails every authed call,
      // signIn on the old address fails the allowlist, and a fresh signUp on
      // the new one would hit the single-user invariant below. So when the
      // stored row is no longer allowlisted, a sign-up carrying a valid setup
      // token re-points that one row at the new address instead of throwing.
      // (The old provider account survives but can never authenticate: its
      // email fails the allowlist in `profile`.)
      if (normalizeEmail(existing.email ?? "") !== email) {
        await ctx.db.patch(existing._id, { email });
        return existing._id;
      }
      // "Exactly one user" as a DB invariant, not a hope: a second insert —
      // whatever provider or race produced it — fails here rather than
      // creating a split-brain account (review P1).
      throw new Error(
        "This is a single-user system; the account already exists",
      );
    },
  },
});
