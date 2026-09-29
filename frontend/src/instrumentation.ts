// Next.js calls register() once on server startup, before any request is handled. This is
// where the Node vs. Edge runtime configs get loaded — see
// https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export async function onRequestError(
  ...args: Parameters<typeof import("@sentry/nextjs").captureRequestError>
) {
  // No-op when NEXT_PUBLIC_SENTRY_DSN is unset: sentry.server/edge.config.ts above never called
  // Sentry.init(), so captureRequestError has nothing configured to send to.
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return;
  const { captureRequestError } = await import("@sentry/nextjs");
  captureRequestError(...args);
}
