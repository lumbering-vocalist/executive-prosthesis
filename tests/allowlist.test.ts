import { expect, test } from "vitest";
import {
  assertAllowedEmail,
  assertPasswordStrength,
  assertSetupToken,
  normalizeEmail,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  SETUP_TOKEN_MIN_LENGTH,
} from "../convex/allowlist";

const FOUNDER = "founder@example.com";

test("exact match passes and returns the normalized email", () => {
  expect(assertAllowedEmail(FOUNDER, FOUNDER)).toBe(FOUNDER);
});

test("case and surrounding whitespace are normalized on both sides", () => {
  expect(assertAllowedEmail("  Founder@Example.COM ", FOUNDER)).toBe(FOUNDER);
  expect(assertAllowedEmail(FOUNDER, "  FOUNDER@example.com ")).toBe(FOUNDER);
});

test("a different email is rejected", () => {
  expect(() => assertAllowedEmail("intruder@example.com", FOUNDER)).toThrow(
    /single-user/,
  );
});

test("fail-closed: unset or empty allowlist rejects everyone", () => {
  expect(() => assertAllowedEmail(FOUNDER, undefined)).toThrow(/disabled/);
  expect(() => assertAllowedEmail(FOUNDER, "")).toThrow(/disabled/);
  expect(() => assertAllowedEmail(FOUNDER, "   ")).toThrow(/disabled/);
});

test("missing or non-string candidate is rejected", () => {
  expect(() => assertAllowedEmail(undefined, FOUNDER)).toThrow(/requires/);
  expect(() => assertAllowedEmail("", FOUNDER)).toThrow(/requires/);
  expect(() => assertAllowedEmail(42, FOUNDER)).toThrow(/requires/);
});

test("§13: rejection messages never echo the attempted email", () => {
  const attempted = "intruder@example.com";
  try {
    assertAllowedEmail(attempted, FOUNDER);
    expect.unreachable("should have thrown");
  } catch (error) {
    expect(String(error)).not.toContain(attempted);
    expect(String(error)).not.toContain("intruder");
  }
});

test("normalizeEmail trims and lowercases only", () => {
  expect(normalizeEmail(" A@B.C ")).toBe("a@b.c");
});

// Configured tokens must clear SETUP_TOKEN_MIN_LENGTH (16); keep the test
// token realistic so the entropy floor doesn't interfere with these cases.
const TOKEN = "tok-1234-5678-9abc";

test("setup token: exact match passes, surrounding whitespace tolerated", () => {
  expect(() => assertSetupToken(TOKEN, TOKEN)).not.toThrow();
  expect(() => assertSetupToken(` ${TOKEN} `, TOKEN)).not.toThrow();
});

test("setup token fail-closed: unset or blank token disables sign-up", () => {
  expect(() => assertSetupToken("anything", undefined)).toThrow(/disabled/);
  expect(() => assertSetupToken("anything", "")).toThrow(/disabled/);
  expect(() => assertSetupToken("anything", "   ")).toThrow(/disabled/);
});

test("setup token fail-closed: a weak configured token disables sign-up", () => {
  // Sign-up has no rate limiter, so a guessable founder-chosen token would
  // resurrect the P0 takeover — refuse the configuration outright, even when
  // the candidate matches it exactly.
  expect(() => assertSetupToken("setup123", "setup123")).toThrow(/too short/);
  expect(() =>
    assertSetupToken("a".repeat(SETUP_TOKEN_MIN_LENGTH - 1), "a".repeat(SETUP_TOKEN_MIN_LENGTH - 1)),
  ).toThrow(/too short/);
  expect(() =>
    assertSetupToken("a".repeat(SETUP_TOKEN_MIN_LENGTH), "a".repeat(SETUP_TOKEN_MIN_LENGTH)),
  ).not.toThrow();
});

test("setup token: missing, non-string, or wrong candidate is rejected", () => {
  expect(() => assertSetupToken(undefined, TOKEN)).toThrow(/requires/);
  expect(() => assertSetupToken("", TOKEN)).toThrow(/requires/);
  expect(() => assertSetupToken(42, TOKEN)).toThrow(/requires/);
  expect(() => assertSetupToken(`${TOKEN}x`, TOKEN)).toThrow(/not valid/);
  expect(() => assertSetupToken(TOKEN.slice(0, -1), TOKEN)).toThrow(/not valid/);
});

test("§13: setup-token rejections never echo the attempted token", () => {
  try {
    assertSetupToken("attacker-guess", TOKEN);
    expect.unreachable("should have thrown");
  } catch (error) {
    expect(String(error)).not.toContain("attacker-guess");
    expect(String(error)).not.toContain(TOKEN);
  }
});

test("setup token: constant-time compare is still a correct compare", () => {
  // constantTimeEqual is only observable through assertSetupToken; cover the
  // shapes that a naive length-or-prefix compare would get wrong.
  expect(() => assertSetupToken(`${TOKEN}4`, TOKEN)).toThrow(/not valid/);
  expect(() => assertSetupToken(`x${TOKEN.slice(1)}`, TOKEN)).toThrow(/not valid/);
  expect(() => assertSetupToken(`${TOKEN.slice(0, -1)}x`, TOKEN)).toThrow(/not valid/);
  // Multi-byte tokens compare by encoded bytes, not by UTF-16 code units.
  const MB_TOKEN = "tökén-✓-tökén-✓✓";
  expect(() => assertSetupToken(MB_TOKEN, MB_TOKEN)).not.toThrow();
  expect(() =>
    assertSetupToken(`${MB_TOKEN.slice(0, -1)}x`, MB_TOKEN),
  ).toThrow(/not valid/);
});

test("setup token: an all-whitespace candidate is a missing token, not a match", () => {
  // Both sides are trimmed before comparison, so a blank candidate must be
  // caught by the "requires" guard rather than trim-matching a blank expected
  // value (which the fail-closed guard already rejects).
  expect(() => assertSetupToken("   ", TOKEN)).toThrow(/requires/);
  expect(() => assertSetupToken("\t\n", TOKEN)).toThrow(/requires/);
});

test("password policy: length bounds, no composition rules", () => {
  expect(() =>
    assertPasswordStrength("a".repeat(PASSWORD_MIN_LENGTH)),
  ).not.toThrow();
  expect(() =>
    assertPasswordStrength("a".repeat(PASSWORD_MIN_LENGTH - 1)),
  ).toThrow(/at least/);
  expect(() =>
    assertPasswordStrength("a".repeat(PASSWORD_MAX_LENGTH + 1)),
  ).toThrow(/capped/);
  // Spaces and unicode are fine — passphrases are the point.
  expect(() =>
    assertPasswordStrength("correct horse battery staple"),
  ).not.toThrow();
});

test("password policy: the upper bound is inclusive", () => {
  // The cap exists to bound scrypt work; exactly-at-the-cap must still be a
  // usable password, one over must not.
  expect(() =>
    assertPasswordStrength("a".repeat(PASSWORD_MAX_LENGTH)),
  ).not.toThrow();
  expect(() =>
    assertPasswordStrength("a".repeat(PASSWORD_MAX_LENGTH + 1)),
  ).toThrow(/capped/);
});

test("password policy fail-closed: a non-string password is rejected", () => {
  // The provider hands through client-supplied params; the runtime guard has
  // to hold even where the type says it can't be reached.
  for (const bad of [undefined, null, 42, {}, ["a".repeat(20)]]) {
    expect(() =>
      assertPasswordStrength(bad as unknown as string),
      String(bad),
    ).toThrow(/at least/);
  }
});

test("§13: password rejections never echo the attempted password", () => {
  const attempted = "hunter2";
  try {
    assertPasswordStrength(attempted);
    expect.unreachable("should have thrown");
  } catch (error) {
    expect(String(error)).not.toContain(attempted);
  }
});
