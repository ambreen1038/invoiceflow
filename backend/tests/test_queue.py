import uuid
from datetime import timedelta

from app.db.session import utcnow
from app.models import Invoice, Job
from app.queue.postgres_queue import PostgresQueue, backoff_seconds


def make_invoice(sf, user=None):
    with sf() as s:
        inv = Invoice(user_id=user or uuid.uuid4(), filename="a.pdf", storage_path="x/a.pdf",
                      content_type="application/pdf", status="queued", issues=[])
        s.add(inv)
        s.flush()
        s.add(Job(invoice_id=inv.id))
        s.commit()
        return inv.id


def make_queue(sf, process, **kw):
    return PostgresQueue(process=process, session_factory=sf, **kw)


def test_empty_queue_returns_false(session_factory):
    assert make_queue(session_factory, lambda i: None).run_once() is False


def test_successful_job_is_marked_done(session_factory):
    seen = []
    make_invoice(session_factory)
    q = make_queue(session_factory, seen.append)
    assert q.run_once() is True
    assert len(seen) == 1
    with session_factory() as s:
        job = s.query(Job).one()
        assert (job.status, job.attempts) == ("done", 1)
    assert q.run_once() is False


def test_failed_job_is_retried_with_backoff_then_fails(session_factory):
    inv_id = make_invoice(session_factory)

    def boom(_):
        raise RuntimeError("llm exploded")

    q = make_queue(session_factory, boom, max_attempts=2)
    assert q.run_once() is True  # attempt 1 -> rescheduled into the future
    with session_factory() as s:
        job = s.query(Job).one()
        assert (job.status, job.attempts) == ("pending", 1)
        assert job.run_at > utcnow() + timedelta(seconds=backoff_seconds(1) - 5)
        assert s.get(Invoice, inv_id).status == "queued"
        job.run_at = utcnow() - timedelta(seconds=1)  # fast-forward past the backoff
        s.commit()
    assert q.run_once() is True  # attempt 2 -> final
    with session_factory() as s:
        assert s.query(Job).one().status == "failed"
        inv = s.get(Invoice, inv_id)
        assert inv.status == "failed" and "llm exploded" in inv.error
    assert q.run_once() is False


def test_job_scheduled_in_future_is_not_claimed(session_factory):
    make_invoice(session_factory)
    with session_factory() as s:
        s.query(Job).update({"run_at": utcnow() + timedelta(hours=1)})
        s.commit()
    assert make_queue(session_factory, lambda i: None).run_once() is False


def test_stale_processing_jobs_are_recovered(session_factory):
    make_invoice(session_factory)
    with session_factory() as s:
        s.query(Job).update({"status": "processing", "locked_at": utcnow() - timedelta(hours=1)})
        s.commit()
    q = make_queue(session_factory, lambda i: None, stale_seconds=60)
    assert q.recover_stale() == 1
    assert q.run_once() is True


def test_fresh_processing_jobs_are_left_alone(session_factory):
    make_invoice(session_factory)
    with session_factory() as s:
        s.query(Job).update({"status": "processing", "locked_at": utcnow()})
        s.commit()
    assert make_queue(session_factory, lambda i: None, stale_seconds=60).recover_stale() == 0
