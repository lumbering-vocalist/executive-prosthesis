import { scrubEvent } from "./sentry-scrub";

/*
 * Shared Sentry init options for all three runtimes (client/server/edge).
 * The scrubber is wired here, once — a runtime config that spreads this
 * object cannot forget it. Init is a no-op without a DSN (local dev, CI).
 */
export const sentryBaseOptions = {
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  sendDefaultPii: false,
  beforeSend: scrubEvent,
  beforeSendTransaction: scrubEvent,
};
