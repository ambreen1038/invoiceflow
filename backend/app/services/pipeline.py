"""process_invoice() is queue-agnostic: every queue backend just decides when to call it."""
import logging
import uuid

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.models import Invoice, InvoiceItem
from app.services.extraction import Extractor
from app.services.storage import Storage
from app.services.validation import ExtractedInvoice, validate

log = logging.getLogger(__name__)


def apply_extraction(session: Session, invoice: Invoice, data: ExtractedInvoice) -> None:
    invoice.vendor = data.vendor
    invoice.invoice_number = data.invoice_number
    invoice.invoice_date = data.invoice_date
    invoice.currency = data.currency
    invoice.subtotal = data.subtotal
    invoice.tax = data.tax
    invoice.total = data.total
    invoice.items = [
        InvoiceItem(position=i, description=it.description, quantity=it.quantity,
                    unit_price=it.unit_price, amount=it.amount)
        for i, it in enumerate(data.items)
    ]
    issues = validate(data)
    invoice.is_duplicate = is_duplicate(session, invoice)
    if invoice.is_duplicate:
        issues.append({
            "field": "invoice_number", "code": "duplicate",
            "message": "An invoice with the same vendor, number and total already exists.",
        })
    invoice.issues = issues


def is_duplicate(session: Session, invoice: Invoice) -> bool:
    if not (invoice.vendor and invoice.invoice_number and invoice.total is not None):
        return False
    q = select(func.count()).select_from(Invoice).where(
        Invoice.user_id == invoice.user_id,
        Invoice.id != invoice.id,
        func.lower(Invoice.vendor) == invoice.vendor.lower(),
        Invoice.invoice_number == invoice.invoice_number,
        Invoice.total == invoice.total,
        Invoice.status.in_(("needs_review", "approved")),
    )
    return session.scalar(q) > 0


def process_invoice(
    invoice_id: uuid.UUID,
    storage: Storage,
    extractor: Extractor,
    session_factory=SessionLocal,
) -> None:
    """Download the file, extract, validate, save. Raises on failure so the queue can retry."""
    with session_factory() as session:
        invoice = session.get(Invoice, invoice_id)
        if invoice is None:
            log.warning("invoice %s vanished before processing", invoice_id)
            return
        invoice.status = "processing"
        session.commit()

        raw = extractor.extract(storage.read(invoice.storage_path), invoice.content_type)
        apply_extraction(session, invoice, ExtractedInvoice.model_validate(raw))
        invoice.status = "needs_review"
        invoice.error = None
        session.commit()


def mark_failed(invoice_id: uuid.UUID, error: str, session_factory=SessionLocal) -> None:
    with session_factory() as session:
        invoice = session.get(Invoice, invoice_id)
        if invoice is not None:
            invoice.status = "failed"
            invoice.error = error[:1000]
            session.commit()
