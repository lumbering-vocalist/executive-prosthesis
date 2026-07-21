/*
 * Sentry privacy gate (engineering-plan.md §2, §13): no capture text or
 * transcript content may reach Sentry. This scrubber is the T1 boundary —
 * every later step that adds a content-bearing field name MUST add it to
 * SENSITIVE_KEYS, and the §13 per-step privacy tests assert against this
 * module, not against Sentry config prose.
 *
 * Strategy, fail-closed by channel:
 *  - Key-named payloads (extra, contexts, tags, breadcrumb data): deny-list
 *    by key name, recursively. Past SCRUB_MAX_DEPTH the subtree is REDACTED
 *    wholesale — never passed through unexamined.
 *  - Free-text channels that can't be key-matched: event.message and
 *    breadcrumb messages (console logs land here) are redacted outright;
 *    request bodies/cookies/headers/query strings are dropped — the capture
 *    endpoint's payload IS user content.
 *  - exception.values[].value is the one free-text channel kept: error
 *    messages are Sentry's core diagnostic and are code-authored. The
 *    standing rule is never to interpolate capture content into thrown
 *    errors; revisit with a content-tagging redactor at T4 when capture
 *    text first exists in the app.
 */

export const SENSITIVE_KEYS = [
  "captureText",
  "transcript",
  "transcription",
  "content",
  "body",
  "text",
  "audio",
  "rawText",
  "title",
  "note",
  "summary",
  "caption",
  "memo",
  "input",
  "prompt",
  // Sentry's console integration stores raw console args here — the channel
  // a stray console.log(captureText) would ride.
  "arguments",
] as const;

export const SCRUB_MAX_DEPTH = 10;

// Stems are matched by prefix on a normalized key (lowercased, separators
// stripped), so capture_text, captureTexts, transcriptChunks, bodyHtml all
// match. Prefix (not substring) so e.g. "context" never matches the "text"
// stem. Over-matching redacts diagnostics; under-matching leaks content —
// fail closed.
const SENSITIVE_STEMS = SENSITIVE_KEYS.map((k) =>
  k.toLowerCase().replace(/[^a-z0-9]/g, ""),
);

function isSensitiveKey(key: string): boolean {
  const norm = key.toLowerCase().replace(/[^a-z0-9]/g, "");
  return SENSITIVE_STEMS.some((stem) => norm.startsWith(stem));
}

const REDACTED = "[scrubbed]";

// Keys whose string values are URLs (breadcrumb data.url, span http.url,
// navigation from/to). Queries and fragments are user content and never ship.
function isUrlKey(key: string): boolean {
  const k = key.toLowerCase();
  return k.includes("url") || k === "href" || k === "from" || k === "to";
}

function stripQuery(url: string): string {
  const i = url.search(/[?#]/);
  const base = i === -1 ? url : url.slice(0, i);
  // Userinfo (user:pass@host) is a credential — never ships.
  return base.replace(/\/\/[^/@]*@/, "//");
}

// Exception values are kept (see header) but bounded: runtime errors like
// JSON.parse SyntaxError echo a snippet of their input, so a cap limits how
// much of any interpolated content could ride along. Full redaction lands
// pre-T3 (TODOS) before capture data first flows through parsers.
const EXCEPTION_VALUE_MAX = 300;

function scrubValue(value: unknown, depth = 0, key = ""): unknown {
  if (typeof value === "string" && isUrlKey(key)) return stripQuery(value);
  if (value === null || typeof value !== "object") return value;
  // Fail closed: a subtree too deep to examine is redacted, not passed on.
  if (depth > SCRUB_MAX_DEPTH) return REDACTED;
  if (Array.isArray(value)) {
    // Key context propagates so ["…?q=x"] under a url key is still stripped.
    return value.map((v) => scrubValue(v, depth + 1, key));
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = isSensitiveKey(k) ? REDACTED : scrubValue(v, depth + 1, k);
  }
  return out;
}

/**
 * `beforeSend` / `beforeSendTransaction` hook. Typed structurally (not against
 * Sentry's Event type) so it is unit-testable without the SDK and reusable
 * across client/server/edge configs.
 */
export function scrubEvent<
  E extends {
    message?: string;
    // Exception values are the one kept free-text channel (see header).
    exception?: { values?: { type?: string; value?: string }[] } | null;
    request?:
      | {
          data?: unknown;
          cookies?: unknown;
          headers?: unknown;
          url?: string;
          query_string?: unknown;
        }
      | null;
    extra?: Record<string, unknown> | null;
    contexts?: Record<string, unknown> | null;
    tags?: Record<string, unknown> | null;
    breadcrumbs?: { data?: Record<string, unknown>; message?: string }[] | null;
    spans?: { description?: string; data?: Record<string, unknown> }[] | null;
    user?: Record<string, unknown> | null;
  },
>(event: E): E {
  // captureMessage free text is unused by this codebase; anything arriving
  // here (e.g. via console capture) is redacted rather than trusted. The
  // parameterized variant lands in `logentry` — same policy.
  if (event.message !== undefined) event.message = REDACTED;
  delete (event as { logentry?: unknown }).logentry;
  if (event.exception?.values) {
    for (const ex of event.exception.values) {
      if (ex.value && ex.value.length > EXCEPTION_VALUE_MAX)
        ex.value = ex.value.slice(0, EXCEPTION_VALUE_MAX) + "…";
    }
  }
  if (event.request) {
    // Bodies, cookies, headers, and query strings never ship.
    delete event.request.data;
    delete event.request.cookies;
    delete event.request.headers;
    delete event.request.query_string;
    delete (event.request as { env?: unknown }).env;
    if (event.request.url) event.request.url = stripQuery(event.request.url);
  }
  if (event.spans) {
    // Transaction spans: descriptions carry request URLs; data carries
    // http.url/url.full and arbitrary attributes.
    for (const span of event.spans) {
      if (span.description) span.description = stripQuery(span.description);
      if (span.data)
        span.data = scrubValue(span.data) as Record<string, unknown>;
    }
  }
  if (event.extra) event.extra = scrubValue(event.extra) as E["extra"];
  if (event.contexts)
    event.contexts = scrubValue(event.contexts) as E["contexts"];
  if (event.tags) event.tags = scrubValue(event.tags) as E["tags"];
  if (event.breadcrumbs) {
    for (const crumb of event.breadcrumbs) {
      // Console/log breadcrumbs carry their text in `message` — always redact.
      if (crumb.message !== undefined) crumb.message = REDACTED;
      if (crumb.data)
        crumb.data = scrubValue(crumb.data) as Record<string, unknown>;
    }
  }
  if (event.user) {
    // Single-user product: an opaque id is plenty for correlation.
    event.user = { id: (event.user as { id?: unknown }).id } as E["user"];
  }
  return event;
}
