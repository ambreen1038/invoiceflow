import type { Metadata } from "next";
import "./globals.css";

// Same mark as components/Logo.tsx, self-contained on its own blue background (a favicon has
// nowhere else to get one from) — kept as a literal data URI rather than another file so the
// browser tab icon doesn't depend on a static asset ending up in the right build output path.
const FAVICON =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E" +
  "%3Crect width='24' height='24' rx='5' fill='%232f5bea'/%3E" +
  "%3Cpath d='M7 2.5h7.5L19 7v13.5a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1Z' stroke='white' stroke-width='1.6' stroke-linejoin='round'/%3E" +
  "%3Cpath d='M14.5 2.5V7H19' stroke='white' stroke-width='1.6' stroke-linejoin='round'/%3E" +
  "%3Cpath d='M8.6 12h6.4M8.6 15h4.8M8.6 18h3' stroke='white' stroke-width='1.5' stroke-linecap='round'/%3E" +
  "%3Ccircle cx='17.3' cy='17.1' r='4.1' fill='%232f5bea' stroke='white' stroke-width='1.4'/%3E" +
  "%3Cpath d='M15.5 17.2l1.1 1.1 2.1-2.3' stroke='white' stroke-width='1.4' stroke-linecap='round' stroke-linejoin='round'/%3E" +
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
