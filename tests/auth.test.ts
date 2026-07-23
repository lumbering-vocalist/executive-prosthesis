import { beforeAll, beforeEach, expect, test } from "vitest";
import { convexTest } from "convex-test";
import { exportJWK, exportPKCS8, generateKeyPair } from "jose";
import { api, internal } from "../convex/_generated/api";
import schema from "../convex/schema";

// Same glob rationale as convex-harness.test.ts: globs must live in this
// repo's test files so Vite resolves our modules.
const modules = {
  ...import.meta.glob("../convex/*.ts"),
  ...import.meta.glob("../convex/_generated/*.js"),
};

const FOUNDER = "founder@example.com";
const PASSWORD = "correct-horse-battery-staple";
const SETUP_TOKEN = "test-setup-token";

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
  process.env.AUTH_SETUP_TOKEN = SETUP_TOKEN;
});

function signUpParams(overrides: Record<string, string> = {}) {
  return {
    provider: "password",
    params: {
      email: FOUNDER,
      password: PASSWORD,
      flow: "signUp",
      setupToken: SETUP_TOKEN,
      ...overrides,
    },
  };
}

test("authed functions reject unauthenticated callers", async () => {
  const t = convexTest(schema, modules);
  await expect(t.query(api.users.viewer, {})).rejects.toThrow(/Not signed in/);
});

test("authed functions see the signed-in user via ctx.userId", async () => {
  const t = convexTest(schema, modules);
  const userId = await t.run(async (ctx) =>
    ctx.db.insert("users", { email: FOUNDER }),
  );
  // Convex Auth JWTs carry `userId|sessionId` in the subject claim;
  // getAuthUserId reads the part before the divider.
  const asFounder = t.withIdentity({ subject: `${userId}|test-session` });
  expect(await asFounder.query(api.users.viewer, {})).toEqual({
    email: FOUNDER,
  });
});

test("a session whose user row was deleted is no longer a principal", async () => {
  // Review P1: the JWT subject alone must not stay valid until token expiry —
  // requireUserId re-checks the row on every request.
  const t = convexTest(schema, modules);
  const userId = await t.run(async (ctx) => {
    const id = await ctx.db.insert("users", { email: FOUNDER });
    await ctx.db.delete(id);
    return id;
  });
  const ghost = t.withIdentity({ subject: `${userId}|test-session` });
  await expect(ghost.query(api.users.viewer, {})).rejects.toThrow(
    /Not signed in/,
  );
});

test("rotating AUTH_ALLOWED_EMAIL revokes already-issued sessions", async () => {
  // Review P1: refresh-token exchange never re-runs the profile allowlist
  // check, so revocation must happen per-request.
  const t = convexTest(schema, modules);
  const userId = await t.run(async (ctx) =>
    ctx.db.insert("users", { email: FOUNDER }),
  );
  const asFounder = t.withIdentity({ subject: `${userId}|test-session` });
  expect(await asFounder.query(api.users.viewer, {})).toEqual({
    email: FOUNDER,
  });
  process.env.AUTH_ALLOWED_EMAIL = "successor@example.com";
  await expect(asFounder.query(api.users.viewer, {})).rejects.toThrow(
    /not allowed/,
  );
});

test("checkPrincipal (the authedAction path) runs the same principal checks", async () => {
  const t = convexTest(schema, modules);
  await expect(t.query(internal.functions.checkPrincipal, {})).rejects.toThrow(
    /Not signed in/,
  );
  const userId = await t.run(async (ctx) =>
    ctx.db.insert("users", { email: FOUNDER }),
  );
  const asFounder = t.withIdentity({ subject: `${userId}|test-session` });
  expect(await asFounder.query(internal.functions.checkPrincipal, {})).toBe(
    userId,
  );
});

test("sign-up with token + allowlisted email creates exactly one normalized user", async () => {
  const t = convexTest(schema, modules);
  const result = await t.action(
    api.auth.signIn,
    signUpParams({ email: " Founder@Example.COM " }),
  );
  expect(result.tokens).not.toBeNull();
  const users = await t.run(async (ctx) => ctx.db.query("users").collect());
  expect(users).toHaveLength(1);
  expect(users[0].email).toBe(FOUNDER);

  // Signing in again reuses the account instead of minting a second user —
  // and needs no setup token.
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
    t.action(api.auth.signIn, signUpParams({ email: "intruder@example.com" })),
  ).rejects.toThrow();
  const users = await t.run(async (ctx) => ctx.db.query("users").collect());
  expect(users).toEqual([]);
});

test("fail-closed: sign-up is rejected while AUTH_ALLOWED_EMAIL is unset", async () => {
  delete process.env.AUTH_ALLOWED_EMAIL;
  const t = convexTest(schema, modules);
  await expect(t.action(api.auth.signIn, signUpParams())).rejects.toThrow();
  expect(await t.run(async (ctx) => ctx.db.query("users").collect())).toEqual([]);
});

test("P0 gate: sign-up without the setup token is rejected and mints nothing", async () => {
  const t = convexTest(schema, modules);
  const params: Record<string, string> = { ...signUpParams().params };
  delete params.setupToken;
  await expect(
    t.action(api.auth.signIn, { provider: "password", params }),
  ).rejects.toThrow(/setup token/);
  expect(await t.run(async (ctx) => ctx.db.query("users").collect())).toEqual([]);
});

test("P0 gate: a wrong setup token is rejected and mints nothing", async () => {
  const t = convexTest(schema, modules);
  await expect(
    t.action(api.auth.signIn, signUpParams({ setupToken: "guessed-token" })),
  ).rejects.toThrow(/not valid/);
  expect(await t.run(async (ctx) => ctx.db.query("users").collect())).toEqual([]);
});

test("P0 gate fail-closed: unset AUTH_SETUP_TOKEN disables sign-up entirely", async () => {
  // The steady state after the founder claims the account: token unset,
  // sign-up impossible even with the correct email, password, and any token.
  delete process.env.AUTH_SETUP_TOKEN;
  const t = convexTest(schema, modules);
  await expect(t.action(api.auth.signIn, signUpParams())).rejects.toThrow(
    /disabled/,
  );
  expect(await t.run(async (ctx) => ctx.db.query("users").collect())).toEqual([]);
});

test("P1 policy: passwords under 12 characters are rejected on sign-up", async () => {
  const t = convexTest(schema, modules);
  await expect(
    t.action(api.auth.signIn, signUpParams({ password: "short-pw" })),
  ).rejects.toThrow();
  expect(await t.run(async (ctx) => ctx.db.query("users").collect())).toEqual([]);
});

test("P1 invariant: a second user can never be minted", async () => {
  // Even with a valid setup token and the allowlisted email, sign-up cannot
  // insert alongside an existing user row — exactly-one-user is a DB
  // invariant in createOrUpdateUser, not a hope.
  const t = convexTest(schema, modules);
  await t.run(async (ctx) => {
    await ctx.db.insert("users", { email: FOUNDER });
  });
  await expect(t.action(api.auth.signIn, signUpParams())).rejects.toThrow(
    /already exists/,
  );
  expect(await t.run(async (ctx) => ctx.db.query("users").collect())).toHaveLength(1);
});
