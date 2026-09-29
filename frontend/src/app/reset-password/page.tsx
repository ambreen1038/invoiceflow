"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import PageLoader from "@/components/PageLoader";
import Alert from "@/components/AuthAlert";
import Logo from "@/components/Logo";
import { Spinner } from "@/components/icons";

/** Reached only via the link in the "reset password" email. Supabase's client parses the
 * recovery token out of the URL on load and turns it into a real (temporary) session — we
 * just wait for that, then let the user set a new password with it. */
export default function ResetPassword() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [validLink, setValidLink] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const auth = supabase().auth;

    // Parse the recovery tokens out of the URL hash ourselves and call setSession()
    // explicitly, rather than relying on the SDK's automatic detectSessionInUrl. That
    // automatic detection runs once, at client-construction time, and in practice raced
    // with this page's own mount often enough (confirmed while building this) to be
    // unreliable — explicit is deterministic.
    const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : "";
    const params = new URLSearchParams(hash);
    const access_token = params.get("access_token");
    const refresh_token = params.get("refresh_token");

    if (access_token && refresh_token) {
      auth.setSession({ access_token, refresh_token }).then(({ data, error }) => {
        setValidLink(!error && !!data.session);
        setReady(true);
        window.history.replaceState(null, "", window.location.pathname); // drop the tokens from the URL
      });
    } else {
      // No token in the URL — e.g. the page was reloaded after the tokens were already
      // consumed. Fall back to whatever session (if any) is already established.
      auth.getSession().then(({ data }) => {
        setValidLink(!!data.session);
        setReady(true);
      });
    }
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    if (password !== confirm) {
      setError("Those two passwords don't match.");
      return;
    }
    setBusy(true);
    const { error } = await supabase().auth.updateUser({ password });
    if (error) setError(error.message);
    else setDone(true);
    setBusy(false);
  }

  if (!ready) return <PageLoader label="Checking your link…" fullScreen />;

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
          <h1>Almost there.</h1>
          <p>Set a new password and you&apos;re straight back into your invoices.</p>
        </div>
      </section>

      <section className="auth-form-side">
        <div className="auth-form-wrap">
          {!validLink ? (
            <>
              <div className="auth-form-head">
                <h2>This link isn&apos;t valid</h2>
                <p className="muted">
                  It may have expired, or already been used. Request a new one from the sign-in page.
                </p>
              </div>
              <button className="primary auth-submit" onClick={() => router.push("/login")}>
                Back to sign in
              </button>
            </>
          ) : done ? (
            <>
              <div className="auth-form-head">
                <h2>Password updated</h2>
                <p className="muted">You&apos;re signed in with your new password.</p>
              </div>
              <button className="primary auth-submit" onClick={() => router.push("/dashboard")}>
                Go to your invoices
              </button>
            </>
          ) : (
            <>
              <div className="auth-form-head">
                <h2>Set a new password</h2>
                <p className="muted">Choose something you haven&apos;t used before.</p>
              </div>
              <form onSubmit={submit} noValidate>
                <label htmlFor="pw">New password</label>
                <div className="auth-pw-field">
                  <input
                    id="pw"
                    type={showPw ? "text" : "password"}
                    autoComplete="new-password"
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

                <div style={{ height: 14 }} />

                <label htmlFor="confirm">Confirm new password</label>
                <input
                  id="confirm"
                  type={showPw ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  minLength={8}
                  disabled={busy}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Type it again"
                />

                {error && (
                  <div className="auth-alerts">
                    <Alert kind="error">{error}</Alert>
                  </div>
                )}

                <button className="primary auth-submit" disabled={busy}>
                  {busy && <Spinner size={16} />}
                  {busy ? "Saving…" : "Save new password"}
                </button>
              </form>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
