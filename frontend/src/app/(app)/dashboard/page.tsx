"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { useInvoices } from "@/lib/invoices-store";
import { api, type Invoice, type InvoiceEdit } from "@/lib/api";
import {
  CheckCircleIcon,
  ClockIcon,
  FlagIcon,
  InboxIcon,
  SearchIcon,
  TrashIcon,
  UploadIcon,
  XCircleIcon,
} from "@/components/icons";
import PageLoader from "@/components/PageLoader";
import ConfirmDialog from "@/components/ConfirmDialog";

const label: Record<Invoice["status"], string> = {
  queued: "Queued",
  processing: "Processing",
  needs_review: "Needs review",
  approved: "Approved",
  failed: "Failed",
};

const STATS = [
  { key: "all", title: "Total", status: null, icon: InboxIcon, tone: "" },
  { key: "in_progress", title: "In progress", status: "queued_or_processing", icon: ClockIcon, tone: "tone-blue" },
  { key: "needs_review", title: "Needs review", status: "needs_review", icon: FlagIcon, tone: "tone-amber" },
  { key: "approved", title: "Approved", status: "approved", icon: CheckCircleIcon, tone: "tone-green" },
  { key: "failed", title: "Failed", status: "failed", icon: XCircleIcon, tone: "tone-red" },
] as const;

function matches(invoice: Invoice, status: string | null): boolean {
  if (!status) return true;
  if (status === "queued_or_processing") return invoice.status === "queued" || invoice.status === "processing";
  return invoice.status === status;
}

function matchesQuery(invoice: Invoice, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  return (
    (invoice.vendor ?? "").toLowerCase().includes(q) ||
    (invoice.invoice_number ?? "").toLowerCase().includes(q) ||
    invoice.filename.toLowerCase().includes(q)
  );
}

/** The payload to "approve with no edits" — the invoice's own current values, unchanged. */
function asEditPayload(inv: Invoice): InvoiceEdit {
  return {
    vendor: inv.vendor,
    invoice_number: inv.invoice_number,
    invoice_date: inv.invoice_date,
    currency: inv.currency,
    subtotal: inv.subtotal,
    tax: inv.tax,
    total: inv.total,
    items: inv.items,
    approve: true,
    acknowledge_issues: false,
  };
}

export default function Dashboard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const status = searchParams.get("status");
  const { invoices, loading, error, uploading, upload, counts, removeInvoice, reload } = useInvoices();
  const [over, setOver] = useState(false);
  const [query, setQuery] = useState("");
  const [toDelete, setToDelete] = useState<Invoice | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkMessage, setBulkMessage] = useState<string | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  const visible = useMemo(
    () => invoices.filter((i) => matches(i, status) && matchesQuery(i, query)),
    [invoices, status, query],
  );
  const selectedVisible = visible.filter((i) => selected.has(i.id));
  const cleanSelected = selectedVisible.filter((i) => i.status === "needs_review" && i.issues.length === 0);
  const allVisibleSelected = visible.length > 0 && visible.every((i) => selected.has(i.id));

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllVisible() {
    setSelected((prev) => {
      if (allVisibleSelected) {
        const next = new Set(prev);
        visible.forEach((i) => next.delete(i.id));
        return next;
      }
      return new Set([...prev, ...visible.map((i) => i.id)]);
    });
  }

  function clearSelection() {
    setSelected(new Set());
    setBulkMessage(null);
  }

  async function confirmDelete() {
    if (!toDelete) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await removeInvoice(toDelete.id);
      setToDelete(null);
    } catch (e) {
      setDeleteError((e as Error).message);
    } finally {
      setDeleting(false);
    }
  }

  async function bulkApprove() {
    setBulkBusy(true);
    setBulkMessage(null);
    let ok = 0;
    let failed = 0;
    for (const inv of cleanSelected) {
      try {
        await api.save(inv.id, asEditPayload(inv));
        ok++;
      } catch {
        failed++;
      }
    }
    const skipped = selectedVisible.length - cleanSelected.length;
    await reload();
    setSelected(new Set());
    setBulkBusy(false);
    const parts = [`Approved ${ok}`];
    if (skipped > 0) parts.push(`skipped ${skipped} with unresolved issues`);
    if (failed > 0) parts.push(`${failed} failed`);
    setBulkMessage(parts.join(", ") + ".");
  }

  async function bulkDelete() {
    setBulkBusy(true);
    let ok = 0;
    let failed = 0;
    for (const inv of selectedVisible) {
      try {
        await api.remove(inv.id);
        ok++;
      } catch {
        failed++;
      }
    }
    await reload();
    setSelected(new Set());
    setBulkBusy(false);
    setBulkDeleteOpen(false);
    setBulkMessage(failed > 0 ? `Deleted ${ok}, ${failed} failed.` : `Deleted ${ok}.`);
  }

  return (
    <main>
      <div className="stat-row">
        {STATS.map(({ key, title, status: s, icon: Icon, tone }) => (
          <Link
            key={key}
            href={s ? `/dashboard?status=${s}` : "/dashboard"}
            className={`stat-card ${tone}${(status ?? null) === s ? " active" : ""}`}
          >
            <span className="stat-icon">
              <Icon size={18} />
            </span>
            <span className="stat-value">{counts[key]}</span>
            <span className="stat-title">{title}</span>
          </Link>
        ))}
      </div>

      <label
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
        <span className="drop-icon">
          <UploadIcon size={22} />
        </span>
        <p className="drop-title">{uploading ? "Uploading…" : "Drop invoices here, or click to browse"}</p>
        <p className="drop-hint muted">PDF, PNG, JPEG or WebP · up to 10 MB each · up to 20 files at once</p>
        <input
          type="file"
          multiple
          className="visually-hidden"
          accept="application/pdf,image/png,image/jpeg,image/webp"
          onChange={(e) => {
            if (e.target.files) upload(e.target.files);
            e.target.value = "";
          }}
        />
      </label>

      {error && <p className="error">{error}</p>}

      <div className="table-toolbar">
        <div className="search-box">
          <SearchIcon size={16} className="search-icon" />
          <input
            type="search"
            placeholder="Search by vendor or invoice number…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        {selected.size > 0 && (
          <div className="bulk-bar">
            <span>{selected.size} selected</span>
            <button onClick={bulkApprove} disabled={bulkBusy || cleanSelected.length === 0}>
              Approve clean ({cleanSelected.length})
            </button>
            <button className="danger" onClick={() => setBulkDeleteOpen(true)} disabled={bulkBusy}>
              Delete selected
            </button>
            <button onClick={clearSelection} disabled={bulkBusy}>
              Clear
            </button>
          </div>
        )}
      </div>
      {bulkMessage && <p className="muted" style={{ margin: "0 0 10px" }}>{bulkMessage}</p>}

      <div className="card table-card">
        {loading ? (
          <PageLoader label="Loading your invoices…" />
        ) : visible.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon">
              <InboxIcon size={26} />
            </span>
            <p>{query ? "No matches" : status ? "Nothing here yet" : "No invoices yet"}</p>
            <p className="muted">
              {query
                ? "Try a different vendor or invoice number."
                : status
                  ? "Invoices will show up here once they match this filter."
                  : "Drop a file above to get started."}
            </p>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th style={{ width: 32 }}>
                  <input
                    type="checkbox"
                    aria-label="Select all visible invoices"
                    checked={allVisibleSelected}
                    onChange={toggleAllVisible}
                  />
                </th>
                <th>File</th>
                <th>Vendor</th>
                <th>Number</th>
                <th>Date</th>
                <th>Total</th>
                <th>Status</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {visible.map((i) => (
                <tr key={i.id} className="click" onClick={() => router.push(`/invoices/${i.id}`)}>
                  <td onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      aria-label={`Select ${i.filename}`}
                      checked={selected.has(i.id)}
                      onChange={() => toggleOne(i.id)}
                    />
                  </td>
                  <td className="filename-cell" title={i.filename}>{i.filename}</td>
                  <td>{i.vendor ?? "—"}</td>
                  <td>{i.invoice_number ?? "—"}</td>
                  <td>{i.invoice_date ?? "—"}</td>
                  <td>{i.total != null ? `${i.currency ?? ""} ${i.total.toFixed(2)}`.trim() : "—"}</td>
                  <td>
                    <span className={`badge ${i.status}`}>{label[i.status]}</span>
                    {i.status === "needs_review" && i.issues.some((x) => x.code === "not_invoice") ? (
                      <span className="muted"> · doesn&apos;t look like an invoice</span>
                    ) : (
                      i.issues.length > 0 &&
                      i.status === "needs_review" && <span className="muted"> · {i.issues.length} to check</span>
                    )}
                    {i.is_duplicate && <span className="muted"> · duplicate?</span>}
                  </td>
                  <td>
                    <button
                      className="icon-btn"
                      aria-label={`Delete ${i.filename}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteError(null);
                        setToDelete(i);
                      }}
                    >
                      <TrashIcon size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <ConfirmDialog
        open={toDelete !== null}
        title="Delete this invoice?"
        message={
          toDelete
            ? `"${toDelete.filename}" and its uploaded file will be permanently deleted. This can't be undone.`
            : ""
        }
        confirmLabel="Delete"
        danger
        busy={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
      {deleteError && <p className="error">{deleteError}</p>}

      <ConfirmDialog
        open={bulkDeleteOpen}
        title={`Delete ${selectedVisible.length} invoice${selectedVisible.length === 1 ? "" : "s"}?`}
        message="Each one and its uploaded file will be permanently deleted. This can't be undone."
        confirmLabel="Delete all"
        danger
        busy={bulkBusy}
        onConfirm={bulkDelete}
        onCancel={() => setBulkDeleteOpen(false)}
      />
    </main>
  );
}
