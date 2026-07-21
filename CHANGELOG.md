# Changelog

All notable changes to this project are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/); versions are MAJOR.MINOR.PATCH.MICRO.

## [0.1.0.0] - 2026-07-21

### Added

- The app exists: installable iOS PWA shell with the product's own look from day one — warm cream ground, deep-green accent, Figtree type, full dark mode, and safe-area-aware chrome (T1 scaffold, engineering-plan §14).
- Text follows your device's iOS text-size setting, and every screen holds ≥4.5:1 contrast in both light and dark mode — enforced by tests, not intention.
- Privacy floor for error reporting: crashes are captured with capture text, transcripts, console output, URLs' query strings, and cookies scrubbed before anything leaves the device (§13 gate, 16 regression tests).
- A calm full-app error screen that says the truth ("your captures are safe on this phone") and offers one tap to retry — never a raw stack trace.
- Backend foundation (Convex) and database test harness wired and proven end-to-end.
- Every push runs lint, typecheck, 34 tests, and a production build in CI.
