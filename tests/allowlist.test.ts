import { expect, test } from "vitest";
import {
  assertAllowedEmail,
  assertPasswordStrength,
  assertSetupToken,
  normalizeEmail,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
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

test("setup token: exact match passes, surrounding whitespace tolerated", () => {
  expect(() => assertSetupToken("tok-123", "tok-123")).not.toThrow();
  expect(() => assertSetupToken(" tok-123 ", "tok-123")).not.toThrow();
});

test("setup token fail-closed: unset or blank token disables sign-up", () => {
  expect(() => assertSetupToken("anything", undefined)).toThrow(/disabled/);
  expect(() => assertSetupToken("anything", "")).toThrow(/disabled/);
  expect(() => assertSetupToken("anything", "   ")).toThrow(/disabled/);
});

test("setup token: missing, non-string, or wrong candidate is rejected", () => {
  expect(() => assertSetupToken(undefined, "tok-123")).toThrow(/requires/);
  expect(() => assertSetupToken("", "tok-123")).toThrow(/requires/);
  expect(() => assertSetupToken(42, "tok-123")).toThrow(/requires/);
  expect(() => assertSetupToken("tok-124", "tok-123")).toThrow(/not valid/);
  expect(() => assertSetupToken("tok-12", "tok-123")).toThrow(/not valid/);
});

test("§13: setup-token rejections never echo the attempted token", () => {
  try {
    assertSetupToken("attacker-guess", "tok-123");
    expect.unreachable("should have thrown");
  } catch (error) {
    expect(String(error)).not.toContain("attacker-guess");
    expect(String(error)).not.toContain("tok-123");
  }
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
