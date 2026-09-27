from decimal import Decimal

from app.services.validation import ExtractedInvoice, to_decimal, validate

GOOD = {
    "vendor": "Acme", "invoice_number": "A-1", "invoice_date": "2026-02-01", "currency": "PKR",
    "subtotal": 1000, "tax": 170, "total": 1170,
    "items": [{"description": "x", "quantity": 2, "unit_price": 500, "amount": 1000}],
}


def codes(data):
    return {(i["field"], i["code"]) for i in validate(ExtractedInvoice.model_validate(data))}


def test_clean_invoice_has_no_issues():
    assert codes(GOOD) == set()


def test_total_math_mismatch_is_flagged():
    assert ("total", "total_math") in codes({**GOOD, "total": 1270})


def test_line_math_mismatch_is_flagged():
    bad = {**GOOD, "items": [{"description": "x", "quantity": 2, "unit_price": 500, "amount": 900}]}
    assert ("items.0.amount", "line_math") in codes(bad)


def test_items_not_matching_subtotal_is_flagged():
    bad = {**GOOD, "subtotal": 1100, "total": 1270}
    assert ("subtotal", "items_sum") in codes(bad)


def test_missing_fields_are_flagged():
    got = codes({"total": 50})
    assert {("vendor", "missing"), ("invoice_date", "missing"),
            ("invoice_number", "missing")} <= got


def test_unreadable_date_becomes_missing():
    assert ("invoice_date", "missing") in codes({**GOOD, "invoice_date": "sometime in May"})


def test_tolerance_allows_rounding():
    assert codes({**GOOD, "total": 1170.01}) == set()


def test_non_positive_total():
    assert ("total", "non_positive") in codes({**GOOD, "subtotal": None, "items": [], "total": 0})


def test_to_decimal_handles_messy_numbers():
    assert to_decimal("Rs. 1,234.50") == Decimal("1234.50")
    assert to_decimal("1.234,50") == Decimal("1234.50")
    assert to_decimal("PKR 2,500") == Decimal("2500")
    assert to_decimal("n/a") is None
    assert to_decimal(None) is None
