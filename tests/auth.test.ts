import { beforeAll, beforeEach, expect, test } from "vitest";
import { convexTest } from "convex-test";
import { exportJWK, exportPKCS8, generateKeyPair } from "jose";
import { api } from "../convex/_generated/api";
import schema from "../convex/schema";

// Same glob rationale as convex-harness.test.ts: globs must live in this
// repo's test files so Vite resolves our modules.
const modules = {
  ...import.meta.glob("../convex/*.ts"),
  ...import.meta.glob("../convex/_generated/*.js"),
};

const FOUNDER = "founder@example.com";
const PASSWORD = "correct-horse-battery-staple";

// Convex Auth signs session JWTs on sign-in; give it a throwaway keypair so
// the real signIn action (auth.ts: Password profile + createOrUpdateUser)
// can run end-to-end inside convex-test.
beforeAll(async () => {
  const { privateKey, publicKey } = await generateKeyPair("RS256", {
    extractable: true,
  });
  process.env.JWT_PRIVATE_KEY = await exportPKCS8(privateKey);
  process.env.JWKS = JSON.stringify({
    keys: [{ use: "sig", ...(await exportJWK(publicKey)) }],
  });
  process.env.SITE_URL = "http://localhost:3000";
  process.env.CONVEX_SITE_URL = "https://test.convex.site";
});

beforeEach(() => {
  process.env.AUTH_ALLOWED_EMAIL = FOUNDER;
});

test("authed functions reject unauthenticated callers", async () => {
  const t = convexTest(schema, modules);
  await expect(t.query(api.users.viewer, {})).rejects.toThrow(/Not signed in/);
});

test("authed functions see the signed-in user via ctx.userId", async () => {
  const t = convexTest(schema, modules);
  const userId = await t.run(async (ctx) =>
    ctx.db.insert("users", { email: "founder@example.com" }),
  );
  // Convex Auth JWTs carry `userId|sessionId` in the subject claim;
  // getAuthUserId reads the part before the divider.
  const asFounder = t.withIdentity({ subject: `${userId}|test-session` });
  expect(await asFounder.query(api.users.viewer, {})).toEqual({
    email: "founder@example.com",
  });
});

test("viewer degrades to a null email when the user row is gone", async () => {
  // A valid session whose user was deleted (ctx.db.get returns null) must not
  // crash the home screen's "signed in as" line.
  const t = convexTest(schema, modules);
  const userId = await t.run(async (ctx) => {
    const id = await ctx.db.insert("users", { email: FOUNDER });
    await ctx.db.delete(id);
    return id;
  });
  const ghost = t.withIdentity({ subject: `${userId}|test-session` });
  expect(await ghost.query(api.users.viewer, {})).toEqual({ email: null });
});

test("sign-up with the allowlisted email creates exactly one normalized user", async () => {
  const t = convexTest(schema, modules);
  const result = await t.action(api.auth.signIn, {
    provider: "password",
    params: { email: " Founder@Example.COM ", password: PASSWORD, flow: "signUp" },
  });
  expect(result.tokens).not.toBeNull();
  const users = await t.run(async (ctx) => ctx.db.query("users").collect());
  expect(users).toHaveLength(1);
  expect(users[0].email).toBe(FOUNDER);

  // Signing in again reuses the account instead of minting a second user.
  const again = await t.action(api.auth.signIn, {
    provider: "password",
    params: { email: FOUNDER, password: PASSWORD, flow: "signIn" },
  });
  expect(again.tokens).not.toBeNull();
  expect(await t.run(async (ctx) => ctx.db.query("users").collect())).toHaveLength(1);

  // Wrong password is rejected by the Password provider.
  await expect(
    t.action(api.auth.signIn, {
      provider: "password",
      params: { email: FOUNDER, password: "not-the-password", flow: "signIn" },
    }),
  ).rejects.toThrow();
});

test("sign-up with a non-allowlisted email is rejected and mints nothing", async () => {
  const t = convexTest(schema, modules);
  await expect(
    t.action(api.auth.signIn, {
      provider: "password",
      params: { email: "intruder@example.com", password: PASSWORD, flow: "signUp" },
    }),
  ).rejects.toThrow();
  const users = await t.run(async (ctx) => ctx.db.query("users").collect());
  expect(users).toEqual([]);
});

test("fail-closed: sign-up is rejected while AUTH_ALLOWED_EMAIL is unset", async () => {
  delete process.env.AUTH_ALLOWED_EMAIL;
  const t = convexTest(schema, modules);
  await expect(
    t.action(api.auth.signIn, {
      provider: "password",
      params: { email: FOUNDER, password: PASSWORD, flow: "signUp" },
    }),
  ).rejects.toThrow();
  expect(await t.run(async (ctx) => ctx.db.query("users").collect())).toEqual([]);
});
