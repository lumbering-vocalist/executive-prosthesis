/*
 * Account guards (T2 + pre-T3 hardening, engineering-plan.md §14). The
 * prosthesis is a one-person system: exactly one email — AUTH_ALLOWED_EMAIL
 * on the Convex deployment — may hold the account, and the account may only
 * be created while AUTH_SETUP_TOKEN is configured and presented.
 *
 * Everything here is fail-closed: an unset or empty allowlist means nobody
 * signs in; an unset setup token means nobody signs up — including the
 * founder — until the env var is configured. Error messages never echo what
 * was attempted (§13: no user content in errors — errors become Sentry
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

// Compares every byte regardless of where the first mismatch is, so response
// timing doesn't leak how much of a guessed token was right.
function constantTimeEqual(a: string, b: string): boolean {
  const encoder = new TextEncoder();
  const aBytes = encoder.encode(a);
  const bBytes = encoder.encode(b);
  let diff = aBytes.length ^ bBytes.length;
  const length = Math.max(aBytes.length, bBytes.length);
  for (let i = 0; i < length; i++) {
    diff |= (aBytes[i] ?? 0) ^ (bBytes[i] ?? 0);
  }
  return diff === 0;
}

/**
 * Account creation is a one-time, founder-only act: knowledge of the
 * allowlisted email is public information, not authorization (the T2 review's
 * P0 — anyone who learned the email could have claimed the account first).
 * The founder sets AUTH_SETUP_TOKEN, signs up once, and unsets it; while it
 * is unset, sign-up is disabled entirely. Throws on any mismatch and never
 * echoes the attempted token.
 */
export function assertSetupToken(
  candidate: unknown,
  expected: string | undefined,
): void {
  if (expected === undefined || expected.trim() === "") {
    throw new Error(
      "Account creation is disabled: AUTH_SETUP_TOKEN is not configured",
    );
  }
  if (typeof candidate !== "string" || candidate.trim() === "") {
    throw new Error("Account creation requires the setup token");
  }
  if (!constantTimeEqual(candidate.trim(), expected.trim())) {
    throw new Error("That setup token is not valid");
  }
}

// Review P1: the provider's default is 8 chars; this account guards
// everything the prosthesis will ever hold. Length only, per NIST — no
// composition rules. The upper bound caps what a hostile client can make
// scrypt chew on.
export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 256;

/** `validatePasswordRequirements` for the Password provider (signUp/reset). */
export function assertPasswordStrength(password: string): void {
  if (typeof password !== "string" || password.length < PASSWORD_MIN_LENGTH) {
    throw new Error(
      `Passwords need at least ${PASSWORD_MIN_LENGTH} characters`,
    );
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    throw new Error(
      `Passwords are capped at ${PASSWORD_MAX_LENGTH} characters`,
    );
  }
}
