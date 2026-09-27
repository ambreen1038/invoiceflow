"use client";

import { useRouter, useSearchParams, useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useCurrentUser } from "@/lib/use-current-user";
import { api } from "@/lib/api";
import { ChevronDownIcon, DownloadIcon, LogoutIcon } from "@/components/icons";

const TITLES: Record<string, string> = {
  queued_or_processing: "In progress",
  needs_review: "Needs review",
  approved: "Approved",
  failed: "Failed",
};

export default function Topbar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = useParams<{ id?: string }>();
  const user = useCurrentUser();
  const [menuOpen, setMenuOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const title = params?.id ? "Invoice review" : TITLES[searchParams.get("status") ?? ""] ?? "All invoices";

  async function exportCsv() {
    setExporting(true);
    try {
      const url = URL.createObjectURL(await api.exportCsv());
      const a = document.createElement("a");
      a.href = url;
      a.download = "invoices.csv";
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  async function signOut() {
    await supabase().auth.signOut();
    router.replace("/");
  }

  return (
    <header className="topbar">
      <h1 className="topbar-title">{title}</h1>
      <div className="topbar-actions">
        <button onClick={exportCsv} disabled={exporting}>
          <DownloadIcon size={16} />
          {exporting ? "Exporting…" : "Export approved (CSV)"}
        </button>

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
