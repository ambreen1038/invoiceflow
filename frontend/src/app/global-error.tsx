"use client";

// Next.js renders this in place of the root layout when an error escapes every other error
// boundary — so it must render its own <html>/<body>, and it's the one place a truly unhandled
// client-side render error can still be reported before the page goes blank.
import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <main style={{ maxWidth: 480, margin: "20vh auto", textAlign: "center", padding: 24 }}>
          <h1 style={{ fontSize: 20, marginBottom: 8 }}>Something went wrong</h1>
          <p style={{ color: "#6b7280", marginBottom: 20 }}>
            This has been reported. Try again, or reload the page.
          </p>
          <button onClick={reset} className="primary">
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
