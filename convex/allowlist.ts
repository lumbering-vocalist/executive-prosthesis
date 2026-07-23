/*
 * Single-user allowlist (T2, engineering-plan.md §14). The prosthesis is a
 * one-person system: exactly one email — AUTH_ALLOWED_EMAIL on the Convex
 * deployment — may hold the account.
 *
 * Fail-closed: an unset or empty allowlist means nobody signs in, including
 * the founder, until the env var is configured. Error messages never echo the
 * attempted email (§13: no user content in errors — errors become Sentry
 * events).
 */

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

/**
 * Returns the normalized email when it matches the allowlist; throws
 * otherwise. `candidate` is `unknown` because it arrives from client-supplied
 * sign-in params.
 */
export function assertAllowedEmail(
  candidate: unknown,
  allowed: string | undefined,
): string {
  if (typeof candidate !== "string" || candidate.trim() === "") {
    throw new Error("Sign-in requires an email address");
  }
  if (allowed === undefined || allowed.trim() === "") {
    throw new Error(
      "Sign-in is disabled: AUTH_ALLOWED_EMAIL is not configured",
    );
  }
  if (normalizeEmail(candidate) !== normalizeEmail(allowed)) {
    throw new Error("This is a single-user system; that email is not allowed");
  }
  return normalizeEmail(candidate);
}
