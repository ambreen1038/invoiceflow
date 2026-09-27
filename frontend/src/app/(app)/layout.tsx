"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { InvoicesProvider } from "@/lib/invoices-store";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import UploadToast from "@/components/UploadToast";
import PageLoader from "@/components/PageLoader";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    supabase()
      .auth.getSession()
      .then(({ data }) => {
        if (!alive) return;
        if (!data.session) router.replace("/");
        else setReady(true);
      });
    const { data: sub } = supabase().auth.onAuthStateChange((_event, session) => {
      if (!session) router.replace("/");
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, [router]);

  if (!ready) return <PageLoader label="Loading InvoiceFlow…" fullScreen />;

  return (
    <InvoicesProvider onUnauthorized={() => router.replace("/")}>
      <div className="app-shell">
        <Sidebar />
        <div className="app-shell-main">
          <Topbar />
          <div className="app-shell-content">{children}</div>
        </div>
      </div>
      <UploadToast />
    </InvoicesProvider>
  );
}
