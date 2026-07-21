# TODOS

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
