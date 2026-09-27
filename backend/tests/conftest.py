import os
import uuid

os.environ["RUN_WORKER_IN_API"] = "false"  # tests drive the queue explicitly

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy.orm import sessionmaker  # noqa: E402

from app.core.auth import current_user_id  # noqa: E402
from app.db.session import Base, get_db, make_engine  # noqa: E402
from app.main import create_app  # noqa: E402
from app.queue.postgres_queue import PostgresQueue  # noqa: E402
from app.services.extraction import FakeExtractor  # noqa: E402
from app.services.pipeline import process_invoice  # noqa: E402
from app.services.storage import LocalStorage  # noqa: E402

TEST_DB_URL = os.getenv("TEST_DATABASE_URL")  # set in CI to exercise real Postgres

PDF = b"%PDF-1.4\n%fake test pdf\n"


@pytest.fixture()
def engine(tmp_path):
    if TEST_DB_URL:
        eng = make_engine(TEST_DB_URL.replace("postgresql://", "postgresql+psycopg://", 1))
    else:
        eng = make_engine(f"sqlite:///{tmp_path / 'test.db'}")
    Base.metadata.drop_all(eng)
    Base.metadata.create_all(eng)
    yield eng
    Base.metadata.drop_all(eng)
    eng.dispose()


@pytest.fixture()
def session_factory(engine):
    return sessionmaker(bind=engine, expire_on_commit=False)


@pytest.fixture()
def storage(tmp_path):
    return LocalStorage(str(tmp_path / "files"))


@pytest.fixture()
def queue(session_factory, storage):
    extractor = FakeExtractor()
    return PostgresQueue(
        process=lambda invoice_id: process_invoice(invoice_id, storage, extractor,
                                                    session_factory),
        session_factory=session_factory,
        max_attempts=3,
        stale_seconds=60,
    )


class Client:
    """TestClient plus the identity it is acting as."""

    def __init__(self, app):
        self.http = TestClient(app)
        self.user_id = uuid.uuid4()

    def as_user(self, user_id):
        self.user_id = user_id
        return self


@pytest.fixture()
def api(session_factory, storage, queue):
    app = create_app(queue=queue, storage=storage)

    def _db():
        with session_factory() as s:
            yield s

    app.dependency_overrides[get_db] = _db
    client = Client(app)
    app.dependency_overrides[current_user_id] = lambda: client.user_id
    with client.http:  # runs the app lifespan
        yield client


@pytest.fixture()
def upload(api):
    def _upload(name="a.pdf", data=PDF, ctype="application/pdf"):
        return api.http.post("/invoices", files=[("files", (name, data, ctype))])

    return _upload
