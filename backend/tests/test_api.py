import uuid

from fastapi.testclient import TestClient

from app.main import create_app
from app.services.extraction import FakeExtractor
from app.services.pipeline import process_invoice
from tests.conftest import PDF

FIELDS = ("vendor", "invoice_number", "invoice_date", "currency",
          "subtotal", "tax", "total", "items")


def process_all(queue):
    while queue.run_once():
        pass


def use_extractor(queue, storage, extractor):
    queue.process = lambda i: process_invoice(i, storage, extractor, queue.session_factory)


def editable(invoice_json):
    return {k: invoice_json[k] for k in FIELDS}


def test_requires_auth(storage, queue):
    with TestClient(create_app(queue=queue, storage=storage)) as c:
        assert c.get("/invoices").status_code == 401
        assert c.get("/invoices", headers={"Authorization": "Bearer nope"}).status_code == 401


def test_upload_process_review_approve_export(api, queue, upload):
    r = upload()
    assert r.status_code == 201
    inv = r.json()[0]
    assert inv["status"] == "queued"

    process_all(queue)
    inv = api.http.get(f"/invoices/{inv['id']}").json()
    assert inv["status"] == "needs_review"
    assert inv["vendor"] == "Demo Traders" and inv["total"] == 1170
    assert inv["issues"] == [] and len(inv["items"]) == 2

    # nothing approved yet -> header row only
    assert len(api.http.get("/invoices/export.csv").text.strip().splitlines()) == 1

    r = api.http.put(f"/invoices/{inv['id']}", json={**editable(inv), "approve": True})
    assert r.status_code == 200 and r.json()["status"] == "approved"

    csv_text = api.http.get("/invoices/export.csv").text
    assert "Demo Traders,INV-001,2026-01-15,PKR,1000.00,170.00,1170.00" in csv_text


def test_bad_math_blocks_approval_unless_fixed_or_acknowledged(api, queue, upload, storage):
    bad = FakeExtractor({"vendor": "V", "invoice_number": "1", "invoice_date": "2026-01-01",
                         "subtotal": 100, "tax": 10, "total": 999, "items": []})
    use_extractor(queue, storage, bad)

    inv = upload().json()[0]
    process_all(queue)
    got = api.http.get(f"/invoices/{inv['id']}").json()
    assert any(i["code"] == "total_math" for i in got["issues"])

    body = editable(got)
    assert api.http.put(f"/invoices/{inv['id']}", json={**body, "approve": True}).status_code == 422

    fixed = api.http.put(f"/invoices/{inv['id']}", json={**body, "total": 110, "approve": True})
    assert fixed.status_code == 200 and fixed.json()["status"] == "approved"


def test_duplicate_is_detected(api, queue, upload):
    # Different bytes (so the file-hash check doesn't fire) but the FakeExtractor returns the
    # same vendor/number/total for both — this is the extracted-content duplicate check.
    first = upload().json()[0]
    process_all(queue)
    got = api.http.get(f"/invoices/{first['id']}").json()
    api.http.put(f"/invoices/{first['id']}", json={**editable(got), "approve": True})

    second = upload("b.pdf", PDF + b"\n%different bytes, same fake-extracted content\n").json()[0]
    process_all(queue)
    got = api.http.get(f"/invoices/{second['id']}").json()
    assert got["is_duplicate"] is True
    assert any(i["code"] == "duplicate" for i in got["issues"])


def test_identical_file_is_rejected_before_extraction(api, upload):
    first = upload().json()[0]
    assert first["status"] == "queued"

    r = upload()  # exact same bytes as the default `upload()` fixture call
    assert r.status_code == 409
    assert "already uploaded" in r.json()["detail"]


def test_identical_files_in_the_same_batch_are_rejected(api):
    same = ("files", ("a.pdf", PDF, "application/pdf"))
    other_name = ("files", ("b.pdf", PDF, "application/pdf"))
    r = api.http.post("/invoices", files=[same, other_name])
    assert r.status_code == 409
    assert "identical to" in r.json()["detail"]
    assert api.http.get("/invoices").json() == []  # neither one was created


def test_users_cannot_see_each_others_invoices(api, queue, upload):
    inv = upload().json()[0]
    process_all(queue)
    api.as_user(uuid.uuid4())  # someone else
    assert api.http.get(f"/invoices/{inv['id']}").status_code == 404
    assert api.http.get(f"/invoices/{inv['id']}/file").status_code == 404
    assert api.http.delete(f"/invoices/{inv['id']}").status_code == 404
    assert api.http.get("/invoices").json() == []


def test_rejects_wrong_type_and_spoofed_content(api, upload):
    assert upload("a.txt", b"hello", "text/plain").status_code == 415
    assert upload("a.pdf", b"not really a pdf", "application/pdf").status_code == 415


def test_rejects_oversize_upload(api, upload, monkeypatch):
    from app.core.config import get_settings

    monkeypatch.setenv("MAX_UPLOAD_MB", "1")
    get_settings.cache_clear()
    try:
        assert upload("big.pdf", PDF + b"0" * (1024 * 1024 + 1)).status_code == 413
    finally:
        get_settings.cache_clear()


def test_failed_invoice_can_be_retried(api, queue, upload, storage):
    class Broken:
        def extract(self, *_):
            raise RuntimeError("no luck")

    good = queue.process
    use_extractor(queue, storage, Broken())
    queue.max_attempts = 1
    inv = upload().json()[0]
    process_all(queue)
    assert api.http.get(f"/invoices/{inv['id']}").json()["status"] == "failed"

    queue.process = good
    assert api.http.post(f"/invoices/{inv['id']}/retry").status_code == 200
    process_all(queue)
    assert api.http.get(f"/invoices/{inv['id']}").json()["status"] == "needs_review"


def test_csv_export_neutralises_formula_injection(api, queue, upload, storage):
    evil = FakeExtractor({"vendor": '=HYPERLINK("http://x")', "invoice_number": "9",
                          "invoice_date": "2026-01-01", "total": 5, "items": []})
    use_extractor(queue, storage, evil)
    inv = upload().json()[0]
    process_all(queue)
    got = api.http.get(f"/invoices/{inv['id']}").json()
    api.http.put(f"/invoices/{inv['id']}",
                 json={**editable(got), "approve": True, "acknowledge_issues": True})
    assert "'=HYPERLINK" in api.http.get("/invoices/export.csv").text


def test_delete_removes_invoice_and_file(api, upload):
    inv = upload().json()[0]
    assert api.http.delete(f"/invoices/{inv['id']}").status_code == 204
    assert api.http.get(f"/invoices/{inv['id']}").status_code == 404
