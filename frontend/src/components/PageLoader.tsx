"use client";

import { Spinner } from "@/components/icons";

/** Centered loading state for a full page (or a full section of one) — used whenever there's
 * nothing else worth showing yet, instead of a bare "Loading…" line or a blank screen. */
export default function PageLoader({
  label = "Loading…",
  fullScreen = false,
}: {
  label?: string;
  fullScreen?: boolean;
}) {
  return (
    <div className={`page-loader${fullScreen ? " page-loader-full" : ""}`} role="status" aria-live="polite">
      <Spinner size={26} />
      <span>{label}</span>
    </div>
  );
}
