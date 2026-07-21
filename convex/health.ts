import { internalQuery } from "./_generated/server";

// Smoke-test query: proves the Convex function layer and the convex-test
// harness end-to-end. Internal so no unauthenticated public surface exists
// before T2 auth lands. Real functions arrive with their owning steps.
export const ping = internalQuery({
  args: {},
  handler: async () => "ok" as const,
});
