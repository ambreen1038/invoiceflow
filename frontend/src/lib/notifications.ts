"use client";

/** Desktop notifications for "your invoice finished processing" — scoped honestly: this only
 * works while the tab is still open somewhere (foreground or background) in a browser that
 * supports the Notification API. It is NOT push — closing the tab or the browser means no
 * notification, and there is no server-side/email fallback. Good enough for "I can tab away
 * and still find out," not for "notify me on my phone while my laptop is off." */

const PREF_KEY = "invoiceflow:notify-enabled";

export function isSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export function permission(): NotificationPermission | "unsupported" {
  return isSupported() ? Notification.permission : "unsupported";
}

/** The user's own preference, independent of the browser permission (they might grant the
 * permission once, then later turn our toggle off without revoking it at the browser level). */
export function isEnabled(): boolean {
  if (!isSupported()) return false;
  try {
    return localStorage.getItem(PREF_KEY) === "1" && Notification.permission === "granted";
  } catch {
    return false;
  }
}

export function setEnabled(value: boolean) {
  try {
    localStorage.setItem(PREF_KEY, value ? "1" : "0");
  } catch {
    /* private browsing / storage blocked — the toggle just won't persist across reloads */
  }
}

/** Call from a click handler (permission prompts require a user gesture). Returns whether
 * notifications ended up enabled. */
export async function requestEnable(): Promise<boolean> {
  if (!isSupported()) return false;
  const result = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
  const enabled = result === "granted";
  setEnabled(enabled);
  return enabled;
}

const STATUS_LABEL: Record<string, string> = {
  needs_review: "needs your review",
  approved: "was approved",
  failed: "failed to process",
};

/** Fires only if the tab is currently hidden — no point notifying about something the user is
 * already looking at. */
export function notifyInvoiceFinished(filename: string, status: string, invoiceId: string) {
  if (!isEnabled() || document.visibilityState !== "hidden") return;
  const label = STATUS_LABEL[status];
  if (!label) return;
  try {
    const n = new Notification("InvoiceFlow", { body: `${filename} ${label}.`, tag: invoiceId });
    n.onclick = () => {
      window.focus();
      window.location.assign(`/invoices/${invoiceId}`);
      n.close();
    };
  } catch {
    /* some browsers throw if permission was revoked after the fact — never let this break the app */
  }
}
