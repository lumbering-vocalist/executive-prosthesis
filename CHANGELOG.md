# Changelog

All notable changes to this project are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/); versions are MAJOR.MINOR.PATCH.MICRO.

## [0.2.1.0] - 2026-08-05

### Security

- Creating the account now takes a one-time setup token, not just knowledge of the allowlisted email. Set `AUTH_SETUP_TOKEN` on the deployment (generate it: `openssl rand -hex 24`), sign up once, then unset it — with it unset, account creation is off entirely. A weak token is refused outright, because sign-up is the one flow Convex Auth doesn't rate-limit.
- Passwords need at least 12 characters (was the provider's 8), and an oversized one is rejected before any hashing work on every flow — so nobody can make the server chew on a megabyte-long guess.
- Signing out is now real. A session stops working the moment its user record is gone or the allowlist changes, instead of drifting on for up to an hour on a stale token. Changing `AUTH_ALLOWED_EMAIL` is a working revocation switch — and a recoverable one: signing up on the new address re-points the existing account rather than locking you out, and the error screen carries a "Sign out instead" exit for exactly that case.
- Crash reports scrub harder before leaving the device: quoted fragments, object literals, validator echoes, URL query strings, and email addresses are stripped out of error messages, and local variables captured with a stack trace are dropped entirely. The old rule kept anything an error message quoted — which is exactly where a parser echoes back what it was handed.
- The auth perimeter now names the files that skip sign-in (icons, fonts, manifest, favicon) instead of waving through anything with a dot in it, so a future route like `/export/data.json` can't slip past unauthenticated.

### Fixed

- A sign-in on a dropped connection says so after 20 seconds instead of leaving the button spinning forever — the failure mode you'd actually hit on a phone.
- Missing deployment configuration fails with a message that names what's missing, instead of white-screening every route.
- The sign-up form asks for the password twice and states the length rule up front, so a typo during the one-shot account creation can't lock you out permanently.

### Internal

- Test suite grew from 50 to 115 tests, covering session revocation, the setup-token gate, the auth perimeter regex, and every scrubber channel. CI gains a schema/codegen drift check that activates once a `CONVEX_DEPLOY_KEY` secret exists and warns visibly until then.

## [0.2.0.0] - 2026-07-23

### Added

- Single-user sign-in: the app now sits behind a password gate wired to a real Convex deployment. Only one allowlisted email (`AUTH_ALLOWED_EMAIL` on the deployment) can ever hold the account; the check fails closed, so an unset allowlist locks everyone out rather than letting anyone in (T2 auth, engineering-plan §14).
- A `/signin` screen in the app's own visual language — the promise line, an email/password form, and calm amber (never red) error copy that never echoes what you typed (§13 privacy).
- Every page now requires you to be signed in; the sign-in screen is the only public page, and static assets stay reachable so the PWA is still installable before you log in.
- Backend guarantee that every public data function checks who's calling: authed query/mutation/action wrappers inject the signed-in user, and a test mechanically blocks any Convex module from exposing an unauthenticated function.

### Security

- Known follow-ups tracked in TODOS.md before capture data arrives (T3): gate account creation behind a setup token to close the first-signup race, add sign-up rate limiting and a stronger password policy, validate the caller's user still exists, and harden the public/internal split test. All deferred deliberately for the single-user pre-data phase.

## [0.1.0.0] - 2026-07-21

### Added

- The app exists: installable iOS PWA shell with the product's own look from day one — warm cream ground, deep-green accent, Figtree type, full dark mode, and safe-area-aware chrome (T1 scaffold, engineering-plan §14).
- Text follows your device's iOS text-size setting, and every screen holds ≥4.5:1 contrast in both light and dark mode — enforced by tests, not intention.
- Privacy floor for error reporting: crashes are captured with capture text, transcripts, console output, URLs' query strings, and cookies scrubbed before anything leaves the device (§13 gate, 19 regression tests).
- A calm full-app error screen that says the truth ("your captures are safe on this phone") and offers one tap to retry — never a raw stack trace.
- Backend foundation (Convex) and database test harness wired and proven end-to-end.
- Every push runs lint, typecheck, 34 tests, and a production build in CI.
