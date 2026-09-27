"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError, type Invoice } from "@/lib/api";
import { supabase } from "@/lib/supabase";

const label: Record<Invoice["status"], string> = {
  queued: "Queued",
  processing: "Processing",
  needs_review: "Needs review",
  approved: "Approved",
  failed: "Failed",
};

export default function Dashboard() {
  const router = useRouter();
  const [invoices, setInvoices] = useState<Invoice[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      setInvoices(await api.list());
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) router.replace("/");
      else setError((e as Error).message);
    }
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  // Poll while anything is still being processed.
  const working = invoices?.some((i) => i.status === "queued" || i.status === "processing");
  useEffect(() => {
    if (!working) return;
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, [working, load]);

  async function upload(files: FileList | File[]) {
    const list = Array.from(files);
    if (!list.length) return;
    setBusy(true);
    setError(null);
    try {
      await api.upload(list);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function exportCsv() {
    try {
      const url = URL.createObjectURL(await api.exportCsv());
      const a = document.createElement("a");
      a.href = url;
      a.download = "invoices.csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function signOut() {
    await supabase().auth.signOut();
    router.replace("/");
  }

  return (
    <main>
      <div className="bar">
        <h1>Invoices</h1>
        <div className="row">
          <button onClick={exportCsv}>Export approved (CSV)</button>
          <button onClick={signOut}>Sign out</button>
        </div>
      </div>

      <div
        className={`drop${over ? " over" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          upload(e.dataTransfer.files);
        }}
      >
        <p style={{ margin: "0 0 10px" }}>Drop invoices here (PDF, PNG, JPEG, WebP · up to 10 MB each)</p>
        <button className="primary" disabled={busy} onClick={() => input.current?.click()}>
          {busy ? "Uploading…" : "Choose files"}
        </button>
        <input
          ref={input}
          type="file"
          multiple
          hidden
          accept="application/pdf,image/png,image/jpeg,image/webp"
          onChange={(e) => e.target.files && upload(e.target.files)}
        />
      </div>

      {error && <p className="error">{error}</p>}

      <div className="card" style={{ marginTop: 20, overflowX: "auto" }}>
        {invoices === null ? (
          <p className="muted">Loading…</p>
        ) : invoices.length === 0 ? (
          <p className="muted">No invoices yet. Upload one above.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>File</th>
                <th>Vendor</th>
                <th>Number</th>
                <th>Date</th>
                <th>Total</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((i) => (
                <tr key={i.id} className="click" onClick={() => router.push(`/invoices/${i.id}`)}>
                  <td>{i.filename}</td>
                  <td>{i.vendor ?? "—"}</td>
                  <td>{i.invoice_number ?? "—"}</td>
                  <td>{i.invoice_date ?? "—"}</td>
                  <td>{i.total != null ? `${i.currency ?? ""} ${i.total.toFixed(2)}`.trim() : "—"}</td>
                  <td>
                    <span className={`badge ${i.status}`}>{label[i.status]}</span>
                    {i.issues.length > 0 && i.status === "needs_review" && (
                      <span className="muted"> · {i.issues.length} to check</span>
                    )}
                    {i.is_duplicate && <span className="muted"> · duplicate?</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </main>
  );
}
