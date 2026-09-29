"use client";

/** Shared success/error banner for the auth pages (sign in/up, forgot password, reset password). */
export default function Alert({ kind, children }: { kind: "error" | "success"; children: React.ReactNode }) {
  return (
    <div className={`alert alert-${kind}`} role={kind === "error" ? "alert" : "status"}>
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        {kind === "success" ? (
          <path d="M4 10.5l4 4 8-9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        ) : (
          <>
            <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.6" />
            <path d="M10 6.5v4.2M10 13.4h.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </>
        )}
      </svg>
      <span>{children}</span>
    </div>
  );
}
