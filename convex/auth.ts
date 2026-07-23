import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";
import type { DataModel } from "./_generated/dataModel";
import { assertAllowedEmail } from "./allowlist";

/*
 * T2 (engineering-plan.md §14): Convex Auth, Password provider, single-user
 * allowlist.
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
 */
export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Password<DataModel>({
      profile(params) {
        return {
          email: assertAllowedEmail(
            params.email,
            process.env.AUTH_ALLOWED_EMAIL,
          ),
        };
      },
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
      return ctx.db.insert("users", { email });
    },
  },
});
