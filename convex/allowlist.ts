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

import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  SETUP_TOKEN_MIN_DISTINCT_CHARS,
  SETUP_TOKEN_MIN_LENGTH,
} from "../lib/auth-policy";

export {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  SETUP_TOKEN_MIN_DISTINCT_CHARS,
  SETUP_TOKEN_MIN_LENGTH,
};

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

/*
 * Compares against `expected` byte for byte regardless of where the first
 * mismatch is, so response timing doesn't leak how much of a guessed token
 * was right. The loop length is `expected`'s, never the candidate's, so an
 * attacker can't drive iteration count (or read `max(len)` off the clock)
 * with a huge guess.
 */
function constantTimeEqual(candidate: string, expected: string): boolean {
  const encoder = new TextEncoder();
  const candidateBytes = encoder.encode(candidate);
  const expectedBytes = encoder.encode(expected);
  let diff = candidateBytes.length ^ expectedBytes.length;
  for (let i = 0; i < expectedBytes.length; i++) {
    diff |= (candidateBytes[i] ?? 0) ^ expectedBytes[i];
  }
  return diff === 0;
}

/**
 * Account creation is a one-time, founder-only act: knowledge of the
 * allowlisted email is public information, not authorization (the T2 review's
 * P0 — anyone who learned the email could have claimed the account first).
 * The founder sets AUTH_SETUP_TOKEN (generated: `openssl rand -hex 24`),
 * signs up once, and unsets it; while it is unset, sign-up is disabled
 * entirely.
 *
 * Sign-up is not rate-limited by Convex Auth, so a guessable token would
 * resurrect that P0 — a configured token must clear both a length floor and
 * a character-variety floor, which a generated value passes and a
 * human-invented one ("passwordpasswordpass") does not. Throws on any
 * mismatch and never echoes the attempted token.
 */
export function assertSetupToken(
  candidate: unknown,
  expected: string | undefined,
): void {
  const wanted = expected?.trim() ?? "";
  if (wanted === "") {
    throw new Error(
      "Account creation is disabled: AUTH_SETUP_TOKEN is not configured",
    );
  }
  if (
    wanted.length < SETUP_TOKEN_MIN_LENGTH ||
    new Set(wanted).size < SETUP_TOKEN_MIN_DISTINCT_CHARS
  ) {
    throw new Error(
      "Account creation is disabled: AUTH_SETUP_TOKEN is too weak — " +
        `it needs at least ${SETUP_TOKEN_MIN_LENGTH} characters and ` +
        `${SETUP_TOKEN_MIN_DISTINCT_CHARS} distinct ones ` +
        "(generate it: openssl rand -hex 24)",
    );
  }
  if (typeof candidate !== "string" || candidate.trim() === "") {
    throw new Error("Account creation requires the setup token");
  }
  if (!constantTimeEqual(candidate.trim(), wanted)) {
    throw new Error("That setup token is not valid");
  }
}

/** `validatePasswordRequirements` for the Password provider (signUp/reset). */
export function assertPasswordStrength(password: string): void {
  if (typeof password !== "string" || password.length < PASSWORD_MIN_LENGTH) {
    throw new Error(
      `Passwords need at least ${PASSWORD_MIN_LENGTH} characters`,
    );
  }
  assertPasswordBounded(password);
}

/**
 * The upper bound alone, for the flows the provider never validates:
 * `validatePasswordRequirements` runs on signUp and reset-verification only,
 * so a `flow:"signIn"` request can otherwise hand scrypt a megabyte.
 * `undefined` passes — the provider raises its own "missing password" error.
 */
export function assertPasswordBounded(password: unknown): void {
  if (password === undefined) return;
  if (typeof password !== "string" || password.length > PASSWORD_MAX_LENGTH) {
    throw new Error(
      `Passwords are capped at ${PASSWORD_MAX_LENGTH} characters`,
    );
  }
}
