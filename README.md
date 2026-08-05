# executive-prosthesis

An executive-function prosthesis: a capture-first personal assistant, shipped as an installable iOS PWA. The product story lives in [executive-function-prosthesis-brief.md](executive-function-prosthesis-brief.md); the build plan (review-locked) is [engineering-plan.md](engineering-plan.md).

**Stack:** Next.js (App Router, PWA) · Convex (backend + auth) · Sentry (error reporting behind a privacy scrubber) · Vitest · TypeScript

## Getting started

Requires Node 22 (the version CI runs).

```bash
npm ci
npx convex dev    # first run configures the project and writes NEXT_PUBLIC_CONVEX_URL to .env.local; it keeps running, so leave it
npm run dev       # second terminal
```

Open http://localhost:3000 — every page is behind sign-in, so you land on `/signin`. Claiming the account is the next section.

Both `npm run dev` and `npm run build` need `NEXT_PUBLIC_CONVEX_URL`: the Convex client is constructed at module scope and fails by that variable's name without it. `.env.local` from `npx convex dev` covers both locally; CI passes a placeholder URL, since the build never opens a connection. `npm test` needs nothing, and no Sentry DSN is needed anywhere.

## Signing in

One person, one account. `AUTH_ALLOWED_EMAIL` on the Convex deployment is the entire allowlist. It is re-checked on every authenticated call and fails closed: unset means nobody gets in.

**Claiming the account (once).** Knowing the allowlisted email is not authorization, so account creation is gated on a one-time setup token:

```bash
npx convex env set AUTH_ALLOWED_EMAIL you@example.com          # the allowlist; nobody signs in until this is set
npx convex env set AUTH_SETUP_TOKEN $(openssl rand -hex 24)    # print it: npx convex env get AUTH_SETUP_TOKEN
# sign up at /signin with the allowlisted email, that token, and a password
npx convex env remove AUTH_SETUP_TOKEN
```

Generate the token, don't invent one — anything under 24 characters or with fewer than 10 distinct characters is refused, because sign-up is the one flow Convex Auth doesn't rate-limit. With the token unset (the steady state) sign-up is disabled entirely.

Passwords need at least 12 characters, capped at 256 and bounded before any hashing work on every flow. There is no password reset until email lands at T5; recovery means deleting the `authAccounts` and `users` rows in the Convex dashboard, then re-running the setup-token sign-up ([TODOS.md](TODOS.md) has the full recovery paths).

**Revoking access.** Change `AUTH_ALLOWED_EMAIL`. Every authenticated Convex call re-checks it, so a live session loses all data access immediately instead of drifting on a stale token until it expires. The middleware's auth cookie stays valid — which is why a revoked session lands on the error screen rather than the login page, and why that screen carries a "Sign out instead" button as the way back to `/signin`. It is recoverable, not a one-way door: set a setup token again and sign up on the new address — that re-points the existing account rather than minting a second one.

## Commands

| Command             | What it does                                          |
| ------------------- | ----------------------------------------------------- |
| `npm run dev`       | Start the dev server                                  |
| `npm run build`     | Production build                                      |
| `npm start`         | Serve the production build                            |
| `npm run lint`      | ESLint                                                |
| `npm run typecheck` | TypeScript, no emit                                   |
| `npm test`          | Run the Vitest suite once                             |
| `npm run test:watch`| Vitest in watch mode                                  |
| `npm run codegen`   | Regenerate Convex bindings (needs a deployment — see below) |
| `npm run icons`     | Regenerate PWA icons from `scripts/generate-icons.mjs` (optional output root: `npm run icons -- <dir>`) |

## Tests and CI

`npm test` runs the Vitest suite — 115 tests across 10 files: design tokens, Sentry scrubbing, the Convex harness, icon generation, the allowlist and setup-token gate, session revocation, the public/internal function split, the auth perimeter matcher, and sign-in error classification. CI (`.github/workflows/ci.yml`) runs lint, typecheck, tests, and a production build on every push.

CI also runs a Convex codegen drift check: it regenerates `convex/_generated` and fails if the committed bindings fell behind `convex/schema.ts`. The step self-skips with a workflow warning until the `CONVEX_DEPLOY_KEY` repo secret exists — create a deploy key in the Convex dashboard and add it as a repo secret to turn it on. The secret is injected on that one step, never at job scope.

## Convex

The backend is Convex. `convex/schema.ts` currently holds Convex Auth's own tables (`users`, `authAccounts`, `authSessions`, …); domain tables land at T3. The generated bindings are committed in `convex/_generated/`, so tests and builds run without any Convex deployment.

Every public data function goes through the authed wrappers in `convex/functions.ts`, which inject the signed-in user and re-check the allowlist per request; `tests/function-split.test.ts` mechanically blocks any other module from touching the raw public builders. Convex Auth's own surface (`signIn`/`signOut`/`store`/`isAuthenticated` in `convex/auth.ts`) is the one sanctioned unauthenticated exception — it is how a session comes to exist.

`npm run codegen` regenerates the bindings and needs a configured deployment (`npx convex dev --configure`). Regenerate and commit whenever the schema changes — CI's drift check fails the build if the committed bindings fall behind.

## Error reporting privacy

Sentry is wired across client, server, and edge runtimes, but init is a no-op without a DSN (`NEXT_PUBLIC_SENTRY_DSN`), so local dev and CI send nothing. Source-map upload happens only when `SENTRY_AUTH_TOKEN` is set (deploy environments); performance transactions are sampled at 10%. Every event passes through `lib/sentry-scrub.ts`, the engineering-plan §13 privacy gate: capture text, transcripts, console output, request bodies, cookies, and URL query strings are scrubbed or dropped before anything leaves the device. Error messages (`exception.values[].value`) are the one free-text channel kept, and they are pattern-scrubbed on the way out: quoted spans, object literals, `Value:` tails (Convex validator echoes), email addresses, and URL query strings are redacted, with the 300-character cap as the backstop and wholesale redaction past 8× it. Stack-frame local variables are dropped outright. The standing rule is still never to interpolate capture content into thrown errors — the scrub enforces it against the errors we don't author. If you add a content-bearing field name anywhere in the app, add it to `SENSITIVE_KEYS` in that module — `tests/sentry-scrub.test.ts` asserts against the module, not against config prose.

Baseline security headers (HSTS, `nosniff`, `X-Frame-Options: DENY`, strict-origin referrer policy) ship on every route via `next.config.ts`; a full CSP is deferred to pre-T4 (see TODOS.md).

## Project docs

- [engineering-plan.md](engineering-plan.md) — review-locked engineering plan (source of truth for architecture)
- [executive-function-prosthesis-brief.md](executive-function-prosthesis-brief.md) — locked product brief
- [CHANGELOG.md](CHANGELOG.md) — release history
- [TODOS.md](TODOS.md) — deferred work with context
