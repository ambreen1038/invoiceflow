"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { api, ApiError, type Invoice } from "@/lib/api";
import { notifyInvoiceFinished } from "@/lib/notifications";

const FINISHED_STATUSES = new Set(["needs_review", "approved", "failed"]);

export type UploadFileState = {
  id: string;
  name: string;
  size: number;
  status: "uploading" | "done" | "error";
};

type Ctx = {
  invoices: Invoice[];
  loading: boolean;
  error: string | null;
  uploading: boolean;
  uploadProgress: number; // 0..1, whole-batch
  uploadFiles: UploadFileState[];
  uploadError: string | null;
  counts: Record<"all" | "in_progress" | "needs_review" | "approved" | "failed", number>;
  reload: () => Promise<void>;
  upload: (files: FileList | File[]) => Promise<void>;
  removeInvoice: (id: string) => Promise<void>;
  openFilePicker: () => void;
  dismissUpload: () => void;
};

const InvoicesContext = createContext<Ctx | null>(null);

/** Fetches the invoice list once, keeps it fresh, and centralises upload — shared by the
 * sidebar (counts), the dashboard (the table) and the topbar (the upload action), so all
 * three always agree on the same data. */
export function InvoicesProvider({
  children,
  onUnauthorized,
}: {
  children: React.ReactNode;
  onUnauthorized: () => void;
}) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadFiles, setUploadFiles] = useState<UploadFileState[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevStatuses = useRef<Map<string, string>>(new Map());

  const reload = useCallback(async () => {
    try {
      const next = await api.list();
      // Notify only for an invoice that just moved from queued/processing into a finished
      // state — never on first load (no prior status to compare against) and never for one
      // that was already finished last time we checked.
      if (prevStatuses.current.size > 0) {
        for (const inv of next) {
          const was = prevStatuses.current.get(inv.id);
          if (was && !FINISHED_STATUSES.has(was) && FINISHED_STATUSES.has(inv.status)) {
            notifyInvoiceFinished(inv.filename, inv.status, inv.id);
          }
        }
      }
      prevStatuses.current = new Map(next.map((i) => [i.id, i.status]));
      setInvoices(next);
      setError(null);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) onUnauthorized();
      else setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [onUnauthorized]);

  useEffect(() => {
    reload();
  }, [reload]);

  const working = invoices.some((i) => i.status === "queued" || i.status === "processing");
  useEffect(() => {
    if (!working) return;
    const t = setInterval(reload, 3000);
    return () => clearInterval(t);
  }, [working, reload]);

  const dismissUpload = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    setUploadFiles([]);
    setUploadError(null);
  }, []);

  const upload = useCallback(
    async (files: FileList | File[]) => {
      const list = Array.from(files);
      if (!list.length) return;
      if (hideTimer.current) clearTimeout(hideTimer.current);

      setUploading(true);
      setUploadProgress(0);
      setUploadError(null);
      setUploadFiles(
        list.map((f, i) => ({ id: `${Date.now()}-${i}`, name: f.name, size: f.size, status: "uploading" })),
      );

      try {
        await api.uploadWithProgress(list, setUploadProgress);
        setUploadFiles((prev) => prev.map((f) => ({ ...f, status: "done" })));
        await reload();
      } catch (e) {
        setUploadFiles((prev) => prev.map((f) => ({ ...f, status: "error" })));
        setUploadError((e as Error).message);
      } finally {
        setUploading(false);
        hideTimer.current = setTimeout(dismissUpload, 4000);
      }
    },
    [reload, dismissUpload],
  );

  const removeInvoice = useCallback(
    async (id: string) => {
      await api.remove(id);
      await reload();
    },
    [reload],
  );

  const counts = {
    all: invoices.length,
    in_progress: invoices.filter((i) => i.status === "queued" || i.status === "processing").length,
    needs_review: invoices.filter((i) => i.status === "needs_review").length,
    approved: invoices.filter((i) => i.status === "approved").length,
    failed: invoices.filter((i) => i.status === "failed").length,
  };

  return (
    <InvoicesContext.Provider
      value={{
        invoices,
        loading,
        error,
        uploading,
        uploadProgress,
        uploadFiles,
        uploadError,
        counts,
        reload,
        upload,
        removeInvoice,
        openFilePicker: () => inputRef.current?.click(),
        dismissUpload,
      }}
    >
      {children}
      <input
        ref={inputRef}
        type="file"
        multiple
        hidden
        accept="application/pdf,image/png,image/jpeg,image/webp"
        onChange={(e) => {
          if (e.target.files) upload(e.target.files);
          e.target.value = ""; // let the same file be picked again later
        }}
      />
    </InvoicesContext.Provider>
  );
}

export function useInvoices(): Ctx {
  const ctx = useContext(InvoicesContext);
  if (!ctx) throw new Error("useInvoices() must be used inside <InvoicesProvider>");
  return ctx;
}
