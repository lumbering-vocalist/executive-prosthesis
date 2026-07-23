import { authedQuery } from "./functions";

// The signed-in user's own record — T2's proof that the authed path works
// end-to-end, and the home screen's quiet "signed in as" line.
export const viewer = authedQuery({
  args: {},
  handler: async (ctx) => {
    const user = await ctx.db.get(ctx.userId);
    return { email: user?.email ?? null };
  },
});
