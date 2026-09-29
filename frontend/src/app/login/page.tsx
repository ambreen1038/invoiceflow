"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import PageLoader from "@/components/PageLoader";
import Alert from "@/components/AuthAlert";
import Logo from "@/components/Logo";
import { Spinner } from "@/components/icons";

const FEATURES = [
  "Upload a photo or PDF, get structured fields back",
  "Math is checked automatically — only real problems reach you",
  "Approved invoices export to CSV or Excel in one click",
];

type Mode = "signin" | "signup" | "forgot";

const HEADS: Record<Mode, { title: string; subtitle: string }> = {
  signin: { title: "Welcome back", subtitle: "Sign in to see your invoices." },
  signup: { title: "Create your account", subtitle: "It takes less than a minute." },
  forgot: { title: "Reset your password", subtitle: "We'll email you a link to set a new one." },
};

function isMode(v: string | null): v is Mode {
  return v === "signin" || v === "signup" || v === "forgot";
}

function Login() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Lets the landing page's "Get started" button link straight into sign-up mode
  // (/login?mode=signup) instead of always landing on sign-in.
  const initialMode = isMode(searchParams.get("mode")) ? (searchParams.get("mode") as Mode) : "signin";
  const [mode, setMode] = useState<Mode>(initialMode);
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

  function goTo(next: Mode) {
    setMode(next);
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

    if (mode === "forgot") {
      const { error } = await auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      // Same message whether or not the address has an account — don't reveal which emails
      // are registered.
      if (error) setError(error.message);
      else setInfo(`If an account exists for ${email}, we've sent a link to reset the password.`);
    } else if (mode === "signin") {
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

  const { title, subtitle } = HEADS[mode];
  const submitLabel =
    mode === "signin" ? "Sign in" : mode === "signup" ? "Create account" : "Send reset link";
  const busyLabel =
    mode === "signin" ? "Signing in…" : mode === "signup" ? "Creating account…" : "Sending…";

  return (
    <main className="auth-page">
      <section className="auth-brand" aria-hidden="true">
        <div className="auth-brand-glow" />
        <div className="auth-brand-top">
          <span className="auth-logo">
            <Logo size={20} />
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
        <div className="auth-form-wrap" key={mode}>
          <div className="auth-form-head">
            <h2>{title}</h2>
            <p className="muted">{subtitle}</p>
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

            {mode !== "forgot" && (
              <>
                <div style={{ height: 14 }} />
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <label htmlFor="pw" style={{ marginBottom: 0 }}>Password</label>
                  {mode === "signin" && (
                    <button
                      type="button"
                      className="auth-switch-link"
                      style={{ fontSize: 13 }}
                      onClick={() => goTo("forgot")}
                      disabled={busy}
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
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
              </>
            )}

            <div className="auth-alerts">
              {error && <Alert kind="error">{error}</Alert>}
              {info && <Alert kind="success">{info}</Alert>}
            </div>

            <button className="primary auth-submit" disabled={busy}>
              {busy && <Spinner size={16} />}
              {busy ? busyLabel : submitLabel}
            </button>
          </form>

          <p className="auth-switch">
            {mode === "signin" && (
              <>
                New to InvoiceFlow?{" "}
                <button type="button" className="auth-switch-link" onClick={() => goTo("signup")} disabled={busy}>
                  Create an account
                </button>
              </>
            )}
            {mode === "signup" && (
              <>
                Already have an account?{" "}
                <button type="button" className="auth-switch-link" onClick={() => goTo("signin")} disabled={busy}>
                  Sign in
                </button>
              </>
            )}
            {mode === "forgot" && (
              <button type="button" className="auth-switch-link" onClick={() => goTo("signin")} disabled={busy}>
                ← Back to sign in
              </button>
            )}
          </p>
        </div>
      </section>
    </main>
  );
}

export default function LoginPage() {
  // useSearchParams() requires a Suspense boundary during static generation.
  return (
    <Suspense fallback={<PageLoader label="Loading InvoiceFlow…" fullScreen />}>
      <Login />
    </Suspense>
  );
}
