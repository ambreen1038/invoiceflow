"use client";

import { useRouter, useSearchParams, useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useCurrentUser } from "@/lib/use-current-user";
import { api } from "@/lib/api";
import {
  BellIcon,
  ChevronDownIcon,
  DownloadIcon,
  LogoutIcon,
  MenuIcon,
} from "@/components/icons";
import * as notifications from "@/lib/notifications";

const TITLES: Record<string, string> = {
  queued_or_processing: "In progress",
  needs_review: "Needs review",
  approved: "Approved",
  failed: "Failed",
};

export default function Topbar({ onOpenMenu }: { onOpenMenu: () => void }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = useParams<{ id?: string }>();
  const user = useCurrentUser();
  const [menuOpen, setMenuOpen] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [exporting, setExporting] = useState<"csv" | "xlsx" | null>(null);
  const [notifyOn, setNotifyOn] = useState(false);
  const [notifySupported, setNotifySupported] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const exportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) setExportMenuOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  useEffect(() => {
    setNotifySupported(notifications.isSupported());
    setNotifyOn(notifications.isEnabled());
  }, []);

  async function toggleNotify() {
    if (notifyOn) {
      notifications.setEnabled(false);
      setNotifyOn(false);
      return;
    }
    if (notifications.permission() === "denied") {
      alert(
        "Notifications are blocked for this site in your browser. Allow them from your browser's " +
          "site settings, then try this toggle again.",
      );
      return;
    }
    setNotifyOn(await notifications.requestEnable());
  }

  const title = params?.id ? "Invoice review" : TITLES[searchParams.get("status") ?? ""] ?? "All invoices";

  async function exportAs(format: "csv" | "xlsx") {
    setExporting(format);
    setExportMenuOpen(false);
    try {
      const blob = format === "csv" ? await api.exportCsv() : await api.exportXlsx();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `invoices.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(null);
    }
  }

  async function signOut() {
    await supabase().auth.signOut();
    router.replace("/login");
  }

  return (
    <header className="topbar">
      <div className="topbar-left">
        <button className="menu-btn" onClick={onOpenMenu} aria-label="Open menu">
          <MenuIcon size={20} />
        </button>
        <h1 className="topbar-title">{title}</h1>
      </div>
      <div className="topbar-actions">
        <div className="user-menu" ref={exportRef}>
          <button
            onClick={() => setExportMenuOpen((v) => !v)}
            disabled={exporting !== null}
            aria-expanded={exportMenuOpen}
            aria-label={exporting ? `Exporting ${exporting.toUpperCase()}…` : "Export approved"}
          >
            <DownloadIcon size={16} />
            <span className="topbar-export-label">
              {exporting ? `Exporting ${exporting.toUpperCase()}…` : "Export approved"}
            </span>
            <ChevronDownIcon size={14} />
          </button>
          {exportMenuOpen && (
            <div className="user-menu-panel" role="menu" style={{ width: 170 }}>
              <button role="menuitemcheckbox" onClick={() => exportAs("csv")}>
                <DownloadIcon size={16} />
                <span style={{ flex: 1, textAlign: "left" }}>as CSV</span>
              </button>
              <button role="menuitemcheckbox" onClick={() => exportAs("xlsx")}>
                <DownloadIcon size={16} />
                <span style={{ flex: 1, textAlign: "left" }}>as Excel</span>
              </button>
            </div>
          )}
        </div>

        <div className="user-menu" ref={menuRef}>
          <button className="user-menu-trigger" onClick={() => setMenuOpen((v) => !v)} aria-expanded={menuOpen}>
            <span className="user-avatar">{user?.initials ?? "…"}</span>
            <ChevronDownIcon size={16} />
          </button>
          {menuOpen && (
            <div className="user-menu-panel" role="menu">
              <div className="user-menu-info">
                <strong>{user?.name}</strong>
                {user?.email && user.email !== user.name && <span>{user.email}</span>}
              </div>
              {notifySupported && (
                <button role="menuitemcheckbox" aria-checked={notifyOn} onClick={toggleNotify}>
                  <BellIcon size={16} />
                  <span style={{ flex: 1, textAlign: "left" }}>Notify when done</span>
                  <span className={`toggle-pill${notifyOn ? " on" : ""}`} aria-hidden="true">
                    <span className="toggle-knob" />
                  </span>
                </button>
              )}
              <button role="menuitem" onClick={signOut}>
                <LogoutIcon size={16} />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
