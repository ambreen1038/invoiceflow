import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field

from app.services.validation import LineItem


class ItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    description: str | None
    quantity: float | None
    unit_price: float | None
    amount: float | None


class InvoiceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    filename: str
    status: str
    vendor: str | None
    invoice_number: str | None
    invoice_date: date | None
    currency: str | None
    subtotal: float | None
    tax: float | None
    total: float | None
    items: list[ItemOut]
    issues: list[dict]
    is_duplicate: bool
    error: str | None
    created_at: datetime
    updated_at: datetime


class InvoiceUpdate(BaseModel):
    """Reviewer's corrected values. Re-validated server-side on every save."""

    vendor: str | None = None
    invoice_number: str | None = None
    invoice_date: date | None = None
    currency: str | None = None
    subtotal: float | None = None
    tax: float | None = None
    total: float | None = None
    items: list[LineItem] = Field(default_factory=list)
    approve: bool = False
    acknowledge_issues: bool = False  # required to approve while checks still fail
