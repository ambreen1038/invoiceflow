/** The InvoiceFlow mark: a document with a folded corner and a checkmark badge — "a document
 * that's been checked." One shared source instead of the near-identical inline SVG that used
 * to be copy-pasted into the sidebar, the landing nav, and both auth pages.
 *
 * Deliberately minimal — no internal line-item strokes — so it stays crisp and reads instantly
 * at the small sizes (17–20px) every one of its call sites actually uses it at, rather than
 * trying to cram in detail that just turns to noise that small. The badge is a solid white
 * circle with the checkmark in brand blue (not a background-matching "cutout"), so it drops
 * cleanly onto any badge background — solid, gradient, or the login page's frosted glass. */
export default function Logo({
  size = 20,
  accent = "#2f5bea",
  className,
}: {
  size?: number;
  accent?: string;
  className?: string;
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M7.5 3h6.5L18.5 7.5V19.5a1.2 1.2 0 0 1-1.2 1.2H7.5a1.2 1.2 0 0 1-1.2-1.2V4.2A1.2 1.2 0 0 1 7.5 3Z"
        stroke="white"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path d="M14 3v4.3a1 1 0 0 0 1 1h3.5" stroke="white" strokeWidth="1.7" strokeLinejoin="round" />
      <circle cx="16.6" cy="16.8" r="4.6" fill="white" />
      <path
        d="M14.7 16.9l1.2 1.2 2.3-2.6"
        stroke={accent}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
