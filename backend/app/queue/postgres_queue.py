"""A job queue on plain Postgres: one `jobs` table, claimed with FOR UPDATE SKIP LOCKED.

Why this works: SKIP LOCKED lets several workers poll the same table without blocking
each other or claiming the same row. The job row is inserted in the same transaction as
the invoice, so an invoice can never exist without its job.
"""
import logging
import threading
import uuid
from datetime import timedelta

import sentry_sdk
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.db.session import SessionLocal, utcnow
from app.models import Invoice, Job
from app.services.pipeline import mark_failed

log = logging.getLogger(__name__)


def backoff_seconds(attempt: int) -> int:
    return min(2 ** attempt * 5, 300)  # 10s, 20s, 40s ... capped at 5 min


class PostgresQueue:
    def __init__(self, process, session_factory=SessionLocal, poll_seconds: float = 2.0,
                 max_attempts: int = 3, stale_seconds: int = 300):
        self.process = process  # callable(invoice_id) -> None, raises on failure
        self.session_factory = session_factory
        self.poll_seconds = poll_seconds
        self.max_attempts = max_attempts
        self.stale_seconds = stale_seconds
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None

    # -- producer side ---------------------------------------------------------
    def enqueue(self, invoice_id: uuid.UUID, session: Session) -> None:
        session.add(Job(invoice_id=invoice_id))

    # -- consumer side ---------------------------------------------------------
    def recover_stale(self) -> int:
        """Jobs stuck in 'processing' (worker crashed / service restarted) go back to pending."""
        cutoff = utcnow() - timedelta(seconds=self.stale_seconds)
        with self.session_factory() as s:
            res = s.execute(
                update(Job)
                .where(Job.status == "processing", Job.locked_at < cutoff)
                .values(status="pending", locked_at=None)
            )
            s.commit()
            return res.rowcount or 0

    def run_once(self) -> bool:
        """Claim and run at most one job. Returns False when the queue is empty."""
        with self.session_factory() as s:
            job = s.scalars(
                select(Job)
                .where(Job.status == "pending", Job.run_at <= utcnow())
                .order_by(Job.run_at, Job.id)
                .limit(1)
                .with_for_update(skip_locked=True)
            ).first()
            if job is None:
                return False
            job.status = "processing"
            job.attempts += 1
            job.locked_at = utcnow()
            job_id, invoice_id, attempts = job.id, job.invoice_id, job.attempts
            s.commit()

        try:
            self.process(invoice_id)
        except Exception as exc:  # noqa: BLE001 - any failure is retried or recorded
            log.warning("job %s attempt %s failed: %s", job_id, attempts, exc)
            self._on_failure(job_id, invoice_id, attempts, str(exc), exc)
        else:
            with self.session_factory() as s:
                s.execute(
                    update(Job).where(Job.id == job_id).values(status="done", last_error=None)
                )
                s.commit()
        return True

    def _on_failure(
        self, job_id: int, invoice_id: uuid.UUID, attempts: int, error: str, exc: Exception
    ) -> None:
        final = attempts >= self.max_attempts
        with self.session_factory() as s:
            values = {"last_error": error[:1000], "locked_at": None}
            if final:
                values["status"] = "failed"
            else:
                values["status"] = "pending"
                values["run_at"] = utcnow() + timedelta(seconds=backoff_seconds(attempts))
                # keep the invoice visibly "queued" while it waits for the retry
                s.execute(update(Invoice).where(Invoice.id == invoice_id).values(status="queued"))
            s.execute(update(Job).where(Job.id == job_id).values(**values))
            s.commit()
        if final:
            # Only report once retries are exhausted — a transient blip that succeeds on
            # retry isn't worth an alert, and Sentry's free tier meters errors by volume.
            sentry_sdk.capture_exception(exc)
            mark_failed(invoice_id, error, self.session_factory)

    # -- in-process worker thread ---------------------------------------------
    def _loop(self) -> None:
        log.info("postgres queue worker started")
        try:
            self.recover_stale()
        except Exception:  # noqa: BLE001
            log.exception("stale-job recovery failed")
        while not self._stop.is_set():
            try:
                worked = self.run_once()
            except Exception:  # noqa: BLE001 - never let the worker thread die
                log.exception("worker iteration failed")
                worked = False
            if not worked:
                self._stop.wait(self.poll_seconds)

    def start(self) -> None:
        if self._thread and self._thread.is_alive():
            return
        self._stop.clear()
        self._thread = threading.Thread(target=self._loop, name="invoice-worker", daemon=True)
        self._thread.start()

    def stop(self) -> None:
        self._stop.set()
        if self._thread:
            self._thread.join(timeout=5)
