# executive-prosthesis

An executive-function prosthesis: a capture-first personal assistant, shipped as an installable iOS PWA. The product story lives in [executive-function-prosthesis-brief.md](executive-function-prosthesis-brief.md); the build plan (review-locked) is [engineering-plan.md](engineering-plan.md).

**Stack:** Next.js (App Router, PWA) · Convex (backend) · Sentry (error reporting behind a privacy scrubber) · Vitest · TypeScript

## Getting started

Requires Node 22 (the version CI runs).

```bash
npm ci
npm run dev
```

Open http://localhost:3000. No Convex deployment or Sentry DSN is needed for local dev, tests, or builds — see the notes below.

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

`npm test` runs the Vitest suite (design tokens, Sentry scrubbing, the Convex harness, icon generation). CI (`.github/workflows/ci.yml`) runs lint, typecheck, tests, and a production build on every push.

## Convex

The backend is Convex. T1 ships an empty schema (`convex/schema.ts`) with the generated bindings committed in `convex/_generated/`, so tests and CI run without any Convex deployment.

`npm run codegen` requires a configured deployment: `npx convex login` is interactive, and codegen talks to a real project. That arrives at T2 — until then, do not regenerate bindings; the committed ones are the source of truth (a CI drift check is tracked in [TODOS.md](TODOS.md)).

## Error reporting privacy

Sentry is wired across client, server, and edge runtimes, but init is a no-op without a DSN (`NEXT_PUBLIC_SENTRY_DSN`), so local dev and CI send nothing. Source-map upload happens only when `SENTRY_AUTH_TOKEN` is set (deploy environments); performance transactions are sampled at 10%. Every event passes through `lib/sentry-scrub.ts`, the engineering-plan §13 privacy gate: capture text, transcripts, console output, request bodies, cookies, and URL query strings are scrubbed or dropped before anything leaves the device. One known exception: error messages (`exception.values[].value`) are kept, truncated to 300 characters — the standing rule is never to interpolate capture content into thrown errors, and real redaction for that channel is tracked in [TODOS.md](TODOS.md) (pre-T3). If you add a content-bearing field name anywhere in the app, add it to `SENSITIVE_KEYS` in that module — `tests/sentry-scrub.test.ts` asserts against the module, not against config prose.

Baseline security headers (HSTS, `nosniff`, `X-Frame-Options: DENY`, strict-origin referrer policy) ship on every route via `next.config.ts`; a full CSP is deferred to pre-T4 (see TODOS.md).

## Project docs

- [engineering-plan.md](engineering-plan.md) — review-locked engineering plan (source of truth for architecture)
- [executive-function-prosthesis-brief.md](executive-function-prosthesis-brief.md) — locked product brief
- [CHANGELOG.md](CHANGELOG.md) — release history
- [TODOS.md](TODOS.md) — deferred work with context
