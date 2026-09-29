"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import PageLoader from "@/components/PageLoader";
import Reveal from "@/components/Reveal";
import Logo from "@/components/Logo";
import {
  BellIcon,
  CheckCircleIcon,
  DownloadIcon,
  DuplicateIcon,
  EditIcon,
  SearchIcon,
  UploadIcon,
} from "@/components/icons";

const FEATURES = [
  {
    icon: UploadIcon,
    title: "AI-powered extraction",
    desc: "Drop in a PDF, PNG, JPEG or WebP and get vendor, dates, line items and totals back as structured fields — no template setup.",
  },
  {
    icon: CheckCircleIcon,
    title: "Math checked automatically",
    desc: "Every invoice's arithmetic is validated on arrival. Only the ones with a real discrepancy get flagged for review.",
  },
  {
    icon: DuplicateIcon,
    title: "Duplicate detection",
    desc: "Re-uploading the same file, or one that extracts to the same vendor and total, gets caught before it's processed twice.",
  },
  {
    icon: EditIcon,
    title: "Editable review screen",
    desc: "Fix a field, add or remove a line item, and re-check the math — all before anything is approved.",
  },
  {
    icon: SearchIcon,
    title: "Search, filter, bulk actions",
    desc: "Find an invoice by vendor or number, filter by status, and approve or delete a whole selection at once.",
  },
  {
    icon: DownloadIcon,
    title: "Export to CSV or Excel",
    desc: "Approved invoices export in one click, in whichever format your bookkeeping tool actually wants.",
  },
];

const STEPS = [
  { title: "Upload", desc: "Drag in a batch of invoices — photos or PDFs, up to 20 at once." },
  { title: "Review", desc: "Only the ones with a flagged issue need your attention; the rest are ready to go." },
  { title: "Export", desc: "Send approved invoices out as CSV or Excel, whenever you're ready." },
];

export default function Landing() {
  const router = useRouter();
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    supabase()
      .auth.getSession()
      .then(({ data }) => {
        if (data.session) router.replace("/dashboard");
        else setCheckingSession(false);
      });
  }, [router]);

  if (checkingSession) return <PageLoader label="Loading InvoiceFlow…" fullScreen />;

  return (
    <>
      <nav className="landing-nav">
        <Link href="/" className="landing-nav-brand">
          <span className="landing-nav-logo">
            <Logo size={17} />
          </span>
          InvoiceFlow
        </Link>
        <div className="landing-nav-actions">
          <Link href="/login" className="landing-nav-signin">Sign in</Link>
          <Link href="/login?mode=signup" className="landing-btn landing-btn-solid">Get started</Link>
        </div>
      </nav>

      <header className="landing-hero">
        <div className="landing-hero-glow" />
        <div className="landing-hero-inner">
          <span className="landing-hero-badge">AI-powered invoice processing</span>
          <h1>Stop retyping invoices by hand.</h1>
          <p>
            Upload a batch, let extraction and math-checking do the tedious part, review only
            what doesn&apos;t add up, and export the rest to CSV or Excel.
          </p>
          <div className="landing-hero-actions">
            <Link href="/login?mode=signup" className="landing-btn landing-btn-lg landing-btn-white">Get started free</Link>
            <Link href="/login" className="landing-btn landing-btn-lg landing-btn-ghost">Sign in</Link>
          </div>

          <div className="landing-mock-wrap" aria-hidden="true">
            <div className="landing-mock">
              <div className="landing-mock-row">
                <span className="landing-mock-dot" />
                <span className="landing-mock-dot" />
                <span className="landing-mock-dot" />
              </div>
              <div className="landing-mock-body">
                <div className="landing-mock-field">
                  <span>Vendor</span>
                  <strong>Al-Rehman Traders</strong>
                </div>
                <div className="landing-mock-field">
                  <span>Total</span>
                  <strong>PKR 42,500.00</strong>
                </div>
                <div className="landing-mock-field is-flagged">
                  <span>Tax</span>
                  <strong>PKR 3,825.00</strong>
                  <em>doesn&apos;t match subtotal + tax</em>
                </div>
                <div className="landing-mock-approve">Needs your review</div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <section className="section" id="features">
        <div className="section-inner">
          <Reveal>
            <div className="section-head">
              <div className="eyebrow">Features</div>
              <h2>Everything the review process actually needs</h2>
              <p>No fluff — every one of these is a real, working part of the app, not a roadmap item.</p>
            </div>
          </Reveal>
          <div className="feature-grid">
            {FEATURES.map((f, i) => (
              <Reveal key={f.title} delay={i * 60}>
                <div className="feature-card">
                  <span className="feature-icon">
                    <f.icon size={20} />
                  </span>
                  <h3>{f.title}</h3>
                  <p>{f.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="section" style={{ background: "var(--bg)" }} id="how-it-works">
        <div className="section-inner">
          <Reveal>
            <div className="section-head">
              <div className="eyebrow">How it works</div>
              <h2>Three steps, most of it automatic</h2>
            </div>
          </Reveal>
          <div className="steps">
            {STEPS.map((s, i) => (
              <Reveal key={s.title} delay={i * 80}>
                <div className="step">
                  <div className="step-number">{i + 1}</div>
                  <h3>{s.title}</h3>
                  <p>{s.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <Reveal>
          <div className="landing-cta-band">
            <h2>Ready to stop retyping invoices?</h2>
            <p>Free to use while it&apos;s in development — no card required.</p>
            <Link href="/login?mode=signup" className="landing-btn landing-btn-white">Get started free</Link>
          </div>
        </Reveal>
      </section>

      <footer className="landing-footer">
        <span>© {new Date().getFullYear()} InvoiceFlow. Built with Next.js, FastAPI, Supabase and Gemini.</span>
        <div className="landing-footer-links">
          <a href="https://github.com/ambreen1038/invoiceflow" target="_blank" rel="noopener">
            View source on GitHub
          </a>
          <a href="mailto:ambreenhabib2002@gmail.com">Contact</a>
        </div>
      </footer>
    </>
  );
}
