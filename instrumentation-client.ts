import * as Sentry from "@sentry/nextjs";
import { sentryBaseOptions } from "@/lib/sentry-options";

/*
 * Session replay stays out (§13: replays are screen recordings of user
 * content). Replay is opt-in in the Sentry SDK — it only exists if
 * replayIntegration() is added here, so the guarantee is "never add it";
 * next.config.ts additionally strips replay code from the bundle. Default
 * integrations (breadcrumbs, etc.) stay on — their free-text channels are
 * redacted in scrubEvent.
 */
Sentry.init(sentryBaseOptions);

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
