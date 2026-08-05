import { expect, test } from "vitest";
import { isInfrastructureError } from "../app/signin/page";

/*
 * The infra-vs-credential classifier decides two things on the sign-in
 * screen: which copy the founder sees, and whether the failure becomes a
 * Sentry event. A mistyped password must never be captured (§13 noise rule);
 * an unreachable server must never be blamed on the password.
 */

test("network failures are infrastructure", () => {
  expect(isInfrastructureError(new TypeError("Failed to fetch"))).toBe(true);
  expect(
    isInfrastructureError(
      new Error("NetworkError when attempting to fetch resource"),
    ),
  ).toBe(true);
  expect(isInfrastructureError(new Error("Could not connect to host"))).toBe(
    true,
  );
});

test("server rejections and junk are not infrastructure", () => {
  // Convex scrubs server-side auth errors to a generic shape in prod.
  expect(
    isInfrastructureError(new Error("[CONVEX A(auth:signIn)] Server Error")),
  ).toBe(false);
  expect(isInfrastructureError(new Error("Invalid credentials"))).toBe(false);
  expect(isInfrastructureError("not an error")).toBe(false);
  expect(isInfrastructureError(undefined)).toBe(false);
});
