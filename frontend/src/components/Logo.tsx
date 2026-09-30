/* eslint-disable @next/next/no-img-element */

/** The InvoiceFlow mark — a real image (public/logo.png), not a hand-drawn SVG. It's a
 * self-contained, fully-colored icon (not a white-on-color glyph like the mark it replaced), so
 * it's meant to sit directly on a page's own background rather than inside another colored
 * badge box — call sites should size it, not wrap it. */
export default function Logo({
  size = 28,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <img
      src="/logo.png"
      alt="InvoiceFlow"
      width={size}
      height={size}
      className={className}
      style={{ width: size, height: size, objectFit: "contain", flex: "none" }}
    />
  );
}
