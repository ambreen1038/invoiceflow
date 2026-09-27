"""Runs every sample in eval/data/ through the REAL extractor configured in .env (Gemini,
by default) and compares the result to the hand-written ground truth in eval/labels/.

This calls a real, metered API — it is a manual script, not part of the test suite or CI.

    cd backend && ../.venv/Scripts/python eval/run_eval.py

Writes eval/results.json (full detail) and prints the summary table that
docs/EVALUATION.md's Results section is filled in from.
"""
import json
import pathlib
import sys
import time
from decimal import Decimal

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent))

from app.core.config import get_settings  # noqa: E402
from app.services.extraction import ExtractionError, build_extractor  # noqa: E402
from app.services.validation import ExtractedInvoice, validate  # noqa: E402

HERE = pathlib.Path(__file__).parent
DATA, LABELS = HERE / "data", HERE / "labels"
CONTENT_TYPES = {".pdf": "application/pdf", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png"}
TOLERANCE = Decimal("0.02")
FIELDS = ["vendor", "invoice_number", "invoice_date", "currency", "subtotal", "tax", "total"]


def close(a, b) -> bool:
    try:
        return abs(Decimal(str(a)) - Decimal(str(b))) <= TOLERANCE
    except Exception:
        return False


def norm_text(v) -> str | None:
    return " ".join(str(v).split()).strip().lower() if v not in (None, "") else None


def field_correct(field: str, expected, got) -> bool:
    if expected is None:
        return got is None
    if got is None:
        return False
    if field in ("subtotal", "tax", "total"):
        return close(expected, got)
    if field in ("vendor", "currency"):
        return norm_text(expected) == norm_text(got)
    if field == "invoice_number":
        return norm_text(str(expected)) == norm_text(str(got))
    return str(expected).strip() == str(got).strip()


def items_correct(expected_items: list, got_items: list) -> tuple[int, int]:
    """Returns (matched, total) comparing amounts position-by-position."""
    total = max(len(expected_items), len(got_items))
    if total == 0:
        return 0, 0
    matched = 0
    for e, g in zip(expected_items, got_items):
        if close(e["amount"], g.get("amount")) if g.get("amount") is not None else False:
            matched += 1
    return matched, total


def extract_with_retry(extractor, raw_bytes, content_type, attempts=4):
    for i in range(attempts):
        try:
            return extractor.extract(raw_bytes, content_type)
        except ExtractionError as e:
            if "rate limited" in str(e).lower() and i < attempts - 1:
                wait = 15 * (i + 1)
                print(f"    rate limited, waiting {wait}s before retry {i + 2}/{attempts}...")
                time.sleep(wait)
                continue
            raise


def run():
    settings = get_settings()
    extractor = build_extractor(settings)
    print(f"Extractor: {settings.extractor} ({getattr(settings, settings.extractor + '_model', '?')})\n")

    label_files = sorted(LABELS.glob("*.json"))
    results = []

    for label_path in label_files:
        name = label_path.stem
        label = json.loads(label_path.read_text(encoding="utf-8"))
        data_path = next((p for p in DATA.glob(f"{name}.*")), None)
        if data_path is None:
            print(f"[skip] {name}: no matching file in eval/data/")
            continue

        content_type = CONTENT_TYPES[data_path.suffix.lower()]
        raw_bytes = data_path.read_bytes()
        row = {"name": name, "notes": label.get("notes", "")}

        try:
            raw = extract_with_retry(extractor, raw_bytes, content_type)
            parsed = ExtractedInvoice.model_validate(raw)
            issues = validate(parsed)
            got = parsed.model_dump(mode="json")

            field_results = {f: field_correct(f, label.get(f), got.get(f)) for f in FIELDS}
            matched_items, total_items = items_correct(label.get("items", []), got.get("items", []))
            doc_correct = all(field_results.values()) and matched_items == total_items

            row.update({
                "status": "ok",
                "fields": field_results,
                "items_matched": matched_items,
                "items_total": total_items,
                "doc_fully_correct": doc_correct,
                "issues_flagged": len(issues) > 0,
                "expects_issues": label.get("expects_issues", False),
                "is_invoice_label": label.get("is_invoice", True),
                "got": got,
            })
        except ExtractionError as e:
            row.update({"status": "extraction_error", "error": str(e),
                       "expects_issues": label.get("expects_issues", False),
                       "is_invoice_label": label.get("is_invoice", True)})
        except Exception as e:  # noqa: BLE001 — keep going through the rest of the set
            row.update({"status": "crash", "error": f"{type(e).__name__}: {e}",
                       "expects_issues": label.get("expects_issues", False),
                       "is_invoice_label": label.get("is_invoice", True)})

        results.append(row)
        print(f"{name:<24} {row['status']:<17} " + (
            f"doc_correct={row.get('doc_fully_correct')}" if row["status"] == "ok" else row.get("error", "")
        ))
        time.sleep(6)  # stay under the free tier's per-minute request limit

    (HERE / "results.json").write_text(json.dumps(results, indent=2), encoding="utf-8")
    summarize(results)


def summarize(results: list[dict]):
    ok = [r for r in results if r["status"] == "ok"]
    non_invoice_cases = [r for r in results if not r.get("is_invoice_label", True)]
    real_invoice_ok = [r for r in ok if r.get("is_invoice_label", True)]

    print("\n" + "=" * 60)
    print(f"Ran {len(results)} samples: {len(ok)} extracted, {len(results) - len(ok)} errored\n")

    print("Field accuracy (real-invoice samples only, n=%d):" % len(real_invoice_ok))
    for f in FIELDS:
        vals = [r["fields"][f] for r in real_invoice_ok if "fields" in r]
        if vals:
            print(f"  {f:<16} {sum(vals)}/{len(vals)}  ({100*sum(vals)/len(vals):.0f}%)")

    item_matched = sum(r["items_matched"] for r in real_invoice_ok)
    item_total = sum(r["items_total"] for r in real_invoice_ok)
    if item_total:
        print(f"  {'line items':<16} {item_matched}/{item_total}  ({100*item_matched/item_total:.0f}%)")

    fully = sum(1 for r in real_invoice_ok if r["doc_fully_correct"])
    print(f"\nDocuments fully correct: {fully}/{len(real_invoice_ok)}")

    should_flag = [r for r in ok if r.get("expects_issues") and r.get("is_invoice_label", True)]
    caught = sum(1 for r in should_flag if r["issues_flagged"])
    print(f"Injected problems caught by validation: {caught}/{len(should_flag)}")

    should_not_flag = [r for r in ok if not r.get("expects_issues") and r.get("is_invoice_label", True)]
    false_positives = sum(1 for r in should_not_flag if r["issues_flagged"])
    print(f"False positives on clean documents: {false_positives}/{len(should_not_flag)}")

    if non_invoice_cases:
        for r in non_invoice_cases:
            outcome = (
                "extraction error (rejected outright)" if r["status"] != "ok" else
                ("all fields null + flagged" if r.get("issues_flagged") and
                 all(v is None for v in r.get("got", {}).values() if not isinstance(v, list))
                 else "did NOT clearly reject — check results.json")
            )
            print(f"Non-invoice control ({r['name']}): {outcome}")


if __name__ == "__main__":
    run()
