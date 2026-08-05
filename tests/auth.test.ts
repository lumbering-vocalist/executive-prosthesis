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
// Must clear both entropy floors in assertSetupToken (length + distinct
// chars) — a weak token is refused even when it matches exactly.
const SETUP_TOKEN = "test-setup-token-9f3c1a7e2b8d";

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

test("fail-closed: a user row with no email is not a principal", async () => {
  // requireUserId leans on assertAllowedEmail to reject non-strings, so an
  // anomalous row (Convex Auth's users.email is optional) can't slip through
  // as an authenticated caller.
  const t = convexTest(schema, modules);
  const userId = await t.run(async (ctx) => ctx.db.insert("users", {}));
  const anomalous = t.withIdentity({ subject: `${userId}|test-session` });
  await expect(anomalous.query(api.users.viewer, {})).rejects.toThrow(
    /requires an email/,
  );
  await expect(
    anomalous.query(internal.functions.checkPrincipal, {}),
  ).rejects.toThrow(/requires an email/);
});

test("fail-closed: unsetting AUTH_ALLOWED_EMAIL revokes live sessions", async () => {
  // Rotation is covered above; the unset case is the operational one (env var
  // dropped during a redeploy) and takes the "disabled" branch instead.
  const t = convexTest(schema, modules);
  const userId = await t.run(async (ctx) =>
    ctx.db.insert("users", { email: FOUNDER }),
  );
  const asFounder = t.withIdentity({ subject: `${userId}|test-session` });
  delete process.env.AUTH_ALLOWED_EMAIL;
  await expect(asFounder.query(api.users.viewer, {})).rejects.toThrow(
    /disabled/,
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

test("P1 policy: the password bounds hold through the real provider", async () => {
  // The unit test covers assertPasswordStrength directly; this proves it is
  // actually wired as validatePasswordRequirements on the signUp flow —
  // both ends of the range, against the live Password provider.
  const t = convexTest(schema, modules);
  await expect(
    t.action(api.auth.signIn, signUpParams({ password: "a".repeat(257) })),
  ).rejects.toThrow();
  expect(await t.run(async (ctx) => ctx.db.query("users").collect())).toEqual([]);

  const ok = await t.action(
    api.auth.signIn,
    signUpParams({ password: "a".repeat(12) }),
  );
  expect(ok.tokens).not.toBeNull();
  expect(
    await t.run(async (ctx) => ctx.db.query("users").collect()),
  ).toHaveLength(1);
});

test("the setup token is not required — and not accepted as a gate — on signIn", async () => {
  // The gate is scoped to the signUp flow: an existing account signs in with
  // no token at all, and a wrong token on signIn is simply an unused param
  // rather than a second lock (the password is the credential there).
  const t = convexTest(schema, modules);
  await t.action(api.auth.signIn, signUpParams());
  delete process.env.AUTH_SETUP_TOKEN;
  const again = await t.action(api.auth.signIn, {
    provider: "password",
    params: { email: FOUNDER, password: PASSWORD, flow: "signIn" },
  });
  expect(again.tokens).not.toBeNull();
  expect(
    await t.run(async (ctx) => ctx.db.query("users").collect()),
  ).toHaveLength(1);
});

test("a non-allowlisted email is rejected on signIn too, not just signUp", async () => {
  // profile() runs on every flow of the provider, so rotating the allowlist
  // locks out the old address at the front door as well as per-request.
  const t = convexTest(schema, modules);
  await t.action(api.auth.signIn, signUpParams());
  process.env.AUTH_ALLOWED_EMAIL = "successor@example.com";
  await expect(
    t.action(api.auth.signIn, {
      provider: "password",
      params: { email: FOUNDER, password: PASSWORD, flow: "signIn" },
    }),
  ).rejects.toThrow();
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

test("rotation is recoverable: sign-up on the new address reclaims the one row", async () => {
  // Rotating AUTH_ALLOWED_EMAIL revokes live sessions (above) — but if the
  // stale row could never be re-pointed, revocation would be a one-way door:
  // every authed call throws, signIn on the old address fails the allowlist,
  // and signIn on the new one has no account. A sign-up carrying a valid
  // setup token must reclaim the single row rather than hit the invariant.
  const t = convexTest(schema, modules);
  await t.action(api.auth.signIn, signUpParams());
  const SUCCESSOR = "successor@example.com";
  process.env.AUTH_ALLOWED_EMAIL = SUCCESSOR;

  const reclaimed = await t.action(
    api.auth.signIn,
    signUpParams({ email: SUCCESSOR, password: "a-new-long-password" }),
  );
  expect(reclaimed.tokens).not.toBeNull();

  const users = await t.run(async (ctx) => ctx.db.query("users").collect());
  expect(users).toHaveLength(1);
  expect(users[0].email).toBe(SUCCESSOR);

  // The successor can sign in; the old address cannot (it fails the
  // allowlist in `profile`, so its surviving provider account is inert).
  const back = await t.action(api.auth.signIn, {
    provider: "password",
    params: { email: SUCCESSOR, password: "a-new-long-password", flow: "signIn" },
  });
  expect(back.tokens).not.toBeNull();
  await expect(
    t.action(api.auth.signIn, {
      provider: "password",
      params: { email: FOUNDER, password: PASSWORD, flow: "signIn" },
    }),
  ).rejects.toThrow(/not allowed/);
});

test("a password past the cap is rejected on signIn too, before any hashing", async () => {
  // validatePasswordRequirements runs on signUp/reset only, so the bound has
  // to be asserted in `profile` or signIn hands scrypt an unbounded string.
  const t = convexTest(schema, modules);
  await t.action(api.auth.signIn, signUpParams());
  await expect(
    t.action(api.auth.signIn, {
      provider: "password",
      params: { email: FOUNDER, password: "x".repeat(100_000), flow: "signIn" },
    }),
  ).rejects.toThrow(/capped/);
});
