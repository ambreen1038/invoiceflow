"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function Login() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase()
      .auth.getSession()
      .then(({ data }) => {
        if (data.session) router.replace("/dashboard");
      });
  }, [router]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);
    const auth = supabase().auth;
    if (mode === "signin") {
      const { error } = await auth.signInWithPassword({ email, password });
      if (error) setError(error.message);
      else router.replace("/dashboard");
    } else {
      const { data, error } = await auth.signUp({ email, password });
      if (error) setError(error.message);
      else if (data.session) router.replace("/dashboard");
      else setInfo("Check your email to confirm your account, then sign in.");
    }
    setBusy(false);
  }

  return (
    <main style={{ maxWidth: 420, paddingTop: 80 }}>
      <h1>InvoiceFlow</h1>
      <p className="muted">Upload invoices. Review only what the checks flag. Export clean data.</p>
      <form className="card" onSubmit={submit}>
        <label htmlFor="email">Email</label>
        <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <div style={{ height: 12 }} />
        <label htmlFor="pw">Password</label>
        <input id="pw" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
        {error && <p className="error">{error}</p>}
        {info && <p className="muted">{info}</p>}
        <div style={{ height: 12 }} />
        <div className="row">
          <button className="primary" disabled={busy}>
            {mode === "signin" ? "Sign in" : "Create account"}
          </button>
          <button type="button" onClick={() => setMode(mode === "signin" ? "signup" : "signin")}>
            {mode === "signin" ? "Need an account?" : "Have an account?"}
          </button>
        </div>
      </form>
    </main>
  );
}
