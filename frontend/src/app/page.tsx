"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import PageLoader from "@/components/PageLoader";

const FEATURES = [
  "Upload a photo or PDF, get structured fields back",
  "Math is checked automatically — only real problems reach you",
  "Approved invoices export to CSV in one click",
];

function Spinner() {
  return (
    <svg className="spinner" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function Alert({ kind, children }: { kind: "error" | "success"; children: React.ReactNode }) {
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

export default function Login() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    supabase()
      .auth.getSession()
      .then(({ data }) => {
        if (data.session) router.replace("/dashboard");
        else setCheckingSession(false);
      });
  }, [router]);

  function switchMode() {
    setMode(mode === "signin" ? "signup" : "signin");
    setError(null);
    setInfo(null);
    setPassword("");
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    setInfo(null);
    const auth = supabase().auth;
    if (mode === "signin") {
      const { error } = await auth.signInWithPassword({ email, password });
      if (error) setError(error.message);
      else router.replace("/dashboard");
    } else {
      const { data, error } = await auth.signUp({
        email,
        password,
        options: { data: { full_name: name.trim() } },
      });
      if (error) {
        setError(error.message);
      } else if (data.session) {
        router.replace("/dashboard");
      } else {
        setInfo(`We've sent a confirmation link to ${email}. Open it to activate your account, then sign in here.`);
      }
    }
    setBusy(false);
  }

  if (checkingSession) return <PageLoader label="Loading InvoiceFlow…" fullScreen />;

  return (
    <main className="auth-page">
      <section className="auth-brand" aria-hidden="true">
        <div className="auth-brand-glow" />
        <div className="auth-brand-top">
          <span className="auth-logo">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M6 3h9l5 5v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" stroke="white" strokeWidth="1.6" />
              <path d="M9 12.5h6M9 16h4" stroke="white" strokeWidth="1.6" strokeLinecap="round" />
              <circle cx="16.5" cy="9" r="3.2" fill="#2f5bea" stroke="white" strokeWidth="1.4" />
              <path d="M15.2 9.1l.9.9 1.7-1.8" stroke="white" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <span className="auth-wordmark">InvoiceFlow</span>
        </div>

        <div className="auth-brand-copy">
          <h1>Stop retyping invoices by hand.</h1>
          <p>Upload a batch, review only what doesn&apos;t add up, and export the rest.</p>
        </div>

        <div className="auth-mock" role="presentation">
          <div className="auth-mock-row">
            <span className="auth-mock-dot" />
            <span className="auth-mock-dot" />
            <span className="auth-mock-dot" />
          </div>
          <div className="auth-mock-body">
            <div className="auth-mock-field">
              <span>Vendor</span>
              <strong>Al-Rehman Traders</strong>
            </div>
            <div className="auth-mock-field">
              <span>Total</span>
              <strong>PKR 42,500.00</strong>
            </div>
            <div className="auth-mock-field is-flagged">
              <span>Tax</span>
              <strong>PKR 3,825.00</strong>
              <em>doesn&apos;t match subtotal + tax</em>
            </div>
            <div className="auth-mock-approve">Needs your review</div>
          </div>
        </div>

        <ul className="auth-features">
          {FEATURES.map((f) => (
            <li key={f}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M3 8.5l3 3 7-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {f}
            </li>
          ))}
        </ul>
      </section>

      <section className="auth-form-side">
        <div className="auth-form-wrap">
          <div className="auth-form-head">
            <h2>{mode === "signin" ? "Welcome back" : "Create your account"}</h2>
            <p className="muted">
              {mode === "signin" ? "Sign in to see your invoices." : "It takes less than a minute."}
            </p>
          </div>

          <form onSubmit={submit} noValidate>
            {mode === "signup" && (
              <>
                <label htmlFor="name">Full name</label>
                <input
                  id="name"
                  type="text"
                  autoComplete="name"
                  required
                  disabled={busy}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ambreen Habib"
                />
                <div style={{ height: 14 }} />
              </>
            )}

            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              disabled={busy}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
            />

            <div style={{ height: 14 }} />

            <label htmlFor="pw">Password</label>
            <div className="auth-pw-field">
              <input
                id="pw"
                type={showPw ? "text" : "password"}
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                required
                minLength={8}
                disabled={busy}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
              />
              <button
                type="button"
                className="auth-pw-toggle"
                onClick={() => setShowPw((v) => !v)}
                aria-label={showPw ? "Hide password" : "Show password"}
                tabIndex={-1}
              >
                {showPw ? "Hide" : "Show"}
              </button>
            </div>

            <div className="auth-alerts">
              {error && <Alert kind="error">{error}</Alert>}
              {info && <Alert kind="success">{info}</Alert>}
            </div>

            <button className="primary auth-submit" disabled={busy}>
              {busy && <Spinner />}
              {busy ? (mode === "signin" ? "Signing in…" : "Creating account…") : mode === "signin" ? "Sign in" : "Create account"}
            </button>
          </form>

          <p className="auth-switch">
            {mode === "signin" ? "New to InvoiceFlow?" : "Already have an account?"}{" "}
            <button type="button" className="auth-switch-link" onClick={switchMode} disabled={busy}>
              {mode === "signin" ? "Create an account" : "Sign in"}
            </button>
          </p>
        </div>
      </section>
    </main>
  );
}
