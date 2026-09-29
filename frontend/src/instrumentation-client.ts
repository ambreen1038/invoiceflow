// Runs in the browser, before the app renders. Next.js picks this file up automatically by
// name — see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation.
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

// Leaving NEXT_PUBLIC_SENTRY_DSN blank is a true no-op: Sentry.init() is simply never called,
// so nothing is loaded or sent, and no Sentry account is required to run the app locally.
if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
    // Error reporting is always on above; this is the separate performance-tracing sample
    // rate, kept at 0 since this app has no need for it and Sentry's free tier meters traces
    // and errors against different, much smaller monthly quotas for traces.
    tracesSampleRate: 0,
  });
}

export const onRouterTransitionStart = dsn ? Sentry.captureRouterTransitionStart : undefined;
