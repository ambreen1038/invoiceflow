import { supabase } from "./supabase";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export type Issue = { field: string; code: string; message: string };
export type Item = {
  description: string | null;
  quantity: number | null;
  unit_price: number | null;
  amount: number | null;
};
export type Invoice = {
  id: string;
  filename: string;
  status: "queued" | "processing" | "needs_review" | "approved" | "failed";
  vendor: string | null;
  invoice_number: string | null;
  invoice_date: string | null;
  currency: string | null;
  subtotal: number | null;
  tax: number | null;
  total: number | null;
  items: Item[];
  issues: Issue[];
  is_duplicate: boolean;
  error: string | null;
  created_at: string;
};
export type InvoiceEdit = Pick<
  Invoice,
  "vendor" | "invoice_number" | "invoice_date" | "currency" | "subtotal" | "tax" | "total" | "items"
> & { approve: boolean; acknowledge_issues: boolean };

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request(path: string, init: RequestInit = {}): Promise<Response> {
  const { data } = await supabase().auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new ApiError(401, "Not signed in");
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { ...(init.headers ?? {}), Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    let message = res.statusText;
    try {
      const body = await res.json();
      const detail = body.detail;
      message = typeof detail === "string" ? detail : (detail?.message ?? message);
    } catch {
      /* not JSON */
    }
    throw new ApiError(res.status, message);
  }
  return res;
}

/** Upload with real byte-level progress. `fetch` has no upload-progress event in any
 * browser yet, so this is the one request in the app that uses XMLHttpRequest instead. */
function uploadWithProgress(
  token: string,
  files: File[],
  onProgress: (fraction: number) => void,
): Promise<Invoice[]> {
  const form = new FormData();
  files.forEach((f) => form.append("files", f));
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API}/invoices`);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded / e.total);
    };
    xhr.onload = () => {
      let body: unknown;
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        body = null;
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(1);
        resolve(body as Invoice[]);
      } else {
        const detail = (body as { detail?: unknown } | null)?.detail;
        const message = typeof detail === "string" ? detail : (detail as { message?: string })?.message;
        reject(new ApiError(xhr.status, message ?? xhr.statusText ?? "Upload failed"));
      }
    };
    xhr.onerror = () => reject(new ApiError(0, "Network error during upload"));
    xhr.send(form);
  });
}

export const api = {
  list: async (): Promise<Invoice[]> => (await request("/invoices")).json(),
  get: async (id: string): Promise<Invoice> => (await request(`/invoices/${id}`)).json(),
  upload: async (files: File[]): Promise<Invoice[]> => {
    const form = new FormData();
    files.forEach((f) => form.append("files", f));
    return (await request("/invoices", { method: "POST", body: form })).json();
  },
  uploadWithProgress: async (files: File[], onProgress: (fraction: number) => void): Promise<Invoice[]> => {
    const { data } = await supabase().auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new ApiError(401, "Not signed in");
    return uploadWithProgress(token, files, onProgress);
  },
  save: async (id: string, body: InvoiceEdit): Promise<Invoice> =>
    (
      await request(`/invoices/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
    ).json(),
  retry: async (id: string): Promise<Invoice> =>
    (await request(`/invoices/${id}/retry`, { method: "POST" })).json(),
  remove: async (id: string): Promise<void> => {
    await request(`/invoices/${id}`, { method: "DELETE" });
  },
  file: async (id: string): Promise<Blob> => (await request(`/invoices/${id}/file`)).blob(),
  exportCsv: async (): Promise<Blob> => (await request("/invoices/export.csv")).blob(),
  exportXlsx: async (): Promise<Blob> => (await request("/invoices/export.xlsx")).blob(),
};
