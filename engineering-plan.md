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

## 4.5 Interaction states (locked by /plan-design-review D4)

**Capture state machine — the §4 pipeline as the user sees it:**

| State | User sees |
|-------|-----------|
| idle | dock: mic + "Type instead…" |
| recording | live waveform + elapsed timer, tap-to-stop; no other chrome |
| captured-locally | capture card appears instantly at top of stream; "Saving…" in secondary gray |
| in custody | line becomes "Saved," fades after ~2s (variant B's "Synced just now" beat) |
| drain failing (>~30s, or app about to background) | persistent amber-neutral line pinned above the dock: "Not safely stored yet — keep the app open a moment," with the audio player visible so the thing itself demonstrably exists. **Never red, never an alert icon.** |
| transcribing | "Transcribing…" on the card; the audio is the content until then |
| transcription failed | "Couldn't transcribe — audio kept" + play button (3.9 honesty) |

**State placement rules (every named degraded state has a home):**

- Dead-letter and push-health notices are **system-authored stream messages** (kind: system-health), styled like any other message — the system's failures go through its own channel, framed as its responsibility. No red banners, no alert modals.
- Per-capture processing states live on the capture's own stream card, nowhere else.
- Offline: one thin neutral bar above the dock — "Offline — captures are kept on this phone until you're back."
- **Proposals never render a loading state** — they appear when ready; absence is the loading state. The user never watches the AI think.
- Calendar staleness renders only inside messages that depend on it ("as of 9:40 — sync's been down an hour"), never as a global warning.

**Empty states are features:** the stream is never empty — the system speaks first (§9.5). Held empty: "Nothing here yet — everything you capture lands here and stays." Memory empty: "I'll propose things as I learn them — you approve each one."

**Unread:** a faint left-edge accent that self-clears when the message has been on screen (viewport-seen — no gesture, no clearing obligation). No numeric unread badge anywhere, in-app or app-icon (CI-enforced, §13).

## 5. Capture entry surfaces

- PWA: one-tap voice (primary), text field (secondary).
- **Siri Shortcut**: "Hey Siri, capture" → dictation → authenticated POST to the capture endpoint → same captures inbox, same custody. Restores the hands-free mid-drive/mid-shower path that currently works in the founder's life.
- **Share sheet** (`share_target`): share text/URLs from any app into the inbox.

## 5.5 Navigation & screens (locked by /plan-design-review D3)

Three destinations plus a persistent capture dock — no tab bar, no dashboard, no card-grid landing:

```
 ┌──────────────────────────────────────┐
 │ [Held]      (day header)       [You] │  quiet corner entries — NO badges,
 │                                      │  NO counts, ever (CI-enforced)
 │  THE STREAM  ← home screen           │
 │  newest assistant turn = dominant    │  day-grouped message cards (§10);
 │  visual anchor; push deep-links      │  proposals render inline (§7),
 │  land here                           │  never a separate destination
 │                                      │
 │ ┌──────────────────────────────────┐ │
 │ │ [⌨]    ( MIC ≥64pt )   Type…     │ │  capture dock: every screen,
 │ └──────────────────────────────────┘ │  thumb reach, tap = recording
 └──────────────────────────────────────┘     starts immediately (§4.5)
```

- **Stream = home.** The product's value surface (brief litmus #8); opening the app lands here, always scrolled to newest.
- **Held** (top-left): search/browse of everything in custody — items by category, captures, people, link history. Framed as an archive that demands nothing: no counts, no "needs processing" queue, no lifecycle-state sorting that fronts stale items.
- **You** (top-right): transparent memory (§3 `memory`), calendar include toggles, cadence, delivery health, quiet hours, email address. Settings live here — no separate settings destination.
- **Capture dock:** mic primary (≥64pt), text field secondary, keyboard toggle tertiary; visible on all three destinations. The dock is always *capture* — replying to a thread happens only inside that thread's expanded view (prevents reply/capture conflation corrupting both the conversation context and the captures inbox).
- Visual reference: approved mockup variant B (see Approved Mockups).

**Container rule (D6):** a container exists *only* to differentiate message kind (tint + glyph + label, variant B's system: e.g. green=shape-of-day, cream=observation, lavender=offer, blue=captured) or to hold actions. No nested cards, no decorative shadows, no colored left-borders, one radius token everywhere. Informational-only content inside an expanded thread renders as plain typography. This is the guardrail against card proliferation as T7–T13 add message kinds.

## 5.6 Design language (locked by /plan-design-review D7; extracted from approved variant B)

Implemented as CSS variables at T1 — framework defaults never determine the brand.

- **Color tokens:** warm off-white ground; near-black ink; deep-green accent (B's mic/Accept green); low-saturation per-kind container tints (§5.5 container rule); secondary gray; amber-neutral for degraded states. **No red anywhere in v1** — memory deletion confirms in neutral emphasis; nothing in v1 qualifies for the "immediate external danger" red is reserved for.
- **Dark mode ships at T1** via the same tokens (`prefers-color-scheme`): near-black `#121212`-family ground (never pure black/white extremes), tints re-derived at low luminance. A light-only screen at 11pm is a sensory event for this audience.
- **Typography:** Figtree (self-hosted variable woff2, preloaded at T1), `-apple-system` fallback only, line-metrics checked against fallback. ≥17px/1.5 body, rem-based so iOS text-size settings scale everything; two weights.
- **Density rule (brief C.1):** never more than ~3 actionable things above the fold — an acceptance criterion, not a vibe.
- **Motion budget — exactly three families:** (1) capture-state transitions; (2) a new assistant turn entering *without moving the reading position*; (3) calm collapse/closure after a decision. Everything else is immediate. All motion ≤200ms fades/eases; no bounces, no auto-scroll, no ambient pulsing — a notification-adjacent product that wiggles is a nag. Honors `prefers-reduced-motion` (brief C.7: surprise is dysregulating, including motion).

## 5.7 Accessibility & viewport contract (locked by /plan-design-review D8; lands at T1, tested per-step)

- **Touch targets ≥44pt** everywhere; capture mic ≥64pt (§5.5).
- **Screen-reader contract:** all controls labeled; capture states announced ("Recording," "Saved") — the trust beat must be audible, not just visible; message kind + content read in stream order; the §11 outcome grid reads as four options, not a table.
- **Haptics where supported** on capture start/stop and "Saved" — the eyes-free confirmation channel.
- **Visible keyboard focus** (`:focus-visible` ring in accent green); every action chip keyboard-operable.
- **Contrast ≥4.5:1 for body text in both modes**, checked against each §5.5 container tint specifically (tinted grounds are where contrast quietly dies); secondary-gray text must pass on every tint.
- **200% text scaling without loss of action access** — chips wrap, never truncate; the dock never occludes content (safe-area padding + scroll inset).
- **PWA chrome:** `viewport-fit=cover`; safe-area insets on dock and corner entries; standalone status-bar style per color mode; overscroll containment so the stream doesn't rubber-band the app.
- **Desktop/tablet: one centered column** (max ~640px), dock bottom-center — intentional, not stretched mobile; no multi-pane layout in v1.

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
- **Proposal review: shared shell, per-kind renderers (T7, D6).** One component owns the workflow (accept / adjust / decline); each proposal kind gets its own renderer inside it — category (destination + provenance), anchor (event relationship + calendar context), memory correction (current belief vs proposed), breakdown (collapsed child preview, consent before expansion), next action (direct "want to start?"). **Card anatomy:** headline = the proposal as one plain sentence ("File under Health → Medical, anchored to after drop-off Thursday?"); beneath it the source capture quoted in secondary style — the user's own words as warm provenance; **Accept** the single prominent primary; **Adjust** opens an inline conversational reply on the same card; **Decline** a quiet neutral text button — one tap, no confirmation dialog, visually consequence-free. Model/prompt provenance behind a disclosure tap, never on the face. **Multi-item extraction renders as ONE card** with a checklist of proposed items (all pre-checked, individually untickable) and one accept — one gesture, never five cards (brief §4.3's uninvited-decomposition guard). Week-stale batch offer = one card listing the items, one "file them" action.
- **Memory renders as sentences, not records (T7, D6):** grouped plain-language statements — "School drop-off is around 8:30 on weekdays *(you told me this)*" / "Errands seem to go best after drop-off *(my guess — correct me)*" — provenance expressed in the sentence, AI-inferred items marked with a subtle dashed underline. Tap any statement → edit its text or delete it, single confirmation, no forms. In-context corrections inside stream messages are two inline chips ("Still true" / "Actually…" → one-line reply) writing straight to the memory record.
- Breakdown conversations (by judgment with consent, or by request); decomposition output enters as proposals creating child items via `parentId`.

## 8. Anchor resolver (named module — the hot loops' load-bearing machinery)

Converts event-phrased anchors ("after school drop-off Thursday") into concrete time windows by joining memory routines against calendarEvents. Re-resolves daily and on calendar deltas. Unresolvable anchors are honest: flagged for an in-context clarification, never silently dropped — an unresolved anchor means the fast lane cannot fire for that item, so resolution status is visible. Owns its tests (routine matching, re-resolution on calendar shift, DST weeks, unresolvable phrases).

## 9. Cold-start bootstrap (first-week trust window)

- **Brain-dump mining:** the Step-1 ~20-min voice brain-dump is processed by the extraction pipeline into proposed items AND proposed memory records (routines, people, important dates) — the eval corpus and the seed data are the same recording.
- **Routines interview:** the first check-in conversation asks for the skeleton of a normal week (drop-off, pickup, medication, trash) — each answer a user-stated memory record with runway buffers.
- Day-1 shape-of-day messages draw on seeded routines; the system never fakes familiarity it doesn't have.

## 9.5 First-run sequence (locked by /plan-design-review D5)

Ordered; each beat earns the next ask. No setup-completion percentages anywhere.

1. **Welcome** — one screen, the custody promise in one sentence ("Tell me things. I keep them, no matter what.").
2. **Guided Add-to-Home-Screen** — illustrated Safari share-sheet walkthrough, skippable.
3. **First capture invitation** — "Tell me one thing on your mind." The first success is 10 seconds away; the small capture precedes the big ask.
4. **Brain-dump as the second ask**, framed as an offer ("Want to give me more to hold?") — any length, pausable/resumable, progressively saved (feeds §9 mining and the T14 corpus).
5. **Routines interview arrives as the first stream message** — the stream is never empty; the system speaks first.
6. **Notification permission requested only when there is something to deliver** ("I'll have thoughts about your day tomorrow morning — want them as notifications?"). One iOS refusal is near-fatal; the ask must be earned. Email is named as the floor if refused.
7. **Siri Shortcut offered at end of week 1**, not day 1 — one setup ritual at a time (T6 ships the endpoint; the offer is a stream message).

## 10. Message stream & orchestration

- **Single sender choke point:** every outbound message is written and delivered by one module — one write path for message + outcome + deliveries.
- **Orchestration policy (the "planner"):** an explicit scheduled pass decides generate / suppress / dedupe / invalidate / reschedule — morning shape-of-day, event-driven observations, runway messages, digest content. Calendar changes invalidate stale pending messages. Cadence is a first-class setting; contract-level adaptation is offered, not imposed (3.8).
- **Transition runway (honest v1 scope):** calendar-event lead-time reminders using per-routine user-stated buffers from memory ("you said pickup needs 25 min"). No travel-time claims. Freshness = the ~5-min poll; if the last sync is stale the message says what it knows. Watch channels + travel-time are the post-v1 upgrade (TODO).
- **Delivery:** Level 1 posture for everything in v1 — ignorable observations and offers. Push + in-app; **email digest (T5) is the daily reliability floor.** **Digest design (D5):** a personal plain note, not marketing email — single column ≤560px, no hero images, no button-banners; one-sentence human opener; unconfirmed captures listed as the user's own words, **never counted** (a count is the accumulating-number pattern; show the three thoughts, not "3 thoughts"); one quiet link to the app; varied, content-derived subject lines, never count-based. Email links open Safari, not the installed PWA — the digest is fully self-sufficient (it informs; the PWA acts); session continuity across that boundary is a T5 verify step. Layout + subject strategy are tone-eval corpus.
- **Delivery health:** re-subscribe on open; a scheduled check reads `deliveries[]` vs readAt patterns — push looks dead → say so via channels that work and offer to fix it (3.8 applied to infrastructure).

## 11. The thin closed loop (v1's one hot-loop implementation)

On engagement (app open or message reply): propose **one** next action, phrased as an offer. **Arbitration is spec'd:** candidates = leaf items (never a parent with un-done children) + unconfirmed-capture clearing; filter by window-fit (estimatedDuration ≤ current calendar gap); rank by hardDeadline proximity; offer one. If accepted: feedback timer (default 30 min, tunable per-offer) fires a one-tap outcome check: `started / blocked / changed / release`. Every branch records an outcome; `blocked`/`changed` open renegotiation; `release` celebrates per 3.4. An ignored check is data, never a retry trigger (3.8).

**Outcome-check surface (D5):** a stream card — one line ("How did the blood-test errand go?") + four equal-weight, same-color buttons in a 2×2 grid. No primary among them: visual equality of the four outcomes is principle 3.4 rendered. `release` is labeled "Letting it go." iOS web push has no action buttons — the push opens the app to this card; "one-tap" happens here, not in the notification. **Stale checks reword:** unanswered >N hours, the card becomes past-tense-neutral ("This one's from earlier — did it happen, or did the day change?"), then expires into the ignored-is-data path — never re-asked.

**Release acknowledgment (D5):** one quiet sentence of genuine text — "Done — that's off your plate for good." No animation, no emoji, no success-green burst; a gentle settling transition at most (motion budget, §5.6). Release responses are tone-eval corpus (§13).

## 12. Renegotiation engine (two speeds, with restraint)

- **Fast lane (same-day):** three divergence signals, locked — feedback timer expired unanswered; anchored window passed without a start; calendar shift collides with an anchor. **Restraint rules (the Motion lesson, as spec):** max one fast-lane replan offer per item per day; an ignored offer is an intervention outcome, never re-fired for the same divergence; multiple same-day divergences collapse into one "today's shape changed" message.
- **Slow lane (backstop):** dormancy scan (~2–3 wks, tunable) opens the four-exit conversation: recommit / reshape / release / park. Wave-offs narrow rather than repeat; resolution means a user-chosen state. **Surface (D9):** opens as a thread — one narrative message, then four inline chips; "park" offers natural presets ("a month," "after the school year," "tell me when") instead of a date picker; "reshape" hands off to the breakdown conversation (T13).
- Escalation interlock deferred with the ladder UI (post-v1, TODO).

## 13. Testing, eval, privacy

- Vitest + convex-test; CI on every push; Playwright E2E for the two web journeys (capture→proposal→confirm; offline capture→reconnect→drain); **manual iOS device checklist** (install, voice capture, push arrival, offline capture, **VoiceOver + haptics + 200%-text pass verifying §5.7**) — no automation reaches installed-PWA iOS Safari, so this is honest, not optional.
- **No-shame CI test:** no overdue count/representation derivable from any query surface; released/parked render as first-class states; no release-count surfaces; **no numeric unread/pending badge on any communication surface** (in-app, app icon, Held/You entry icons) — accumulating counts attached to the un-dealt-with are banned regardless of what table derives them (D4).
- **Visual no-shame screenshot tests (T14, D10):** the four states where visual shame would accumulate — high backlog, long dormancy, repeatedly-ignored offer, repeated capture failure — screenshot-asserted against the §4.5/§5.6 rules (no red, no counts, neutral registers). The no-shame CI test checks queries; this checks pixels.
- **Tone eval (litmus test #1, tested):** adversarial corpus of the highest-shame-risk generated text — renegotiation openers, wave-off narrowing, pending-capture digest wording, release acknowledgments — scored against a no-shame rubric (LLM-judged + founder-labeled). **Plus all hand-written static UI state microcopy** (§4.5 states, empty states, degraded-ladder warnings): shame lives in state copy as much as in generated text. The conduct rule is a test, not an assertion.
- **Custody tests:** kill-network/kill-LLM capture; buffer-drain idempotency; IndexedDB-eviction simulation (buffer wiped between sessions → app tells the truth); transcription-failure audio retention; voice degraded ladder; stuck-job scanner + dead-letter retry; backup/restore exercised.
- **Per-step tests (named in §14):** transition-map exhaustive legal/illegal; context-gate tombstone filtering; structured-output conformance; job idempotency; syncToken resync + full-resync fallback; per-calendar toggles; TZ/DST window math; anchor-resolver suite; delivery ladder + health detection; thin-loop outcome branches; fast-lane rate limit + collapse; dormancy + four exits + narrowing.
- **Eval harness:** labeled corpus from the founder's brain-dump; categorization/anchor/extraction metrics + the tone eval.
- **Privacy gates per integration (not end-loaded):** each step that adds an external surface lands with its boundary test — T4: no capture text in Sentry, Convex/Vercel log hygiene, provider error bodies scrubbed, OpenAI retention posture documented (~30-day abuse-monitoring; ZDR pursuit is a TODO); T5: minimal email content; T9: calendar data stays in Convex; T10: push payloads are pointers, no content in notification previews; T14: full-surface audit; no preview-deploy access to real data.

## 14. Build order

**M1 — "it holds"** (informal daily use begins)
- **T1** Scaffold: Next.js PWA + Convex + Vitest/convex-test + CI + Sentry-with-scrubbing + **design tokens (§5.6):** color/type/spacing/radius/motion CSS variables, dark mode, Figtree self-hosted, safe-area/viewport PWA chrome (§5.7).
- **T2** Auth: Convex Auth single-user allowlist; every function asserts; public/internal split.
- **T3** Schema + lifecycle: all §3 tables + indexes; transition module implements §6's map exactly; no-shame CI test; transition-map tests.
- **T4** Custody pipeline: airlock buffer → captures; voice record-upload-transcribe (mimetype detection); degraded ladder; closure loop (stuck-job scanner, dead-letter UI, backup/restore); custody tests incl. eviction; privacy gates. **Proto-stream home (D9):** the §5.5 composition ships here — the real stream frame rendering capture cards (§4.5 states), system-health messages, and §9.5 first-run messages; the app never changes shape after this. If the app backgrounds with memory-held audio, next open states exactly what was and wasn't kept (truth-telling extended to the last custody hole).
- **T5** Daily email digest (Resend): today's captures + pending confirmations; the resurfacing floor. (Absorbs the old decay-tripwire TODO.)
- **T6** Capture entry: Siri Shortcut endpoint + `share_target`.

**M2 — "it speaks"** (30-day dogfood clock starts on completion)
- **T7** Proposal layer + confirm/converse: context gate, structured outputs, extraction records, generic proposal-review component, transparent-memory surface, in-context corrections, batch offer for stale proposals.
- **T8** Cold-start bootstrap: brain-dump mining + routines interview (§9).
- **T9** Calendar read integration: Google API, sub-calendar toggles, syncToken deltas, TZ math + **anchor resolver module** (§8).
- **T10** Message stream + orchestration: single sender, planner pass, Web Push + re-subscribe + delivery health, runway (honest scope). Stream completes *inside the T4 frame* — orchestrated message kinds, threads, pagination; new content, same shape (D9). **Notification copy (D9):** category-level, content-free-but-varied lines from a rotated set per message kind ("A thought about your morning," "Quick question when you have a second") — the notification's only job is to earn one open; the stream carries the content. Joins the tone eval. Settings land with owning steps: calendar toggles T9; cadence, quiet hours, delivery health here.

**M3 — "it acts"** (lands during the dogfood month)
- **T11** Thin closed loop + arbitration (§11) + outcome tracking.
- **T12** Renegotiation engine, both speeds + restraint rules (§12).
- **T13** Breakdown conversations (decomposition via parentId).
- **T14** Eval harness + tone eval + remaining privacy boundary tests + visual no-shame screenshot tests (§13).

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

## Approved Mockups

| Screen/Section | Mockup Path | Direction | Notes |
|----------------|-------------|-----------|-------|
| Home (stream + capture dock) | `~/.gstack/projects/lumbering-vocalist-executive-prosthesis/designs/home-stream-capture-20260719/variant-B.png` | Warm cream ground, tinted per-kind message containers (glyph + label), deep-green accent, large bottom mic dock with "Type instead…" | Approved as-is 2026-07-19. Container rule §5.5 bounds it; tokens extracted to §5.6; passed GPT-4o vision gate |

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | — | — |
| Codex Review | `/codex review` | Independent 2nd opinion | 1 | CLEAR | 6 findings (CX1–CX6), all resolved & folded |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | CLEAR | 13 issues, 0 critical gaps, all resolved |
| Design Review | `/plan-design-review` | UI/UX gaps | 1 | CLEAR | score: 5/10 → 9/10, 8 decisions (D3–D10), 0 unresolved |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | — | — |

**CODEX:** eng outside voice (v3): 6 non-overlapping findings, all folded. Design outside voice (this review): HARD REJECT verdict on the pre-review interface spec (stacked-cards rejection, 7/7 litmus fails, "T0 interaction contract" demand) — all 9 findings resolved into §4.5, §5.5–§5.7, §9.5 and per-step rulings D3–D10.

**CROSS-MODEL:** eng voices had zero overlap; design voices (Codex + Claude subagent) **converged** — both independently demanded a pre-implementation UI contract, the capture state machine, visual shame prevention, and a designed release moment. Convergence treated as the strongest signal in the review. Home-screen direction validated by generated mockups (variant B approved on the comparison board).

**VERDICT:** ENG + DESIGN CLEARED — ready to implement (T1). Note: the eng review predates the design-spec additions (§4.5, §5.5–§5.7, §9.5); they change UI scope inside existing steps, not architecture, but a delta eng pass is recommended before T4.

NO UNRESOLVED DECISIONS
