"""Turn raw LLM output into a typed invoice and check that the numbers add up.

The arithmetic checks are the main defence against LLM mistakes: a model can
misread a digit, but it rarely misreads it in a way that still balances.
"""
import re
from datetime import date
from decimal import Decimal, InvalidOperation

from pydantic import BaseModel, Field, field_validator

TOLERANCE = Decimal("0.02")


def to_decimal(value) -> Decimal | None:
    if value is None or value == "":
        return None
    if isinstance(value, Decimal):
        return value
    if isinstance(value, (int, float)):
        return Decimal(str(value))
    cleaned = re.sub(r"[^\d.,\-]", "", str(value)).strip(".,")  # "Rs. 5" leaves a stray "."
    if not cleaned:
        return None
    if "," in cleaned and "." in cleaned:
        if cleaned.rfind(",") > cleaned.rfind("."):  # European style: 1.234,50
            cleaned = cleaned.replace(".", "").replace(",", ".")
        else:  # 1,234.50
            cleaned = cleaned.replace(",", "")
    elif "," in cleaned:
        head, _, tail = cleaned.rpartition(",")
        cleaned = head.replace(",", "") + ("." + tail if len(tail) <= 2 else tail)
    try:
        return Decimal(cleaned)
    except InvalidOperation:
        return None


class LineItem(BaseModel):
    description: str | None = None
    quantity: Decimal | None = None
    unit_price: Decimal | None = None
    amount: Decimal | None = None

    @field_validator("quantity", "unit_price", "amount", mode="before")
    @classmethod
    def _num(cls, v):
        return to_decimal(v)


class ExtractedInvoice(BaseModel):
    vendor: str | None = None
    invoice_number: str | None = None
    invoice_date: date | None = None
    currency: str | None = None
    subtotal: Decimal | None = None
    tax: Decimal | None = None
    total: Decimal | None = None
    items: list[LineItem] = Field(default_factory=list)
    # Defaults True: absent on a human's review-save payload, and on any extractor result
    # that predates this field, both of which should behave exactly as before.
    is_invoice: bool = True

    @field_validator("subtotal", "tax", "total", mode="before")
    @classmethod
    def _num(cls, v):
        return to_decimal(v)

    @field_validator("invoice_date", mode="before")
    @classmethod
    def _date(cls, v):
        if not v:
            return None
        try:
            return date.fromisoformat(str(v).strip()[:10])
        except ValueError:
            return None  # reported as a missing/unreadable date by validate()

    @field_validator("vendor", "invoice_number", "currency", mode="before")
    @classmethod
    def _str(cls, v):
        if v is None:
            return None
        v = str(v).strip()
        return v or None


def _close(a: Decimal, b: Decimal) -> bool:
    return abs(a - b) <= TOLERANCE


def validate(inv: ExtractedInvoice) -> list[dict]:
    """Return a list of {field, code, message}. Empty list means every check passed."""
    issues: list[dict] = []

    def add(field: str, code: str, message: str):
        issues.append({"field": field, "code": code, "message": message})

    if not inv.is_invoice:
        # One clear message beats four confusing "X is missing" flags on a blank form.
        add("_document", "not_invoice",
            "This doesn't look like an invoice or receipt. Delete it, or edit the fields in "
            "by hand below if it actually is one.")
        return issues

    for field, label in (("vendor", "Vendor"), ("invoice_date", "Date"), ("total", "Total")):
        if getattr(inv, field) is None:
            add(field, "missing", f"{label} is missing or unreadable.")
    if inv.invoice_number is None:
        add("invoice_number", "missing", "Invoice number is missing.")

    if inv.total is not None and inv.total <= 0:
        add("total", "non_positive", "Total must be greater than zero.")

    for i, item in enumerate(inv.items):
        if None not in (item.quantity, item.unit_price, item.amount):
            if not _close(item.quantity * item.unit_price, item.amount):
                add(
                    f"items.{i}.amount",
                    "line_math",
                    f"Line {i + 1}: {item.quantity} x {item.unit_price} "
                    f"= {item.quantity * item.unit_price}, but amount is {item.amount}.",
                )

    amounts = [it.amount for it in inv.items if it.amount is not None]
    if amounts:
        items_sum = sum(amounts, Decimal(0))
        if inv.subtotal is not None:
            if not _close(items_sum, inv.subtotal):
                add("subtotal", "items_sum",
                    f"Line items add up to {items_sum}, but subtotal is {inv.subtotal}.")
        elif inv.total is not None and inv.tax is not None:
            if not _close(items_sum + inv.tax, inv.total):
                add("total", "items_sum",
                    f"Line items ({items_sum}) + tax ({inv.tax}) != total ({inv.total}).")

    if None not in (inv.subtotal, inv.total):
        tax = inv.tax or Decimal(0)
        if not _close(inv.subtotal + tax, inv.total):
            add("total", "total_math",
                f"Subtotal ({inv.subtotal}) + tax ({tax}) = {inv.subtotal + tax}, "
                f"but total is {inv.total}.")

    return issues
