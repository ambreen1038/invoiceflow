"""Builds the synthetic evaluation set: a PDF/JPEG per case in eval/data/ and a matching
ground-truth label in eval/labels/. Every document here is made up for testing — see the
"Synthetic data disclosure" note in docs/EVALUATION.md. Run once with:

    cd backend && ../.venv/Scripts/python eval/build_samples.py

Requires Google Chrome (for HTML -> PDF/PNG) and Pillow (for the photo-style distortions).
"""
import json
import pathlib
import subprocess

HERE = pathlib.Path(__file__).parent
DATA = HERE / "data"
LABELS = HERE / "labels"
HTML_DIR = HERE / "html"

CHROME_CANDIDATES = [
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    "/usr/bin/google-chrome",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
]
CHROME = next((p for p in CHROME_CANDIDATES if pathlib.Path(p).exists()), None)
if not CHROME:
    raise SystemExit("Chrome not found — edit CHROME_CANDIDATES in this file")

CSS = """
* { box-sizing: border-box; font-family: Arial, Helvetica, sans-serif; }
body { margin: 0; padding: 48px 52px; color: #1a1d24; background: #fff; }
.head { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #1a1d24; padding-bottom: 16px; }
.brand { font-size: 21px; font-weight: 800; }
.brand small { display: block; font-weight: 400; font-size: 11px; color: #666; margin-top: 3px; }
.doc-title h1 { margin: 0; font-size: 22px; letter-spacing: 2px; color: #444; text-align: right; }
.meta { display: flex; justify-content: space-between; margin-top: 22px; font-size: 12.5px; }
.meta .label { color: #888; }
table { width: 100%; border-collapse: collapse; margin-top: 26px; font-size: 12.5px; }
th { text-align: left; background: #f3f4f7; padding: 8px 10px; font-size: 10.5px; text-transform: uppercase; color: #555; }
td { padding: 8px 10px; border-bottom: 1px solid #eceef2; }
td.num, th.num { text-align: right; }
.totals { margin-top: 4px; width: 260px; margin-left: auto; font-size: 12.5px; }
.totals div { display: flex; justify-content: space-between; padding: 6px 10px; }
.totals .grand { border-top: 2px solid #1a1d24; font-weight: 800; font-size: 14px; margin-top: 4px; }
.foot { margin-top: 40px; font-size: 11px; color: #888; border-top: 1px solid #eceef2; padding-top: 12px; }
"""

RECEIPT_CSS = """
* { box-sizing: border-box; font-family: 'Courier New', monospace; }
body { margin: 0; padding: 20px 16px; width: 320px; color: #111; background: #fff; }
h1 { font-size: 15px; text-align: center; margin: 0 0 2px; }
.sub { text-align: center; font-size: 10px; color: #444; margin-bottom: 10px; }
.line { border-top: 1px dashed #999; margin: 8px 0; }
table { width: 100%; font-size: 11px; border-collapse: collapse; }
td { padding: 2px 0; }
td.num { text-align: right; }
.totals div { display: flex; justify-content: space-between; font-size: 12px; padding: 2px 0; }
.totals .grand { font-weight: 700; border-top: 1px dashed #999; margin-top: 4px; padding-top: 4px; }
.foot { text-align: center; font-size: 10px; margin-top: 14px; color: #555; }
"""


def money(n: float) -> str:
    return f"{n:,.2f}"


def invoice_html(
    vendor, tagline, invoice_number, date, bill_to, items, currency_symbol, tax_rate,
    show_zero_tax=False, printed_total=None,
):
    subtotal = sum(q * p for q, p, _ in items)
    tax = round(subtotal * tax_rate, 2) if tax_rate else (0.0 if show_zero_tax else None)
    total = printed_total if printed_total is not None else subtotal + (tax or 0)

    rows = "".join(
        f"<tr><td>{desc}</td><td class='num'>{q:g}</td>"
        f"<td class='num'>{currency_symbol}{money(p)}</td><td class='num'>{currency_symbol}{money(q*p)}</td></tr>"
        for q, p, desc in items
    )
    inv_no_row = (
        f"<div><span class='label'>Invoice #:</span> <strong>{invoice_number}</strong></div>"
        if invoice_number else ""
    )
    tax_row = f"<div><span>Tax ({tax_rate*100:.0f}%)</span><span>{currency_symbol}{money(tax)}</span></div>" if tax_rate else (
        f"<div><span>Tax</span><span>{currency_symbol}{money(0)}</span></div>" if show_zero_tax else ""
    )
    subtotal_row = f"<div><span>Subtotal</span><span>{currency_symbol}{money(subtotal)}</span></div>"

    return f"""<!DOCTYPE html><html><head><meta charset="utf-8"><style>{CSS}</style></head><body>
  <div class="head">
    <div class="brand">{vendor}<small>{tagline}</small></div>
    <div class="doc-title"><h1>INVOICE</h1></div>
  </div>
  <div class="meta">
    <div>{inv_no_row}<div><span class="label">Date:</span> <strong>{date}</strong></div></div>
    <div><div><span class="label">Bill to:</span> <strong>{bill_to}</strong></div></div>
  </div>
  <table>
    <thead><tr><th>Description</th><th class="num">Qty</th><th class="num">Unit price</th><th class="num">Amount</th></tr></thead>
    <tbody>{rows}</tbody>
  </table>
  <div class="totals">
    {subtotal_row}
    {tax_row}
    <div class="grand"><span>Total</span><span>{currency_symbol}{money(total)}</span></div>
  </div>
  <div class="foot">Thank you for your business.</div>
</body></html>"""


def receipt_html(vendor, invoice_number, date, items, currency_symbol, tax_rate):
    subtotal = sum(q * p for q, p, _ in items)
    tax = round(subtotal * tax_rate, 2)
    total = subtotal + tax
    rows = "".join(
        f"<tr><td colspan=2>{desc}</td></tr><tr><td>{q:g} x {currency_symbol}{money(p)}</td>"
        f"<td class='num'>{currency_symbol}{money(q*p)}</td></tr>"
        for q, p, desc in items
    )
    return f"""<!DOCTYPE html><html><head><meta charset="utf-8"><style>{RECEIPT_CSS}</style></head><body>
  <h1>{vendor}</h1>
  <div class="sub">Receipt {invoice_number} &middot; {date}</div>
  <div class="line"></div>
  <table>{rows}</table>
  <div class="line"></div>
  <div class="totals">
    <div><span>Subtotal</span><span>{currency_symbol}{money(subtotal)}</span></div>
    <div><span>Tax ({tax_rate*100:.0f}%)</span><span>{currency_symbol}{money(tax)}</span></div>
    <div class="grand"><span>Total</span><span>{currency_symbol}{money(total)}</span></div>
  </div>
  <div class="foot">Thanks for shopping with us!</div>
</body></html>"""


def not_an_invoice_html():
    return """<!DOCTYPE html><html><head><meta charset="utf-8"><style>
      body{font-family:Arial;padding:60px;color:#222}
      h1{font-size:20px} li{margin-bottom:6px;font-size:13px}
    </style></head><body>
      <h1>Weekly team sync — notes</h1>
      <p>Attendees: Sara, Ahmed, Bilal</p>
      <ul>
        <li>Reviewed sprint progress, on track for Friday demo.</li>
        <li>Bilal to follow up with design on the onboarding flow.</li>
        <li>Next sync moved to Thursday 3pm.</li>
      </ul>
    </body></html>"""


def to_win_path(p: pathlib.Path) -> str:
    return str(p.resolve()).replace("\\", "/")


def html_to_pdf(html_path: pathlib.Path, pdf_path: pathlib.Path):
    subprocess.run(
        [CHROME, "--headless", "--disable-gpu", "--no-pdf-header-footer",
         f"--print-to-pdf={to_win_path(pdf_path)}", f"file:///{to_win_path(html_path)}",
         "--virtual-time-budget=2000"],
        check=True, capture_output=True,
    )


def html_to_png(html_path: pathlib.Path, png_path: pathlib.Path, width=900, height=1160):
    subprocess.run(
        [CHROME, "--headless", "--disable-gpu", f"--window-size={width},{height}",
         f"--screenshot={to_win_path(png_path)}", f"file:///{to_win_path(html_path)}",
         "--virtual-time-budget=2000", "--hide-scrollbars"],
        check=True, capture_output=True,
    )


def make_photo(png_path: pathlib.Path, jpeg_path: pathlib.Path, rotate=0.0, blur=0, noise=0):
    from PIL import Image, ImageFilter
    import random

    img = Image.open(png_path).convert("RGB")
    if rotate:
        img = img.rotate(rotate, expand=True, fillcolor=(235, 236, 240))
    if blur:
        img = img.filter(ImageFilter.GaussianBlur(blur))
    if noise:
        px = img.load()
        w, h = img.size
        random.seed(7)
        for _ in range(noise):
            x, y = random.randrange(w), random.randrange(h)
            r, g, b = px[x, y]
            d = random.randint(-25, 25)
            px[x, y] = (max(0, min(255, r + d)), max(0, min(255, g + d)), max(0, min(255, b + d)))
    img.save(jpeg_path, "JPEG", quality=72)


def write_label(name: str, label: dict):
    (LABELS / f"{name}.json").write_text(json.dumps(label, indent=2), encoding="utf-8")


def label_from(vendor, invoice_number, date, currency, items, tax, printed_total=None, **extra):
    subtotal = round(sum(q * p for q, p, _ in items), 2)
    total = printed_total if printed_total is not None else round(subtotal + (tax or 0), 2)
    label = {
        "vendor": vendor,
        "invoice_number": invoice_number,
        "invoice_date": date,
        "currency": currency,
        "subtotal": subtotal,
        "tax": tax,
        "total": total,
        "items": [
            {"description": d, "quantity": q, "unit_price": p, "amount": round(q * p, 2)}
            for q, p, d in items
        ],
        "expects_issues": False,
        "is_invoice": True,
    }
    label.update(extra)
    return label


def build():
    DATA.mkdir(exist_ok=True)
    LABELS.mkdir(exist_ok=True)
    HTML_DIR.mkdir(exist_ok=True)
    made = []

    def emit_pdf(name, html):
        html_path = HTML_DIR / f"{name}.html"
        html_path.write_text(html, encoding="utf-8")
        html_to_pdf(html_path, DATA / f"{name}.pdf")
        made.append(name)

    # 1. clean_standard — baseline: everything present and consistent.
    items = [(40, 180, "USB-C charging cable, 1m"), (15, 950, "Wireless mouse, black"), (25, 420, "HDMI cable, 2m")]
    emit_pdf("clean_standard", invoice_html(
        "Al-Rehman Traders", "Wholesale Electronics, Lahore", "INV-3001", "2026-02-10",
        "Habib General Store", items, "PKR ", 0.17))
    write_label("clean_standard", label_from(
        "Al-Rehman Traders", "INV-3001", "2026-02-10", "PKR", items, 0.17 * sum(q * p for q, p, _ in items),
        notes="Baseline: standard formal invoice, nothing unusual."))

    # 2. math_error_total — printed total is wrong; tests whether OUR CHECKS catch it
    #    (this is not an extraction-accuracy case: a perfect reader should transcribe the
    #    wrong number exactly as printed, and our arithmetic check should then flag it).
    items2 = items
    emit_pdf("math_error_total", invoice_html(
        "Al-Rehman Traders", "Wholesale Electronics, Lahore", "INV-3002", "2026-02-10",
        "Habib General Store", items2, "PKR ", 0.17, printed_total=38500.00))
    write_label("math_error_total", label_from(
        "Al-Rehman Traders", "INV-3002", "2026-02-10", "PKR", items2, 0.17 * sum(q * p for q, p, _ in items2),
        printed_total=38500.00, expects_issues=True,
        notes="Printed total is deliberately wrong; extraction should match the PRINTED (wrong) "
              "number, and validate() should flag it."))

    # 3. no_tax — no tax line at all; subtotal == total.
    items3 = [(3, 4500, "Office chair"), (1, 12000, "Standing desk")]
    emit_pdf("no_tax", invoice_html(
        "Bright Bakes Cafe Supplies", "Kitchen & Cafe Equipment", "BB-118", "2026-02-11",
        "Bright Bakes Cafe", items3, "PKR ", tax_rate=None))
    write_label("no_tax", label_from(
        "Bright Bakes Cafe Supplies", "BB-118", "2026-02-11", "PKR", items3, tax=None,
        notes="No tax line printed at all; tax should extract as null, subtotal == total."))

    # 4. many_items — 9 line items, tests longer tables.
    items4 = [(q, p, d) for q, p, d in [
        (2, 1200, "Ream of A4 paper"), (10, 25, "Ballpoint pens, blue"), (5, 60, "Highlighters"),
        (3, 350, "Stapler"), (20, 8, "Sticky notes pad"), (2, 900, "Whiteboard marker set"),
        (1, 4500, "Office chair mat"), (4, 220, "File folders, box of 10"), (6, 75, "Notebooks, A5"),
    ]]
    emit_pdf("many_items", invoice_html(
        "Lahore Hardware Mart", "Office & Stationery Supplies", "LHM-9910", "2026-02-12",
        "Creative Studio Pvt Ltd", items4, "PKR ", 0.17))
    write_label("many_items", label_from(
        "Lahore Hardware Mart", "LHM-9910", "2026-02-12", "PKR", items4, 0.17 * sum(q * p for q, p, _ in items4),
        notes="9 line items — tests whether the model reads the whole table, not just the top rows."))

    # 5. receipt_narrow — thermal-receipt style layout, narrow width, monospace.
    items5 = [(2, 350, "Cappuccino"), (1, 550, "Club sandwich"), (3, 120, "Bottled water")]
    html_path = HTML_DIR / "receipt_narrow.html"
    html_path.write_text(receipt_html("QuickBite Cafe", "RCPT-5581", "2026-02-13", items5, "PKR ", 0.05), encoding="utf-8")
    html_to_pdf(html_path, DATA / "receipt_narrow.pdf")
    write_label("receipt_narrow", label_from(
        "QuickBite Cafe", "RCPT-5581", "2026-02-13", "PKR", items5, 0.05 * sum(q * p for q, p, _ in items5),
        notes="Narrow thermal-receipt layout instead of a formal invoice."))

    # 6. currency_usd — different currency, $ symbol.
    items6 = [(4, 89.5, "USB hub, 7-port"), (2, 145.0, "Laptop stand")]
    emit_pdf("currency_usd", invoice_html(
        "Silverline Tech Supplies", "Computer Accessories, Austin TX", "STS-2200", "2026-02-14",
        "Meridian Consulting LLC", items6, "$", 0.08))
    write_label("currency_usd", label_from(
        "Silverline Tech Supplies", "STS-2200", "2026-02-14", "USD", items6, 0.08 * sum(q * p for q, p, _ in items6),
        notes="USD with a $ symbol instead of PKR — tests currency-code inference."))

    # 7. missing_invoice_number — no invoice number printed anywhere.
    items7 = [(10, 60, "Cotton t-shirt, plain"), (5, 40, "Tote bag")]
    emit_pdf("missing_invoice_number", invoice_html(
        "Falcon Traders", "General Merchandise", None, "2026-02-15",
        "Falcon Traders", items7, "PKR ", 0.17))
    write_label("missing_invoice_number", label_from(
        "Falcon Traders", None, "2026-02-15", "PKR", items7, 0.17 * sum(q * p for q, p, _ in items7),
        expects_issues=True,
        notes="No invoice number printed on the document at all — should extract as null and "
              "our completeness check should flag the missing field, not have the model invent one."))

    # 8. blurry_scan — same content as clean_standard, rendered then blurred/noised to
    #    simulate a bad phone scan.
    items8 = [(2, 6500, "Ceiling fan, 56 inch"), (1, 3200, "LED bulb pack of 6")]
    html_p = HTML_DIR / "blurry_scan.html"
    html_p.write_text(invoice_html(
        "Zaman Electric Store", "Fans, Lights & Wiring", "ZES-441", "2026-02-16",
        "Rana Residency", items8, "PKR ", 0.17), encoding="utf-8")
    png_p = HTML_DIR / "blurry_scan.png"
    html_to_png(html_p, png_p, width=900, height=650)
    make_photo(png_p, DATA / "blurry_scan.jpg", rotate=0, blur=2.2, noise=6000)
    write_label("blurry_scan", label_from(
        "Zaman Electric Store", "ZES-441", "2026-02-16", "PKR", items8, 0.17 * sum(q * p for q, p, _ in items8),
        notes="Same as a clean invoice but rendered with blur + noise to simulate a poor scan."))

    # 9. rotated_photo — simulates a slightly crooked phone photo of a printed invoice.
    items9 = [(6, 1500, "Car floor mats, set of 4"), (1, 8200, "Dashboard camera")]
    html_p = HTML_DIR / "rotated_photo.html"
    html_p.write_text(invoice_html(
        "Zaman Auto Parts", "Auto Accessories, Gujranwala", "ZAP-770", "2026-02-17",
        "Walk-in Customer", items9, "PKR ", 0.17), encoding="utf-8")
    png_p = HTML_DIR / "rotated_photo.png"
    html_to_png(html_p, png_p, width=900, height=650)
    make_photo(png_p, DATA / "rotated_photo.jpg", rotate=4.5, blur=0.6, noise=2500)
    write_label("rotated_photo", label_from(
        "Zaman Auto Parts", "ZAP-770", "2026-02-17", "PKR", items9, 0.17 * sum(q * p for q, p, _ in items9),
        notes="Rotated ~4.5deg and JPEG-compressed to simulate a phone photo, not a flat scan."))

    # 10. non_invoice_photo — negative control: not an invoice at all.
    html_p = HTML_DIR / "non_invoice_photo.html"
    html_p.write_text(not_an_invoice_html(), encoding="utf-8")
    html_to_pdf(html_p, DATA / "non_invoice_photo.pdf")
    write_label("non_invoice_photo", {
        "vendor": None, "invoice_number": None, "invoice_date": None, "currency": None,
        "subtotal": None, "tax": None, "total": None, "items": [],
        "is_invoice": False, "expects_issues": True,
        "notes": "Not an invoice at all (meeting notes) — negative control. A good result is "
                 "everything null / flagged, NOT a hallucinated invoice.",
    })

    # 11. single_item — minimal invoice, one line, no tax.
    items11 = [(1, 25000, "Annual software licence, 1 seat")]
    emit_pdf("single_item", invoice_html(
        "Omni Software Pvt Ltd", "B2B Licensing", "OMN-11", "2026-02-18",
        "Junaid Malik", items11, "PKR ", tax_rate=None))
    write_label("single_item", label_from(
        "Omni Software Pvt Ltd", "OMN-11", "2026-02-18", "PKR", items11, tax=None,
        notes="Minimal case: a single line item and no tax at all."))

    # 12. explicit_zero_tax — tax line is printed and explicitly "0.00", not omitted.
    items12 = [(2, 3300, "Yoga mat, premium"), (1, 1800, "Resistance band set")]
    emit_pdf("explicit_zero_tax", invoice_html(
        "Green Leaf Wellness", "Fitness Equipment", "GLW-405", "2026-02-19",
        "Ayesha Noor", items12, "PKR ", tax_rate=None, show_zero_tax=True))
    write_label("explicit_zero_tax", label_from(
        "Green Leaf Wellness", "GLW-405", "2026-02-19", "PKR", items12, tax=0.0,
        notes="Tax line is printed and explicitly 0.00, not left off the document — tests null "
              "(no line) vs explicit-zero handling."))

    print(f"Built {len(made)} PDF cases + 4 image/receipt/negative cases -> {DATA}")
    print("data files:", sorted(p.name for p in DATA.glob("*")))
    print("label files:", sorted(p.name for p in LABELS.glob("*")))


if __name__ == "__main__":
    build()
