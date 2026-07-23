# TODOS

## Auth hardening — deferred from T2 /ship review (pre-T3)

Cross-model review (Claude adversarial + Codex adversarial + Codex structured) of the T2 auth diff at v0.2.0.0 raised these. Founder chose to merge T2 as-is (single-user app, no capture data yet) and track them here. All should land before T3 opens real data tables. Ranked by the review consensus.

**P0 — Account-bootstrap takeover race.** `signUp` is unauthenticated and treats knowledge of `AUTH_ALLOWED_EMAIL` as authorization — no proof of mailbox/device ownership. Anyone who learns the founder's email can sign up first, set the password, and lock the founder out. All three review models flagged this #1. **Immediate mitigation:** founder claims the account at `/signin` now (closes the live window). **Real fix:** gate `signUp` behind an `AUTH_SETUP_TOKEN` env var (founder sets it, signs up once, unsets it), or provision the account out of band, before the deployment is publicly reachable. Files: convex/auth.ts:24, app/signin/page.tsx:79.

**P1 — `signUp` bypasses rate limiting + weak password policy.** Convex Auth rate-limits `signIn` (10/hr) but not `signUp`; the public action accepts an arbitrary `flow`, so `flow:"signUp"` against the existing account is an unthrottled online password brute-force that also burns a scrypt CPU cycle per guess (billing DoS). Password policy is the provider's 8-char default. Fix: add `validatePasswordRequirements` (≥12 chars), add rate limiting keyed on the normalized email (e.g. @convex-dev/rate-limiter), and disable/secret-gate `signUp` once the account exists. Files: convex/auth.ts:24.

**P1 — Principal validity not checked; sessions/allowlist not revocable.** `requireUserId` trusts the JWT subject without confirming the user or session row still exists — a deleted user or invalidated session stays a valid principal until the 1-hour access JWT expires, and changing `AUTH_ALLOWED_EMAIL` does not revoke already-issued sessions (refresh-token exchange bypasses the `profile`/allowlist check). The convex-test suite currently blesses a deleted user as authenticated (`viewer` returns `{email:null}`). Also "exactly one user" is not a DB invariant — `createOrUpdateUser` inserts without checking for an existing user. Fix before T3 mutations can create dangling ownership: have `requireUserId` reject when `ctx.db.get(userId)` is null, enforce the single-user invariant in `createOrUpdateUser`, and add a per-request or refresh-time allowlist recheck. Files: convex/functions.ts:26, convex/auth.ts:36, convex/users.ts.

**P2 — Public/internal split test is bypassable.** `tests/function-split.test.ts` scans only top-level `convex/*.ts` (misses subdirectories — Convex supports nested function modules), only matches double-quoted imports without a `.js` extension, and ignores re-exports and direct `queryGeneric`/`mutationGeneric`/`actionGeneric` imports from `convex/server`. The load-bearing "every public function is authed" guarantee can be silently defeated. (The namespace/default/dynamic-import hole was closed during this review.) Fix: recurse `convex/**/*.ts` excluding `_generated`, match both quote styles and optional `.js`, ban `*Generic` builder imports from `convex/server` outside functions.ts, and flag `export ... from "./_generated/server"`. Files: tests/function-split.test.ts.

**P2 — App-crash and env robustness (correctness).** (a) `app/ConvexClientProvider.tsx` builds `ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL as string)` at module scope — a missing env var white-screens every route in prod (CI placeholder hides it); throw a named error instead. (b) `app/page.tsx` `useQuery(api.users.viewer)` has no error boundary — an auth desync (cookie valid at middleware but WS session not yet established, or token refresh) throws "Not signed in" and crashes to `global-error.tsx`; add `app/error.tsx` and/or gate the query on `useConvexAuth()`. (c) `signOut()` in app/page.tsx has no catch — a network failure strands a half-signed-out UI. (d) The sign-in `catch{}` swallows infrastructure errors with no `Sentry.captureException` and maps them all to "that didn't match", contradicting §13 ("errors become Sentry events") and hiding first-run misconfiguration; capture and branch infra-vs-credential copy. Files: app/ConvexClientProvider.tsx:11, app/page.tsx, app/signin/page.tsx:29.

**P2 — Middleware matcher excludes dotted paths.** `proxy.ts` matcher `"/((?!.*\\..*|_next).*)"` lets any path containing a dot through unauthenticated (fine for today's assets, a latent auth-bypass for a future route like `/export/data.json`). The Convex-layer authed wrappers remain the real enforcement, so this is latent. Fix: exclude only known static extensions/prefixes, or assert the invariant that no app route contains a dot. Also trim the dead `/(api|trpc)(.*)` matcher entry (no such routes) or comment it as forward-looking for T6. Files: proxy.ts:31.

**Deferred, tie into existing pre-T4 CSP work:** access token is stored in `localStorage` (Convex Auth default) — script-readable, so any same-origin XSS can exfiltrate it; move to `inMemory` storage or accept the tradeoff once the CSP lands (see the CSP TODO below). The 30-day auth cookie also outlives Convex Auth's default 30-day non-rolling session total-duration, so a daily-active founder gets surprised by a re-auth near day 30; set `session.totalDurationMs`/`inactiveDurationMs` explicitly to match the cookie policy. Files: app/layout.tsx, proxy.ts:28, convex/auth.ts.

**Usability:** the one-time `signUp` form has a single password field (no confirm) and no reset path exists (reset needs Resend at T5), so a typo during account creation is a permanent lockout recoverable only via the Convex dashboard. Add a confirm-password field to the sign-up flow now. Files: app/signin/page.tsx.

## Sentry exception-value redaction (pre-T3, before capture data flows)

**What:** Replace the T1 truncation-only policy on `exception.values[].value` with real redaction (content-tagging or pattern-scrub) in `lib/sentry-scrub.ts`.
**Why:** All three review models (Claude structured, Claude adversarial, Codex ×2) converged on the same hole: runtime errors echo their input — V8's `JSON.parse` SyntaxError quotes the parsed payload, Convex validators echo argument values — so the moment capture text flows through a parser (T3 schema / T4 custody), exception messages can carry it. T1 caps values at 300 chars and keeps the "never interpolate capture content into errors" rule, which is honest but not enforced.
**Context:** /ship adversarial review 2026-07-21; policy + cap documented in `lib/sentry-scrub.ts` header. Consider inverting extra/contexts scrubbing to an allowlist at the same time (deny-list stems are fail-open for unknown keys like `value`).
**Depends on / blocked by:** Must land before T3 merges.

## Content-Security-Policy with Next nonce plumbing (pre-T4)

**What:** A real CSP (script-src nonces via Next middleware, frame-ancestors, connect-src pinned to Convex/Sentry).
**Why:** T1 ships the safe baseline headers (HSTS, nosniff, X-Frame-Options DENY, Referrer-Policy) in `next.config.ts`; a full CSP needs nonce plumbing that's easy to get silently wrong, so it's deferred to before real capture data exists.
**Context:** /ship adversarial review 2026-07-21 (Codex P2).
**Depends on / blocked by:** Before T4 (first user data in the app).

## CI check that convex/_generated matches schema (needs deployment)

**What:** A CI step running `npx convex codegen` + `git diff --exit-code convex/_generated` so committed generated bindings can't drift from `convex/schema.ts`.
**Why:** `_generated` is committed (T1 hand-established; codegen requires a configured deployment, and `npx convex login` is interactive). Once the real Convex project exists (T2), codegen can run headlessly in CI with a deploy key.
**Context:** /ship red-team review 2026-07-21.
**Depends on / blocked by:** T2 Convex deployment + CONVEX_DEPLOY_KEY secret.

## Full DESIGN.md via /design-consultation (pre-SaaS)

**What:** A real design system doc — exact palette values, spacing scale, component inventory — beyond plan §5.6's token summary.
**Why:** §5.6 + approved mockup variant B are sufficient for v1; a DESIGN.md matters when SaaS-phase screens multiply and other hands touch the UI.
**Pros:** Every future design decision calibrates against a stated system instead of re-deriving from the mockup.
**Cons:** ~an hour of consultation whose benefit mostly lands post-v1.
**Context:** /plan-design-review 2026-07-19 (D10.1). Design language extracted from variant B at `~/.gstack/projects/lumbering-vocalist-executive-prosthesis/designs/home-stream-capture-20260719/variant-B.png`.
**Depends on / blocked by:** Nothing; any time before SaaS phase.

## Mockups for remaining screens before T7 (/design-shotgun)

**What:** Variant rounds for Held, You/memory, the proposal card, and the outcome-check card, extending variant B's approved visual language.
**Why:** T7–T11 build these surfaces; a 20-minute variant round each beats inventing them in code.
**Pros:** The implementer builds from an approved visual, not a text spec; catches composition problems while they're regenerable.
**Cons:** Only worth doing right before T7 — done now they'd go stale against T1–T6 learnings.
**Context:** /plan-design-review 2026-07-19 (D10.4). Base direction: variant B (see plan "Approved Mockups"); container rule + design language in plan §5.5–§5.6.
**Depends on / blocked by:** T7 approaching; T1 tokens landed (so mockups can use real palette values).

## Decay tripwire digest — ABSORBED into plan (re-anchored 2026-07-19)

**Status:** No longer a deferred item. The daily email digest is now **T5 in `engineering-plan.md` v3** (Convex cron + Resend), part of milestone M1 — it lands right after custody (T4) and serves as the resurfacing floor for the capture-only phase, plus the pending-confirmations inventory (review ruling D21). Original rationale (codex outside-voice D9.6, 2026-07-18) preserved: a daily recency-based email is the cheapest decay tripwire and dogfoods email-first reach before the real digest engine exists.

## Level 2/3 escalation ladder UI + interlock (post-v1)

**What:** The deliberate-friction escalation-assignment flow, repeat-until-acknowledged delivery, and ignored-L3 → renegotiation interlock.
**Why:** First candidate to graduate a real non-negotiable off Apple Reminders once v1 proves delivery reliability. Completes brief §3.2.
**Pros:** The ladder arrives when a real item needs it, testable against that item. Schema (escalationLevel + fields) already ships in T3, so nothing is foreclosed.
**Cons:** Until built, 3.2's upper rungs exist only as schema; alarm-grade items stay in Apple Reminders.
**Context:** Review rulings D3 (layered delivery posture) + D20 (defer UI — amends D3's build scope). Pairs with the start protocol as the first post-v1 features.
**Depends on / blocked by:** v1 dogfood evidence that push + email delivery is reliable (delivery-health data from T10).

## Calendar watch channels + travel-time runway upgrade (post-v1)

**What:** Google Calendar push-notification channels (public webhook + renewal cron) and a travel-time provider, upgrading the honest v1 runway to minutes-fresh, traffic-aware "leave by" guidance.
**Why:** v1's runway (D19) is scoped to calendar lead-times with user-stated buffers; this is its stated upgrade path.
**Pros:** Real departure math; faster divergence detection than the ~5-min poll.
**Cons:** Public endpoint to secure, channel-renewal cron, a maps vendor + key.
**Context:** Review ruling D19; outside-voice finding OV5.
**Depends on / blocked by:** T9 (calendar read integration) landed; post-v1.

## System-owned sub-calendar (first calendar-writing feature, post-v1)

**What:** A "Prosthesis" Google sub-calendar the system writes pencil-ins to — visible in every calendar app, toggleable/deletable as a consent surface.
**Why:** Makes "want me to pencil it in?" literal; consent built into the calendar UI itself.
**Cons:** Write-scope OAuth; crosses the read-only line, so it must wait for the locked scope decision to be revisited post-v1.
**Context:** Review ruling D7.b. Calendar writing is post-v1 per the July 2026 scope decision.
**Depends on / blocked by:** v1 read integration proven (T9); founder decision to open calendar writing.

## Model tiering when eval data justifies it (post-v1)

**What:** Move proposal generation to a cheaper tier (e.g. Haiku 4.5) once the eval corpus shows quality parity; conversations stay on the strong model.
**Why:** Right production shape at SaaS scale; a config change thanks to the single gate module.
**Cons:** None until multi-user scale exists; premature tiering doubles prompt-tuning surface.
**Context:** Review ruling D9 (Opus 4.8 everywhere in v1).
**Depends on / blocked by:** T14 eval baseline on Opus 4.8.

## OpenAI zero-data-retention approval for transcription

**What:** Apply for ZDR on the OpenAI org so transcription audio stops carrying the ~30-day abuse-monitoring retention; restore §13's privacy posture to the brief's original promise if granted.
**Why:** Closes the gap between the brief's privacy stance and shipped reality (plan §2/§13 currently document the retention honestly).
**Pros:** Voice captures are the most intimate data in the system.
**Cons:** Approval uncertain for a personal account; form-filling errand.
**Context:** Review ruling D10 (founder chose OpenAI over Deepgram); §13 amendment.
**Depends on / blocked by:** OpenAI account set up during T4.
