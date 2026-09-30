import type { Metadata } from "next";
import "./globals.css";

// Same image as components/Logo.tsx (public/logo.png) — its transparent background means it
// works as a favicon directly, no separate on-a-solid-background version needed.
export const metadata: Metadata = {
  title: "InvoiceFlow",
  description: "Upload invoices, review the extracted fields, export clean data.",
  icons: { icon: "/logo.png" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
