import { expect, test } from "vitest";
import { assertAllowedEmail, normalizeEmail } from "../convex/allowlist";

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
