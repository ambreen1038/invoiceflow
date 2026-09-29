// Edge runtime (middleware, edge route handlers) — this app doesn't currently use either, but
// Next.js still calls register() for the edge runtime, so this covers it if that changes.
// Imported from instrumentation.ts — see that file for why.
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
    tracesSampleRate: 0,
  });
}
