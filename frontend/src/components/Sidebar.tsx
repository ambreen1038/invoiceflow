"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useInvoices } from "@/lib/invoices-store";
import {
  CheckCircleIcon,
  ClockIcon,
  FlagIcon,
  InboxIcon,
  UploadIcon,
  XCircleIcon,
} from "@/components/icons";

const NAV = [
  { key: "all", label: "All invoices", status: null, icon: InboxIcon },
  { key: "in_progress", label: "In progress", status: "queued_or_processing", icon: ClockIcon },
  { key: "needs_review", label: "Needs review", status: "needs_review", icon: FlagIcon },
  { key: "approved", label: "Approved", status: "approved", icon: CheckCircleIcon },
  { key: "failed", label: "Failed", status: "failed", icon: XCircleIcon },
] as const;

export default function Sidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeStatus = searchParams.get("status");
  const { counts, uploading, openFilePicker } = useInvoices();
  const onDashboard = pathname === "/dashboard";

  return (
    <aside className="sidebar">
      <Link href="/dashboard" className="sidebar-brand">
        <span className="sidebar-logo">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M6 3h9l5 5v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" stroke="white" strokeWidth="1.6" />
            <path d="M9 12.5h6M9 16h4" stroke="white" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </span>
        InvoiceFlow
      </Link>

      <button className="sidebar-upload" onClick={openFilePicker} disabled={uploading}>
        <UploadIcon size={16} />
        {uploading ? "Uploading…" : "Upload invoices"}
      </button>

      <nav className="sidebar-nav" aria-label="Invoice filters">
        <span className="sidebar-nav-label">Invoices</span>
        {NAV.map(({ key, label, status, icon: Icon }) => {
          const isActive = onDashboard && (status === null ? !activeStatus : activeStatus === status);
          const href = status === null ? "/dashboard" : `/dashboard?status=${status}`;
          return (
            <Link key={key} href={href} className={`sidebar-link${isActive ? " active" : ""}`}>
              <Icon size={17} />
              <span>{label}</span>
              {counts[key] > 0 && <span className="sidebar-count">{counts[key]}</span>}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
