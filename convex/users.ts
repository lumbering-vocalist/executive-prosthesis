import { authedQuery } from "./functions";

// The signed-in user's own record — T2's proof that the authed path works
// end-to-end, and the home screen's quiet "signed in as" line.
export const viewer = authedQuery({
  args: {},
  handler: async (ctx) => {
    const user = await ctx.db.get(ctx.userId);
    // Unreachable-by-construction null branches: requireUserId already
    // guarantees the row exists and carries an allowlisted email. Kept as a
    // defensive fallback, not a live case.
    return { email: user?.email ?? null };
  },
});
