/*
 * Auth policy constants shared by the Convex functions and the sign-in form.
 *
 * Lives in lib/ rather than convex/ so the client bundle never imports a
 * Convex-side module: convex/allowlist.ts is free to grow server-only reads
 * without those shipping to the browser.
 */

// The provider's default is 8; this account guards everything the prosthesis
// will ever hold. Length only, per NIST — no composition rules. The upper
// bound caps what a hostile client can make scrypt chew on.
export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 256;

// Sign-up has no rate limiter (Convex Auth throttles signIn only), so the
// setup token itself carries the entropy that keeps the bootstrap window
// closed. A human-invented token is the failure mode: require generated
// length AND character variety so "aaaaaaaaaaaaaaaaaaaaaaaa" fails closed.
export const SETUP_TOKEN_MIN_LENGTH = 24;
export const SETUP_TOKEN_MIN_DISTINCT_CHARS = 10;

// Payload code on the ConvexError thrown when the deployment isn't
// configured. Convex redacts ordinary server errors in production but
// preserves ConvexError data, so this is what lets the sign-in screen tell a
// misconfigured deployment from a wrong password.
export const NOT_CONFIGURED = "not-configured";
