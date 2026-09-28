"""Tests the optional Celery backend with Celery's own "eager" mode (runs the task inline,
synchronously, no Redis or worker process needed) — the same technique the README documents
for exercising it in CI.

Skipped automatically if celery/redis aren't installed (they're optional — see
requirements-celery.txt), so this file doesn't break environments that only use the default
Postgres queue.
"""
import uuid

import pytest

pytest.importorskip("celery")

import app.queue.celery_queue as cq  # noqa: E402
from app.models import Invoice  # noqa: E402
from app.services.extraction import FakeExtractor  # noqa: E402
from app.services.pipeline import mark_failed as real_mark_failed  # noqa: E402
from app.services.pipeline import process_invoice as real_process_invoice  # noqa: E402
from tests.conftest import PDF  # noqa: E402


@pytest.fixture(autouse=True)
def eager_mode():
    """Run tasks inline instead of needing a real Redis broker + worker process."""
    cq.celery_app.conf.task_always_eager = True
    cq.celery_app.conf.task_eager_propagates = False  # match production: .delay() never raises
    yield
    cq.celery_app.conf.task_always_eager = False
    cq.celery_app.conf.task_eager_propagates = False


def make_invoice(session_factory, storage, path="x/a.pdf"):
    storage.save(path, PDF, "application/pdf")
    with session_factory() as s:
        inv = Invoice(user_id=uuid.uuid4(), filename="a.pdf", storage_path=path,
                      content_type="application/pdf", status="queued", issues=[])
        s.add(inv)
        s.commit()
        return inv.id


def patch_dependencies(monkeypatch, session_factory, storage, extractor):
    """process_invoice_task looks up build_storage/build_extractor itself and calls
    process_invoice()/mark_failed() with the production SessionLocal default — patch all
    four, at the names celery_queue.py imported them under, so the task runs against the
    test database instead of a real one.

    (Finding worth noting: mark_failed() isn't given an explicit session_factory in
    celery_queue.py the way PostgresQueue._on_failure() gives it one — harmless in production,
    since there's only one real database, but it means this exact same failure path was
    untestable without this patch. Confirmed by first seeing this test fail with the invoice
    stuck on "processing" instead of "failed", traced to mark_failed() silently writing to a
    different database via its default.)"""
    monkeypatch.setattr(cq, "build_storage", lambda _s: storage)
    monkeypatch.setattr(cq, "build_extractor", lambda _s: extractor)
    monkeypatch.setattr(
        cq, "process_invoice",
        lambda invoice_id, storage_, extractor_: real_process_invoice(
            invoice_id, storage_, extractor_, session_factory
        ),
    )
    monkeypatch.setattr(
        cq, "mark_failed",
        lambda invoice_id, error: real_mark_failed(invoice_id, error, session_factory),
    )


def test_celery_task_processes_invoice_successfully(session_factory, storage, monkeypatch):
    patch_dependencies(monkeypatch, session_factory, storage, FakeExtractor())
    inv_id = make_invoice(session_factory, storage)

    cq.process_invoice_task.delay(str(inv_id))

    with session_factory() as s:
        inv = s.get(Invoice, inv_id)
        assert inv.status == "needs_review"
        assert inv.vendor == "Demo Traders"  # FakeExtractor's fixed result
        assert inv.issues == []


def test_celery_task_marks_invoice_failed_after_exhausting_retries(
    session_factory, storage, monkeypatch
):
    class Broken:
        def extract(self, *_args):
            raise RuntimeError("extraction exploded")

    patch_dependencies(monkeypatch, session_factory, storage, Broken())
    monkeypatch.setattr(cq.process_invoice_task, "max_retries", 0)  # fail on the first attempt
    inv_id = make_invoice(session_factory, storage)

    cq.process_invoice_task.delay(str(inv_id))

    with session_factory() as s:
        inv = s.get(Invoice, inv_id)
        assert inv.status == "failed"
        assert "extraction exploded" in inv.error


def test_enqueue_sends_after_the_transaction_commits(session_factory, storage, monkeypatch):
    """CeleryQueue.enqueue() must not fire until the DB row is actually committed — otherwise
    a worker could pick up the task before the invoice exists to find."""
    patch_dependencies(monkeypatch, session_factory, storage, FakeExtractor())
    queue = cq.CeleryQueue()

    with session_factory() as s:
        inv = Invoice(user_id=uuid.uuid4(), filename="a.pdf", storage_path="x/b.pdf",
                      content_type="application/pdf", status="queued", issues=[])
        s.add(inv)
        s.flush()
        queue.enqueue(inv.id, s)
        storage.save("x/b.pdf", PDF, "application/pdf")

        # Not committed yet — the task must not have run.
        still_queued = s.get(Invoice, inv.id).status
        assert still_queued == "queued"

        s.commit()  # fires the after_commit hook -> process_invoice_task.delay(...)

    with session_factory() as s:
        assert s.get(Invoice, inv.id).status == "needs_review"
