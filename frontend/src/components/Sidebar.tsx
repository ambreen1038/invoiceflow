"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useInvoices } from "@/lib/invoices-store";
import Logo from "@/components/Logo";
import {
  CheckCircleIcon,
  ClockIcon,
  CloseIcon,
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

export default function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeStatus = searchParams.get("status");
  const { counts, uploading, openFilePicker } = useInvoices();
  const onDashboard = pathname === "/dashboard";

  return (
    <>
      {/* Only rendered (and only visible, via CSS) on narrow screens, so it's harmless on desktop. */}
      {open && <div className="sidebar-backdrop" onClick={onClose} aria-hidden="true" />}

      <aside className={`sidebar${open ? " mobile-open" : ""}`}>
        <div className="sidebar-top-row">
          <Link href="/dashboard" className="sidebar-brand" onClick={onClose}>
            <span className="sidebar-logo">
              <Logo size={28} />
            </span>
            InvoiceFlow
          </Link>
          <button className="sidebar-close" onClick={onClose} aria-label="Close menu">
            <CloseIcon size={16} />
          </button>
        </div>

        <button
          className="sidebar-upload"
          onClick={() => {
            openFilePicker();
            onClose();
          }}
          disabled={uploading}
        >
          <UploadIcon size={16} />
          {uploading ? "Uploading…" : "Upload invoices"}
        </button>

        <nav className="sidebar-nav" aria-label="Invoice filters">
          <span className="sidebar-nav-label">Invoices</span>
          {NAV.map(({ key, label, status, icon: Icon }) => {
            const isActive = onDashboard && (status === null ? !activeStatus : activeStatus === status);
            const href = status === null ? "/dashboard" : `/dashboard?status=${status}`;
            return (
              <Link key={key} href={href} className={`sidebar-link${isActive ? " active" : ""}`} onClick={onClose}>
                <Icon size={17} />
                <span>{label}</span>
                {counts[key] > 0 && <span className="sidebar-count">{counts[key]}</span>}
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
