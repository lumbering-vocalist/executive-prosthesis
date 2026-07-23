# Changelog

All notable changes to this project are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/); versions are MAJOR.MINOR.PATCH.MICRO.

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
