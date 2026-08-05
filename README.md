# executive-prosthesis

An executive-function prosthesis: a capture-first personal assistant, shipped as an installable iOS PWA. The product story lives in [executive-function-prosthesis-brief.md](executive-function-prosthesis-brief.md); the build plan (review-locked) is [engineering-plan.md](engineering-plan.md).

**Stack:** Next.js (App Router, PWA) · Convex (backend + auth) · Sentry (error reporting behind a privacy scrubber) · Vitest · TypeScript

## Getting started

Requires Node 22 (the version CI runs).

```bash
npm ci
npx convex dev   # writes NEXT_PUBLIC_CONVEX_URL into .env.local
npm run dev
```

Open http://localhost:3000. Every page sits behind sign-in now, so the dev server needs a Convex deployment: without `NEXT_PUBLIC_CONVEX_URL` the app fails at startup with that variable's name. `npm test` and `npm run build` still need nothing — the build uses a placeholder URL and never opens a connection. No Sentry DSN is needed anywhere.

## Signing in

One person, one account. `AUTH_ALLOWED_EMAIL` on the Convex deployment is the entire allowlist. It is re-checked on every authenticated call and fails closed: unset means nobody gets in.

**Claiming the account (once).** Knowing the allowlisted email is not authorization, so account creation is gated on a one-time setup token:

```bash
npx convex env set AUTH_SETUP_TOKEN $(openssl rand -hex 24)
# sign up at /signin with the allowlisted email, that token, and a password
npx convex env remove AUTH_SETUP_TOKEN
```

Generate the token, don't invent one — anything under 24 characters or with fewer than 10 distinct characters is refused, because sign-up is the one flow Convex Auth doesn't rate-limit. With the token unset (the steady state) sign-up is disabled entirely.

Passwords need at least 12 characters, capped at 256 and bounded before any hashing work on every flow. There is no password reset until email lands at T5; recovery means deleting the `authAccounts` and `users` rows in the Convex dashboard, then re-running the setup-token sign-up ([TODOS.md](TODOS.md) has the full recovery paths).

**Revoking access.** Change `AUTH_ALLOWED_EMAIL`. Live sessions stop working immediately instead of drifting on a stale token. It is recoverable, not a one-way door: set a setup token again and sign up on the new address — that re-points the existing account rather than minting a second one. A revoked session lands on the error screen, whose "Sign out instead" button is the way back to `/signin`.

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

Every public Convex function goes through the authed wrappers in `convex/functions.ts`, which inject the signed-in user and re-check the allowlist per request; `tests/function-split.test.ts` mechanically blocks any module from exporting an unauthenticated function.

`npm run codegen` regenerates the bindings and needs a configured deployment (`npx convex dev --configure`). Regenerate and commit whenever the schema changes — CI's drift check fails the build if the committed bindings fall behind.

## Error reporting privacy

Sentry is wired across client, server, and edge runtimes, but init is a no-op without a DSN (`NEXT_PUBLIC_SENTRY_DSN`), so local dev and CI send nothing. Source-map upload happens only when `SENTRY_AUTH_TOKEN` is set (deploy environments); performance transactions are sampled at 10%. Every event passes through `lib/sentry-scrub.ts`, the engineering-plan §13 privacy gate: capture text, transcripts, console output, request bodies, cookies, and URL query strings are scrubbed or dropped before anything leaves the device. Error messages (`exception.values[].value`) are the one free-text channel kept, and they are pattern-scrubbed on the way out: quoted spans, object literals, `Value:` tails (Convex validator echoes), email addresses, and URL query strings are redacted, with the 300-character cap as the backstop and wholesale redaction past 8× it. Stack-frame local variables are dropped outright. The standing rule is still never to interpolate capture content into thrown errors — the scrub enforces it against the errors we don't author. If you add a content-bearing field name anywhere in the app, add it to `SENSITIVE_KEYS` in that module — `tests/sentry-scrub.test.ts` asserts against the module, not against config prose.

Baseline security headers (HSTS, `nosniff`, `X-Frame-Options: DENY`, strict-origin referrer policy) ship on every route via `next.config.ts`; a full CSP is deferred to pre-T4 (see TODOS.md).

## Project docs

- [engineering-plan.md](engineering-plan.md) — review-locked engineering plan (source of truth for architecture)
- [executive-function-prosthesis-brief.md](executive-function-prosthesis-brief.md) — locked product brief
- [CHANGELOG.md](CHANGELOG.md) — release history
- [TODOS.md](TODOS.md) — deferred work with context
