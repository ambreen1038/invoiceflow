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

export const api = {
  list: async (): Promise<Invoice[]> => (await request("/invoices")).json(),
  get: async (id: string): Promise<Invoice> => (await request(`/invoices/${id}`)).json(),
  upload: async (files: File[]): Promise<Invoice[]> => {
    const form = new FormData();
    files.forEach((f) => form.append("files", f));
    return (await request("/invoices", { method: "POST", body: form })).json();
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
};
