from app.core.config import Settings
from app.queue.base import JobQueue
from app.queue.postgres_queue import PostgresQueue
from app.services.extraction import build_extractor
from app.services.pipeline import process_invoice
from app.services.storage import build_storage


def build_queue(s: Settings) -> JobQueue:
    if s.queue_backend == "celery":
        from app.queue.celery_queue import CeleryQueue  # optional dependency

        return CeleryQueue()

    storage, extractor = build_storage(s), build_extractor(s)
    return PostgresQueue(
        process=lambda invoice_id: process_invoice(invoice_id, storage, extractor),
        poll_seconds=s.worker_poll_seconds,
        max_attempts=s.job_max_attempts,
        stale_seconds=s.job_stale_seconds,
    )
