# Executive Function Prosthesis — Engineering Plan (v3)

**Status:** REVIEWED — locked by /plan-eng-review 2026-07-19 (13 review issues + 14 outside-voice findings resolved; see GSTACK REVIEW REPORT at end)
**Source of truth:** `executive-function-prosthesis-brief.md` (research-verified, principles revised 2026-07-19). Supersedes the v2 draft and the July 18 design doc entirely.
**Scope decisions locked:** read-only calendar is v1 infrastructure; initiation ships as the thin closed loop only; Level 2/3 escalation UI deferred post-v1 (schema ships); capacity modeling stays deferred per brief §7.

---

## 1. What v1 is

The attachment socket (brief §6): frictionless voice-first capture, the check-in message stream, consent-based breakdown — plus the thin closed loop (propose one next action → "want to start?" → one-tap outcome check) and read-only calendar so proposals about the day are honest. Success = the founder uses it daily for a month without decay.

**Milestones (dogfood clock starts at M2):**

- **M1 — "it holds":** T1–T6 (scaffold → custody → capture entry → digest). Founder begins real daily capture; the daily email digest is the resurfacing floor that keeps 3.9's contract during the capture-only phase.
- **M2 — "it speaks":** through T10 (proposals, memory, calendar, stream). **The official 30-day dogfood clock starts here.**
- **M3 — "it acts":** T11–T14 (thin loop, renegotiation, breakdown, eval) land during the dogfood month.
- **Cut line:** if the timeline slips badly, M2 is the shippable product and the clock starts anyway.

Non-negotiable architectural consequences of the principles:

- **3.9 (custody is absolute)** → capture is write-first, offline-capable, never depends on the LLM — and custody means *arrival + processing + resurfacing*, not insertion (§4 closure loop). The client buffer is an **airlock, not a vault**.
- **3.2 (graded consent)** → the full ladder lives in the schema; v1 ships Level 1 behavior only (ladder UI/interlock is the first post-v1 feature — see TODOS).
- **3.5 (two speeds)** → same-day divergence machinery with an explicit anti-nagging ceiling (§12).
- **3.8 (close the loop)** → every proactive act records its outcome on the message record itself (`outcome`, `deliveries[]`); the system monitors its own delivery channel.
- **3.1/3.7 (no shame)** → no overdue representation on any query surface (CI-enforced) **and** a tone eval over generated message text (§13) — structure and voice both tested.
- **3.6 (transparent memory)** → everything inferred is a queryable, editable record, corrected in context.

## 2. Stack

- **Web app:** Next.js on Vercel, installable PWA targeting iOS Safari.
- **Backend/data:** Convex (functions, database, scheduler/cron, file storage for audio). Async work uses Convex's built-ins: reliable mutations for core logic, scheduled actions for external calls (exactly-once for scheduled mutations).
- **Observability:** Sentry with scrubbing — no capture text or transcript content in events. Privacy gates are per-integration, not end-loaded (§13).
- **Voice:** MediaRecorder record-then-transcribe with **mimetype detection** (iOS Safari emits `audio/mp4`, not webm; container type stored with the blob). Transcription: **OpenAI (gpt-4o-transcribe / whisper-1)** — note: OpenAI retains audio ~30 days for abuse monitoring; §13 reflects this honestly; ZDR approval is a TODO. Audio retained on transcription failure (3.9).
- **Capture entry (beyond the PWA):** **Siri Shortcut** ("capture" → dictation → POST to authenticated capture endpoint) and **PWA `share_target`** — the hands-free paths that match how thoughts actually arrive (T6).
- **Push:** Web Push for the installed PWA + **email (Resend)** as the reliability floor. Subscription re-validated on every app open; delivery health monitored via `deliveries[]` (iOS PWA push endpoints are documented to expire silently). Notifications are pointers; the stream is the record.
- **AI:** **Anthropic Claude Opus 4.8** (`claude-opus-4-8`) for all calls via the single gate module (`model/context.ts` pattern); structured outputs (`output_config.format` json_schema) for proposals; prompt caching on the stable system prompt (3.1 conduct rule as system-prompt law). Model ID is gate config — tiering later is a config change (TODO).
- **Calendar:** **Google Calendar API**, read-only. All sub-calendars mirrored by default with per-calendar include toggles (visible in settings — 3.6 applied to inputs). Per-calendar `syncToken` incremental deltas on a ~5-min Convex cron, full-resync fallback on token expiry. No event writing in v1.

## 3. Data model (Convex tables)

Canonical tables hold **confirmed facts only**; AI output lives in `proposals` until accepted. Explicit indexes for hot paths: items by `parentId`, by lifecycle state, by scheduling window; messages by `threadId`, by `readAt`.

- **captures** — immutable inbox. Raw text or audio ref (+ container mimetype) + transcript when available, timestamps, source (voice/text/siri/share), processing status. Written *before* any AI touches anything. Never edited or deleted by pipeline logic. **Unconfirmed captures are first-class resurfacing citizens** (§10, §11): the digest, stream, and thin loop all read them — nothing waits on a confirmation to be seen again.
- **items** — the task/project/thought spine. Lifecycle per §6's transition map. Fields: title, body, categoryId, **parentId** (decomposition hierarchy — a "project" is an item with children), scheduling anchor (event-phrased free text + optional resolved window, resolved by the anchor resolver §8), **hardDeadline** (optional real-consequence timestamp, distinct from soft windows — "the lab closes at noon" gets a field, per 3.7 temporal truth), **estimatedDuration** (optional coarse bucket: 5m/15m/30m/1h/2h+/multi-session; AI-proposed, user-confirmed), escalationLevel (1 default | 2 | 3, with levelSetAt + levelRationale — **schema only in v1**; assignment UI deferred), parkedUntil, **captureIds[]** (many-to-many provenance — one brain-dump yields many items; a later capture may update an existing item; extraction records in `proposals` keep traceability).
- **categories** — AI-proposed, user-confirmed hierarchy; `uncategorized` is a valid permanent state.
- **people** — referenced entities from day one; name + relationship + link refs.
- **links** — typed refs between items/people/categories (types enumerated in schema); persist across terminal states. Release-revival: a revived intention is a **new item linked to the released one** — history preserved as links, never as counters (no failure-weight accumulation).
- **proposals** — every AI suggestion (categorization, anchor, duration, breakdown/extraction, next-action, memory correction) with status workflow (`proposed → accepted | adjusted | declined | expired`) and provenance (model, prompt version, source captureIds). **Extraction proposals** may yield multiple items from one capture. A proposal ignored ~a week rolls into a batch offer ("want me to just file these five my way?") — confirmation by consent, deferred, never assumed.
- **memory** — the transparent user model: routines/anchor events (**with per-routine runway buffers**, e.g. "pickup needs 25 min" — user-stated, editable), preferences, patterns, important dates. Provenance on every record (user-stated / AI-inferred / AI-inferred-user-confirmed); editable/deletable; surfaced for correction in context.
- **messages** — **the single communication table** (consolidates the former messages/interventions/conversations tri-split): threadId, author (user|system), kind (shape-of-day, observation, offer, outcome-check, renegotiation, transition-runway, digest-pointer, capture-confirm…), content, readAt, **outcome** (accepted/declined/ignored/taps + timing — 3.8's substrate), **deliveries[]** (per-channel attempts: push/email/in-app, status, timestamps — the delivery-health monitor reads this), relatedItemIds, provenance. Conversations are threads; interventions are system-authored messages with outcomes. One write path (§10's sender); drift is structurally impossible.
- **calendarEvents** — read-only mirror (~4-week window) of all included sub-calendars, per-calendar syncTokens, explicit IANA timezone on all window math.

## 4. The custody pipeline (capture path)

```
 thought (voice / text / Siri / share-sheet)
    │  synchronous with user gesture
    ▼
 [1] client airlock buffer (IndexedDB; in-memory last resort)
    │  drain IMMEDIATELY + retry w/ backoff + on app-open/visibilitychange
    │  honest sync state: optimistic UI + visible "not safely stored yet"
    │  if draining keeps failing (never silent)
    ▼
 [2] captures insert (idempotent by client-generated id)     ← CUSTODY BEGINS HERE
    │  voice: audio blob (typed container) uploads first;
    │  transcript attaches when transcription job completes;
    │  on failure audio stays + item says so honestly
    ▼
 [3] async extraction/proposal job (scheduled action; idempotent, version-checked)
    │  LLM down → capture sits safely as `captured`; custody never waits on intelligence
    ▼
 [4] confirm/converse (one-tap accept / short adjust exchange)
    │  accepted facts → items / memory
    ▼
 [5] CLOSURE LOOP: stuck-job scanner (cron) retries stalled transcription/extraction;
     dead-letter surface in UI ("2 captures couldn't be processed — tap to retry");
     Convex export backup on a schedule + documented, tested restore procedure.
     Custody = arrival AND processing AND resurfacing — a capture stranded in
     `captured` forever is lost under 3.9's own definition.
```

**Voice degraded ladder** (localStorage cannot hold blobs — the fallback is explicit): IndexedDB write fails → attempt direct streaming upload to Convex; offline too → hold in memory with a visible "can't store this safely yet — keep the app open a moment" warning + offer text capture. Visible graceful failure is survivable; silent partial failure is the trust-killer.

## 5. Capture entry surfaces

- PWA: one-tap voice (primary), text field (secondary).
- **Siri Shortcut**: "Hey Siri, capture" → dictation → authenticated POST to the capture endpoint → same captures inbox, same custody. Restores the hands-free mid-drive/mid-shower path that currently works in the founder's life.
- **Share sheet** (`share_target`): share text/URLs from any app into the inbox.

## 6. Lifecycle & transition map (T3 implements exactly this)

```
                      ┌────────────────────────────────────────────────┐
                      │                  (renegotiation exits)          │
                      ▼                                                 │
 captured ──confirm──▶ shaped ──anchor accepted──▶ scheduled-ish ──▶ done
 (capture              │  ▲                          │    │
  record)              │  └──anchor removed──────────┘    │
                       │                                  │
                       ├──────────▶ released ◀────────────┤   (terminal; celebrated;
                       │              │                   │    revival = NEW item
                       ├──────────▶ parked ◀──────────────┤    linked to old)
                       │              │
                       │        parkedUntil reached
                       │              ▼
                       │           shaped   (returns as fact, not debt)
                       │
                       └── [dormant] internal flag on shaped OR scheduled-ish
                            after ~2–3 wks untouched (tunable) → opens slow-lane
                            renegotiation (recommit / reshape / release / park).
                            NEVER rendered as overdue — CI-enforced.
```

Rules the map encodes (all 3.4/3.5/3.7 decisions, made at review): parked items return to `shaped` when `parkedUntil` arrives and may be mentioned in the next shape-of-day as fact; `released` is terminal and revival creates a new linked item (no "released 3 times" surface can exist); dormancy applies to *any* non-terminal, non-parked item — including never-anchored `shaped` items, where most rot would hide. Transition module rejects everything not drawn above; tests enumerate all legal and illegal transitions. This diagram lands as a code comment in the transitions module and is maintained with it.

## 7. AI layer

- Single context gate (`model/context.ts`): tombstone filtering (released/parked excluded from proposal context unless explicitly relevant), citation of source captures, no-shame register enforced at the prompt boundary (3.1 conduct rule as system-prompt law), prompt caching on the stable prefix.
- All proposal generation asynchronous, idempotent, version-checked; structured outputs (json_schema) guarantee parseable proposals; every output lands in `proposals`, never directly in canonical tables.
- **Generic proposal-review component** (T7): one UI renders any proposal kind — accept / adjust / decline. Future proposal kinds ship with zero new UI.
- Breakdown conversations (by judgment with consent, or by request); decomposition output enters as proposals creating child items via `parentId`.

## 8. Anchor resolver (named module — the hot loops' load-bearing machinery)

Converts event-phrased anchors ("after school drop-off Thursday") into concrete time windows by joining memory routines against calendarEvents. Re-resolves daily and on calendar deltas. Unresolvable anchors are honest: flagged for an in-context clarification, never silently dropped — an unresolved anchor means the fast lane cannot fire for that item, so resolution status is visible. Owns its tests (routine matching, re-resolution on calendar shift, DST weeks, unresolvable phrases).

## 9. Cold-start bootstrap (first-week trust window)

- **Brain-dump mining:** the Step-1 ~20-min voice brain-dump is processed by the extraction pipeline into proposed items AND proposed memory records (routines, people, important dates) — the eval corpus and the seed data are the same recording.
- **Routines interview:** the first check-in conversation asks for the skeleton of a normal week (drop-off, pickup, medication, trash) — each answer a user-stated memory record with runway buffers.
- Day-1 shape-of-day messages draw on seeded routines; the system never fakes familiarity it doesn't have.

## 10. Message stream & orchestration

- **Single sender choke point:** every outbound message is written and delivered by one module — one write path for message + outcome + deliveries.
- **Orchestration policy (the "planner"):** an explicit scheduled pass decides generate / suppress / dedupe / invalidate / reschedule — morning shape-of-day, event-driven observations, runway messages, digest content. Calendar changes invalidate stale pending messages. Cadence is a first-class setting; contract-level adaptation is offered, not imposed (3.8).
- **Transition runway (honest v1 scope):** calendar-event lead-time reminders using per-routine user-stated buffers from memory ("you said pickup needs 25 min"). No travel-time claims. Freshness = the ~5-min poll; if the last sync is stale the message says what it knows. Watch channels + travel-time are the post-v1 upgrade (TODO).
- **Delivery:** Level 1 posture for everything in v1 — ignorable observations and offers. Push + in-app; **email digest (T5) is the daily reliability floor** and lists unconfirmed captures ("3 thoughts not yet filed" — inventory, never debt; wording covered by the tone eval).
- **Delivery health:** re-subscribe on open; a scheduled check reads `deliveries[]` vs readAt patterns — push looks dead → say so via channels that work and offer to fix it (3.8 applied to infrastructure).

## 11. The thin closed loop (v1's one hot-loop implementation)

On engagement (app open or message reply): propose **one** next action, phrased as an offer. **Arbitration is spec'd:** candidates = leaf items (never a parent with un-done children) + unconfirmed-capture clearing; filter by window-fit (estimatedDuration ≤ current calendar gap); rank by hardDeadline proximity; offer one. If accepted: feedback timer (default 30 min, tunable per-offer) fires a one-tap outcome check: `started / blocked / changed / release`. Every branch records an outcome; `blocked`/`changed` open renegotiation; `release` celebrates per 3.4. An ignored check is data, never a retry trigger (3.8).

## 12. Renegotiation engine (two speeds, with restraint)

- **Fast lane (same-day):** three divergence signals, locked — feedback timer expired unanswered; anchored window passed without a start; calendar shift collides with an anchor. **Restraint rules (the Motion lesson, as spec):** max one fast-lane replan offer per item per day; an ignored offer is an intervention outcome, never re-fired for the same divergence; multiple same-day divergences collapse into one "today's shape changed" message.
- **Slow lane (backstop):** dormancy scan (~2–3 wks, tunable) opens the four-exit conversation: recommit / reshape / release / park. Wave-offs narrow rather than repeat; resolution means a user-chosen state.
- Escalation interlock deferred with the ladder UI (post-v1, TODO).

## 13. Testing, eval, privacy

- Vitest + convex-test; CI on every push; Playwright E2E for the two web journeys (capture→proposal→confirm; offline capture→reconnect→drain); **manual iOS device checklist** (install, voice capture, push arrival, offline capture) — no automation reaches installed-PWA iOS Safari, so this is honest, not optional.
- **No-shame CI test:** no overdue count/representation derivable from any query surface; released/parked render as first-class states; no release-count surfaces.
- **Tone eval (litmus test #1, tested):** adversarial corpus of the highest-shame-risk generated text — renegotiation openers, wave-off narrowing, pending-capture digest wording — scored against a no-shame rubric (LLM-judged + founder-labeled). The conduct rule is a test, not an assertion.
- **Custody tests:** kill-network/kill-LLM capture; buffer-drain idempotency; IndexedDB-eviction simulation (buffer wiped between sessions → app tells the truth); transcription-failure audio retention; voice degraded ladder; stuck-job scanner + dead-letter retry; backup/restore exercised.
- **Per-step tests (named in §14):** transition-map exhaustive legal/illegal; context-gate tombstone filtering; structured-output conformance; job idempotency; syncToken resync + full-resync fallback; per-calendar toggles; TZ/DST window math; anchor-resolver suite; delivery ladder + health detection; thin-loop outcome branches; fast-lane rate limit + collapse; dormancy + four exits + narrowing.
- **Eval harness:** labeled corpus from the founder's brain-dump; categorization/anchor/extraction metrics + the tone eval.
- **Privacy gates per integration (not end-loaded):** each step that adds an external surface lands with its boundary test — T4: no capture text in Sentry, Convex/Vercel log hygiene, provider error bodies scrubbed, OpenAI retention posture documented (~30-day abuse-monitoring; ZDR pursuit is a TODO); T5: minimal email content; T9: calendar data stays in Convex; T10: push payloads are pointers, no content in notification previews; T14: full-surface audit; no preview-deploy access to real data.

## 14. Build order

**M1 — "it holds"** (informal daily use begins)
- **T1** Scaffold: Next.js PWA + Convex + Vitest/convex-test + CI + Sentry-with-scrubbing.
- **T2** Auth: Convex Auth single-user allowlist; every function asserts; public/internal split.
- **T3** Schema + lifecycle: all §3 tables + indexes; transition module implements §6's map exactly; no-shame CI test; transition-map tests.
- **T4** Custody pipeline: airlock buffer → captures; voice record-upload-transcribe (mimetype detection); degraded ladder; closure loop (stuck-job scanner, dead-letter UI, backup/restore); custody tests incl. eviction; privacy gates.
- **T5** Daily email digest (Resend): today's captures + pending confirmations; the resurfacing floor. (Absorbs the old decay-tripwire TODO.)
- **T6** Capture entry: Siri Shortcut endpoint + `share_target`.

**M2 — "it speaks"** (30-day dogfood clock starts on completion)
- **T7** Proposal layer + confirm/converse: context gate, structured outputs, extraction records, generic proposal-review component, transparent-memory surface, in-context corrections, batch offer for stale proposals.
- **T8** Cold-start bootstrap: brain-dump mining + routines interview (§9).
- **T9** Calendar read integration: Google API, sub-calendar toggles, syncToken deltas, TZ math + **anchor resolver module** (§8).
- **T10** Message stream + orchestration: single sender, planner pass, Web Push + re-subscribe + delivery health, runway (honest scope), paginated stream UI.

**M3 — "it acts"** (lands during the dogfood month)
- **T11** Thin closed loop + arbitration (§11) + outcome tracking.
- **T12** Renegotiation engine, both speeds + restraint rules (§12).
- **T13** Breakdown conversations (decomposition via parentId).
- **T14** Eval harness + tone eval + remaining privacy boundary tests.

Step 1 (record the voice brain-dump) requires no code; it gates T8's seed data and T14's corpus — record it before T7 lands.

## 15. Success metrics (per brief §6 + Codex guidance)

Track: capture keeps happening (esp. voice, esp. via Siri path); messages keep getting read; some items renegotiated/released/parked rather than rotting; thin-loop outcome taps keep coming; time-to-first-action on accepted offers; unconfirmed-capture backlog stays bounded. **Explicitly not optimized:** notification engagement, tasks-completed counts (they push toward nagging and easy-task selection).

## 16. Resolved questions (was §12 "open questions")

- **Q1 → Google Calendar API**; all sub-calendars, per-calendar toggles (default all); no system sub-calendar in v1 (first calendar-writing feature, TODO).
- **Q2 → OpenAI transcription** (gpt-4o-transcribe/whisper-1); ~30-day retention documented honestly; ZDR pursuit TODO.
- **Q3 → Claude Opus 4.8** for everything via the gate; structured outputs; caching; tiering later is config (TODO).
- **Q4 → goal layer stays dropped**; decomposition via `items.parentId`; leaf-preference rule in arbitration.
- **Q5 → locked:** three divergence signals; 30-min timer default; one replan offer per item per day; same-day collapse.
- **Q6 → answered by design:** re-subscribe on open, delivery-health monitoring, email floor at T5; push flakiness is assumed, not awaited.

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | — | — |
| Codex Review | `/codex review` | Independent 2nd opinion | 1 | CLEAR | 6 findings (CX1–CX6), all resolved & folded |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | CLEAR | 13 issues, 0 critical gaps, all resolved |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | — | — |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | — | — |

**CODEX:** ran as outside voice (10-min timeout) after a Claude-subagent second opinion; contributed 6 non-overlapping findings — unconfirmed-capture graveyard, arbitration schema, orchestration design, custody closure, extraction provenance, per-step privacy gates — all ruled and folded into v3.

**CROSS-MODEL:** Claude subagent (8 findings: capture entry friction, milestones, anchor resolver, cold start, runway scoping, ladder deferral, tone eval, voice degraded ladder) + Codex (6 findings) had zero overlap with each other or with the 13 in-review issues; one Codex finding (provisional items) collided with the locked confirmed-facts-only ruling and was resolved via the resurfacing-inclusive variant (D21). One prior ruling (D3) was explicitly amended by D20 (ladder UI deferred).

**VERDICT:** ENG CLEARED — ready to implement (T1). CEO/design reviews optional; not required for this scope.

NO UNRESOLVED DECISIONS
