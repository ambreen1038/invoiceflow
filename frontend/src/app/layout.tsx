import type { Metadata } from "next";
import "./globals.css";

// Same mark as components/Logo.tsx, self-contained on its own gradient background (a favicon
// has nowhere else to get one from) — kept as a literal data URI rather than another file so
// the browser tab icon doesn't depend on a static asset ending up in the right build output path.
const FAVICON =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E" +
  "%3Cdefs%3E%3ClinearGradient id='g' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E" +
  "%3Cstop offset='0%25' stop-color='%234f7cff'/%3E%3Cstop offset='100%25' stop-color='%232347c9'/%3E" +
  "%3C/linearGradient%3E%3C/defs%3E" +
  "%3Crect width='24' height='24' rx='5' fill='url(%23g)'/%3E" +
  "%3Cpath d='M7.5 3h6.5L18.5 7.5V19.5a1.2 1.2 0 0 1-1.2 1.2H7.5a1.2 1.2 0 0 1-1.2-1.2V4.2A1.2 1.2 0 0 1 7.5 3Z' stroke='white' stroke-width='1.7' stroke-linejoin='round'/%3E" +
  "%3Cpath d='M14 3v4.3a1 1 0 0 0 1 1h3.5' stroke='white' stroke-width='1.7' stroke-linejoin='round'/%3E" +
  "%3Ccircle cx='16.6' cy='16.8' r='4.6' fill='white'/%3E" +
  "%3Cpath d='M14.7 16.9l1.2 1.2 2.3-2.6' stroke='%232347c9' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'/%3E" +
  "%3C/svg%3E";

export const metadata: Metadata = {
  title: "InvoiceFlow",
  description: "Upload invoices, review the extracted fields, export clean data.",
  icons: { icon: FAVICON },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
