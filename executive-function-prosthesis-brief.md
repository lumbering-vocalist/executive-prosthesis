# Executive Function Prosthesis — Product & Design Brief

**Purpose of this document:** This brief informs an LLM (or human developer) building a personal assistant system for people with executive function challenges (ADHD, autism, executive function disorder). It captures the founder's lived experience, design philosophy, interaction model, and v1 scope. Read the whole document before proposing architecture or writing code — the philosophy sections are load-bearing, not decoration.

---

## 1. Vision

An **executive function prosthesis**: a system that performs executive work *on behalf of* its user — prioritizing, categorizing, sequencing, planning, noticing when plans no longer fit reality — and hands the user the output as low-friction conversation.

This is explicitly **not**:
- Another todo list, however sophisticated
- A personal assistant that acts in the world (booking appointments, sending emails on the user's behalf)
- A habit tracker, productivity gamification system, or accountability coach

The term "prosthesis" is deliberate. A leg prosthesis doesn't remind you that you agreed to walk; it bears weight. This system bears the cognitive weight of task management so the user doesn't have to.

**Development strategy:** Built by and for the founder first (who is autistic, has ADHD, and has executive function challenges), with an eye toward a future SaaS for the neurodivergent population. Every design decision should be validated by daily dogfooding before generalization.

---

## 2. The User & Why Existing Tools Fail

### Documented failure modes (founder's lived experience)

**Capture fails on friction.** If capturing a task/project/status update is not effortless, it simply doesn't happen. Tasks occur at all times — mid-conversation, in the shower, driving, doom-scrolling. Current behavior: sometimes "I'll remember it" (they won't), sometimes "Hey Siri, remind me to..." — which lands in Apple Reminders, never to be seen again.

**Systems require conscious effort to use, so they decay.** The pattern: get motivated → brain-dump into a new system → use it for a few days → never return. Any system that requires the user to *remember to use the system* has already failed.

**Pull doesn't happen; push breeds resentment.** The user doesn't open apps. But alarms and nagging notifications make the user angry — specifically because they induce shame: *"it makes me feel bad that I haven't done what I agreed (with myself) would be done by X time."* Every reminder of an unmet self-agreement is a small shame delivery. Users learn to dread and then abandon the system.

**Execution fails even when capture succeeds.** On the day a task should happen: other things seem/are more urgent; the user is out of spoons; the app never gets opened.

### What actually works (existing evidence)

**Recurring alarms for non-negotiable habitual tasks work.** Daily medication, weekly trash — urgent Apple Reminders with alarms succeed. Insight: alarms aren't inherently bad; they work when the task is non-negotiable and habitual, and they enrage when the system nags without understanding context.

**The Google Health message pattern works.** Google Health sends several messages a day commenting on sleep quality and workouts. The user opens nearly every one — maybe not at the moment of the alert, but they go back and read all of them, sometimes interacting with the AI. **Why it works: the messages are about the user, not at the user.** They offer something (an observation, a reflection) rather than demanding something. There's no debt waiting inside the notification. This is the model for how the prosthesis should communicate.

---

## 3. Core Philosophy (Non-Negotiable Principles)

### 3.1 The system must never make the user feel bad

This is the foundational principle and the stated intent behind every interaction. The enforceable rule beneath it: **the system never uses shame, moral judgment, accumulated failure, or coercion as a control mechanism.** The intent is the north star; the conduct rule is the litmus test a builder can actually apply — feelings can't be guaranteed, conduct can. Concretely:

- A missed or slipped task is **data** ("plans changed; let's re-plan"), never a **debt**.
- **Never display "days overdue" counts** or any accumulating badge of failure, anywhere in the UI or in messages.
- Never open a conversation with what wasn't done.
- The system keeps track of everything (it cannot lie or lose things), but *how it represents and resurfaces the undone* must always read as care, not accusation.
- Accurate urgency is not shame: "the appointment is in 20 minutes and travel takes 15" is the externalized time-sense this product exists to provide. Facts are fine; facts deployed as leverage are not.

### 3.2 Notifications are observations and offers by default, with graded consent above that

Following the Google Health pattern: "You've got a clear morning after school drop-off Thursday — that's a good window for the blood test. Want me to pencil it in?" — not "REMINDER: Blood tests."

But pure optionality fails this population: a cue the user has learned they can always ignore stops being a cue (notification habituation is fast and hard to reverse), and the one pattern proven to work in the founder's life is the urgent alarm for non-negotiables. So the system uses a **graded consent ladder**, configured by the user in advance:

1. **Level 1 (default):** observation/offer — ignorable without consequence. The Google Health register.
2. **Level 2 (user-designated):** direct interruption — the medication/trash alarm pattern, for items the user has marked non-negotiable and habitual.
3. **Level 3 (explicitly authorized, per-item or per-category):** persistent escalation — the system may return, more insistently, until acknowledged ("leave for the airport"). Cancelable at any level, always.

The mechanism that keeps this consistent with 3.1: **urgency is borrowed from prior consent, never generated by the message.** When Level 3 insists, it is past-you keeping a promise, not the system applying pressure. Two structural mitigations are required: (a) escalation levels take deliberate friction to assign — the user cannot casually mark everything urgent in an optimistic moment; (b) an ignored escalation converts to renegotiation, never repetition — "you've waved me off three times; should this still be a Level 3 item?"

### 3.3 The AI runs the executive loops, not just the filing

The user should never have to categorize, prioritize, decompose, or schedule — **and never have to arbitrate, self-start, or notice that a plan has diverged, alone at the moment of action.** The AI proposes; the user approves or converses. "I want AI to think about it, suggest where to put it; if I like it, there it goes; if not, we have a conversation."

The AI's work does not end when the item is filed; that is where it begins. Executive function is not a store of intentions — it is a set of control loops that run at the moment of action (see Appendix C.8). Capture-time work (categorize, decompose, schedule) covers the "cool" loops the user can already do effortfully when calm; the disability lives disproportionately in the "hot," moment-of-action loops: choosing the one thing now, starting it, and noticing same-day that a plan has died. A prosthesis that only does brilliant work on the way into the system and then goes quiet is leg-shaped — it copies the artifact and not the machinery.

### 3.4 Releasing a task is a first-class success

Deciding *not* to do something is a legitimate executive decision, not a failure. There is an explicit "I've decided not to do this" ritual. Released tasks are honored outcomes, tracked distinctly from completed and from stale.

Guardrail: **the system never steers toward release; it makes release safe to choose.** A system that drives renegotiations toward resolution has a subtle incentive to nudge toward release because release clears the queue — celebrated release must remain the user's victory, never the system's tidiness.

### 3.5 Renegotiation runs at two speeds, gentle in tone but resolute

**Fast lane (same-day):** the intact executive renegotiates quietly the moment a plan diverges from reality — plan said morning, morning's gone, revise before it ever becomes A Thing. The system does the same: "today's shape changed — want me to slide the blood test to Thursday's window?" Same-day divergence handling is routine plan maintenance, cheap and shame-free precisely because it's fresh. The longer a dead plan sits unacknowledged, the more it costs to touch.

**Slow lane (backstop):** when a task has been dodged for weeks despite the fast lane, the system opens a gentle renegotiation: "This blood test has been sitting for a while — is it still important, is it the wrong shape, or should we let it go?" The four exits are: **recommit** (possibly reshaped), **reshape** (break down, reschedule, redefine), **release** (celebrated, per 3.4), or **park** (keep it, stop asking until a user-chosen time). The system *noticing* should feel like care, not accusation.

"Gentle" describes the tone, not the resolve. Renegotiation is an active executive function with a finish line — a conversation the system intends to bring to one of the four exits, not a soft nudge that drifts indefinitely. If a renegotiation is waved off repeatedly, the system narrows rather than re-asking softly forever: "We've looked at this three times without landing anywhere. I think it's either wrong-shaped or not actually yours to do right now. Can I propose something specific?" The framing is always about the task's fit, never the user's failure — but kindness without resolve produces politely rotting tasks, and an item gently revisited five times is accumulating exactly the failure-weight this principle exists to prevent. Resolution means reaching a user-chosen state, not clearing the queue.

### 3.6 The system's memory of the user is transparent and editable

Over time the system learns routines (errands go best after school drop-off), patterns, people, dates. Everything it believes about the user must be visible on demand and correctable/deletable by the user. This matters double for an eventual SaaS serving a population that has often been surveilled and pathologized by tools claiming to help them.

Transparency must not become a maintenance job — that would fail litmus test #4. Corrections are offered **in context, at the moment memory is used** ("I assumed after-drop-off works best — still true?"), with the full viewable store as the deep surface behind it, not the primary interface. The user should never have to go administer a database to keep the system honest.

### 3.7 Hard "never" rules

- **Never** shame, guilt, or moralize
- **Never** show overdue counts or failure-accumulation UI — this bans **scorekeeping, not temporal truth**. Day counters, red badges, and "3 missed" are banned; "the lab closes at noon" and "this is due Thursday; consequences change after that" are the externalized time-sense the prosthesis exists to provide (per 3.1: facts are fine, facts as leverage are not).
- **Never** toxic positivity
- **Never** emoji cheerleading
- **Never** gamification (no streaks, points, badges, levels) — this bans **manipulation mechanics, not self-knowledge**. Points, streaks, and variable-reward loops are borrowed-urgency-without-consent, the coercion 3.1 prohibits. Honest reflection offered on request ("you started four things this week you'd been circling for a month") is the Google Health register — about you, not at you. The test: does it create an obligation to *maintain* something? Banned. Does it hand the user a true observation they're free to do anything or nothing with? Fine.
- **Never** ambient listening to the user's conversations (explicit privacy line — the user will share calendar, location, and other data willingly, but drawing the line at always-on audio). The control-loop model does not justify surveillance: calendar, device interaction events, and one-tap state reports are sufficient to run every loop in Appendix C.8.

**Tone target:** a competent, warm, unflappable human assistant. Matter-of-fact kindness. Neither clinical detachment nor cheerleader.

### 3.8 Close the loop: the system notices when *it* isn't working

The system watches the outcomes of its own interventions and changes course when they fail. A message that goes unread, an offer that's always declined, a nudge that never leads to a start, a cadence that gets ignored — these are data about the system, and the system's job is to adapt or ask, never to repeat louder. The prosthesis renegotiates itself the same way it renegotiates tasks (3.5, applied inward). Systems decay from both ends: 2's failure modes describe the user drifting from the system; this principle defends against the system drifting from the user — same message, same cadence, same moves, sliding into wallpaper. Adaptation requires a pattern, not an incident.

Self-correction stays inside 3.6: an inference like "morning messages aren't landing" is part of the system's memory of the user — visible, editable, and *offered* rather than silently applied for anything the user would notice ("I've noticed mornings aren't landing — want me to try after lunch instead?"). Silent adaptation of tone at the margins is fine; silent adaptation of contract-level behavior (escalation levels, renegotiation pacing) is not.

### 3.9 Reliability is the hinge: custody is absolute

The prosthesis is only a prosthesis if the user can put full weight on it without checking. Every capture is kept, verbatim and forever, no matter what — network down, LLM down, app half-loaded. Nothing the system holds is ever silently lost, and nothing resurfaces late because the system forgot. The user must be able to hand a thought to the system and genuinely stop thinking about it — the moment they feel they should double-check, the prosthesis has failed at its one structural job. Once trust in custody breaks, the user reverts to carrying everything in working memory *as backup*: the prosthesis then bears zero weight while still costing attention. And because offloading works — a thought handed off is genuinely released internally — a dropped capture is a thought that exists nowhere.

Concrete constraints: capture cannot depend on the LLM being up (raw thought lands in durable storage first; interpretation is downstream and may fail, retry, or arrive late without any capture at risk); degraded modes are honest (if transcription fails, the audio is kept and the system says so — visible graceful failure is survivable, silent partial failure is the trust-killer); resurfacing is part of the contract (kept-but-never-resurfaced is lost, as far as the user's planning is concerned); and any future feature that makes capture heavier or resurfacing chancier is spending the trust budget the whole product stands on.

The distinction that bounds this principle: **the system's proposals may be wrong; its custody may not.** Interpretations, categorizations, and suggestions are drafts — that is what the confirm/converse seam is for. Custody is absolute.

---

## 4. Interaction Model

### 4.1 Capture (v1 core feature A)

- **Voice capture is a must-have for v1.** Typing into the chat is also supported, but voice is the primary path.
- Capture must be effortless: user speaks/types a raw thought; the AI handles everything else.
- On capture, the AI: interprets the item; proposes a category/project placement; proposes any obvious next step or scheduling anchor; asks at most one lightweight clarifying question when genuinely useful.
- The user confirms with minimal effort, or a short conversation adjusts it.

**Canonical capture exchange (from the founder):**

> User: "Hey, I need to get some blood tests done in the next week."
> System: "OK, I'll file this under Health → Medical. Do you have a day that would be best? How about after you drop the kids off in the morning?"

Note what happened: categorization proposed, a realistic slot anchored to the user's actual routine offered, done in two turns. The AI did the executive work; the user just said yes.

### 4.2 Conversational check-ins (v1 core feature B)

- A message-stream interface modeled on Google Health: the system initiates messages that the user reads on their own schedule (often not at the moment of the push).
- Messages are observations and offers (see 3.2): commenting on the shape of the day, noticing open windows, surfacing at most a small number of timely items.
- Cadence: to be tuned through dogfooding; the founder is unsure of ideal cadence. Start conservative (e.g., a morning shape-of-the-day message plus event-driven observations) and make cadence a first-class setting.
- On a low-capacity day, the system's job is triage and permission, not pressure. (Note: explicit capacity/spoons tracking is **deferred** — see §7 — but the no-pressure posture applies always.)
- **Transition runway:** when a hard commitment approaches, the system gives advance warning ("in 15 minutes you'll need to leave for pickup") rather than a moment-of alarm. Transitions are high-cost for autistic/ADHD brains (see Appendix C.7); the runway is the support, the abrupt interrupt is the harm. Correspondingly, the system should avoid interrupting apparent deep focus for anything of lower value than what the user is doing.

### 4.3 Breakdown conversations (v1 core feature C)

Decomposition of big tasks/projects into manageable chunks happens **by judgment and by request**, never unilaterally:

- **By judgment:** "I need to plan Zeeva's birthday party." → "That sounds like it would benefit from breaking down into smaller tasks — do you agree?" → collaborative breakdown → user can report existing progress ("I've already picked the venue and made the reservation") → system marks those done without ceremony.
- **By request:** "I want to do <big project>, help me break this down into manageable chunks" → conversational decomposition.

The system should not turn one task into five visible tasks without consent — for this population, uninvited decomposition can be overwhelming rather than helpful.

### 4.4 Renegotiation and release

Per 3.4 and 3.5. Stale items surface via gentle renegotiation conversations, never via overdue badges. "I've decided not to do this" is an explicit, supported, positively-framed outcome.

---

## 5. Scope of Life Coverage

**Everything.** Health, household, kids' logistics, work, finances, creative projects — one prosthesis for the whole of life. 

Single-player for now, but tasks naturally reference other people ("Find out from Zeeva what color balloons she wants") — the data model should represent people as entities from the start, even before any multi-user features exist.

**Integrations (future, design for extensibility now):** GitHub Issues, Apple Reminders, and similar external systems the user's tasks already live in or flow through.

**Context access:** The user will share calendar, location, and similar data to make the system context-aware (time-blindness and "other things were more urgent" mean the system needs to know what the day actually holds). **Read-only calendar access is v1 infrastructure** (scope decision, July 2026): the hot loops run blind without it — proactive re-presentation needs to know a window is coming, arbitration needs to know what today holds, and the canonical capture exchange already assumes the system knows Thursday's shape. Calendar *writing*, location, and richer context sources remain post-v1. Hard line: no ambient listening.

---

## 6. v1 Scope (Dogfooding Phase)

The three capabilities for the first month of daily use:

1. **(A) Frictionless capture with AI categorization** — voice-first, conversational confirmation, zero required metadata from the user.
2. **(B) Conversational check-in message stream** — Google Health-style observations and offers.
3. **(C) Breakdown conversations** — consent-based decomposition, by judgment or by request.

**Staging honesty (per 3.3):** v1 implements the capture-time executive work in full, and the moment-of-action work in its thinnest closed-loop form — when the user engages, the system proposes **one** next action, asks whether they want to start it, and follows up shortly with a one-tap outcome check (started / blocked / changed / release). v1 is the attachment socket — the trust-and-control substrate the hot loops (Appendix C.8) will run on — not the finished prosthesis. The principle names the destination; this scope names the first step.

Supporting v1 infrastructure (not a headline feature, but load-bearing): **read-only calendar access** for one provider, so proposals about the day's shape are honest rather than guessed. No event writing in v1.

Everything else (calendar writing, location, external system sync, capacity modeling, multi-user) is explicitly out of v1.

### Platform & stack

- **v1 is a web app**, designed to run well in iOS Safari (installable as a PWA is desirable so it lives on the home screen like an app). A native iPhone app may come later.
- Voice capture in-browser (Web Speech API / MediaRecorder + server-side transcription — implementer to evaluate reliability in iOS Safari specifically, which has known Web Speech limitations; a record-then-transcribe flow via e.g. Whisper-class transcription is an acceptable and possibly more reliable path).
- **Founder's current stack: Vercel, Convex, Sentry.** Build on these unless there's a strong argument otherwise. Other stack choices (LLM provider, transcription service, push notification approach, framework specifics) should be discussed with the founder rather than assumed.
- Push notifications: iOS Safari supports Web Push for installed PWAs; use for the message stream, with the understanding (per §2) that the user often reads messages later — messages must be a persistent, scrollable stream in-app, not ephemeral notifications.

### Data model notes for the implementer

At minimum, first-class concepts should include:
- **Item** (task/project/thought) with lifecycle states including: captured, shaped, scheduled-ish, done, **released** (distinct from deleted), **parked** (user-chosen "keep it, stop asking until X" — per 3.5), and dormant/stale (internal state that triggers renegotiation, never displayed as "overdue")
- **Category/Project hierarchy** — AI-proposed, user-confirmed, flexible
- **People** — as referenced entities (see §5)
- **User memory/profile** — structured, human-readable, fully viewable and editable in the UI (see 3.6): routines, preferences, patterns, important dates
- **Conversation history** — capture and check-in exchanges are conversational; the system's context depends on them

### Success criterion for the dogfooding phase

The founder uses it daily for a month without it becoming another system that decays. Leading indicators: capture keeps happening (especially voice), check-in messages keep getting read, and at least some stale items get renegotiated or released rather than silently rotting.

---

## 7. Explicitly Deferred (Discussed, Not v1)

- **Capacity/spoons modeling** — how the system knows the user's energy today (ask directly vs. infer from calendar density/sleep data vs. volunteered). Deferred by founder decision, but the *never make the user feel bad* posture must hold regardless of capacity awareness.
- **Calendar writing and location integration** — user is willing; fast-follow after v1 core proves out. (Read-only calendar moved into v1 by the July 2026 scope decision — see §5, §6.)
- **External integrations** — GitHub Issues, Apple Reminders sync.
- **Native iOS app.**
- **Multi-user / family features.**
- **SaaS productization** — pricing, onboarding, memory-transparency compliance story for a broader neurodivergent user base.

---

## 8. Design Litmus Tests

When making any product decision, check it against these:

1. **Would this message make someone feel bad about an unmet self-agreement?** If yes, redesign it.
2. **Is this notification an observation/offer, or a demand?** Demands only for truly non-negotiable, user-designated habitual items (the medication-alarm pattern).
3. **Did the user have to do executive work (categorize, prioritize, decompose, schedule) that the AI could have proposed instead?** If yes, move the work to the AI.
4. **Does this feature require the user to remember to use the system?** If yes, it will decay; find a push-stream or ambient path.
5. **Is there any accumulating representation of failure** (counts, badges, red numbers, streak breaks)? Remove it.
6. **Could the user see and correct what the system believes about them?** If not, fix that before shipping the feature.
7. **Does the tone sound like a competent, warm human assistant** — no cheerleading, no emoji confetti, no clinical coldness?
8. **Does this deliver value even if the user never opens the app?** The field's consensus test for ADHD tools (see Appendix B): a tool that requires daily showing-up will fail the way all the others did. Value must flow through the message stream and proactive work, with the app itself as optional depth.

---

## Appendix A: Founder Quotes (verbatim design anchors)

- "If I can't effortlessly capture a task/project/status update, it doesn't happen."
- "I want AI to think about it, suggest where to put it, if I like it, there it goes; if not we have a conversation."
- "[Alarms make] me feel bad that I haven't done what I agreed (with myself) would be done by x time."
- "One of the fundamental principles of this tool is that it should never make a user feel bad. If something doesn't get done, the system will keep track of it. This can be tricky."
- "I used the term 'executive function prosthesis' deliberately."

---

## Appendix B: Competitive Landscape & Lessons (researched July 2026)

This appendix summarizes market research on comparable products, open-source attempts, and documented failure patterns. It exists so the builder understands what has been tried, what worked, what failed, and why this product's differentiators matter. Product details below were accurate as of mid-2026 and should be re-verified before making decisions that depend on them.

### B.1 The field has converged on this brief's core insight

The most consistent finding across 2026 reviews of ADHD tools is a test nearly identical to this brief's philosophy: *does the tool require the user to open it daily to get value? If yes, it will fail the way all the others did.* Newer AI-assistant products now market themselves explicitly on working "whether you open the app or not." Implications:

- **Validation:** the push-stream, prosthesis-does-the-work architecture in this brief is the direction the market's own postmortems point to.
- **Warning:** "proactive AI assistant for ADHD" is no longer novel positioning. Differentiation must come from what nobody else has (see B.5).

### B.2 Closest direct competitor: Saner.AI

Saner.AI is an ADHD-branded AI personal assistant covering notes, email, calendar, and tasks. Its team reportedly interviewed 200+ ADHDers during development. It offers voice capture, automatic organization/tagging, AI-suggested daily plans, and user-scheduled proactive check-ins with reprioritization suggestions the user can accept or ignore — reviewers describe the check-ins as feeling like a gentle coach. Pricing roughly $8–16/month.

**Lessons to take:** proactive check-ins with accept-or-ignore suggestions are well received in practice; voice brain-dump capture is repeatedly cited as the killer feature; "designed around ADHD rather than an ADHD label bolted onto a generic app" is exactly the credibility bar reviewers apply.

**Gaps this product exploits:** Saner is knowledge-worker-centric (notes/email/calendar), not whole-life; reviewers' main criticism is that it is still one more app in the stack; it has no renegotiation/release ritual and no transparent, editable memory model.

**Action for the builder/founder:** sign up for Saner.AI and study its check-in cadence, tone, and failure points firsthand before finalizing the check-in design.

### B.3 Instructive successes (and their structural flaws)

**Tiimo** — visual daily planner built by and for neurodivergent people; won Apple's iPhone App of the Year (2025). Its guilt-free treatment of missed tasks (no red warnings, no overdue states, tasks just move forward; gentle pre-transition nudges instead of jarring alarms) is commercial proof that the no-shame philosophy in §3 sells and can win mainstream recognition. Its documented structural flaw: **the user must build the plan before Tiimo can run the day** — estimating durations, sequencing, and deciding what's realistic are precisely the executive functions ADHD impairs, so on low-capacity days the setup overhead is itself the barrier. Lesson: never require planning as a precondition for value; the AI proposes the plan (§3.3). Also worth studying and borrowing: Tiimo's specific UX patterns for missed-task handling.

**Goblin.tools (Magic ToDo)** — free, no-signup AI task breakdown; went viral in the ADHD community. Proof that consent-based breakdown (its "spiciness" granularity slider is a form of consent) is beloved. Two lessons: (1) *planning is not execution* — its own reviewers note users still freeze after generating the list, which is why this product pairs breakdown with check-ins and scheduling anchored to real routines; (2) it stores no history — a serious flaw for users with working-memory deficits, and a reminder that persistence and recall are core to a prosthesis.

**Motion** — AI auto-scheduler that replans the user's whole calendar when things slip. Demonstrates both sides of "AI does the executive work": automatic no-guilt rescheduling is described by ADHD users as genuine psychological relief, but its aggressive constant replanning triggers anxiety in users who need predictability, its dense time-blocking overwhelms on low-energy days, and its setup burden is heavy. Documented limitation: a scheduled block does not solve task *initiation*, and one-off personal-admin tasks (calls, forms, claims) — often the "impossible" tasks — are what it handles worst. Lessons: replanning should be conversational and consensual, not unilateral; personal-admin one-offs deserve first-class support; scheduling ≠ starting.

**alfred_ / Carly and the autonomous-assistant wave** — email-first AI assistants marketed on requiring no daily ritual: they run on the inbox automatically, or are used by emailing/forwarding rather than opening. Lesson: meeting users in a channel they already inhabit is a proven adoption path; the message-stream in §4.2 is this product's version.

### B.4 Open source: many attempts, a consistent stall pattern

GitHub hosts numerous small projects in exactly this space — virtual executive assistants, Telegram executive-function bots, hackathon "AI for ADHD" agents. The most developed (e.g., **ADHDo**) got the philosophy notably right — shame-free framing, overwhelm detection, mobile nudges via Telegram, local-first privacy — and is worth reading for design ideas. But the dominant pattern is: solo neurodivergent developers start these, articulate excellent principles in the README, and stall before or shortly after shipping.

Lessons: (1) the philosophy in this brief is convergent with what the community independently keeps writing down — it is the right philosophy; (2) the graveyard is a scope-discipline warning, and this brief's three-feature v1 with a 30-day dogfooding gate (§6) is the antidote; (3) check ADHDo and similar repos for reusable design ideas before building from scratch.

### B.5 What no product was found to have (this product's differentiators)

1. **Whole-life scope.** Competitors are work/email/calendar-centric or day-planning-centric. Nothing found covers health + household + kids + work + finances + creative as one prosthesis.
2. **Renegotiation and release as first-class rituals.** No product found treats "I've decided not to do this" as a designed, celebrated outcome, or handles stale items through gentle renegotiation rather than silent rot or overdue states.
3. **Transparent, editable memory.** No product found exposes everything it believes about the user for review and correction. For a repeatedly surveilled and pathologized population, this is both an ethical stance and a marketable trust feature.
4. **The "about you, not at you" message stream** as the primary interface — observations and offers rather than task demands — combined with the above.

### B.6 Business reality check (for the eventual SaaS phase)

- **Indie scale is modest:** a well-loved, press-covered indie ADHD app (Llama Life) with a founder building in public reached roughly $51K ARR after years. Niche affection does not automatically convert to large revenue.
- **Willingness to pay varies wildly:** Inflow sustains ~$48/month by framing itself as ADHD-coaching replacement; most planners sit at $5–20/month; Motion charges $19–34/month and draws price complaints.
- **The community resents subscriptions:** part of Goblin.tools' devotion stems from being free on web with a one-time ~$4 app purchase. The "ADHD tax" makes this audience price-sensitive yet desperate for what genuinely works. Pricing strategy deserves real thought before the SaaS phase; "built by one of us, priced fairly, memory you can audit" is a coherent positioning.
- **Sequencing implication:** the build-for-myself-first plan is not only good product discipline but the financially sane approach in this market.

### B.7 Summary of adopted lessons

The research directly produced these additions to the brief: litmus test #8 (value without opening the app, §8); study Saner.AI's check-ins firsthand before finalizing §4.2; borrow Tiimo's missed-task UX patterns for §3.5's no-shame handling; treat persistence/history as core (Goblin's gap); make replanning consensual and support personal-admin one-offs (Motion's gaps); and keep v1 scope ruthlessly small (the open-source graveyard's warning).

### B.8 Re-verification (July 19, 2026)

An independent fact-check confirmed 7 of 9 claims in B.1–B.6 fully or nearly. Corrections: Saner.AI's "one more app" criticism is competitor-sourced (independent reviews cite feature gaps instead); Inflow's ~$48/month is the worst-case month-to-month price (annual ≈$17/month, and a no-coaching tier exists); Tiimo now ships an AI co-planner that partially mitigates its build-the-plan-yourself flaw; "many stalled" open-source projects is plausible for the long tail but was not systematically verifiable (several top repos show 2026 activity).

**Missed category — messaging-first proactive assistants.** The most significant omission: a wave of assistants that live in channels the user already inhabits, directly attacking the "no daily app ritual" positioning:

- **Poke (Interaction Co.)** — proactive assistant living entirely in iMessage/SMS/WhatsApp; messages you before you ask; first Apple-approved iMessage AI agent (June 2026)
- **Martin (YC S23)** — "Jarvis-like" assistant via SMS, phone call, WhatsApp, email, Slack; proactive reminders by text or call; ~$21/mo
- **Dola** — calendar assistant used entirely inside WhatsApp/Telegram/iMessage (200K+ users); voice/photo/text to events, no app UI
- **Reclaim.ai** — auto-scheduler living inside Google Calendar; frequently ranked above Motion in 2026 ADHD roundups
- **Taskog** — ADHD "brain dump → one startable task" coach whose signature move is no-guilt stale-task triage — a partial version of this brief's renegotiation/release differentiator
- **Tasklr** — ADHD task manager marketed on "no guilt trips" and energy-pattern tracking
- **Claude Cowork (Anthropic)** — cited as the transparency leader for line-by-line user-editable memory

**Impact on B.5's differentiators:** "no daily app ritual" is now a crowded position (the messaging-first wave), renegotiation/release is partially occupied (Taskog), and transparent editable memory has a big-name reference point (Cowork). Differentiators #1 (whole-life scope) and #4 (the about-you-not-at-you stream) survive intact — and the strongest surviving differentiation is the one B.5 couldn't have named before the C.8 revision: **closing the control loop** (running the hot, moment-of-action loops — arbitration, initiation, same-day replanning — under the no-shame architecture). No product found does that.

---

## Appendix C: The Science — How Executive Function Works and What the Prosthesis Replaces

This appendix grounds the product in what is known about executive function in humans, and about how ADHD and autism change it. It exists so the builder understands *which cognitive job each feature is replacing* — the features in this brief are not preferences; they are prosthetics for specific, well-documented mechanisms. Where a finding dictates a design rule, the rule is stated and cross-referenced to the brief.

### C.1 What executive function is

The consensus cognitive model (Miyake & Friedman) decomposes executive function into three core capacities: **working memory** (holding and updating information in mind), **inhibition** (suppressing impulses and distractions), and **cognitive flexibility** (shifting between tasks and mental sets). Higher-order skills — planning, prioritizing, sequencing, initiating — are assembled from these. Working memory is severely limited even in neurotypical adults (roughly 3–4 chunks) and is smaller and less reliable in ADHD.

**Design rules:** The system holds *everything* so the user's working memory holds *nothing* (persistence and recall are core prosthesis functions, reinforcing the lesson from Goblin.tools' missing history, Appendix B.3). The system never presents more than a small number of items at once; the interface surface is 1–3 things, with the full backlog held silently behind it.

### C.2 ADHD is a performance problem, not a knowledge problem

Russell Barkley's central finding: ADHD is not a deficit of knowing what to do; it is a deficit of *doing what you know at the moment it matters* — an "intention deficit." Consequently, help is only effective when delivered at the **point of performance**: the time and place where the behavior needs to occur. Stored advice, stored intentions, and stored lists have little effect; in-the-moment external cues do.

This is the structural reason todo lists fail this population (§2): a list is a knowledge repository for people whose problem is not knowledge. It is also the scientific basis for the product's name — Barkley's own prescription is a **"prosthetic environment"**: external scaffolding that performs what the prefrontal cortex isn't reliably performing, as glasses do for eyes. He adds that such prostheses are not temporary training wheels one graduates from; the need is ongoing, so the scaffold must be sustainable and pleasant to live inside.

**Design rules:** Value is delivered at the point of performance via the proactive message stream (§4.2), not stored for retrieval. The system is *worn*, not *visited* (litmus test #8). Long-term sustainability and pleasantness are requirements, not niceties.

### C.3 Time blindness: the future is not motivationally real

ADHD involves steep **delay discounting** — future rewards and consequences lose motivational force abnormally fast — and genuinely impaired time perception ("temporal myopia"). Deadlines acquire force only when near, which produces the familiar panic-deadline work pattern, and abstract futures ("next week") exert almost no pull.

**Design rules:** The system **externalizes time**: it converts abstract deadlines into concrete, near-term, perceivable moments ("Thursday morning after drop-off is your open window") — exactly the move in the canonical capture exchange (§4.1). At capture, vague timeframes ("in the next week") are immediately translated into specific anchored slots. Calendar awareness (read-only in v1, §5) exists to make the day's actual shape visible to the system so it can make time visible to the user.

### C.4 Prospective memory: event cues beat clock cues

"Remembering to remember" (prospective memory) is a distinct, studied capacity, and the applied finding is unambiguous: **event-based cues substantially outperform time-based cues.** "At 2:30pm" fails; "after you drop the kids off" works, because the routine event itself carries the reminder. (Precision note, verified July 2026: in ADHD, event-based cues are *relatively spared, not intact* — they reduce the prospective-memory deficit, they do not eliminate it. The design still stands; the expectation should not be perfection.) Gollwitzer's research on **implementation intentions** ("when X happens, I'll do Y") shows a medium-to-large, well-replicated effect on follow-through (meta-analytic d≈0.65, Gollwitzer & Sheeran 2006) from delegating initiation to the environment rather than willpower.

**Design rules:** The system learns the user's routine anchor events (drop-off, lunch, commute, medication time) as part of its transparent memory (§3.6) and attaches tasks to *events*, not clock times. Clock-time alarms are reserved for the user-designated non-negotiables — which is precisely the one pattern already proven to work for the founder (§2, medication/trash alarms). Every scheduling proposal is an implementation intention phrased as "after/when [event], [action]."

### C.5 Motivation is interest-based, not importance-based

The ADHD nervous system is activated by **interest, novelty, challenge, and urgency** — not by importance or delayed reward (Dodson's formulation). "Other things seem/are more urgent" (§2) is this mechanism operating, not a discipline failure. (Status note, verified July 2026: Dodson's "interest-based nervous system" is a clinician's framework from decades of practice, not validated neuroscience — no controlled study establishes it as a measurable construct. Its components have independent support in the ADHD reward/motivation literature, and the mechanistic bridge is the Expected Value of Control framework in C.8. Treat it as a useful clinical heuristic, not established science.)

**Design rules:** The system never argues importance at the user ("this really matters!") — it instead lowers activation cost: a smaller first step, a pre-decided slot, everything staged so starting is cheap. Where honest, it surfaces *legitimate* nearness ("the lab closes at noon on Saturdays"). Novelty is treated as an asset: varied, genuinely interesting observations in the message stream sustain engagement where streaks and badges (banned, §3.7) would not. This is also why the Google Health pattern works (§2): the messages are interesting, not important.

### C.6 Shame is functionally impairing, not just unpleasant

Emotional self-regulation is itself a component of executive function (Barkley), and stress measurably degrades prefrontal performance — the stressed brain shifts toward avoidance and habit, away from planning and initiation (Arnsten's work concerns stress and uncontrollability; shame-as-stressor is a reasonable inference from it, not its direct finding). The "wall of awful" model (Brendan Mahan) describes how each failure experience associated with a task adds an emotional brick, until the task becomes unstartable not because it is difficult but because *approaching it hurts*. (Status note, verified July 2026: the wall of awful is a coaching metaphor with no direct empirical validation — but it is consistent with the confirmed, peer-reviewed emotional-dysregulation and stress-degrades-PFC literature, and the design implication does not depend on the metaphor: the longer a failure-associated task sits unacknowledged, the more it costs to approach.)

**Design rules:** The never-shame principle (§3.1) is therefore not a tone preference — **a system that induces shame actively destroys the capacity it exists to support.** Overdue badges add a brick every day they are visible (hence their absolute ban). Gentle renegotiation (§3.5) has a clinical mechanism: it dismantles the wall of awful brick by brick by converting a shame object back into a decision ("still important? wrong shape? release it?"), and release (§3.4) removes the wall entirely.

### C.7 The autistic profile: inertia, monotropism, transitions

Autistic executive function tilts differently: **autistic inertia** (high cost to start *and* to stop — hyperfocus is its flip side), **monotropism** (attention as one deep channel rather than many shallow ones), and **high transition costs**. Predictability is regulating; surprise is dysregulating. Advance warning before a transition helps enormously; an abrupt moment-of interruption is hostile. This is the mechanism behind the documented user backlash against Motion's aggressive silent rescheduling (Appendix B.3).

**Design rules:** The system provides **transition runway** — advance notice before hard commitments ("in 15 minutes you'll need to leave for pickup") rather than moment-of alarms (§4.2). It protects apparent deep-focus states rather than interrupting them for lower-value pings. All replanning is *proposed conversationally*, never silently imposed (reinforcing §4.4 and B.3's Motion lesson).

### C.8 The control-loop model: what an intact executive actually runs (revised July 2026)

A deeper mechanistic review (July 2026) superseded this section's original "five jobs" summary. The key finding: a well-functioning executive is not a *store of intentions* — it is a set of **control loops running continuously**, each sensing something, comparing it to a goal, and biasing action. A todo list is "leg-shaped" because it replicates the visible artifact (a list of known intentions) while replicating none of this machinery. The central organizing result is Braver's proactive-vs-reactive control distinction: an intact executive holds goals "warm" *before* the moment of action (proactive); ADHD is a measurable shift toward reactive control — retrieving the goal only after something has already gone wrong.

The nine loops, with what each does intact, how ADHD/autism alters it, and the prosthesis's job:

| Loop | Intact function | Altered | Prosthesis job |
|------|----------------|---------|----------------|
| **A. Goal maintenance** | Holds the active goal warm before the action moment (proactive control; Braver) | Unreliable sustained holding; falls back to reactive scramble | Re-present the goal *ahead of* its moment, not on demand |
| **B. Context monitoring** | Scans for goal-relevant trigger conditions | Behavior captured by whatever's loudest | Watch context (time, calendar, stated whereabouts) for triggers the user's scanning misses |
| **C. Real-time arbitration** | Picks ONE action and suppresses competitors (contention scheduling) | Loudest/newest/most-rewarding wins regardless of priority | Deliver a verdict — "this one, now" — as an offer, never a menu |
| **D. Prospective triggering** | Stored intention fires at its trigger | Self-cueing unreliable, esp. clock-based | Fire event-anchored reminders (the best-understood loop; see C.4) |
| **E. Initiation** | Effort calculus (Expected Value of Control; Shenhav) concludes "start" | Dopamine differences inflate felt cost of starting; calculus keeps returning "not now" — frozen while fully aware | Shrink the first step until the calculus flips; stay present through the first minutes; pre-do part of the work (open the doc, draft the first line) |
| **F. Planning/decomposition** | Abstract goals concretized down a cortical hierarchy (Koechlin, Badre) | Intentions stay unassembled boulders; boulders aren't startable | Breakdown conversations (§4.3) — a genuine substitution for a localizable cortical function |
| **G. Error detection/replanning** | ACC monitor fires "something's off" when plan and reality diverge; plan gets revised | Signal measurably blunted; plans silently die and rot into shame objects | Watch plan-vs-reality; open renegotiation *same-day* (§3.5 fast lane), while it's still cheap |
| **H. Effort budgeting** | Tracks own fatigue; rations hard things to high-capacity windows | Poor self-sensing; boom-bust | Model capacity (asking is fine); on low days, triage and permission (deferred, §7 — a real loop, deferred by scope choice) |
| **I. Affect regulation** | Regulates the dread/overwhelm that gates action; emotional self-regulation is itself EF (Barkley) | Hot-EF deficits dominate; dread makes tasks unstartable because approaching hurts (C.6) | Never add to the dread (§3.1 is this loop's protective half); actively reduce it — reframe, shrink, celebrate release |

**Cool vs. hot — the strategic crux.** Loops A(storage), D, and F are "cool": they run on information, and this population can often do them effortfully *when calm* (the brain-dump-into-a-new-system pattern of §2 is exactly this). Loops C, E, G, H, I are "hot": they run on motivation and emotion at the moment of action, and **ADHD's impairment is disproportionately hot.** The v1 feature set (§6) is built almost entirely of cool loops — it is the attachment socket and the trust substrate (capture proves the system can be load-bearing, per 3.9; the stream proves the intervention channel; breakdown proves delegated agency), not the finished prosthesis. The destination named by principle 3.3 is running the hot loops; §6's thin closed loop (one proposed action → start? → outcome tap) is their first, thinnest implementation. The hot loops do **not** require continuous surveillance: event-driven sensing plus one-tap self-report at transition points runs bounded versions of all five (which is why the no-ambient-audio line in 3.7 costs nothing functionally). The epistemic boundary to preserve: "I haven't heard back — did the plan change?" is legitimate; "you appear to be avoiding this" is not.

Any proposed feature that does not serve one of these loops — or that undermines one (anything shame-inducing undermines all of them via C.6) — should be questioned.

*A note on sources: the frameworks above (Miyake & Friedman's EF model; Barkley's point-of-performance and prosthetic-environment work; delay discounting and temporal myopia research; prospective memory and Gollwitzer's implementation intentions; Dodson's interest-based nervous system; Mahan's wall of awful; monotropism theory from Murray, Lesser & Lawson) are widely cited in the clinical and community literature — with evidentiary status now flagged inline where it matters (verified July 2026): Dodson and Mahan are clinician/community frameworks, not validated science; Barkley's prosthetic-environment prescription is his evidence-informed theory, not a head-to-head experimental result. The C.8 control-loop model additionally draws on Braver's dual mechanisms of control (proactive/reactive), Shenhav, Botvinick & Cohen's Expected Value of Control, Duncan's goal neglect, Norman & Shallice's supervisory attentional system, Koechlin's and Badre's prefrontal hierarchy work, Risko & Gilbert's cognitive-offloading research, Clark & Chalmers' extended-mind trust conditions, and Phillips & Zhao's assistive-technology abandonment findings — all peer-reviewed. This appendix remains a design-oriented distillation, not a literature review. The builder should treat the design rules as the product's commitments and the citations as pointers for deeper reading.*

