"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, ApiError, type Invoice, type Issue, type Item } from "@/lib/api";
import { useInvoices } from "@/lib/invoices-store";
import PageLoader from "@/components/PageLoader";
import ConfirmDialog from "@/components/ConfirmDialog";
import { PlusIcon, Spinner, TrashIcon } from "@/components/icons";

type Action = "save" | "approve" | "retry" | "delete" | null;

type Form = {
  vendor: string;
  invoice_number: string;
  invoice_date: string;
  currency: string;
  subtotal: string;
  tax: string;
  total: string;
  items: { description: string; quantity: string; unit_price: string; amount: string }[];
};

const num = (v: string): number | null => (v.trim() === "" || isNaN(Number(v)) ? null : Number(v));
const str = (v: number | null | undefined) => (v == null ? "" : String(v));

function toForm(inv: Invoice): Form {
  return {
    vendor: inv.vendor ?? "",
    invoice_number: inv.invoice_number ?? "",
    invoice_date: inv.invoice_date ?? "",
    currency: inv.currency ?? "",
    subtotal: str(inv.subtotal),
    tax: str(inv.tax),
    total: str(inv.total),
    items: inv.items.map((i) => ({
      description: i.description ?? "",
      quantity: str(i.quantity),
      unit_price: str(i.unit_price),
      amount: str(i.amount),
    })),
  };
}

function toPayload(f: Form, approve: boolean, acknowledge: boolean) {
  const items: Item[] = f.items.map((i) => ({
    description: i.description || null,
    quantity: num(i.quantity),
    unit_price: num(i.unit_price),
    amount: num(i.amount),
  }));
  return {
    vendor: f.vendor || null,
    invoice_number: f.invoice_number || null,
    invoice_date: f.invoice_date || null,
    currency: f.currency || null,
    subtotal: num(f.subtotal),
    tax: num(f.tax),
    total: num(f.total),
    items,
    approve,
    acknowledge_issues: acknowledge,
  };
}

export default function Review() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [inv, setInv] = useState<Invoice | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [fileType, setFileType] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [ack, setAck] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [action, setAction] = useState<Action>(null);
  const { reload } = useInvoices(); // keep the sidebar's counts and the dashboard table in sync

  function accept(next: Invoice) {
    setInv(next);
    setForm(toForm(next));
  }

  useEffect(() => {
    let alive = true;
    let url: string | null = null;
    api
      .get(id)
      .then((i) => alive && accept(i))
      .catch((e: Error) => alive && setError(e.message));
    api
      .file(id)
      .then((blob) => {
        if (!alive) return;
        url = URL.createObjectURL(blob);
        setFileType(blob.type);
        setFileUrl(url);
      })
      .catch(() => {});
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [id]);

  // While still processing, keep polling.
  useEffect(() => {
    if (!inv || !(inv.status === "queued" || inv.status === "processing")) return;
    const t = setInterval(() => api.get(id).then(accept).catch(() => {}), 3000);
    return () => clearInterval(t);
  }, [inv, id]);

  const issuesFor = (field: string): Issue[] => inv?.issues.filter((i) => i.field === field) ?? [];
  const flagged = (field: string) => (issuesFor(field).length ? "flag" : undefined);

  async function save(approve: boolean) {
    if (!form) return;
    setBusy(true);
    setAction(approve ? "approve" : "save");
    setError(null);
    try {
      const next = await api.save(id, toPayload(form, approve, ack));
      accept(next);
      reload();
      if (approve) router.push("/dashboard");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : (e as Error).message);
      // Server re-validated; show its current issues even if approval was refused.
      api.get(id).then((i) => setInv(i)).catch(() => {});
    } finally {
      setBusy(false);
      setAction(null);
    }
  }

  async function retry() {
    setBusy(true);
    setAction("retry");
    try {
      accept(await api.retry(id));
      reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      setAction(null);
    }
  }

  async function remove() {
    setBusy(true);
    setAction("delete");
    try {
      await api.remove(id);
      reload();
      router.push("/dashboard");
    } catch (e) {
      setError((e as Error).message);
      setConfirmingDelete(false);
      setBusy(false);
      setAction(null);
    }
  }

  if (!inv || !form) {
    return error ? <main><p className="error">{error}</p></main> : <PageLoader label="Loading invoice…" fullScreen />;
  }

  const notInvoice = inv.issues.some((x) => x.code === "not_invoice");
  const otherIssues = inv.issues.filter((x) => x.code !== "not_invoice"); // "not_invoice" gets its own banner above

  const set = (k: keyof Omit<Form, "items">) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [k]: e.target.value });
  const setItem = (idx: number, k: keyof Form["items"][number], v: string) =>
    setForm({ ...form, items: form.items.map((it, n) => (n === idx ? { ...it, [k]: v } : it)) });
  const addItem = () =>
    setForm({
      ...form,
      items: [...form.items, { description: "", quantity: "", unit_price: "", amount: "" }],
    });
  const removeItem = (idx: number) =>
    setForm({ ...form, items: form.items.filter((_, n) => n !== idx) });

  const pending = inv.status === "queued" || inv.status === "processing";
  const field = (k: keyof Omit<Form, "items">, title: string, type = "text") => (
    <div>
      <label htmlFor={k}>{title}</label>
      <input id={k} type={type} step={type === "number" ? "0.01" : undefined} className={flagged(k)} value={form[k]} onChange={set(k)} disabled={pending} />
    </div>
  );

  return (
    <main>
      <div className="bar">
        <div>
          <Link href="/dashboard">← All invoices</Link>
          <h1>{inv.filename}</h1>
        </div>
        <span className={`badge ${inv.status}`}>{inv.status.replace("_", " ")}</span>
      </div>

      <div className="split">
        <div className="card">
          {fileUrl ? (
            fileType === "application/pdf" ? (
              <iframe className="preview" src={fileUrl} title="Invoice" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="preview" src={fileUrl} alt="Uploaded invoice" />
            )
          ) : (
            <PageLoader label="Loading preview…" />
          )}
        </div>

        <div className="card">
          {pending && <p className="muted">Extracting fields… this page updates automatically.</p>}
          {inv.status === "failed" && (
            <div>
              <p className="error">Extraction failed: {inv.error}</p>
              <button className="btn-with-spinner" onClick={retry} disabled={busy}>
                {action === "retry" && <Spinner size={14} />}
                Retry extraction
              </button>
              <p className="muted">Or fill the fields in by hand below.</p>
            </div>
          )}

          {notInvoice && (
            <div className="alert alert-error" style={{ marginTop: 0, marginBottom: 16 }}>
              <span>
                This doesn&apos;t look like an invoice or receipt. If that&apos;s right, delete it below.
                If it actually is one, fill in the fields by hand and approve.
              </span>
            </div>
          )}

          <div className="grid">
            {field("vendor", "Vendor")}
            {field("invoice_number", "Invoice number")}
            {field("invoice_date", "Date", "date")}
            {field("currency", "Currency")}
            {field("subtotal", "Subtotal", "number")}
            {field("tax", "Tax", "number")}
            {field("total", "Total", "number")}
          </div>

          <h3>Line items</h3>
          {form.items.length === 0 && <p className="muted">No line items were read.</p>}
          {form.items.map((it, n) => (
            <div key={n} className="item-row">
              <input aria-label={`Item ${n + 1} description`} placeholder="Description" value={it.description} onChange={(e) => setItem(n, "description", e.target.value)} disabled={pending} />
              <input aria-label={`Item ${n + 1} quantity`} placeholder="Qty" type="number" step="0.001" value={it.quantity} onChange={(e) => setItem(n, "quantity", e.target.value)} disabled={pending} />
              <input aria-label={`Item ${n + 1} unit price`} placeholder="Unit price" type="number" step="0.01" value={it.unit_price} onChange={(e) => setItem(n, "unit_price", e.target.value)} disabled={pending} />
              <input aria-label={`Item ${n + 1} amount`} placeholder="Amount" type="number" step="0.01" className={flagged(`items.${n}.amount`)} value={it.amount} onChange={(e) => setItem(n, "amount", e.target.value)} disabled={pending} />
              <button
                type="button"
                className="icon-btn"
                aria-label={`Remove item ${n + 1}`}
                onClick={() => removeItem(n)}
                disabled={pending}
              >
                <TrashIcon size={15} />
              </button>
            </div>
          ))}
          <button type="button" className="add-line-btn" onClick={addItem} disabled={pending}>
            <PlusIcon size={14} /> Add line
          </button>

          {inv.issues.length > 0 && (
            <div style={{ marginTop: 12 }}>
              {otherIssues.length > 0 && (
                <>
                  <strong>Checks that need your attention</strong>
                  {otherIssues.map((i, n) => (
                    <p key={n} className="issue">• {i.message}</p>
                  ))}
                </>
              )}
              <label style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8 }}>
                <input type="checkbox" style={{ width: "auto" }} checked={ack} onChange={(e) => setAck(e.target.checked)} />
                I have checked the document and want to approve anyway
              </label>
            </div>
          )}

          {error && <p className="error">{error}</p>}

          <div className="row" style={{ marginTop: 16 }}>
            <button className="btn-with-spinner" onClick={() => save(false)} disabled={busy || pending}>
              {action === "save" && <Spinner size={14} />}
              {action === "save" ? "Checking…" : "Save & re-check"}
            </button>
            <button
              className="primary btn-with-spinner"
              onClick={() => save(true)}
              disabled={busy || pending || (inv.issues.length > 0 && !ack)}
            >
              {action === "approve" && <Spinner size={14} />}
              {action === "approve" ? "Approving…" : "Approve"}
            </button>
            <button className="danger" onClick={() => setConfirmingDelete(true)} disabled={busy}>
              Delete
            </button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmingDelete}
        title="Delete this invoice?"
        message={`"${inv.filename}" and its uploaded file will be permanently deleted. This can't be undone.`}
        confirmLabel="Delete"
        danger
        busy={busy && action === "delete"}
        onConfirm={remove}
        onCancel={() => setConfirmingDelete(false)}
      />
    </main>
  );
}
