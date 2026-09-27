"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useInvoices } from "@/lib/invoices-store";
import type { Invoice } from "@/lib/api";
import {
  CheckCircleIcon,
  ClockIcon,
  FlagIcon,
  InboxIcon,
  UploadIcon,
  XCircleIcon,
} from "@/components/icons";
import PageLoader from "@/components/PageLoader";

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

export default function Dashboard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const status = searchParams.get("status");
  const { invoices, loading, error, uploading, upload, counts } = useInvoices();
  const [over, setOver] = useState(false);

  const visible = invoices.filter((i) => matches(i, status));

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
          hidden
          accept="application/pdf,image/png,image/jpeg,image/webp"
          onChange={(e) => {
            if (e.target.files) upload(e.target.files);
            e.target.value = "";
          }}
        />
      </label>

      {error && <p className="error">{error}</p>}

      <div className="card table-card">
        {loading ? (
          <PageLoader label="Loading your invoices…" />
        ) : visible.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon">
              <InboxIcon size={26} />
            </span>
            <p>{status ? "Nothing here yet" : "No invoices yet"}</p>
            <p className="muted">
              {status ? "Invoices will show up here once they match this filter." : "Drop a file above to get started."}
            </p>
          </div>
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
              {visible.map((i) => (
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
