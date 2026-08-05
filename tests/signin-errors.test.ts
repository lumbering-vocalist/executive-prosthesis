import { expect, test } from "vitest";
import { ConvexError } from "convex/values";
import { isInfrastructureError } from "../app/signin/page";
import { NOT_CONFIGURED } from "../lib/auth-policy";

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

test("an unconfigured deployment is infrastructure, even after production redaction", () => {
  // Convex flattens ordinary server errors to "[CONVEX] Server Error" in
  // production, which is indistinguishable from a wrong password — the
  // ConvexError payload is what survives, so the classifier reads that.
  const redacted = new ConvexError({
    code: NOT_CONFIGURED,
    message: "Sign-in is disabled: AUTH_ALLOWED_EMAIL is not configured",
  });
  expect(isInfrastructureError(redacted)).toBe(true);
  // Same shape as it arrives on the client, where the class isn't preserved.
  expect(
    isInfrastructureError(
      Object.assign(new Error("[CONVEX A(auth:signIn)] Server Error"), {
        data: { code: NOT_CONFIGURED },
      }),
    ),
  ).toBe(true);
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
