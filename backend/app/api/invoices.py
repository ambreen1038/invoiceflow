import csv
import io
import re
import uuid

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile, status
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.schemas import InvoiceOut, InvoiceUpdate
from app.core.auth import current_user_id
from app.core.config import get_settings
from app.db.session import get_db
from app.models import Invoice
from app.services.pipeline import apply_extraction
from app.services.validation import ExtractedInvoice

router = APIRouter(prefix="/invoices", tags=["invoices"])

ALLOWED_TYPES = {
    "application/pdf": ".pdf",
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/webp": ".webp",
}
MAGIC = {
    "application/pdf": (b"%PDF",),
    "image/png": (b"\x89PNG",),
    "image/jpeg": (b"\xff\xd8\xff",),
    "image/webp": (b"RIFF",),
}


def _get_owned(db: Session, invoice_id: uuid.UUID, user_id: uuid.UUID) -> Invoice:
    inv = db.get(Invoice, invoice_id)
    if inv is None or inv.user_id != user_id:  # same 404 for "not yours" and "not there"
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Invoice not found")
    return inv


def _safe_name(name: str) -> str:
    return re.sub(r"[^A-Za-z0-9._-]", "_", name)[:120] or "file"


@router.post("", response_model=list[InvoiceOut], status_code=status.HTTP_201_CREATED)
async def upload(
    request: Request,
    files: list[UploadFile] = File(...),
    db: Session = Depends(get_db),
    user_id: uuid.UUID = Depends(current_user_id),
):
    settings = get_settings()
    limit = settings.max_upload_mb * 1024 * 1024
    if not 1 <= len(files) <= 20:
        raise HTTPException(400, "Upload between 1 and 20 files at a time")

    prepared = []
    for f in files:
        data = await f.read(limit + 1)
        if len(data) > limit:
            raise HTTPException(413, f"{f.filename}: larger than {settings.max_upload_mb} MB")
        ctype = f.content_type or ""
        if ctype not in ALLOWED_TYPES or not data.startswith(MAGIC[ctype]):
            raise HTTPException(415, f"{f.filename}: only PDF, PNG, JPEG or WebP files")
        prepared.append((f.filename or "file", ctype, data))

    storage, queue = request.app.state.storage, request.app.state.queue
    created = []
    for name, ctype, data in prepared:
        inv_id = uuid.uuid4()
        path = f"{user_id}/{inv_id}{ALLOWED_TYPES[ctype]}"
        storage.save(path, data, ctype)
        inv = Invoice(id=inv_id, user_id=user_id, filename=_safe_name(name),
                      storage_path=path, content_type=ctype, status="queued", issues=[])
        db.add(inv)
        db.flush()
        queue.enqueue(inv.id, db)
        created.append(inv)
    db.commit()
    return created


@router.get("", response_model=list[InvoiceOut])
def list_invoices(
    status_filter: str | None = None,
    db: Session = Depends(get_db),
    user_id: uuid.UUID = Depends(current_user_id),
):
    q = select(Invoice).where(Invoice.user_id == user_id).order_by(Invoice.created_at.desc())
    if status_filter:
        q = q.where(Invoice.status == status_filter)
    return db.scalars(q.limit(200)).all()


def _csv_cell(value) -> str:
    text = "" if value is None else str(value)
    # Spreadsheet formula injection: a vendor named "=HYPERLINK(...)" must stay text.
    return "'" + text if text[:1] in ("=", "+", "-", "@", "\t", "\r") else text


@router.get("/export.csv")
def export_csv(
    db: Session = Depends(get_db),
    user_id: uuid.UUID = Depends(current_user_id),
):
    rows = db.scalars(
        select(Invoice)
        .where(Invoice.user_id == user_id, Invoice.status == "approved")
        .order_by(Invoice.invoice_date, Invoice.created_at)
    ).all()
    out = io.StringIO()
    w = csv.writer(out)
    w.writerow(["vendor", "invoice_number", "date", "currency", "subtotal", "tax", "total"])
    for inv in rows:
        w.writerow([
            _csv_cell(inv.vendor), _csv_cell(inv.invoice_number), inv.invoice_date,
            _csv_cell(inv.currency), inv.subtotal, inv.tax, inv.total,
        ])  # only free-text columns need the guard; numbers may legitimately be negative
    return Response(
        out.getvalue(), media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="invoices.csv"'},
    )


@router.get("/{invoice_id}", response_model=InvoiceOut)
def get_invoice(invoice_id: uuid.UUID, db: Session = Depends(get_db),
                user_id: uuid.UUID = Depends(current_user_id)):
    return _get_owned(db, invoice_id, user_id)


@router.get("/{invoice_id}/file")
def get_file(invoice_id: uuid.UUID, request: Request, db: Session = Depends(get_db),
             user_id: uuid.UUID = Depends(current_user_id)):
    inv = _get_owned(db, invoice_id, user_id)
    return Response(request.app.state.storage.read(inv.storage_path),
                    media_type=inv.content_type,
                    headers={"Content-Disposition": "inline"})


@router.put("/{invoice_id}", response_model=InvoiceOut)
def review(invoice_id: uuid.UUID, body: InvoiceUpdate, db: Session = Depends(get_db),
           user_id: uuid.UUID = Depends(current_user_id)):
    inv = _get_owned(db, invoice_id, user_id)
    if inv.status in ("queued", "processing"):
        raise HTTPException(409, "Invoice is still being processed")

    data = ExtractedInvoice.model_validate(body.model_dump())
    apply_extraction(db, inv, data)  # re-runs validation + duplicate check on the edits
    if body.approve:
        if inv.issues and not body.acknowledge_issues:
            raise HTTPException(422, {"message": "Unresolved issues", "issues": inv.issues})
        inv.status = "approved"
    else:
        inv.status = "needs_review"
    db.commit()
    return inv


@router.post("/{invoice_id}/retry", response_model=InvoiceOut)
def retry(invoice_id: uuid.UUID, request: Request, db: Session = Depends(get_db),
          user_id: uuid.UUID = Depends(current_user_id)):
    inv = _get_owned(db, invoice_id, user_id)
    if inv.status != "failed":
        raise HTTPException(409, "Only failed invoices can be retried")
    inv.status, inv.error = "queued", None
    request.app.state.queue.enqueue(inv.id, db)
    db.commit()
    return inv


@router.delete("/{invoice_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete(invoice_id: uuid.UUID, request: Request, db: Session = Depends(get_db),
           user_id: uuid.UUID = Depends(current_user_id)):
    inv = _get_owned(db, invoice_id, user_id)
    path = inv.storage_path
    db.delete(inv)
    db.commit()
    request.app.state.storage.delete(path)
