# Executive Function Prosthesis — Engineering Plan (v2)

**Status:** DRAFT — pending eng review
**Source of truth:** `executive-function-prosthesis-brief.md` (research-verified, principles revised 2026-07-19). This plan supersedes the July 18 design doc and its T1–T10 task list entirely.
**Scope decisions locked (2026-07-19):** read-only calendar is v1 infrastructure; initiation ships as the thin closed loop only (start protocol is the first post-v1 feature).

---

## 1. What v1 is

The attachment socket (brief §6): frictionless voice-first capture, the check-in message stream, consent-based breakdown — plus the thin closed loop (propose one next action → "want to start?" → one-tap outcome check) and read-only calendar so proposals about the day are honest. Success = the founder uses it daily for a month without decay.

Non-negotiable architectural consequences of the principles:

- **3.9 (custody is absolute)** → capture is write-first, offline-capable, and never depends on the LLM. This is the load-bearing constraint of the whole architecture.
- **3.2 (graded consent)** → escalation level is a per-item/per-category data-model concept with friction to raise, and ignored escalations route into renegotiation.
- **3.5 (two speeds)** → divergence detection is same-day machinery (feedback timers + calendar shifts), not just a weekly stale-scan.
- **3.8 (close the loop)** → intervention outcomes (message read, offer accepted/declined/ignored, thin-loop taps) are first-class data from day one.
- **3.1/3.7 (no shame)** → no overdue representation can exist on any query surface, enforced by CI test.
- **3.6 (transparent memory)** → everything inferred about the user is a queryable, editable record, surfaced for correction in context.

## 2. Stack

- **Web app:** Next.js on Vercel, installable PWA targeting iOS Safari. (Founder's stack per brief §6.)
- **Backend/data:** Convex (functions, database, cron, file storage for audio).
- **Observability:** Sentry with scrubbing — no capture text, no transcript content in events.
- **Voice:** MediaRecorder record-then-transcribe (brief §6 flags iOS Safari Web Speech unreliability). Audio uploaded to Convex storage; transcription server-side (Whisper-class provider — **open question Q2**). Audio is retained if transcription fails (3.9: honest degraded modes).
- **Push:** Web Push for the installed PWA; the stream itself is a persistent in-app scroll (notifications are pointers, not the record).
- **AI:** LLM provider via a single gate module (**open question Q3**); all model calls go through `model/context.ts`-style choke point enforcing context rules and citations.
- **Calendar:** read-only, one provider (**open question Q1: Google Calendar API vs Apple via CalDAV** — depends on where the family calendar actually lives).

## 3. Data model (Convex tables)

Carried over from the prior eng review where still valid (write-first inbox, separate proposals table, typed links, single-user auth) — re-derived here from the revised brief rather than inherited on trust.

- **captures** — immutable inbox. Raw text or audio ref + transcript when available, timestamps, source (voice/text), processing status. Never edited, never deleted by pipeline logic. Written *before* any AI touches anything.
- **items** — the task/project/thought spine. Lifecycle: `captured → shaped → scheduled-ish → done | released | parked`, plus internal `dormant` (never rendered as overdue — CI-enforced). Fields: title, body, categoryId, scheduling anchor (event-phrased, e.g. "after school drop-off Thursday"; free-text + optional resolved time window), escalationLevel (1 default | 2 | 3, with levelSetAt + levelRationale — friction lives in the UI flow), parkedUntil.
- **categories** — AI-proposed, user-confirmed hierarchy. Flexible; `uncategorized` is a valid permanent state.
- **people** — referenced entities from day one (brief §5); name + relationship + link refs.
- **links** — typed refs between items/people/categories; persist across terminal states.
- **proposals** — every AI suggestion (categorization, anchor, breakdown, next-action, memory correction) with status workflow (`proposed → accepted | adjusted | declined | expired`) and provenance (model, prompt version, source captureId). Canonical tables hold confirmed facts only.
- **memory** — the transparent user model: routines/anchor events, preferences, patterns, important dates. Every record has provenance (user-stated vs AI-inferred vs AI-inferred-user-confirmed), is editable/deletable, and renders in the memory UI. In-context confirmation prompts draw from here.
- **messages** — the check-in stream: content, kind (shape-of-day, observation, offer, renegotiation, transition-runway), readAt, relatedItemIds.
- **interventions** — 3.8's substrate: every proactive act (message sent, offer made, escalation fired, renegotiation opened) with its outcome (read/unread, accepted/declined/ignored, taps received, timing). Adaptation logic reads patterns from here; its conclusions become `memory` records (visible, editable).
- **conversations** — capture and check-in exchanges, threaded; context for the AI gate.
- **calendarEvents** — read-only mirror of the connected calendar (sync window ~4 weeks), used for window-finding, transition runway, and same-day divergence detection. Never written back.

## 4. The custody pipeline (capture path)

1. Client: thought lands in a local durable buffer (IndexedDB; localStorage fallback) *synchronously with the user gesture* — survives tab death, network loss, LLM outage.
2. Sync worker drains buffer → `captures` insert (idempotent by client-generated id). Voice: audio blob uploads first; transcript attaches when the transcription job completes; on failure the audio stays and the item says so honestly.
3. Async proposal job (idempotent, version-checked) reads the capture, writes `proposals` (category, anchor, optional single clarifying question). If the LLM is down, the capture sits safely as `captured` — custody never waits on intelligence.
4. Confirm/converse: one-tap accept, or a short exchange that adjusts the proposal. Accepted facts land in `items`/`memory`.

## 5. The thin closed loop (v1's one hot-loop implementation)

When the user engages (opens the app, or replies to a message): the system proposes **one** next action — chosen from items + calendar windows + stated capacity if volunteered — phrased as an offer. If accepted: a short feedback timer (default ~30–45 min, tunable) fires a one-tap outcome check: `started / blocked / changed / release`. Every branch lands in `interventions`; `blocked` and `changed` open the renegotiation flow; `release` celebrates per 3.4. No repetition on ignore — an ignored check is data, not a retry trigger (3.8).

## 6. Renegotiation engine (two speeds)

- **Fast lane (same-day):** divergence signals — feedback timer expired unanswered, anchored window passed without a start, calendar shift collides with an anchor — open a lightweight replan offer ("today's shape changed — slide it to Thursday's window?"). Cheap, factual, shame-free.
- **Slow lane (backstop):** dormancy scan (threshold ~2–3 weeks, tunable) opens the four-exit conversation: recommit / reshape / release / park. Wave-offs narrow rather than repeat; resolution means a user-chosen state.
- **Escalation interlock (3.2):** an ignored Level-3 escalation converts to renegotiation of the escalation itself.

## 7. Message stream & graded consent

- Morning shape-of-the-day message + event-driven observations; cadence is a first-class setting; all cadence/style adaptation flows through 3.8 (pattern-based, offered not imposed for contract-level changes).
- Consent ladder in the data model (§3 items.escalationLevel); Level 2/3 assignment requires a deliberate UI flow (explicit confirmation naming what the system is now allowed to do). Level 1 messages are silent-drop safe; Level 2 = OS-level alert; Level 3 = repeat-until-acknowledged, then renegotiate.
- Transition runway: calendar-derived advance warnings ("in 15 minutes you'll need to leave for pickup") — never moment-of alarms.

## 8. AI layer

- Single context gate (`model/context.ts` pattern carried over): tombstone filtering (released/parked items excluded from proposal context unless explicitly relevant), citation of source captures, no-shame register enforced at the prompt boundary with the 3.1 conduct rule as system-prompt law.
- Proposal generation is asynchronous, idempotent, version-checked; every output lands in `proposals`, never directly in canonical tables.
- Breakdown conversations (by judgment with consent, or by request); decomposition output enters as proposals.

## 9. Testing, eval, privacy

- Vitest + convex-test; CI on every push.
- **No-shame CI test (carried over, now broader):** asserts no overdue count/representation is derivable from any query surface, and that `released`/`parked` render as first-class states.
- **Custody tests:** kill-network/kill-LLM capture scenarios; buffer drain idempotency; transcription-failure audio retention.
- **Eval harness:** labeled corpus from the founder's ~20-minute voice brain-dump (Step 1, unchanged — still the assignment); categorization/anchor-proposal metrics; provider zero-retention; no capture text in Sentry; no preview-deploy access to real data.

## 10. Build order

- **T1** Scaffold: Next.js PWA + Convex + Vitest/convex-test + CI + Sentry-with-scrubbing.
- **T2** Auth: Convex Auth single-user allowlist; every function asserts; public/internal split.
- **T3** Schema + lifecycle: all §3 tables; transition maps as an explicit module; no-shame CI test.
- **T4** Custody pipeline: offline buffer → captures; voice record-upload-transcribe; degraded modes; custody tests.
- **T5** Proposal layer: async jobs, context gate, proposals table flow.
- **T6** Confirm/converse UI (minimal) + transparent-memory surface + in-context corrections.
- **T7** Calendar read integration + routine anchors in memory.
- **T8** Message stream + Web Push + consent ladder + transition runway.
- **T9** Thin closed loop + interventions outcome tracking.
- **T10** Renegotiation engine, both speeds + escalation interlock.
- **T11** Breakdown conversations.
- **T12** Eval harness + privacy boundary tests.
- **T13** Decay-tripwire digest (from TODOS.md; Convex cron + Resend) — lands once T4+T8 exist; re-anchored from the old plan.

Step 1 (record the voice brain-dump) requires no code and gates T12's corpus; nothing else blocks on it.

## 11. Success metrics (per brief §6 + Codex guidance)

Track: capture keeps happening (esp. voice); messages keep getting read; some items renegotiated/released/parked rather than rotting; thin-loop outcome taps keep coming; time-to-first-action when offers are accepted. **Explicitly not optimized:** notification engagement, tasks-completed counts (they push toward nagging and easy-task selection).

## 12. Open questions for eng review

- **Q1** Calendar provider: Google Calendar API vs Apple Calendar (CalDAV) — where does the family calendar actually live, and which is tolerable to integrate read-only in v1?
- **Q2** Transcription provider (Whisper-class; on-failure audio retention is fixed regardless).
- **Q3** LLM provider + model tier for proposal generation vs conversation.
- **Q4** The old design's goal layer (goals/projects/tasks spine with proposed|active|dormant|released goals) is **dropped** in this plan — the revised brief's data model (§6) doesn't include it. Deliberate simplification; confirm or restore.
- **Q5** Feedback-timer defaults and the divergence-signal set for the fast lane — what's the minimum honest version?
- **Q6** Web Push reliability on iOS PWA in practice — fallback posture if delivery proves flaky (the decay-tripwire email digest may need to arrive earlier).
