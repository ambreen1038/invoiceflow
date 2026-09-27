"""Optional Celery + Redis backend. Same process_invoice(), different scheduler.

Run the worker with:  celery -A app.queue.celery_queue.celery_app worker -l info
Requires: pip install -r requirements-celery.txt   and   QUEUE_BACKEND=celery
"""
import uuid

from sqlalchemy import event
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.services.extraction import build_extractor
from app.services.pipeline import mark_failed, process_invoice
from app.services.storage import build_storage

try:
    from celery import Celery
except ImportError as exc:  # pragma: no cover
    raise RuntimeError("Celery backend needs: pip install -r requirements-celery.txt") from exc

settings = get_settings()
celery_app = Celery("invoiceflow", broker=settings.redis_url, backend=settings.redis_url)
celery_app.conf.task_acks_late = True  # a crashed worker's task is redelivered


@celery_app.task(bind=True, name="invoiceflow.process_invoice",
                 max_retries=settings.job_max_attempts - 1)
def process_invoice_task(self, invoice_id: str) -> None:
    s = get_settings()
    try:
        process_invoice(uuid.UUID(invoice_id), build_storage(s), build_extractor(s))
    except Exception as exc:  # noqa: BLE001
        if self.request.retries >= self.max_retries:
            mark_failed(uuid.UUID(invoice_id), str(exc))
            raise
        raise self.retry(exc=exc, countdown=2 ** (self.request.retries + 1) * 5) from exc


class CeleryQueue:
    def enqueue(self, invoice_id: uuid.UUID, session: Session) -> None:
        # Send only after the invoice row is committed, or the worker may not find it.
        event.listen(
            session, "after_commit",
            lambda _s: process_invoice_task.delay(str(invoice_id)),
            once=True,
        )

    def start(self) -> None:  # workers are separate processes
        pass

    def stop(self) -> None:
        pass
