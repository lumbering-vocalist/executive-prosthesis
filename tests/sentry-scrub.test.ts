import { expect, test } from "vitest";
import {
  redactExceptionValue,
  scrubEvent,
  SENSITIVE_KEYS,
  SCRUB_MAX_DEPTH,
} from "../lib/sentry-scrub";

test("request bodies, cookies, headers, and query strings never ship", () => {
  const event = scrubEvent({
    request: {
      data: { text: "took the kids to the lab before noon" },
      cookies: { session: "abc" },
      headers: { authorization: "Bearer x" },
      url: "https://app.example/search?q=blood%20test%20errand",
      query_string: "q=blood%20test%20errand",
    },
  });
  expect(event.request?.data).toBeUndefined();
  expect(event.request?.cookies).toBeUndefined();
  expect(event.request?.headers).toBeUndefined();
  expect(event.request?.query_string).toBeUndefined();
  expect(event.request?.url).toBe("https://app.example/search");
});

test("free-text channels are redacted: message, breadcrumb messages, tags", () => {
  const event = scrubEvent({
    message: "user said: pick up the meds",
    tags: { transcript: "secret", route: "/held" },
    breadcrumbs: [{ message: "console.log of a capture" }],
  });
  expect(event.message).toBe("[scrubbed]");
  expect(event.breadcrumbs![0].message).toBe("[scrubbed]");
  expect(event.tags).toEqual({ transcript: "[scrubbed]", route: "/held" });
});

test("URL query strings are stripped everywhere: breadcrumbs, spans, request", () => {
  const event = scrubEvent({
    request: { url: "https://x.test/api?q=meds" },
    breadcrumbs: [
      { data: { url: "https://x.test/search?q=blood%20test", method: "GET" } },
    ],
    spans: [
      {
        description: "GET https://x.test/api/captures?text=secret",
        data: { "http.url": "https://x.test/api/captures?text=secret" },
      },
    ],
  });
  const flat = JSON.stringify(event);
  expect(flat).not.toContain("?q=");
  expect(flat).not.toContain("?text=");
  expect(event.breadcrumbs![0].data!.url).toBe("https://x.test/search");
  expect(event.spans![0].description).toBe("GET https://x.test/api/captures");
  expect(event.spans![0].data!["http.url"]).toBe("https://x.test/api/captures");
});

test("console breadcrumb arguments are redacted (raw console text channel)", () => {
  const event = scrubEvent({
    breadcrumbs: [
      { data: { arguments: ["took the kids to the lab"], logger: "console" } },
    ],
  });
  expect(event.breadcrumbs![0].data!.arguments).toBe("[scrubbed]");
  expect(event.breadcrumbs![0].data!.logger).toBe("console");
});

test("URL fragments and userinfo are stripped along with queries", () => {
  const event = scrubEvent({
    request: { url: "https://user:secret@x.test/capture#medication" },
    breadcrumbs: [{ data: { to: "/notes#the-hard-thing" } }],
  });
  expect(event.request?.url).toBe("https://x.test/capture");
  expect(event.breadcrumbs![0].data!.to).toBe("/notes");
});

test("sensitive-key matching catches naming variants but not lookalikes", () => {
  const event = scrubEvent({
    extra: {
      capture_text: "a",
      transcriptChunks: ["b"],
      bodyHtml: "c",
      noteText: "d",
      context: "kept", // "context" must not match the "text" stem
      route: "kept",
    },
  });
  expect(event.extra).toEqual({
    capture_text: "[scrubbed]",
    transcriptChunks: "[scrubbed]",
    bodyHtml: "[scrubbed]",
    noteText: "[scrubbed]",
    context: "kept",
    route: "kept",
  });
});

test("exception values are length-capped as the backstop", () => {
  const long = "x".repeat(1000);
  const event = scrubEvent({
    exception: { values: [{ type: "SyntaxError", value: long }] },
  });
  expect(event.exception!.values![0].value!.length).toBeLessThanOrEqual(301);
});

test("unquoted exception prose is kept (code-authored diagnostics, §13 policy)", () => {
  // The standing rule: never interpolate capture content into thrown errors.
  // The scrub targets the channels that echo data; plain prose survives.
  const event = scrubEvent({
    exception: { values: [{ type: "Error", value: "IndexedDB open failed" }] },
  });
  expect(event.exception.values[0].value).toBe("IndexedDB open failed");
});

test("JSON.parse SyntaxError input echoes are redacted (V8 quotes the payload)", () => {
  const payload = "took the kids to the lab before noon";
  let thrown = "";
  try {
    JSON.parse(payload);
  } catch (error) {
    thrown = (error as Error).message;
  }
  // Real V8 message, e.g.: Unexpected token 't', "took the ki"... is not valid JSON
  const event = scrubEvent({
    exception: { values: [{ type: "SyntaxError", value: thrown }] },
  });
  const value = event.exception!.values![0].value!;
  expect(value).not.toContain("took the");
  expect(value).toContain("is not valid JSON");
});

test("Convex validator echoes are redacted: quoted values, Value: tails, object literals", () => {
  const cases = [
    `ArgumentValidationError: Value does not match validator. Path: .text Value: "pick up the meds"`,
    `ArgumentValidationError: Value does not match validator. Path: .args Value: {text: "pick up the meds", when: "noon"}`,
    "Unexpected value `pick up the meds` for field",
    "bad input: 'pick up the meds' is not a capture",
  ];
  for (const raw of cases) {
    const event = scrubEvent({
      exception: { values: [{ type: "Error", value: raw }] },
    });
    expect(event.exception!.values![0].value, raw).not.toContain(
      "pick up the meds",
    );
  }
});

test("redactExceptionValue keeps surrounding prose and redacts every quote style", () => {
  expect(redactExceptionValue(`before "secret" after`)).toBe(
    "before [scrubbed] after",
  );
  expect(redactExceptionValue("before 'secret' after")).toBe(
    "before [scrubbed] after",
  );
  expect(redactExceptionValue("before `secret` after")).toBe(
    "before [scrubbed] after",
  );
  expect(redactExceptionValue(`escaped "a \\" b" tail`)).toBe(
    "escaped [scrubbed] tail",
  );
});

test("an apostrophe inside echoed content cannot close the quoted span early", () => {
  // Quote-PAIRING per style leaked here: 'don' would match as the span and
  // ship the rest. The greedy first-to-last rule must take the whole thing.
  const out = redactExceptionValue(
    "bad input: 'don't forget the neurologist appointment at 4pm' is not a capture",
  );
  expect(out).not.toContain("forget the neurologist");
  expect(out).not.toContain("4pm");
  const mixed = redactExceptionValue(
    `Unexpected token 's', "say "meet the neurologist" at three"... is not valid JSON`,
  );
  expect(mixed).not.toContain("neurologist");
});

test("an unterminated quote redacts to end-of-string (truncated echoes)", () => {
  const out = redactExceptionValue(
    "Unexpected string: 'my secret capture text that got truncat",
  );
  expect(out).not.toContain("secret capture");
  expect(out).toContain("Unexpected string: ");
});

test("an unclosed object literal redacts to end-of-string", () => {
  const out = redactExceptionValue(
    "bad input {name: pick up the meds at the pharmacy",
  );
  expect(out).not.toContain("pick up the meds");
  expect(out).toContain("bad input ");
});

test("the Value: marker is matched case-insensitively", () => {
  const out = redactExceptionValue("invalid value: pick up the meds at noon");
  expect(out).not.toContain("pick up the meds");
});

test("oversized exception values are redacted wholesale before pattern work", () => {
  // beforeSend is synchronous; giant echoes get no regex time at all.
  const out = redactExceptionValue("Error: " + `\\"`.repeat(100_000));
  expect(out).toBe("[scrubbed]");
});

test("unquoted URLs lose their query strings in exception values", () => {
  const out = redactExceptionValue(
    "TypeError: Failed to parse URL from /api/capture?text=pick%20up%20the%20meds",
  );
  expect(out).not.toContain("pick%20up");
  expect(out).toContain("/api/capture");
});

test("bare email addresses are redacted (Convex Auth interpolates one)", () => {
  // createAccountFromCredentials throws `Account ${id} already exists` with
  // the account id — the founder's email — unquoted.
  const out = redactExceptionValue(
    "Account founder@example.com already exists",
  );
  expect(out).not.toContain("founder@example.com");
  expect(out).toContain("already exists");
});

test("truncation cuts on a code-point boundary, never a lone surrogate", () => {
  const out = redactExceptionValue("🙂".repeat(400));
  // A naive slice(0, 300) would split the 300th unit mid-pair.
  expect(out).not.toMatch(/[\uD800-\uDBFF]$/);
  expect(Array.from(out).length).toBeLessThanOrEqual(301);
});

test("thread stacktrace frame locals never ship either", () => {
  const event = scrubEvent({
    threads: {
      values: [
        {
          stacktrace: {
            frames: [{ filename: "worker.ts", vars: { note: "pick up the meds" } }],
          },
        },
      ],
    },
  });
  expect(JSON.stringify(event)).not.toContain("pick up the meds");
});

test("stacktrace frame locals never ship", () => {
  // includeLocalVariables/ANR captures attach whole program state as
  // frame.vars — the one frame field that can carry capture text.
  const event = scrubEvent({
    exception: {
      values: [
        {
          type: "Error",
          value: "boom",
          stacktrace: {
            frames: [
              {
                filename: "app/page.tsx",
                vars: { captureText: "pick up the meds" },
              },
            ],
          },
        },
      ],
    },
  });
  expect(JSON.stringify(event)).not.toContain("pick up the meds");
  expect(
    event.exception!.values![0].stacktrace!.frames![0].filename,
  ).toBe("app/page.tsx");
});

test("the parameterized message channel (logentry) is dropped entirely", () => {
  // captureMessage("saw %s", captureText) lands in logentry, not message —
  // redacting only `message` would leave the params shipping.
  const event = scrubEvent({
    message: "saw %s",
    logentry: { message: "saw %s", params: ["pick up the meds"] },
  } as { message?: string } & Record<string, unknown>);
  expect((event as Record<string, unknown>).logentry).toBeUndefined();
  expect("logentry" in event).toBe(false);
  expect(JSON.stringify(event)).not.toContain("pick up the meds");
});

test("request.env is dropped along with bodies and headers", () => {
  const event = scrubEvent({
    request: {
      url: "https://x.test/held",
      env: { REMOTE_ADDR: "1.2.3.4", SERVER_NAME: "host" },
    } as Record<string, unknown>,
  });
  expect((event.request as Record<string, unknown>).env).toBeUndefined();
  expect(JSON.stringify(event)).not.toContain("1.2.3.4");
});

test("the exception length cap is inclusive and only truncates past it", () => {
  const at = "x".repeat(300);
  expect(redactExceptionValue(at)).toBe(at);
  const over = redactExceptionValue("x".repeat(301));
  expect(over.length).toBe(301);
  expect(over.endsWith("…")).toBe(true);
});

test("empty, missing, and null exception channels pass through untouched", () => {
  const event = scrubEvent({
    exception: { values: [{ type: "Error", value: "" }, { type: "Error" }] },
  });
  expect(event.exception!.values![0].value).toBe("");
  expect(event.exception!.values![1].value).toBeUndefined();
  expect(scrubEvent({ exception: null }).exception).toBeNull();
  expect(scrubEvent({ exception: { values: [] } }).exception).toEqual({
    values: [],
  });
});

test("the `value` key is redacted under every wrapper shape (review's fail-open)", () => {
  // The named example the deny-list used to miss: validator payloads land
  // under value/values, at any nesting, inside arrays too.
  const event = scrubEvent({
    extra: {
      value: "pick up the meds",
      values: ["pick up the meds"],
      nested: { fieldValue: "kept — not a prefix match", value: "secret" },
    },
    contexts: { validator: { value: "pick up the meds" } },
  });
  const flat = JSON.stringify(event);
  expect(flat).not.toContain("pick up the meds");
  expect(flat).not.toContain("secret");
  const nested = (event.extra as Record<string, unknown>).nested as Record<
    string,
    unknown
  >;
  expect(nested.fieldValue).toBe("kept — not a prefix match");
});

test("spans without a description or data survive scrubbing", () => {
  const event = scrubEvent({
    spans: [{}, { description: "GET /held" }, { data: {} }],
  });
  expect(event.spans![0]).toEqual({});
  expect(event.spans![1].description).toBe("GET /held");
  expect(event.spans![2].data).toEqual({});
});

test("every sensitive key is redacted at any nesting depth", () => {
  for (const key of SENSITIVE_KEYS) {
    const event = scrubEvent({
      extra: { outer: { [key]: "user words", safe: 42 } },
    });
    const outer = (event.extra as Record<string, Record<string, unknown>>)
      .outer;
    expect(outer[key], key).toBe("[scrubbed]");
    expect(outer.safe).toBe(42);
  }
});

test("key matching is case-insensitive", () => {
  const event = scrubEvent({ extra: { Transcript: "hello", CONTENT: "hi" } });
  expect(event.extra).toEqual({
    Transcript: "[scrubbed]",
    CONTENT: "[scrubbed]",
  });
});

test("breadcrumb data is scrubbed, arrays traversed", () => {
  const event = scrubEvent({
    breadcrumbs: [
      { data: { items: [{ transcript: "secret" }], route: "/held" } },
    ],
  });
  const data = event.breadcrumbs![0].data as {
    items: { transcript: string }[];
    route: string;
  };
  expect(data.items[0].transcript).toBe("[scrubbed]");
  expect(data.route).toBe("/held");
});

test("user is reduced to an opaque id", () => {
  const event = scrubEvent({
    user: { id: "u1", email: "founder@example.com", ip_address: "1.2.3.4" },
  });
  expect(event.user).toEqual({ id: "u1" });
});

test("depth cap terminates circular structures without throwing", () => {
  const loop: Record<string, unknown> = { transcript: "secret" };
  loop.self = loop;
  const event = scrubEvent({ extra: { loop } });
  // The depth cap is the only guard against infinite recursion here.
  const scrubbed = (event.extra as Record<string, Record<string, unknown>>)
    .loop;
  expect(scrubbed.transcript).toBe("[scrubbed]");
});

test("sensitive keys are still scrubbed at the depth-cap boundary", () => {
  // Build a chain deep enough that the innermost object's keys sit exactly
  // at the last depth scrubValue still visits.
  let inner: Record<string, unknown> = { transcript: "deep secret" };
  for (let i = 0; i < SCRUB_MAX_DEPTH - 1; i++) inner = { down: inner };
  const event = scrubEvent({ extra: inner });
  let cursor = event.extra as Record<string, unknown>;
  while (cursor.down) cursor = cursor.down as Record<string, unknown>;
  expect(cursor.transcript).toBe("[scrubbed]");
});

test("content beyond the depth cap fails closed — redacted, never passed through", () => {
  let inner: Record<string, unknown> = { transcript: "deep secret" };
  for (let i = 0; i < SCRUB_MAX_DEPTH + 2; i++) inner = { down: inner };
  const event = scrubEvent({ extra: inner });
  expect(JSON.stringify(event)).not.toContain("deep secret");
});

test("empty and null-field events pass through without throwing", () => {
  expect(scrubEvent({})).toEqual({});
  const event = scrubEvent({
    request: null,
    extra: null,
    contexts: null,
    breadcrumbs: null,
    user: null,
  });
  expect(event.request).toBeNull();
  expect(event.extra).toBeNull();
  expect(event.user).toBeNull();
});

test("user without an id still loses every other field", () => {
  const event = scrubEvent({
    user: { email: "founder@example.com", username: "hp" },
  });
  expect(Object.keys(event.user as object)).toEqual(["id"]);
  expect((event.user as { id?: unknown }).id).toBeUndefined();
});

test("breadcrumbs without data and null/primitive extras survive", () => {
  const event = scrubEvent({
    breadcrumbs: [{ data: { from: "/", to: "/held" } }],
    extra: { count: 1, ok: true, nothing: null },
  });
  expect(event.breadcrumbs![0].data).toEqual({ from: "/", to: "/held" });
  expect(event.extra).toEqual({ count: 1, ok: true, nothing: null });
});

test("no capture-shaped string survives anywhere in a scrubbed event", () => {
  const captureText = "the blood test errand from the brain dump";
  const event = scrubEvent({
    message: captureText,
    request: { data: captureText, url: `https://x.test/?q=${captureText}` },
    extra: { transcript: captureText, nested: { content: captureText } },
    contexts: { capture: { text: captureText } },
    tags: { title: captureText },
    breadcrumbs: [
      { message: captureText, data: { body: captureText } },
      { data: { arguments: [captureText], logger: "console" } },
    ],
    user: { id: "u1", note: captureText },
  });
  expect(JSON.stringify(event)).not.toContain(captureText);
});
