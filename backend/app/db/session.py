from datetime import datetime, timezone

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.core.config import get_settings


class Base(DeclarativeBase):
    pass


def utcnow() -> datetime:
    """Naive UTC timestamp. All DateTime columns store naive UTC."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


def make_engine(url: str | None = None):
    url = url or get_settings().sqlalchemy_url
    kwargs = {"pool_pre_ping": True}
    if url.startswith("sqlite"):
        kwargs["connect_args"] = {"check_same_thread": False}
    else:
        # Without this, a stalled network path to the database (a bad pooler connection, a
        # network blip) hangs a request indefinitely instead of failing fast with a clear
        # error — psycopg has no connect timeout by default.
        kwargs["connect_args"] = {"connect_timeout": 10}
        # SQLAlchemy's default pool (size 5 + overflow 10 = up to 15) can, on its own, hit
        # Supabase's Session Pooler cap of 15 concurrent connections on the free tier — with
        # nothing else connected. Capped well under that so the app always leaves headroom
        # for a migration, a one-off script, or a second process.
        kwargs["pool_size"] = 3
        kwargs["max_overflow"] = 2
        kwargs["pool_timeout"] = 10
    return create_engine(url, **kwargs)


engine = make_engine()
SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)


def get_db():
    with SessionLocal() as session:
        yield session
